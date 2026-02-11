const express = require('express');
const app = express();
const path = require('path');

// Для парсинга JSON
app.use(express.json());

// Массив для хранения логов
let logs = [];
let herAnswer = null;

// Маршрут для сохранения логов
app.post('/api/log', (req, res) => {
    const log = {
        ...req.body,
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress
    };
    
    logs.push(log);
    
    // Вывод в красивом человеческом виде
    const time = new Date(log.timestamp).toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(`[${time}] ${log.действие || 'Действие'}`);
    
    if (log.детали && Object.keys(log.детали).length > 0) {
        // Аккуратный вывод деталей
        Object.entries(log.детали).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                console.log(`  • ${key}: ${value}`);
            }
        });
    }
    
    // Если это ответ на предложение - просто строка, без фанатизма
    if (log.действие && log.действие.includes('ОТВЕТ')) {
        herAnswer = log;
        console.log(`  💬 Ответ: ${log.детали?.ответ || ''}`);
    }
    
    // Храним только последние 200 логов
    if (logs.length > 200) logs = logs.slice(-200);
    
    res.status(200).json({ success: true });
});

// Маршрут для получения логов
app.get('/api/logs', (req, res) => {
    res.json({
        logs: logs,
        herAnswer: herAnswer,
        totalLogs: logs.length
    });
});

// Маршрут для получения её ответа
app.get('/api/her-answer', (req, res) => {
    if (herAnswer) {
        res.json({
            hasAnswer: true,
            answer: herAnswer.детали?.ответ || '',
            time: herAnswer.timestamp
        });
    } else {
        res.json({
            hasAnswer: false,
            answer: null
        });
    }
});

// Минималистичная админка
app.get('/admin', (req, res) => {
    const adminPage = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Логи</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; background: #fafafa; }
            h1 { color: #ff2a78; font-size: 24px; margin-bottom: 20px; }
            .logs { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .log { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
            .log:last-child { border-bottom: none; }
            .time { color: #888; font-size: 12px; margin-bottom: 4px; }
            .action { font-weight: 600; color: #333; }
            .details { color: #666; margin-top: 4px; font-size: 13px; padding-left: 8px; border-left: 2px solid #ffd9e6; }
            .answer { background: #fff0f5; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
            .answer-text { font-size: 16px; color: #ff2a78; margin-top: 8px; word-break: break-word; }
            button { background: #ff2a78; color: white; border: none; padding: 10px 20px; border-radius: 20px; font-size: 14px; cursor: pointer; margin-bottom: 20px; }
            hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
        </style>
    </head>
    <body>
        <h1>💕 Логи</h1>
        
        <div id="answerContainer"></div>
        
        <button onclick="loadLogs()">Обновить</button>
        
        <div class="logs" id="logs">
            <div style="text-align: center; color: #888; padding: 20px;">Загрузка...</div>
        </div>
        
        <script>
            async function loadLogs() {
                const res = await fetch('/api/logs');
                const data = await res.json();
                
                // Показываем ответ
                const answerContainer = document.getElementById('answerContainer');
                if (data.herAnswer) {
                    const answerTime = new Date(data.herAnswer.timestamp).toLocaleString('ru-RU');
                    answerContainer.innerHTML = \`
                        <div class="answer">
                            <div style="font-weight: 600; color: #ff2a78;">💌 Её ответ:</div>
                            <div class="answer-text">\${data.herAnswer.детали?.ответ || ''}</div>
                            <div style="color: #888; font-size: 12px; margin-top: 8px;">\${answerTime}</div>
                        </div>
                    \`;
                } else {
                    answerContainer.innerHTML = '';
                }
                
                // Показываем логи
                const logsDiv = document.getElementById('logs');
                logsDiv.innerHTML = '';
                
                if (data.logs.length === 0) {
                    logsDiv.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Пока нет логов</div>';
                    return;
                }
                
                [...data.logs].reverse().forEach(log => {
                    const time = new Date(log.timestamp).toLocaleString('ru-RU');
                    const logDiv = document.createElement('div');
                    logDiv.className = 'log';
                    
                    let html = \`
                        <div class="time">\${time}</div>
                        <div class="action">\${log.действие || 'Действие'}</div>
                    \`;
                    
                    if (log.детали && Object.keys(log.детали).length > 0) {
                        html += '<div class="details">';
                        Object.entries(log.детали).forEach(([key, value]) => {
                            if (value !== undefined && value !== null) {
                                html += \`<div>• \${key}: \${value}</div>\`;
                            }
                        });
                        html += '</div>';
                    }
                    
                    logDiv.innerHTML = html;
                    logsDiv.appendChild(logDiv);
                });
            }
            
            loadLogs();
            setInterval(loadLogs, 10000);
        </script>
    </body>
    </html>
    `;
    res.send(adminPage);
});

// Раздаём статические файлы
app.use(express.static(path.join(__dirname, '.')));

// Все остальные запросы → index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('=================================');
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Сайт: https://valentinka-to-you.onrender.com`);
    console.log(`📊 Админка: /admin`);
    console.log('=================================');
});
