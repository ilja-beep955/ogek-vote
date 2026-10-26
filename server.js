const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = 'data.json';
const ADMIN_PASSWORD = 'admin123'; // Пароль админа

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Инициализация базы данных (добавили users)
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ candidates: [], users: {} }));
}

const getData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data));

// Главная страница
app.get('/', (req, res) => {
    const data = getData();
    const totalVotes = data.candidates.reduce((s, c) => s + c.votes, 0);
    const maxVotes = data.candidates.length ? Math.max(...data.candidates.map(c => c.votes)) : 0;
    
    const cookies = req.headers.cookie || '';
    const isAdmin = cookies.includes('admin=true');
    
    // Получаем ID пользователя из куки
    const match = cookies.match(/userId=([^;]+)/);
    let userId = match ? match[1] : null;
    if (!userId) {
        userId = crypto.randomBytes(16).toString('hex');
        res.setHeader('Set-Cookie', `userId=${userId}; Path=/; Max-Age=31536000`);
    }

    // Проверяем, зарегистрирован ли пользователь
    const currentUser = data.users[userId];
    const isRegistered = !!currentUser;
    const hasVoted = currentUser ? currentUser.hasVoted : false;

    const candidatesHtml = data.candidates.sort((a, b) => b.votes - a.votes).map(c => {
        const isWinner = c.votes === maxVotes && maxVotes > 0;
        const percent = totalVotes ? Math.round((c.votes / totalVotes) * 100) : 0;
        
        // Кнопка голосования неактивна, если юзер не зареган или уже голосовал
        let btnHtml = '';
        if (!isRegistered) {
            btnHtml = `<button class="btn-vote" disabled style="background:#888; opacity:0.7;">Сначала зарегистрируйся</button>`;
        } else if (hasVoted) {
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>👑 Лучшая Староста ОГАЭК</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea, #764ba2, #f093fb); background-size: 400% 400%; animation: bg 15s ease infinite; min-height: 100vh; color: #fff; padding: 20px; }
            @keyframes bg { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
            .container { max-width: 1100px; margin: 0 auto; }
            h1 { text-align: center; font-size: clamp(1.8rem,5vw,3rem); background: linear-gradient(90deg,#ffd700,#fff,#ffd700); background-size:200%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation: shine 3s linear infinite; margin-bottom: 10px; }
            @keyframes shine { to { background-position: 200% center; } }
            .subtitle { text-align: center; opacity: 0.9; margin-bottom: 20px; font-size: 1.1rem; }
            .stats { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-bottom: 25px; }
            .stat { background: rgba(255,255,255,0.15); padding: 10px 20px; border-radius: 50px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }
            .stat span { color: #ffd700; font-weight: bold; font-size: 1.2rem; }
            
            /* Блок профиля и регистрации */
            .user-panel { background: rgba(255,255,255,0.15); border-radius: 20px; padding: 20px; margin-bottom: 30px; backdrop-filter: blur(15px); text-align: center; border: 1px solid rgba(255,255,255,0.3); }
            .user-panel h3 { margin-bottom: 15px; }
            .reg-form { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
            .reg-form input { padding: 12px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.15); color: #fff; outline: none; }
            .reg-form input::placeholder { color: rgba(255,255,255,0.7); }
            .reg-form button { padding: 12px 25px; border: none; border-radius: 10px; background: #ffd700; color: #333; font-weight: bold; cursor: pointer; transition: 0.3s; }
            .reg-form button:hover { transform: scale(1.05); }

            .add-form { background: rgba(255,255,255,0.12); border-radius: 20px; padding: 20px; margin-bottom: 30px; backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.2); }
            .add-form h2 { text-align: center; margin-bottom: 15px; }
            .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap: 10px; margin-bottom: 10px; }
            input[type=text], input[type=file] { width: 100%; padding: 12px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.15); color: #fff; outline: none; }
            input[type=file]::file-selector-button { background: #ffd700; color: #333; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-weight: bold; }
            .btn { padding: 14px 25px; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.3s; text-transform: uppercase; font-size: 1rem; }
            .btn-primary { background: linear-gradient(135deg,#ffd700,#ff8c00); color: #333; width: 100%; }
            
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
            .admin-link { display: block; text-align: center; margin-top: 40px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.9rem; cursor: pointer; }
            .admin-link:hover { color: #fff; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>👑 Лучшая Староста ОГАЭК 👑</h1>
            <p class="subtitle">Голосуй за самую крутую старосту!</p>
            
            <div class="stats">
                <div class="stat">👥 Кандидатов: <span>${data.candidates.length}</span></div>
                <div class="stat">🗳️ Всего голосов: <span>${totalVotes}</span></div>
            </div>

            <!-- Панель пользователя -->
            ${!isAdmin ? `
            <div class="user-panel">
                ${isRegistered 
                    ? `<h3>👋 Привет, ${currentUser.name} (${currentUser.group})!</h3> 
                       <p style="opacity:0.8;">${hasVoted ? 'Ты уже сделал свой выбор. Спасибо за голос!' : 'Выбери лучшего кандидата и нажми «Голосовать». Голос можно отдать только один раз!'}</p>`
                    : `<h3>📝 Регистрация для голосования</h3>
                       <p style="margin-bottom:15px; opacity:0.9;">Введи свои данные, чтобы система засчитала твой голос.</p>
                       <form method="POST" action="/register" class="reg-form">
                           <input type="text" name="name" placeholder="Твое Имя и Фамилия" required>
                           <input type="text" name="group" placeholder="Твоя Группа" required>
                           <button type="submit">Зарегистрироваться</button>
                       </form>`
                }
            </div>
            ` : ''}
            
            <!-- Панель Админа -->
            ${isAdmin ? `
            <div class="add-form">
                <h2>➕ Добавить кандидата (Админ)</h2>
                <form method="POST" action="/add" enctype="multipart/form-data">
                    <div class="form-grid">
                        <input type="text" name="name" placeholder="ФИО кандидата" required>
                        <input type="text" name="group" placeholder="Группа (ИС-21)" required>
                        <input type="file" name="photo" accept="image/*">
                    </div>
                    <button type="submit" class="btn btn-primary">🚀 Добавить</button>
                </form>
            </div>
            ` : ''}

            <div class="candidates">
                ${candidatesHtml || '<div class="empty" style="grid-column:1/-1; text-align:center; padding:50px;">😴 Пока никого нет. Ждем кандидатов!</div>'}
            </div>
            
            ${!isAdmin ? `<a href="/login" class="admin-link">🔒 Вход для админа</a>` : ''}
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

// Регистрация пользователя
app.post('/register', express.urlencoded({ extended: true }), (req, res) => {
    const data = getData();
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/userId=([^;]+)/);
    const userId = match ? match[1] : null;
    
    if (!userId) return res.redirect('/?msg=Ошибка сессии');

    data.users[userId] = {
        name: req.body.name.trim(),
        group: req.body.group.trim(),
        hasVoted: false
    };
    saveData(data);
    res.redirect('/?msg=' + encodeURIComponent('✅ Регистрация успешна!'));
});

// Голосование
app.post('/vote', express.urlencoded({ extended: true }), (req, res) => {
    const data = getData();
    const id = req.body.id;
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/userId=([^;]+)/);
    const userId = match ? match[1] : null;
    
    if (!userId || !data.users[userId]) {
        return res.redirect('/?msg=' + encodeURIComponent('⚠️ Сначала зарегистрируйтесь!'));
    }

    const currentUser = data.users[userId];

    if (currentUser.hasVoted) {
        return res.redirect('/?msg=' + encodeURIComponent('⚠️ Вы уже голосовали! Можно только один раз.'));
    }
    
    const candidate = data.candidates.find(c => c.id === id);
    if (candidate) {
        candidate.votes++;
        currentUser.hasVoted = true; // Блокируем голосование навсегда
        saveData(data);
    }
    res.redirect('/?msg=' + encodeURIComponent('✅ Голос засчитан!'));
});

// --- АДМИНКА ---
app.get('/login', (req, res) => {
    res.send(`
    <body style="font-family:sans-serif; background:#667eea; height:100vh; display:flex; align-items:center; justify-content:center; color:#fff;">
        <div style="background:rgba(255,255,255,0.2); padding:40px; border-radius:20px; text-align:center;">
            <h2>Вход для админа</h2>
            <form method="POST" action="/login">
                <input type="password" name="password" placeholder="Пароль" required style="padding:10px; border-radius:5px; border:none; margin-bottom:10px; width:100%;">
                <button type="submit" style="padding:10px; width:100%; background:#ffd700; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">Войти</button>
            </form>
            <a href="/" style="color:#ffd700; display:block; margin-top:15px; text-decoration:none;">На главную</a>
        </div>
    </body>
    `);
});

app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        res.setHeader('Set-Cookie', 'admin=true; Path=/; Max-Age=86400');
        res.redirect('/');
    } else {
        res.send('Неверный пароль. <a href="/login">Назад</a>');
    }
});

app.post('/add', upload.single('photo'), (req, res) => {
    const cookies = req.headers.cookie || '';
    if (!cookies.includes('admin=true')) return res.send('Доступ запрещен. <a href="/">На главную</a>');

    const data = getData();
    let photoBase64 = null;
    if (req.file) {
        photoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }
    data.candidates.push({
        id: Date.now().toString(),
        name: req.body.name.trim(),
        group: req.body.group.trim(),
        photo: photoBase64,
        votes: 0
    });
    saveData(data);
    res.redirect('/');
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
