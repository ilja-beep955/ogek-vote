const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = 'data.json';

// Загрузка фото в память
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Инициализация базы данных
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ candidates: [], votedIps: [] }));
}

// Хелперы для чтения/записи
const getData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data));

// Главная страница
app.get('/', (req, res) => {
    const data = getData();
    const totalVotes = data.candidates.reduce((s, c) => s + c.votes, 0);
    const maxVotes = data.candidates.length ? Math.max(...data.candidates.map(c => c.votes)) : 0;
    const userIp = req.ip;

    const candidatesHtml = data.candidates.sort((a, b) => b.votes - a.votes).map(c => {
        const isWinner = c.votes === maxVotes && maxVotes > 0;
        const hasVoted = data.votedIps.includes(`${userIp}_${c.id}`);
        const percent = totalVotes ? Math.round((c.votes / totalVotes) * 100) : 0;
        
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
            <form method="POST" action="/vote">
                <input type="hidden" name="id" value="${c.id}">
                <button type="submit" class="btn-vote" ${hasVoted ? 'disabled' : ''}>
                    ${hasVoted ? '✓ Ты голосовал' : '🗳️ Голосовать'}
                </button>
            </form>
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
            .add-form { background: rgba(255,255,255,0.12); border-radius: 20px; padding: 20px; margin-bottom: 30px; backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.2); }
            .add-form h2 { text-align: center; margin-bottom: 15px; }
            .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px,1fr)); gap: 10px; margin-bottom: 10px; }
            input[type=text], input[type=file] { width: 100%; padding: 12px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.15); color: #fff; outline: none; }
            input::placeholder { color: rgba(255,255,255,0.7); }
            input[type=file]::file-selector-button { background: #ffd700; color: #333; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-right: 8px; font-weight: bold; }
            .btn { padding: 14px 25px; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.3s; text-transform: uppercase; font-size: 1rem; }
            .btn-primary { background: linear-gradient(135deg,#ffd700,#ff8c00); color: #333; width: 100%; }
            .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(255,215,0,0.5); }
            .candidates { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap: 20px; }
            .card { background: rgba(255,255,255,0.12); border-radius: 20px; padding: 20px; text-align: center; backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.2); position: relative; transition: 0.3s; }
            .card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
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
            .empty { text-align: center; padding: 50px; font-size: 1.2rem; opacity: 0.8; grid-column: 1/-1; }
            .toast { position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: #00c853; border-radius: 10px; font-weight: bold; box-shadow: 0 5px 20px rgba(0,0,0,0.3); transform: translateX(200%); transition: 0.4s; }
            .toast.show { transform: translateX(0); }
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
            <div class="add-form">
                <h2>➕ Добавить кандидата</h2>
                <form method="POST" action="/add" enctype="multipart/form-data">
                    <div class="form-grid">
                        <input type="text" name="name" placeholder="ФИО кандидата" required>
                        <input type="text" name="group" placeholder="Группа (ИС-21)" required>
                        <input type="file" name="photo" accept="image/*">
                    </div>
                    <button type="submit" class="btn btn-primary">🚀 Добавить</button>
                </form>
            </div>
            <div class="candidates">
                ${candidatesHtml || '<div class="empty">😴 Пока никого нет. Добавь первого кандидата!</div>'}
            </div>
        </div>
        <script>
            const params = new URLSearchParams(window.location.search);
            if (params.has('voted')) {
                const toast = document.createElement('div');
                toast.className = 'toast show';
                toast.textContent = params.get('voted') === '1' ? '✅ Голос засчитан!' : '⚠️ Вы уже голосовали!';
                toast.style.background = params.get('voted') === '1' ? '#00c853' : '#ff9800';
                document.body.appendChild(toast);
                setTimeout(() => toast.classList.remove('show'), 3000);
                window.history.replaceState({}, document.title, "/");
            }
        </script>
    </body>
    </html>
    `);
});

// Добавление кандидата
app.post('/add', upload.single('photo'), (req, res) => {
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

// Голосование
app.post('/vote', express.urlencoded({ extended: true }), (req, res) => {
    const data = getData();
    const id = req.body.id;
    const ip = req.ip;
    
    if (data.votedIps.includes(`${ip}_${id}`)) {
        return res.redirect('/?voted=0');
    }
    
    const candidate = data.candidates.find(c => c.id === id);
    if (candidate) {
        candidate.votes++;
        data.votedIps.push(`${ip}_${id}`);
        saveData(data);
    }
    res.redirect('/?voted=1');
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
