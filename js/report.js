/* ===== report.js =====
   The Log tab: every finished read, grouped by month. */

function updateReport() {
    const container = $('reportContent');
    const all = [];
    books.forEach(b => {
        b.finishedDates.forEach(ds => {
            const d = parseDateLocal(ds);
            if (d) all.push({ book: b, date: d });
        });
    });

    if (!all.length) {
        container.innerHTML = `<div class="empty"><b>No finished reads yet</b>Mark a book as Read and add a finish date to see it here.</div>`;
        return;
    }
    all.sort((a, b) => b.date - a.date);

    const months = new Map();
    all.forEach(r => {
        const key = r.date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!months.has(key)) months.set(key, []);
        months.get(key).push(r);
    });

    container.innerHTML = '';
    months.forEach((reads, name) => {
        const block = document.createElement('div');
        block.className = 'log-month';
        block.innerHTML = `<div class="log-month-head">${escapeHtml(name)}<span>${reads.length} ${reads.length === 1 ? 'book' : 'books'}</span></div>`;
        reads.forEach(r => {
            const row = document.createElement('div');
            row.className = 'log-item';
            row.innerHTML = `
                ${coverHtml(r.book, 'cover-sm')}
                <div class="who">${escapeHtml(r.book.title)}${r.book.author ? `<em>${escapeHtml(r.book.author)}</em>` : ''}</div>
                ${starsHtml(r.book.rating)}
                <span class="day">${r.date.getDate()}</span>`;
            wireCovers(row);
            row.addEventListener('click', () => openEditModal(r.book.id));
            block.appendChild(row);
        });
        container.appendChild(block);
    });
}
