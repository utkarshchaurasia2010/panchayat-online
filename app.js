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
    appId: "1:996175917140:web:798c382e7807ccfb113dc1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;
let currentCoordinates = null; // Holds GPS data

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

// --- GEOLOCATION LOGIC ---
// Make sure this is NOT inside another function
function getLocation() {
    const btn = document.getElementById('geo-btn');
    const status = document.getElementById('location-status');

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    btn.innerText = "🛰️ Locating...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentCoordinates = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            btn.innerText = "✅ Location Captured";
            if (status) status.innerText = "Location added to report";
            console.log("GPS Success:", currentCoordinates);
        },
        (error) => {
            console.error(error);
            btn.innerText = "📍 Get My Current Location";
            alert("Location Error: Please ensure GPS is ON and you allowed permissions.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// --- UPDATED SUBMIT FUNCTION ---
async function submitIssue() {
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
                location: currentCoordinates, // This saves the GPS data
                status: 'new',
                timestamp: Date.now(),
                date: new Date().toLocaleDateString()
            });
            
            alert('Issue submitted successfully!');
            // Reset everything
            document.getElementById('issue-category').value = '';
            document.getElementById('issue-desc').value = '';
            document.getElementById('issue-img').value = '';
            currentCoordinates = null; 
            document.getElementById('geo-btn').innerText = "📍 Get My Current Location";
            renderVillagerIssues();
        } catch (error) {
            console.error("Upload error:", error);
            alert("Submission failed.");
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
    if (!name || mobile.length < 10) return alert('Enter valid details.');
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await db.collection('users').add({ name, mobile, code, role: 'villager', timestamp: Date.now() });
    renderGeneratedCodes();
}

async function renderGeneratedCodes() {
    const snapshot = await db.collection('users').where('role', '==', 'villager').get();
    let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const list = document.getElementById('generated-codes-list');
    list.innerHTML = users.map(u => `
        <div class="list-item" style="display:flex; justify-content:space-between;">
            <div><strong>${u.name}</strong><br><small>${u.mobile}</small></div>
            <button onclick="deleteCode('${u.id}')">🗑️</button>
        </div>
    `).join('');
}

async function deleteCode(id) {
    if (confirm("Delete user?")) {
        await db.collection('users').doc(id).delete();
        renderGeneratedCodes();
    }
}

async function renderAdminDashboard() {
    const snapshot = await db.collection('issues').get();
    let issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const list = document.getElementById('admin-issues-list');
    list.innerHTML = issues.map(issue => `
        <div class="list-item">
            <div class="list-item-header">
                <strong>${issue.category}</strong>
                <button onclick="deleteIssue('${issue.id}')">🗑️</button>
            </div>
            <p>${issue.desc}</p>
            ${issue.location ? `<a href="https://www.google.com/maps?q=${issue.location.lat},${issue.location.lng}" target="_blank">🗺️ View Map</a>` : ''}
            ${issue.image ? `<img src="${issue.image}" class="item-img">` : ''}
            <div>
                <button onclick="updateStatus('${issue.id}', 'process')">Process</button>
                <button onclick="updateStatus('${issue.id}', 'resolved')">Resolved</button>
            </div>
        </div>
    `).join('');
    renderGeneratedCodes();
}

async function updateStatus(id, status) {
    await db.collection('issues').doc(id).update({ status });
    renderAdminDashboard();
}

async function deleteIssue(id) {
    if (confirm("Delete issue?")) {
        await db.collection('issues').doc(id).delete();
        renderAdminDashboard();
    }
}
