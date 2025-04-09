const { BEARER_TOKEN } = require('../config/environment');

module.exports = (req, res, next) => {
  if (req.path === '/' || req.path.startsWith('/recordings') || req.path === '/files') {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${BEARER_TOKEN}`) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="Painel"');
      return res.status(401).send('Não autorizado');
    }
  }
  next();
}; 