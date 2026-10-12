/* ===== utils.js =====
   Small helper functions used by other files. */

const $ = id => document.getElementById(id);

const PROGRESS_LABELS = { TBR: 'To read', READING: 'Reading', READ: 'Read', ONHOLD: 'On hold', DNF: 'Did not finish' };
const FORMAT_INFO = {
    physical:  { label: 'Physical',  icon: 'fa-book' },
    ebook:     { label: 'Ebook',     icon: 'fa-tablet-screen-button' },
    audiobook: { label: 'Audiobook', icon: 'fa-headphones' }
};

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Turns "2025-03-09" into a date at midnight in YOUR timezone.
// (new Date("2025-03-09") alone would land on the 8th in the Americas.)
function parseDateLocal(input) {
    if (!input) return null;
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
        const [y, m, d] = input.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const d = new Date(input);
    return isNaN(d) ? null : d;
}

function todayISO() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---------- saving and loading ---------- */

// Some browsers block storage (private mode, embedded previews). These never crash.
function storeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function storeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }
function storeRemove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }


function readStore(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
        console.error('Could not read', key, err);
        return fallback;
    }
}

function writeStore(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (err) {
        console.error('Could not save', key, err);
        alert('Could not save your changes. The browser storage may be full or blocked (private mode?). Download a backup from Config to be safe.');
        return false;
    }
}

function saveBooks() { return writeStore(STORAGE.data, books); }
function saveQueue() { return writeStore(STORAGE.queue, queueIds); }

/* ---------- tidy up data (also repairs imported backups) ---------- */

function normalizeBook(b) {
    const out = { ...b };
    out.id = out.id ? String(out.id) : generateId();
    out.title = out.title || 'Untitled';
    out.author = out.author || '';
    out.progress = PROGRESS_LABELS[out.progress] ? out.progress : 'TBR';
    out.formats = (Array.isArray(out.formats) ? out.formats : []).filter(f => FORMAT_INFO[f]);
    out.tags = Array.isArray(out.tags) ? out.tags.map(t => String(t).trim()).filter(Boolean) : [];
    out.finishedDates = Array.isArray(out.finishedDates) ? out.finishedDates.filter(Boolean) : [];
    out.series = (out.series || '').trim();
    out.seriesPart = Number(out.seriesPart) || 0;
    out.pages = Number(out.pages) || 0;
    out.currentPage = Number(out.currentPage) || 0;
    out.rating = Math.max(0, Math.min(5, Math.round(Number(out.rating) || 0)));
    out.pinned = !!out.pinned;
    return out;
}

function ensureDataIntegrity() {
    books = (Array.isArray(books) ? books : [])
        .filter(b => b && typeof b === 'object')
        .map(normalizeBook);
}

/* ---------- covers ---------- */

function coverUrlFor(b) {
    const url = (b.coverUrl || '').trim();
    if (/^https?:\/\//i.test(url)) return url;
    const isbn = String(b.isbn || '').replace(/[^0-9Xx]/g, '');
    if (isbn.length === 10 || isbn.length === 13) {
        return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
    }
    return '';
}

function hueFor(text) {
    let h = 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
}

// A cover is always a coloured "jacket" with the title on it.
// If a real image loads, it is laid on top of the jacket.
function coverHtml(b, sizeClass) {
    const url = coverUrlFor(b);
    const img = url
        ? `<img class="cover-img" src="${escapeHtml(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : '';
    return `<div class="cover ${sizeClass || ''}" style="--h:${hueFor(b.title)}"><div class="cover-ph"><span>${escapeHtml(b.title)}</span></div>${img}</div>`;
}

function wireCovers(root) {
    root.querySelectorAll('img.cover-img').forEach(img => {
        img.addEventListener('error', () => img.remove());
        img.addEventListener('load', () => { if (img.naturalWidth <= 1) img.remove(); });
    });
}

function formatIconsHtml(b) {
    if (!b.formats.length) return '';
    return `<span class="fmt-icons">${b.formats.map(f =>
        `<i class="fa-solid ${FORMAT_INFO[f].icon}" title="${FORMAT_INFO[f].label}" aria-label="${FORMAT_INFO[f].label}"></i>`).join('')}</span>`;
}

function starsHtml(rating) {
    if (!rating) return '';
    return `<span class="card-stars" aria-label="${rating} of 5 stars">${'★'.repeat(rating)}<span class="off">${'★'.repeat(5 - rating)}</span></span>`;
}

function latestFinish(b) {
    const dates = (b.finishedDates || []).slice().sort();
    return dates.length ? dates[dates.length - 1] : null;
}
