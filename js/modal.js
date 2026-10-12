/* ===== main.js =====
   Startup code and tab switching. Loaded LAST. */

document.addEventListener('DOMContentLoaded', () => {
    // Hook up the buttons FIRST, so they keep working even if something below fails
    $('fileInput').addEventListener('change', handleFileUpload);
    initModal();

    const theme = localStorage.getItem(STORAGE.theme) || 'ink';
    document.documentElement.setAttribute('data-theme', theme);
    $('themeSelector').value = theme;

    books = readStore(STORAGE.data, []);
    queueIds = readStore(STORAGE.queue, []);
    const goal = parseInt(readStore(STORAGE.goal, 20), 10);
    readingGoal = goal > 0 ? goal : 20;

    try {
        ensureDataIntegrity();
        if (!Array.isArray(queueIds)) queueIds = [];
        queueIds = queueIds.map(String);
        renderLibrary();
    } catch (err) {
        console.error('Could not load saved library:', err);
    }
    showLastBackup();
});

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    $(`tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    $(`btn-${tab}`).classList.add('active');

    if (tab === 'library') renderLibrary();
    if (tab === 'upnext') { renderQueue(); if (discoveryIds.length === 0) shuffleDiscovery(); else renderDiscovery(); }
    if (tab === 'dashboard') updateStats();
    if (tab === 'report') updateReport();
    if (tab === 'settings') showLastBackup();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Redraws whichever tab is open (used after saving, deleting, etc.)
function refreshActiveTab() {
    const active = document.querySelector('.nav-btn.active');
    if (!active) return;
    const tab = active.id.replace('btn-', '');
    if (tab === 'library') renderLibrary();
    if (tab === 'upnext') { renderQueue(); renderDiscovery(); }
    if (tab === 'dashboard') updateStats();
    if (tab === 'report') updateReport();
}
