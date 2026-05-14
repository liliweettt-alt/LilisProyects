let fics = [];
let readingGoal = { type: 'words', amount: 0 };
let chartInstances = { fandoms: null, ships: null, tags: null, daily: null };
let tempDates = [];
let searchTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    const stored = localStorage.getItem('ficLibData');
    const storedGoal = localStorage.getItem('ficLibGoal');
    const storedWPM = localStorage.getItem('ficLibWPM');
    
    if(storedWPM) document.getElementById('inpWPM').value = storedWPM;

    if (stored) {
        try {
            fics = JSON.parse(stored);
            fics.forEach(f => {
              
                if(f.cover_status) { f.coverStatus = f.cover_status; delete f.cover_status; }
                if(f.reread_status) { f.rereadStatus = f.reread_status; delete f.reread_status; }
                if(f.date_finished) { f.dateFinished = f.date_finished; delete f.date_finished; }
                if(f.original_link) { f.originalLink = f.original_link; delete f.original_link; }
                
    
                if(typeof f.fandom === 'string') f.fandom = f.fandom.trim();
                
                if(!f.finishedDates) f.finishedDates = f.dateFinished ? [f.dateFinished] : [];
            });
        } catch(e) { console.error("Data load error", e); fics = []; }
        renderLibrary();
        updateReport();
    }
    
    if (storedGoal) { 
        try { 
            const parsed = JSON.parse(storedGoal); 
            if(parsed && typeof parsed === 'object') readingGoal = parsed;
        } catch(e) { console.error("Goal load error", e); } 
    }
    
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('ficForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('goalTitleYear').innerText = `${new Date().getFullYear()} Reading Goal`;
    document.getElementById('monthPicker').value = new Date().toISOString().slice(0, 7);

    switchStatsView('global');
});

function parseDateLocal(input) { 
    if(!input) return null; 
    if(typeof input === 'string' && input.includes('-') && input.length === 10) { 
        const [y,m,d] = input.split('-').map(Number); 
        return new Date(y, m-1, d); 
    } 
    return new Date(input); 
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-btn').forEach(el => { 
        el.classList.remove('active', 'text-indigo-400'); 
        el.classList.add('text-slate-500'); 
    });
    
    const activeBtn = document.getElementById(`btn-${tab}`);
    activeBtn.classList.remove('text-slate-500'); 
    activeBtn.classList.add('active', 'text-indigo-400');
    
    if(tab === 'dashboard') {
        switchStatsView(document.getElementById('btn-stats-global').classList.contains('tab-btn-active') ? 'global' : 'monthly'); 
    }
    if(tab === 'report') updateReport();
    
    if(tab === 'discovery' && document.getElementById('discoveryList').innerHTML === '') {
        renderDiscovery();
    }
    
    window.scrollTo(0,0);
}

function persistData() { 
    localStorage.setItem('ficLibData', JSON.stringify(fics)); 
}

function refreshActiveTab() {
    const activeBtn = document.querySelector('.nav-btn.active');
    if(!activeBtn) return;
    
    const activeTab = activeBtn.id.replace('btn-', '');
    if(activeTab === 'library') renderLibrary();
    if(activeTab === 'dashboard') switchStatsView(document.getElementById('btn-stats-global').classList.contains('tab-btn-active') ? 'global' : 'monthly');
    if(activeTab === 'report') updateReport();
}

function saveWPM() { 
    localStorage.setItem('ficLibWPM', document.getElementById('inpWPM').value); 
    if (document.querySelector('.nav-btn.active').id === 'btn-library') {
        renderLibrary(); 
    }
}

function switchStatsView(view) {
    document.getElementById('view-stats-global').classList.toggle('hidden', view !== 'global');
    document.getElementById('view-stats-monthly').classList.toggle('hidden', view !== 'monthly');
    
    const btnGlobal = document.getElementById('btn-stats-global');
    const btnMonthly = document.getElementById('btn-stats-monthly');
    
    if(view === 'global') {
        btnGlobal.classList.add('tab-btn-active'); btnGlobal.classList.remove('tab-btn-inactive');
        btnMonthly.classList.remove('tab-btn-active'); btnMonthly.classList.add('tab-btn-inactive');
        updateDashboard();
    } else {
        btnMonthly.classList.add('tab-btn-active'); btnMonthly.classList.remove('tab-btn-inactive');
        btnGlobal.classList.remove('tab-btn-active'); btnGlobal.classList.add('tab-btn-inactive');
        renderMonthlyStats();
    }
}

