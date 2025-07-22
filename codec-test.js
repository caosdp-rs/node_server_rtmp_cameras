#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');

console.log('=== Teste de Compatibilidade de Codecs FFmpeg ===\n');

// Função para testar FFmpeg básico
function testFFmpegBasic() {
  console.log('🔄 Testando FFmpeg básico...');
  try {
    const version = execSync(`"${ffmpeg}" -version`, { encoding: 'utf8', timeout: 5000 });
    const versionLine = version.split('\n')[0];
    console.log(`✅ ${versionLine}`);
    
    // Extrair número da versão
    const versionMatch = versionLine.match(/ffmpeg version (\d+\.\d+)/);
    if (versionMatch) {
      const versionNum = parseFloat(versionMatch[1]);
      if (versionNum < 4.0) {
        console.log('⚠️  Versão do FFmpeg pode ser muito antiga para alguns codecs');
      }
    }
    return true;
  } catch (err) {
    console.log('❌ Erro ao executar FFmpeg:', err.message);
    return false;
  }
}

// Função para testar codecs específicos
function testCodecs() {
  console.log('\n🔄 Testando codecs disponíveis...');
  
  const codecsToTest = [
    { name: 'libx264', type: 'encoder' },
    { name: 'h264', type: 'decoder' },
    { name: 'aac', type: 'encoder' },
    { name: 'copy', type: 'special' }
  ];
  
  codecsToTest.forEach(codec => {
    try {
      if (codec.name === 'copy') {
        console.log('✅ copy codec (stream copy) - sempre disponível');
        return;
      }
      
      const result = execSync(`"${ffmpeg}" -hide_banner -${codec.type}s 2>&1 | findstr ${codec.name}`, 
        { encoding: 'utf8', timeout: 5000 });
      
      if (result.includes(codec.name)) {
        console.log(`✅ ${codec.name} (${codec.type}) - disponível`);
      } else {
        console.log(`❌ ${codec.name} (${codec.type}) - não encontrado`);
      }
    } catch (err) {
      console.log(`❌ ${codec.name} (${codec.type}) - não disponível`);
    }
  });
}

// Função para testar formato FLV
function testFLVSupport() {
  console.log('\n🔄 Testando suporte a FLV...');
  try {
    const formats = execSync(`"${ffmpeg}" -hide_banner -formats 2>&1 | findstr flv`, 
      { encoding: 'utf8', timeout: 5000 });
    
    if (formats.includes('flv')) {
      console.log('✅ Formato FLV suportado');
    } else {
      console.log('❌ Formato FLV não suportado');
    }
  } catch (err) {
    console.log('❌ Erro ao verificar suporte FLV');
  }
}

// Função para sugerir soluções
function suggestSolutions() {
  console.log('\n💡 Soluções para problemas de codec:');
  console.log('');
  console.log('1. 📦 Instalar FFmpeg completo:');
  console.log('   - Via Chocolatey: choco install ffmpeg-full');
  console.log('   - Via Scoop: scoop install ffmpeg');
  console.log('   - Download manual: https://ffmpeg.org/download.html');
  console.log('');
  console.log('2. 🔧 Configurar transcodificação automática:');
  console.log('   - O servidor já foi configurado para detectar erros de codec');
  console.log('   - Automaticamente usa libx264 como fallback');
  console.log('');
  console.log('3. 📹 Verificar configuração da câmera:');
  console.log('   - Tentar usar codec H.264 na câmera');
  console.log('   - Evitar codecs proprietários ou muito novos');
  console.log('');
  console.log('4. 🔍 Testar stream manualmente:');
  console.log(`   - ffmpeg -i rtmp://localhost:1935/live/camera1 -t 5 -f null -`);
}

// Função para testar stream RTMP simulado
function testRTMPStream() {
  console.log('\n🔄 Testando capacidade de processamento RTMP...');
  
  return new Promise((resolve) => {
    // Criar um teste com input dummy
    const testProcess = spawn(ffmpeg, [
      '-f', 'lavfi',
      '-i', 'testsrc=duration=2:size=320x240:rate=1',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-f', 'flv',
      '-t', '2',
      '-y',
      'test_output.flv'
    ]);
    
    let hasError = false;
    
    testProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('not implemented') || output.includes('No such file')) {
        hasError = true;
      }
    });
    
    testProcess.on('exit', (code) => {
      if (code === 0 && !hasError) {
        console.log('✅ Teste de processamento bem-sucedido');
        // Limpar arquivo de teste
        try {
          const fs = require('fs');
          if (fs.existsSync('test_output.flv')) {
            fs.unlinkSync('test_output.flv');
          }
        } catch (e) {
          // Ignorar erro de limpeza
        }
      } else {
        console.log('❌ Teste de processamento falhou');
      }
      resolve();
    });
    
    // Timeout de segurança
    setTimeout(() => {
      testProcess.kill();
      console.log('⏱️  Teste de processamento timeout');
      resolve();
    }, 10000);
  });
}

// Executar todos os testes
async function runAllTests() {
  console.log('Testando compatibilidade do sistema FFmpeg...\n');
  
  if (!testFFmpegBasic()) {
    console.log('\n❌ FFmpeg não está funcionando. Verifique a instalação.');
    return;
  }
  
  testCodecs();
  testFLVSupport();
  await testRTMPStream();
  suggestSolutions();
  
  console.log('\n✅ Teste de codecs concluído!');
}

// Executar se chamado diretamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testFFmpegBasic,
  testCodecs,
  testFLVSupport,
  testRTMPStream,
  runAllTests
};
