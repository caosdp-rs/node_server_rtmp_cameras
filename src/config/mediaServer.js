const { RTMP_PORT, HTTP_PORT, PATHS } = require('./environment');
const { execSync } = require('child_process');

const ffmpegPath = execSync('which ffmpeg').toString().trim();

module.exports = {
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
    mediaroot: PATHS.MEDIA
  },
  trans: {
    ffmpeg: ffmpegPath,
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=60:hls_list_size=1:hls_flags=delete_segments]',
        dash: false
      }
    ]
  }
}; 