function populateFilterDropdowns() {
    const shipSet = new Set(), tagSet = new Set(), fandomSet = new Set();
    fics.forEach(f => { 
        if(f.fandom) fandomSet.add(f.fandom.trim());
        (f.ships || []).forEach(s => shipSet.add(s.trim())); 
        (f.tags || []).forEach(t => tagSet.add(t.trim())); 
    });
    
    const fill = (id, items, label) => {
        const select = document.getElementById(id);
        const currentVal = select.value;
        select.innerHTML = `<option value="all">${label}</option>`;
        items.sort((a,b) => a.localeCompare(b)).forEach(i => { 
            if(i) { 
                const opt = document.createElement('option'); 
                opt.value = i; 
                opt.innerText = i; 
                select.appendChild(opt); 
            }
        });
        if(items.includes(currentVal)) select.value = currentVal;
    };
    
    fill('filterFandom', Array.from(fandomSet), 'Fandom: All');
    fill('filterShips', Array.from(shipSet), 'Ship: All'); 
    fill('filterTags', Array.from(tagSet), 'Tag: All');
}

function populateHelperDropdowns() {
    const shipSet = new Set();
    const tagSet = new Set();
    
    fics.forEach(f => { 
        (f.ships || []).forEach(s => shipSet.add(s.trim())); 
        (f.tags || []).forEach(t => tagSet.add(t.trim())); 
    });
    
    const fillSelect = (id, items) => {
        const select = document.getElementById(id);
        if (!select) return;
        
        select.innerHTML = '<option value="">Select used</option>';
        items.sort((a,b) => a.localeCompare(b)).forEach(item => { 
            if(item) { 
                const opt = document.createElement('option'); 
                opt.value = item; 
                opt.innerText = item; 
                select.appendChild(opt); 
            }
        });
    };
    
    fillSelect('selShipsHelper', Array.from(shipSet));
    fillSelect('selTagsHelper', Array.from(tagSet));
}

function pickSuggestion(targetInputId, selectDropdownId) {
    const select = document.getElementById(selectDropdownId);
    const target = document.getElementById(targetInputId);
    const selectedValue = select.value;
    
    if (selectedValue) {
        let currentText = target.value.trim();
        if (currentText && !currentText.endsWith(',')) {
            currentText += ', ';
        }
        target.value = currentText + selectedValue;
    }
    select.value = ''; 
}

function handleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        renderLibrary();
    }, 200);
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterStatus').value = 'all';
    document.getElementById('filterCompletion').value = 'all';
    document.getElementById('filterCover').value = 'all';
    document.getElementById('filterFandom').value = 'all';
    document.getElementById('filterShips').value = 'all';
    document.getElementById('filterTags').value = 'all';
    document.getElementById('filterChapters').value = 'all';
    renderLibrary();
}

function renderLibrary() {
    populateFilterDropdowns();
    const list = document.getElementById('ficList');
    const emptyState = document.getElementById('emptyState');
    
    list.innerHTML = '';
    const search = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const completionFilter = document.getElementById('filterCompletion').value;
    const coverFilter = document.getElementById('filterCover').value;
    const fandomFilter = document.getElementById('filterFandom').value;
    const shipFilter = document.getElementById('filterShips').value;
    const tagFilter = document.getElementById('filterTags').value;
    const chapterFilter = document.getElementById('filterChapters').value;
    const sortMode = document.getElementById('sortOption').value;

    try {
        let filtered = fics.filter(f => {
            if (statusFilter !== 'all' && (f.rereadStatus || 'unread').toLowerCase() !== statusFilter) return false;
            if (completionFilter !== 'all' && (f.status || 'wip').toLowerCase() !== completionFilter) return false;
            if (coverFilter !== 'all') { const hasCover = (f.coverStatus === 'yes'); if (coverFilter === 'yes' && !hasCover) return false; if (coverFilter === 'not' && hasCover) return false; }
            if (fandomFilter !== 'all' && (!f.fandom || f.fandom.trim() !== fandomFilter)) return false;
            if (shipFilter !== 'all' && (!f.ships || !f.ships.includes(shipFilter))) return false;
            if (tagFilter !== 'all' && (!f.tags || !f.tags.includes(tagFilter))) return false;
            const chaps = f.chapters || 0;
            if (chapterFilter === 'short' && chaps >= 10) return false; if (chapterFilter === 'medium' && (chaps < 10 || chaps > 50)) return false; if (chapterFilter === 'long' && chaps <= 50) return false;
            if (search) { const txt = `${f.title} ${f.series || ''} ${f.fandom} ${f.author} ${(f.ships||[]).join(' ')} ${(f.tags||[]).join(' ')}`.toLowerCase(); return txt.includes(search); }
            return true;
        });

        const groups = {};
        const displayList = [];
        filtered.forEach(f => { 
            if(f.series && f.series.trim() !== "") { 
                const sName = f.series.trim(); 
                if(!groups[sName]) groups[sName] = []; 
                groups[sName].push(f); 
            } else { 
                displayList.push({ type: 'fic', data: f }); 
            } 
        });
        
        Object.keys(groups).forEach(seriesName => {
            const seriesFics = groups[seriesName];
            seriesFics.sort((a,b) => (a.seriesPart || 0) - (b.seriesPart || 0));
            const dates = seriesFics.map(f => {
                const lastDate = f.finishedDates && f.finishedDates.length ? f.finishedDates[f.finishedDates.length-1] : null; 
                const d = parseDateLocal(lastDate); return d ? d.getTime() : 0; 
            });
            displayList.push({ 
                type: 'series', title: seriesName, fandom: seriesFics[0].fandom, 
                author: seriesFics[0].author, totalWords: seriesFics.reduce((sum, f) => sum + (f.wordcount||0), 0), 
                items: seriesFics, latestTimestamp: Math.max(...dates) 
            });
        });

        displayList.sort((a, b) => {
            const getTs = (item) => { 
                if(item.type === 'series') return item.latestTimestamp || 0;
                const lastDate = item.data.finishedDates && item.data.finishedDates.length ? item.data.finishedDates[item.data.finishedDates.length-1] : null;
                const d = parseDateLocal(lastDate); return d ? d.getTime() : 0; 
            };
            const getWords = (item) => item.type === 'series' ? item.totalWords : (item.data.wordcount||0);
            const getTitle = (item) => item.type === 'series' ? item.title : item.data.title;
            if (sortMode === 'az') return getTitle(a).localeCompare(getTitle(b)); 
            if (sortMode === 'words') return getWords(b) - getWords(a); 
            return getTs(b) - getTs(a); 
        });

        if(displayList.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            displayList.forEach(item => { 
                if (item.type === 'fic') renderFicCard(item.data, list); 
                else renderSeriesCard(item, list); 
            });
        }
    } catch(err) { 
        console.error(err); 
        list.innerHTML = `<div class="text-red-400 text-center py-5">Error rendering list. Check console.</div>`; 
    }
}

