const express = require('express');
const {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  addConsumption,
  removeConsumption,
  getConsumptionSummary,
  deleteProject
} = require('../controllers/projectController');

const router = express.Router();

router.get('/', getAllProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.post('/:id/consumption', addConsumption);
router.delete('/:id/consumption', removeConsumption);
router.get('/:id/summary', getConsumptionSummary);
router.delete('/:id', deleteProject);

module.exports = router;
