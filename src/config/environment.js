const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');

module.exports = {
  PORT: process.env.PORT || 3000,
  RTMP_PORT: process.env.RTMP_PORT || 1935,
  HTTP_PORT: process.env.HTTP_PORT || 8000,
  BEARER_TOKEN: process.env.BEARER_TOKEN || 'painel123',
  
  PATHS: {
    RECORDINGS: path.join(ROOT_DIR, 'recordings'),
    PUBLIC: path.join(ROOT_DIR, 'public'),
    MEDIA: path.join(ROOT_DIR, 'media'),
    STREAM_KEYS: path.join(ROOT_DIR, 'streamKeys.json'),
    DATABASE: path.join(ROOT_DIR, 'videos.db')
  },
  
  CLEANUP: {
    INTERVAL: 60000, // 1 minuto
    VIDEO_RETENTION: 10 * 60 * 1000 // 10 minutos
  }
}; 