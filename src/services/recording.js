const { exec } = require('child_process');
const path = require('path');
const { PATHS } = require('../config/environment');
const database = require('./database');
const { execSync } = require('child_process');

const ffmpegPath = execSync('which ffmpeg').toString().trim();
const recordingTimers = {};

class RecordingService {
  startContinuousRecording(streamName) {
    if (recordingTimers[streamName]) return;
    
    recordingTimers[streamName] = setInterval(() => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(PATHS.RECORDINGS, `${streamName}-${timestamp}.mp4`);
      const cmd = `${ffmpegPath} -i rtmp://localhost:1935/live/${streamName} -c copy -f mp4 -t 60 -y "${outputFile}"`;
      
      exec(cmd, async (error) => {
        if (error) {
          console.error(`[ERRO] Gravação ${streamName}: ${error.message}`);
        } else {
          console.log(`[INFO] Gravado: ${outputFile}`);
          await database.saveVideo(path.basename(outputFile), outputFile);
        }
      });
    }, 60000);
  }

  stopRecording(streamName) {
    if (recordingTimers[streamName]) {
      clearInterval(recordingTimers[streamName]);
      delete recordingTimers[streamName];
    }
  }

  async saveManualRecording(camera) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(PATHS.RECORDINGS, `${camera}-manual-${timestamp}.mp4`);
    const cmd = `${ffmpegPath} -i rtmp://localhost:1935/live/${camera} -c copy -f mp4 -t 60 -y "${outputFile}"`;

    return new Promise((resolve, reject) => {
      exec(cmd, async (error) => {
        if (error) {
          reject(error);
        } else {
          await database.saveVideo(path.basename(outputFile), outputFile, true);
          resolve(path.basename(outputFile));
        }
      });
    });
  }
}

module.exports = new RecordingService(); 