const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = 'data.json';
const ADMIN_PASSWORD = 'admin123'; // Твой пароль

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// База данных
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ candidates: [], users: {}, voteLog: [] }));
}
const getData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data));

// --- ГЛАВНАЯ СТРАНИЦА (ТОЛЬКО ДЛЯ СТУДЕНТОВ) ---
app.get('/', (req, res) => {
    const data = getData();
    
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/userId=([^;]+)/);
    let userId = match ? match[1] : null;
    
    // Если куки нет, создаем
    if (!userId) {
        userId = crypto.randomBytes(16).toString('hex');
        res.setHeader('Set-Cookie', `userId=${userId}; Path=/; Max-Age=31536000`);
    }

    const currentUser = data.users[userId];
    const isRegistered = !!currentUser;
    const hasVoted = currentUser ? currentUser.hasVoted : false;

    // ЕСЛИ НЕ ЗАРЕГИСТРИРОВАН — ТОЛЬКО ФОРМА РЕГИСТРАЦИИ
    if (!isRegistered) {
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
    const totalVotes = data.candidates.reduce((s, c) => s + c.votes, 0);
    const maxVotes = data.candidates.length ? Math.max(...data.candidates.map(c => c.votes)) : 0;

    const candidatesHtml = data.candidates.sort((a, b) => b.votes - a.votes).map(c => {
        const isWinner = c.votes === maxVotes && maxVotes > 0;
        const percent = totalVotes ? Math.round((c.votes / totalVotes) * 100) : 0;
        
        let btnHtml = '';
        if (hasVoted) {
            btnHtml = `<button class="btn-vote" disabled>✓ Голос отдан</button>`;
        } else {
            btnHtml = `
            <form method="POST" action="/vote">
                <input type="hidden" name="id" value="${c.id}">
                <button type="submit" class="btn-vote">🗳️ Голосовать</button>
            </form>`;
        }
        
        return `
        <div class="card ${isWinner ? 'winner' : ''}">
            ${isWinner ? '<div class="crown">👑</div>' : ''}
            <div class="photo-wrap">
                ${c.photo ? `<img src="${c.photo}" alt="">` : `<div class="placeholder">👤</div>`}
            </div>
            <div class="card-name">${c.name}</div>
            <div class="card-group">📚 ${c.group}</div>
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
                <h3>👋 Привет, ${currentUser.name} (${currentUser.group})!</h3>
                <p>${hasVoted ? 'Ты уже сделал свой выбор. Спасибо за голос!' : 'Выбери лучшего кандидата и нажми «Голосовать».'}</p>
            </div>
            <div class="stats">
                <div class="stat">👥 Кандидатов: <span>${data.candidates.length}</span></div>
                <div class="stat">🗳️ Всего голосов: <span>${totalVotes}</span></div>
            </div>
            <div class="candidates">
                ${candidatesHtml || '<div class="empty" style="grid-column:1/-1; text-align:center; padding:50px;">😴 Пока никого нет.</div>'}
            </div>
        </div>
        <script>
            const params = new URLSearchParams(window.location.search);
            if (params.has('msg')) {
                const toast = document.createElement('div');
                toast.className = 'toast show';
                toast.textContent = decodeURIComponent(params.get('msg'));
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

// --- РЕГИСТРАЦИЯ ---
app.post('/register', express.urlencoded({ extended: true }), (req, res) => {
    const data = getData();
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/userId=([^;]+)/);
    let userId = match ? match[1] : null;
    if (!userId) return res.redirect('/');

    data.users[userId] = { name: req.body.name.trim(), group: req.body.group.trim(), hasVoted: false };
    saveData(data);
    res.redirect('/');
});

// --- ГОЛОСОВАНИЕ ---
app.post('/vote', express.urlencoded({ extended: true }), (req, res) => {
    const data = getData();
    const id = req.body.id;
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/userId=([^;]+)/);
    const userId = match ? match[1] : null;
    
    if (!userId || !data.users[userId]) return res.redirect('/');
    const currentUser = data.users[userId];

    if (currentUser.hasVoted) return res.redirect('/?msg=' + encodeURIComponent('⚠️ Вы уже голосовали!'));
    
    const candidate = data.candidates.find(c => c.id === id);
    if (candidate) {
        candidate.votes++;
        currentUser.hasVoted = true;
        if (!data.voteLog) data.voteLog = [];
        data.voteLog.push({ voterName: currentUser.name, voterGroup: currentUser.group, candidateName: candidate.name, time: Date.now() });
        saveData(data);
    }
    res.redirect('/?msg=' + encodeURIComponent('✅ Голос засчитан!'));
});

// --- СТРАНИЦА АДМИНА ---
app.get('/admin', (req, res) => {
    const cookies = req.headers.cookie || '';
    const isAdmin = /(?:^|;\s*)admin=true/.test(cookies);

    if (!isAdmin) {
        return res.send(`
        <body style="font-family:sans-serif; background:#1a1a2e; height:100vh; display:flex; align-items:center; justify-content:center; color:#fff; margin:0;">
            <div style="background:rgba(255,255,255,0.1); padding:40px; border-radius:20px; text-align:center; width:300px;">
                <h2>🔒 Вход для Админа</h2>
                <form method="POST" action="/admin">
                    <input type="password" name="password" placeholder="Пароль" required style="width:100%; padding:12px; margin-bottom:15px; border-radius:8px; border:none; background:rgba(255,255,255,0.2); color:#fff; box-sizing:border-box; outline:none;">
                    <button type="submit" style="width:100%; padding:12px; border:none; border-radius:8px; background:#ffd700; color:#333; font-weight:bold; cursor:pointer;">Войти</button>
                </form>
                <a href="/" style="color:#aaa; display:block; margin-top:15px; text-decoration:none; font-size:0.9rem;">← На главную (для студентов)</a>
            </div>
        </body>
        `);
    }

    const data = getData();
    if (!data.voteLog) data.voteLog = [];

    const candidatesHtml = data.candidates.map(c => `
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; margin-bottom: 10px; display: flex; align-items: center; gap: 15px;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #444; overflow: hidden; flex-shrink: 0;">
                ${c.photo ? `<img src="${c.photo}" style="width:100%; height:100%; object-fit:cover;">` : ''}
            </div>
            <div>
                <div style="font-weight: bold;">${c.name}</div>
                <div style="font-size: 0.9rem; color: #ffd700;">📚 ${c.group} | Голосов: ${c.votes}</div>
            </div>
        </div>
    `).join('');

    const voteLogHtml = data.voteLog.map(log => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <td style="padding: 10px;">${log.voterName} <br><small style="opacity:0.7;">${log.voterGroup}</small></td>
            <td style="padding: 10px; color: #ffd700; font-weight: bold;">${log.candidateName}</td>
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
            .panel h2 { margin-bottom: 15px; font-size: 1.3rem; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; }
            input[type=text], input[type=file] { width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; outline: none; }
            button { padding: 12px; width: 100%; border: none; border-radius: 8px; background: #ffd700; color: #333; font-weight: bold; cursor: pointer; }
            table { width: 100%; text-align: left; border-collapse: collapse; margin-top: 10px; }
            th { padding: 10px; border-bottom: 2px solid rgba(255,255,255,0.2); opacity: 0.8; }
            .back-link { display: inline-block; margin-bottom: 20px; color: #aaa; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <a href="/" class="back-link">← На главную (как студент)</a>
            <h1>👑 Панель Управления</h1>
            
            <div class="panels">
                <div class="panel">
                    <h2>➕ Добавить кандидата</h2>
                    <form method="POST" action="/add" enctype="multipart/form-data">
                        <input type="text" name="name" placeholder="ФИО кандидата" required>
                        <input type="text" name="group" placeholder="Группа (ИС-21)" required>
                        <input type="file" name="photo" accept="image/*">
                        <button type="submit">Добавить</button>
                    </form>
                    
                    <h2 style="margin-top:30px;">📋 Текущие кандидаты</h2>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${candidatesHtml || '<p style="opacity:0.5;">Нет кандидатов</p>'}
                    </div>
                </div>

                <div class="panel">
                    <h2>🗳️ Кто за кого проголосовал</h2>
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

// --- ОБРАБОТКА ВХОДА В АДМИНКУ ---
app.post('/admin', express.urlencoded({ extended: true }), (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        res.setHeader('Set-Cookie', 'admin=true; Path=/; Max-Age=86400');
        res.redirect('/admin');
    } else {
        res.send('Неверный пароль. <a href="/admin">Назад</a>');
    }
});

// --- ДОБАВЛЕНИЕ КАНДИДАТА ---
app.post('/add', upload.single('photo'), (req, res) => {
    const cookies = req.headers.cookie || '';
    if (!/(?:^|;\s*)admin=true/.test(cookies)) return res.status(403).send('Доступ запрещен.');

    const data = getData();
    let photoBase64 = null;
    if (req.file) photoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    data.candidates.push({ id: Date.now().toString(), name: req.body.name.trim(), group: req.body.group.trim(), photo: photoBase64, votes: 0 });
    saveData(data);
    res.redirect('/admin');
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
