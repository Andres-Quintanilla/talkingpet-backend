import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();

r.post('/register', c.register);
r.post('/login', c.login);

r.get('/me', requireAuth, c.me);

r.post('/forgot', c.forgotPassword);
r.post('/reset', c.resetPassword);

export default r;
