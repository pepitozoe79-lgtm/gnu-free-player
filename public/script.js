// Curator Premium v2.0 - JWT Edition (Core Logic Completamente Restaurado)
let currentUser = null;
let authToken = localStorage.getItem('token');
let currentPath = null;
let allMediaItems = [];
let currentVideoId = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const appContainer = document.getElementById('appContainer');
const mainScroll = document.getElementById('mainScroll');
const heroSection = document.getElementById('heroSection');
const mediaHomeSection = document.querySelector('.content-wrapper');

// Views
const mediaGrid = document.getElementById('mediaGrid');
const continueGrid = document.getElementById('continueGrid');
const continueWatchingSection = document.getElementById('continueWatchingSection');
const fileManager = document.getElementById('fileManager');
const iptvSection = document.getElementById('iptvSection');
const adminPanel = document.getElementById('adminPanel');
const modal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');

// Placeholders
const PLACEHOLDER = 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=2659&auto=format&fit=crop';
const FOLDER_ICON = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'300\' viewBox=\'0 0 200 300\'%3E%3Crect width=\'200\' height=\'300\' fill=\'%23121212\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%235b8cff\' font-size=\'40\'%3E📁%3C/text%3E%3C/svg%3E';

// API Wrapper con JWT
async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (authToken) options.headers['Authorization'] = `Bearer ${authToken}`;
    
    const res = await fetch(url, options);
    if ((res.status === 401 || res.status === 403) && url !== '/api/login') {
        logout();
        throw new Error('Sesión expirada');
    }
    return res.json();
}

// --- AUTH ---
async function doLogin() {
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const errorDiv = document.getElementById('loginError');

    if (!username || !password) return errorDiv.innerText = "Completa todos los campos.";

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            loginScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            document.getElementById('currentUserText').innerText = currentUser.name;
            document.getElementById('userAvatar').innerText = currentUser.name.charAt(0).toUpperCase();
            if (currentUser.role === 'admin') document.getElementById('adminDropdownOptions').classList.remove('hidden');
            else document.getElementById('adminDropdownOptions').classList.add('hidden');
            showHome();
        } else {
            errorDiv.innerText = data.error;
        }
    } catch (e) {
        errorDiv.innerText = "Error de conexión con el servidor.";
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.reload();
}

// Inicializar si ya hay token
if (authToken && localStorage.getItem('user')) {
    currentUser = JSON.parse(localStorage.getItem('user'));
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
    document.getElementById('currentUserText').innerText = currentUser.name;
    document.getElementById('userAvatar').innerText = currentUser.name.charAt(0).toUpperCase();
    if (currentUser.role === 'admin') document.getElementById('adminDropdownOptions').classList.remove('hidden');
    else document.getElementById('adminDropdownOptions').classList.add('hidden');
    showHome();
}

// --- NAVIGATION ---
function hideAll() {
    heroSection.classList.add('hidden');
    continueWatchingSection.classList.add('hidden');
    mediaGrid.parentElement.classList.add('hidden');
    fileManager.classList.add('hidden');
    iptvSection.classList.add('hidden');
    adminPanel.classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('breadcrumbs').innerHTML = '';
}

function showHome() {
    hideAll();
    heroSection.classList.remove('hidden');
    continueWatchingSection.classList.remove('hidden');
    mediaGrid.parentElement.classList.remove('hidden');
    document.getElementById('navHome').classList.add('active');
    document.getElementById('libraryTitle').innerText = "Recientemente Añadidos";
    currentPath = null;
    loadLibrary();
    loadContinueWatching();
}

function loadCategory(folder) {
    hideAll();
    mediaGrid.parentElement.classList.remove('hidden');
    document.getElementById(`nav${folder}`).classList.add('active');
    document.getElementById('libraryTitle').innerText = folder;
    loadLibrary(`media/${folder}`);
}

function toggleView() {
    hideAll();
    fileManager.classList.remove('hidden');
    document.getElementById('navFiles').classList.add('active');
    loadFilesList();
}

function showIPTV() {
    hideAll();
    iptvSection.classList.remove('hidden');
    document.getElementById('navIPTV').classList.add('active');
    loadIPTVChannels();
}

function showAdmin() {
    hideAll();
    adminPanel.classList.remove('hidden');
    document.getElementById('navAdmin').classList.add('active');
    if (currentUser.role === 'admin') loadUsersList();
}

// --- LIBRERÍA ---
async function loadLibrary(path = null) {
    currentPath = path;
    let url = '/api/browse';
    if (path) url += `?path=${encodeURIComponent(path)}`;
    
    try {
        const items = await apiFetch(url);
        allMediaItems = items;
        
        if (!path) updateHero(items[0]);
        else if (path.includes('/')) updateBreadcrumbs(path);

        renderMediaGrid(items);
    } catch (e) { console.error("Error cargando librería", e); }
}

