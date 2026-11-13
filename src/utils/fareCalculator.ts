export type CoachClass = 'Standard' | 'Business' | 'First Class';
export type CateringOption =
  | 'None'
  | 'Light Refreshments'
  | 'Artisanal Bistro Tray'
  | 'Executive Dining Service';

export const LOYALTY_POINTS_PER_DOLLAR = 10;

export const INDIAN_RAILWAY_STATIONS: string[] = [
  'New Delhi (NDLS)',
  'Mumbai Central (MMCT)',
  'Howrah Junction (HWH)',
  'Chennai Central (MAS)',
  'KSR Bengaluru (SBC)',
  'Varanasi Junction (BSB)',
  'Ahmedabad Junction (ADI)',
  'Pune Junction (PUNE)',
  'Jaipur Junction (JP)',
  'Lucknow Charbagh (LKO)',
  'Secunderabad Junction (SC)',
  'Guwahati (GHY)',
  'Thiruvananthapuram Central (TVC)',
  'Patna Junction (PNBE)',
  'Bhopal Junction (BPL)',
  'Nagpur Junction (NGP)',
  'Kota Junction (KOTA)',
  'Vadodara Junction (BRC)',
  'Surat (ST)',
  'Kanpur Central (CNB)',
  'Prayagraj Junction (PRYJ)',
  'Bhubaneswar (BBS)',
  'Visakhapatnam (VSKP)',
  'Vijayawada Junction (BZA)',
  'Kochi Ernakulam (ERS)',
];

export interface LoyaltySummary {
  totalPoints: number;
  completedTripsCount: number;
  completedSpend: number;
  pendingPoints: number;
  tierName: 'Explorer' | 'Silver Corridor' | 'Gold Express' | 'Executive Platinum';
  nextTierName: string | null;
  pointsToNextTier: number;
}

export interface FareBreakdown {
  baseAmount: number;
  classSurcharge: number;
  ageDiscount: number;
  cateringCharge: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  discountLabel: string | null;
}

export interface TrainScheduleItem {
  id: number;
  trainNumber: string;
  name: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  platform: string;
  status: string;
  delayMinutes: number;
  baseFare: number;
  totalSeats: number;
  availableSeats: number;
  routeStops: string;
}

export interface TicketExportData {
  pnr: string;
  trainNumber: string;
  trainName: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  platform: string;
  travelDate: string;
  passengerName: string;
  passengerAge: number;
  passengerEmail: string;
  coachClass: string;
  seatNumber: string;
  cateringAddon: string;
  baseAmount: number;
  classSurcharge: number;
  cateringCharge: number;
  taxAmount: number;
  totalAmount: number;
  bookingStatus: string;
}

const CLASS_SURCHARGE_MULTIPLIER: Record<CoachClass, number> = {
  Standard: 0,
  Business: 0.4,
  'First Class': 0.7,
};

const CATERING_PRICES: Record<CateringOption, number> = {
  None: 0,
  'Light Refreshments': 10,
  'Artisanal Bistro Tray': 18,
  'Executive Dining Service': 24,
};

export function calculateTripLoyaltyPoints(totalAmount: number, bookingStatus: string): number {
  if (bookingStatus !== 'Completed') {
    return 0;
  }
  return Math.max(0, Math.round(totalAmount) * LOYALTY_POINTS_PER_DOLLAR);
}

export function calculateLoyaltySummary(
  bookings: Array<{ totalAmount: number; bookingStatus: string }>
): LoyaltySummary {
  let totalPoints = 0;
  let completedTripsCount = 0;
  let completedSpend = 0;
  let pendingPoints = 0;

  for (const b of bookings) {
    const safeTotal = Math.max(0, Math.round(b.totalAmount || 0));
    if (b.bookingStatus === 'Completed') {
      completedTripsCount += 1;
      completedSpend += safeTotal;
      totalPoints += safeTotal * LOYALTY_POINTS_PER_DOLLAR;
    } else if (b.bookingStatus === 'Confirmed') {
      pendingPoints += safeTotal * LOYALTY_POINTS_PER_DOLLAR;
    }
  }

  let tierName: LoyaltySummary['tierName'] = 'Explorer';
  let nextTierName: string | null = 'Silver Corridor';
  let pointsToNextTier = Math.max(0, 1000 - totalPoints);

  if (totalPoints >= 6000) {
    tierName = 'Executive Platinum';
    nextTierName = null;
    pointsToNextTier = 0;
  } else if (totalPoints >= 3000) {
    tierName = 'Gold Express';
    nextTierName = 'Executive Platinum';
    pointsToNextTier = 6000 - totalPoints;
  } else if (totalPoints >= 1000) {
    tierName = 'Silver Corridor';
    nextTierName = 'Gold Express';
    pointsToNextTier = 3000 - totalPoints;
  }

  return {
    totalPoints,
    completedTripsCount,
    completedSpend,
    pendingPoints,
    tierName,
    nextTierName,
    pointsToNextTier,
  };
}

