// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
        console.log('Service Worker Registered');
    });
}

// --- 1. PASTE YOUR FIREBASE CONFIG HERE ---
const firebaseConfig = {
    apiKey: "AIzaSyAUkGblKHSz1Ycx7VA93DVJ_P3J6tAUMVQ",
  authDomain: "e-panchayat-a32cb.firebaseapp.com",
  projectId: "e-panchayat-a32cb",
  storageBucket: "e-panchayat-a32cb.firebasestorage.app",
  messagingSenderId: "996175917140",
  appId: "1:996175917140:web:798c382e7807ccfb113dc1",
  measurementId: "G-E2YFVMD57C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;

// --- Helper Functions ---
const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
};

// --- Authentication ---
async function login() {
    const mobile = document.getElementById('login-mobile').value.trim();
    const code = document.getElementById('login-code').value.trim();
    
    try {
        const snapshot = await db.collection('users').where('mobile', '==', mobile).where('code', '==', code).get();
        
        if (!snapshot.empty) {
            currentUser = snapshot.docs[0].data();
            document.getElementById('login-mobile').value = '';
            document.getElementById('login-code').value = '';
            
            if (currentUser.role === 'admin') {
                switchView('admin-view');
                renderAdminDashboard();
            } else {
                switchView('villager-view');
                renderVillagerIssues();
            }
        } else {
            alert('Invalid Mobile Number or Access Code');
        }
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed. Check connection.");
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

    const uploadToFirebase = async (base64Data) => {
        try {
            await db.collection('issues').add({
                villagerName: currentUser.name,
                villagerMobile: currentUser.mobile,
                category: category,
                desc: desc,
                image: base64Data,
                status: 'new',
                timestamp: Date.now(),
                date: new Date().toLocaleDateString()
            });
            
            alert('Issue submitted successfully!');
            document.getElementById('issue-category').value = '';
            document.getElementById('issue-desc').value = '';
            document.getElementById('issue-img').value = '';
            renderVillagerIssues();
        } catch (error) {
            console.error("Upload Error:", error);
            alert("Submission failed.");
        }
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.readAsDataURL(fileInput.files[0]);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                uploadToFirebase(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    } else {
        uploadToFirebase(null);
    }
}

async function renderVillagerIssues() {
    const snapshot = await db.collection('issues').where('villagerMobile', '==', currentUser.mobile).get();
    let issues = snapshot.docs.map(doc => doc.data());
    issues.sort((a, b) => b.timestamp - a.timestamp);

    const list = document.getElementById('villager-issues-list');
    list.innerHTML = issues.map(issue => `
        <div class="list-item">
            <div class="list-item-header">
                <strong>${issue.category}</strong>
                <span class="badge ${issue.status}">${issue.status.toUpperCase()}</span>
            </div>
            <p>${issue.desc}</p>
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

async function generateCode() {
    const name = document.getElementById('new-villager-name').value.trim();
    const mobile = document.getElementById('new-villager-mobile').value.trim();
    if (!name || mobile.length < 10) {
        alert('Enter valid name and 10-digit mobile.');
        return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const snapshot = await db.collection('users').where('mobile', '==', mobile).get();
    if(!snapshot.empty) {
        await db.collection('users').doc(snapshot.docs[0].id).update({ code: code, name: name });
    } else {
        await db.collection('users').add({ name, mobile, code, role: 'villager', timestamp: Date.now() });
    }
    document.getElementById('new-villager-name').value = '';
    document.getElementById('new-villager-mobile').value = '';
    renderGeneratedCodes();
}

async function renderGeneratedCodes() {
    const snapshot = await db.collection('users').where('role', '==', 'villager').get();
    let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    users.sort((a, b) => b.timestamp - a.timestamp);
    const list = document.getElementById('generated-codes-list');
    list.innerHTML = users.map(u => `
        <div class="list-item" style="display:flex; justify-content:space-between; align-items:center;">
            <div><strong>${u.name}</strong><br><small>${u.mobile}</small></div>
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:var(--primary); color:white; padding:8px 15px; border-radius:8px; font-weight:bold;">${u.code}</div>
                <button onclick="deleteCode('${u.id}')" style="background:none; border:none; cursor:pointer; font-size:18px;">🗑️</button>
            </div>
        </div>
    `).join('') || '<p>No codes generated yet.</p>';
}

async function deleteCode(docId) {
    if (confirm("Delete this access code?")) {
        await db.collection('users').doc(docId).delete();
        renderGeneratedCodes();
    }
}

async function renderAdminDashboard() {
    const snapshot = await db.collection('issues').get();
    let issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    issues.sort((a, b) => b.timestamp - a.timestamp);
    
    document.getElementById('stat-new').innerText = issues.filter(i => i.status === 'new').length;
    document.getElementById('stat-process').innerText = issues.filter(i => i.status === 'process').length;
    document.getElementById('stat-resolved').innerText = issues.filter(i => i.status === 'resolved').length;

    const list = document.getElementById('admin-issues-list');
    list.innerHTML = issues.map(issue => `
        <div class="list-item">
            <div class="list-item-header">
                <strong>${issue.category}</strong>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="badge ${issue.status}">${issue.status.toUpperCase()}</span>
                    <button onclick="deleteIssue('${issue.id}')" style="background:none; border:none; cursor:pointer; font-size:18px;">🗑️</button>
                </div>
            </div>
            <p style="font-size: 14px; margin: 5px 0;"><strong>User:</strong> ${issue.villagerName} (${issue.villagerMobile})</p>
            <p>${issue.desc}</p>
            ${issue.image ? `<img src="${issue.image}" class="item-img">` : ''}
            <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                <span style="font-size:12px; margin-right:10px;">Update Status:</span>
                <button class="status-btn new" onclick="updateStatus('${issue.id}', 'new')">New</button>
                <button class="status-btn process" onclick="updateStatus('${issue.id}', 'process')">In Process</button>
                <button class="status-btn resolved" onclick="updateStatus('${issue.id}', 'resolved')">Resolved</button>
            </div>
        </div>
    `).join('') || '<p>No issues reported.</p>';
    renderGeneratedCodes();
}

async function updateStatus(issueId, newStatus) {
    try {
        await db.collection('issues').doc(issueId).update({ status: newStatus });
        renderAdminDashboard();
    } catch (error) {
        console.error("Update error:", error);
    }
}

// --- NEW FUNCTION: Delete Issue from Firebase ---
async function deleteIssue(docId) {
    if (confirm("Are you sure you want to permanently delete this issue report?")) {
        try {
            await db.collection('issues').doc(docId).delete();
            renderAdminDashboard(); // Refresh UI
            alert("Issue deleted.");
        } catch (error) {
            console.error("Delete issue error:", error);
            alert("Failed to delete issue.");
        }
    }
}
