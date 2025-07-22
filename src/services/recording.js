const { exec } = require('child_process');
const path = require('path');
const { spawn } = require('child_process');
const FFmpegManager = require('../utils/ffmpeg-manager');
const { PATHS } = require('../config/environment');
const database = require('./database');

class RecordingService {
    constructor() {
        this.recordingProcesses = new Map();
        this.recordingIntervals = new Map();
        this.ffmpegManager = null;
        this.initializeFFmpeg();
    }
    
    async initializeFFmpeg() {
        try {
            this.ffmpegManager = await FFmpegManager.create();
            console.log('[RECORDING] FFmpeg inicializado para gravação');
        } catch (error) {
            console.error('[RECORDING] Erro ao inicializar FFmpeg:', error.message);
        }
    }
    
    getFFmpegCommand() {
        if (!this.ffmpegManager) {
            throw new Error('FFmpeg não foi inicializado para gravação');
        }
        return this.ffmpegManager.getFFmpegCommand();
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
            
            try {
                const ffmpegCmd = this.getFFmpegCommand();
                console.log(`[GRAVAÇÃO] Usando FFmpeg: ${ffmpegCmd}`);

                const ffmpegProcess = spawn(ffmpegCmd, [
                    '-i', `rtmp://localhost:1935/live/${streamName}`,
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-t', '60',
                    '-y',
                    outputFile
                ]);

                ffmpegProcess.on('error', (error) => {
                    console.error(`[GRAVAÇÃO] Erro no processo FFmpeg para ${streamName}:`, error);
                    console.error(`[GRAVAÇÃO] Caminho FFmpeg tentado: ${ffmpegCmd}`);
                    console.error(`[GRAVAÇÃO] Verifique se o ffmpeg-static está instalado corretamente`);
                });

            ffmpegProcess.on('exit', (code, signal) => {
                console.log(`[GRAVAÇÃO] Processo finalizado - Código: ${code}, Sinal: ${signal}`);
            });

            ffmpegProcess.stderr.on('data', (data) => {
                const output = data.toString();
                console.log(`[FFmpeg ${streamName}] ${output}`);
                
                // Detectar erros de codec específicos
                if (output.includes('Video codec') && output.includes('is not implemented')) {
                    console.warn(`[GRAVAÇÃO] Codec não suportado detectado para ${streamName}. Considere usar transcodificação.`);
                }
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
            
            } catch (error) {
                console.error(`[GRAVAÇÃO] Erro ao iniciar gravação para ${streamName}:`, error.message);
                console.error(`[GRAVAÇÃO] FFmpeg pode não estar disponível. Execute: npm run test-ffmpeg`);
            }
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

        console.log(`[GRAVAÇÃO MANUAL] Iniciando para ${streamName}: ${outputFile}`);
        
        return new Promise((resolve, reject) => {
            try {
                const ffmpegCmd = this.getFFmpegCommand();
                console.log(`[GRAVAÇÃO MANUAL] Usando FFmpeg: ${ffmpegCmd}`);

                const ffmpegProcess = spawn(ffmpegCmd, [
                    '-i', `rtmp://localhost:1935/live/${streamName}`,
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-t', '60',
                    '-y',
                    outputFile
                ]);

                ffmpegProcess.on('error', (error) => {
                    console.error(`[GRAVAÇÃO MANUAL] Erro no processo FFmpeg para ${streamName}:`, error);
                    console.error(`[GRAVAÇÃO MANUAL] Caminho FFmpeg tentado: ${ffmpegCmd}`);
                    reject(new Error(`FFmpeg não encontrado: ${error.message}`));
                });

            ffmpegProcess.stderr.on('data', (data) => {
                const output = data.toString();
                console.log(`[FFmpeg Manual ${streamName}] ${output}`);
                
                // Detectar erros críticos
                if (output.includes('Video codec') && output.includes('is not implemented')) {
                    console.warn(`[GRAVAÇÃO MANUAL] Codec não suportado detectado para ${streamName}`);
                }
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
            
            } catch (error) {
                console.error(`[GRAVAÇÃO MANUAL] Erro ao iniciar processo para ${streamName}:`, error.message);
                reject(new Error(`FFmpeg não disponível: ${error.message}`));
            }
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