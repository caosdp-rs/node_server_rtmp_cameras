const { RTMP_PORT, HTTP_PORT, PATHS } = require('./environment');
const path = require('path');

const config = {
  logType: 3,
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
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
    ffmpeg: require('ffmpeg-static'),
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments+append_list]',
        dash: false,
        options: '-c:v copy -c:a aac -ac 1 -ar 44100 -b:a 96k'
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