function renderMediaGrid(items) {
    mediaGrid.innerHTML = '';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'media-card';
        const title = formatTitle(item.name);
        const poster = item.poster || (item.type === 'folder' ? FOLDER_ICON : PLACEHOLDER);

        // Agregamos el Token JWT a la imagen para que el src salte el Auth
        const imgSrc = poster.startsWith('/media') ? `${poster}?token=${authToken}` : poster;

        card.innerHTML = `
            <div class="card-img-container">
                <img src="${imgSrc}" onerror="this.src='${PLACEHOLDER}'">
            </div>
            <div class="card-info">
                <div class="card-title">${title}</div>
                <div class="card-meta">${item.type === 'folder' ? 'Colección' : 'Video'}</div>
            </div>
        `;
        card.onclick = () => {
            if (item.type === 'folder') loadLibrary(item.path);
            else playMedia(item.path, title, item.hasSubtitles, imgSrc);
        };
        mediaGrid.appendChild(card);
    });
}

function updateHero(item) {
    if (!item) return;
    const heroTitle = document.getElementById('heroTitle');
    const heroBg = document.getElementById('heroBg');
    const heroTag = document.getElementById('heroTag');
    const niceTitle = formatTitle(item.name);

    heroTitle.innerText = niceTitle;
    heroTag.innerText = item.type === 'folder' ? 'Colección Destacada' : 'Recomendado';
    if (item.poster) {
        const bgSrc = item.poster.startsWith('/media') ? `${item.poster}?token=${authToken}` : item.poster;
        heroBg.style.backgroundImage = `url('${bgSrc}')`;
    }
    
    document.getElementById('heroPlayBtn').onclick = () => {
        if (item.type === 'video') {
            const posterSrc = item.poster ? (item.poster.startsWith('/media') ? `${item.poster}?token=${authToken}` : item.poster) : "";
            playMedia(item.path, niceTitle, item.hasSubtitles, posterSrc);
        }
        else loadLibrary(item.path);
    };
}

// --- CONTINUE WATCHING ---
function loadContinueWatching() {
    continueGrid.innerHTML = '';
    let hasProgress = false;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('progress_')) {
            const rawId = key.split('progress_')[1];
            let path = "";
            try { path = atob(rawId); } catch(e) { continue; }

            const info = JSON.parse(localStorage.getItem(key));
            const pct = (info.time / info.total) * 100;
            if (pct < 1 || pct > 98) continue;

            hasProgress = true;
            const title = formatTitle(path.split(/[\\/]/).pop());
            const card = document.createElement('div');
            card.className = 'media-card';
            card.innerHTML = `
                <div class="card-img-container">
                    <img src="${info.poster || PLACEHOLDER}" onerror="this.src='${PLACEHOLDER}'">
                    <div class="progress-container">
                        <div class="progress-bar" style="width: ${pct}%"></div>
                    </div>
                </div>
                <div class="card-info">
                    <div class="card-title">${title}</div>
                    <div class="card-meta">${Math.round(pct)}% Completado</div>
                </div>
            `;
            card.onclick = () => playMedia(path, title, false, info.poster);
            continueGrid.appendChild(card);
        }
    }
    continueWatchingSection.style.display = hasProgress ? 'block' : 'none';
}

// --- PLAYER ---
function playMedia(path, title, hasSubs, poster) {
    currentVideoId = btoa(path);
    document.getElementById('videoSource').src = `/stream?path=${encodeURIComponent(path)}&token=${authToken}`;
    document.getElementById('subtitleTrack').src = hasSubs ? `/subs?path=${encodeURIComponent(path)}&token=${authToken}` : '';
    document.getElementById('currentVideoTitle').innerText = title;
    
    videoPlayer.dataset.poster = poster || '';
    modal.style.display = 'flex';
    videoPlayer.load();
    
    // Recuperar progreso
    const saved = localStorage.getItem('progress_' + currentVideoId);
    if (saved) {
        const info = JSON.parse(saved);
        videoPlayer.currentTime = info.time;
    }
    
    videoPlayer.play();
}

function closePlayer() {
    if (currentVideoId && videoPlayer.duration) {
        const info = {
            time: videoPlayer.currentTime,
            total: videoPlayer.duration,
            poster: videoPlayer.dataset.poster
        };
        localStorage.setItem('progress_' + currentVideoId, JSON.stringify(info));
    }
    modal.style.display = 'none';
    videoPlayer.pause();
    loadContinueWatching();
}

// --- UTILS ---
function formatTitle(name) {
    if (!name) return "";
    let clean = name.replace(/\.[^/.]+$/, "").replace(/[\._]/g, ' ');
    return clean.replace(/\b\w/g, l => l.toUpperCase());
}

