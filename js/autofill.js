/* ===== autofill.js =====
   Fills in missing covers, pages, summaries and tags by looking books up on
   Open Library (and Google Books as a backup).
   It only ever fills EMPTY fields, and it can be undone. */

const sleep = ms => new Promise(r => setTimeout(r, ms));
let gbBlocked = false;      // Google Books said "too many requests" for this run
let wakeLock = null;

/* ---------- matching a search result to your book ---------- */

function normText(s) {
    return String(s || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ').trim();
}
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and']);
const tokensOf = s => normText(s).split(' ').filter(t => t && !STOP_WORDS.has(t));

function titleScore(query, candidate) {
    const a = Array.from(new Set(tokensOf(query)));
    const b = Array.from(new Set(tokensOf(candidate)));
    if (!a.length || !b.length) return 0;
    const sb = new Set(b);
    const inter = a.filter(t => sb.has(t)).length;
    const dice = (2 * inter) / (a.length + b.length);
    const containsAll = inter === a.length && b.length <= a.length + 4;
    return containsAll ? Math.max(dice, 0.8) : dice;
}

function authorOk(bookAuthor, candAuthors) {
    const a = tokensOf(bookAuthor);
    if (!a.length || !candAuthors || !candAuthors.length) return true; // nothing to compare
    return candAuthors.some(name => tokensOf(name).some(t => a.includes(t)));
}

// items look like { title, authors: [], raw }. Returns the best acceptable one, or null.
function pickBest(items, book, queryTitle) {
    let best = null, bestScore = 0;
    (items || []).forEach(it => {
        if (!it || !it.title) return;
        if (!authorOk(book.author, it.authors)) return;
        const sc = titleScore(queryTitle, it.title);
        if (sc > bestScore) { best = it; bestScore = sc; }
    });
    return bestScore >= 0.75 ? best : null;
}

function buildQueries(book) {
    const t = book.title.trim();
    const a = (book.author || '').trim();
    const stripped = t.replace(/[\s,:\-]*(?:vol(?:ume)?\.?|book|part|#)?\s*\d+\s*$/i, '').trim();
    const list = [{ t, a }];
    if (a) list.push({ t, a: '' });
    if (stripped && stripped !== t) list.push({ t: stripped, a });
    return list;
}

/* ---------- cleaning what comes back ---------- */

const BAD_TAG = /(:|accessible|protected|daisy|large type|in library|open library|staff pick|reading level|lending|internet archive|overdrive|bestseller|new york times|^fiction$|^novel$|^general$|^books?$|^translations?|^english|^spanish|specimen)/i;

function cleanTags(list) {
    const out = [], seen = new Set();
    (list || []).forEach(raw => {
        let t = String(raw || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t || t.length > 28 || t.split(' ').length > 3 || BAD_TAG.test(t)) return;
        t = t.charAt(0).toUpperCase() + t.slice(1);
        const k = t.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        out.push(t);
    });
    return out.slice(0, 4);
}

function cleanText(input) {
    if (!input) return '';
    let s = typeof input === 'object' ? (input.value || '') : String(input);
    s = s.split(/\r?\n\s*-{3,}/)[0];                          // Open Library adds "----- source" footers
    s = s.replace(/<br\s*\/?>|<\/p>/gi, '\n');
    s = new DOMParser().parseFromString(s, 'text/html').body.textContent || '';   // strips HTML safely
    s = s.replace(/\(\[source\]\[\d+\]\)/g, '')
         .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')            // [text](link) -> text
         .replace(/\[([^\]]+)\]\[\d+\]/g, '$1')
         .replace(/[*_]{1,3}/g, '')
         .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (s.length > 700) {
        const cut = s.lastIndexOf('. ', 700);
        s = (cut > 300 ? s.slice(0, cut + 1) : s.slice(0, 700).trim() + '…');
    }
    return s;
}

/* ---------- talking to the services ---------- */

async function fetchJSON(url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
        const res = await fetch(url, { signal: ctl.signal, referrerPolicy: 'no-referrer', credentials: 'omit' });
        if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
        return await res.json();
    } finally { clearTimeout(timer); }
}

async function olSearch(title, author) {
    let url = 'https://openlibrary.org/search.json?limit=8'
        + '&fields=key,title,author_name,cover_i,number_of_pages_median,isbn,subject'
        + '&title=' + encodeURIComponent(title);
    if (author) url += '&author=' + encodeURIComponent(author);
    const data = await fetchJSON(url);
    return (data.docs || []).map(d => ({ title: d.title, authors: d.author_name || [], raw: d }));
}

async function olDescription(workKey) {
    try {
        const data = await fetchJSON('https://openlibrary.org' + workKey + '.json');
        return cleanText(data.description);
    } catch (e) { return ''; }
}

function olData(doc) {
    const isbns = doc.isbn || [];
    return {
        cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
        pages: Number(doc.number_of_pages_median) || 0,
        isbn: isbns.find(i => i.length === 13) || isbns.find(i => i.length === 10) || '',
        tags: cleanTags(doc.subject),
        key: doc.key || ''
    };
}

async function gbSearch(title, author) {
    const q = `intitle:${title}` + (author ? ` inauthor:${author}` : '');
    const url = 'https://www.googleapis.com/books/v1/volumes?maxResults=5&printType=books'
        + '&fields=items(volumeInfo(title,authors,description,pageCount,categories,imageLinks,industryIdentifiers))'
        + '&q=' + encodeURIComponent(q);
    try {
        const data = await fetchJSON(url);
        return (data.items || []).map(i => ({ title: i.volumeInfo && i.volumeInfo.title, authors: (i.volumeInfo && i.volumeInfo.authors) || [], raw: i.volumeInfo || {} }));
    } catch (e) {
        if (e.status === 429 || e.status === 403) gbBlocked = true;   // too many requests: stop using it this run
        return [];
    }
}

function gbData(v) {
    const ids = v.industryIdentifiers || [];
    const isbn13 = ids.find(i => i.type === 'ISBN_13');
    const img = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
    const cats = [];
    (v.categories || []).forEach(c => String(c).split('/').forEach(p => cats.push(p.trim())));
    return {
        cover: img ? img.replace(/^http:/, 'https:').replace('&edge=curl', '') : '',
        pages: Number(v.pageCount) || 0,
        isbn: isbn13 ? isbn13.identifier : '',
        tags: cleanTags(cats.filter(c => c.toLowerCase() !== 'general')),
        summary: cleanText(v.description)
    };
}

/* ---------- what is still missing ---------- */

function readWants() {
    return {
        cover: $('afCover').checked, pages: $('afPages').checked,
        summary: $('afSummary').checked, tags: $('afTags').checked
    };
}

function missingFor(b, d, wants) {
    d = d || {};
    return {
        cover: wants.cover && !coverUrlFor(b) && !d.cover,
        pages: wants.pages && !b.pages && !d.pages,
        summary: wants.summary && !(b.summary || '').trim() && !d.summary,
        tags: wants.tags && !b.tags.length && !(d.tags && d.tags.length)
    };
}
const anyMissing = m => m.cover || m.pages || m.summary || m.tags;

/* ---------- look up one book ---------- */

async function lookupBook(book, wants) {
    let data = null, matched = '';

    for (const q of buildQueries(book)) {
        const hit = pickBest(await olSearch(q.t, q.a), book, q.t);
        await sleep(150);
        if (hit) {
            data = olData(hit.raw);
            matched = hit.title;
            if (wants.summary && !(book.summary || '').trim() && data.key) {
                data.summary = await olDescription(data.key);
                await sleep(150);
            }
            break;
        }
    }

    // Google Books fills whatever Open Library did not have
    if (!gbBlocked && anyMissing(missingFor(book, data, wants))) {
        for (const q of buildQueries(book).slice(0, 2)) {
            const hit = pickBest(await gbSearch(q.t, q.a), book, q.t);
            await sleep(150);
            if (hit) {
                const g = gbData(hit.raw);
                if (!data) { data = g; matched = hit.title; }
                else {
                    ['cover', 'pages', 'isbn', 'summary'].forEach(k => { if (!data[k] && g[k]) data[k] = g[k]; });
                    if (!(data.tags && data.tags.length) && g.tags.length) data.tags = g.tags;
                }
                break;
            }
            if (gbBlocked) break;
        }
    }
    return { data, matched };
}

// Writes into EMPTY fields only. Returns true if anything changed.
function applyFill(b, d, wants) {
    let changed = false;
    if (wants.cover && !coverUrlFor(b) && d.cover) { b.coverUrl = d.cover; changed = true; }
    if (wants.cover && !b.isbn && d.isbn) { b.isbn = d.isbn; changed = true; }
    if (wants.pages && !b.pages && d.pages > 0) { b.pages = d.pages; changed = true; }
    if (wants.summary && !(b.summary || '').trim() && d.summary) { b.summary = d.summary; changed = true; }
    if (wants.tags && !b.tags.length && d.tags && d.tags.length) { b.tags = d.tags.slice(); changed = true; }
    return changed;
}

/* ---------- running the whole library ---------- */

function needsLookup(b, wants) {
    return !b.lookedUp && anyMissing(missingFor(b, null, wants));
}

function setAfProgress(done, total, found) {
    $('afBarWrap').classList.remove('hidden');
    $('afBar').style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
    $('afStatus').textContent = `Looked at ${done} of ${total} books · ${found} filled in. Keep this page open.`;
}

async function startAutofill() {
    if (afRunning) return;
    const wants = readWants();
    if (!wants.cover && !wants.pages && !wants.summary && !wants.tags) { toast('Tick at least one thing to fill in.'); return; }

    const ids = books.filter(b => needsLookup(b, wants)).map(b => b.id);
    if (!ids.length) { toast('Nothing left to look up.'); renderAutofillPanel(); return; }

    const mins = Math.max(1, Math.round((ids.length * 1.4) / 60));
    if (!confirm(`This will look up ${ids.length} books online (roughly ${mins} min).\n\nSent: each book's title and author, to openlibrary.org (and to Google Books if Open Library has no answer). Nothing else from your library is sent, but those sites can see the requests and your internet address.\n\nContinue?`)) return;

    // keep a copy to undo with (only if there is not one already from an earlier run)
    if (!storeGet(STORAGE.undo)) {
        try { localStorage.setItem(STORAGE.undo, JSON.stringify({ at: Date.now(), books })); }
        catch (e) { if (!confirm('Could not make an undo copy (browser storage is nearly full). Continue without it?')) return; }
    }

    afRunning = true; afStop = false; gbBlocked = false;
    $('btnAfStart').classList.add('hidden');
    $('btnAfStop').classList.remove('hidden');
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }

    let done = 0, found = 0, fails = 0, ended = 'done';
    setAfProgress(0, ids.length, 0);

    for (const id of ids) {
        if (afStop) { ended = 'stopped'; break; }
        const snapshot = books.find(x => x.id === id);
        if (!snapshot) { done++; continue; }
        try {
            const r = await lookupBook(snapshot, wants);
            fails = 0;
            const cur = books.find(x => x.id === id);     // fresh copy in case you edited it meanwhile
            if (cur) {
                cur.lookedUp = Date.now();
                if (r.data && applyFill(cur, r.data, wants)) {
                    cur.autoFilled = true;
                    found++;
                    if (r.matched && normText(r.matched) !== normText(cur.title)) cur.autoMatch = r.matched;
                }
            }
        } catch (err) {
            fails++;                                       // not marked as looked-up, so it can be retried later
            if (fails >= 4) { ended = 'offline'; break; }
        }
        done++;
        setAfProgress(done, ids.length, found);
        if (done % 10 === 0) saveBooks();
        await sleep(200);
    }

    saveBooks();
    afRunning = false;
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ }
    wakeLock = null;
    $('btnAfStart').classList.remove('hidden');
    $('btnAfStop').classList.add('hidden');
    renderAutofillPanel();

    const msg = {
        done: `Finished: ${found} books filled in.`,
        stopped: `Stopped: ${found} books filled in so far. Press start again to continue.`,
        offline: `Paused: the services could not be reached (offline or busy). ${found} filled in so far. Try again later; progress is kept.`
    }[ended];
    $('afStatus').textContent = msg;
    toast(msg.split(':')[0]);
}

