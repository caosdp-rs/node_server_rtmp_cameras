const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');
const ffmpeg = require('ffmpeg-static');
console.log('FFmpeg path:', ffmpeg);

// Teste se o FFmpeg está funcionando
const { execSync } = require('child_process');

// Importações locais
const { PORT, PATHS, RTMP_PORT, HTTP_PORT } = require('./src/config/environment');
const nmsConfig = require('./src/config/mediaServer');
const authMiddleware = require('./src/middleware/auth');
const apiRoutes = require('./src/routes/api');
const recordingService = require('./src/services/recording');
const database = require('./src/services/database');

// Criar diretórios necessários
const requiredDirs = [
  PATHS.RECORDINGS,
  PATHS.PUBLIC,
  PATHS.MEDIA,
  path.join(PATHS.MEDIA, 'live'), // Diretório específico para HLS
  path.join(PATHS.MEDIA, 'photos') // Diretório para fotos das câmeras
];

// Array de câmeras selecionadas para captura de fotos
const selectedCameras = ['camera1', 'camera2']; // Adicione aqui os nomes das câmeras que deseja capturar fotos

requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Diretório criado: ${dir}`);
  }
});

const streamProcesses = new Map();

function startHLSStream(streamName) {
  const hlsDir = path.join(PATHS.MEDIA, 'live', streamName);
  
  // Criar diretório HLS se não existir
  if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
  }

  // Parar processo existente se houver
  if (streamProcesses.has(streamName)) {
    stopHLSStream(streamName);
  }

  const ffmpegProcess = spawn(ffmpeg, [
    '-i', `rtmp://localhost:${RTMP_PORT}/live/${streamName}`,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-ar', '44100',
    '-ac', '1',
    '-b:a', '96k',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments',
    '-hls_segment_filename', path.join(hlsDir, 'segment_%d.ts'),
    path.join(hlsDir, 'index.m3u8')
  ]);

  ffmpegProcess.stderr.on('data', (data) => {
    console.log(`[FFmpeg ${streamName}] ${data.toString()}`);
  });

  ffmpegProcess.on('error', (error) => {
    console.error(`[FFmpeg ${streamName} Error]`, error);
  });

  ffmpegProcess.on('exit', (code, signal) => {
    console.log(`[FFmpeg ${streamName}] Process exited with code ${code} and signal ${signal}`);
    streamProcesses.delete(streamName);
  });

  streamProcesses.set(streamName, ffmpegProcess);
  console.log(`[HLS] Started stream for ${streamName}`);
}

function stopHLSStream(streamName) {
  const process = streamProcesses.get(streamName);
  if (process) {
    process.kill('SIGTERM');
    streamProcesses.delete(streamName);
    console.log(`[HLS] Stopped stream for ${streamName}`);
  }
}

