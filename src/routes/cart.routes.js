import { Router } from 'express';
import * as ctrl from '../controllers/cart.controller.js';
import { requireAuth } from '../middleware/auth.js';
const r = Router();

r.get('/', requireAuth, ctrl.getMyCart);
r.post('/add', requireAuth, ctrl.addItem);
r.post('/update', requireAuth, ctrl.updateItem);
r.post('/remove', requireAuth, ctrl.removeItem);
r.post('/clear', requireAuth, ctrl.clearCart);

export default r;
