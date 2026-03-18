'use strict';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// Global Database State
let originalDbStructure = { bankEntries: [], paymentOrders: [], years: [2026, 2025, 2024, 2023] };
let dbData = {
    chapters: [],
    items: [],
    entries: [],
    users: [],
    lastEntryId: 0
};
let activePage = 'dashboard';

// --- DB INIT & FS API ---

function initLocalDB() {
    const saved = localStorage.getItem('libyan_treasury_v4');
    if (saved) {
        try {
            console.log('[initLocalDB] Found saved DB under libyan_treasury_v4. Parsing data...');
            const rawData = JSON.parse(saved);
            console.log('[initLocalDB] Extracted Raw Data keys:', Object.keys(rawData));
            originalDbStructure = {
                bankEntries: rawData.bankEntries || [],
                paymentOrders: rawData.paymentOrders || [],
                years: rawData.years || [2026, 2025, 2024, 2023]
            };
            
            let flatChapters = [];
            let flatItems = [];
            
            if (rawData.chapters && rawData.chapters.expense) {
                rawData.chapters.expense.forEach((c, idx) => {
                    flatChapters.push({ id: c.id, name: c.name, type: 'expense', seq: idx + 1 });
                    if (c.items) {
                        c.items.forEach(item => flatItems.push({ id: item.id, chapter_id: c.id, name: item.name }));
                    }
                });
            }
            
            if (rawData.chapters && rawData.chapters.revenue) {
                rawData.chapters.revenue.forEach((c, idx) => {
                    flatChapters.push({ id: c.id, name: c.name, type: 'revenue', seq: idx + 1 });
                    if (c.items) {
                        c.items.forEach(item => flatItems.push({ id: item.id, chapter_id: c.id, name: item.name }));
                    }
                });
            }
            
            dbData = {
                chapters: flatChapters,
                items: flatItems,
                entries: rawData.entries || [],
                users: rawData.users || [],
                lastEntryId: 0
            };
            
            console.log(`[initLocalDB] Flattened dbData -> chapters: ${flatChapters.length}, items: ${flatItems.length}, entries: ${dbData.entries.length}`);

            if (dbData.entries.length > 0) {
                dbData.lastEntryId = Math.max(...dbData.entries.map(e => parseInt(e.id) || 0));
            }
        } catch (e) {
            console.error('Error parsing DB', e);
            createSchema();
        }
    } else {
        createSchema();
    }
}

function createSchema() {
    dbData = {
        chapters: [
            { id: 'rev1', name: 'الباب الأول - المرتبات', type: 'revenue', seq: 1 },
            { id: 'rev2', name: 'الباب الثاني - التسييرية', type: 'revenue', seq: 2 },
            { id: 'rev3', name: 'الباب الثالث - التحول', type: 'revenue', seq: 3 },
            { id: 'rev4', name: 'الباب الرابع - الودائع', type: 'revenue', seq: 4 },
            { id: 'exp1', name: 'الباب الأول - المرتبات', type: 'expense', seq: 1 },
            { id: 'exp2', name: 'الباب الثاني - التسييرية', type: 'expense', seq: 2 },
            { id: 'exp3', name: 'الباب الثالث - التحول', type: 'expense', seq: 3 },
            { id: 'exp4', name: 'الباب الرابع - الودائع', type: 'expense', seq: 4 }
        ],
        items: [],
        entries: [],
        users: [
            { username: 'admin', password: '123', fullName: 'مدير النظام', role: 'admin' }
        ],
        lastEntryId: 0
    };
    saveDB();
}

function saveDB() {
    console.log('[saveDB] Starting to save database to libyan_treasury_v4');
    const reconstructed = {
        bankEntries: originalDbStructure.bankEntries,
        chapters: {
            expense: [],
            revenue: []
        },
        entries: dbData.entries,
        paymentOrders: originalDbStructure.paymentOrders,
        users: dbData.users,
        years: originalDbStructure.years
    };

    const expChaps = dbData.chapters.filter(c => c.type === 'expense').sort((a,b) => a.seq - b.seq);
    expChaps.forEach(c => {
        reconstructed.chapters.expense.push({
            id: c.id,
            name: c.name,
            items: dbData.items.filter(i => i.chapter_id === c.id).map(i => ({ id: i.id, name: i.name }))
        });
    });

    const revChaps = dbData.chapters.filter(c => c.type === 'revenue').sort((a,b) => a.seq - b.seq);
    revChaps.forEach(c => {
        reconstructed.chapters.revenue.push({
            id: c.id,
            name: c.name,
            items: dbData.items.filter(i => i.chapter_id === c.id).map(i => ({ id: i.id, name: i.name }))
        });
    });

    localStorage.setItem('libyan_treasury_v4', JSON.stringify(reconstructed));
}

