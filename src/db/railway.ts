import { db } from './index.ts';
import { users, trains, bookings, notifications } from './schema.ts';
import { eq, desc, and } from 'drizzle-orm';
import { LOYALTY_POINTS_PER_DOLLAR } from '../utils/fareCalculator.ts';

export async function recalculateAndSyncLoyaltyPoints(userUid: string): Promise<number> {
  try {
    const completedRows = await db
      .select({ totalAmount: bookings.totalAmount })
      .from(bookings)
      .where(and(eq(bookings.userUid, userUid), eq(bookings.bookingStatus, 'Completed')));

    const earnedPoints = completedRows.reduce(
      (sum, row) => sum + Math.max(0, Number(row.totalAmount || 0)) * LOYALTY_POINTS_PER_DOLLAR,
      0
    );

    await db
      .update(users)
      .set({ loyaltyPoints: earnedPoints })
      .where(eq(users.uid, userUid));

    return earnedPoints;
  } catch (error) {
    console.error('Database operation failed in recalculateAndSyncLoyaltyPoints:', error);
    throw new Error('Unable to synchronize passenger loyalty points.', { cause: error });
  }
}

export async function getAllTrains() {
  try {
    return await db.select().from(trains).orderBy(trains.departureTime);
  } catch (error) {
    console.error('Database query failed in getAllTrains:', error);
    throw new Error('Unable to load live train schedules. Please try again shortly.', {
      cause: error,
    });
  }
}

export async function getTrainById(trainId: number) {
  try {
    const rows = await db.select().from(trains).where(eq(trains.id, trainId));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getTrainById:', error);
    throw new Error('Unable to retrieve train details.', { cause: error });
  }
}

export async function getBookedSeatsForTrain(trainId: number, travelDate?: string) {
  try {
    const conditions = travelDate
      ? and(
          eq(bookings.trainId, trainId),
          eq(bookings.travelDate, travelDate),
          eq(bookings.bookingStatus, 'Confirmed')
        )
      : and(eq(bookings.trainId, trainId), eq(bookings.bookingStatus, 'Confirmed'));

    const rows = await db
      .select({
        seatNumber: bookings.seatNumber,
        coachClass: bookings.coachClass,
      })
      .from(bookings)
      .where(conditions);
    return rows.map((r) => r.seatNumber);
  } catch (error) {
    console.error('Database query failed in getBookedSeatsForTrain:', error);
    throw new Error('Unable to fetch coach seat occupancy.', { cause: error });
  }
}

export async function getBookingsForUser(userUid: string) {
  try {
    const rows = await db
      .select({
        id: bookings.id,
        pnr: bookings.pnr,
        userUid: bookings.userUid,
        trainId: bookings.trainId,
        passengerName: bookings.passengerName,
        passengerAge: bookings.passengerAge,
        passengerEmail: bookings.passengerEmail,
        travelDate: bookings.travelDate,
        coachClass: bookings.coachClass,
        seatNumber: bookings.seatNumber,
        cateringAddon: bookings.cateringAddon,
        baseAmount: bookings.baseAmount,
        classSurcharge: bookings.classSurcharge,
        cateringCharge: bookings.cateringCharge,
        taxAmount: bookings.taxAmount,
        totalAmount: bookings.totalAmount,
        bookingStatus: bookings.bookingStatus,
        createdAt: bookings.createdAt,
        trainNumber: trains.trainNumber,
        trainName: trains.name,
        origin: trains.origin,
        destination: trains.destination,
        departureTime: trains.departureTime,
        arrivalTime: trains.arrivalTime,
        duration: trains.duration,
        platform: trains.platform,
        trainStatus: trains.status,
        delayMinutes: trains.delayMinutes,
      })
      .from(bookings)
      .innerJoin(trains, eq(bookings.trainId, trains.id))
      .where(eq(bookings.userUid, userUid))
      .orderBy(desc(bookings.createdAt));

    return rows;
  } catch (error) {
    console.error('Database query failed in getBookingsForUser:', error);
    throw new Error('Unable to retrieve passenger bookings.', { cause: error });
  }
}

export interface CreateBookingPayload {
  pnr: string;
  userUid: string;
  trainId: number;
  passengerName: string;
  passengerAge: number;
  passengerEmail: string;
  travelDate: string;
  coachClass: string;
  seatNumber: string;
  cateringAddon: string;
  baseAmount: number;
  classSurcharge: number;
  cateringCharge: number;
  taxAmount: number;
  totalAmount: number;
}

export async function createTrainBooking(payload: CreateBookingPayload) {
  try {
    const train = await getTrainById(payload.trainId);
    if (!train) {
      throw new Error('Selected train schedule was not found.');
    }
    if (train.availableSeats <= 0) {
      throw new Error('This train has no remaining seats available.');
    }

    const inserted = await db
      .insert(bookings)
      .values({
        pnr: payload.pnr,
        userUid: payload.userUid,
        trainId: payload.trainId,
        passengerName: payload.passengerName,
        passengerAge: payload.passengerAge,
        passengerEmail: payload.passengerEmail,
        travelDate: payload.travelDate,
        coachClass: payload.coachClass,
        seatNumber: payload.seatNumber,
        cateringAddon: payload.cateringAddon,
        baseAmount: payload.baseAmount,
        classSurcharge: payload.classSurcharge,
        cateringCharge: payload.cateringCharge,
        taxAmount: payload.taxAmount,
        totalAmount: payload.totalAmount,
        bookingStatus: 'Confirmed',
      })
      .returning();

    const nextAvailable = Math.max(0, train.availableSeats - 1);
    await db
      .update(trains)
      .set({ availableSeats: nextAvailable })
      .where(eq(trains.id, payload.trainId));

    await db.insert(notifications).values({
      trainId: train.id,
      trainNumber: train.trainNumber,
      trainName: train.name,
      type: 'Booking Confirmation',
      title: `Ticket Confirmed (${payload.pnr}) — Seat ${payload.seatNumber}`,
      message: `Reservation confirmed for ${payload.passengerName} on ${train.trainNumber} ${train.name} (${train.origin} → ${train.destination}) departing ${train.departureTime} from ${train.platform}.`,
      severity: 'info',
    });

    return inserted[0];
  } catch (error) {
    console.error('Database operation failed in createTrainBooking:', error);
    throw new Error('Failed to complete ticket reservation. Please try another seat.', {
      cause: error,
    });
  }
}

