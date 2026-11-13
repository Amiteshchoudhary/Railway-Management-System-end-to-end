import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  getAllTrains,
  getBookedSeatsForTrain,
  getBookingsForUser,
  createTrainBooking,
  completeTrainBooking,
  cancelTrainBooking,
  recalculateAndSyncLoyaltyPoints,
  getAllNotifications,
  dispatchTrainAlert,
} from './src/db/railway.ts';
import {
  calculateItemizedFare,
  generatePnrCode,
  CoachClass,
  CateringOption,
} from './src/utils/fareCalculator.ts';

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Live Train Schedules (SQL)
  app.get('/api/trains', async (_req, res) => {
    try {
      const trainList = await getAllTrains();
      res.json(trainList);
    } catch (error: any) {
      console.error('Failed to fetch trains:', error);
      res.status(500).json({ error: error.message || 'Failed to load train schedules' });
    }
  });

  // 2. Booked Seats for a Specific Train
  app.get('/api/trains/:id/seats', async (req, res) => {
    try {
      const trainId = parseInt(req.params.id, 10);
      const travelDate = (req.query.date as string) || undefined;
      if (isNaN(trainId)) {
        return res.status(400).json({ error: 'Invalid train ID' });
      }
      const seats = await getBookedSeatsForTrain(trainId, travelDate);
      res.json({ bookedSeats: seats });
    } catch (error: any) {
      console.error('Failed to fetch booked seats:', error);
      res.status(500).json({ error: error.message || 'Failed to load seat map' });
    }
  });

  // 3. Real-Time Delay & Platform Change Notifications
  app.get('/api/notifications', async (_req, res) => {
    try {
      const alerts = await getAllNotifications();
      res.json(alerts);
    } catch (error: any) {
      console.error('Failed to fetch notifications:', error);
      res.status(500).json({ error: error.message || 'Failed to load alerts' });
    }
  });

  // 4. Dispatch Live Delay or Platform Change Notification
  app.post('/api/notifications/dispatch', async (req, res) => {
    try {
      const { trainId, type, delayMinutes, newPlatform, customMessage } = req.body;
      if (!trainId || !type) {
        return res.status(400).json({ error: 'trainId and alert type are required' });
      }
      const result = await dispatchTrainAlert({
        trainId: Number(trainId),
        type,
        delayMinutes: delayMinutes !== undefined ? Number(delayMinutes) : undefined,
        newPlatform,
        customMessage,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Failed to dispatch train alert:', error);
      res.status(500).json({ error: error.message || 'Failed to dispatch alert' });
    }
  });

  // 5. Python + TypeScript Fare Calculation Endpoint
  app.post('/api/fare/calculate', async (req, res) => {
    try {
      const baseFare = Number(req.body.baseFare || 95);
      const coachClass = (req.body.coachClass || 'Standard') as CoachClass;
      const cateringAddon = (req.body.cateringAddon || 'None') as CateringOption;
      const passengerAge = Number(req.body.passengerAge || 30);

      try {
        const scriptPath = path.join(__dirname, 'python_backend', 'app.py');
        const payloadStr = JSON.stringify({
          baseFare,
          coachClass,
          cateringAddon,
          passengerAge,
        });
        const { stdout } = await execFileAsync('python3', [scriptPath, '--calculate', payloadStr], {
          timeout: 2500,
        });
        const parsed = JSON.parse(stdout.trim());
        return res.json(parsed);
      } catch {
        const fallback = calculateItemizedFare(baseFare, coachClass, cateringAddon, passengerAge);
        return res.json(fallback);
      }
    } catch (error: any) {
      console.error('Failed to calculate fare:', error);
      res.status(500).json({ error: 'Failed to calculate fare breakdown' });
    }
  });

  // 6. Sync Authenticated Passenger Profile & Loyalty Points to Cloud SQL
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || req.body.email || `${uid}@velorail.transit`;
      const name = req.body.name || (req.user as any)?.name || 'Express Passenger';
      const userRecord = await getOrCreateUser(uid, email, name);
      const loyaltyPoints = await recalculateAndSyncLoyaltyPoints(uid);
      res.json({ ...userRecord, loyaltyPoints });
    } catch (error: any) {
      console.error('Failed to sync passenger:', error);
      res.status(500).json({ error: error.message || 'Failed to sync passenger profile' });
    }
  });

  // 7. Get Logged-In Passenger Bookings & Bills
  app.get('/api/bookings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const userBookings = await getBookingsForUser(uid);
      res.json(userBookings);
    } catch (error: any) {
      console.error('Failed to load passenger bookings:', error);
      res.status(500).json({ error: error.message || 'Failed to load bookings' });
    }
  });

  // 8. Reserve a Train Ticket & Generate Itemized Bill
  app.post('/api/bookings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const {
        trainId,
        trainNumber,
        passengerName,
        passengerAge,
        passengerEmail,
        travelDate,
        coachClass,
        seatNumber,
        cateringAddon,
        baseFare,
      } = req.body;

      if (!trainId || !passengerName || !seatNumber || !travelDate) {
        return res.status(400).json({
          error: 'Please provide passenger name, travel date, and seat selection.',
        });
      }

      const emailToSave = passengerEmail || req.user!.email || `${uid}@velorail.transit`;
      await getOrCreateUser(uid, emailToSave, passengerName);

      const fare = calculateItemizedFare(
        Number(baseFare || 95),
        (coachClass || 'Standard') as CoachClass,
        (cateringAddon || 'None') as CateringOption,
        Number(passengerAge || 30)
      );

      const pnr = generatePnrCode(String(trainNumber || 'VR-201'), String(seatNumber));

      const created = await createTrainBooking({
        pnr,
        userUid: uid,
        trainId: Number(trainId),
        passengerName: String(passengerName).trim(),
        passengerAge: Number(passengerAge || 30),
        passengerEmail: String(emailToSave).trim(),
        travelDate: String(travelDate),
        coachClass: String(coachClass || 'Standard'),
        seatNumber: String(seatNumber),
        cateringAddon: String(cateringAddon || 'None'),
        baseAmount: fare.baseAmount,
        classSurcharge: fare.classSurcharge,
        cateringCharge: fare.cateringCharge,
        taxAmount: fare.taxAmount,
        totalAmount: fare.totalAmount,
      });

      res.status(201).json(created);
    } catch (error: any) {
      console.error('Failed to create booking:', error);
      res.status(500).json({ error: error.message || 'Failed to create reservation' });
    }
  });

  // 9. Mark a Reservation as Completed & Award Loyalty Points
  app.post('/api/bookings/:id/complete', requireAuth, async (req: AuthRequest, res) => {
    try {
      const bookingId = parseInt(req.params.id, 10);
      if (isNaN(bookingId)) {
        return res.status(400).json({ error: 'Invalid booking ID' });
      }
      const result = await completeTrainBooking(bookingId, req.user!.uid);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to complete booking:', error);
      res.status(500).json({ error: error.message || 'Failed to complete trip' });
    }
  });

  // 10. Cancel a Reservation
  app.post('/api/bookings/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const bookingId = parseInt(req.params.id, 10);
      if (isNaN(bookingId)) {
        return res.status(400).json({ error: 'Invalid booking ID' });
      }
      const updated = await cancelTrainBooking(bookingId, req.user!.uid);
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to cancel booking:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel reservation' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VeloRail Express Reservation Server running on http://localhost:${PORT}`);
  });
}

startServer();
