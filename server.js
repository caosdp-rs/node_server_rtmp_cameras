const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');
const FFmpegManager = require('./src/utils/ffmpeg-manager');

// Inicializar FFmpeg Manager
let ffmpegManager = null;
let ffmpeg = null;

async function initializeFFmpeg() {
  console.log('[STARTUP] Inicializando FFmpeg...');
  try {
    ffmpegManager = await FFmpegManager.create();
    ffmpeg = ffmpegManager.getFFmpegPath();
    console.log('[STARTUP] ✅ FFmpeg inicializado com sucesso');
    return true;
  } catch (error) {
    console.error('[STARTUP] ❌ Falha na inicialização do FFmpeg:', error.message);
    console.error('[STARTUP] 💡 Execute: npm run test-ffmpeg para diagnosticar');
    return false;
  }
}

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

// Limpeza inicial - matar processos órfãos e limpar cache
console.log('[STARTUP] Iniciando limpeza do sistema...');
killOrphanFFmpegProcesses();

// Limpar todos os arquivos HLS existentes na inicialização
const liveDir = path.join(PATHS.MEDIA, 'live');
if (fs.existsSync(liveDir)) {
  try {
    const cameraDirs = fs.readdirSync(liveDir);
    cameraDirs.forEach(cameraDir => {
      const cameraPath = path.join(liveDir, cameraDir);
      if (fs.statSync(cameraPath).isDirectory()) {
        cleanHLSFiles(cameraDir);
      }
    });
    console.log('[STARTUP] Cache HLS limpo');
  } catch (err) {
    console.error('[STARTUP] Erro ao limpar cache HLS:', err.message);
  }
}

console.log('[STARTUP] Limpeza do sistema concluída');

const streamProcesses = new Map();
const cameraStatus = new Map(); // Rastrear status de cada câmera
const cameraMetrics = new Map(); // Métricas de cada câmera (uptime, dados recebidos, etc.)

// Função para inicializar status das câmeras
function initializeCameraStatus() {
  const streamKeys = JSON.parse(fs.readFileSync('./streamKeys.json', 'utf8'));
  Object.keys(streamKeys).forEach(camera => {
    cameraStatus.set(camera, {
      isConnected: false,
      isStreaming: false,
      lastSeen: null,
      connectionTime: null,
      hasHLSFiles: false,
      transcoding: false
    });
    cameraMetrics.set(camera, {
      totalConnections: 0,
      totalDisconnections: 0,
      bytesReceived: 0,
      uptime: 0,
      lastError: null
    });
  });
}

// Função para obter status de uma câmera específica
function getCameraStatus(cameraName) {
  return {
    status: cameraStatus.get(cameraName) || null,
    metrics: cameraMetrics.get(cameraName) || null,
    hasProcess: streamProcesses.has(cameraName),
    hlsFiles: getHLSFileStatus(cameraName)
  };
}

// Função para verificar arquivos HLS de uma câmera
function getHLSFileStatus(cameraName) {
  const hlsDir = path.join(PATHS.MEDIA, 'live', cameraName);
  try {
    if (fs.existsSync(hlsDir)) {
      const files = fs.readdirSync(hlsDir);
      const tsFiles = files.filter(f => f.endsWith('.ts'));
      const m3u8Files = files.filter(f => f.endsWith('.m3u8'));
      
      // Verificar se arquivos são recentes (últimos 30 segundos)
      const now = Date.now();
      const recentFiles = files.filter(file => {
        try {
          const filePath = path.join(hlsDir, file);
          const stats = fs.statSync(filePath);
          return (now - stats.mtime.getTime()) < 30000; // 30 segundos
        } catch (e) {
          return false;
        }
      });
      
      return {
        totalFiles: files.length,
        tsFiles: tsFiles.length,
        m3u8Files: m3u8Files.length,
        recentFiles: recentFiles.length,
        hasRecentActivity: recentFiles.length > 0
      };
    }
  } catch (e) {
    return { error: e.message };
  }
  return { totalFiles: 0, hasRecentActivity: false };
}

// Inicializar status das câmeras
initializeCameraStatus();

// Função helper para obter FFmpeg com verificação
function getFFmpegCommand() {
  if (!ffmpegManager || !ffmpeg) {
    throw new Error('FFmpeg não foi inicializado. Execute initializeFFmpeg() primeiro.');
  }
  return ffmpegManager.getFFmpegCommand();
}

