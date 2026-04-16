// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
        console.log('Service Worker Registered');
    });
}

// --- Initialize Database in LocalStorage ---
const initDB = () => {
    if (!localStorage.getItem('users')) {
        localStorage.setItem('users', JSON.stringify([
            { name: 'Admin', mobile: 'admin', code: 'admin123', role: 'admin' }
        ]));
    }
    if (!localStorage.getItem('issues')) {
        localStorage.setItem('issues', JSON.stringify([]));
    }
};
initDB();

let currentUser = null;

// --- Helper Functions ---
const getDB = (key) => JSON.parse(localStorage.getItem(key));
const setDB = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
};

// --- Authentication ---
function login() {
    const mobile = document.getElementById('login-mobile').value.trim();
    const code = document.getElementById('login-code').value.trim();
    const users = getDB('users');
    
    const user = users.find(u => u.mobile === mobile && u.code === code);
    
    if (user) {
        currentUser = user;
        document.getElementById('login-mobile').value = '';
        document.getElementById('login-code').value = '';
        if (user.role === 'admin') {
            switchView('admin-view');
            renderAdminDashboard();
        } else {
            switchView('villager-view');
            renderVillagerIssues();
        }
    } else {
        alert('Invalid Mobile Number or Access Code');
    }
}

function logout() {
    currentUser = null;
    switchView('login-view');
}

// --- Villager Functions ---
function submitIssue() {
    const category = document.getElementById('issue-category').value;
    const desc = document.getElementById('issue-desc').value;
    const fileInput = document.getElementById('issue-img');

    if (!category || !desc) {
        alert('Please fill out all fields.');
        return;
    }

    const processSubmission = (imageBase64) => {
        const issues = getDB('issues');
        issues.push({
            id: Date.now(),
            villagerName: currentUser.name,
            villagerMobile: currentUser.mobile,
            category,
            desc,
            image: imageBase64,
            status: 'new', // new, process, resolved
            date: new Date().toLocaleDateString()
        });
        setDB('issues', issues);
        alert('Issue submitted successfully!');
        
        // Reset form
        document.getElementById('issue-category').value = '';
        document.getElementById('issue-desc').value = '';
        document.getElementById('issue-img').value = '';
        
        renderVillagerIssues();
    };

    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (e) => processSubmission(e.target.result);
        reader.readAsDataURL(fileInput.files[0]); // Convert image to Base64
    } else {
        processSubmission(null);
    }
}

function renderVillagerIssues() {
    const issues = getDB('issues').filter(i => i.villagerMobile === currentUser.mobile).reverse();
    const list = document.getElementById('villager-issues-list');
    
    list.innerHTML = issues.map(issue => `
        <div class="list-item">
            <div class="list-item-header">
                <strong>${issue.category}</strong>
                <span class="badge ${issue.status}">${issue.status.toUpperCase()}</span>
            </div>
            <p style="font-size: 14px; color: #555;">${issue.desc}</p>
            <small style="color: #999;">${issue.date}</small>
            ${issue.image ? `<img src="${issue.image}" class="item-img">` : ''}
        </div>
    `).join('') || '<p>No issues reported yet.</p>';
}

// --- Admin Functions ---
function toggleAdminSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    document.getElementById(sectionId).classList.add('active');
}

function generateCode() {
    const name = document.getElementById('new-villager-name').value.trim();
    const mobile = document.getElementById('new-villager-mobile').value.trim();
    
    if (!name || mobile.length < 10) {
        alert('Please enter a valid name and 10-digit mobile number.');
        return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit random code
    const users = getDB('users');
    
    // Check if user exists, update code, else create new
    const existingIndex = users.findIndex(u => u.mobile === mobile);
    if(existingIndex > -1) {
        users[existingIndex].code = code;
    } else {
        users.push({ name, mobile, code, role: 'villager' });
    }
    
    setDB('users', users);
    
    document.getElementById('new-villager-name').value = '';
    document.getElementById('new-villager-mobile').value = '';
    
    renderGeneratedCodes();
}

function renderGeneratedCodes() {
    const users = getDB('users').filter(u => u.role === 'villager').reverse();
    const list = document.getElementById('generated-codes-list');
    
    list.innerHTML = users.map(u => `
        <div class="list-item" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${u.name}</strong><br>
                <small>${u.mobile}</small>
            </div>
            <div style="background:var(--primary); color:white; padding:8px 15px; border-radius:8px; font-weight:bold; letter-spacing:2px;">
                ${u.code}
            </div>
        </div>
    `).join('') || '<p>No codes generated yet.</p>';
}

function renderAdminDashboard() {
    const issues = getDB('issues').reverse();
    
    // Update Stats
    document.getElementById('stat-new').innerText = issues.filter(i => i.status === 'new').length;
    document.getElementById('stat-process').innerText = issues.filter(i => i.status === 'process').length;
    document.getElementById('stat-resolved').innerText = issues.filter(i => i.status === 'resolved').length;

    // Render Issue List
    const list = document.getElementById('admin-issues-list');
    list.innerHTML = issues.map(issue => `
        <div class="list-item">
            <div class="list-item-header">
                <strong>${issue.category}</strong>
                <span class="badge ${issue.status}">${issue.status.toUpperCase()}</span>
            </div>
            <p style="font-size: 14px; margin: 5px 0;"><strong>User:</strong> ${issue.villagerName} (${issue.villagerMobile})</p>
            <p style="font-size: 14px; color: #555;">${issue.desc}</p>
            ${issue.image ? `<img src="${issue.image}" class="item-img">` : ''}
            
            <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                <span style="font-size:12px; margin-right:10px;">Update Status:</span>
                <button class="status-btn new" onclick="updateStatus(${issue.id}, 'new')">New</button>
                <button class="status-btn process" onclick="updateStatus(${issue.id}, 'process')">In Process</button>
                <button class="status-btn resolved" onclick="updateStatus(${issue.id}, 'resolved')">Resolved</button>
            </div>
        </div>
    `).join('') || '<p>No issues reported.</p>';
    
    renderGeneratedCodes();
}

function updateStatus(issueId, newStatus) {
    const issues = getDB('issues');
    const issueIndex = issues.findIndex(i => i.id === issueId);
    if(issueIndex > -1) {
        issues[issueIndex].status = newStatus;
        setDB('issues', issues);
        renderAdminDashboard();
    }
}