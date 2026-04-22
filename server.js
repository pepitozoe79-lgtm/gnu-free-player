require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const fileUpload = require('express-fileupload');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-enterprise-secret-key-2024';

// ==============================================
// 🔒 CONFIGURACIÓN DE SEGURIDAD
// ==============================================
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutos
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map();
const fileLocks = new Map();

// Rutas absolutas
const MEDIA_FOLDER = path.resolve(__dirname, 'media');
const USERS_FILE = path.join(__dirname, 'users.json');
const IPTV_FILE = path.join(__dirname, 'iptv.json');

// Middleware de Autenticación JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
        req.user = user;
        next();
    });
}

// ==============================================
// 📂 INICIALIZACIÓN
// ==============================================
function initializeApp() {
    if (!fs.existsSync(MEDIA_FOLDER)) {
        fs.mkdirSync(MEDIA_FOLDER, { recursive: true });
    }
    ['Peliculas', 'Series', 'Musica'].forEach(folder => {
        const folderPath = path.join(MEDIA_FOLDER, folder);
        if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
    });
    if (!fs.existsSync(USERS_FILE)) {
        const defaultUsers = [{
            id: 1,
            username: "admin",
            password: bcrypt.hashSync("admin123", 10),
            role: "admin",
            name: "Administrador"
        }];
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    }
}
initializeApp();

// ==============================================
// 🔧 UTILIDADES
// ==============================================
async function withFileLock(filePath, operation) {
    while (fileLocks.get(filePath)) await new Promise(r => setTimeout(r, 50));
    fileLocks.set(filePath, true);
    try { return await operation(); } finally { fileLocks.delete(filePath); }
}

function validatePath(inputPath) {
    try {
        const decodedPath = decodeURIComponent(inputPath);
        const resolvedPath = path.resolve(decodedPath);
        if (!resolvedPath.startsWith(path.resolve(MEDIA_FOLDER))) return null;
        return resolvedPath;
    } catch (e) { return null; }
}

function checkRateLimit(username) {
    const now = Date.now();
    const attempts = loginAttempts.get(username) || { count: 0, firstAttempt: now };
    if (now - attempts.firstAttempt > RATE_LIMIT_WINDOW) {
        attempts.count = 1; attempts.firstAttempt = now;
    } else {
        attempts.count++;
    }
    loginAttempts.set(username, attempts);
    if (attempts.count > MAX_LOGIN_ATTEMPTS) return { allowed: false };
    return { allowed: true };
}

// ==============================================
// MIDDLEWARES
// ==============================================
app.use(cors());
app.use(express.json());
app.use(fileUpload({ 
    limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10GB Max
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));
app.use(express.static('public'));
app.use('/media', authenticateToken, express.static(MEDIA_FOLDER));

// ==============================================
// 🔐 RUTAS PÚBLICAS
// ==============================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!checkRateLimit(username).allowed) return res.status(429).json({ error: 'Demasiados intentos.' });

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const user = users.find(u => u.username === username);

    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    bcrypt.compare(password, user.password, (err, match) => {
        if (match) {
            loginAttempts.delete(username);
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            const { password, ...safeUser } = user;
            res.json({ success: true, token, user: safeUser });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    });
});

// ==============================================
// 🔐 RUTAS PROTEGIDAS
// ==============================================
app.get('/api/browse', authenticateToken, (req, res) => {
    const rawPath = req.query.path ? decodeURIComponent(req.query.path) : MEDIA_FOLDER;
    const dirPath = validatePath(rawPath);
    if (!dirPath) return res.status(403).json({ error: 'Acceso denegado' });

    fs.readdir(dirPath, { withFileTypes: true }, (err, list) => {
        if (err) return res.status(500).json({ error: err.message });
        let pending = list.length;
        if (!pending) return res.json([]);
        let results = [];
        list.forEach(item => {
            const fullPath = path.join(dirPath, item.name);
            const relPath = path.relative(MEDIA_FOLDER, fullPath).replace(/\\/g, '/');
            fs.stat(fullPath, (err, stat) => {
                if (!err) {
                    if (stat.isDirectory()) {
                        results.push({ name: item.name, type: 'folder', path: fullPath, poster: getPoster(fullPath, relPath) });
                    } else if (isVideo(item.name)) {
                        results.push({ name: path.parse(item.name).name, type: 'video', path: fullPath, poster: getPoster(path.dirname(fullPath), path.relative(MEDIA_FOLDER, path.dirname(fullPath)).replace(/\\/g, '/')) });
                    }
                }
                if (!--pending) res.json(results);
            });
        });
    });
});

