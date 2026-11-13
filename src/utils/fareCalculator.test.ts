import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItemizedFare,
  calculateTripLoyaltyPoints,
  calculateLoyaltySummary,
  computeAdjustedTime,
  filterTrains,
  generatePnrCode,
  formatPrintableTicket,
  INDIAN_RAILWAY_STATIONS,
  TrainScheduleItem,
} from './fareCalculator';

test('INDIAN_RAILWAY_STATIONS contains exclusively Indian stations', () => {
  assert.ok(INDIAN_RAILWAY_STATIONS.includes('New Delhi (NDLS)'));
  assert.ok(INDIAN_RAILWAY_STATIONS.includes('Mumbai Central (MMCT)'));
  assert.ok(INDIAN_RAILWAY_STATIONS.includes('Howrah Junction (HWH)'));
  assert.ok(INDIAN_RAILWAY_STATIONS.includes('Chennai Central (MAS)'));
  assert.ok(INDIAN_RAILWAY_STATIONS.includes('KSR Bengaluru (SBC)'));
});

test('calculateItemizedFare computes standard adult fare and 10% tax accurately', () => {
  const res = calculateItemizedFare(100, 'Standard', 'None', 30);
  assert.equal(res.baseAmount, 100);
  assert.equal(res.classSurcharge, 0);
  assert.equal(res.cateringCharge, 0);
  assert.equal(res.taxAmount, 10);
  assert.equal(res.totalAmount, 110);
  assert.equal(res.discountLabel, null);
});

test('calculateItemizedFare computes Business class surcharge and catering addon', () => {
  const res = calculateItemizedFare(100, 'Business', 'Artisanal Bistro Tray', 28);
  assert.equal(res.baseAmount, 100);
  assert.equal(res.classSurcharge, 40);
  assert.equal(res.cateringCharge, 18);
  assert.equal(res.subtotal, 158);
  assert.equal(res.taxAmount, 16);
  assert.equal(res.totalAmount, 174);
});

test('calculateItemizedFare applies 15% senior citizen concession for age >= 60', () => {
  const res = calculateItemizedFare(100, 'First Class', 'None', 65);
  assert.equal(res.ageDiscount, 26);
  assert.equal(res.discountLabel, 'Senior Citizen Concession (15%)');
  assert.equal(res.subtotal, 144);
  assert.equal(res.taxAmount, 14);
  assert.equal(res.totalAmount, 158);
});

test('calculateTripLoyaltyPoints awards 10 points per dollar only on Completed trips', () => {
  assert.equal(calculateTripLoyaltyPoints(204, 'Completed'), 2040);
  assert.equal(calculateTripLoyaltyPoints(210, 'Confirmed'), 0);
  assert.equal(calculateTripLoyaltyPoints(204, 'Cancelled'), 0);
});

test('calculateLoyaltySummary aggregates completed trip points, pending points, and tier status', () => {
  const summary = calculateLoyaltySummary([
    { totalAmount: 204, bookingStatus: 'Completed' },
    { totalAmount: 210, bookingStatus: 'Confirmed' },
    { totalAmount: 95, bookingStatus: 'Cancelled' },
  ]);
  assert.equal(summary.totalPoints, 2040);
  assert.equal(summary.completedTripsCount, 1);
  assert.equal(summary.completedSpend, 204);
  assert.equal(summary.pendingPoints, 2100);
  assert.equal(summary.tierName, 'Silver Corridor');
  assert.equal(summary.nextTierName, 'Gold Express');
  assert.equal(summary.pointsToNextTier, 960);
});

test('computeAdjustedTime adds delay minutes across hour boundaries', () => {
  assert.equal(computeAdjustedTime('09:50', 18), '10:08');
  assert.equal(computeAdjustedTime('11:15', 0), '11:15');
  assert.equal(computeAdjustedTime('23:50', 25), '00:15');
});