// Função para limpar arquivos HLS antigos/corrompidos
function cleanHLSFiles(streamName) {
  const hlsDir = path.join(PATHS.MEDIA, 'live', streamName);
  
  try {
    if (fs.existsSync(hlsDir)) {
      const files = fs.readdirSync(hlsDir);
      files.forEach(file => {
        const filePath = path.join(hlsDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`[CLEANUP] Removido arquivo HLS: ${file}`);
        } catch (err) {
          console.error(`[CLEANUP ERROR] Erro ao remover ${file}:`, err.message);
        }
      });
    }
  } catch (err) {
    console.error(`[CLEANUP ERROR] Erro ao limpar diretório HLS ${streamName}:`, err.message);
  }
}

// Função para matar processos FFmpeg órfãos
function killOrphanFFmpegProcesses() {
  try {
    // No Windows, mata processos ffmpeg que podem estar travados
    execSync('taskkill /f /im ffmpeg.exe', { stdio: 'ignore' });
    console.log('[CLEANUP] Processos FFmpeg órfãos eliminados');
  } catch (err) {
    // Ignora erro se não houver processos para matar
    console.log('[CLEANUP] Nenhum processo FFmpeg órfão encontrado');
  }
}

function startHLSStream(streamName, useTranscoding = false) {
  console.log(`[HLS] Starting stream for ${streamName} (transcoding: ${useTranscoding})`);
  const hlsDir = path.join(PATHS.MEDIA, 'live', streamName);
  
  // Limpar arquivos HLS antigos antes de iniciar
  cleanHLSFiles(streamName);
  
  // Criar diretório HLS se não existir
  if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
  }

  // Parar processo existente se houver
  if (streamProcesses.has(streamName)) {
    stopHLSStream(streamName);
    // Aguardar um pouco para garantir que o processo anterior foi encerrado
    setTimeout(() => {}, 1000);
  }

  // Configuração base do FFmpeg
  const baseArgs = [
    '-i', `rtmp://localhost:${RTMP_PORT}/live/${streamName}`,
    '-avoid_negative_ts', 'make_zero',
    '-fflags', '+genpts'
  ];

  // Configuração de vídeo - usar copy se possível, senão transcodificar
  const videoArgs = useTranscoding ? [
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-maxrate', '2000k',
    '-bufsize', '4000k',
    '-g', '50'
  ] : [
    '-c:v', 'copy'
  ];

  // Configuração de áudio
  const audioArgs = [
    '-c:a', 'aac',
    '-ar', '44100',
    '-ac', '1',
    '-b:a', '96k'
  ];

  // Configuração HLS
  const hlsArgs = [
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+omit_endlist',
    '-hls_allow_cache', '0',
    '-hls_segment_filename', path.join(hlsDir, 'segment_%d.ts'),
    '-reconnect', '1',
    '-reconnect_at_eof', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '2',
    path.join(hlsDir, 'index.m3u8')
  ];

  const ffmpegArgs = [...baseArgs, ...videoArgs, ...audioArgs, ...hlsArgs];
  
  try {
    const ffmpegCmd = getFFmpegCommand();
    console.log(`[FFmpeg ${streamName}] Command: ${ffmpegCmd} ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn(ffmpegCmd, ffmpegArgs);
    
    ffmpegProcess.on('error', (error) => {
      console.error(`[FFmpeg ${streamName}] Erro no processo:`, error);
      console.error(`[FFmpeg ${streamName}] Comando tentado: ${ffmpegCmd}`);
      
      // Tentar reinicializar o FFmpeg se houver erro
      setTimeout(async () => {
        console.log(`[FFmpeg ${streamName}] Tentando reinicializar FFmpeg...`);
        await initializeFFmpeg();
      }, 5000);
    });

  ffmpegProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log(`[FFmpeg ${streamName}] ${output}`);
    
    // Detectar erros de codec e tentar transcodificação como fallback
    if (output.includes('Video codec') && output.includes('is not implemented') && !useTranscoding) {
      console.warn(`[FFmpeg ${streamName}] Codec não suportado detectado. Tentando com transcodificação...`);
      ffmpegProcess.kill('SIGTERM');
      setTimeout(() => {
        startHLSStream(streamName, true); // Retry with transcoding
      }, 2000);
      return;
    }
    
    // Detectar outros erros críticos
    if (output.includes('No such file or directory') || 
        output.includes('Connection refused') ||
        output.includes('Server returned 404 Not Found')) {
      console.error(`[FFmpeg ${streamName}] Erro crítico detectado: ${output}`);
    }
  });

  ffmpegProcess.on('exit', (code, signal) => {
    console.log(`[FFmpeg ${streamName}] Process exited with code ${code} and signal ${signal}`);
    streamProcesses.delete(streamName);
    
    // Se o processo saiu inesperadamente, tentar limpar arquivos corrompidos
    if (code !== 0 && code !== null) {
      console.log(`[FFmpeg ${streamName}] Limpando arquivos após saída inesperada`);
      setTimeout(() => cleanHLSFiles(streamName), 1000);
      
      // Se não estava usando transcodificação e houve erro, tentar com transcodificação
      if (!useTranscoding && (code === 1 || code === 69)) {
        console.warn(`[FFmpeg ${streamName}] Tentando reiniciar com transcodificação devido ao código de saída ${code}`);
        setTimeout(() => {
          startHLSStream(streamName, true);
        }, 3000);
      }
    }
  });

  streamProcesses.set(streamName, ffmpegProcess);
  console.log(`[HLS] Started stream for ${streamName}`);
  
  } catch (error) {
    console.error(`[FFmpeg ${streamName}] Erro ao iniciar processo:`, error.message);
    console.error(`[FFmpeg ${streamName}] FFmpeg pode não estar disponível. Execute: npm run test-ffmpeg`);
  }
}

function stopHLSStream(streamName) {
  const process = streamProcesses.get(streamName);
  if (process) {
    try {
      process.kill('SIGTERM');
      
      // Se SIGTERM não funcionar após 3 segundos, usar SIGKILL
      setTimeout(() => {
        if (streamProcesses.has(streamName)) {
          console.log(`[HLS] Forçando encerramento do processo ${streamName}`);
          try {
            process.kill('SIGKILL');
          } catch (err) {
            console.error(`[HLS] Erro ao forçar encerramento: ${err.message}`);
          }
        }
      }, 3000);
      
    } catch (err) {
      console.error(`[HLS] Erro ao parar processo ${streamName}:`, err.message);
    }
    
    streamProcesses.delete(streamName);
    console.log(`[HLS] Stopped stream for ${streamName}`);
    
    // Limpar arquivos HLS após parar o stream
    setTimeout(() => cleanHLSFiles(streamName), 500);
  }
}

// Função para capturar foto de uma câmera específica
function capturePhoto(streamName) {
  return new Promise((resolve, reject) => {
    const photosDir = path.join(PATHS.MEDIA, 'photos');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const photoPath = path.join(photosDir, `${streamName}_${timestamp}.jpg`);

    console.log(`[PHOTO] Tentando capturar foto do stream: ${streamName}`);

    const ffmpegProcess = spawn(ffmpeg, [
      '-i', `rtmp://localhost:${RTMP_PORT}/live/${streamName}`,
      '-vframes', '1',
      '-q:v', '2',
      '-timeout', '5000000', // 5 segundos de timeout
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
        console.log(`[PHOTO] Capturada do stream RTMP: ${photoPath}`);
        resolve(photoPath);
      } else {
        console.log(`[PHOTO] Falha ao capturar do stream RTMP ${streamName} (código: ${code}), stream pode não estar ativo`);
        // Retorna null para indicar que deve tentar foto de teste
        resolve(null);
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
      // SEMPRE tentar capturar do stream RTMP primeiro
      const result = await capturePhoto(streamName);
      
      // Se não conseguiu capturar do stream, apenas loga e pula
      if (result === null) {
        console.log(`[PHOTO] Stream ${streamName} não disponível, pulando captura`);
        // createTestPhoto DESATIVADO - não cria mais fotos de teste
      }
    } catch (error) {
      console.error(`[PHOTO] Erro ao capturar foto da câmera ${streamName}:`, error.message);
      // createTestPhoto DESATIVADO - não cria mais fotos de teste em caso de erro
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
  
  // Atualizar métricas de conexão
  const streamPath = args.app + '/' + args.streamPath;
  if (streamPath.includes('/live/')) {
    const streamName = streamPath.split('/')[2];
    if (cameraStatus.has(streamName)) {
      const status = cameraStatus.get(streamName);
      status.isConnected = true;
      status.lastSeen = new Date();
      status.connectionTime = new Date();
      
      const metrics = cameraMetrics.get(streamName);
      metrics.totalConnections++;
      
      console.log(`[CAMERA STATUS] ${streamName} conectada`);
    }
  }
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent prePublish]', `id=${id}`, `StreamPath=${StreamPath}`, args);
  const streamName = StreamPath.split('/')[2];
  console.log(`[STREAM] Autorizando ${streamName}`);
});