function calculateTime(words) { 
    if(!words) return ""; 
    const wpm = parseInt(localStorage.getItem('ficLibWPM')) || 250; 
    const min = Math.ceil(words / wpm); 
    const h = Math.floor(min / 60); 
    const m = min % 60; 
    return h > 0 ? `${h}h ${m}m` : `${m}min`; 
}

function renderFicCard(f, container) {
    const isRead = f.rereadStatus === 'read';
    const isReading = f.rereadStatus === 'reading';
    const isComplete = (f.status || 'wip').toLowerCase() === 'complete';
    
    const statusBadge = isComplete ? '<span class="badge bg-emerald-900/30 text-emerald-400 border border-emerald-500/30">Complete</span>' : '<span class="badge bg-amber-900/30 text-amber-400 border border-amber-500/30">WIP</span>';
    const coverBadge = f.coverStatus === 'yes' ? '<span class="badge bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"><i class="fa-solid fa-image mr-1"></i> Cover</span>' : '';
    
    let readBadge = '';
    if (isRead) readBadge = '<span class="text-emerald-400 text-xs flex items-center gap-1"><i class="fa-solid fa-check"></i> Read</span>';
    if (isReading) readBadge = '<span class="text-blue-400 text-xs flex items-center gap-1"><i class="fa-solid fa-book-open-reader"></i> Reading</span>';

    const seriesHtml = (f.series && f.series.trim() !== "") ? `<div class="text-[10px] text-indigo-300 font-bold mb-0.5 tracking-wide"><i class="fa-solid fa-layer-group mr-1"></i>Part ${f.seriesPart}</div>` : '';
    const cwHtml = (f.cws || []).map(c => `<span class="cw-chip" title="Content Warning">${c}</span>`).join('');
    const shipHtml = (f.ships || []).length > 0 ? `<span class="text-indigo-400 text-xs font-bold mr-2"><i class="fa-solid fa-heart mr-1"></i>${f.ships[0]}</span>` : '';
    const readTime = calculateTime(f.wordcount);
    
    const hasSummary = f.summary && f.summary.trim() !== "";
    const hasNotes = f.notes && f.notes.trim() !== "";
    const hasTags = (f.tags || []).length > 0;
    const toggleId = `toggle-${f.id}`;
    const showToggle = hasSummary || hasNotes || hasTags;
    const toggleBtn = showToggle ? `<button type="button" onclick="event.stopPropagation(); document.getElementById('${toggleId}').classList.toggle('hidden')" class="text-slate-500 hover:text-white transition-colors p-1"><i class="fa-solid fa-chevron-down"></i></button>` : '';

    const tagsBlock = hasTags ? `<div class="flex flex-wrap gap-2 mb-3 pt-2">${(f.tags||[]).map(t=>`<span class="tag-chip">${t}</span>`).join('')}</div>` : '';
    const summaryBlock = hasSummary ? `<div class="text-sm text-slate-300 italic leading-relaxed mb-3">${f.summary}</div>` : '';
    const notesBlock = hasNotes ? `<div class="bg-indigo-900/20 border border-indigo-500/30 p-3 rounded-lg text-xs text-indigo-200"><strong class="block text-indigo-400 mb-1 uppercase tracking-wide">My Notes</strong>${f.notes}</div>` : '';

    const wordsDisplay = f.wordcount ? `${f.wordcount.toLocaleString()}w` : '—';

    const item = document.createElement('div');
    item.className = 'fic-card p-4 rounded-xl relative group mb-3';
  
    item.onclick = (e) => { 
        if(!e.target.closest('button')) openEditModal(f.id); 
    };
    
    item.innerHTML = `
        <div class="flex justify-between">
            <div class="flex-1 min-w-0 pr-3">
                <div class="flex items-start justify-between"><span class="badge bg-slate-700 text-slate-300 border border-slate-600 mr-2 mb-1">${f.fandom || 'No Fandom'}</span></div>
                ${seriesHtml}
                <h3 class="font-bold text-lg text-white truncate leading-tight mt-0.5 mb-0.5">${f.title}</h3>
                <p class="text-xs text-slate-400 mb-2 truncate">${f.author || 'Unknown'}</p>
                <div class="flex flex-wrap items-center gap-2 mb-1">${statusBadge} ${coverBadge} ${readBadge}</div>
                <div class="mt-2 flex flex-wrap gap-y-1">${cwHtml} ${shipHtml}</div>
            </div>
            <div class="flex flex-col items-end justify-between pl-2 min-w-[75px] border-l border-slate-700/50 my-1">
                <div class="flex flex-col items-end gap-2">${f.originalLink ? `<button type="button" onclick="event.stopPropagation(); window.open('${f.originalLink}', '_blank')" class="text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 p-1.5 rounded-lg"><i class="fa-solid fa-up-right-from-square text-xs"></i></button>` : ''} ${toggleBtn}</div>
                <div class="text-[10px] text-slate-500 text-right font-mono mt-auto"><span class="block text-white font-bold">${readTime}</span><span class="block">${wordsDisplay}</span>${f.chapters ? `<span class="block">${f.chapters} ch</span>` : ''}</div>
            </div>
        </div>
        <div id="${toggleId}" class="hidden mt-2 border-t border-slate-700/50 animate-fade-in">${tagsBlock}${summaryBlock}${notesBlock}</div>`;
    container.appendChild(item);
}

