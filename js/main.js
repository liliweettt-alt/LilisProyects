/* ===== library.js =====
   The Library tab: filters, series folders, pinning, drawing the book cards. */

function allTags() {
    const set = new Set();
    books.forEach(b => b.tags.forEach(t => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function populateFilterDropdowns() {
    const tags = allTags();
    const opts = tags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

    const filterSelect = $('filterTags');
    const current = filterSelect.value;
    filterSelect.innerHTML = `<option value="all">Any tag</option>${opts}`;
    if (tags.includes(current)) filterSelect.value = current;

    $('selTagsHelper').innerHTML = `<option value="">Add existing tag…</option>${opts}`;
}

function togglePin(id) {
    const b = books.find(x => x.id === id);
    if (!b) return;
    b.pinned = !b.pinned;
    saveBooks();
    renderLibrary();
}

function toggleDetails(btn, id) {
    const panel = btn.closest('.book').querySelector('.details-panel');
    const wasOpen = expandedCards.has(id);
    if (wasOpen) expandedCards.delete(id); else expandedCards.add(id);
    panel.hidden = wasOpen;
    btn.setAttribute('aria-expanded', String(!wasOpen));
    btn.setAttribute('aria-label', wasOpen ? 'Show summary and notes' : 'Hide summary and notes');
}

function openLink(link) {
    link = (link || '').trim();
    if (!link) return;
    const url = /^https?:\/\//i.test(link) ? link : `https://www.google.com/search?q=${encodeURIComponent(link)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

/* ---------- one book ---------- */

function buildBook(b, inFolder) {
    const card = document.createElement('article');
    card.className = 'book';

    const stateHtml = `<span class="state state-${b.progress.toLowerCase()}">${PROGRESS_LABELS[b.progress]}</span>`;

    let seriesHtml = '';
    if (b.series) {
        if (inFolder) {
            seriesHtml = b.seriesPart ? `<div class="book-series">Book ${escapeHtml(b.seriesPart)}</div>` : '';
        } else {
            seriesHtml = `<div class="book-series">${escapeHtml(b.series)}${b.seriesPart ? ' #' + escapeHtml(b.seriesPart) : ''}</div>`;
        }
    }

    const tagsHtml = b.tags.length
        ? `<div class="book-tags">${b.tags.slice(0, 4).map(escapeHtml).join(' · ')}</div>` : '';

    // progress area
    let progressHtml = '';
    if (b.pages && b.currentPage && b.progress !== 'READ') {
        const pct = Math.min(100, Math.round((b.currentPage / b.pages) * 100));
        progressHtml = `<div class="bar"><i style="width:${pct}%"></i></div>
                        <div class="prog-text"><b>${b.currentPage}</b> / ${b.pages} pages</div>`;
    } else if (b.progress === 'READ' && latestFinish(b)) {
        const d = parseDateLocal(latestFinish(b));
        const when = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        const times = b.finishedDates.length > 1 ? ` · read ${b.finishedDates.length}×` : '';
        progressHtml = `<div class="prog-text">Finished <b>${escapeHtml(when)}</b>${times}</div>`;
    } else if (b.pages) {
        progressHtml = `<div class="prog-text">${b.pages} pages</div>`;
    }

    // summary & notes panel
    const summary = (b.summary || '').trim();
    const notes = (b.notes || '').trim();
    const hasDetails = summary || notes;
    const isOpen = expandedCards.has(b.id);

    const toggleHtml = hasDetails
        ? `<button class="round-btn toggle-btn" aria-expanded="${isOpen}" aria-label="${isOpen ? 'Hide' : 'Show'} summary and notes"><i class="fa-solid fa-chevron-down"></i></button>` : '';
    const panelHtml = hasDetails
        ? `<div class="details-panel" ${isOpen ? '' : 'hidden'}>
              ${summary ? `<div><div class="detail-label">Summary</div><p class="detail-text">${escapeHtml(summary)}</p></div>` : ''}
              ${notes ? `<div><div class="detail-label">My notes</div><p class="detail-text notes-text">${escapeHtml(notes)}</p></div>` : ''}
           </div>` : '';

    const canQueue = b.progress === 'TBR' || b.progress === 'ONHOLD';
    const queued = queueIds.includes(b.id);
    const queueHtml = canQueue
        ? `<button class="round-btn queue-btn ${queued ? 'on' : ''}" aria-pressed="${queued}" aria-label="${queued ? 'Remove from Up next' : 'Add to Up next'}"><i class="fa-${queued ? 'solid' : 'regular'} fa-bookmark"></i></button>` : '';
    const linkHtml = (b.link || '').trim()
        ? `<button class="round-btn open-btn" aria-label="Open link"><i class="fa-solid fa-link"></i></button>` : '';

    card.innerHTML = `
        <div class="book-row">
            ${coverHtml(b)}
            <div class="book-body">
                <div class="book-top">
                    <h3 class="book-title">${escapeHtml(b.title)}</h3>
                    <button class="pin ${b.pinned ? 'on' : ''}" aria-pressed="${b.pinned}" aria-label="${b.pinned ? 'Unpin' : 'Pin'}"><i class="fa-solid fa-thumbtack"></i></button>
                </div>
                ${b.author ? `<div class="book-author">${escapeHtml(b.author)}</div>` : ''}
                ${seriesHtml}
                <div class="book-meta">${stateHtml}${formatIconsHtml(b)}${starsHtml(b.rating)}</div>
                ${tagsHtml}
                <div class="book-bottom">
                    <div class="book-progress">${progressHtml}</div>
                    ${queueHtml}${toggleHtml}${linkHtml}
                </div>
            </div>
        </div>
        ${panelHtml}`;

    wireCovers(card);
    card.querySelector('.book-row').addEventListener('click', () => openEditModal(b.id));
    card.querySelector('.pin').addEventListener('click', e => { e.stopPropagation(); togglePin(b.id); });
    const qb = card.querySelector('.queue-btn');
    if (qb) qb.addEventListener('click', e => { e.stopPropagation(); toggleQueue(b.id); });
    const ob = card.querySelector('.open-btn');
    if (ob) ob.addEventListener('click', e => { e.stopPropagation(); openLink(b.link); });
    const tb = card.querySelector('.toggle-btn');
    if (tb) tb.addEventListener('click', e => { e.stopPropagation(); toggleDetails(tb, b.id); });

    return card;
}

/* ---------- one series folder ---------- */

function buildSeriesFolder(group) {
    const wrap = document.createElement('section');
    wrap.className = 'series-folder';
    const readCount = group.books.filter(b => b.progress === 'READ').length;
    const open = !collapsedSeries.has(group.key);

    wrap.innerHTML = `
        <button class="series-head" aria-expanded="${open}">
            <span class="series-name">${escapeHtml(group.name)}</span>
            <span class="series-count">${group.books.length} books · ${readCount} read</span>
            <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="series-body" ${open ? '' : 'hidden'}></div>`;

    const body = wrap.querySelector('.series-body');
    group.books.forEach(b => body.appendChild(safeBuild(b, true)));

    const head = wrap.querySelector('.series-head');
    head.addEventListener('click', () => {
        const nowOpen = head.getAttribute('aria-expanded') !== 'true';
        head.setAttribute('aria-expanded', String(nowOpen));
        body.hidden = !nowOpen;
        if (nowOpen) collapsedSeries.delete(group.key); else collapsedSeries.add(group.key);
    });
    return wrap;
}

// If ONE book has odd data, show a small notice instead of breaking the whole list
function safeBuild(b, inFolder) {
    try {
        return buildBook(b, inFolder);
    } catch (err) {
        console.error('Could not draw book:', b, err);
        const notice = document.createElement('div');
        notice.className = 'book';
        notice.textContent = `Could not display "${b.title || 'Untitled'}". Press F12 and check the Console for details.`;
        return notice;
    }
}

/* ---------- the whole list ---------- */

const seriesKey = b => (b.series || '').trim().toLowerCase();

function getVisibleBooks() {
    const search = $('searchInput').value.trim().toLowerCase();
    const progF = $('filterProgress').value;
    const fmtF = $('filterFormat').value;
    const tagF = $('filterTags').value;
    const sortOpt = $('sortOption').value;

    const filtered = books.filter(b => {
        const hay = [b.title, b.author, b.series, b.tags.join(' '), b.summary].join(' ').toLowerCase();
        const okSearch = !search || hay.includes(search);
        const okProg = progF === 'all' ? true : (progF === 'PINNED' ? b.pinned : b.progress === progF);
        const okFmt = fmtF === 'all' || b.formats.includes(fmtF);
        const okTag = tagF === 'all' || b.tags.includes(tagF);
        return okSearch && okProg && okFmt && okTag;
    });

    filtered.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (sortOpt === 'az') return a.title.localeCompare(b.title, undefined, { numeric: true });
        if (sortOpt === 'author') return (a.author || '~').localeCompare(b.author || '~') || (a.seriesPart - b.seriesPart);
        if (sortOpt === 'rating') return b.rating - a.rating;
        if (sortOpt === 'pages') return b.pages - a.pages;
        return 0; // newest: the list is already newest first
    });
    return filtered;
}

function renderLibrary() {
    populateFilterDropdowns();
    const list = $('bookList');
    const visible = getVisibleBooks();

    const total = books.length;
    const toRead = books.filter(b => b.progress === 'TBR').length;
    $('libCount').textContent = total
        ? `${total} ${total === 1 ? 'book' : 'books'} · ${toRead} to read`
        : '';

    list.innerHTML = '';

    if (total === 0) {
        list.innerHTML = `<div class="empty"><b>Your shelf is empty</b>Tap the + button to add your first book, or restore a backup in Config.</div>`;
        return;
    }
    if (visible.length === 0) {
        list.innerHTML = `<div class="empty"><b>No matches</b>Try a different search or clear a filter.</div>`;
        return;
    }

    // group books that share a series (only when 2 or more are showing)
    const counts = {};
    visible.forEach(b => { const k = seriesKey(b); if (k) counts[k] = (counts[k] || 0) + 1; });
    const done = new Set();
    const shelf = document.createElement('div');
    shelf.className = 'shelf animate-in';

    visible.forEach(b => {
        const k = seriesKey(b);
        if (k && counts[k] > 1) {
            if (done.has(k)) return;
            done.add(k);
            const members = visible.filter(x => seriesKey(x) === k)
                .sort((x, y) => (x.seriesPart || 999) - (y.seriesPart || 999) || x.title.localeCompare(y.title));
            shelf.appendChild(buildSeriesFolder({ key: k, name: b.series, books: members }));
        } else {
            shelf.appendChild(safeBuild(b, false));
        }
    });
    list.appendChild(shelf);
}