export function calculateItemizedFare(
  baseFare: number,
  coachClass: CoachClass,
  cateringAddon: CateringOption,
  passengerAge: number
): FareBreakdown {
  const safeBase = Math.max(0, Math.round(baseFare));
  const multiplier = CLASS_SURCHARGE_MULTIPLIER[coachClass] ?? 0;
  const rawClassSurcharge = Math.round(safeBase * multiplier);

  let ageDiscount = 0;
  let discountLabel: string | null = null;
  const seatFare = safeBase + rawClassSurcharge;

  if (passengerAge >= 60) {
    ageDiscount = Math.round(seatFare * 0.15);
    discountLabel = 'Senior Citizen Concession (15%)';
  } else if (passengerAge > 0 && passengerAge < 12) {
    ageDiscount = Math.round(seatFare * 0.25);
    discountLabel = 'Child Fare Concession (25%)';
  }

  const netClassSurcharge = Math.max(0, rawClassSurcharge - ageDiscount);
  const adjustedBase =
    rawClassSurcharge >= ageDiscount ? safeBase : Math.max(0, safeBase - (ageDiscount - rawClassSurcharge));

  const cateringCharge = CATERING_PRICES[cateringAddon] ?? 0;
  const subtotal = adjustedBase + netClassSurcharge + cateringCharge;
  const taxAmount = Math.round(subtotal * 0.1);
  const totalAmount = subtotal + taxAmount;

  return {
    baseAmount: adjustedBase,
    classSurcharge: netClassSurcharge,
    ageDiscount,
    cateringCharge,
    subtotal,
    taxAmount,
    totalAmount,
    discountLabel,
  };
}

export function computeAdjustedTime(scheduledHHMM: string, delayMinutes: number): string {
  if (!scheduledHHMM || !/^\d{2}:\d{2}$/.test(scheduledHHMM)) {
    return scheduledHHMM;
  }
  if (!delayMinutes || delayMinutes <= 0) {
    return scheduledHHMM;
  }
  const [hoursStr, minsStr] = scheduledHHMM.split(':');
  const totalMinutes = (parseInt(hoursStr, 10) * 60 + parseInt(minsStr, 10) + delayMinutes) % (24 * 60);
  const nextHours = Math.floor(totalMinutes / 60);
  const nextMins = totalMinutes % 60;
  return `${String(nextHours).padStart(2, '0')}:${String(nextMins).padStart(2, '0')}`;
}

function getOrderedStationNames(train: TrainScheduleItem): string[] {
  try {
    const parsed = JSON.parse(train.routeStops || '[]');
    if (Array.isArray(parsed) && parsed.length >= 2) {
      return parsed.map((s: any) => String(s.station || ''));
    }
  } catch {
    // Fallback to origin and destination
  }
  return [train.origin, train.destination];
}

