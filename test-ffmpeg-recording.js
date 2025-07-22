#!/usr/bin/env node

const FFmpegManager = require('./src/utils/ffmpeg-manager');
const { spawn } = require('child_process');
const path = require('path');

console.log('🔧 Teste de FFmpeg para Gravação (Multiplataforma)\n');

async function runAllTests() {
    console.log('🌍 Testando compatibilidade do sistema FFmpeg...\n');
    
    try {
        console.log('📍 Inicializando FFmpeg Manager...');
        const ffmpegManager = await FFmpegManager.create();
        
        const ffmpegPath = ffmpegManager.getFFmpegPath();
        const ffmpegCmd = ffmpegManager.getFFmpegCommand();
        
        console.log(`✅ FFmpeg inicializado com sucesso!`);
        console.log(`📁 Caminho: ${ffmpegPath}`);
        console.log(`⚡ Comando: ${ffmpegCmd}`);
        
        await testRecordingCapability(ffmpegCmd);
        
        console.log('\n✅ Sistema de gravação está pronto!');
        console.log('\n� Para resolver problemas de câmeras:');
        console.log('   1. Reinicie o servidor: npm run clean-start');
        console.log('   2. Verifique status: npm run check-camera camera7');
        console.log('   3. Monitor em tempo real: http://localhost:8000/camera-monitor.html');
        
    } catch (error) {
        console.error('❌ Falha no teste de FFmpeg:', error.message);
        console.log('\n💡 Soluções possíveis:');
        
        if (process.platform === 'win32') {
            console.log('📦 Windows:');
            console.log('   1. npm uninstall ffmpeg-static && npm install ffmpeg-static');
            console.log('   2. choco install ffmpeg (se tiver Chocolatey)');
            console.log('   3. scoop install ffmpeg (se tiver Scoop)');
        } else {
            console.log('� Linux/Mac:');
            console.log('   1. npm uninstall ffmpeg-static && npm install ffmpeg-static');
            console.log('   2. sudo apt install ffmpeg (Ubuntu/Debian)');
            console.log('   3. sudo yum install ffmpeg (CentOS/RHEL)');
            console.log('   4. brew install ffmpeg (macOS)');
        }
        
        console.log('\n🔧 Outras verificações:');
        console.log('   - Executar como administrador/root');
        console.log('   - Verificar antivírus/firewall');
        console.log('   - Verificar espaço em disco');
    }
}

function testRecordingCapability(ffmpegCmd) {
    console.log('\n🎬 Testando capacidade de gravação...');
    
    return new Promise((resolve, reject) => {
        // Teste com input dummy para verificar se pode gravar
        const testOutput = path.join(__dirname, 'test-recording.mp4');
        
        const recordTest = spawn(ffmpegCmd, [
            '-f', 'lavfi',
            '-i', 'testsrc=duration=3:size=320x240:rate=1',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-t', '3',
            '-y',
            testOutput
        ]);
        
        let hasError = false;
        
        recordTest.stderr.on('data', (data) => {
            const output = data.toString();
            if (output.includes('not implemented') || output.includes('No such file')) {
                hasError = true;
                console.error(`❌ Erro detectado: ${output.trim()}`);
            }
            // Não logar progresso normal para manter saída limpa
        });
        
        recordTest.on('error', (error) => {
            console.error('❌ Erro no teste de gravação:', error.message);
            reject(error);
        });
        
        recordTest.on('close', (code) => {
            console.log(`🎯 Resultado do teste de gravação: ${code === 0 ? 'SUCESSO' : 'FALHOU'}`);
            
            // Limpar arquivo de teste
            try {
                const fs = require('fs');
                if (fs.existsSync(testOutput)) {
                    fs.unlinkSync(testOutput);
                    console.log('🧹 Arquivo de teste removido');
                }
            } catch (e) {
                console.log('⚠️  Erro ao remover arquivo de teste (não é crítico)');
            }
            
            if (code === 0 && !hasError) {
                resolve();
            } else {
                reject(new Error(`Teste de gravação falhou com código ${code}`));
            }
        });
        
        // Timeout de segurança
        setTimeout(() => {
            recordTest.kill();
            reject(new Error('Teste de gravação timeout'));
        }, 15000);
    });
}

// Executar se chamado diretamente
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    runAllTests,
    testRecordingCapability
};