function renderSeriesCard(series, container) {
    const div = document.createElement('div'); div.className = 'series-folder rounded-xl mb-3 cursor-pointer overflow-hidden';
    div.onclick = function(e) { 
        if(e.target.closest('.fic-card')) return; 
        const content = this.querySelector('.series-content'); 
        const icon = this.querySelector('.chevron-icon'); 
        content.classList.toggle('hidden'); 
        icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)'; 
    };
    div.innerHTML = `<div class="p-4 flex justify-between items-center bg-slate-800/80 backdrop-blur-sm z-10 relative"><div class="flex-1"><div class="flex items-center gap-2 mb-1"><span class="badge bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Series</span><span class="text-[10px] text-slate-400 uppercase font-bold">${series.fandom}</span></div><h3 class="font-bold text-lg text-white leading-tight">${series.title}</h3><p class="text-xs text-slate-400 mt-1">${series.items.length} Works • ${series.totalWords.toLocaleString()} words</p></div><div class="pl-4 text-slate-500"><i class="fa-solid fa-chevron-down chevron-icon transition-transform duration-300"></i></div></div><div class="series-content hidden bg-slate-900/50 p-3 space-y-2 border-t border-slate-700/50 animate-fade-in"></div>`;
    const contentBox = div.querySelector('.series-content'); 
    series.items.forEach(f => renderFicCard(f, contentBox)); 
    container.appendChild(div);
}

