const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Caminho dinâmico do ffmpeg
const ffmpegPath = require('child_process')
  .execSync('which ffmpeg')
  .toString().trim();

// Diretórios
const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

// Controle de gravações por câmera
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

// Iniciar gravação contínua de 60s para a câmera
function startContinuousRecording(streamName) {
  if (recordingTimers[streamName]) return;

  let index = 1;
  recordingTimers[streamName] = setInterval(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(recordingsDir, `${streamName}-${timestamp}.mp4`);
    const ffmpegCommand = `${ffmpegPath} -i rtmp://localhost:1935/live/${streamName} -c copy -f mp4 -t 60 -y "${outputFile}"`;

    exec(ffmpegCommand, (error) => {
      if (error) {
        console.error(`[ERRO] Gravação ${streamName}: ${error.message}`);
      } else {
        console.log(`[INFO] Gravado: ${outputFile}`);
      }
    });
  }, 60000); // a cada 60s
}

// Parar gravação (se necessário futuramente)
function stopRecording(streamName) {
  if (recordingTimers[streamName]) {
    clearInterval(recordingTimers[streamName]);
    delete recordingTimers[streamName];
  }
}

// Quando começa o stream
nms.on('postPublish', (id, streamPath, args) => {
  const streamName = streamPath.split('/')[2];
  console.log(`[STREAM ON] ${streamName}`);
  startContinuousRecording(streamName);
});

// Quando o stream para
nms.on('donePublish', (id, streamPath, args) => {
  const streamName = streamPath.split('/')[2];
  console.log(`[STREAM OFF] ${streamName}`);
  stopRecording(streamName);
});

nms.run();

// Servidor web para acessar gravações
const app = express();
const PORT = 3000;

app.use('/recordings', express.static(recordingsDir));

app.get('/', (req, res) => {
  res.send(`<h2>Servidor de Gravações</h2><p>Acesse <a href="/recordings">/recordings</a> para ver os arquivos.</p>`);
});

app.listen(PORT, () => {
  console.log(`Servidor web rodando: http://localhost:${PORT}`);
});
