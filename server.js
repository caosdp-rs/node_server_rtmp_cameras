const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Caminho dinâmico do FFmpeg
const ffmpegPath = require('child_process').execSync('which ffmpeg').toString().trim();

const recordingsDir = path.join(__dirname, 'recordings');
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

const recordingTimers = {};

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
    allow_origin: '*'
  },
  trans: {
    ffmpeg: ffmpegPath,
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=60:hls_list_size=1:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=1:extra_window_size=0]'
      }
    ]
  }
};

const nms = new NodeMediaServer(config);

// Iniciar gravação contínua
function startContinuousRecording(streamName) {
  if (recordingTimers[streamName]) return;

  recordingTimers[streamName] = setInterval(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(recordingsDir, `${streamName}-${timestamp}.mp4`);
    const cmd = `${ffmpegPath} -i rtmp://localhost:1935/live/${streamName} -c copy -f mp4 -t 60 -y "${outputFile}"`;
    exec(cmd, (error) => {
      if (error) console.error(`[ERRO] Gravação ${streamName}: ${error.message}`);
      else console.log(`[INFO] Gravado: ${outputFile}`);
    });
  }, 60000);
}

// Parar gravação
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

// Servidor Web
const app = express();
const PORT = 3000;

app.use(express.static(publicDir));
app.use('/recordings', express.static(recordingsDir));

// Página HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// API para salvar 60 segundos sob demanda
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
    res.json({ success: true, file: `/recordings/${path.basename(outputFile)}` });
  });
});

// Lista de arquivos gravados
app.get('/files', (req, res) => {
  fs.readdir(recordingsDir, (err, files) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler arquivos' });
    res.json(files.filter(f => f.endsWith('.mp4')));
  });
});

app.listen(PORT, () => {
  console.log(`Servidor web rodando: http://localhost:${PORT}`);
});
