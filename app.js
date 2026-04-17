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

// --- Initialize Database (Create Admin if missing) ---
async function initDB() {
    const adminRef = db.collection('users').doc('admin');
    const doc = await adminRef.get();
    if (!doc.exists) {
        await adminRef.set({ name: 'Admin', mobile: 'admin', code: 'admin123', role: 'admin' });
    }
}
initDB();

// --- Helper Functions ---
const switchView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
};

// --- Authentication ---
async function login() {
    const mobile = document.getElementById('login-mobile').value.trim();
    const code = document.getElementById('login-code').value.trim();
    
    // Search Firebase for user
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

    // Function to resize and upload
    const processAndUpload = async (base64Str) => {
        try {
            await db.collection('issues').add({
                villagerName: currentUser.name,
                villagerMobile: currentUser.mobile,
                category: category,
                desc: desc,
                image: base64Str, // This will now be a smaller version
                status: 'new',
                timestamp: Date.now(),
                date: new Date().toLocaleDateString()
            });
            
            alert('Issue Submitted successfully!');
            document.getElementById('issue-category').value = '';
            document.getElementById('issue-desc').value = '';
            document.getElementById('issue-img').value = '';
            renderVillagerIssues();
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Upload failed. Try a smaller photo or check your connection.");
        }
    };

    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.readAsDataURL(fileInput.files[0]);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                // --- IMAGE COMPRESSION LOGIC ---
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Limit width to 800px
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Convert to compressed JPEG (0.7 is 70% quality)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                processAndUpload(compressedBase64);
            };
        };
    } else {
        processAndUpload(null);
    }
}

async function renderVillagerIssues() {
    const snapshot = await db.collection('issues').where('villagerMobile', '==', currentUser.mobile).get();
    let issues = snapshot.docs.map(doc => doc.data());
    issues.sort((a, b) => b.timestamp - a.timestamp); // Sort newest first

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
        alert('Please enter a valid name and 10-digit mobile number.');
        return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if user exists in Firebase
    const snapshot = await db.collection('users').where('mobile', '==', mobile).get();
    
    if(!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        await db.collection('users').doc(docId).update({ code: code, name: name });
    } else {
        await db.collection('users').add({ name: name, mobile: mobile, code: code, role: 'villager', timestamp: Date.now() });
    }
    
    document.getElementById('new-villager-name').value = '';
    document.getElementById('new-villager-mobile').value = '';
    renderGeneratedCodes();
}

// --- Updated Admin Function to show a Delete Button ---
async function renderGeneratedCodes() {
    const snapshot = await db.collection('users').where('role', '==', 'villager').get();
    let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    users.sort((a, b) => b.timestamp - a.timestamp);

    const list = document.getElementById('generated-codes-list');
    list.innerHTML = users.map(u => `
        <div class="list-item" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${u.name}</strong><br>
                <small>${u.mobile}</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="background:var(--primary); color:white; padding:8px 15px; border-radius:8px; font-weight:bold; letter-spacing:2px;">
                    ${u.code}
                </div>
                <button onclick="deleteCode('${u.id}')" style="background:none; border:none; cursor:pointer; font-size:18px;" title="Delete Code">
                    🗑
                </button>
            </div>
        </div>
    `).join('') || '<p>No codes generated yet.</p>';
}

// --- New Function to Delete Code from Firebase ---
async function deleteCode(docId) {
    if (confirm("Are you sure you want to delete this access code? The villager will no longer be able to login.")) {
        try {
            await db.collection('users').doc(docId).delete();
            renderGeneratedCodes(); // Refresh the list
        } catch (error) {
            console.error("Error deleting code: ", error);
            alert("Failed to delete. Check your connection.");
        }
    }
}

// --- Updated Admin Dashboard to include Delete Button ---
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
                    <button onclick="deleteIssue('${issue.id}')" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Delete Issue">🗑</button>
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

// --- New Function to Delete an Issue from Firebase ---
async function deleteIssue(docId) {
    if (confirm("Are you sure you want to permanently delete this issue report?")) {
        try {
            await db.collection('issues').doc(docId).delete();
            renderAdminDashboard(); // Refresh the dashboard
            alert("Issue deleted successfully.");
        } catch (error) {
            console.error("Error deleting issue: ", error);
            alert("Failed to delete issue.");
        }
    }
}
    
    renderGeneratedCodes();
}

async function updateStatus(issueId, newStatus) {
    await db.collection('issues').doc(issueId).update({ status: newStatus });
    renderAdminDashboard();
}