// Initial setup on load
function initApp() {
    initLocalDB();
    populateYearSelector();
    checkAuth();
}

// --- NAVIGATION ---
window.showPage = function (page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${page}`)?.classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`nav-${page}`)?.classList.add('active');
    activePage = page;
    renderPage(page);
};

window.showChapter = function (prefix, title) {
    window.showPage('chapter');
    document.getElementById('chapterPageTitle').textContent = title;
};

// --- RENDER LOGIC ---
function renderPage(page) {
    const year = getYear();
    console.log(`[renderPage] Rendering page: '${page}' for year: ${year}`);
    if (page === 'dashboard') {
        const stats = document.getElementById('dashboard-chapters-stats');
        stats.innerHTML = '';
        const expChaps = dbData.chapters.filter(c => c.type === 'expense').sort((a, b) => a.seq - b.seq);
        console.log(`[renderPage:dashboard] Filtered expense chapters count: ${expChaps.length}`);
        
        expChaps.forEach(c => {
            const revChap = dbData.chapters.find(x => x.type === 'revenue' && x.seq === c.seq);
            const rev = getSum(year, 'revenue', revChap ? revChap.id : null);
            const exp = getSum(year, 'expense', c.id);
            stats.innerHTML += `
            <div class="chapter-section">
                <h3>${c.name}</h3>
                <div class="compact-cards-row">
                    <div class="c-card c-rev"><span>إيراد</span><strong>${rev.toLocaleString()}</strong></div>
                    <div class="c-card c-exp"><span>مصروف</span><strong>${exp.toLocaleString()}</strong></div>
                    <div class="c-card c-bal"><span>رصيد</span><strong>${(rev - exp).toLocaleString()}</strong></div>
                </div>
            </div>`;
        });
        renderCharts();
    }
    if (page === 'entry') renderEntry();
}

function getSum(year, type, babId) {
    if (!babId) return 0;
    const sum = dbData.entries
        .filter(e => e.year === year && e.type === type && e.babId === babId)
        .reduce((sum, e) => sum + e.amount, 0);
    // console.log(`[getSum] type=${type}, babId=${babId}, year=${year} -> sum=${sum}`);
    return sum;
}

// --- ENTRY ---
function renderEntry() {
    const type = document.querySelector('.etab.active')?.id.includes('rev') ? 'revenue' : 'expense';
    const sel = document.getElementById('entryBab');
    sel.innerHTML = '<option value="">-- اختر الباب --</option>';
    
    const chaps = dbData.chapters.filter(c => c.type === type);
    chaps.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.name}</option>`);
}

window.onEntryBabChange = function () {
    const babId = document.getElementById('entryBab').value;
    const sel = document.getElementById('entryBand');
    sel.innerHTML = '<option value="">-- اختر البند --</option>';
    
    let items = dbData.items.filter(i => i.chapter_id === babId);
    if (items.length === 0 && babId) {
        // Auto-seed items if none exist for simplicity
        dbData.items.push({ id: `i${Date.now()}`, chapter_id: babId, name: 'بند مصروفات عمومية' });
        saveDB();
        items = dbData.items.filter(i => i.chapter_id === babId);
    }
    items.forEach(i => sel.innerHTML += `<option value="${i.id}">${i.name}</option>`);
};

window.addNewBandQuick = function() {
    const babId = document.getElementById('entryBab').value;
    if (!babId) return alert('الرجاء اختيار الباب أولاً');
    const bName = prompt('أدخل اسم البند الجديد:');
    if (bName && bName.trim() !== '') {
        dbData.items.push({ id: `i${Date.now()}`, chapter_id: babId, name: bName.trim() });
        saveDB();
        window.onEntryBabChange();
    }
}

window.saveEntry = function () {
    const year = getYear(), month = parseInt(document.getElementById('entryMonth').value);
    const type = document.querySelector('.etab.active')?.id.includes('rev') ? 'revenue' : 'expense';
    const babId = document.getElementById('entryBab').value;
    const itemId = document.getElementById('entryBand').value;
    const amount = parseFloat(document.getElementById('entryAmount').value);
    
    if (!babId || isNaN(amount)) return alert('بيانات ناقصة');
    
    dbData.lastEntryId++;
    dbData.entries.push({
        id: dbData.lastEntryId,
        year: year,
        month: month,
        type: type,
        babId: babId,
        itemId: itemId,
        amount: amount,
        note: document.getElementById('entryNote')?.value || ''
    });
    
    saveDB();
    alert('تم الحفظ بنجاح');
    document.getElementById('entryAmount').value = '';
    document.getElementById('entryNote').value = '';
    renderEntry();
};

