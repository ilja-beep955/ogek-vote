import os
import json
import time
import secrets
from flask import Flask, request, make_response, redirect, render_template_string, abort
from werkzeug.utils import secure_filename
import base64

app = Flask(__name__)
PORT = int(os.environ.get('PORT', 3000))
DATA_FILE = 'data.json'
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

admin_sessions = {}

def get_data():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({"candidates": [], "users": {}, "voteLog": []}, f)
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)

def user_id_from(req):
    cookie = req.cookies.get('userId')
    if cookie and len(cookie) == 32:
        return cookie
    return None

def is_admin_request(req):
    token = req.cookies.get('adminSession')
    if not token: return False
    expires = admin_sessions.get(token)
    if not expires or expires <= time.time():
        if token in admin_sessions: del admin_sessions[token]
        return False
    return True

def valid_text(value):
    return isinstance(value, str) and 0 < len(value.strip()) <= 150

# ==========================================
# ГЛАВНАЯ СТРАНИЦА (СТУДЕНТЫ)
# ==========================================
@app.route('/', methods=['GET'])
def index():
    data = get_data()
    user_id = user_id_from(request)
    resp = make_response()
    
    if not user_id:
        user_id = secrets.token_hex(16)
        resp.set_cookie('userId', user_id, max_age=31536000, httponly=True, samesite='Lax')

    current_user = data['users'].get(user_id)
    
    if not current_user:
        html = """
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
        """
        resp.set_data(html)
        return resp

    has_voted = current_user.get('hasVoted', False)
    total_votes = sum(c['votes'] for c in data['candidates'])
    max_votes = max([c['votes'] for c in data['candidates']], default=0)
    
    candidates_html = ""
    for c in sorted(data['candidates'], key=lambda x: x['votes'], reverse=True):
        is_winner = c['votes'] == max_votes and max_votes > 0
        percent = round((c['votes'] / total_votes) * 100) if total_votes else 0
        
        if has_voted:
            btn = '<button class="btn-vote" disabled>✓ Голос отдан</button>'
        else:
            btn = f'''
            <form method="POST" action="/vote">
                <input type="hidden" name="id" value="{c['id']}">
                <button type="submit" class="btn-vote">🗳 Голосовать</button>
            </form>'''
            
        photo = f'<img src="{c["photo"]}" alt="">' if c.get('photo') else '<div class="placeholder">👤</div>'
        
        candidates_html += f'''
        <div class="card {'winner' if is_winner else ''}">
            {'<div class="crown">👑</div>' if is_winner else ''}
            <div class="photo-wrap">{photo}</div>
            <div class="card-name">{c['name']}</div>
            <div class="card-group">📚 {c['group']}</div>
            <div class="votes">{c['votes']} <small>голос(ов)</small></div>
            <div class="progress"><div class="progress-bar" style="width:{percent}%"></div></div>
            {btn}
        </div>'''

    html = f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>👑 Лучшая Староста ОГАЭК</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea, #764ba2, #f093fb); background-size: 400% 400%; animation: bg 15s ease infinite; min-height: 100vh; color: #fff; padding: 20px; }}
            @keyframes bg {{ 0%,100%{{background-position:0% 50%}} 50%{{background-position:100% 50%}} }}
            .container {{ max-width: 1100px; margin: 0 auto; }}
            h1 {{ text-align: center; font-size: clamp(1.8rem,5vw,3rem); background: linear-gradient(90deg,#ffd700,#fff,#ffd700); background-size:200%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation: shine 3s linear infinite; margin-bottom: 10px; }}
            @keyframes shine {{ to {{ background-position: 200% center; }} }}
            .user-panel {{ background: rgba(255,255,255,0.15); border-radius: 20px; padding: 20px; margin-bottom: 30px; backdrop-filter: blur(15px); text-align: center; border: 1px solid rgba(255,255,255,0.3); }}
            .user-panel h3 {{ margin-bottom: 10px; }}
            .stats {{ display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-bottom: 25px; }}
            .stat {{ background: rgba(255,255,255,0.15); padding: 10px 20px; border-radius: 50px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2); }}
            .stat span {{ color: #ffd700; font-weight: bold; font-size: 1.2rem; }}
            .candidates {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap: 20px; }}
            .card {{ background: rgba(255,255,255,0.12); border-radius: 20px; padding: 20px; text-align: center; backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.2); position: relative; transition: 0.3s; }}
            .card.winner {{ border: 3px solid #ffd700; box-shadow: 0 0 30px rgba(255,215,0,0.6); }}
            .crown {{ position: absolute; top: 10px; right: 15px; font-size: 2rem; animation: bounce 1.5s infinite; }}
            @keyframes bounce {{ 0%,100%{{transform:translateY(0)}} 50%{{transform:translateY(-8px)}} }}
            .photo-wrap {{ width: 130px; height: 130px; margin: 0 auto 15px; border-radius: 50%; overflow: hidden; border: 4px solid #ffd700; background: #555; display: flex; align-items: center; justify-content: center; }}
            .photo-wrap img {{ width: 100%; height: 100%; object-fit: cover; }}
            .placeholder {{ font-size: 3rem; opacity: 0.6; }}
            .card-name {{ font-weight: bold; font-size: 1.2rem; margin-bottom: 5px; }}
            .card-group {{ color: #ffd700; font-size: 1rem; margin-bottom: 15px; font-weight: bold; }}
            .votes {{ font-size: 1.8rem; font-weight: 900; color: #ffd700; margin-bottom: 10px; }}
            .progress {{ height: 8px; background: rgba(0,0,0,0.3); border-radius: 10px; overflow: hidden; margin-bottom: 15px; }}
            .progress-bar {{ height: 100%; background: linear-gradient(90deg,#ffd700,#ff8c00); transition: width 0.8s ease; }}
            .btn-vote {{ background: linear-gradient(135deg,#00c853,#00e676); color: #fff; width: 100%; padding: 12px; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.3s; font-size: 1rem; }}
            .btn-vote:hover:not(:disabled) {{ transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,200,83,0.4); }}
            .btn-vote:disabled {{ background: #666; cursor: not-allowed; }}
            .toast {{ position: fixed; top: 20px; right: 20px; padding: 15px 25px; background: #00c853; border-radius: 10px; font-weight: bold; box-shadow: 0 5px 20px rgba(0,0,0,0.3); transform: translateX(200%); transition: 0.4s; z-index: 1000; }}
            .toast.show {{ transform: translateX(0); }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>👑 Лучшая Староста ОГАЭК 👑</h1>
            <div class="user-panel">
                <h3>👋 Привет, {current_user['name']} ({current_user['group']})!</h3>
                <p>{'Ты уже сделал свой выбор. Спасибо за голос!' if has_voted else 'Выбери лучшего кандидата и нажми «Голосовать».'}</p>
            </div>
            <div class="stats">
                <div class="stat">👥 Кандидатов: <span>{len(data['candidates'])}</span></div>
                <div class="stat">🗳 Всего голосов: <span>{total_votes}</span></div>
            </div>
            <div class="candidates">
                {candidates_html or '<div style="grid-column:1/-1; text-align:center; padding:50px; opacity:0.8;">😴 Пока никого нет. Ждем кандидатов!</div>'}
            </div>
        </div>
        <script>
            const params = new URLSearchParams(window.location.search);
            if (params.has('msg')) {{
                const toast = document.createElement('div');
                toast.className = 'toast show';
                toast.textContent = params.get('msg');
                toast.style.background = params.get('msg').includes('✅') ? '#00c853' : '#ff9800';
                document.body.appendChild(toast);
                setTimeout(() => toast.classList.remove('show'), 3000);
                window.history.replaceState({{}}, document.title, "/");
            }}
        </script>
    </body>
    </html>
    """
    resp.set_data(html)
    return resp

@app.route('/register', methods=['POST'])
def register():
    data = get_data()
    user_id = user_id_from(request)
    resp = make_response()
    
    if not user_id:
        user_id = secrets.token_hex(16)
        resp.set_cookie('userId', user_id, max_age=31536000, httponly=True, samesite='Lax')
    
    if user_id in data['users']:
        return redirect('/')
        
    name = request.form.get('name', '')
    group = request.form.get('group', '')
    
    if not valid_text(name) or not valid_text(group):
        return "Name and group are required (1-150 characters).", 400
        
    data['users'][user_id] = {"name": name.strip(), "group": group.strip(), "hasVoted": False}
    save_data(data)
    resp.headers['Location'] = '/'
    resp.status_code = 302
    return resp

@app.route('/vote', methods=['POST'])
def vote():
    data = get_data()
    candidate_id = request.form.get('id')
    user_id = user_id_from(request)
    
    if not user_id or user_id not in data['users']:
        return redirect('/')
        
    current_user = data['users'][user_id]
    if current_user.get('hasVoted'):
        return redirect('/?msg=⚠️ Вы уже голосовали!')
        
    candidate = next((c for c in data['candidates'] if c['id'] == candidate_id), None)
    if not candidate:
        return "Candidate not found", 404
        
    candidate['votes'] += 1
    current_user['hasVoted'] = True
    data['voteLog'].append({
        "voterName": current_user['name'],
        "voterGroup": current_user['group'],
        "candidateName": candidate['name'],
        "time": int(time.time() * 1000)
    })
    save_data(data)
    return redirect('/?msg=✅ Голос засчитан!')

# ==========================================
# АДМИНКА
# ==========================================
@app.route('/admin', methods=['GET'])
def admin():
    if not is_admin_request(request):
        return """
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
        """
        
    data = get_data()
    
    candidates_html = "".join(f"""
        <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 10px; margin-bottom: 10px; display: flex; align-items: center; gap: 15px;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: #444; overflow: hidden; flex-shrink: 0;">
                {f'<img src="{c["photo"]}" style="width:100%; height:100%; object-fit:cover;">' if c.get('photo') else ''}
            </div>
            <div>
                <div style="font-weight: bold;">{c['name']}</div>
                <div style="font-size: 0.9rem; color: #ffd700;">📚 {c['group']} | Голосов: {c['votes']}</div>
            </div>
        </div>
    """ for c in data['candidates'])
    
    vote_log_html = "".join(f"""
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
            <td style="padding: 10px;">{log['voterName']} <br><small style="opacity:0.7;">{log['voterGroup']}</small></td>
            <td style="padding: 10px; color: #ffd700; font-weight: bold;">{log['candidateName']}</td>
            <td style="padding: 10px; font-size: 0.85rem; opacity: 0.8;">{time.strftime('%d.%m.%Y %H:%M', time.localtime(log['time']/1000))}</td>
        </tr>
    """ for log in reversed(data['voteLog']))
    
    return f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Админ-панель</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #fff; padding: 20px; }}
            .container {{ max-width: 1200px; margin: 0 auto; }}
            h1 {{ text-align: center; color: #ffd700; margin-bottom: 30px; }}
            .panels {{ display: flex; gap: 20px; flex-wrap: wrap; }}
            .panel {{ background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 20px; flex: 1; min-width: 300px; }}
            .panel h2 {{ margin-bottom: 15px; font-size: 1.3rem; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; }}
            input[type=text], input[type=file] {{ width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; outline: none; }}
            button {{ padding: 12px; width: 100%; border: none; border-radius: 8px; background: #ffd700; color: #333; font-weight: bold; cursor: pointer; }}
            table {{ width: 100%; text-align: left; border-collapse: collapse; margin-top: 10px; }}
            th {{ padding: 10px; border-bottom: 2px solid rgba(255,255,255,0.2); opacity: 0.8; }}
            .back-link {{ display: inline-block; margin-bottom: 20px; color: #aaa; text-decoration: none; }}
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
                        {candidates_html or '<p style="opacity:0.5;">Нет кандидатов</p>'}
                    </div>
                </div>

                <div class="panel">
                    <h2>🗳 Кто за кого проголосовал</h2>
                    {f'''
                    <table>
                        <thead><tr><th>Кто (Имя/Группа)</th><th>За кого</th><th>Время</th></tr></thead>
                        <tbody>{vote_log_html}</tbody>
                    </table>
                    ''' if data['voteLog'] else '<p style="opacity:0.5;">Пока нет голосов.</p>'}
                </div>
            </div>
        </div>
    </body>
    </html>
    """

@app.route('/admin', methods=['POST'])
def admin_login():
    if request.form.get('password') == ADMIN_PASSWORD:
        for token, expires in list(admin_sessions.items()):
            if expires <= time.time():
                del admin_sessions[token]
        token = secrets.token_hex(32)
        admin_sessions[token] = time.time() + 86400
        resp = make_response(redirect('/admin'))
        resp.set_cookie('adminSession', token, max_age=86400, httponly=True, samesite='Strict')
        return resp
    return 'Неверный пароль. <a href="/admin">Назад</a>'

@app.route('/add', methods=['POST'])
def add():
    if not is_admin_request(request):
        return 'Доступ запрещен.', 403
        
    name = request.form.get('name', '')
    group = request.form.get('group', '')
    if not valid_text(name) or not valid_text(group):
        return 'Name and group are required (1-150 characters).', 400
        
    photo_base64 = None
    if 'photo' in request.files:
        file = request.files['photo']
        if file.filename:
            if file.content_type not in ['image/png', 'image/jpeg']:
                return 'Use a PNG or JPEG image.', 400
            file_data = file.read()
            if len(file_data) > 2 * 1024 * 1024:
                return 'Maximum image size is 2 MB.', 400
            b64 = base64.b64encode(file_data).decode('utf-8')
            photo_base64 = f"data:{file.content_type};base64,{b64}"

    data = get_data()
    data['candidates'].append({
        "id": secrets.token_hex(16),
        "name": name.strip(),
        "group": group.strip(),
        "photo": photo_base64,
        "votes": 0
    })
    save_data(data)
    return redirect('/admin')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT)
