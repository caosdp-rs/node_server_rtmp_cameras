const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  RTMP_PORT: process.env.RTMP_PORT || 1935,
  HTTP_PORT: process.env.HTTP_PORT || 8000,
  BEARER_TOKEN: process.env.BEARER_TOKEN || 'painel123',
  
  PATHS: {
    RECORDINGS: path.join(__dirname, '../../recordings'),
    PUBLIC: path.join(__dirname, '../../public'),
    MEDIA: path.join(__dirname, '../../media'),
    STREAM_KEYS: path.join(__dirname, '../../streamKeys.json'),
    DATABASE: path.join(__dirname, '../../videos.db')
  },
  
  CLEANUP: {
    INTERVAL: 60000, // 1 minuto
    VIDEO_RETENTION: 10 * 60 * 1000 // 10 minutos
  }
}; 