function updateBreadcrumbs(fullPath) {
    const container = document.getElementById('breadcrumbs');
    container.innerHTML = '<span style="cursor:pointer" onclick="showHome()">Inicio</span>';
    const parts = fullPath.split(/[\\/]/).filter(p => p !== 'media');
    let currentAcc = 'media';
    parts.forEach(p => {
        currentAcc += '/' + p;
        const s = document.createElement('span');
        s.innerHTML = ` <i class="fas fa-chevron-right" style="font-size:0.7rem"></i> ${formatTitle(p)}`;
        s.style.cursor = 'pointer';
        const capturePath = currentAcc;
        s.onclick = () => loadLibrary(capturePath);
        container.appendChild(s);
    });
}

function searchMedia() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allMediaItems.filter(i => i.name.toLowerCase().includes(term));
    renderMediaGrid(filtered);
}

// Event Listeners
window.onclick = (e) => { if (e.target == modal) closePlayer(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePlayer(); });

// --- GESTOR DE ARCHIVOS ---
async function loadFilesList(dirPath = null) {
    currentPath = dirPath;
    let url = '/api/files';
    if (dirPath) url += `?path=${encodeURIComponent(dirPath)}`;
    const items = await apiFetch(url);
    
    const tbody = document.getElementById('fileListBody');
    tbody.innerHTML = '';
    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        tr.innerHTML = `
            <td style="padding: 1rem; cursor: ${item.type === 'folder' ? 'pointer': 'default'}" onclick="if('${item.type}'==='folder') loadFilesList('${item.path.replace(/\\/g, '/')}')">
                ${item.type === 'folder' ? '📁' : '📄'} ${item.name}
            </td>
            <td style="padding: 1rem;">${item.size}</td>
            <td style="padding: 1rem;">
                ${item.type === 'file' ? `
                    <button class="btn-action red" onclick="deleteFile('${item.path}')"><i class="fas fa-trash"></i> Eliminar</button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function uploadFile() {
    const input = document.getElementById('fileInput');
    if (input.files.length === 0) return alert('Selecciona archivos');
    const formData = new FormData();
    for (let f of input.files) formData.append('file', f);
    if (currentPath) formData.append('path', currentPath);

    document.getElementById('uploadProgressContainer').classList.remove('hidden');
    const bar = document.getElementById('uploadProgressBar');
    
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            bar.style.width = pct + '%';
            document.getElementById('uploadPercentageText').innerText = pct + '%';
        }
    };
    xhr.onload = () => {
        if(xhr.status === 200) {
            document.getElementById('uploadStatusText').innerText = '¡Completado!';
            setTimeout(() => { 
                document.getElementById('uploadProgressContainer').classList.add('hidden');
                loadFilesList(currentPath);
            }, 2000);
        }
    };
    xhr.open('POST', '/api/upload', true);
    if(authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.send(formData);
}

async function deleteFile(path) {
    if(!confirm('¿Seguro que deseas eliminar este archivo?')) return;
    await fetch('/api/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ path })
    });
    loadFilesList(currentPath);
}