nms.on('postPublish', (id, StreamPath, args) => {
  const streamName = StreamPath.split('/')[2];
  console.log(`[STREAM ON] ${streamName}`);
  
  // Atualizar status da câmera
  if (cameraStatus.has(streamName)) {
    const status = cameraStatus.get(streamName);
    status.isStreaming = true;
    status.lastSeen = new Date();
    console.log(`[CAMERA STATUS] ${streamName} iniciou streaming`);
  }
  
  startHLSStream(streamName);
  recordingService.startContinuousRecording(streamName);
});

nms.on('donePublish', (id, StreamPath, args) => {
  const streamName = StreamPath.split('/')[2];
  console.log(`[STREAM OFF] ${streamName}`);
  
  // Atualizar status da câmera
  if (cameraStatus.has(streamName)) {
    const status = cameraStatus.get(streamName);
    status.isStreaming = false;
    status.isConnected = false;
    status.lastSeen = new Date();
    
    const metrics = cameraMetrics.get(streamName);
    metrics.totalDisconnections++;
    
    console.log(`[CAMERA STATUS] ${streamName} desconectada`);
  }
  
  stopHLSStream(streamName);
  recordingService.stopContinuousRecording(streamName);
});

// Garantir que todos os processos FFmpeg sejam encerrados ao fechar o servidor
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Iniciando encerramento gracioso...');
  recordingService.cleanup();

  // Parar todos os streams HLS
  streamProcesses.forEach((process, streamName) => {
    stopHLSStream(streamName);
  });
  
  // Aguardar um pouco e depois matar processos órfãos
  setTimeout(() => {
    killOrphanFFmpegProcesses();
    process.exit(0);
  }, 2000);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Iniciando encerramento gracioso...');
  recordingService.cleanup();

  // Parar todos os streams HLS
  streamProcesses.forEach((process, streamName) => {
    stopHLSStream(streamName);
  });
  
  // Aguardar um pouco e depois matar processos órfãos
  setTimeout(() => {
    killOrphanFFmpegProcesses();
    process.exit(0);
  }, 2000);
});

