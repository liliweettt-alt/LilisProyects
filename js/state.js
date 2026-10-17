/* ===== state.js =====
   Shared variables the whole app uses. Loaded FIRST. */

// Names under which your data is saved in the browser.
// They are different from your fic and manga apps, so the three never mix
// (even if they are hosted under the same github.io address).
const STORAGE = {
    data: 'bookLibData',
    queue: 'bookLibQueue',
    goal: 'bookLibGoal',
    theme: 'bookLibTheme',
    lastBackup: 'bookLibLastBackup',
    undo: 'bookLibUndo'
};

let books = [];
let queueIds = [];
let readingGoal = 20;

let tempDates = [];          // finish dates inside the open Add/Edit sheet
let selectedFormats = new Set();
let discoveryIds = [];       // the random picks currently shown in Up next

let expandedCards = new Set();   // cards with their Summary & Notes open
let collapsedSeries = new Set(); // series folders the user closed

let chartInstances = { status: null, monthly: null, tags: null };

let selectMode = false;          // Library "Select" mode (bulk edit)
let selectedIds = new Set();
let bulkFormats = new Set();

let afRunning = false;           // auto-fill is working
let afStop = false;
