/* ===== modal.js =====
   The Add/Edit sheet: form, stars, formats, finish dates, save and delete. */

function toggleDateUI() {
    const isRead = $('inpProgress').value === 'READ';
    $('dateSection').classList.toggle('hidden', !isRead);
}

function addDate() {
    // empty box + Add = today
    const d = $('newDate').value || todayISO();
    if (!tempDates.includes(d)) tempDates.push(d);
    tempDates.sort();
    renderDateList();
    $('newDate').value = '';
}

function removeDate(idx) {
    tempDates.splice(idx, 1);
    renderDateList();
}

function renderDateList() {
    const container = $('dateList');
    container.innerHTML = tempDates.map((d, i) => {
        const nice = parseDateLocal(d).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' });
        return `<div class="date-chip"><span>${escapeHtml(nice)}</span><button type="button" data-i="${i}" aria-label="Remove date"><i class="fa-solid fa-circle-xmark"></i></button></div>`;
    }).join('');
    container.querySelectorAll('button').forEach(btn =>
        btn.addEventListener('click', () => removeDate(Number(btn.dataset.i))));
}

function setRatingUI(val) {
    $('inpRating').value = val;
    $('starContainer').querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('on', Number(btn.dataset.v) <= val);
    });
}

function setFormatsUI(list) {
    selectedFormats = new Set(list || []);
    $('formatChips').querySelectorAll('.fmt').forEach(btn =>
        btn.classList.toggle('on', selectedFormats.has(btn.dataset.format)));
}

function updateCoverPreview() {
    const box = $('coverPreview');
    const temp = { title: $('inpTitle').value || 'Title', coverUrl: $('inpCover').value, isbn: $('inpIsbn').value };
    if (!coverUrlFor(temp)) { box.innerHTML = ''; return; }
    box.innerHTML = coverHtml(temp, 'cover-lg');
    wireCovers(box);
}

function pickSuggestion(inputId, selectId) {
    const select = $(selectId);
    const input = $(inputId);
    const val = select.value;
    if (!val) return;
    const current = input.value.split(',').map(s => s.trim()).filter(Boolean);
    if (!current.includes(val)) {
        current.push(val);
        input.value = current.join(', ');
    }
    select.value = '';
}

function showModal() {
    $('bookModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    $('bookModal').querySelector('.sheet').scrollTop = 0;
}

function openEditModal(id) {
    const b = books.find(x => x.id === id);
    if (!b) return;

    $('editId').value = b.id;
    $('modalTitle').textContent = 'Edit book';
    $('inpTitle').value = b.title;
    $('inpAuthor').value = b.author || '';
    $('inpSeries').value = b.series || '';
    $('inpSeriesPart').value = b.seriesPart || '';
    $('inpProgress').value = b.progress;
    $('inpCurrentPage').value = b.currentPage || '';
    $('inpPages').value = b.pages || '';
    $('inpCover').value = b.coverUrl || '';
    $('inpIsbn').value = b.isbn || '';
    $('inpLink').value = b.link || '';
    $('inpSummary').value = b.summary || '';
    $('inpNotes').value = b.notes || '';
    $('inpTags').value = b.tags.join(', ');
    $('newDate').value = '';

    setFormatsUI(b.formats);
    setRatingUI(b.rating || 0);
    tempDates = [...b.finishedDates].sort();
    renderDateList();
    toggleDateUI();
    updateCoverPreview();
    populateFilterDropdowns();

    $('btnSubmitModal').textContent = 'Save changes';
    $('btnDelete').classList.remove('hidden');
    showModal();
}

function openAddModal() {
    $('bookForm').reset();
    $('editId').value = '';
    $('modalTitle').textContent = 'Add a book';
    setFormatsUI(['physical']);
    setRatingUI(0);
    tempDates = [];
    renderDateList();
    toggleDateUI();
    updateCoverPreview();
    populateFilterDropdowns();

    $('btnSubmitModal').textContent = 'Add to library';
    $('btnDelete').classList.add('hidden');
    showModal();
}

function closeModal() {
    $('bookModal').classList.add('hidden');
    document.body.style.overflow = '';
}

function handleFormSubmit(e) {
    e.preventDefault();
    const id = $('editId').value;
    const existing = id ? books.find(x => x.id === id) : null;

    // a date typed but not yet added still counts when the status is Read
    const status = $('inpProgress').value;
    const pending = $('newDate').value;
    if (status === 'READ' && pending && tempDates.length === 0) tempDates.push(pending);

    const obj = normalizeBook({
        ...(existing || {}),
        id: id || generateId(),
        title: $('inpTitle').value.trim(),
        author: $('inpAuthor').value.trim(),
        series: $('inpSeries').value.trim(),
        seriesPart: $('inpSeriesPart').value,
        formats: Array.from(selectedFormats),
        progress: status,
        currentPage: $('inpCurrentPage').value,
        pages: $('inpPages').value,
        rating: $('inpRating').value,
        coverUrl: $('inpCover').value.trim(),
        isbn: $('inpIsbn').value.trim(),
        link: $('inpLink').value.trim(),
        summary: $('inpSummary').value,
        notes: $('inpNotes').value,
        tags: $('inpTags').value.split(',').map(t => t.trim()).filter(Boolean),
        finishedDates: [...tempDates].sort(),
        addedAt: existing ? existing.addedAt : Date.now()
    });

    if (existing) {
        books[books.findIndex(x => x.id === id)] = obj;
    } else {
        books.unshift(obj);
    }

    // a book you started, finished or dropped no longer waits in the queue
    if (obj.progress === 'READING' || obj.progress === 'READ' || obj.progress === 'DNF') {
        if (queueIds.includes(obj.id)) { queueIds = queueIds.filter(q => q !== obj.id); saveQueue(); }
    }

    saveBooks();
    closeModal();
    refreshActiveTab();
}

function deleteBook() {
    if (!confirm('Delete this book? This cannot be undone.')) return;
    const id = $('editId').value;
    books = books.filter(x => x.id !== id);
    queueIds = queueIds.filter(q => q !== id);
    discoveryIds = discoveryIds.filter(q => q !== id);
    saveBooks();
    saveQueue();
    closeModal();
    refreshActiveTab();
}

/* ---------- wiring (runs once when the page loads) ---------- */
function initModal() {
    $('bookForm').addEventListener('submit', handleFormSubmit);

    $('formatChips').querySelectorAll('.fmt').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.dataset.format;
            if (selectedFormats.has(f)) selectedFormats.delete(f); else selectedFormats.add(f);
            btn.classList.toggle('on', selectedFormats.has(f));
        });
    });

    $('starContainer').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const v = Number(btn.dataset.v);
            setRatingUI(Number($('inpRating').value) === v ? 0 : v);
        });
    });

    ['inpCover', 'inpIsbn', 'inpTitle'].forEach(i => $(i).addEventListener('input', updateCoverPreview));

    // tap the dark area outside the sheet to close it
    $('bookModal').addEventListener('click', e => { if (e.target === $('bookModal')) closeModal(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !$('bookModal').classList.contains('hidden')) closeModal();
    });
}
