import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../middleware/roles.js';
import {
  getSchedulerStatus,
  runAllReminders,
  runVaccineReminders,
  runBathReminders,
  runRestockReminders,
  runBirthdayReminders,
  runAppointmentReminders,
  cleanOldNotifications
} from '../controllers/scheduler.controller.js';

const router = Router();

router.use(requireAuth, isAdmin);

router.get('/status', getSchedulerStatus);

router.post('/run', runAllReminders);

router.post('/run/vaccines', runVaccineReminders);

router.post('/run/bath', runBathReminders);

router.post('/run/restock', runRestockReminders);

router.post('/run/birthdays', runBirthdayReminders);

router.post('/run/appointments', runAppointmentReminders);

router.delete('/clean', cleanOldNotifications);

export default router;
