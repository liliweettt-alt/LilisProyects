/* ===== stats.js =====
   The Stats tab: numbers, yearly goal and charts. */

function updateStats() {
    const year = new Date().getFullYear();

    $('stat-total').textContent = books.length;
    $('stat-physical').textContent = books.filter(b => b.formats.includes('physical')).length;
    $('stat-digital').textContent = books.filter(b => b.formats.includes('ebook') || b.formats.includes('audiobook')).length;
    $('stat-reading').textContent = books.filter(b => b.progress === 'READING').length;
    $('stat-finished').textContent = books.filter(b => b.progress === 'READ').length;

    // ratings
    const rated = books.filter(b => b.rating > 0);
    $('stat-avg').textContent = rated.length
        ? (rated.reduce((sum, b) => sum + b.rating, 0) / rated.length).toFixed(1) : '–';

    const top = rated.slice().sort((a, b) => b.rating - a.rating).slice(0, 3);
    $('topRatedList').innerHTML = top.length
        ? top.map(b => `<li>${coverHtml(b, 'cover-sm')}<span>${escapeHtml(b.title)}${b.author ? `<em>${escapeHtml(b.author)}</em>` : ''}</span>${starsHtml(b.rating)}</li>`).join('')
        : '<li class="note">Rate a book and it shows up here.</li>';
    wireCovers($('topRatedList'));

    // finish dates: this year, per month, pages, streak
    const finishedMonths = new Set();
    const monthly = new Array(12).fill(0);
    let finishedThisYear = 0;
    let pagesThisYear = 0;

    books.forEach(b => {
        b.finishedDates.forEach(ds => {
            const d = parseDateLocal(ds);
            if (!d) return;
            finishedMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
            if (d.getFullYear() === year) {
                finishedThisYear++;
                monthly[d.getMonth()]++;
                pagesThisYear += b.pages;
            }
        });
    });
    $('stat-pages').textContent = pagesThisYear.toLocaleString();

    // streak: consecutive months with at least one finished book
    let streak = 0;
    const now = new Date();
    let y = now.getFullYear(), m = now.getMonth();
    if (!finishedMonths.has(`${y}-${m}`)) { m--; if (m < 0) { m = 11; y--; } }
    while (finishedMonths.has(`${y}-${m}`)) {
        streak++;
        m--; if (m < 0) { m = 11; y--; }
    }
    $('stat-streak').textContent = streak;

    // goal
    $('goalYear').textContent = year;
    $('goalCount').textContent = finishedThisYear;
    $('goalTotal').textContent = readingGoal;
    $('goalBar').style.width = Math.min((finishedThisYear / readingGoal) * 100, 100) + '%';

    drawCharts(monthly);
}

function drawCharts(monthly) {
    if (typeof Chart === 'undefined') return; // charts library did not load (offline?)

    const text = cssVar('--muted');
    const grid = cssVar('--line');
    const accent = cssVar('--accent');

    Object.keys(chartInstances).forEach(k => { if (chartInstances[k]) { chartInstances[k].destroy(); chartInstances[k] = null; } });

    // status doughnut
    const keys = ['TBR', 'READING', 'READ', 'ONHOLD', 'DNF'];
    const colors = keys.map(k => cssVar('--st-' + k.toLowerCase()));
    const counts = keys.map(k => books.filter(b => b.progress === k).length);
    chartInstances.status = new Chart($('chartStatus').getContext('2d'), {
        type: 'doughnut',
        data: { labels: keys.map(k => PROGRESS_LABELS[k]), datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '68%',
            plugins: { legend: { position: 'bottom', labels: { color: text, boxWidth: 12, font: { family: 'DM Sans' } } } }
        }
    });

    // finished per month
    chartInstances.monthly = new Chart($('chartMonthly').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{ label: 'Books finished', data: monthly, backgroundColor: accent, borderRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: grid }, ticks: { stepSize: 1, color: text } },
                x: { grid: { display: false }, ticks: { color: text, font: { size: 10 } } }
            }
        }
    });

    // top tags
    const tagCount = {};
    books.forEach(b => b.tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
    chartInstances.tags = new Chart($('chartTags').getContext('2d'), {
        type: 'bar',
        data: { labels: topTags.map(t => t[0]), datasets: [{ data: topTags.map(t => t[1]), backgroundColor: accent, borderRadius: 4 }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, grid: { color: grid }, ticks: { stepSize: 1, color: text } },
                y: { grid: { display: false }, ticks: { color: text } }
            }
        }
    });
}

function setGoal() {
    const g = prompt('How many books do you want to finish this year?', readingGoal);
    const n = parseInt(g, 10);
    if (g && !isNaN(n) && n > 0) {
        readingGoal = n;
        writeStore(STORAGE.goal, readingGoal);
        updateStats();
    }
}
