const NodeMediaServer = require('node-media-server');
const express = require('express');
const path = require('path');

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
  }
};

// Inicialização do servidor RTMP
const nms = new NodeMediaServer(config);
nms.run();

// Configuração do servidor web
const app = express();
const PORT = 3000;

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor web
app.listen(PORT, () => {
  console.log(`Servidor web rodando em http://localhost:${PORT}`);
  console.log(`Servidor RTMP rodando em rtmp://localhost:${config.rtmp.port}`);
}); 