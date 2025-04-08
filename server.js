const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');
const fs = require('fs');

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
    ffmpeg: '/usr/bin/ffmpeg', // Ajuste o caminho do ffmpeg conforme necessário
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

// Criar diretório para os arquivos temporários se não existir
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Inicialização do servidor RTMP
const nms = new NodeMediaServer(config);
nms.run();

// Configuração do servidor web
const app = express();
const PORT = 3000;

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/temp', express.static(tempDir));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor web
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor web rodando em http://0.0.0.0:${PORT}`);
  console.log(`Servidor RTMP rodando em rtmp://0.0.0.0:${config.rtmp.port}`);
}); 