export async function completeTrainBooking(bookingId: number, userUid: string) {
  try {
    const existing = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userUid, userUid)));

    if (!existing.length) {
      throw new Error('Booking record not found for current passenger.');
    }

    const target = existing[0];
    if (target.bookingStatus === 'Cancelled') {
      throw new Error('Cancelled reservations cannot be marked as completed.');
    }

    const updated = await db
      .update(bookings)
      .set({ bookingStatus: 'Completed' })
      .where(eq(bookings.id, bookingId))
      .returning();

    const loyaltyPoints = await recalculateAndSyncLoyaltyPoints(userUid);

    return {
      booking: updated[0],
      loyaltyPoints,
      awardedPoints: Math.max(0, Number(target.totalAmount || 0)) * LOYALTY_POINTS_PER_DOLLAR,
    };
  } catch (error) {
    console.error('Database operation failed in completeTrainBooking:', error);
    throw new Error('Unable to mark trip as completed at this time.', { cause: error });
  }
}

export async function cancelTrainBooking(bookingId: number, userUid: string) {
  try {
    const existing = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userUid, userUid)));

    if (!existing.length) {
      throw new Error('Booking record not found for current passenger.');
    }

    const target = existing[0];
    if (target.bookingStatus === 'Cancelled') {
      return target;
    }

    const updated = await db
      .update(bookings)
      .set({ bookingStatus: 'Cancelled' })
      .where(eq(bookings.id, bookingId))
      .returning();

    const train = await getTrainById(target.trainId);
    if (train) {
      await db
        .update(trains)
        .set({ availableSeats: Math.min(train.totalSeats, train.availableSeats + 1) })
        .where(eq(trains.id, train.id));
    }

    await recalculateAndSyncLoyaltyPoints(userUid);

    return updated[0];
  } catch (error) {
    console.error('Database operation failed in cancelTrainBooking:', error);
    throw new Error('Unable to cancel booking at this time.', { cause: error });
  }
}

export async function getAllNotifications() {
  try {
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(30);
  } catch (error) {
    console.error('Database query failed in getAllNotifications:', error);
    throw new Error('Unable to load live railway notifications.', { cause: error });
  }
}

export interface DispatchAlertPayload {
  trainId: number;
  type: 'Delay Alert' | 'Platform Change' | 'Boarding Call';
  delayMinutes?: number;
  newPlatform?: string;
  customMessage?: string;
}

export async function dispatchTrainAlert(payload: DispatchAlertPayload) {
  try {
    const train = await getTrainById(payload.trainId);
    if (!train) {
      throw new Error('Train not found.');
    }

    let nextStatus = train.status;
    let nextDelay = train.delayMinutes;
    let nextPlatform = train.platform;
    let title = '';
    let message = '';
    let severity = 'warning';

    if (payload.type === 'Delay Alert') {
      nextDelay = payload.delayMinutes !== undefined ? payload.delayMinutes : train.delayMinutes + 15;
      nextStatus = nextDelay > 0 ? 'Delayed' : 'On Time';
      severity = nextDelay >= 20 ? 'critical' : 'warning';
      title = `${train.trainNumber} Delayed by ${nextDelay} Minutes`;
      message =
        payload.customMessage ||
        `${train.name} (${train.origin} to ${train.destination}) is experiencing a ${nextDelay}-minute delay due to corridor traffic control. Updated boarding at ${nextPlatform}.`;
    } else if (payload.type === 'Platform Change') {
      nextPlatform = payload.newPlatform || 'Platform 8A';
      nextStatus = 'Platform Changed';
      severity = 'warning';
      title = `${train.trainNumber} Reassigned to ${nextPlatform}`;
      message =
        payload.customMessage ||
        `Platform change notice: ${train.name} (${train.trainNumber}) departing at ${train.departureTime} has been reassigned from ${train.platform} to ${nextPlatform}.`;
    } else {
      nextStatus = 'Boarding';
      severity = 'info';
      title = `${train.trainNumber} Now Boarding at ${train.platform}`;
      message =
        payload.customMessage ||
        `All coaches for ${train.name} to ${train.destination} are now open for boarding at ${train.platform}.`;
    }

    const updatedTrain = await db
      .update(trains)
      .set({
        status: nextStatus,
        delayMinutes: nextDelay,
        platform: nextPlatform,
      })
      .where(eq(trains.id, train.id))
      .returning();

    const createdAlert = await db
      .insert(notifications)
      .values({
        trainId: train.id,
        trainNumber: train.trainNumber,
        trainName: train.name,
        type: payload.type,
        title,
        message,
        severity,
      })
      .returning();

    return {
      train: updatedTrain[0],
      notification: createdAlert[0],
    };
  } catch (error) {
    console.error('Database operation failed in dispatchTrainAlert:', error);
    throw new Error('Failed to publish live train alert.', { cause: error });
  }
}
