const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');

// Importações locais
const { PORT, PATHS } = require('./src/config/environment');
const nmsConfig = require('./src/config/mediaServer');
const authMiddleware = require('./src/middleware/auth');
const apiRoutes = require('./src/routes/api');
const recordingService = require('./src/services/recording');
const database = require('./src/services/database');

// Criar diretórios necessários
[PATHS.RECORDINGS, PATHS.PUBLIC].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

// Configuração do Node Media Server
const nms = new NodeMediaServer(nmsConfig);

// Eventos do Node Media Server
nms.on('prePublish', (id, StreamPath, args) => {
  const streamName = StreamPath.split('/')[2];
  console.log(`[AUTORIZADO] Stream ${streamName}`);
});

nms.on('postPublish', (id, streamPath, args) => {
  const streamName = streamPath.split('/')[2];
  console.log(`[STREAM ON] ${streamName}`);
  recordingService.startContinuousRecording(streamName);
});

nms.on('donePublish', (id, streamPath, args) => {
  const streamName = streamPath.split('/')[2];
  console.log(`[STREAM OFF] ${streamName}`);
  recordingService.stopRecording(streamName);
});

// Iniciar Node Media Server
nms.run();

// Configuração do Express
const app = express();

// Middlewares
app.use(authMiddleware);
app.use(express.static(PATHS.PUBLIC));
app.use('/recordings', express.static(PATHS.RECORDINGS));
app.use('/live', createProxyMiddleware({
  target: 'http://localhost:8000',
  changeOrigin: true,
  ws: true
}));

// Rotas
app.use('/api', apiRoutes);
app.get('/', (req, res) => {
  res.sendFile(path.join(PATHS.PUBLIC, 'index.html'));
});

// Iniciar servidor Express
app.listen(PORT, () => {
  console.log("Nova versão");
  console.log(`Painel: http://localhost:${PORT} (requer Bearer Token)`);
});

// Tarefa de limpeza automática
setInterval(async () => {
  const agora = Date.now();
  try {
    const oldVideos = await database.getOldVideos(agora - (10 * 60 * 1000));
    for (const video of oldVideos) {
      try {
        await fs.promises.unlink(video.path);
        await database.deleteVideo(video.id);
        console.log(`[DELETADO] ${video.filename}`);
      } catch (err) {
        console.error(`[ERRO AO DELETAR] ${video.filename}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[DB ERROR]', err);
  }
}, 60000);