import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull().default('Passenger'),
  phone: text('phone').notNull().default(''),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const trains = pgTable('trains', {
  id: serial('id').primaryKey(),
  trainNumber: text('train_number').notNull().unique(),
  name: text('name').notNull(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  departureTime: text('departure_time').notNull(),
  arrivalTime: text('arrival_time').notNull(),
  duration: text('duration').notNull(),
  platform: text('platform').notNull(),
  status: text('status').notNull().default('On Time'),
  delayMinutes: integer('delay_minutes').notNull().default(0),
  baseFare: integer('base_fare').notNull(),
  totalSeats: integer('total_seats').notNull().default(48),
  availableSeats: integer('available_seats').notNull().default(42),
  routeStops: text('route_stops').notNull(),
});

export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  pnr: text('pnr').notNull().unique(),
  userUid: text('user_uid').notNull(),
  trainId: integer('train_id')
    .references(() => trains.id)
    .notNull(),
  passengerName: text('passenger_name').notNull(),
  passengerAge: integer('passenger_age').notNull(),
  passengerEmail: text('passenger_email').notNull(),
  travelDate: text('travel_date').notNull(),
  coachClass: text('coach_class').notNull(),
  seatNumber: text('seat_number').notNull(),
  cateringAddon: text('catering_addon').notNull().default('None'),
  baseAmount: integer('base_amount').notNull(),
  classSurcharge: integer('class_surcharge').notNull().default(0),
  cateringCharge: integer('catering_charge').notNull().default(0),
  taxAmount: integer('tax_amount').notNull(),
  totalAmount: integer('total_amount').notNull(),
  bookingStatus: text('booking_status').notNull().default('Confirmed'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  trainId: integer('train_id')
    .references(() => trains.id)
    .notNull(),
  trainNumber: text('train_number').notNull(),
  trainName: text('train_name').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  severity: text('severity').notNull().default('warning'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const trainsRelations = relations(trains, ({ many }) => ({
  bookings: many(bookings),
  notifications: many(notifications),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  train: one(trains, {
    fields: [bookings.trainId],
    references: [trains.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  train: one(trains, {
    fields: [notifications.trainId],
    references: [trains.id],
  }),
}));
