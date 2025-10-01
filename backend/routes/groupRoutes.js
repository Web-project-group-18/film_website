const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authenticateToken = require('../middleware/auth');

router.get('/all', groupController.getAllGroups);

router.post('/create', authenticateToken, groupController.createGroup);
router.get('/my-groups', authenticateToken, groupController.getUserGroups);

router.post('/:id/join', authenticateToken, groupController.requestJoin);
router.get('/:id/requests', authenticateToken, groupController.listJoinRequests);
router.post('/:id/requests/approve', authenticateToken, groupController.approveJoinRequest);
router.post('/:id/requests/reject', authenticateToken, groupController.rejectJoinRequest);
router.post('/:id/members', authenticateToken, groupController.addMember);
router.post('/:id/members/remove', authenticateToken, groupController.removeMember);
router.post('/:id/leave', authenticateToken, groupController.leaveGroup);

router.get('/:id', authenticateToken, groupController.getGroup);
router.delete('/:id', authenticateToken, groupController.deleteGroup);

router.post('/:id/movies/', authenticateToken, groupController.addMovieToGroup)

module.exports = router;

