const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD before starting the server.');
const adminSessions = new Map();
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const userIdFrom = (req) => {
    const match = (req.headers.cookie || '').match(/(?:^|;\s*)userId=([a-f0-9]{32})(?:;|$)/);
    return match ? match[1] : null;
};
const isAdminRequest = (req) => {
    const match = (req.headers.cookie || '').match(/(?:^|;\s*)adminSession=([a-f0-9]{64})(?:;|$)/);
    if (!match) return false;
    const expires = adminSessions.get(match[1]);
    if (!expires || expires <= Date.now()) { adminSessions.delete(match[1]); return false; }
    return true;
};
const validText = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 150;
app.use((req, res, next) => {
    if (req.method === 'POST' && req.headers.origin) {
        try {
            if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).send('Invalid origin');
        } catch { return res.status(403).send('Invalid origin'); }
    }
    next();
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// База данных
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ candidates: [], users: {}, voteLog: [] }));
}
const getData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const saveData = (data) => {
    const temp = DATA_FILE + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(data));
    fs.renameSync(temp, DATA_FILE);
};

// ==========================================
// ГЛАВНАЯ СТРАНИЦА (ТОЛЬКО ДЛЯ СТУДЕНТОВ)
// ==========================================
app.get('/', (req, res) => {
    const data = getData();
    
    // Ищем куку пользователя
    let userId = userIdFrom(req);
    
    // Если куки нет, создаем уникальный ID для этого браузера
    if (!userId) {
        userId = crypto.randomBytes(16).toString('hex');
        res.cookie('userId', userId, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 31536000000 });
    }

    // Проверяем, есть ли этот ID в списке зарегистрированных
    const currentUser = data.users[userId];
    
    // ЕСЛИ НЕ ЗАРЕГИСТРИРОВАН — ПОКАЗЫВАЕМ ТОЛЬКО ФОРМУ
    if (!currentUser) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Регистрация - Выборы Старосты</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea, #764ba2); height: 100vh; display: flex; align-items: center; justify-content: center; color: #fff; margin: 0; }
                .box { background: rgba(255,255,255,0.15); padding: 40px; border-radius: 20px; backdrop-filter: blur(15px); text-align: center; width: 90%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
                h1 { font-size: 1.8rem; margin-bottom: 10px; background: linear-gradient(90deg,#ffd700,#fff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
                p { margin-bottom: 25px; opacity: 0.9; font-size: 1rem; }
                input { width: 100%; padding: 15px; margin-bottom: 15px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.2); color: #fff; font-size: 1rem; box-sizing: border-box; outline: none; }
                input::placeholder { color: rgba(255,255,255,0.6); }
                button { width: 100%; padding: 15px; border: none; border-radius: 10px; background: #ffd700; color: #333; font-weight: bold; font-size: 1.1rem; cursor: pointer; transition: 0.3s; text-transform: uppercase; }
                button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255,215,0,0.4); }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>👑 Выборы Старосты</h1>
                <p>Чтобы проголосовать, введи свои реальные данные.</p>
                <form method="POST" action="/register">
                    <input type="text" name="name" placeholder="Твое Имя и Фамилия" required>
                    <input type="text" name="group" placeholder="Твоя Группа (например, ИС-21)" required>
                    <button type="submit">Зарегистрироваться</button>
                </form>
            </div>
        </body>
        </html>
        `);
    }

    // ЕСЛИ ЗАРЕГИСТРИРОВАН — ПОКАЗЫВАЕМ КАНДИДАТОВ
    const hasVoted = currentUser.hasVoted;
    const totalVotes = data.candidates.reduce((s, c) => s + c.votes, 0);
    const maxVotes = data.candidates.length ? Math.max(...data.candidates.map(c => c.votes)) : 0;
const candidatesHtml = data.candidates.sort((a, b) => b.votes - a.votes).map(c => {
        const isWinner = c.votes === maxVotes && maxVotes > 0;
        const percent = totalVotes ? Math.round((c.votes / totalVotes) * 100) : 0;
        
        let btnHtml = '';
        if (hasVoted) {
            btnHtml = '<button class="btn-vote" disabled>✓ Голос отдан</button>';
        } else {
            btnHtml = `
            <form method="POST" action="/vote">
                <input type="hidden" name="id" value="${escapeHtml(c.id)}">
                <button type="submit" class="btn-vote">🗳 Голосовать</button>
            </form>`;
        }
        
        return `
        <div class="card ${isWinner ? 'winner' : ''}">
            ${isWinner ? '<div class="crown">👑</div>' : ''}
            <div class="photo-wrap">
                ${c.photo ? `<img src="${escapeHtml(c.photo)}" alt="">` : '<div class="placeholder">👤</div>'}
            </div>
            <div class="card-name">${escapeHtml(c.name)}</div>
            <div class="card-group">📚 ${escapeHtml(c.group)}</div>
            <div class="votes">${c.votes} <small>голос(ов)</small></div>
            <div class="progress"><div class="progress-bar" style="width:${percent}%"></div></div>
            ${btnHtml}
        </div>`;
    }).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>👑 Лучшая Староста ОГАЭК</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea, #764ba2, #f093fb); background-size: 400% 400%; animation: bg 15s ease infinite; min-height: 100vh; color: #fff; padding: 20px; }
            @keyframes bg { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
            .container { max-width: 1100px; margin: 0 auto; }
            h1 { text-align: center; font-size: clamp(1.8rem,5vw,3rem); background: linear-gradient(90deg,#ffd700,#fff,#ffd700); background-size:200%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation: shine 3s linear infinite; margin-bottom: 10px; }
            @keyframes shine { to { background-position: 200% center; } }
            .user-panel { background: rgba(255,255,255,0.15); border-radius: 20px; padding: 20px; margin-bottom: 30px; backdrop-filter: blur(15px); text-align: center; border: 1px solid rgba(255,255,255,0.3); }
            .user-panel h3 { margin-bottom: 10px; }
            .stats { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-bottom: 25px; }
            .stat { background: rgba(255,255,255,0.15); padding: 10px 20px; border-radius: 50px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
            .stat span { color: #ffd700; font-weight: bold; font-size: 1.2rem; }
            .candidates { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap: 20px; }
            .card { background: rgba(255,255,255,0.12); border-radius: 20px; padding: 20px; text-align: center; backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.2); position: relative; transition: 0.3s; }
            .card.winner { border: 3px solid #ffd700; box-shadow: 0 0 30px rgba(255,215,0,0.6); }
            .crown { position: absolute; top: 10px; right: 15px; font-size: 2rem; animation: bounce 1.5s infinite; }
            @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
            .photo-wrap { width: 130px; height: 130px; margin: 0 auto 15px; border-radius: 50%; overflow: hidden; border: 4px solid #ffd700; background: #555; display: flex; align-items: center; justify-content: center; }
            .photo-wrap img { width: 100%; height: 100%; object-fit: cover; }
            .placeholder { font-size: 3rem; opacity: 0.6; }
            .card-name { font-weight: bold; font-size: 1.2rem; margin-bottom: 5px; }
.card-group { color: #ffd700; font-size: 1rem; margin-bottom: 15px; font-weight: bold; }
            .votes { font-size: 1.8rem; font-weight: 900; color: #ffd700; margin-bottom: 10px; }
            .progress { height: 8px; background: rgba(0,0,0,0.3); border-radius: 10px; overflow: hidden; margin-bottom: 15px; }
            .progress-bar { height: 100%; background: linear-gradient(90deg,#ffd700,#ff8c00); transition: width 0.8s ease; }
            .btn-vote { background: linear-gradient(135deg,#00c853,#00e676); color: #fff; width: 100%; padding: 12px; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.3s; font-size: 1rem; }
            .btn-vote:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,200,83,0.4); }
            .btn-vote:disabled { background: #666; cursor: not-allowed; }
            .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: #00c853; border-radius: 10px; font-weight: bold; box-shadow: 0 5px 20px rgba(0,0,0,0.3); transform: translateX(200%); transition: 0.4s; z-index: 1000; }
            .toast.show { transform: translateX(0); }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>👑 Лучшая Староста ОГАЭК 👑</h1>
            <div class="user-panel">
                <h3>👋 Привет, ${escapeHtml(currentUser.name)} (${escapeHtml(currentUser.group)})!</h3>
                <p>${hasVoted ? 'Ты уже сделал свой выбор. Спасибо за голос!' : 'Выбери лучшего кандидата и нажми «Голосовать».'}</p>
            </div>
            <div class="stats">
                <div class="stat">👥 Кандидатов: <span>${data.candidates.length}</span></div>
                <div class="stat">🗳 Всего голосов: <span>${totalVotes}</span></div>
            </div>
            <div class="candidates">
                ${candidatesHtml || '<div style="grid-column:1/-1; text-align:center; padding:50px; opacity:0.8;">😴 Пока никого нет. Ждем кандидатов!</div>'}
            </div>
        </div>
        <script>
            const params = new URLSearchParams(window.location.search);
            if (params.has('msg')) {
                const toast = document.createElement('div');
                toast.className = 'toast show';
                toast.textContent = params.get('msg');
                toast.style.background = params.get('msg').includes('✅') ? '#00c853' : '#ff9800';
                document.body.appendChild(toast);
                setTimeout(() => toast.classList.remove('show'), 3000);
                window.history.replaceState({}, document.title, "/");
            }
        </script>
    </body>
    </html>
    `);
});

