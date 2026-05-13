const express = require('express');
const controller = require('../controllers/ship-pricing.controller');

const router = express.Router();

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    message: 'Ship Pricing Center secure endpoint reachable.',
    timestamp: new Date().toISOString()
  });
});

router.get('/databases/status', asyncRoute(controller.getDatabasesStatus));

router.get('/orders/summary', asyncRoute(controller.getSummary));
router.get('/orders/:artransid/lines', asyncRoute(controller.getOrderLines));
router.get('/orders/:artransid/shipping', asyncRoute(controller.getOrderShipping));
router.put('/orders/:artransid/cause', controller.updateOrderCause);
router.put('/orders/:artransid/solution', controller.updateOrderSolution);
router.get('/orders', asyncRoute(controller.getOrders));

router.get('/causes', controller.getCauses);
router.put('/causes/options', controller.updateCauseOptions);
router.get('/solutions', controller.getSolutions);
router.put('/solutions/options', controller.updateSolutionOptions);

router.get('/segments', asyncRoute(controller.getSegments));
router.get('/skus/orders', asyncRoute(controller.getSkuOrders));
router.get('/skus', asyncRoute(controller.getSkus));

router.get('/shipping-rules', controller.getShippingRules);
router.put('/shipping-rules/:rule_id', controller.updateShippingRule);
router.post('/shipping-rules', controller.addShippingRule);
router.delete('/shipping-rules/:rule_id', controller.deleteShippingRule);
router.get('/shipping-map', controller.getShippingMap);
router.get('/shipping-analysis', asyncRoute(controller.getShippingAnalysis));

router.get('/stores/timeline', asyncRoute(controller.getStoreTimeline));
router.get('/stores/analytics', asyncRoute(controller.getStoreAnalytics));

module.exports = router;
