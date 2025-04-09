const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('videos.db');

// Criar tabela se não existir
db.run(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    salvar INTEGER DEFAULT 0
  )
`);

// FFmpeg
const ffmpegPath = require('child_process').execSync('which ffmpeg').toString().trim();

// Diretórios
const recordingsDir = path.join(__dirname, 'recordings');
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

// Chaves de stream
const keysPath = path.join(__dirname, 'streamKeys.json');
const streamKeys = JSON.parse(fs.readFileSync(keysPath));

// Config NMS
const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: path.join(__dirname, 'media') // por exemplo
  },
  trans: {
    ffmpeg: ffmpegPath,
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=60:hls_list_size=1:hls_flags=delete_segments]',
        dash: false
      }
    ]
  }
};

const recordingTimers = {};
const nms = new NodeMediaServer(config);

// Autenticação do stream RTMP
nms.on('prePublish', (id, StreamPath, args) => {
  const session = nms.getSession(id);
  const streamName = StreamPath.split('/')[2];
  const sentKey = args.key;

  // if (!streamKeys[streamName] || streamKeys[streamName] !== sentKey) {
  //   console.log(`[REJEITADO] Stream ${streamName} com key inválida`);
  //   session.reject();
  // } else {
  //   console.log(`[AUTORIZADO] Stream ${streamName}`);
  // }
  console.log(`[AUTORIZADO] Stream ${streamName}`);
});

// Iniciar gravação contínua
function startContinuousRecording(streamName) {
  if (recordingTimers[streamName]) return;
  
  recordingTimers[streamName] = setInterval(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(recordingsDir, `${streamName}-${timestamp}.mp4`);
    const cmd = `${ffmpegPath} -i rtmp://localhost:1935/live/${streamName} -c copy -f mp4 -t 60 -y "${outputFile}"`;
    exec(cmd, (error) => {
      if (error) {
        console.error(`[ERRO] Gravação ${streamName}: ${error.message}`);
      } else {
        console.log(`[INFO] Gravado: ${outputFile}`);
        saveToDatabase(path.basename(outputFile), outputFile);
      }
    });
  }, 60000);
}
function saveToDatabase(filename, filepath, salvar = false) {
  const timestamp = Date.now();
  db.run(
    `INSERT INTO videos (filename, path, timestamp, salvar) VALUES (?, ?, ?, ?)`,
    [filename, filepath, timestamp, salvar ? 1 : 0]
  );
}
function stopRecording(streamName) {
  if (recordingTimers[streamName]) {
    clearInterval(recordingTimers[streamName]);
    delete recordingTimers[streamName];
  }
}

nms.on('postPublish', (id, streamPath, args) => {
  const streamName = streamPath.split('/')[2];
  console.log(`[STREAM ON] ${streamName}`);
  startContinuousRecording(streamName);
});

nms.on('donePublish', (id, streamPath, args) => {
  const streamName = streamPath.split('/')[2];
  console.log(`[STREAM OFF] ${streamName}`);
  stopRecording(streamName);
});

nms.run();

// Servidor Web Express
const app = express();
const PORT = 3000;

// Proteção do painel com token Bearer
app.use((req, res, next) => {
  // if (req.path === '/' || req.path.startsWith('/recordings') || req.path === '/files') {
  //   const auth = req.headers.authorization;
  //   if (!auth || auth !== 'Bearer painel123') {
  //     res.setHeader('WWW-Authenticate', 'Bearer realm="Painel"');
  //     return res.status(401).send('Não autorizado');
  //   }
  // }
  next();
});

app.use(express.static(publicDir));
app.use('/recordings', express.static(recordingsDir));
app.use('/live', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
  ws: true
}));
// Página HTML do painel
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Salvar 60 segundos sob demanda
app.post('/save/:camera', (req, res) => {
  const camera = req.params.camera;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(recordingsDir, `${camera}-manual-${timestamp}.mp4`);
  const cmd = `${ffmpegPath} -i rtmp://localhost:1935/live/${camera} -c copy -f mp4 -t 60 -y "${outputFile}"`;

  exec(cmd, (error) => {
    if (error) {
      console.error(`[ERRO MANUAL] ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
    saveToDatabase(path.basename(outputFile), outputFile, true);
    res.json({ success: true, file: `/recordings/${path.basename(outputFile)}` });
  });
});

// Listar gravações
app.get('/files', (req, res) => {
  fs.readdir(recordingsDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler arquivos' });
    res.json(files.filter(f => f.endsWith('.mp4')));
  });
});

app.listen(PORT, () => {
  console.log("Nova versão");
  console.log(`Painel: http://localhost:${PORT} (requer Bearer Token)`);
});
// Atualiza a flag "salvar" para true de um vídeo
app.put('/salvar/:filename', (req, res) => {
  const filename = req.params.filename;

  db.run(
    `UPDATE videos SET salvar = 1 WHERE filename = ?`,
    [filename],
    function (err) {
      if (err) {
        console.error(`[ERRO UPDATE] ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'Arquivo não encontrado.' });
      }

      res.json({ success: true, message: `Arquivo ${filename} marcado como "salvar = true"` });
    }
  );
});
// Lista os vídeos marcados como importantes (salvar = true)
app.get('/importantes', (req, res) => {
  db.all(
    `SELECT filename, path, datetime(timestamp / 1000, 'unixepoch', 'localtime') as data_hora FROM videos WHERE salvar = 1 ORDER BY timestamp DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error(`[ERRO DB] ${err.message}`);
        return res.status(500).json({ success: false, error: err.message });
      }

      res.json(rows);
    }
  );
});

setInterval(() => {
  const dezMinutos = 10 * 60 * 1000;
  const agora = Date.now();

  db.all(
    `SELECT * FROM videos WHERE salvar = 0 AND timestamp < ?`,
    [agora - dezMinutos],
    (err, rows) => {
      if (err) return console.error('[DB ERROR]', err);

      rows.forEach(video => {
        fs.unlink(video.path, (err) => {
          if (!err) {
            console.log(`[DELETADO] ${video.filename}`);
            db.run(`DELETE FROM videos WHERE id = ?`, [video.id]);
          } else {
            console.error(`[ERRO AO DELETAR] ${video.filename}:`, err.message);
          }
        });
      });
    }
  );
}, 60000); // verifica a cada 1 minuto