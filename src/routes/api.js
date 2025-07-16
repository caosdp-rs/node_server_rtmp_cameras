const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const { PATHS } = require('../config/environment');
const database = require('../services/database');
const recordingService = require('../services/recording');

router.get('/files', async (req, res) => {
  try {
    const files = await fs.readdir(PATHS.RECORDINGS);
    res.json(files.filter(f => f.endsWith('.mp4')));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao ler arquivos' });
  }
});

router.post('/save/:camera', async (req, res) => {
  try {
    const camera = req.params.camera;
    const filename = await recordingService.saveManualRecording(camera);
    res.json({ success: true, file: `/recordings/${filename}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/salvar/:filename', async (req, res) => {
  try {
    const changes = await database.markAsImportant(req.params.filename);
    if (changes === 0) {
      return res.status(404).json({ success: false, message: 'Arquivo não encontrado.' });
    }
    res.json({ success: true, message: `Arquivo ${req.params.filename} marcado como "salvar = true"` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/importantes', async (req, res) => {
  try {
    const videos = await database.getImportantVideos();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rotas para gerenciar câmeras selecionadas para captura de fotos
router.get('/photo-cameras', (req, res) => {
  const selectedCameras = require('../../server').getSelectedCameras();
  res.json({ selectedCameras });
});

router.post('/photo-cameras', (req, res) => {
  try {
    const { cameras } = req.body;
    if (!Array.isArray(cameras)) {
      return res.status(400).json({ success: false, error: 'cameras deve ser um array' });
    }
    
    require('../../server').setSelectedCameras(cameras);
    res.json({ success: true, selectedCameras: cameras });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/capture-photos', async (req, res) => {
  try {
    await require('../../server').capturePhotosFromSelectedCameras();
    res.json({ success: true, message: 'Captura de fotos executada' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;