function stopAutofill() { afStop = true; $('afStatus').textContent = 'Stopping…'; }

function retryNotFound() {
    if (afRunning) return;
    let n = 0;
    books.forEach(b => { if (b.lookedUp && !b.autoFilled) { delete b.lookedUp; n++; } });
    saveBooks();
    renderAutofillPanel();
    toast(n ? `${n} books will be tried again.` : 'No not-found books to retry.');
}

/* ---------- undo ---------- */

function undoAutofill() {
    if (afRunning) { toast('Stop the auto-fill first.'); return; }
    const snap = readStore(STORAGE.undo, null);
    if (!snap || !Array.isArray(snap.books)) { renderAutofillPanel(); return; }
    const when = new Date(snap.at).toLocaleString('default', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    if (!confirm(`This puts your library back exactly as it was before auto-fill started (${when}). Anything you changed since then, including new books and edits, will be lost. Continue?`)) return;
    books = snap.books;
    ensureDataIntegrity();
    const ids = new Set(books.map(b => b.id));
    queueIds = queueIds.filter(q => ids.has(q));
    saveBooks(); saveQueue();
    storeRemove(STORAGE.undo);
    renderAutofillPanel();
    toast('Auto-fill undone');
}

function keepAutofill() {
    storeRemove(STORAGE.undo);
    renderAutofillPanel();
    toast('Results kept');
}

/* ---------- the panel in Config ---------- */

function reviewList(title, items, render) {
    if (!items.length) return '';
    const shown = items.slice(0, 200);
    return `<details><summary>${escapeHtml(title)} (${items.length})</summary><ul>${
        shown.map(b => `<li><button data-id="${escapeHtml(b.id)}">${render(b)}</button></li>`).join('')
    }</ul></details>`;
}

function renderAutofillPanel() {
    if (!$('autofillPanel')) return;
    const wants = readWants();
    const todo = books.filter(b => needsLookup(b, wants)).length;
    $('afCount').textContent = books.length
        ? (todo ? `${todo} of ${books.length} books are missing something and haven't been looked up yet.` : 'Every book has been looked up, or has everything you ticked.')
        : 'Add or restore some books first.';
    $('btnAfStart').disabled = afRunning || todo === 0;

    const snap = readStore(STORAGE.undo, null);
    $('afUndoRow').classList.toggle('hidden', !snap);
    if (snap) $('afUndoNote').textContent = 'A copy of your library from before auto-fill (' +
        new Date(snap.at).toLocaleDateString('default', { day: 'numeric', month: 'long' }) + ') is saved so you can undo.';

    const notFound = books.filter(b => b.lookedUp && !b.autoFilled);
    const differs = books.filter(b => b.autoMatch);
    $('btnAfRetry').classList.toggle('hidden', notFound.length === 0);
    $('afReview').innerHTML =
        reviewList('Check these matches', differs, b => `<b>${escapeHtml(b.title)}</b> → ${escapeHtml(b.autoMatch)}`) +
        reviewList('Not found', notFound, b => `<b>${escapeHtml(b.title)}</b>${b.author ? ' · ' + escapeHtml(b.author) : ''}`);
    $('afReview').querySelectorAll('button[data-id]').forEach(btn =>
        btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
}

function initAutofill() {
    ['afCover', 'afPages', 'afSummary', 'afTags'].forEach(id => $(id).addEventListener('change', renderAutofillPanel));
}
