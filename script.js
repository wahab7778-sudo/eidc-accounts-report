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

let activeChapterSeq = 1;
window.showChapter = function (prefix, title) {
    activeChapterSeq = parseInt(prefix);
    window.showPage('chapter');
    document.getElementById('chapterPageTitle').textContent = title;
};

window.syncDemoButton = function() {
    const btn = document.getElementById('btn-demo-toggle');
    if (!btn) return;
    const hasDemoData = dbData.entries.some(e => e.isDemo) || 
                       (originalDbStructure.paymentOrders && originalDbStructure.paymentOrders.some(v => v.isDemo));
    if(hasDemoData) {
        btn.innerHTML = '🛑 إيقاف المحاكاة';
        btn.style.background = '#fee2e2';
        btn.style.color = '#b91c1c';
        btn.style.border = '1px solid #f87171';
    } else {
        btn.innerHTML = '🚀 وضع المحاكاة';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.border = '';
    }
};

// --- RENDER LOGIC ---
function renderPage(page) {
    window.syncDemoButton();
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
    if (page === 'chapter') {
        renderChapterTables();
    }
    if (page === 'entry') { renderEntry(); window.renderRecentEntries(); }
    if (page === 'financial-dept') window.renderFinancialDept();
    if (page === 'internal-audit') window.renderInternalAudit();
    if (page === 'financial-controller') window.renderFinancialController();
    if (page === 'voucher-archive') window.renderVoucherArchive();
    if (page === 'admin-post') window.renderAdminPost();
    if (page === 'report') window.renderFinalReport();
    if (page === 'settings') window.renderSettings();
}

function renderChapterTables() {
    const year = getYear();
    const revTableHead = document.getElementById('chap-rev-thead');
    const revTableBody = document.getElementById('chap-rev-tbody');
    const revTableFoot = document.getElementById('chap-rev-tfoot');
    
    const expTableHead = document.getElementById('chap-exp-thead');
    const expTableBody = document.getElementById('chap-exp-tbody');
    const expTableFoot = document.getElementById('chap-exp-tfoot');
    
    if(!revTableHead || !expTableHead) return;

    let theadHTML = `<tr><th>رقم البند</th><th>اسم البند</th>`;
    MONTHS.forEach(m => { theadHTML += `<th>${m}</th>`; });
    theadHTML += `<th>الإجمالي</th></tr>`;
    
    revTableHead.innerHTML = theadHTML;
    expTableHead.innerHTML = theadHTML;
    
    const revChap = dbData.chapters.find(c => c.type === 'revenue' && c.seq === activeChapterSeq);
    buildTableBodyAndFoot(revChap, 'revenue', year, revTableBody, revTableFoot);
    
    const expChap = dbData.chapters.find(c => c.type === 'expense' && c.seq === activeChapterSeq);
    buildTableBodyAndFoot(expChap, 'expense', year, expTableBody, expTableFoot);
    
    const revTot = revChap ? getSum(year, 'revenue', revChap.id) : 0;
    const expTot = expChap ? getSum(year, 'expense', expChap.id) : 0;
    const balEl = document.getElementById('chapter-balance-value');
    if(balEl) {
        balEl.textContent = `${(revTot - expTot).toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3})} د.ل`;
    }
}