window.clearEntry = function () {
    document.getElementById('entryAmount').value = '';
    document.getElementById('entryNote').value = '';
    document.getElementById('entryBab').value = '';
    document.getElementById('entryBand').innerHTML = '<option value="">-- اختر البند --</option>';
};

window.switchEntryType = function (type, btn) {
    document.querySelectorAll('.etab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderEntry();
};

// --- AUTH & SUBS ---

function checkAuth() {
    const user = JSON.parse(sessionStorage.getItem('logged_user'));
    if (user) {
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        window.showPage('dashboard');
    }
}

document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    
    const user = dbData.users.find(x => x.username === u && x.password === p);
    
    if (user) {
        const sessionUser = { username: user.username, fullName: user.fullName, role: user.role };
        sessionStorage.setItem('logged_user', JSON.stringify(sessionUser));
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        window.showPage('dashboard');
    } else {
        document.getElementById('loginError').classList.remove('hidden');
    }
});

function getYear() { return parseInt(document.getElementById('globalYear').value); }
function populateYearSelector() {
    const sel = document.getElementById('globalYear');
    sel.innerHTML = '';
    let yearsSet = new Set();
    if (originalDbStructure && originalDbStructure.years) {
        originalDbStructure.years.forEach(y => yearsSet.add(parseInt(y)));
    }
    dbData.entries.forEach(e => yearsSet.add(parseInt(e.year)));
    yearsSet.add(new Date().getFullYear());
    
    const years = Array.from(yearsSet).sort((a,b) => b - a);
    const defaultYear = years.includes(2026) ? 2026 : Math.max(...years);

    console.log(`[populateYearSelector] Extracted years: ${years}, Defaulting to: ${defaultYear}`);

    years.forEach(y => sel.innerHTML += `<option value="${y}" ${y === defaultYear ? 'selected' : ''}>${y}</option>`);
}

window.onYearChange = function() {
    renderPage(activePage);
};

window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('collapsed');
window.logout = () => { sessionStorage.removeItem('logged_user'); location.reload(); };

function renderCharts() {
    const year = getYear();
    const revs = [], exps = [];
    for (let m = 0; m < 12; m++) {
        const mRev = dbData.entries.filter(e => e.year === year && e.type === 'revenue' && e.month === m).reduce((sum, e) => sum + e.amount, 0);
        const mExp = dbData.entries.filter(e => e.year === year && e.type === 'expense' && e.month === m).reduce((sum, e) => sum + e.amount, 0);
        revs.push(mRev);
        exps.push(mExp);
    }
    const ctx = document.getElementById('monthlyChart')?.getContext('2d');
    if (!ctx) return;
    if (window.myChart) window.myChart.destroy();
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: MONTHS, datasets: [
                { label: 'إيرادات', data: revs, backgroundColor: '#10b981' },
                { label: 'مصروفات', data: exps, backgroundColor: '#f43f5e' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- BACKUP & RESTORE ---
window.exportDataJSON = function() {
    saveDB(); // Ensure we have latest data stored in localStorage
    const saved = localStorage.getItem('libyan_treasury_v4');
    if (!saved) return alert('لا توجد بيانات لتصديرها');
    
    const blob = new Blob([saved], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `libyan_treasury_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
};

window.importDataJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (confirm('تنبيه: استيراد البيانات سيقوم بمسح كافة البيانات الحالية. هل أنت متأكد من الاستمرار؟')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const jsonText = e.target.result;
                const data = JSON.parse(jsonText);
                if (data.chapters && data.entries) {
                    console.log('[importDataJSON] File is valid, applying to libyan_treasury_v4');
                    localStorage.setItem('libyan_treasury_v4', jsonText);
                    alert('تم استيراد البيانات بنجاح! سيتم تحديث الصفحة.');
                    location.reload();
                } else {
                    alert('ملف النسخة الاحتياطية غير صالح (الهيكل غير متوافق).');
                }
            } catch (err) {
                console.error(err);
                alert('حدث خطأ أثناء قراءة الملف. يرجى التأكد من استيراد ملف JSON سليم.');
            }
        };
        reader.readAsText(file);
    }
    event.target.value = ''; // Reset file input
};

// remove initSQLite and replace with initApp
initApp();
