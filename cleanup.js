#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Script de Limpeza do Sistema de Câmeras ===');

// Função para testar codecs FFmpeg
function testFFmpegCodecs() {
  try {
    console.log('🔄 Testando codecs FFmpeg...');
    
    // Testar se libx264 está disponível
    const codecTest = execSync('ffmpeg -hide_banner -codecs | findstr libx264', { encoding: 'utf8' });
    if (codecTest.includes('libx264')) {
      console.log('✅ Codec libx264 disponível');
    }
    
    // Testar se AAC está disponível  
    const aacTest = execSync('ffmpeg -hide_banner -codecs | findstr aac', { encoding: 'utf8' });
    if (aacTest.includes('aac')) {
      console.log('✅ Codec AAC disponível');
    }
    
    // Mostrar versão do FFmpeg
    const version = execSync('ffmpeg -version', { encoding: 'utf8' });
    const versionLine = version.split('\n')[0];
    console.log(`ℹ️  ${versionLine}`);
    
  } catch (err) {
    console.log('❌ Erro ao testar codecs FFmpeg:', err.message);
    console.log('💡 Considere instalar uma versão completa do FFmpeg');
  }
}

// Função para matar processos FFmpeg órfãos
function killOrphanFFmpegProcesses() {
  try {
    console.log('🔄 Verificando processos FFmpeg órfãos...');
    execSync('taskkill /f /im ffmpeg.exe', { stdio: 'ignore' });
    console.log('✅ Processos FFmpeg órfãos eliminados');
  } catch (err) {
    console.log('ℹ️  Nenhum processo FFmpeg órfão encontrado');
  }
}

// Função para limpar arquivos HLS
function cleanHLSFiles(basePath = './media/live') {
  try {
    console.log('🔄 Limpando arquivos HLS...');
    
    if (!fs.existsSync(basePath)) {
      console.log('ℹ️  Diretório HLS não existe');
      return;
    }

    const cameraDirs = fs.readdirSync(basePath);
    let totalFiles = 0;

    cameraDirs.forEach(cameraDir => {
      const cameraPath = path.join(basePath, cameraDir);
      
      if (fs.statSync(cameraPath).isDirectory()) {
        const files = fs.readdirSync(cameraPath);
        
        files.forEach(file => {
          if (file.endsWith('.ts') || file.endsWith('.m3u8')) {
            const filePath = path.join(cameraPath, file);
            try {
              fs.unlinkSync(filePath);
              totalFiles++;
            } catch (err) {
              console.error(`❌ Erro ao remover ${file}:`, err.message);
            }
          }
        });
      }
    });

    console.log(`✅ ${totalFiles} arquivos HLS removidos`);
  } catch (err) {
    console.error('❌ Erro ao limpar arquivos HLS:', err.message);
  }
}

// Função para verificar portas ocupadas
function checkPorts() {
  console.log('🔄 Verificando portas ocupadas...');
  
  try {
    // Verificar porta RTMP (1935)
    const rtmpCheck = execSync('netstat -an | findstr :1935', { encoding: 'utf8' });
    if (rtmpCheck.trim()) {
      console.log('⚠️  Porta RTMP (1935) está ocupada');
      console.log(rtmpCheck);
    }
  } catch (err) {
    console.log('✅ Porta RTMP (1935) está livre');
  }

  try {
    // Verificar porta HTTP (8000)
    const httpCheck = execSync('netstat -an | findstr :8000', { encoding: 'utf8' });
    if (httpCheck.trim()) {
      console.log('⚠️  Porta HTTP (8000) está ocupada');
      console.log(httpCheck);
    }
  } catch (err) {
    console.log('✅ Porta HTTP (8000) está livre');
  }
}

// Executar limpeza
function runCleanup() {
  console.log('🚀 Iniciando limpeza do sistema...\n');
  
  testFFmpegCodecs();
  console.log('');
  
  killOrphanFFmpegProcesses();
  console.log('');
  
  cleanHLSFiles();
  console.log('');
  
  checkPorts();
  console.log('');
  
  console.log('✅ Limpeza concluída! O sistema está pronto para iniciar.\n');
}

// Verificar se foi chamado diretamente
if (require.main === module) {
  runCleanup();
}

module.exports = {
  testFFmpegCodecs,
  killOrphanFFmpegProcesses,
  cleanHLSFiles,
  checkPorts,
  runCleanup
};