function renderDiscovery() {
    const container = document.getElementById('discoveryList');
    const unread = fics.filter(f => {
        const s = f.rereadStatus || 'unread';
        return s !== 'read' && s !== 'reading';
    });
    if (unread.length === 0) { 
        container.innerHTML = '<div class="text-center text-slate-500 py-10">All fics read!</div>'; 
        return; 
    }
    container.innerHTML = '';
    const shuffled = [...unread].sort(() => 0.5 - Math.random()).slice(0, 5);
    shuffled.forEach(f => {
        const wordsDisplay = f.wordcount ? `${f.wordcount.toLocaleString()} words` : '—';
        const card = document.createElement('div'); card.className = 'fic-card p-5 rounded-xl border border-indigo-500/20 shadow-lg';
        const cwHtml = (f.cws || []).map(c => `<span class="cw-chip">${c}</span>`).join('');
        
        card.innerHTML = `<div class="flex justify-between items-start mb-2"><div><span class="badge bg-slate-700 text-slate-300 border border-slate-600 mb-1">${f.fandom}</span><h3 class="text-xl font-bold text-white leading-tight mt-1">${f.title}</h3><p class="text-sm text-slate-400">by ${f.author}</p></div></div><div class="flex flex-wrap gap-2 mb-3">${cwHtml} ${(f.ships||[]).map(s=>`<span class="text-indigo-300 text-xs font-bold mr-2">${s}</span>`).join('')}${(f.tags||[]).slice(0,5).map(t=>`<span class="tag-chip">${t}</span>`).join('')}</div><div class="bg-slate-900/50 p-3 rounded-lg text-sm text-slate-300 italic mb-3 border-l-2 border-slate-600">${f.summary || 'No summary.'}</div><div class="flex justify-between items-center pt-2 border-t border-slate-700/50"><span class="text-xs text-slate-500 font-mono">${wordsDisplay} • ${calculateTime(f.wordcount)}</span><button type="button" class="text-xs text-slate-500 hover:text-white discovery-detail-btn">Details</button></div>`;
        
       
        card.querySelector('.discovery-detail-btn').onclick = () => openEditModal(f.id);
        
        container.appendChild(card);
    });
}

function updateDashboard() {
    const readFics = fics.filter(f => f.rereadStatus === 'read');
    const readingFics = fics.filter(f => f.rereadStatus === 'reading');
    
    let totalReadWords = 0;
    readFics.forEach(f => {
        const readCount = (f.finishedDates && f.finishedDates.length > 0) ? f.finishedDates.length : 1; 
        totalReadWords += (f.wordcount || 0) * readCount;
    });
    readingFics.forEach(f => {
        totalReadWords += (f.readProgress || 0);
    });

    document.getElementById('stat-total').innerText = fics.length; 
    document.getElementById('stat-words').innerText = totalReadWords.toLocaleString();
    document.getElementById('stat-active').innerText = readingFics.length;
    
    document.getElementById('stat-read-count').innerText = `Read: ${readFics.length}`;
    document.getElementById('stat-unread-count').innerText = `Unread: ${fics.length - readFics.length}`;
    const pct = fics.length ? Math.round((readFics.length / fics.length) * 100) : 0;
    const bar = document.getElementById('stat-progress-bar'); 
    bar.style.width = `${pct}%`; bar.innerText = `${pct}%`;

    renderPieChart('chartFandoms', readFics, f => f.fandom, 'fandoms');
    renderPieChart('chartShips', readFics, f => f.ships, 'ships');
    renderPieChart('chartTags', readFics, f => f.tags, 'tags'); 
    updateGoalUI();
}

function renderMonthlyStats() {
    const pickerVal = document.getElementById('monthPicker').value;
    if(!pickerVal) return;
    const [year, month] = pickerVal.split('-').map(Number);
    const now = new Date();
    const isCurrentMonth = (year === now.getFullYear() && month === (now.getMonth() + 1));
    
    const monthFics = [];
    let wordsInMonth = 0;
    
    fics.forEach(f => {
        if(f.rereadStatus === 'read' && f.finishedDates) {
            f.finishedDates.forEach(dateStr => {
                const d = parseDateLocal(dateStr);
                if(d && d.getFullYear() === year && (d.getMonth() + 1) === month) {
                    monthFics.push(f);
                    wordsInMonth += (f.wordcount || 0);
                }
            });
        }
    });

    if(isCurrentMonth) {
        fics.filter(f => f.rereadStatus === 'reading').forEach(f => {
            wordsInMonth += (f.readProgress || 0);
        });
    }

    document.getElementById('month-words').innerText = wordsInMonth.toLocaleString();
    document.getElementById('month-count').innerText = monthFics.length;

    const daysInMonth = new Date(year, month, 0).getDate();
    const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
    const data = new Array(daysInMonth).fill(0);
    
    fics.forEach(f => {
        if(!f.finishedDates) return;
        f.finishedDates.forEach(dateStr => {
            const d = parseDateLocal(dateStr);
            if(d && d.getFullYear() === year && (d.getMonth() + 1) === month) {
                data[d.getDate() - 1] += (f.wordcount || 0);
            }
        });
    });

    const ctx = document.getElementById('chartDaily').getContext('2d');
    if(chartInstances.daily) chartInstances.daily.destroy();
    
    chartInstances.daily = new Chart(ctx, { 
        type: 'bar', 
        data: { labels: labels, datasets: [{ label: 'Words', data: data, backgroundColor: '#818cf8', borderRadius: 3 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9 } } }, y: { border: { display: false }, grid: { color: '#334155' }, ticks: { color: '#64748b', font: { size: 9 } } } } } 
    });

    const renderList = (id, keyFn) => {
        const counts = {};
        monthFics.forEach(f => { const keys = keyFn(f); (Array.isArray(keys)?keys:[keys]).forEach(k => { if(k) counts[k] = (counts[k] || 0) + 1; }); });
        const top = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 3);
        document.getElementById(id).innerHTML = top.map(([k,v]) => `<div class="flex justify-between text-xs py-1 border-b border-slate-700/50 last:border-0"><span class="text-slate-300 truncate w-2/3">${k}</span><span class="text-indigo-400 font-bold">${v}</span></div>`).join('') || '<p class="text-xs text-slate-500 italic">No data</p>';
    };
    renderList('month-top-fandoms', f => f.fandom);
    renderList('month-top-ships', f => f.ships);
    renderList('month-top-tags', f => f.tags);
}