// ==========================================
// РЕГИСТРАЦИЯ СТУДЕНТА
// ==========================================
app.post('/register', express.urlencoded({ extended: true }), (req, res) => {
    const data = getData();
    let userId = userIdFrom(req);
    
    if (!userId) {
        userId = crypto.randomBytes(16).toString('hex');
        res.cookie('userId', userId, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 31536000000 });
    }

    if (data.users[userId]) return res.redirect('/');
    if (!validText(req.body?.name) || !validText(req.body?.group)) return res.status(400).send('Name and group are required (1-150 characters).');
    data.users[userId] = { name: req.body?.name.trim(), group: req.body?.group.trim(), hasVoted: false };
    saveData(data);
    res.redirect('/');
});

// ==========================================
// ГОЛОСОВАНИЕ СТУДЕНТА
// ==========================================
app.post('/vote', express.urlencoded({ extended: true }), (req, res) => {
    const data = getData();
    const id = req.body?.id;
    const userId = userIdFrom(req);
    
    if (!userId || !data.users[userId]) return res.redirect('/');
    
    const currentUser = data.users[userId];
    if (currentUser.hasVoted) return res.redirect('/?msg=' + encodeURIComponent('⚠️ Вы уже голосовали!'));
const candidate = data.candidates.find(c => c.id === id);
    if (!candidate) return res.status(404).send('Candidate not found.');
    if (candidate) {
        candidate.votes++;
        currentUser.hasVoted = true;
        if (!data.voteLog) data.voteLog = [];
        data.voteLog.push({ voterName: currentUser.name, voterGroup: currentUser.group, candidateName: candidate.name, time: Date.now() });
        saveData(data);
    }
    res.redirect('/?msg=' + encodeURIComponent('✅ Голос засчитан!'));
});

