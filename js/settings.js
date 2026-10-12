/* ===== settings.js =====
   The Config tab: backup, restore, theme, wipe. */

function showLastBackup() {
    const t = storeGet(STORAGE.lastBackup);
    const el = $('lastBackup');
    if (!t) { el.textContent = 'Last backup: none yet.'; return; }
    const d = new Date(Number(t));
    el.textContent = 'Last backup: ' + d.toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
}

function makeBackupObject() {
    return { database_version: '1.0', app: 'booklib', books, queue: queueIds, goal: readingGoal };
}

function downloadJSON(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function exportData() {
    downloadJSON(makeBackupObject(), `booklib_backup_${todayISO()}.json`);
    storeSet(STORAGE.lastBackup, String(Date.now()));
    showLastBackup();
}

function handleFileUpload(e) {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
        input.value = ''; // so choosing the SAME file again still works

        let data, incoming;
        try {
            data = JSON.parse(ev.target.result);
            incoming = Array.isArray(data) ? data : (data.books || []);
        } catch (err) {
            alert('That file could not be read. Make sure it is a BookLib backup (.json).');
            return;
        }
        incoming = incoming.filter(b => b && typeof b === 'object').map(normalizeBook);

        if (incoming.length === 0) {
            alert('No books were found in that file.');
            return;
        }
        if (!confirm(`You currently have ${books.length} books. This backup has ${incoming.length}. Restoring replaces your library. A backup of your current data will be downloaded first. Continue?`)) return;

        if (books.length > 0) downloadJSON(makeBackupObject(), `booklib_before_restore_${todayISO()}.json`);

        books = incoming;
        const ids = new Set(books.map(b => b.id));
        queueIds = Array.isArray(data.queue) ? data.queue.map(String).filter(id => ids.has(id)) : [];
        if (data && Number(data.goal) > 0) { readingGoal = Number(data.goal); writeStore(STORAGE.goal, readingGoal); }
        discoveryIds = [];
        saveBooks();
        saveQueue();
        alert(`Restored ${books.length} books.`);
        switchTab('library');
    };
    reader.readAsText(file);
}

function clearData() {
    if (!confirm('Delete ALL books, your queue and your goal from this browser? This cannot be undone.')) return;
    if (!confirm('Really delete everything? Download a backup first if you are not sure.')) return;
    books = [];
    queueIds = [];
    discoveryIds = [];
    readingGoal = 20;
    [STORAGE.data, STORAGE.queue, STORAGE.goal].forEach(storeRemove);
    switchTab('library');
}

function changeTheme() {
    const theme = $('themeSelector').value;
    document.documentElement.setAttribute('data-theme', theme);
    storeSet(STORAGE.theme, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', cssVar('--bg'));
}
