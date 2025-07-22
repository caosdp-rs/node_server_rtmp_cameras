const { RTMP_PORT, HTTP_PORT, PATHS } = require('./environment');
const path = require('path');
const ffmpeg = require('ffmpeg-static');


// Tenta encontrar o FFmpeg instalado no sistema ou usa o ffmpeg-static
let ffmpegPath;
try {
    // Primeiro tenta usar o ffmpeg-static
    ffmpegPath = require('ffmpeg-static');
} catch (error) {
    console.error('Erro ao carregar ffmpeg-static:', error);
    // Se falhar, tenta encontrar no sistema
    try {
        ffmpegPath = require('child_process').execSync('which ffmpeg').toString().trim();
    } catch (error) {
        console.error('FFmpeg não encontrado no sistema, usando caminho padrão');
        ffmpegPath = 'ffmpeg'; // último recurso
    }
}

console.log('Usando FFmpeg:', ffmpegPath);

const config = {
  logType: 3,
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: false, // Desabilitar cache GOP para evitar problemas
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: HTTP_PORT,
    allow_origin: '*',
    mediaroot: PATHS.MEDIA,
    webroot: PATHS.PUBLIC
  },
  trans: {
    ffmpeg: ffmpeg,
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments+omit_endlist:hls_allow_cache=0]',
        dash: false,
        options: '-c:v copy -c:a aac -ac 1 -ar 44100 -b:a 96k -reconnect 1 -reconnect_at_eof 1 -reconnect_streamed 1 -reconnect_delay_max 2'
      }
    ]
  },
  relay: {
    ffmpeg: require('ffmpeg-static'),
    tasks: []
  }
};

// Log da configuração para debug
console.log('Node Media Server Config:', JSON.stringify(config, null, 2));

module.exports = config; 