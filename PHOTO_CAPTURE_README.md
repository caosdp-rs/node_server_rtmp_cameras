# Sistema de Captura Automática de Fotos

Este sistema permite capturar fotos automaticamente das câmeras RTMP selecionadas a cada 1 minuto.

## Configuração

### 1. Configurar Câmeras Selecionadas

Você pode configurar as câmeras de duas formas:

#### Opção A: Editando diretamente o código
No arquivo `server.js`, modifique o array `selectedCameras`:

```javascript
const selectedCameras = ['camera1', 'camera2', 'camera3']; // Nome das suas câmeras
```

#### Opção B: Usando a API REST

```bash
# Obter lista atual de câmeras selecionadas
GET /api/photo-cameras

# Definir novas câmeras selecionadas
POST /api/photo-cameras
Content-Type: application/json
{
  "cameras": ["camera1", "camera2", "camera3"]
}

# Capturar fotos manualmente (fora do ciclo automático)
POST /api/capture-photos
```

### 2. Diretórios

As fotos são salvas em: `media/photos/`

Formato do nome: `{nome_da_camera}_{timestamp}.jpg`

Exemplo: `camera1_2025-01-16T14-30-00-000Z.jpg`

### 3. Acesso às Fotos

As fotos podem ser acessadas via HTTP em: `http://localhost:3000/photos/`

Exemplo: `http://localhost:3000/photos/camera1_2025-01-16T14-30-00-000Z.jpg`

## Funcionalidades

- ✅ Captura automática a cada 1 minuto
- ✅ Suporte a múltiplas câmeras
- ✅ Verificação se o stream está ativo antes de capturar
- ✅ Logs detalhados de todas as operações
- ✅ API REST para gerenciamento
- ✅ Tratamento de erros robusto
- ✅ Timestamp único para cada foto

## Logs

O sistema produz logs detalhados:

```
[PHOTO] Iniciando captura de fotos para 2 câmera(s)
[PHOTO] Capturada: /path/to/media/photos/camera1_2025-01-16T14-30-00-000Z.jpg
[PHOTO] Stream camera2 não está ativo, pulando captura
[PHOTO] Ciclo de captura de fotos concluído
```

## Troubleshooting

1. **Foto não é capturada**: Verifique se o stream da câmera está ativo
2. **Erro de FFmpeg**: Verifique se o FFmpeg está instalado e no PATH
3. **Permissões**: Verifique se o diretório `media/photos/` tem permissões de escrita

## Exemplo de Uso com cURL

```bash
# Verificar câmeras atuais
curl -H "Authorization: Bearer painel123" http://localhost:3000/api/photo-cameras

# Configurar novas câmeras
curl -X POST \
  -H "Authorization: Bearer painel123" \
  -H "Content-Type: application/json" \
  -d '{"cameras": ["minha_camera1", "minha_camera2"]}' \
  http://localhost:3000/api/photo-cameras

# Capturar fotos imediatamente
curl -X POST \
  -H "Authorization: Bearer painel123" \
  http://localhost:3000/api/capture-photos
```
