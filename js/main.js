/* ===== main.js =====
   Startup code and tab switching. Loaded LAST. */

// Runs one startup step; if it fails, the real reason is shown on screen
function step(name, fn) {
    try { fn(); }
    catch (err) {
        console.error(name, err);
        showProblem('<b>Problem while ' + name + ':</b> ' + escapeHtml(err && err.message ? err.message : err) +
            '<br><small>' + escapeHtml(String(err && err.stack || '').split('\n').slice(0, 3).join(' | ')) + '</small>', true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Hook up the buttons FIRST, so they keep working even if something below fails
    step('connecting the file picker', () => $('fileInput').addEventListener('change', handleFileUpload));
    step('connecting the add sheet', initModal);

    step('loading the theme', () => {
        const theme = storeGet(STORAGE.theme) || 'ink';
        document.documentElement.setAttribute('data-theme', theme);
        $('themeSelector').value = theme;
    });

    step('reading your saved books', () => {
        books = readStore(STORAGE.data, []);
        queueIds = readStore(STORAGE.queue, []);
        const goal = parseInt(readStore(STORAGE.goal, 20), 10);
        readingGoal = goal > 0 ? goal : 20;
        ensureDataIntegrity();
        if (!Array.isArray(queueIds)) queueIds = [];
        queueIds = queueIds.map(String);
    });

    step('drawing the library', renderLibrary);
    step('checking backups', showLastBackup);

    try { localStorage.setItem('bookLibTest', '1'); localStorage.removeItem('bookLibTest'); }
    catch (err) {
        showProblem('<b>This browser is blocking storage,</b> so books cannot be saved here. Open the app in a normal browser tab (not a preview or private window).', true);
    }
});

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    $(`tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    $(`btn-${tab}`).classList.add('active');

    step('drawing the ' + tab + ' screen', () => {
        if (tab === 'library') renderLibrary();
        if (tab === 'upnext') { renderQueue(); if (discoveryIds.length === 0) shuffleDiscovery(); else renderDiscovery(); }
        if (tab === 'dashboard') updateStats();
        if (tab === 'report') updateReport();
        if (tab === 'settings') showLastBackup();
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Redraws whichever tab is open (used after saving, deleting, etc.)
function refreshActiveTab() {
    const active = document.querySelector('.nav-btn.active');
    if (!active) return;
    const tab = active.id.replace('btn-', '');
    step('redrawing the ' + tab + ' screen', () => {
        if (tab === 'library') renderLibrary();
        if (tab === 'upnext') { renderQueue(); renderDiscovery(); }
        if (tab === 'dashboard') updateStats();
        if (tab === 'report') updateReport();
    });
}