function renderPieChart(canvasId, list, keyFn, instanceName) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Safely destroy existing charts to prevent memory leaks
    if (chartInstances[instanceName]) {
        chartInstances[instanceName].destroy();
    }

    const counts = {};
    list.forEach(f => { 
        const keys = keyFn(f); 
        if (Array.isArray(keys)) keys.forEach(k => counts[k] = (counts[k] || 0) + 1); 
        else if (keys) counts[keys] = (counts[keys] || 0) + 1; 
    });
    
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) {
        chartInstances[instanceName] = new Chart(ctx, { 
            type: 'doughnut', 
            data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#334155'], borderColor: '#1e293b', borderWidth: 2 }] }, 
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } } 
        });
        return;
    }

    const labels = sorted.map(x => x[0]); 
    const data = sorted.map(x => x[1]);
    const colors = ['#818cf8', '#a78bfa', '#c084fc', '#6366f1', '#94a3b8'];
    
    chartInstances[instanceName] = new Chart(ctx, { 
        type: 'doughnut', 
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderColor: '#1e293b', borderWidth: 2 }] }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 10, family: 'Inter' }, boxWidth: 10 } } } } 
    });
}

function toggleGoalEdit() { 
    try {
        const editor = document.getElementById('goalEditor'); 
        if (!editor) return;
        
        const isHidden = editor.classList.contains('hidden');
        
        if (isHidden) {
            editor.classList.remove('hidden'); 
            document.getElementById('goalType').value = (readingGoal && readingGoal.type) ? readingGoal.type : 'words'; 
            document.getElementById('goalNumber').value = (readingGoal && readingGoal.amount > 0) ? readingGoal.amount : ''; 
        } else {
            editor.classList.add('hidden');
        }
    } catch (e) { console.error("Error opening edit goal:", e); }
}

function saveGoal() { 
    try {
        const type = document.getElementById('goalType').value || 'words'; 
        const amount = parseInt(document.getElementById('goalNumber').value); 
        
        if(amount > 0) { 
            readingGoal = { type: type, amount: amount }; 
            localStorage.setItem('ficLibGoal', JSON.stringify(readingGoal)); 
            toggleGoalEdit(); 
            updateGoalUI(); 
        } else { 
            alert("Please enter a valid number greater than 0."); 
        } 
    } catch (e) { console.error("Error saving goal:", e); }
}

function updateGoalUI() {
    const currentYear = new Date().getFullYear();
    let finishedThisYearCount = 0;
    let finishedThisYearWords = 0;

    fics.forEach(f => {
        if(f.rereadStatus === 'read' && f.finishedDates) {
            f.finishedDates.forEach(dateStr => {
                const d = parseDateLocal(dateStr);
                if(d && d.getFullYear() === currentYear) {
                    finishedThisYearCount++;
                    finishedThisYearWords += (f.wordcount || 0);
                }
            });
        }
    });

    fics.filter(f => f.rereadStatus === 'reading').forEach(f => {
        finishedThisYearWords += (f.readProgress || 0);
    });

    const safeType = (readingGoal && readingGoal.type) ? readingGoal.type : 'words';
    const target = (readingGoal && readingGoal.amount > 0) ? readingGoal.amount : 1; 
    
    let currentVal = (safeType === 'words') ? finishedThisYearWords : finishedThisYearCount;
    let pct = Math.round((currentVal / target) * 100); if(pct > 100) pct = 100;
    
    document.getElementById('goalTextCurrent').innerText = currentVal.toLocaleString();
    document.getElementById('goalTextTarget').innerText = `/ ${target.toLocaleString()} ${safeType}`;
    document.getElementById('goalProgressBar').style.width = `${pct}%`; document.getElementById('goalProgressBar').innerText = `${pct}%`;
    
    const msg = document.getElementById('goalMessage');
    if(currentVal >= target && target > 1) { 
        msg.innerText = "Goal Reached! Amazing!"; 
        msg.className = "text-center text-[10px] text-emerald-400 mt-2 font-bold"; 
    } else { 
        msg.innerText = `Tracking ${safeType} for ${currentYear}`; 
        msg.className = "text-center text-[10px] text-slate-500 mt-2 italic"; 
    }
}