// Função para capturar foto de uma câmera específica
function capturePhoto(streamName) {
  return new Promise((resolve, reject) => {
    const photosDir = path.join(PATHS.MEDIA, 'photos');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const photoPath = path.join(photosDir, `${streamName}_${timestamp}.jpg`);

    // Verificar se o stream está ativo
    if (!streamProcesses.has(streamName)) {
      console.log(`[PHOTO] Stream ${streamName} não está ativo, pulando captura`);
      resolve(null);
      return;
    }

    const ffmpegProcess = spawn(ffmpeg, [
      '-i', `rtmp://localhost:${RTMP_PORT}/live/${streamName}`,
      '-vframes', '1',
      '-q:v', '2',
      '-y', // sobrescrever arquivo se existir
      photoPath
    ]);

    let errorOutput = '';

    ffmpegProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[PHOTO ERROR ${streamName}]`, error);
      reject(error);
    });

    ffmpegProcess.on('exit', (code) => {
      if (code === 0) {
        console.log(`[PHOTO] Capturada: ${photoPath}`);
        resolve(photoPath);
      } else {
        console.error(`[PHOTO ERROR ${streamName}] Exit code: ${code}`);
        console.error(`[PHOTO ERROR ${streamName}] Output: ${errorOutput}`);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}

// Função para criar uma foto de teste quando não há streams ativos
function createTestPhoto(streamName) {
  return new Promise((resolve, reject) => {
    const photosDir = path.join(PATHS.MEDIA, 'photos');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const photoPath = path.join(photosDir, `${streamName}_TEST_${timestamp}.jpg`);

    // Criar uma imagem de teste usando FFmpeg (simplificada)
    const ffmpegProcess = spawn(ffmpeg, [
      '-f', 'lavfi',
      '-i', 'color=blue:size=640x480:duration=1',
      '-vframes', '1',
      '-y',
      photoPath
    ]);

    let errorOutput = '';

    ffmpegProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpegProcess.on('error', (error) => {
      console.error(`[TEST PHOTO ERROR ${streamName}]`, error);
      reject(error);
    });

    ffmpegProcess.on('exit', (code) => {
      if (code === 0) {
        console.log(`[TEST PHOTO] Criada: ${photoPath}`);
        resolve(photoPath);
      } else {
        console.error(`[TEST PHOTO ERROR ${streamName}] Exit code: ${code}`);
        console.error(`[TEST PHOTO ERROR ${streamName}] Output: ${errorOutput}`);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
}

// Função para capturar fotos de todas as câmeras selecionadas
async function capturePhotosFromSelectedCameras() {
  if (selectedCameras.length === 0) {
    console.log('[PHOTO] Nenhuma câmera selecionada para captura de fotos');
    return;
  }

  console.log(`[PHOTO] Iniciando captura de fotos para ${selectedCameras.length} câmera(s)`);
  
  const promises = selectedCameras.map(async (streamName) => {
    try {
      // Tentar capturar do stream ativo primeiro
      const result = await capturePhoto(streamName);
      
      // Se não conseguiu capturar do stream (resultado null), criar foto de teste
      if (result === null) {
        console.log(`[PHOTO] Criando foto de teste para ${streamName}`);
        await createTestPhoto(streamName);
      }
    } catch (error) {
      console.error(`[PHOTO] Erro ao capturar foto da câmera ${streamName}:`, error.message);
      // Em caso de erro, tentar criar foto de teste
      try {
        console.log(`[PHOTO] Tentando criar foto de teste para ${streamName} após erro`);
        await createTestPhoto(streamName);
      } catch (testError) {
        console.error(`[PHOTO] Erro ao criar foto de teste para ${streamName}:`, testError.message);
      }
    }
  });

  await Promise.allSettled(promises);
  console.log('[PHOTO] Ciclo de captura de fotos concluído');
}

// Configuração do Node Media Server
const nms = new NodeMediaServer(nmsConfig);

// Eventos do Node Media Server
nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent preConnect]', `id=${id}`, args);
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent postConnect]', `id=${id}`, args);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent prePublish]', `id=${id}`, `StreamPath=${StreamPath}`, args);
  const streamName = StreamPath.split('/')[2];
  console.log(`[STREAM] Autorizando ${streamName}`);
});

nms.on('postPublish', (id, StreamPath, args) => {
  const streamName = StreamPath.split('/')[2];
  console.log(`[STREAM ON] ${streamName}`);
  startHLSStream(streamName);
  recordingService.startContinuousRecording(streamName);

});

nms.on('donePublish', (id, StreamPath, args) => {
  const streamName = StreamPath.split('/')[2];
  console.log(`[STREAM OFF] ${streamName}`);
  stopHLSStream(streamName);
  recordingService.stopContinuousRecording(streamName);

});

// Garantir que todos os processos FFmpeg sejam encerrados ao fechar o servidor
process.on('SIGTERM', () => {
  recordingService.cleanup();

  streamProcesses.forEach((process) => {
    process.kill('SIGTERM');
  });
  process.exit(0);
});

process.on('SIGINT', () => {
  recordingService.cleanup();

  streamProcesses.forEach((process) => {
    process.kill('SIGTERM');
  });
  process.exit(0);
});

// Tratamento de erros
process.on('uncaughtException', (err) => {
  console.error('[Erro não tratado]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Promessa rejeitada não tratada]', reason);
});

// Iniciar servidor
nms.run();

// Configuração do Express
const app = express();

// Middlewares
app.use(express.json()); // Middleware para parsing de JSON
app.use(express.urlencoded({ extended: true })); // Middleware para parsing de form data
app.use(authMiddleware);
app.use(express.static(PATHS.PUBLIC));
app.use('/recordings', express.static(PATHS.RECORDINGS));

// Configurar rota específica para arquivos HLS
app.use('/live', express.static(path.join(PATHS.MEDIA, 'live')));

// Configurar rota para fotos capturadas
app.use('/photos', express.static(path.join(PATHS.MEDIA, 'photos')));

// Configurar proxy para o servidor HLS
app.use('/live', createProxyMiddleware({
  target: `http://localhost:${HTTP_PORT}`,
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/live': '/live' // mantém o path /live
  },
  onError: (err, req, res) => {
    console.error('Proxy Error:', err);
    res.status(502).send('Proxy Error');
  }
}));

// Adicionar headers CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Log de requisições para debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rota /files movida para o nível principal
app.get('/files', async (req, res) => {
  try {
    const files = await fs.promises.readdir(PATHS.RECORDINGS);
    res.json(files.filter(f => f.endsWith('.mp4')));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao ler arquivos' });
  }
});

// Outras rotas da API
app.use('/api', apiRoutes);
app.get('/', (req, res) => {
  res.sendFile(path.join(PATHS.PUBLIC, 'index.html'));
});

// Iniciar servidor Express
app.listen(PORT, () => {
  console.log("Nova versão-X2");
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

// Captura automática de fotos a cada 1 minuto
setInterval(async () => {
  await capturePhotosFromSelectedCameras();
}, 60000); // 60000ms = 1 minuto

console.log('[PHOTO] Sistema de captura automática de fotos iniciado (intervalo: 1 minuto)');

// Exportar funções para uso nas rotas API
module.exports = {
  getSelectedCameras: () => selectedCameras,
  setSelectedCameras: (cameras) => {
    selectedCameras.splice(0, selectedCameras.length, ...cameras);
    console.log(`[PHOTO] Câmeras selecionadas atualizadas: ${cameras.join(', ')}`);
  },
  capturePhotosFromSelectedCameras
};