// --- ADMIN / USUARIOS ---
async function changePassword() {
    const newPwd = prompt("Introduce tu nueva contraseña (mínimo 4 caracteres):");
    if (!newPwd) return;
    
    try {
        const res = await apiFetch('/api/users/change-password', {
            method: 'POST',
            body: JSON.stringify({ newPassword: newPwd }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.error) return alert("Error: " + res.error);
        
        alert("Contraseña actualizada correctamente. Por favor, inicia sesión nuevamente.");
        logout();
    } catch (e) {
        alert("Error de conexión al cambiar la contraseña.");
    }
}

async function loadUsersList() {
    const users = await apiFetch('/api/users');
    const list = document.getElementById('usersList');
    list.innerHTML = '';
    users.forEach(u => {
        const li = document.createElement('li');
        li.style.padding = '1rem';
        li.style.background = 'rgba(255,255,255,0.05)';
        li.style.borderRadius = '12px';
        li.style.marginBottom = '0.5rem';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        
        li.innerHTML = `<span>${u.name} (@${u.username}) - ${u.role.toUpperCase()}</span>`;
        if (u.username !== 'admin') {
            const btn = document.createElement('button');
            btn.className = 'btn-action red';
            btn.innerHTML = '<i class="fas fa-trash"></i> Eliminar';
            btn.onclick = () => deleteUser(u.id);
            li.appendChild(btn);
        }
        list.appendChild(li);
    });
}

async function createUser() {
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    const name = document.getElementById('newName').value;
    
    if (!username || !password || !name) return alert('Completa todos los campos');
    
    try {
        const res = await apiFetch('/api/users', {
            method: 'POST',
            body: JSON.stringify({ username, password, role, name }),
            headers: { 'Content-Type': 'application/json' }
        });
        if (res.error) return alert('Error del servidor: ' + res.error);
        
        alert('Usuario creado exitosamente');
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newName').value = '';
        loadUsersList();
    } catch (e) {
        alert('Error de conexión');
    }
}

async function deleteUser(id) {
    if(!confirm('¿Seguro que deseas eliminar a este usuario?')) return;
    try {
        const res = await apiFetch('/api/users/' + id, { method: 'DELETE' });
        if (res.error) return alert(res.error);
        loadUsersList();
    } catch (e) {
        alert('Error al eliminar');
    }
}

// --- IPTV ---
async function loadIPTVChannels() {
    const data = await apiFetch('/api/iptv/channels');
    const container = document.getElementById('iptvGrid');
    container.innerHTML = '';
    
    if (data.channels && data.channels.length > 0) {
        data.channels.forEach(ch => {
            const card = document.createElement('div');
            card.className = 'media-card';
            card.innerHTML = `
                <div class="card-img-container" style="background: var(--glass); display: flex; align-items: center; justify-content: center; padding: 20px;">
                    <img src="${ch.logo}" style="object-fit: contain; max-height: 100px;" onerror="this.src='https://via.placeholder.com/150/1a1a2e/ffffff?text=TV'">
                </div>
                <div class="card-info">
                    <div class="card-title">${ch.name}</div>
                    <div class="card-meta">Live TV</div>
                </div>
            `;
            // IPTV suele ser m3u8 y no usar tokens directamente al remoto
            card.onclick = () => playMedia(ch.url, ch.name, false, ch.logo);
            container.appendChild(card);
        });
    } else {
        container.innerHTML = '<p>No hay canales configurados. Guarda tu archivo M3U arriba.</p>';
    }
}

async function configIPTV() {
    const url = document.getElementById('iptvUrl').value;
    if (!url) return alert('Pega una URL válida');
    try {
        const res = await fetch('/api/iptv/config', {
            method: 'POST',
            body: JSON.stringify({ url }),
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (data.error) return alert('Error del servidor: ' + data.error);
        
        loadIPTVChannels();
        alert('Configuración guardada con éxito, canales listos!');
    } catch (e) {
        alert('Error crítico de guardado');
    }
}

async function uploadGlobalFile() {
    const input = document.getElementById('globalFileInput');
    if (input.files.length === 0) return;
    
    const formData = new FormData();
    for (let f of input.files) formData.append('file', f);
    if (currentPath) formData.append('path', currentPath);

    document.getElementById('toastUpload').classList.remove('hidden');
    const bar = document.getElementById('toastUploadBar');
    const pctText = document.getElementById('toastUploadPct');
    const statusText = document.getElementById('toastUploadText');
    statusText.innerText = 'Subiendo...';
    
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            bar.style.width = pct + '%';
            pctText.innerText = pct + '%';
        }
    };
    xhr.onload = () => {
        if(xhr.status === 200) {
            statusText.innerText = '¡Completado!';
            setTimeout(() => { 
                document.getElementById('toastUpload').classList.add('hidden');
                bar.style.width = '0%';
                if (!document.getElementById('mediaGrid').parentElement.classList.contains('hidden')) {
                    loadLibrary(currentPath);
                } else if (!document.getElementById('fileManager').classList.contains('hidden')) {
                    loadFilesList(currentPath);
                }
            }, 2000);
        } else {
            statusText.innerText = 'Error al subir';
            setTimeout(() => document.getElementById('toastUpload').classList.add('hidden'), 3000);
        }
        input.value = '';
    };
    xhr.open('POST', '/api/upload', true);
    if(authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.send(formData);
}

async function rebootServerMenu() {
    if(!confirm('¿Seguro que deseas reiniciar el sistema operativo del Servidor? Tomará unos instantes.')) return;
    try {
        apiFetch('/api/admin/reboot', { method: 'POST' });
        alert('Reiniciando servidor... La página perderá conexión en breve.');
    } catch(e) {}
}

async function poweroffServerMenu() {
    if(!confirm('¡PELIGRO EXTREMO! ¿Seguro que deseas APAGAR físicamente la computadora/servidor? Perderás el acceso y tendrás que encenderla manualmente.')) return;
    try {
        apiFetch('/api/admin/poweroff', { method: 'POST' });
        alert('Apagando sistema de inmediato...');
    } catch(e) {}
}

let lastScrollTop = 0;
document.getElementById('mainScroll').addEventListener('scroll', () => {
    let st = document.getElementById('mainScroll').scrollTop;
    if (st > lastScrollTop && st > 80) {
        document.querySelector('.topbar').style.transform = 'translateY(-150%)';
        document.getElementById('userDropdown').classList.add('hidden');
    } else {
        document.querySelector('.topbar').style.transform = 'translateY(0)';
    }
    lastScrollTop = st;
});

