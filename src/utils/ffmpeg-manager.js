const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class FFmpegManager {
  constructor() {
    this.platform = os.platform();
    this.ffmpegPath = null;
    this.isInitialized = false;
  }

  async initialize() {
    console.log(`[FFMPEG] Inicializando para plataforma: ${this.platform}`);
    
    try {
      // Tentar ffmpeg-static primeiro
      this.ffmpegPath = await this.tryFFmpegStatic();
      
      if (!this.ffmpegPath) {
        // Tentar FFmpeg do sistema
        this.ffmpegPath = await this.trySystemFFmpeg();
      }
      
      if (this.ffmpegPath) {
        await this.validateFFmpeg();
        this.isInitialized = true;
        console.log(`[FFMPEG] ✅ Inicializado com sucesso: ${this.ffmpegPath}`);
        return true;
      } else {
        throw new Error('Nenhuma instalação válida do FFmpeg encontrada');
      }
    } catch (error) {
      console.error(`[FFMPEG] ❌ Erro na inicialização: ${error.message}`);
      this.printTroubleshootingTips();
      return false;
    }
  }

  async tryFFmpegStatic() {
    try {
      console.log('[FFMPEG] Tentando ffmpeg-static...');
      const ffmpegStatic = require('ffmpeg-static');
      
      if (!ffmpegStatic) {
        console.log('[FFMPEG] ffmpeg-static retornou null/undefined');
        return null;
      }

      let ffmpegPath = ffmpegStatic;
      
      // No Windows, às vezes o caminho pode precisar de aspas
      if (this.platform === 'win32' && ffmpegPath.includes(' ')) {
        ffmpegPath = `"${ffmpegPath}"`;
      }

      // Verificar se o arquivo existe
      const actualPath = ffmpegPath.replace(/"/g, ''); // Remove aspas para verificação
      if (fs.existsSync(actualPath)) {
        console.log(`[FFMPEG] ✅ ffmpeg-static encontrado: ${ffmpegPath}`);
        return ffmpegPath;
      } else {
        console.log(`[FFMPEG] ❌ Arquivo não existe: ${actualPath}`);
        return null;
      }
    } catch (error) {
      console.log(`[FFMPEG] ffmpeg-static não disponível: ${error.message}`);
      return null;
    }
  }

  async trySystemFFmpeg() {
    console.log('[FFMPEG] Tentando FFmpeg do sistema...');
    
    const possiblePaths = this.getSystemFFmpegPaths();
    
    for (const ffmpegPath of possiblePaths) {
      try {
        if (this.platform === 'win32') {
          // No Windows, testar com 'where'
          execSync(`where ${ffmpegPath}`, { stdio: 'pipe' });
        } else {
          // No Linux/Mac, testar com 'which'
          execSync(`which ${ffmpegPath}`, { stdio: 'pipe' });
        }
        
        console.log(`[FFMPEG] ✅ FFmpeg do sistema encontrado: ${ffmpegPath}`);
        return ffmpegPath;
      } catch (error) {
        // Continuar tentando outros caminhos
      }
    }
    
    console.log('[FFMPEG] ❌ FFmpeg do sistema não encontrado');
    return null;
  }

  getSystemFFmpegPaths() {
    if (this.platform === 'win32') {
      return [
        'ffmpeg.exe',
        'ffmpeg',
        'C:\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
        'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe'
      ];
    } else {
      return [
        'ffmpeg',
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/opt/homebrew/bin/ffmpeg',
        '/snap/bin/ffmpeg'
      ];
    }
  }

  async validateFFmpeg() {
    try {
      const command = this.platform === 'win32' ? 
        `${this.ffmpegPath} -version` : 
        `"${this.ffmpegPath}" -version`;
        
      const output = execSync(command, { 
        encoding: 'utf8', 
        timeout: 5000,
        stdio: 'pipe'
      });
      
      const versionLine = output.split('\n')[0];
      console.log(`[FFMPEG] Versão: ${versionLine}`);
      
      // Verificar se tem codecs essenciais
      const codecsOutput = execSync(`${this.ffmpegPath} -codecs`, { 
        encoding: 'utf8', 
        timeout: 5000,
        stdio: 'pipe'
      });
      
      const hasH264 = codecsOutput.includes('libx264') || codecsOutput.includes('h264');
      const hasAAC = codecsOutput.includes('aac');
      
      console.log(`[FFMPEG] Codecs - H264: ${hasH264 ? '✅' : '❌'}, AAC: ${hasAAC ? '✅' : '❌'}`);
      
      if (!hasH264 || !hasAAC) {
        console.warn('[FFMPEG] ⚠️ Alguns codecs essenciais podem não estar disponíveis');
      }
      
    } catch (error) {
      throw new Error(`Falha na validação do FFmpeg: ${error.message}`);
    }
  }

  getFFmpegPath() {
    if (!this.isInitialized) {
      throw new Error('FFmpeg não foi inicializado. Chame initialize() primeiro.');
    }
    return this.ffmpegPath;
  }

  getFFmpegCommand(args = []) {
    const ffmpegPath = this.getFFmpegPath();
    
    // No Windows, se o caminho tiver espaços e não estiver entre aspas
    if (this.platform === 'win32' && ffmpegPath.includes(' ') && !ffmpegPath.startsWith('"')) {
      return `"${ffmpegPath}"`;
    }
    
    return ffmpegPath;
  }

  printTroubleshootingTips() {
    console.log('\n💡 Dicas para resolver problemas do FFmpeg:');
    
    if (this.platform === 'win32') {
      console.log('📦 Windows:');
      console.log('   1. npm install ffmpeg-static');
      console.log('   2. choco install ffmpeg (se tiver Chocolatey)');
      console.log('   3. scoop install ffmpeg (se tiver Scoop)');
      console.log('   4. Download manual: https://ffmpeg.org/download.html#build-windows');
    } else {
      console.log('🐧 Linux/Mac:');
      console.log('   1. npm install ffmpeg-static');
      console.log('   2. sudo apt install ffmpeg (Ubuntu/Debian)');
      console.log('   3. sudo yum install ffmpeg (CentOS/RHEL)');
      console.log('   4. brew install ffmpeg (macOS com Homebrew)');
    }
    
    console.log('\n🔧 Scripts de diagnóstico:');
    console.log('   - npm run test-ffmpeg');
    console.log('   - npm run test-codecs');
  }

  // Método estático para criar e inicializar uma instância
  static async create() {
    const manager = new FFmpegManager();
    await manager.initialize();
    return manager;
  }
}

module.exports = FFmpegManager;