test('filterTrains searches Indian trains by starting station, ending location, and intermediate stops', () => {
  const sampleTrains: TrainScheduleItem[] = [
    {
      id: 1,
      trainNumber: '12952',
      name: 'Mumbai Rajdhani Tejas Express',
      origin: 'New Delhi (NDLS)',
      destination: 'Mumbai Central (MMCT)',
      departureTime: '16:55',
      arrivalTime: '08:35',
      duration: '15h 40m',
      platform: 'Platform 3',
      status: 'On Time',
      delayMinutes: 0,
      baseFare: 145,
      totalSeats: 48,
      availableSeats: 38,
      routeStops:
        '[{"station":"New Delhi (NDLS)","time":"16:55","status":"Departed"},{"station":"Kota Junction (KOTA)","time":"21:30","status":"On Time"},{"station":"Vadodara Junction (BRC)","time":"03:15","status":"On Time"},{"station":"Surat (ST)","time":"05:05","status":"On Time"},{"station":"Mumbai Central (MMCT)","time":"08:35","status":"Scheduled"}]',
    },
    {
      id: 2,
      trainNumber: '12627',
      name: 'Karnataka Superfast Express',
      origin: 'KSR Bengaluru (SBC)',
      destination: 'New Delhi (NDLS)',
      departureTime: '19:20',
      arrivalTime: '09:00',
      duration: '37h 40m',
      platform: 'Platform 1',
      status: 'Delayed',
      delayMinutes: 15,
      baseFare: 134,
      totalSeats: 48,
      availableSeats: 29,
      routeStops:
        '[{"station":"KSR Bengaluru (SBC)","time":"19:20","status":"Delayed +15m"},{"station":"Secunderabad Junction (SC)","time":"06:55","status":"Delayed +15m"},{"station":"Nagpur Junction (NGP)","time":"16:05","status":"Expected"},{"station":"Bhopal Junction (BPL)","time":"22:30","status":"Expected"},{"station":"New Delhi (NDLS)","time":"09:00","status":"Expected 09:15"}]',
    },
  ];

  const byStartAndEnd = filterTrains(sampleTrains, {
    origin: 'New Delhi (NDLS)',
    destination: 'Mumbai Central (MMCT)',
  });
  assert.equal(byStartAndEnd.length, 1);
  assert.equal(byStartAndEnd[0].trainNumber, '12952');

  const byIntermediateStops = filterTrains(sampleTrains, {
    origin: 'Kota Junction (KOTA)',
    destination: 'Surat (ST)',
  });
  assert.equal(byIntermediateStops.length, 1);
  assert.equal(byIntermediateStops[0].trainNumber, '12952');

  const byDelayed = filterTrains(sampleTrains, { status: 'Delayed' });
  assert.equal(byDelayed.length, 1);
  assert.equal(byDelayed[0].trainNumber, '12627');
});

test('generatePnrCode and formatPrintableTicket produce complete Indian Railway receipt output', () => {
  const pnr = generatePnrCode('12952', 'C2-04A', 421);
  assert.equal(pnr, 'PNR-1294214A');

  const text = formatPrintableTicket({
    pnr,
    trainNumber: '12952',
    trainName: 'Mumbai Rajdhani Tejas Express',
    origin: 'New Delhi (NDLS)',
    destination: 'Mumbai Central (MMCT)',
    departureTime: '16:55',
    arrivalTime: '08:35',
    platform: 'Platform 3',
    travelDate: '2026-10-30',
    passengerName: 'Aarav Sharma',
    passengerAge: 34,
    passengerEmail: 'aarav.sharma@bharatrail.in',
    coachClass: 'Business',
    seatNumber: 'C2-04A',
    cateringAddon: 'Artisanal Bistro Tray',
    baseAmount: 120,
    classSurcharge: 48,
    cateringCharge: 18,
    taxAmount: 19,
    totalAmount: 205,
    bookingStatus: 'Completed',
  });
  assert.ok(text.includes('PNR-1294214A'));
  assert.ok(text.includes('New Delhi (NDLS)'));
  assert.ok(text.includes('Mumbai Central (MMCT)'));
  assert.ok(text.includes('2050 pts'));
});