export function filterTrains<T extends TrainScheduleItem>(
  trains: T[],
  filters: {
    origin?: string;
    destination?: string;
    status?: string;
    searchQuery?: string;
  }
): T[] {
  const origQuery = filters.origin && filters.origin !== 'All' ? filters.origin.trim().toLowerCase() : '';
  const destQuery =
    filters.destination && filters.destination !== 'All'
      ? filters.destination.trim().toLowerCase()
      : '';

  return trains.filter((train) => {
    const orderedStops = getOrderedStationNames(train).map((s) => s.toLowerCase());

    if (origQuery && destQuery) {
      const origIdx = orderedStops.findIndex((s) => s.includes(origQuery));
      const destIdx = orderedStops.findIndex((s, idx) => idx > origIdx && s.includes(destQuery));
      const directMatch =
        train.origin.toLowerCase().includes(origQuery) &&
        train.destination.toLowerCase().includes(destQuery);
      if (!directMatch && (origIdx === -1 || destIdx === -1)) {
        return false;
      }
    } else if (origQuery) {
      const origMatch =
        train.origin.toLowerCase().includes(origQuery) ||
        orderedStops.slice(0, -1).some((s) => s.includes(origQuery));
      if (!origMatch) {
        return false;
      }
    } else if (destQuery) {
      const destMatch =
        train.destination.toLowerCase().includes(destQuery) ||
        orderedStops.slice(1).some((s) => s.includes(destQuery));
      if (!destMatch) {
        return false;
      }
    }

    if (filters.status && filters.status !== 'All') {
      if (filters.status === 'Delayed' && train.status !== 'Delayed' && train.delayMinutes <= 0) {
        return false;
      } else if (filters.status !== 'Delayed' && train.status !== filters.status) {
        return false;
      }
    }

    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.trim().toLowerCase();
      const match =
        train.name.toLowerCase().includes(q) ||
        train.trainNumber.toLowerCase().includes(q) ||
        train.origin.toLowerCase().includes(q) ||
        train.destination.toLowerCase().includes(q) ||
        train.platform.toLowerCase().includes(q) ||
        orderedStops.some((s) => s.includes(q));
      if (!match) return false;
    }
    return true;
  });
}

export function generatePnrCode(trainNumber: string, seatNumber: string, seed?: number): string {
  const cleanNum = trainNumber.replace(/[^0-9]/g, '').slice(0, 3) || '129';
  const suffix =
    seed !== undefined
      ? String(seed % 1000).padStart(3, '0')
      : String(Math.floor(100 + Math.random() * 900));
  const seatChar = seatNumber.replace(/[^A-Z0-9]/gi, '').slice(-2).toUpperCase() || '1A';
  return `PNR-${cleanNum}${suffix}${seatChar}`;
}

export function formatPrintableTicket(ticket: TicketExportData): string {
  const earnedPoints = calculateTripLoyaltyPoints(ticket.totalAmount, ticket.bookingStatus);
  return [
    '====================================================================',
    '                         NAMOEXPRESS INDIA                          ',
    '               OFFICIAL E-TICKET & ITEMIZED RECEIPT                 ',
    '====================================================================',
    `PNR REFERENCE   : ${ticket.pnr}`,
    `BOOKING STATUS  : ${ticket.bookingStatus.toUpperCase()}`,
    `TRAVEL DATE     : ${ticket.travelDate}`,
    '--------------------------------------------------------------------',
    'TRAIN & ROUTE DETAILS',
    `Train           : ${ticket.trainNumber} — ${ticket.trainName}`,
    `Starting Station: ${ticket.origin} (Departs ${ticket.departureTime})`,
    `Ending Location : ${ticket.destination} (Arrives ${ticket.arrivalTime})`,
    `Boarding Track  : ${ticket.platform}`,
    '--------------------------------------------------------------------',
    'PASSENGER & COACH ALLOCATION',
    `Passenger Name  : ${ticket.passengerName} (Age: ${ticket.passengerAge})`,
    `Contact Email   : ${ticket.passengerEmail}`,
    `Coach Class     : ${ticket.coachClass}`,
    `Assigned Seat   : ${ticket.seatNumber}`,
    `Onboard Dining  : ${ticket.cateringAddon}`,
    '--------------------------------------------------------------------',
    'ITEMIZED FARE BILL (USD)',
    `Base Rail Fare                 : $${ticket.baseAmount.toFixed(2)}`,
    `Coach Class Upgrade Surcharge  : $${ticket.classSurcharge.toFixed(2)}`,
    `Onboard Catering & Service     : $${ticket.cateringCharge.toFixed(2)}`,
    `Rail Infrastructure & Tax (10%): $${ticket.taxAmount.toFixed(2)}`,
    '--------------------------------------------------------------------',
    `TOTAL AMOUNT PAID              : $${ticket.totalAmount.toFixed(2)}`,
    `LOYALTY POINTS EARNED          : ${earnedPoints} pts`,
    '====================================================================',
    'Please arrive at your assigned platform at least 15 minutes prior   ',
    'to scheduled departure. Valid photo ID required during inspection.  ',
    '====================================================================',
  ].join('\n');
}