function buildTableBodyAndFoot(chap, type, year, tBodyEl, tFootEl) {
    tBodyEl.innerHTML = '';
    tFootEl.innerHTML = '';
    if (!chap) return;
    
    const items = dbData.items.filter(i => i.chapter_id === chap.id);
    let monthTotals = new Array(12).fill(0);
    let grandTotal = 0;
    
    items.forEach((item, index) => {
        let tr = `<tr><td class="num-cell">${index + 1}</td><td class="band-name-cell">${item.name}</td>`;
        let itemTotal = 0;
        
        for (let m = 0; m < 12; m++) {
            const sum = dbData.entries
                .filter(e => e.year === year && e.type === type && e.babId === chap.id && e.itemId === item.id && e.month === m)
                .reduce((s, e) => s + e.amount, 0);
            itemTotal += sum;
            monthTotals[m] += sum;
            tr += `<td>${sum > 0 ? sum.toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3}) : '-'}</td>`;
        }
        grandTotal += itemTotal;
        tr += `<td style="background:#f1f5f9; font-weight:bold;">${itemTotal > 0 ? itemTotal.toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3}) : '-'}</td></tr>`;
        tBodyEl.innerHTML += tr;
    });
    
    let tFootStr = `<tr class="total-row"><td colspan="2" class="band-name-cell" style="text-align:left;">إجمالي الباب (${chap.name})</td>`;
    for (let m = 0; m < 12; m++) {
        tFootStr += `<td>${monthTotals[m] > 0 ? monthTotals[m].toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3}) : '-'}</td>`;
    }
    tFootStr += `<td>${grandTotal > 0 ? grandTotal.toLocaleString('en-US', {minimumFractionDigits:3, maximumFractionDigits:3}) : '0.000'}</td></tr>`;
    tFootEl.innerHTML = tFootStr;
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
    const typeObj = document.querySelector('.etab.active');
    const typeId = typeObj ? typeObj.id : '';
    let type = 'revenue';
    if(typeId.includes('exp')) type = 'expense';
    if(typeId.includes('bank')) type = 'bank';
    
    if (type === 'bank') return; // Handled separately
    
    const sel = document.getElementById('entryBab');
    if(!sel) return;
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
    const typeObj = document.querySelector('.etab.active');
    let type = 'revenue';
    if(typeObj && typeObj.id.includes('exp')) type = 'expense';
    if(typeObj && typeObj.id.includes('bank')) type = 'bank';

    if (type === 'bank') {
        const bankDay = parseInt(document.getElementById('entryBankDay').value);
        const bankDesc = document.getElementById('entryBankDesc').value;
        const bankCredit = parseFloat(document.getElementById('entryBankCredit').value) || 0;
        const bankDebit = parseFloat(document.getElementById('entryBankDebit').value) || 0;
        
        if(!bankDay || !bankDesc || (bankCredit === 0 && bankDebit === 0)) return alert('يرجى تعبئة الحقول البنكية');
        
        if(!originalDbStructure.bankEntries) originalDbStructure.bankEntries = [];
        originalDbStructure.bankEntries.push({
            id: Date.now(), year, month, day: bankDay, desc: bankDesc,
            checkNum: document.getElementById('entryBankCheck').value,
            docNum: document.getElementById('entryBankDoc').value,
            debit: bankDebit, credit: bankCredit
        });
        saveDB();
        alert('تم تسجيل العملية البنكية بنجاح');
        document.querySelectorAll('.bank-only input').forEach(inp => inp.value = '');
    } else {
        const babId = document.getElementById('entryBab').value;
        const itemId = document.getElementById('entryBand').value;
        const amount = parseFloat(document.getElementById('entryAmount').value);
        
        if (!babId || isNaN(amount)) return alert('بيانات ناقصة: الرجاء التأكد من اختيار الباب وتحديد المبلغ.');
        
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
        document.getElementById('entryBand').value = '';
    }
    
    renderEntry();
    if(window.renderRecentEntries) window.renderRecentEntries();
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
    
    const badge = document.getElementById('entry-type-badge');
    if (badge) {
        if (type === 'revenue') {
            badge.textContent = 'إيراد';
            badge.className = 'entry-type-badge';
        } else if (type === 'expense') {
            badge.textContent = 'مصروف';
            badge.className = 'entry-type-badge expense-badge';
        } else {
            badge.textContent = 'سجل المصرف';
            badge.className = 'entry-type-badge';
            badge.style.background = '#dbeafe';
            badge.style.color = '#1e40af';
        }
    }
    
    const bankFields = document.querySelectorAll('.bank-only');
    const babGrp = document.getElementById('entryBab')?.parentElement;
    const bandGrp = document.getElementById('entryBand')?.parentElement;
    const amtGrp = document.getElementById('entryAmount')?.parentElement;
    const noteGrp = document.getElementById('entryNote')?.parentElement;

    if (type === 'bank') {
        bankFields.forEach(f => f.classList.remove('hidden'));
        if(babGrp) babGrp.classList.add('hidden');
        if(bandGrp) bandGrp.classList.add('hidden');
        if(amtGrp) amtGrp.classList.add('hidden');
        if(noteGrp) noteGrp.classList.add('hidden');
    } else {
        bankFields.forEach(f => f.classList.add('hidden'));
        if(babGrp) babGrp.classList.remove('hidden');
        if(bandGrp) bandGrp.classList.remove('hidden');
        if(amtGrp) amtGrp.classList.remove('hidden');
        if(noteGrp) noteGrp.classList.remove('hidden');
    }
    
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

// ================= MISSING PAGES LOGIC =================

window.renderRecentEntries = function() {
    const tbody = document.getElementById('recent-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const recent = dbData.entries.slice(-10).reverse();
    recent.forEach(e => {
        const chap = dbData.chapters.find(c => c.id === e.babId);
        const item = dbData.items.find(i => i.id === e.itemId);
        tbody.innerHTML += `<tr>
            <td>${e.year}</td>
            <td>${MONTHS[e.month] || e.month}</td>
            <td class="bab-name-cell">${chap ? chap.name : e.babId}</td>
            <td class="band-name-cell">${item ? item.name : e.itemId}</td>
            <td>${e.type === 'revenue' ? '<span style="color:var(--revenue)">إيراد</span>' : '<span style="color:var(--expense)">مصروف</span>'}</td>
            <td style="font-weight:bold;">${e.amount.toLocaleString('en-US',{minimumFractionDigits:3})}</td>
            <td><button class="btn-icon" onclick="window.deleteEntry(${e.id})" style="color:var(--expense); font-size:1.2rem;">🗑️</button></td>
        </tr>`;
    });
};

window.deleteEntry = function(id) {
    if(confirm('هل أنت متأكد من الحذف النهائي لهذا الإدخال؟')) {
        dbData.entries = dbData.entries.filter(e => e.id !== id);
        saveDB();
        renderPage(activePage); // Refresh
    }
};

window.renderFinancialDept = function() {
    const tbody = document.getElementById('vouchers-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const vouchers = originalDbStructure.paymentOrders.filter(v => v.status === 'draft' || v.status === 'pending_audit' || v.status === 'rejected');
    vouchers.forEach(v => {
        const statusHTML = v.status==='rejected' 
            ? `<span style="color:var(--expense); font-weight:bold;">مرفوض للتصحيح</span><br><small>${v.auditComment||''}</small>` 
            : `<span style="color:#0f3060;">قيد المراجعة</span>`;
            
        tbody.innerHTML += `<tr>
            <td>${v.num}</td>
            <td>${v.date}</td>
            <td>${v.beneficiary}</td>
            <td style="font-weight:bold; color:var(--expense)">${v.amount.toLocaleString()}</td>
            <td>${window.getItemName(v.itemId)}</td>
            <td>${statusHTML}</td>
        </tr>`;
    });
};

window.showVoucherForm = function() {
    document.getElementById('voucher-list-view').classList.add('hidden');
    document.getElementById('voucher-form-view').classList.remove('hidden');
    document.getElementById('v_num').value = `VO-${Date.now().toString().slice(-6)}`;
    
    const babSel = document.getElementById('v_bab');
    babSel.innerHTML = '<option value="">-- اختر الباب --</option>';
    dbData.chapters.filter(c => c.type === 'expense').forEach(c => {
        babSel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
};

window.hideVoucherForm = function() {
    document.getElementById('voucher-list-view').classList.remove('hidden');
    document.getElementById('voucher-form-view').classList.add('hidden');
};

window.onVoucherBabChange = function() {
    const babId = document.getElementById('v_bab').value;
    const bandSel = document.getElementById('v_band');
    bandSel.innerHTML = '<option value="">-- اختر البند --</option>';
    dbData.items.filter(i => i.chapter_id === babId).forEach(i => {
        bandSel.innerHTML += `<option value="${i.id}">${i.name}</option>`;
    });
};

window.calculateVoucherStamp = function() {};

window.saveVoucher = function() {
    const v = {
        id: document.getElementById('v_num').value,
        num: document.getElementById('v_num').value,
        date: document.getElementById('v_date').value,
        beneficiary: document.getElementById('v_beneficiary').value,
        amount: parseFloat(document.getElementById('v_amount').value),
        desc: document.getElementById('v_desc').value,
        babId: document.getElementById('v_bab').value,
        itemId: document.getElementById('v_band').value,
        status: 'pending_audit'
    };
    if(!v.amount || !v.beneficiary || !v.itemId) return alert('خطأ: يرجى تعبئة كافة الحقول الأساسية.');
    
    if (!originalDbStructure.paymentOrders) originalDbStructure.paymentOrders = [];
    originalDbStructure.paymentOrders.push(v);
    saveDB();
    alert('تم حفظ الإذن وإرساله قسم المراجعة الداخلية بنجاح!');
    window.hideVoucherForm();
    window.renderFinancialDept();
};

window.renderInternalAudit = function() {
    const tbody = document.getElementById('audit-vouchers-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const vouchers = originalDbStructure.paymentOrders.filter(v => v.status === 'pending_audit');
    vouchers.forEach(v => {
        tbody.innerHTML += `<tr>
            <td>${v.num}</td>
            <td>${v.beneficiary}</td>
            <td style="font-weight:bold; color:var(--expense)">${v.amount.toLocaleString()}</td>
            <td>${window.getItemName(v.itemId)}</td>
            <td><span style="color:#f59e0b; font-weight:bold;">قيد المراجعة</span></td>
            <td style="display:flex; gap:0.5rem; justify-content:center;">
                <button class="btn-primary btn-sm" onclick="window.changeVoucherStatus('${v.id}', 'approved_audit')">✔️ اعتماد</button>
                <button class="btn-danger btn-sm" onclick="window.rejectVoucher('${v.id}')">❌ إرجاع</button>
            </td>
        </tr>`;
    });
};

window.renderFinancialController = function() {
    const tbody = document.getElementById('controller-vouchers-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const vouchers = originalDbStructure.paymentOrders.filter(v => v.status === 'approved_audit');
    vouchers.forEach(v => {
        tbody.innerHTML += `<tr>
            <td>${v.num}</td>
            <td>${v.beneficiary}</td>
            <td style="font-weight:bold; color:var(--expense)">${v.amount.toLocaleString()}</td>
            <td>${window.getItemName(v.itemId)}</td>
            <td><span style="color:#10b981; font-weight:bold;">معتمد مراجعياً</span></td>
            <td style="display:flex; gap:0.5rem; justify-content:center;">
                <button class="btn-primary btn-sm" onclick="window.changeVoucherStatus('${v.id}', 'approved_controller')" style="background:#1e40af;">✍️ اعتماد نهائي</button>
                <button class="btn-danger btn-sm" onclick="window.rejectVoucher('${v.id}')">❌ إلغاء</button>
            </td>
        </tr>`;
    });
};

window.rejectVoucher = function(id) {
    const reason = prompt('يرجى تحديد سبب الرفض/الإرجاع للتصحيح:');
    if(reason !== null) {
        const v = originalDbStructure.paymentOrders.find(x => x.id === id);
        if(v) { 
            v.status = 'rejected'; 
            v.auditComment = reason; 
            saveDB(); 
            window.renderPage(activePage); 
        }
    }
};

window.changeVoucherStatus = function(id, st) {
    const v = originalDbStructure.paymentOrders.find(x => x.id === id);
    if(v) { 
        v.status = st; 
        saveDB(); 
        window.renderPage(activePage); 
    }
};

window.renderAdminPost = function() {
    const tbody = document.getElementById('admin-post-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const vouchers = originalDbStructure.paymentOrders.filter(v => v.status === 'approved_controller');
    vouchers.forEach(v => {
        tbody.innerHTML += `<tr>
            <td>${v.num}</td>
            <td>${v.beneficiary}</td>
            <td style="font-weight:bold; color:var(--expense)">${v.amount.toLocaleString()}</td>
            <td>${window.getItemName(v.itemId)}</td>
            <td><span style="color:#8b5cf6; font-weight:bold;">معتمد، بانتظار الترحيل</span></td>
            <td><button class="btn-primary btn-sm" style="background:#8b5cf6;" onclick="window.postVoucher('${v.id}')">📤 ترحيل للسجلات</button></td>
        </tr>`;
    });
};

window.postVoucher = function(id) {
    if(!confirm('ترحيل هذه المعاملة سيقوم بخصم القيمة فعلياً من السجلات الختامية للباب. هل تريد الترحيل الآن؟')) return;
    
    const v = originalDbStructure.paymentOrders.find(x => x.id === id);
    if(v) {
        dbData.lastEntryId++;
        const dateObj = new Date(v.date || Date.now());
        dbData.entries.push({
            id: dbData.lastEntryId,
            year: dateObj.getFullYear(),
            month: dateObj.getMonth(),
            type: 'expense',
            babId: v.babId,
            itemId: v.itemId,
            amount: v.amount,
            note: v.desc || `مرحل من أمر صرف ${v.num}`
        });
        v.status = 'posted';
        saveDB();
        alert('تم ترحيل المعاملة إلى الحسابات الختامية وتم اقتطاع المبلغ من المخصصات!');
        window.renderAdminPost();
    }
};

window.renderVoucherArchive = function() {
    const tbody = document.getElementById('archive-vouchers-tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    let vouchers = originalDbStructure.paymentOrders || [];
    
    const searchInput = document.getElementById('archiveSearch');
    const filterInput = document.getElementById('archiveStatusFilter');
    
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const filter = filterInput ? filterInput.value : 'all';
    
    if(filter !== 'all') vouchers = vouchers.filter(v => v.status === filter);
    if(search) vouchers = vouchers.filter(v => (v.num && v.num.toLowerCase().includes(search)) || (v.beneficiary && v.beneficiary.toLowerCase().includes(search)));
    
    const statusMap = { 'draft':'مسودة', 'pending_audit':'تحت المراجعة', 'approved_audit':'معتمد من المراجع', 'approved_controller':'معتمد نهائي', 'posted':'تم الترحيل', 'rejected':'تم إرجاعه' };
    
    vouchers.forEach(v => {
        tbody.innerHTML += `<tr>
            <td>${v.date}</td>
            <td><span class="chapter-badge">${v.num}</span></td>
            <td><strong>${v.beneficiary}</strong></td>
            <td style="color:var(--expense); font-weight:bold;">${v.amount.toLocaleString()}</td>
            <td>${v.desc || 'لا يوجد بيان'}</td>
            <td><strong>${statusMap[v.status] || v.status}</strong></td>
            <td><button class="btn-secondary btn-sm" onclick="alert('سجل الأرشيف عرض فقط')">📄 تفاصيل</button></td>
        </tr>`;
    });
};

window.renderFinalReport = function() {
    const year = getYear();
    const container = document.getElementById('chapters-reports-container');
    if(!container) return;
    container.innerHTML = '';
    
    let totalRev = 0;
    let totalExp = 0;
    
    const expChaps = dbData.chapters.filter(c => c.type === 'expense').sort((a,b)=>a.seq-b.seq);
    let htmlContent = '';
    
    expChaps.forEach(c => {
        const revChap = dbData.chapters.find(x => x.type === 'revenue' && x.seq === c.seq);
        const revAmount = revChap ? getSum(year, 'revenue', revChap.id) : 0;
        const expAmount = getSum(year, 'expense', c.id);
        
        totalRev += revAmount;
        totalExp += expAmount;
        
        htmlContent += `<div class="chapter-section" style="margin-top:1.5rem; border:2px solid var(--border);">
            <h3>📊 ${c.name}</h3>
            <table class="treasury-table">
                <thead><tr><th class="revenue-header">إجمالي الإيرادات</th><th class="expense-header">إجمالي المصروفات</th><th style="background:var(--balance); color:white;">الرصيد المتبقي</th></tr></thead>
                <tbody>
                    <tr>
                        <td style="color:var(--revenue); font-weight:900; font-size:1.2rem;">${revAmount.toLocaleString('en-US',{minimumFractionDigits:3})} د.ل</td>
                        <td style="color:var(--expense); font-weight:900; font-size:1.2rem;">${expAmount.toLocaleString('en-US',{minimumFractionDigits:3})} د.ل</td>
                        <td style="color:var(--balance); font-weight:900; font-size:1.2rem; background:#f8fafc;">${(revAmount - expAmount).toLocaleString('en-US',{minimumFractionDigits:3})} د.ل</td>
                    </tr>
                </tbody>
            </table>
        </div>`;
    });
    
    container.innerHTML = htmlContent;
    
    document.getElementById('rep-rev').textContent = totalRev.toLocaleString('en-US',{minimumFractionDigits:3}) + ' د.ل';
    document.getElementById('rep-exp').textContent = totalExp.toLocaleString('en-US',{minimumFractionDigits:3}) + ' د.ل';
    document.getElementById('rep-bal').textContent = (totalRev - totalExp).toLocaleString('en-US',{minimumFractionDigits:3}) + ' د.ل';
};

window.renderSettings = function() {
    const container = document.getElementById('settings-dynamic-container');
    if(!container) return;
    
    container.innerHTML = '<div class="settings-grid" id="settings-grid-inner"></div>';
    const grid = document.getElementById('settings-grid-inner');
    
    let revHtml = `<div class="settings-panel"><div class="settings-panel-header"><h3>أبواب الإيرادات</h3></div>`;
    dbData.chapters.filter(c => c.type === 'revenue').sort((a,b)=>a.seq-b.seq).forEach(c => {
        revHtml += `<div class="bab-item">
            <div class="bab-item-header">
                <strong>🔸 ${c.name}</strong>
                <button class="btn-icon" onclick="window.deleteChapter('${c.id}')">🗑️</button>
            </div>
            ${dbData.items.filter(i => i.chapter_id === c.id).map(i => `<div class="band-item" style="padding-right:1rem; border-right:2px solid var(--border);">▪️ <span class="band-name-input">${i.name}</span> <button class="btn-icon" onclick="window.deleteItem('${i.id}')">❌</button></div>`).join('')}
            <button class="btn-add-band" onclick="window.addItemToChap('${c.id}')">+ إضافة بند إيراد جديد</button>
        </div>`;
    });
    revHtml += `</div>`;
    
    let expHtml = `<div class="settings-panel"><div class="settings-panel-header"><h3>أبواب المصروفات</h3></div>`;
    dbData.chapters.filter(c => c.type === 'expense').sort((a,b)=>a.seq-b.seq).forEach(c => {
        expHtml += `<div class="bab-item" style="border-top:3px solid var(--expense-light);">
            <div class="bab-item-header">
                <strong>🔸 ${c.name}</strong>
                <button class="btn-icon" onclick="window.deleteChapter('${c.id}')">🗑️</button>
            </div>
            ${dbData.items.filter(i => i.chapter_id === c.id).map(i => `<div class="band-item" style="padding-right:1rem; border-right:2px solid var(--border);">▪️ <span class="band-name-input">${i.name}</span> <button class="btn-icon" onclick="window.deleteItem('${i.id}')">❌</button></div>`).join('')}
            <button class="btn-add-band" onclick="window.addItemToChap('${c.id}')" style="border-color:var(--expense-light); color:var(--expense);">+ إضافة بند مصروفات جديد</button>
        </div>`;
    });
    expHtml += `</div>`;
    
    grid.innerHTML = revHtml + expHtml;
};

window.getItemName = function(id) {
    const i = dbData.items.find(x => x.id === id);
    return i ? i.name : id;
};

window.deleteChapter = function(id) {
    if(confirm('متأكد؟ حذفك للباب سيحذف كافة البنود والإدخالات المالية المرتبطة به إلى الأبد!')) {
        dbData.chapters = dbData.chapters.filter(c => c.id !== id);
        dbData.items = dbData.items.filter(i => i.chapter_id !== id);
        dbData.entries = dbData.entries.filter(e => e.babId !== id);
        saveDB(); window.renderSettings();
    }
};

window.deleteItem = function(id) {
    if(confirm('سيتم حذف البند وكافة العمليات المندرجة تحته، استمرار؟')) {
        dbData.items = dbData.items.filter(i => i.id !== id);
        dbData.entries = dbData.entries.filter(e => e.itemId !== id);
        saveDB(); window.renderSettings();
    }
};

window.addItemToChap = function(chapId) {
    const name = prompt('الرجاء إدخال اسم البند الجديد:');
    if(name && name.trim()) { 
        dbData.items.push({id:`itm-${Date.now()}`, chapter_id: chapId, name: name.trim()}); 
        saveDB(); 
        window.renderSettings(); 
    }
};

window.addBab = function(type) {
    const name = prompt(`الرجاء إدخال اسم باب ${type === 'revenue' ? 'الإيرادات' : 'المصروفات'} الجديد:`);
    if(name && name.trim()) {
        const seq = dbData.chapters.filter(c => c.type === type).length + 1;
        dbData.chapters.push({id:`${type==='revenue'?'rev':'exp'}-${Date.now()}`, name:name.trim(), type:type, seq:seq});
        saveDB(); 
        window.renderSettings();
    }
};

window.clearAllData = function() {
    if(confirm('تحذير خطير: ستقوم بمسح كافة المعاملات والمبالغ المسجلة (سيبقى التبويب فقط). هل تريد الاستمرار؟')) {
        if(confirm('تأكيد أخير: لا يمكن التراجع عن هذه الخطوة نهائياً!')) {
            dbData.entries = [];
            originalDbStructure.paymentOrders = [];
            originalDbStructure.bankEntries = [];
            saveDB(); 
            alert('تم تصفير كافة السجلات والمبالغ.'); 
            renderPage(activePage);
        }
    }
};

window.loadDefaults = function() {
    if(confirm('تحذير: هذه الخطوة ستمسح النظام بالكامل وتعيده إلى وضع المصنع (بما في ذلك التبويب). هل أنت متأكد؟')) {
        localStorage.removeItem('libyan_treasury_v4');
        localStorage.removeItem('treasury_db_local');
        location.reload();
    }
};

window.runDemoSimulation = function() {
    const btn = document.getElementById('btn-demo-toggle');
    const year = getYear() || new Date().getFullYear();
    
    const hasDemoData = dbData.entries.some(e => e.isDemo) || 
                       (originalDbStructure.paymentOrders && originalDbStructure.paymentOrders.some(v => v.isDemo));

    if (hasDemoData) {
        dbData.entries = dbData.entries.filter(e => !e.isDemo);
        if(originalDbStructure.paymentOrders) {
            originalDbStructure.paymentOrders = originalDbStructure.paymentOrders.filter(v => !v.isDemo);
        }
        
        if (btn) {
            btn.innerHTML = '🚀 وضع المحاكاة';
            btn.style.background = '';
            btn.style.color = '';
            btn.style.border = '';
        }
        saveDB();
        alert('تم إيقاف وضع المحاكاة ومسح البيانات الوهمية.');
        window.renderPage(activePage);
        return;
    }

    if (!confirm('سيتم إنشاء بيانات وهمية لأغراض التدريب والعرض (وضع المحاكاة). هل تريد الاستمرار؟')) return;

    if (!originalDbStructure.paymentOrders) originalDbStructure.paymentOrders = [];

    const demoBeneficiaries = ['شركة التقنية الحديثة', 'مكتب القرطاسية', 'مقاولات وصيانة', 'موظف مبيعات', 'المؤسسة الوطنية'];
    const demoDescs = ['شراء قرطاسية وأحبار', 'صيانة دورية للمبنى', 'مكافآت لجان التقييم', 'تجهيزات مكتبية', 'مصاريف ضيافة واستقبال'];
    
    for(let i=1; i<=15; i++) {
        const statuses = ['pending_audit', 'approved_audit', 'approved_controller', 'posted', 'rejected'];
        const expChaps = dbData.chapters.filter(c => c.type === 'expense');
        if(expChaps.length === 0) continue;
        
        const randChap = expChaps[Math.floor(Math.random() * expChaps.length)];
        const items = dbData.items.filter(it => it.chapter_id === randChap.id);
        if(items.length === 0) continue;
        const randItem = items[Math.floor(Math.random() * items.length)].id;
        
        originalDbStructure.paymentOrders.push({
            id: `DEMO-VO-${Date.now()}-${i}`,
            num: `D-${Math.floor(Math.random()*1000)}`,
            date: `${year}-0${Math.floor(Math.random()*8)+1}-15`,
            beneficiary: demoBeneficiaries[Math.floor(Math.random() * demoBeneficiaries.length)],
            amount: Math.floor(Math.random() * 5000) + 500,
            desc: demoDescs[Math.floor(Math.random() * demoDescs.length)],
            babId: randChap.id,
            itemId: randItem,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            isDemo: true,
            auditComment: 'محاكاة'
        });
    }

    for (let m = 0; m < 12; m++) {
        dbData.chapters.forEach(c => {
            const items = dbData.items.filter(i => i.chapter_id === c.id);
            if (items.length > 0) {
                const rItem = items[Math.floor(Math.random() * items.length)];
                dbData.lastEntryId++;
                const isRev = c.type === 'revenue';
                const amount = isRev ? (Math.floor(Math.random() * 50000) + 10000) : (Math.floor(Math.random() * 20000) + 1000);
                
                dbData.entries.push({
                    id: dbData.lastEntryId,
                    year: year,
                    month: m,
                    type: c.type,
                    babId: c.id,
                    itemId: rItem.id,
                    amount: amount,
                    note: 'محاكاة',
                    isDemo: true
                });
            }
        });
    }

    if (btn) {
        btn.innerHTML = '🛑 إيقاف المحاكاة';
        btn.style.background = '#fee2e2';
        btn.style.color = '#b91c1c';
        btn.style.border = '1px solid #f87171';
    }
    
    saveDB();
    alert('تم تفعيل وضع المحاكاة بنجاح وتمت تعبئة كافة الواجهات ببيانات عشوائية!');
    window.renderPage(activePage);
};

window.showSummaryPage = function(type) {
    alert('الخلاصات الشهرية والسنوية متوفرة الآن بشكل تفصيلي ومدمج داخل جداول عرض الأبواب (مرر لليسار لمشاهدة كافة الأشهر وإجمالي السنة).');
};

window.showBankLedger = function(bab) {
    alert('سجل المصرف قيد التجهيز. يمكنك استخدام شاشة (إدخال البيانات המباشر) في الوقت الحالي.');
};

// remove initSQLite and replace with initApp
initApp();
