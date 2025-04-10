const { exec } = require('child_process');
const path = require('path');
const { spawn } = require('child_process');
// const ffmpeg = require('ffmpeg-static'); // removido
const ffmpeg = '/usr/bin/ffmpeg'; // caminho absoluto no Linux
const { PATHS } = require('../config/environment');
const database = require('./database');

class RecordingService {
    constructor() {
        this.recordingProcesses = new Map();
        this.recordingIntervals = new Map();
    }

    startContinuousRecording(streamName) {
        if (this.recordingIntervals.has(streamName)) {
            console.log(`[GRAVAÇÃO] Já existe gravação para ${streamName}`);
            return;
        }

        console.log(`[GRAVAÇÃO] Iniciando gravação contínua para ${streamName}`);

        // Função para iniciar uma nova gravação
        const startNewRecording = () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFile = path.join(PATHS.RECORDINGS, `${streamName}-${timestamp}.mp4`);

            console.log(`[GRAVAÇÃO] Iniciando novo arquivo: ${outputFile}`);

            const ffmpegProcess = spawn(ffmpeg, [
                '-i', `rtmp://localhost:1935/live/${streamName}`,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-t', '60',
                '-y',
                outputFile
            ]);
            ffmpegProcess.on('exit', (code, signal) => {
              console.log(`[EXIT] Código: ${code}, Sinal: ${signal}`);
          });
            ffmpegProcess.stderr.on('data', (data) => {
                console.log(`[FFmpeg ${streamName}] ${data.toString()}`);
            });

            ffmpegProcess.on('close', (code) => {
                console.log(`[GRAVAÇÃO] Finalizada gravação UUUUUUU: ${outputFile} (código: ${code})`);
                if (code === 0) {
                    // Salvar no banco de dados apenas se a gravação foi bem sucedida
                    database.saveVideo(path.basename(outputFile), outputFile)
                        .then(() => console.log(`[DB] Gravação salva: ${outputFile}`))
                        .catch(err => console.error(`[DB] Erro ao salvar gravação:`, err));
                }
                this.recordingProcesses.delete(streamName);
            });

            ffmpegProcess.on('error', (err) => {
                console.error(`[GRAVAÇÃO] Erro no processo FFmpeg para ${streamName}:`, err);
                this.recordingProcesses.delete(streamName);
            });

            this.recordingProcesses.set(streamName, ffmpegProcess);
        };

        // Inicia primeira gravação imediatamente
        startNewRecording();

        // Configura intervalo para novas gravações
        const interval = setInterval(() => {
            // Se já existe um processo de gravação, não inicia outro
            if (!this.recordingProcesses.has(streamName)) {
                startNewRecording();
            } else {
                console.log(`[GRAVAÇÃO] Aguardando gravação anterior de ${streamName} finalizar`);
            }
        }, 60000); // 60 segundos

        this.recordingIntervals.set(streamName, interval);
    }

    stopContinuousRecording(streamName) {
        console.log(`[GRAVAÇÃO] Parando gravação contínua para ${streamName}`);

        // Limpa o intervalo
        const interval = this.recordingIntervals.get(streamName);
        if (interval) {
            clearInterval(interval);
            this.recordingIntervals.delete(streamName);
        }

        // Encerra o processo de gravação atual
        const process = this.recordingProcesses.get(streamName);
        if (process) {
            process.kill('SIGTERM');
            this.recordingProcesses.delete(streamName);
        }
    }

    async saveManualRecording(streamName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputFile = path.join(PATHS.RECORDINGS, `${streamName}-manual-${timestamp}.mp4`);

        return new Promise((resolve, reject) => {
            const ffmpegProcess = spawn(ffmpeg, [
                '-i', `rtmp://localhost:1935/live/${streamName}`,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-t', '60',
                '-y',
                outputFile
            ]);

            ffmpegProcess.stderr.on('data', (data) => {
                console.log(`[FFmpeg Manual ${streamName}] ${data.toString()}`);
            });

            ffmpegProcess.on('close', async (code) => {
                if (code === 0) {
                    try {
                        await database.saveVideo(path.basename(outputFile), outputFile, true);
                        resolve(path.basename(outputFile));
                    } catch (err) {
                        reject(err);
                    }
                } else {
                    reject(new Error(`FFmpeg process exited with code ${code}`));
                }
            });

            ffmpegProcess.on('error', (err) => {
                reject(err);
            });
        });
    }

    cleanup() {
        // Limpa todos os processos e intervalos ao encerrar
        for (const [streamName] of this.recordingIntervals) {
            this.stopContinuousRecording(streamName);
        }
    }
}

module.exports = new RecordingService(); 