// Tratamento de erros
process.on('uncaughtException', (err) => {
  console.error('[Erro não tratado]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Promessa rejeitada não tratada]', reason);
});

// Função principal para inicializar e iniciar o servidor
async function startServer() {
  console.log('[STARTUP] Iniciando servidor...');
  
  // Inicializar FFmpeg primeiro
  const ffmpegOk = await initializeFFmpeg();
  if (!ffmpegOk) {
    console.error('[STARTUP] ❌ Não foi possível inicializar o FFmpeg. Algumas funcionalidades podem não funcionar.');
    console.error('[STARTUP] 💡 Execute: npm run test-ffmpeg para diagnosticar');
  }
  
  // Iniciar servidor RTMP
  nms.run();
  console.log('[STARTUP] ✅ Servidor RTMP iniciado');
  
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

// Rota para galeria de fotos (página HTML)
app.get('/photos/', (req, res) => {
  res.sendFile(path.join(PATHS.PUBLIC, 'photos.html'));
});

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

// Rota para limpeza manual do cache
app.post('/api/cleanup', (req, res) => {
  try {
    console.log('[API] Iniciando limpeza manual...');
    
    // Matar processos órfãos
    killOrphanFFmpegProcesses();
    
    // Limpar cache HLS de todas as câmeras
    const liveDir = path.join(PATHS.MEDIA, 'live');
    if (fs.existsSync(liveDir)) {
      const cameraDirs = fs.readdirSync(liveDir);
      cameraDirs.forEach(cameraDir => {
        const cameraPath = path.join(liveDir, cameraDir);
        if (fs.statSync(cameraPath).isDirectory()) {
          cleanHLSFiles(cameraDir);
        }
      });
    }
    
    res.json({ success: true, message: 'Limpeza concluída' });
    console.log('[API] Limpeza manual concluída');
  } catch (error) {
    console.error('[API] Erro na limpeza manual:', error);
    res.status(500).json({ success: false, error: error.message });
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

console.log('[STARTUP] ✅ Servidor HTTP iniciado');
}

// Iniciar o servidor
startServer().catch(console.error);

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

// Verificação de saúde dos streams a cada 30 segundos
setInterval(() => {
  streamProcesses.forEach((process, streamName) => {
    if (process.killed) {
      console.log(`[HEALTH] Stream ${streamName} está morto, removendo da lista`);
      streamProcesses.delete(streamName);
      
      // Tentar limpar arquivos corrompidos
      setTimeout(() => cleanHLSFiles(streamName), 1000);
    }
  });
}, 30000); // 30000ms = 30 segundos

console.log('[PHOTO] Sistema de captura automática de fotos iniciado (intervalo: 1 minuto)');
console.log('[HEALTH] Sistema de verificação de saúde dos streams iniciado (intervalo: 30 segundos)');

// Exportar funções para uso nas rotas API
module.exports = {
  getSelectedCameras: () => selectedCameras,
  setSelectedCameras: (cameras) => {
    selectedCameras.splice(0, selectedCameras.length, ...cameras);
    console.log(`[PHOTO] Câmeras selecionadas atualizadas: ${cameras.join(', ')}`);
  },
  capturePhotosFromSelectedCameras,
  cleanHLSFiles,
  killOrphanFFmpegProcesses,
  stopHLSStream,
  startHLSStream,
  getCameraStatus,
  cameraStatus,
  cameraMetrics
};