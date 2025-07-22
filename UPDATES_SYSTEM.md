# Sistema de Atualizações - Painel de Câmeras

## 📋 Visão Geral

Foi adicionado um sistema de atualizações ao painel principal que permite visualizar o histórico de mudanças e melhorias do sistema de forma organizada e acessível.

## 🎯 Funcionalidades

### Interface de Usuário
- **Botão flutuante** no canto superior direito com ícone 📋
- **Badge de notificação** (!) quando há atualizações não visualizadas
- **Painel lateral** que desliza da direita para mostrar as atualizações
- **Design responsivo** que se adapta a diferentes tamanhos de tela

### Categorização
As atualizações são categorizadas por tipo com cores específicas:

- 🔴 **CORREÇÃO** (fix) - Correções de bugs e problemas
- 🟢 **NOVO RECURSO** (feature) - Novas funcionalidades
- 🟡 **MELHORIA** (improvement) - Aprimoramentos em recursos existentes
- 🟣 **SEGURANÇA** (security) - Atualizações de segurança
- 🟠 **PERFORMANCE** (performance) - Otimizações de desempenho
- 🟢 **INTERFACE** (ui) - Melhorias na interface do usuário
- ⚫ **API** (api) - Mudanças em APIs
- 🔵 **DOCUMENTAÇÃO** (docs) - Atualizações na documentação

## 🔧 Como Usar

### Para Usuários
1. Clique no botão 📋 no canto superior direito
2. Visualize as atualizações mais recentes
3. Use a tecla `ESC` ou clique fora do painel para fechar
4. O badge (!) desaparece após visualizar as atualizações

### Para Desenvolvedores

#### Visualizar Atualizações via API
```bash
# Obter todas as atualizações
curl -H "Authorization: Bearer painel123" http://localhost:8000/api/updates
```

#### Adicionar Nova Atualização via API
```bash
curl -X POST -H "Authorization: Bearer painel123" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "feature",
       "title": "Nova Funcionalidade",
       "description": ["Descrição da nova funcionalidade", "Mais detalhes"],
       "version": "v0.3"
     }' \
     http://localhost:8000/api/updates
```

## 📁 Estrutura dos Arquivos

### Arquivos Modificados
- `public/index.html` - Interface principal com painel de atualizações
- `src/routes/api.js` - Rotas da API para gerenciar atualizações

### Novos Endpoints da API
- `GET /api/updates` - Lista todas as atualizações
- `POST /api/updates` - Adiciona nova atualização

## 🎨 Personalização

### CSS Classes Disponíveis
```css
.updates-toggle        /* Botão flutuante */
.updates-badge         /* Badge de notificação */
.updates-panel         /* Painel lateral */
.updates-header        /* Cabeçalho do painel */
.updates-content       /* Conteúdo das atualizações */
.update-item           /* Item individual de atualização */
.update-type           /* Badge do tipo de atualização */
.update-title          /* Título da atualização */
.update-description    /* Descrição da atualização */
```

### Modificar Cores dos Tipos
Edite as classes CSS no arquivo `index.html`:
```css
.update-type.fix { background-color: #dc3545; }
.update-type.feature { background-color: #28a745; }
/* ... outras cores ... */
```

## 🔄 Funcionamento Automático

### Verificação Periódica
- O sistema verifica por novas atualizações a cada 5 minutos
- Compara com a última visualização do usuário (armazenada no localStorage)
- Mostra o badge (!) quando há atualizações não visualizadas

### Persistência
- Última visualização é salva no localStorage do navegador
- Badge permanece oculto até haver novas atualizações
- Dados são carregados dinamicamente da API

## 📊 Estrutura dos Dados

### Formato de Atualização
```json
{
  "id": 1,
  "date": "21/07/2025",
  "version": "v0.2",
  "type": "feature",
  "title": "Título da Atualização",
  "description": [
    "Primeira descrição",
    "Segunda descrição"
  ]
}
```

### Tipos Válidos
- `fix` - Correções
- `feature` - Novos recursos
- `improvement` - Melhorias
- `security` - Segurança
- `performance` - Performance
- `ui` - Interface
- `api` - API
- `docs` - Documentação

## 🚀 Próximas Melhorias Planejadas

- [ ] Persistência em banco de dados
- [ ] Interface administrativa para gerenciar atualizações
- [ ] Notificações push para atualizações críticas
- [ ] Filtros por tipo de atualização
- [ ] Busca em atualizações
- [ ] Exportação do histórico de atualizações
- [ ] Integração com sistema de versionamento Git

---

*Este sistema melhora a comunicação entre desenvolvedores e usuários, mantendo todos informados sobre as mudanças e melhorias do sistema.*