function getPoster(folder, rel) {
    const p = ['poster.jpg', 'poster.png', 'folder.jpg', 'cover.jpg'].find(f => fs.existsSync(path.join(folder, f)));
    return p ? `/media/${rel}/${p}` : null;
}
function isVideo(f) { return ['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(path.extname(f).toLowerCase()); }

app.get('/stream', authenticateToken, (req, res) => {
    const filePath = validatePath(req.query.path);
    if (!filePath) return res.status(403).send('Denegado');
    const range = req.headers.range;
    const size = fs.statSync(filePath).size;
    if (range) {
        const [start, end] = range.replace(/bytes=/, "").split("-").map(Number);
        const realEnd = end || size - 1;
        res.writeHead(206, { 'Content-Range': `bytes ${start}-${realEnd}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': (realEnd - start) + 1, 'Content-Type': 'video/mp4' });
        fs.createReadStream(filePath, { start, end: realEnd }).pipe(res);
    } else {
        res.writeHead(200, { 'Content-Length': size, 'Content-Type': 'video/mp4' });
        fs.createReadStream(filePath).pipe(res);
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')).map(({password, ...u}) => u);
    res.json(users);
});

app.get('/api/files', authenticateToken, (req, res) => {
    const rawPath = req.query.path ? decodeURIComponent(req.query.path) : MEDIA_FOLDER;
    const dirPath = validatePath(rawPath);
    if (!dirPath) return res.status(403).json({ error: 'Acceso denegado' });

    fs.readdir(dirPath, { withFileTypes: true }, (err, items) => {
        if (err) return res.status(500).json({ error: err.message });
        const result = items.map(item => {
            const fullPath = path.join(dirPath, item.name);
            let size = '--';
            if (!item.isDirectory()) {
                try { size = formatSize(fs.statSync(fullPath).size); } catch(e){}
            }
            return {
                name: item.name,
                type: item.isDirectory() ? 'folder' : 'file',
                path: fullPath,
                size: size
            };
        });
        res.json(result);
    });
});

app.post('/api/upload', authenticateToken, (req, res) => {
    const rawDest = req.body.path ? decodeURIComponent(req.body.path) : MEDIA_FOLDER;
    const dest = validatePath(rawDest);
    
    if (!dest) return res.status(403).json({ error: 'Acceso denegado' });
    if (!req.files || !req.files.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    let uploadedFiles = req.files.file;
    if (!Array.isArray(uploadedFiles)) uploadedFiles = [uploadedFiles];

    let errors = [];
    let processed = 0;

    uploadedFiles.forEach(file => {
        if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
            errors.push('Nombre inválido: ' + file.name);
            processed++;
            if (processed === uploadedFiles.length) finalize();
            return;
        }

        const uploadPath = path.join(dest, file.name);
        file.mv(uploadPath, (err) => {
            if (err) errors.push(err.message);
            processed++;
            if (processed === uploadedFiles.length) finalize();
        });
    });

    function finalize() {
        if (errors.length > 0) return res.status(500).json({ error: errors.join(', ') });
        res.json({ success: true });
    }
});

app.delete('/api/delete', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const filePath = validatePath(req.body.path);
    if (!filePath) return res.status(403).json({ error: 'Ruta no válida' });

    fs.unlink(filePath, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/iptv/config', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL es requerida' });
    
    try {
        await withFileLock(IPTV_FILE, async () => {
            fs.writeFileSync(IPTV_FILE, JSON.stringify({ url }, null, 2));
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/iptv/channels', authenticateToken, (req, res) => {
    if (!fs.existsSync(IPTV_FILE)) return res.json({ channels: [] });
    try {
        const config = JSON.parse(fs.readFileSync(IPTV_FILE, 'utf8'));
        const listUrl = config.url;
        if (!listUrl) return res.json({ channels: [] });

        if (listUrl.startsWith('http')) {
            const lib = listUrl.startsWith('https') ? require('https') : require('http');
            const request = lib.get(listUrl, (response) => {
                if (response.statusCode !== 200) return res.json({ channels: [] });
                let data = '';
                response.setEncoding('utf8');
                response.on('data', chunk => data += chunk);
                response.on('end', () => res.json({ channels: parseM3U(data) }));
            });
            request.on('error', () => res.json({ channels: [] }));
            request.setTimeout(10000, () => { request.destroy(); res.json({ channels: [] }); });
        } else {
            const localPath = listUrl.replace('file://', '');
            if (fs.existsSync(localPath)) res.json({ channels: parseM3U(fs.readFileSync(localPath, 'utf8')) });
            else res.json({ channels: [] });
        }
    } catch (e) { res.json({ channels: [] }); }
});

function parseM3U(content) {
    const lines = content.split('\n');
    const channels = [];
    let currentChannel = {};

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF:')) {
            const nameMatch = line.match(/,(.*)$/);
            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            currentChannel.name = nameMatch ? nameMatch[1].trim() : 'Canal';
            currentChannel.logo = logoMatch ? logoMatch[1] : 'https://via.placeholder.com/40/1a1a2e/ffffff?text=TV';
        } else if (line && !line.startsWith('#')) {
            currentChannel.url = line;
            if (currentChannel.url) channels.push({ ...currentChannel });
            currentChannel = {};
        }
    });
    return channels;
}

app.post('/api/admin/update', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const updateScript = path.join(__dirname, 'update.sh');
    if (!fs.existsSync(updateScript)) return res.status(404).json({ error: 'Script no encontrado' });
    
    exec('bash update.sh', (error, stdout) => {
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, output: stdout });
    });
});

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

app.post('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { username, password, role, name } = req.body;
    try {
        await withFileLock(USERS_FILE, async () => {
            const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            if (users.find(u => u.username === username)) throw new Error('El usuario ya existe');
            users.push({ id: Date.now(), username, password: bcrypt.hashSync(password, 10), role, name });
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        });
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const userId = parseInt(req.params.id);
    try {
        await withFileLock(USERS_FILE, async () => {
            let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            users = users.filter(u => u.id !== userId);
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        });
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/admin/reboot', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    exec('sudo reboot', (error) => {
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    });
});

app.post('/api/users/change-password', authenticateToken, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    
    try {
        await withFileLock(USERS_FILE, async () => {
            const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            const uIndex = users.findIndex(u => u.id === req.user.id);
            if (uIndex === -1) throw new Error('Usuario no encontrado');
            
            users[uIndex].password = bcrypt.hashSync(newPassword, 10);
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/poweroff', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    exec('sudo poweroff', (error) => {
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MyMediaServer v2.0.0 PRO operando en puerto ${PORT}`);
});
