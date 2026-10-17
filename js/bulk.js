/* ===== bulk.js =====
   Select mode: pick many books and change them all at once. */

function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}

function updateBulkBar() {
    $('bulkBarCount').textContent = selectedIds.size === 1 ? '1 selected' : `${selectedIds.size} selected`;
}

function refreshSelectionUI() {
    document.querySelectorAll('#bookList .book[data-id]').forEach(el =>
        el.classList.toggle('selected', selectedIds.has(el.dataset.id)));
    updateBulkBar();
}

function toggleSelected(id) {
    if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
    refreshSelectionUI();
}

function toggleSelectMode() {
    if (selectMode) { exitSelectMode(true); return; }
    selectMode = true;
    selectedIds = new Set();
    document.body.classList.add('select-mode');
    $('btnSelect').textContent = 'Done';
    $('bulkBar').classList.remove('hidden');
    updateBulkBar();
    renderLibrary();
}

function exitSelectMode(redraw) {
    selectMode = false;
    selectedIds = new Set();
    document.body.classList.remove('select-mode');
    $('btnSelect').textContent = 'Select';
    $('bulkBar').classList.add('hidden');
    if (redraw) renderLibrary();
}

// Selects every book that is currently shown (respects search and filters)
function selectAllShown() {
    const shown = getVisibleBooks();
    const allOn = shown.length > 0 && shown.every(b => selectedIds.has(b.id));
    shown.forEach(b => { if (allOn) selectedIds.delete(b.id); else selectedIds.add(b.id); });
    refreshSelectionUI();
}

function clearSelection() {
    selectedIds = new Set();
    refreshSelectionUI();
}

/* ---------- the bulk edit sheet ---------- */

function openBulkModal() {
    if (selectedIds.size === 0) { toast('Tap some books first, or use "All shown".'); return; }
    $('bulkTitle').textContent = selectedIds.size === 1 ? 'Edit 1 book' : `Edit ${selectedIds.size} books`;
    $('bulkCount').textContent = selectedIds.size;
    $('bulkStatus').value = '';
    $('bulkFormatMode').value = 'keep';
    $('bulkAddTags').value = '';
    $('bulkRemoveTags').value = '';
    bulkFormats = new Set();
    $('bulkFormatChips').querySelectorAll('.fmt').forEach(b => b.classList.remove('on'));
    $('bulkModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    $('bulkModal').querySelector('.sheet').scrollTop = 0;
}

function closeBulkModal() {
    $('bulkModal').classList.add('hidden');
    document.body.style.overflow = '';
}

const parseList = str => str.split(',').map(t => t.trim()).filter(Boolean);

function applyBulk() {
    const status = $('bulkStatus').value;
    const mode = $('bulkFormatMode').value;
    const addTags = parseList($('bulkAddTags').value);
    const removeTags = parseList($('bulkRemoveTags').value).map(t => t.toLowerCase());

    if (mode !== 'keep' && bulkFormats.size === 0) { toast('Pick at least one format, or choose "Leave as is".'); return; }
    if (!status && mode === 'keep' && !addTags.length && !removeTags.length) { toast('Nothing to change yet.'); return; }

    let count = 0;
    selectedIds.forEach(id => {
        const b = books.find(x => x.id === id);
        if (!b) return;
        if (status) b.progress = status;
        if (mode === 'add') b.formats = Array.from(new Set([...b.formats, ...bulkFormats]));
        if (mode === 'set') b.formats = Array.from(bulkFormats);
        if (addTags.length) {
            const have = new Set(b.tags.map(t => t.toLowerCase()));
            addTags.forEach(t => { if (!have.has(t.toLowerCase())) { b.tags.push(t); have.add(t.toLowerCase()); } });
        }
        if (removeTags.length) b.tags = b.tags.filter(t => !removeTags.includes(t.toLowerCase()));
        count++;
    });

    if (status === 'READING' || status === 'READ' || status === 'DNF') {
        queueIds = queueIds.filter(q => !selectedIds.has(q));
        saveQueue();
    }
    saveBooks();
    closeBulkModal();
    exitSelectMode(true);
    toast(`Updated ${count} ${count === 1 ? 'book' : 'books'}`);
}

function deleteSelected() {
    const n = selectedIds.size;
    if (!confirm(`Delete ${n} ${n === 1 ? 'book' : 'books'}? This cannot be undone (download a backup first if unsure).`)) return;
    books = books.filter(b => !selectedIds.has(b.id));
    queueIds = queueIds.filter(q => !selectedIds.has(q));
    discoveryIds = discoveryIds.filter(q => !selectedIds.has(q));
    saveBooks();
    saveQueue();
    closeBulkModal();
    exitSelectMode(true);
    toast(`Deleted ${n} ${n === 1 ? 'book' : 'books'}`);
}

function initBulk() {
    $('bulkFormatChips').querySelectorAll('.fmt').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.dataset.format;
            if (bulkFormats.has(f)) bulkFormats.delete(f); else bulkFormats.add(f);
            btn.classList.toggle('on', bulkFormats.has(f));
            // choosing chips implies you want them applied
            if ($('bulkFormatMode').value === 'keep' && bulkFormats.size) $('bulkFormatMode').value = 'add';
        });
    });
    $('bulkModal').addEventListener('click', e => { if (e.target === $('bulkModal')) closeBulkModal(); });
}