function updateReport() {
    const container = document.getElementById('reportContent');
    const picker = document.getElementById('historyYearPicker');
    const statsHeader = document.getElementById('history-stats-header');

    const allReads = [];
    fics.forEach(f => {
        if(f.rereadStatus === 'read' && f.finishedDates) {
            f.finishedDates.forEach(dateStr => {
                const d = parseDateLocal(dateStr);
                if(d) allReads.push({ ...f, dateObj: d });
            });
        }
    });

    if (allReads.length === 0) { 
        container.innerHTML = '<div class="text-center text-slate-600 py-10">No finished dates logged</div>';
        picker.style.display = 'none'; statsHeader.style.display = 'none'; return;
    }

    const years = [...new Set(allReads.map(r => r.dateObj.getFullYear()))].sort((a,b) => b-a);
    
   
    const currentSelected = picker.value;
    picker.innerHTML = '';
    years.forEach(y => { 
        const opt = document.createElement('option'); 
        opt.value = y; 
        opt.innerText = y; 
        picker.appendChild(opt); 
    });

    if(years.includes(parseInt(currentSelected))) {
        picker.value = currentSelected;
    } else if (years.length > 0) {
        picker.value = years[0];
    }
    
    picker.style.display = 'block'; statsHeader.style.display = 'flex';

    const selectedYear = parseInt(picker.value);
    const yearReads = allReads.filter(r => r.dateObj.getFullYear() === selectedYear);

    const yearWords = yearReads.reduce((s,f) => s + (f.wordcount || 0), 0);
    document.getElementById('hist-year-words').innerText = yearWords.toLocaleString();
    document.getElementById('hist-year-count').innerText = yearReads.length;

    const groups = {};
    yearReads.forEach(f => { const m = f.dateObj.getMonth(); if(!groups[m]) groups[m]=[]; groups[m].push(f); });
    
    container.innerHTML = '';
    Object.keys(groups).sort((a,b)=>b-a).forEach(m => {
        const monthName = new Date(selectedYear, m).toLocaleString('default', { month: 'long' });
        const mDiv = document.createElement('div'); 
        mDiv.className = 'bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-4';
        mDiv.innerHTML = `<div class="bg-slate-700/50 px-5 py-3 font-bold flex justify-between"><span class="text-indigo-300 font-heading">${monthName}</span><span class="badge bg-slate-600 text-white">${groups[m].length}</span></div><div class="p-3 space-y-2"></div>`;
        const contentBox = mDiv.querySelector('div:last-child');
        
        groups[m].sort((a,b)=>b.dateObj-a.dateObj).forEach(f => {
            contentBox.innerHTML += `<div class="flex justify-between items-center text-sm py-2 px-2 hover:bg-slate-700/30 rounded-lg"><span class="truncate w-3/4 font-medium text-slate-300">${f.title}</span><span class="text-slate-500 text-xs font-mono">${f.dateObj.getDate()}</span></div>`;
        });
        container.appendChild(mDiv);
    });
}

function renderDateList() {
    const container = document.getElementById('dateListContainer');
    container.innerHTML = '';
    tempDates.sort().reverse().forEach((d, index) => {
        const chip = document.createElement('div');
        chip.className = "flex justify-between items-center bg-slate-900/50 px-3 py-1.5 rounded-lg text-xs border border-slate-700";
        chip.innerHTML = `<span class="font-mono text-indigo-300">${d}</span><button type="button" onclick="removeDate(${index})" class="text-slate-500 hover:text-red-400"><i class="fa-solid fa-xmark"></i></button>`;
        container.appendChild(chip);
    });
}

function addFinishDate() {
    const input = document.getElementById('inpNewDate');
    if(input.value) {
        tempDates.push(input.value);
        tempDates.sort();
        renderDateList();
        input.value = '';
    }
}

function removeDate(index) {
    tempDates.splice(index, 1);
    renderDateList();
}

function toggleDateVisibility() { 
    const s = document.getElementById('inpReadStatus').value; 
    document.getElementById('divDateFinished').classList.toggle('hidden', s !== 'read');
    document.getElementById('divReadProgress').classList.toggle('hidden', s !== 'reading');
}

