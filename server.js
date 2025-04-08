const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Configuração do servidor RTMP
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
    ffmpeg: '/usr/bin/ffmpeg',
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

// Criar diretórios
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

// Inicialização
const nms = new NodeMediaServer(config);
const ffmpegProcesses = new Map(); // Guardar processos por stream

// Evento quando stream começa
nms.on('prePublish', (id, StreamPath, args) => {
  const streamName = StreamPath.split('/')[2];
  const outputFile = path.join(recordingsDir, `${streamName}.mp4`);

  // Spawn do FFmpeg (grava continuamente sobrescrevendo o mesmo arquivo)
  const ffmpeg = spawn(config.trans.ffmpeg, [
    '-i', `rtmp://localhost:1935${StreamPath}`,
    '-c', 'copy',
    '-f', 'mp4',
    '-y', outputFile
  ]);

  ffmpeg.stderr.on('data', data => {
    console.log(`FFmpeg (${streamName}): ${data}`);
  });

  ffmpeg.on('close', code => {
    console.log(`Gravação encerrada para ${streamName} (code ${code})`);
  });

  ffmpegProcesses.set(id, ffmpeg);
  console.log(`Gravação iniciada para stream ${streamName}`);
});

// Evento quando stream termina
nms.on('donePublish', (id, StreamPath, args) => {
  const ffmpeg = ffmpegProcesses.get(id);
  if (ffmpeg) {
    ffmpeg.kill('SIGINT'); // Encerra o FFmpeg corretamente
    ffmpegProcesses.delete(id);
    console.log(`Gravação parada para stream ${StreamPath}`);
  }
});

nms.run();

// Servidor Web
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/temp', express.static(tempDir));
app.use('/recordings', express.static(recordingsDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Rota para listar os arquivos salvos em /recordings
app.get('/recordings/list', (req, res) => {
  fs.readdir(recordingsDir, (err, files) => {
    if (err) {
      console.error('Erro ao ler o diretório de gravações:', err);
      return res.status(500).send('Erro ao listar gravações.');
    }

    // Filtra apenas arquivos .mp4 e gera links para download
    const mp4Files = files.filter(file => file.endsWith('.mp4'));
    const fileLinks = mp4Files.map(file => `<li><a href="/recordings/${file}" target="_blank">${file}</a></li>`);

    res.send(`
      <h1>Gravações Salvas</h1>
      <ul>
        ${fileLinks.join('\n')}
      </ul>
    `);
  });
});
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor web rodando em http://0.0.0.0:${PORT}`);
  console.log(`Servidor RTMP rodando em rtmp://0.0.0.0:${config.rtmp.port}`);
});
