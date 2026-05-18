// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
        console.log('Service Worker Registered');
    });
}

// --- 1. PASTE YOUR ACTUAL FIREBASE CONFIG KEYS HERE ---
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
let adminIssuesList = []; // This stores issues so the modal can access them

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
        alert("Login failed. Check your internet.");
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
            alert("Upload failed.");
        }
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.readAsDataURL(fileInput.files[0]);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scale = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scale;
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
            ${issue.image ? `<img src="${issue.image}" class="item-img">` : ''}
        </div>
    `).join('') || '<p>No issues reported.</p>';
}

// --- Admin Functions ---
function toggleAdminSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
}

async function generateCode() {
    const name = document.getElementById('new-villager-name').value.trim();
    const mobile = document.getElementById('new-villager-mobile').value.trim();
    // 1. Grab the new Aadhaar value
    const aadhaar = document.getElementById('new-villager-aadhaar').value.trim(); 
    
    // 2. Validate all three fields (making sure Aadhaar is 12 digits)
    if (!name || mobile.length < 10 || aadhaar.length !== 12) {
        alert('Please enter a valid name, 10-digit mobile, and 12-digit Aadhaar number.');
        return;
    }
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 3. Save the new aadhaar variable to the database
    await db.collection('users').add({ 
        name: name, 
        mobile: mobile, 
        aadhaar: aadhaar, // Saves the ID to Firestore
        code: code, 
        role: 'villager', 
        timestamp: Date.now() 
    });
    
    // 4. Clear the form after saving
    document.getElementById('new-villager-name').value = '';
    document.getElementById('new-villager-mobile').value = '';
    document.getElementById('new-villager-aadhaar').value = '';
    
    renderGeneratedCodes();
}
async function renderGeneratedCodes() {
    const snapshot = await db.collection('users').where('role', '==', 'villager').get();
    let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort so newest codes appear at the top
    users.sort((a, b) => b.timestamp - a.timestamp);
    
    const list = document.getElementById('generated-codes-list');
    list.innerHTML = users.map(u => `
        <div class="code-card-new">
            <div class="code-card-left">
                <span class="code-card-name">${u.name}</span>
                <span class="code-card-phone">${u.mobile}</span>
                <span class="code-card-phone">Aadhaar: <strong style="color: #555;">${u.aadhaar ? u.aadhaar : 'N/A'}</strong></span>
            </div>
            <div class="code-card-right">
                <div class="code-badge-new">${u.code}</div>
                <button onclick="deleteCode('${u.id}')" style="background:none; border:none; cursor:pointer; padding:5px; display:flex;">
                    <span class="material-symbols-outlined" style="color: #999; font-size: 22px; transition: color 0.2s;" onmouseover="this.style.color='#f44336'" onmouseout="this.style.color='#999'">delete</span>
                </button>
            </div>
        </div>
    `).join('') || '<p style="text-align:center; color:#888; font-size: 14px;">No codes generated yet.</p>';
}
async function deleteCode(id) {
    if (confirm("Delete this user?")) {
        await db.collection('users').doc(id).delete();
        renderGeneratedCodes();
    }
}
async function renderAdminDashboard() {
    const snapshot = await db.collection('issues').get();
     // Save to global array so the modal can find the data without reloading
    adminIssuesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    adminIssuesList.sort((a, b) => b.timestamp - a.timestamp);
    
    const list = document.getElementById('admin-issues-list');
    
    // Draw simple, clean clickable cards
    list.innerHTML = adminIssuesList.map(issue => `
        <div class="list-item clickable-card" onclick="openIssueModal('${issue.id}')">
            <div class="list-item-header">
                <strong style="font-size: 16px;">${issue.category}</strong>
                <span class="badge ${issue.status}">${issue.status.toUpperCase()}</span>
            </div>
            <p style="color: #666; font-size: 13px; margin: 5px 0;"><strong>Submitted by:</strong> ${issue.villagerName}</p>
        </div>
    `).join('') || '<p style="text-align:center; color:#888;">No issues reported.</p>';
    
    renderGeneratedCodes();
}

// --- NEW MODAL FUNCTIONS ---
function openIssueModal(id) {
    const issue = adminIssuesList.find(i => i.id === id);
    if (!issue) return;
    
    const modalBody = document.getElementById('modal-body');
    
    // Build the inside of the modal
    modalBody.innerHTML = `
        <div class="modal-title">${issue.category} Issue</div>
        
        <div class="modal-section">
            <span class="modal-label">Submitted by</span>
            <span class="modal-value">${issue.villagerName} <br><small style="color:#666;">(${issue.villagerMobile})</small></span>
        </div>
        
        <div class="modal-section">
            <span class="modal-label">Category</span>
            <span class="modal-value">${issue.category}</span>
        </div>
        
        <div class="modal-section">
            <span class="modal-label">Description</span>
            <span class="modal-value">${issue.desc}</span>
        </div>
        
        ${issue.image ? `
        <div class="modal-section">
            <span class="modal-label">Attached Photo</span>
            <img src="${issue.image}" style="max-width: 100%; border-radius: 12px; margin-top: 8px;">
        </div>` : ''}
        
        <div class="modal-section">
            <span class="modal-label">Update Status</span>
            <div class="status-toggle-group">
                <button class="status-toggle-btn ${issue.status === 'new' ? 'active new' : ''}" onclick="updateStatusFromModal('${issue.id}', 'new')">New</button>
                <button class="status-toggle-btn ${issue.status === 'process' ? 'active process' : ''}" onclick="updateStatusFromModal('${issue.id}', 'process')">In Process</button>
                <button class="status-toggle-btn ${issue.status === 'resolved' ? 'active resolved' : ''}" onclick="updateStatusFromModal('${issue.id}', 'resolved')">Resolved</button>
            </div>
        </div>

        <div class="modal-section" style="margin-top: 25px; border-top: 1px solid #eee; padding-top: 20px;">
            <button onclick="deleteIssue('${issue.id}'); closeIssueModal();" style="background: none; border: none; color: #f44336; font-weight: bold; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 100%; gap: 5px;">
                <span class="material-symbols-outlined">delete</span> Delete Issue Record
            </button>
        </div>
    `;
    
    document.getElementById('issue-modal').classList.remove('hidden');
}

function closeIssueModal() {
    document.getElementById('issue-modal').classList.add('hidden');
}

async function updateStatusFromModal(id, status) {
    await updateStatus(id, status);
    openIssueModal(id); // Instantly re-draws the modal so the color changes to active
}

async function updateStatus(id, status) {
    await db.collection('issues').doc(id).update({ status });
    await renderAdminDashboard(); // Refresh the background list
}

async function deleteIssue(id) {
    if (confirm("Are you sure you want to permanently delete this issue?")) {
        await db.collection('issues').doc(id).delete();
        await renderAdminDashboard();
    }
}