function openEditModal(id) {
    const f = fics.find(x => x.id === id); 
    if(!f) return;
    
    document.getElementById('editId').value = f.id; 
    document.getElementById('modalTitle').innerText = 'Edit Fic';
    
    document.getElementById('inpTitle').value = f.title || '';
    document.getElementById('inpAuthor').value = f.author || '';
    document.getElementById('inpFandom').value = f.fandom || '';
    document.getElementById('inpStatus').value = f.status || 'wip';
    document.getElementById('inpSummary').value = f.summary || '';
    document.getElementById('inpNotes').value = f.notes || '';
    
    document.getElementById('inpLink').value = f.originalLink || '';
    document.getElementById('inpWords').value = f.wordcount || '';
    document.getElementById('inpChapters').value = f.chapters || '';
    document.getElementById('inpReadStatus').value = f.rereadStatus || 'unread'; 
    document.getElementById('inpCoverStatus').value = f.coverStatus || 'not';
    document.getElementById('inpSeries').value = f.series || ''; 
    document.getElementById('inpSeriesPart').value = f.seriesPart || '';
    document.getElementById('inpShips').value = (f.ships || []).join(', '); 
    document.getElementById('inpTags').value = (f.tags || []).join(', ');
    document.getElementById('inpCW').value = (f.cws || []).join(', ');
    
    document.getElementById('inpReadProgress').value = f.readProgress || '';

    tempDates = f.finishedDates ? [...f.finishedDates] : [];
    renderDateList();

    populateHelperDropdowns();

    document.getElementById('btnDelete').classList.remove('hidden'); 
    toggleDateVisibility(); 
    document.getElementById('ficModal').classList.remove('hidden');
}

function openAddModal() { 
    document.getElementById('ficForm').reset(); 
    document.getElementById('editId').value = ''; 
    document.getElementById('modalTitle').innerText = 'Add New Fic'; 
    document.getElementById('btnDelete').classList.add('hidden'); 
    
    tempDates = [];
    renderDateList();
    
    toggleDateVisibility(); 
    populateHelperDropdowns();

    document.getElementById('ficModal').classList.remove('hidden'); 
}

function closeModal() { document.getElementById('ficModal').classList.add('hidden'); }

function deleteFic() { 
    if(confirm("Delete this fic?")) { 
        fics = fics.filter(f => f.id !== document.getElementById('editId').value); 
        persistData(); 
        closeModal();
        refreshActiveTab();
    } 
}

function handleFormSubmit(e) {
    e.preventDefault(); 
    const id = document.getElementById('editId').value;
    const sortedDates = [...tempDates].sort();
    const latestDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;

    const obj = {
        id: id || crypto.randomUUID(), 
        title: document.getElementById('inpTitle').value, 
        author: document.getElementById('inpAuthor').value, 
        fandom: document.getElementById('inpFandom').value.trim(),
        originalLink: document.getElementById('inpLink').value, 
        rereadStatus: document.getElementById('inpReadStatus').value, 
        coverStatus: document.getElementById('inpCoverStatus').value,
        status: document.getElementById('inpStatus').value, 
        wordcount: parseInt(document.getElementById('inpWords').value) || 0, 
        chapters: parseInt(document.getElementById('inpChapters').value) || 0,
        summary: document.getElementById('inpSummary').value, 
        notes: document.getElementById('inpNotes').value,
        ships: document.getElementById('inpShips').value.split(',').map(s=>s.trim()).filter(s=>s), 
        tags: document.getElementById('inpTags').value.split(',').map(s=>s.trim()).filter(s=>s),
        cws: document.getElementById('inpCW').value.split(',').map(s=>s.trim()).filter(s=>s),
        readProgress: parseInt(document.getElementById('inpReadProgress').value) || 0,
        finishedDates: [...tempDates],
        dateFinished: latestDate,
        series: document.getElementById('inpSeries').value.trim(), 
        seriesPart: parseInt(document.getElementById('inpSeriesPart').value) || 0
    };
    
    if(id) { 
        const idx = fics.findIndex(x => x.id === id); 
        fics[idx] = {...fics[idx], ...obj}; 
    } else {
        fics.unshift(obj);
    }
    
    persistData(); 
    closeModal();
    refreshActiveTab();
}

function handleFileUpload(e) { 
    const f = e.target.files[0]; 
    if(!f) return; 
    const r = new FileReader(); 
    r.onload = (ev) => { 
        try { 
            const j = JSON.parse(ev.target.result); 
            fics = Array.isArray(j) ? j : (j.fics || []); 
            persistData(); 
            alert(`Loaded ${fics.length} fics.`); 
            switchTab('library'); 
        } catch(err) {
            alert("Invalid backup.");
        } 
    }; 
    r.readAsText(f); 
}

function exportData() { 
    const a = document.createElement('a'); 
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({database_version:"1.0", fics:fics}, null, 2)); 
    a.download = "ficlib_backup.json"; 
    document.body.appendChild(a); 
    a.click(); 
    a.remove(); 
}

function clearData() { 
    if(confirm("Delete ALL data?")) { 
        fics = []; 
        persistData(); 
        switchTab('library'); 
    } 
}
