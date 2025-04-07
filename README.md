# Servidor RTMP para Câmeras

Este é um servidor Node.js que permite receber streams RTMP de câmeras e visualizá-los através de uma interface web.

## Requisitos

- Node.js (versão 12 ou superior)
- NPM (Node Package Manager)

## Instalação

1. Clone este repositório
2. Instale as dependências:
```bash
npm install
```

## Uso

1. Inicie o servidor:
```bash
npm start
```

2. O servidor estará disponível em:
- Interface web: http://localhost:3000
- Servidor RTMP: rtmp://localhost:1935

## Configuração das Câmeras

Para conectar uma câmera ao servidor, use o seguinte formato de URL:
```
rtmp://seu-ip:1935/live/nome-da-camera
```

Onde:
- `seu-ip`: IP do servidor
- `nome-da-camera`: Nome único para identificar a câmera

## Visualização

Acesse http://localhost:3000 para ver as câmeras conectadas. O sistema suporta múltiplas câmeras simultaneamente.

## Personalização

Você pode modificar o arquivo `public/index.html` para adicionar mais câmeras ou personalizar a interface.
