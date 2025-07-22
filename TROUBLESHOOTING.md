# Sistema de Câmeras RTMP - Resolução de Problemas de Cache

## Problemas Comuns e Soluções

### 🚨 Câmeras não voltam após reiniciar o sistema

Este problema pode ocorrer devido a:

1. **Processos FFmpeg órfãos** travados no sistema
2. **Arquivos HLS corrompidos** no cache
3. **Portas ocupadas** por processos anteriores
4. **Cache GOP** do Node Media Server

### 💡 Soluções Implementadas

#### 1. Limpeza Automática na Inicialização
O sistema agora executa uma limpeza automática ao iniciar:
- Remove processos FFmpeg órfãos
- Limpa arquivos HLS antigos/corrompidos
- Verifica disponibilidade de portas

#### 2. Melhorias no FFmpeg
- Adicionadas flags de reconexão automática
- Desabilitado cache HLS (`-hls_allow_cache 0`)
- Melhor tratamento de encerramento de processos

#### 3. Scripts de Limpeza Manual

**Opção 1 - Script Node.js:**
```bash
npm run cleanup
```

**Opção 2 - Script PowerShell (Windows):**
```powershell
.\cleanup.ps1
```

#### 4. Inicialização Limpa
```bash
# Limpa o sistema e inicia o servidor
npm run clean-start
```

### 🔧 Resolução Manual de Problemas

#### Se as câmeras ainda não funcionam:

1. **Parar todos os processos:**
   ```powershell
   # No PowerShell (como Administrador)
   Get-Process -Name "ffmpeg" | Stop-Process -Force
   Get-Process -Name "node" | Stop-Process -Force
   ```

2. **Limpar cache manualmente:**
   ```bash
   # Remover arquivos HLS
   rm -rf media/live/*
   
   # Ou no Windows
   rmdir /s media\live
   mkdir media\live
   ```

3. **Verificar portas:**
   ```bash
   netstat -an | findstr :1935
   netstat -an | findstr :8000
   ```

4. **Reiniciar com limpeza:**
   ```bash
   npm run clean-start
   ```

### 🔍 Monitoramento e Debug

#### Logs importantes a observar:

```
[STARTUP] Iniciando limpeza do sistema...
[CLEANUP] Processos FFmpeg órfãos eliminados
[CLEANUP] Cache HLS limpo
[HEALTH] Sistema de verificação de saúde dos streams iniciado
```

#### API de limpeza manual:
```bash
# Executar limpeza via API
curl -X POST http://localhost:8000/api/cleanup
```

### ⚙️ Configurações Anti-Cache

As seguintes configurações foram implementadas para evitar problemas de cache:

1. **Node Media Server:**
   - `gop_cache: false` - Desabilita cache GOP
   - Flags HLS otimizadas para reconexão

2. **FFmpeg:**
   - `-reconnect 1` - Habilita reconexão automática
   - `-hls_allow_cache 0` - Desabilita cache HLS
   - `-hls_flags delete_segments+omit_endlist` - Remove segmentos antigos

3. **Sistema:**
   - Verificação de saúde a cada 30 segundos
   - Limpeza automática de processos órfãos
   - Remoção proativa de arquivos corrompidos

### 📋 Checklist de Solução de Problemas

- [ ] Executar `npm run cleanup` antes de iniciar
- [ ] Verificar se não há processos FFmpeg órfãos
- [ ] Confirmar que as portas 1935 e 8000 estão livres
- [ ] Verificar espaço em disco disponível
- [ ] Usar `npm run clean-start` para inicialização limpa
- [ ] Monitorar logs para detectar problemas

### 🆘 Se nada funcionar

1. Reiniciar o computador (remove todos os processos travados)
2. Executar como Administrador no Windows
3. Verificar se o FFmpeg está instalado corretamente
4. Checar se há software antivírus bloqueando processos
5. Verificar firewall/rede para as portas RTMP

---

*Este sistema agora possui mecanismos robustos de auto-recuperação e limpeza para minimizar problemas de cache e processos travados.*
