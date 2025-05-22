const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');

// GET /api/reviews/product/:productId
router.get('/product/:productId', reviewController.getReviewsByProductId);

module.exports = router; 