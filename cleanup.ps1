# Script de limpeza do sistema de câmeras para Windows
Write-Host "=== Script de Limpeza do Sistema de Câmeras ===" -ForegroundColor Green

# Função para matar processos FFmpeg órfãos
function Kill-OrphanFFmpeg {
    Write-Host "🔄 Verificando processos FFmpeg órfãos..." -ForegroundColor Yellow
    
    $ffmpegProcesses = Get-Process -Name "ffmpeg" -ErrorAction SilentlyContinue
    
    if ($ffmpegProcesses) {
        Write-Host "⚠️  Encontrados $($ffmpegProcesses.Count) processo(s) FFmpeg" -ForegroundColor Red
        
        foreach ($process in $ffmpegProcesses) {
            try {
                Stop-Process -Id $process.Id -Force
                Write-Host "✅ Processo FFmpeg (PID: $($process.Id)) eliminado" -ForegroundColor Green
            } catch {
                Write-Host "❌ Erro ao eliminar processo FFmpeg (PID: $($process.Id)): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "✅ Nenhum processo FFmpeg órfão encontrado" -ForegroundColor Green
    }
}

# Função para limpar arquivos HLS
function Clean-HLSFiles {
    param(
        [string]$BasePath = ".\media\live"
    )
    
    Write-Host "🔄 Limpando arquivos HLS..." -ForegroundColor Yellow
    
    if (-not (Test-Path $BasePath)) {
        Write-Host "ℹ️  Diretório HLS não existe: $BasePath" -ForegroundColor Cyan
        return
    }

    $totalFiles = 0
    $cameraDirs = Get-ChildItem -Path $BasePath -Directory

    foreach ($cameraDir in $cameraDirs) {
        $hlsFiles = Get-ChildItem -Path $cameraDir.FullName -Filter "*.ts", "*.m3u8"
        
        foreach ($file in $hlsFiles) {
            try {
                Remove-Item -Path $file.FullName -Force
                $totalFiles++
            } catch {
                Write-Host "❌ Erro ao remover $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }

    Write-Host "✅ $totalFiles arquivos HLS removidos" -ForegroundColor Green
}

# Função para verificar portas ocupadas
function Check-Ports {
    Write-Host "🔄 Verificando portas ocupadas..." -ForegroundColor Yellow
    
    # Verificar porta RTMP (1935)
    $rtmpConnections = netstat -an | Select-String ":1935"
    if ($rtmpConnections) {
        Write-Host "⚠️  Porta RTMP (1935) está ocupada:" -ForegroundColor Red
        $rtmpConnections | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    } else {
        Write-Host "✅ Porta RTMP (1935) está livre" -ForegroundColor Green
    }

    # Verificar porta HTTP (8000)
    $httpConnections = netstat -an | Select-String ":8000"
    if ($httpConnections) {
        Write-Host "⚠️  Porta HTTP (8000) está ocupada:" -ForegroundColor Red
        $httpConnections | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    } else {
        Write-Host "✅ Porta HTTP (8000) está livre" -ForegroundColor Green
    }
}

# Função para verificar espaço em disco
function Check-DiskSpace {
    Write-Host "🔄 Verificando espaço em disco..." -ForegroundColor Yellow
    
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3" | Where-Object { $_.DeviceID -eq "C:" }
    
    if ($disk) {
        $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
        $totalSpaceGB = [math]::Round($disk.Size / 1GB, 2)
        $usedPercentage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 1)
        
        Write-Host "💽 Espaço livre: $freeSpaceGB GB de $totalSpaceGB GB (${usedPercentage}% usado)" -ForegroundColor Cyan
        
        if ($freeSpaceGB -lt 5) {
            Write-Host "⚠️  Pouco espaço em disco disponível!" -ForegroundColor Red
        }
    }
}

# Executar todas as verificações e limpezas
function Start-SystemCleanup {
    Write-Host "🚀 Iniciando limpeza do sistema..." -ForegroundColor Green
    Write-Host ""
    
    Kill-OrphanFFmpeg
    Write-Host ""
    
    Clean-HLSFiles
    Write-Host ""
    
    Check-Ports
    Write-Host ""
    
    Check-DiskSpace
    Write-Host ""
    
    Write-Host "✅ Limpeza concluída! O sistema está pronto para iniciar." -ForegroundColor Green
    Write-Host ""
}

# Executar se chamado diretamente
if ($MyInvocation.InvocationName -ne '.') {
    Start-SystemCleanup
}