// ==========================================
// СТРАНИЦА АДМИНА (СРАЗУ ПАРОЛЬ И ПАНЕЛЬ)
// ==========================================
app.get('/admin', (req, res) => {
    const isAdmin = isAdminRequest(req);

    // Если не админ — показываем только форму пароля
    if (!isAdmin) {
        return res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head><meta charset="UTF-8"><title>Вход</title></head>
        <body style="font-family:sans-serif; background:#1a1a2e; height:100vh; display:flex; align-items:center; justify-content:center; color:#fff; margin:0;">
            <div style="background:rgba(255,255,255,0.1); padding:40px; border-radius:20px; text-align:center; width:300px;">
                <h2>🔒 Вход для Админа</h2>
                <form method="POST" action="/admin">
                    <input type="password" name="password" placeholder="Пароль" required style="width:100%; padding:12px; margin-bottom:15px; border-radius:8px; border:none; background:rgba(255,255,255,0.2); color:#fff; box-sizing:border-box; outline:none;">
                    <button type="submit" style="width:100%; padding:12px; border:none; border-radius:8px; background:#ffd700; color:#333; font-weight:bold; cursor:pointer;">Войти</button>
                </form>
                <a href="/" style="color:#aaa; display:block; margin-top:15px; text-decoration:none; font-size:0.9rem;">← Я студент (на главную)</a>
            </div>
        </body>
        </html>
        `);
    }

    // Если админ — показываем панель управления
    const data = getData();
    if (!data.voteLog) data.voteLog = [];

    const candidatesHtml = data.candidates.map(c => `
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; margin-bottom: 10px; display: flex; align-items: center; gap: 15px;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #444; overflow: hidden; flex-shrink: 0;">
                ${c.photo ? `<img src="${escapeHtml(c.photo)}" style="width:100%; height:100%; object-fit:cover;">` : ''}
            </div>
            <div>
                <div style="font-weight: bold;">${escapeHtml(c.name)}</div>
                <div style="font-size: 0.9rem; color: #ffd700;">📚 ${escapeHtml(c.group)} | Голосов: ${c.votes}</div>
            </div>
        </div>
    `).join('');

    const voteLogHtml = data.voteLog.map(log => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <td style="padding: 10px;">${escapeHtml(log.voterName)} <br><small style="opacity:0.7;">${escapeHtml(log.voterGroup)}</small></td>
            <td style="padding: 10px; color: #ffd700; font-weight: bold;">${escapeHtml(log.candidateName)}</td>
            <td style="padding: 10px; font-size: 0.85rem; opacity: 0.8;">${new Date(log.time).toLocaleString('ru-RU')}</td>
        </tr>
    `).reverse().join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Админ-панель</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #fff; padding: 20px; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { text-align: center; color: #ffd700; margin-bottom: 30px; }
            .panels { display: flex; gap: 20px; flex-wrap: wrap; }
            .panel { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 20px; flex: 1; min-width: 300px; }
            .panel h2
{ margin-bottom: 15px; font-size: 1.3rem; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; }
            input[type=text], input[type=file] { width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; outline: none; }
            button { padding: 12px; width: 100%; border: none; border-radius: 8px; background: #ffd700; color: #333; font-weight: bold; cursor: pointer; }
            table { width: 100%; text-align: left; border-collapse: collapse; margin-top: 10px; }
            th { padding: 10px; border-bottom: 2px solid rgba(255,255,255,0.2); opacity: 0.8; }
            .back-link { display: inline-block; margin-bottom: 20px; color: #aaa; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <a href="/" class="back-link">← Выйти на главную</a>
            <h1>👑 Панель Управления</h1>
            
            <div class="panels">
                <div class="panel">
                    <h2>➕ Добавить кандидата</h2>
                    <form method="POST" action="/add" enctype="multipart/form-data">
                        <input type="text" name="name" placeholder="ФИО кандидата" required>
                        <input type="text" name="group" placeholder="Группа (ИС-21)" required>
                        <input type="file" name="photo" accept="image/png,image/jpeg">
                        <button type="submit">Добавить</button>
                    </form>
                    
                    <h2 style="margin-top:30px;">📋 Текущие кандидаты</h2>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${candidatesHtml || '<p style="opacity:0.5;">Нет кандидатов</p>'}
                    </div>
                </div>

                <div class="panel">
                    <h2>🗳 Кто за кого проголосовал</h2>
                    ${data.voteLog.length > 0 ? `
                    <table>
                        <thead><tr><th>Кто (Имя/Группа)</th><th>За кого</th><th>Время</th></tr></thead>
                        <tbody>${voteLogHtml}</tbody>
                    </table>
                    ` : '<p style="opacity:0.5;">Пока нет голосов.</p>'}
                </div>
            </div>
        </div>
    </body>
    </html>
    `);
});

// Обработка ввода пароля на /admin
app.post('/admin', express.urlencoded({ extended: true }), (req, res) => {
    if (req.body?.password === ADMIN_PASSWORD) {
        for (const [token, expires] of adminSessions) {
            if (expires <= Date.now()) adminSessions.delete(token);
        }
        const token = crypto.randomBytes(32).toString('hex');
        adminSessions.set(token, Date.now() + 86400000);
        res.cookie('adminSession', token, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: 86400000 });
        res.redirect('/admin');
    } else {
        res.send('Неверный пароль. <a href="/admin">Назад</a>');
    }
});

// Добавление кандидата
app.post('/add', (req, res, next) => {
    if (!isAdminRequest(req)) return res.status(403).send('Доступ запрещен.');
    next();
}, upload.single('photo'), (req, res) => {
    if (!validText(req.body?.name) || !validText(req.body?.group)) return res.status(400).send('Name and group are required (1-150 characters).');
    if (req.file) {
        const b = req.file.buffer;
        const png = b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpeg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
        if (!((png && req.file.mimetype === 'image/png') || (jpeg && req.file.mimetype === 'image/jpeg'))) return res.status(400).send('Use a PNG or JPEG image.');
    }

    const data = getData();
    let photoBase64 = null;
    if (req.file) photoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    data.candidates.push({ id: crypto.randomBytes(16).toString('hex'), name: req.body?.name.trim(), group: req.body?.group.trim(), photo: photoBase64, votes: 0 });
    saveData(data);
    res.redirect('/admin');
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) return res.status(400).send('Upload rejected: maximum image size is 2 MB.');
    if (err.status === 400 || err.status === 413 || err.status === 415) return res.status(err.status).send('Invalid request body.');
    console.error(err);
    res.status(500).send('Internal server error.');
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
