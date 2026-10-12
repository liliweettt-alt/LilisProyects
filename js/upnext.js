/* ===== upnext.js =====
   The Up next tab: your reading queue and "pick for me". */

function toggleQueue(id) {
    if (queueIds.includes(id)) queueIds = queueIds.filter(q => q !== id);
    else queueIds.push(id);
    saveQueue();
    refreshActiveTab();
}

function removeFromQueue(id) {
    queueIds = queueIds.filter(q => q !== id);
    saveQueue();
    refreshActiveTab();
}

function moveQueue(index, dir) {
    const to = index + dir;
    if (to < 0 || to >= queueIds.length) return;
    [queueIds[index], queueIds[to]] = [queueIds[to], queueIds[index]];
    saveQueue();
    renderQueue();
}

function startReading(id) {
    const b = books.find(x => x.id === id);
    if (!b) return;
    b.progress = 'READING';
    queueIds = queueIds.filter(q => q !== id);
    saveBooks();
    saveQueue();
    refreshActiveTab();
}

function renderQueue() {
    const container = $('queueList');
    // forget books that no longer exist
    queueIds = queueIds.filter(id => books.some(b => b.id === id));
    $('queueCount').textContent = queueIds.length
        ? `${queueIds.length} ${queueIds.length === 1 ? 'book' : 'books'} waiting`
        : '';

    if (queueIds.length === 0) {
        container.innerHTML = `<div class="empty"><b>Nothing queued</b>Tap the bookmark on a book in your library to line it up here.</div>`;
        return;
    }

    const shelf = document.createElement('div');
    shelf.className = 'shelf';
    queueIds.forEach((id, index) => {
        const b = books.find(x => x.id === id);
        if (!b) return;
        const sub = [b.pages ? `${b.pages} pages` : '', b.formats.map(f => FORMAT_INFO[f].label).join(' + ')].filter(Boolean).join(' · ');
        const item = document.createElement('div');
        item.className = 'q-item';
        item.innerHTML = `
            ${coverHtml(b, 'cover-sm')}
            <div class="q-info">
                <h3>${escapeHtml(b.title)}</h3>
                ${b.author ? `<p>${escapeHtml(b.author)}</p>` : ''}
                ${sub ? `<p class="q-sub">${escapeHtml(sub)}</p>` : ''}
            </div>
            <div class="q-actions">
                <div class="q-move">
                    <button aria-label="Move up" class="up"><i class="fa-solid fa-chevron-up"></i></button>
                    <button aria-label="Move down" class="down"><i class="fa-solid fa-chevron-down"></i></button>
                </div>
                <button class="tiny go start">Start reading</button>
                <button class="tiny rm">Remove</button>
            </div>`;
        wireCovers(item);
        item.querySelector('.q-info').addEventListener('click', () => openEditModal(id));
        item.querySelector('.up').addEventListener('click', () => moveQueue(index, -1));
        item.querySelector('.down').addEventListener('click', () => moveQueue(index, 1));
        item.querySelector('.start').addEventListener('click', () => startReading(id));
        item.querySelector('.rm').addEventListener('click', () => removeFromQueue(id));
        shelf.appendChild(item);
    });
    container.innerHTML = '';
    container.appendChild(shelf);
}

/* ---------- random picks ---------- */

function shuffleDiscovery() {
    const fmt = $('discFormat').value;
    const pool = books.filter(b => b.progress === 'TBR' && (fmt === 'all' || b.formats.includes(fmt)));
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    discoveryIds = arr.slice(0, 3).map(b => b.id);
    renderDiscovery(pool.length === 0);
}

function renderDiscovery(poolWasEmpty) {
    const container = $('discoveryList');
    const picks = discoveryIds.map(id => books.find(b => b.id === id)).filter(Boolean);

    if (picks.length === 0) {
        container.innerHTML = poolWasEmpty
            ? `<div class="empty"><b>Nothing to pick from</b>No unread books match that format.</div>` : '';
        return;
    }

    const shelf = document.createElement('div');
    shelf.className = 'shelf animate-in';
    picks.forEach(b => {
        const queued = queueIds.includes(b.id);
        const meta = [b.series ? `${b.series}${b.seriesPart ? ' #' + b.seriesPart : ''}` : '', b.pages ? `${b.pages} pages` : '', b.tags.slice(0, 3).join(', ')].filter(Boolean).join(' · ');
        const summary = (b.summary || '').trim();
        const item = document.createElement('div');
        item.className = 'pick';
        item.innerHTML = `
            <div class="book-row">
                ${coverHtml(b)}
                <div class="book-body">
                    <h3 class="book-title">${escapeHtml(b.title)}</h3>
                    ${b.author ? `<div class="book-author">${escapeHtml(b.author)}</div>` : ''}
                    ${meta ? `<div class="book-series">${escapeHtml(meta)}</div>` : ''}
                    ${summary ? `<p class="detail-text" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-top:4px">${escapeHtml(summary)}</p>` : ''}
                    <div class="pick-actions">
                        <button class="tiny go add">${queued ? 'In your queue' : 'Add to queue'}</button>
                        <button class="tiny det">Details</button>
                    </div>
                </div>
            </div>`;
        wireCovers(item);
        const addBtn = item.querySelector('.add');
        if (queued) addBtn.disabled = true;
        addBtn.addEventListener('click', () => {
            if (!queueIds.includes(b.id)) { queueIds.push(b.id); saveQueue(); }
            renderQueue();
            renderDiscovery();
        });
        item.querySelector('.det').addEventListener('click', () => openEditModal(b.id));
        shelf.appendChild(item);
    });
    container.innerHTML = '';
    container.appendChild(shelf);
}
