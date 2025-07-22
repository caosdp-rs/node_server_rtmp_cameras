#!/usr/bin/env node

const axios = require('axios');

const CAMERA_NAME = process.argv[2] || 'camera5';
const SERVER_URL = 'http://localhost:8000';

console.log(`🔍 Verificando status da ${CAMERA_NAME}...`);

async function checkCameraStatus() {
  try {
    console.log(`\n📡 Consultando servidor em ${SERVER_URL}...`);
    
    // Verificar status específico da câmera
    const response = await axios.get(`${SERVER_URL}/api/camera-status/${CAMERA_NAME}`);
    const data = response.data;
    
    if (!data.success) {
      console.log(`❌ Erro: ${data.error}`);
      return;
    }
    
    console.log(`\n📹 Status da ${CAMERA_NAME}:`);
    console.log('═'.repeat(50));
    
    const status = data.status;
    const metrics = data.metrics;
    const hlsFiles = data.hlsFiles;
    
    // Status principal
    console.log(`🔌 Conectada: ${status.isConnected ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`🎬 Streaming: ${status.isStreaming ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`🔄 Transcodificação: ${status.transcoding ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`⚙️  Processo FFmpeg: ${data.hasProcess ? '✅ ATIVO' : '❌ INATIVO'}`);
    
    // Informações de tempo
    if (status.lastSeen) {
      const lastSeen = new Date(status.lastSeen);
      console.log(`🕒 Última atividade: ${lastSeen.toLocaleString('pt-BR')}`);
      
      const timeSince = Math.floor((Date.now() - lastSeen.getTime()) / 1000);
      if (timeSince < 60) {
        console.log(`⏱️  Há ${timeSince} segundos`);
      } else if (timeSince < 3600) {
        console.log(`⏱️  Há ${Math.floor(timeSince / 60)} minutos`);
      } else {
        console.log(`⏱️  Há ${Math.floor(timeSince / 3600)} horas`);
      }
    } else {
      console.log(`🕒 Última atividade: Nunca`);
    }
    
    // Métricas
    console.log(`\n📊 Métricas:`);
    console.log(`   Total de conexões: ${metrics.totalConnections}`);
    console.log(`   Total de desconexões: ${metrics.totalDisconnections}`);
    
    // Arquivos HLS
    console.log(`\n📁 Arquivos HLS:`);
    console.log(`   Total de arquivos: ${hlsFiles.totalFiles || 0}`);
    console.log(`   Segmentos (.ts): ${hlsFiles.tsFiles || 0}`);
    console.log(`   Playlists (.m3u8): ${hlsFiles.m3u8Files || 0}`);
    console.log(`   Arquivos recentes: ${hlsFiles.recentFiles || 0}`);
    console.log(`   Atividade recente: ${hlsFiles.hasRecentActivity ? '✅ SIM' : '❌ NÃO'}`);
    
    // Diagnóstico
    console.log(`\n🩺 Diagnóstico:`);
    if (status.isStreaming && hlsFiles.hasRecentActivity) {
      console.log(`✅ Câmera funcionando normalmente - dados sendo recebidos`);
    } else if (status.isConnected && !status.isStreaming) {
      console.log(`⚠️  Câmera conectada mas não está enviando stream`);
    } else if (!status.isConnected && hlsFiles.hasRecentActivity) {
      console.log(`⚠️  Arquivos recentes encontrados mas câmera desconectada`);
    } else if (!status.isConnected && !hlsFiles.hasRecentActivity) {
      console.log(`❌ Câmera offline - nenhum dado sendo recebido`);
    }
    
    // Sugestões
    console.log(`\n💡 Próximos passos:`);
    if (!status.isConnected) {
      console.log(`   1. Verificar se a câmera está enviando para: rtmp://seu-servidor:1935/live/${CAMERA_NAME}`);
      console.log(`   2. Verificar conectividade de rede da câmera`);
      console.log(`   3. Verificar se o stream key está correto: ${CAMERA_NAME}`);
    }
    
    if (status.isConnected && !hlsFiles.hasRecentActivity) {
      console.log(`   1. Verificar logs do FFmpeg para erros de codec`);
      console.log(`   2. Executar: npm run test-codecs`);
      console.log(`   3. Verificar se há processos FFmpeg órfãos`);
    }
    
    console.log(`\n🌐 Para monitoramento em tempo real, acesse:`);
    console.log(`   ${SERVER_URL}/camera-monitor.html`);
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`❌ Erro: Servidor não está rodando em ${SERVER_URL}`);
      console.log(`💡 Inicie o servidor com: npm start`);
    } else if (error.response && error.response.status === 404) {
      console.log(`❌ Câmera '${CAMERA_NAME}' não encontrada`);
      console.log(`💡 Câmeras disponíveis: camera1, camera2, camera3, camera4, camera5, camera6`);
    } else {
      console.log(`❌ Erro: ${error.message}`);
    }
  }
}

// Verificar se axios está disponível
try {
  require.resolve('axios');
} catch (e) {
  console.log('❌ Módulo axios não encontrado. Instalando...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install axios', { stdio: 'inherit' });
    console.log('✅ Axios instalado com sucesso');
  } catch (installError) {
    console.log('❌ Erro ao instalar axios. Execute: npm install axios');
    process.exit(1);
  }
}

checkCameraStatus();
