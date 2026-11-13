import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, AlertCircle, Train, Utensils, Armchair } from 'lucide-react';
import {
  TrainScheduleItem,
  CoachClass,
  CateringOption,
  calculateItemizedFare,
} from '../utils/fareCalculator';
import { useAuth } from '../context/AuthContext';

interface BookingViewProps {
  trains: TrainScheduleItem[];
  selectedTrain: TrainScheduleItem | null;
  onSelectTrain: (train: TrainScheduleItem) => void;
  onBookingSuccess: () => void;
  onOpenAuthModal: () => void;
}

const COACH_SEATS = [
  ['01A', '01B', '01C', '01D'],
  ['02A', '02B', '02C', '02D'],
  ['03A', '03B', '03C', '03D'],
  ['04A', '04B', '04C', '04D'],
  ['05A', '05B', '05C', '05D'],
  ['06A', '06B', '06C', '06D'],
];

const COACH_PREFIX: Record<CoachClass, string> = {
  'First Class': 'C1',
  Business: 'C2',
  Standard: 'C3',
};

export const BookingView: React.FC<BookingViewProps> = ({
  trains,
  selectedTrain,
  onSelectTrain,
  onBookingSuccess,
  onOpenAuthModal,
}) => {
  const { passenger, getAuthHeaders } = useAuth();
  const activeTrain = selectedTrain || trains[0] || null;

  const [coachClass, setCoachClass] = useState<CoachClass>('Business');
  const [selectedSeatCode, setSelectedSeatCode] = useState<string>('03A');
  const [cateringAddon, setCateringAddon] = useState<CateringOption>('Artisanal Bistro Tray');
  const [travelDate, setTravelDate] = useState<string>('2026-10-30');
  const [passengerName, setPassengerName] = useState<string>(passenger?.name || 'Aarav Sharma');
  const [passengerAge, setPassengerAge] = useState<string>('34');
  const [passengerEmail, setPassengerEmail] = useState<string>(
    passenger?.email || 'aarav.sharma@bharatrail.in'
  );

  const [occupiedSeats, setOccupiedSeats] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (passenger) {
      setPassengerName(passenger.name);
      setPassengerEmail(passenger.email);
    }
  }, [passenger]);

  useEffect(() => {
    if (!activeTrain) return;
    let cancelled = false;
    fetch(`/api/trains/${activeTrain.id}/seats?date=${encodeURIComponent(travelDate)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.bookedSeats)) {
          setOccupiedSeats(data.bookedSeats);
        }
      })
      .catch(() => {
        if (!cancelled) setOccupiedSeats([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTrain, travelDate]);

  if (!activeTrain) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">Loading available Indian trains for seat reservation...</p>
      </div>
    );
  }

  const coachPrefix = COACH_PREFIX[coachClass];
  const fullSeatNumber = `${coachPrefix}-${selectedSeatCode}`;
  const parsedAge = Math.max(1, parseInt(passengerAge || '30', 10) || 30);
  const fareBreakdown = calculateItemizedFare(
    activeTrain.baseFare,
    coachClass,
    cateringAddon,
    parsedAge
  );

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!passenger) {
      onOpenAuthModal();
      return;
    }

    if (!passengerName.trim()) {
      setFormError('Passenger full name is required to issue a ticket.');
      return;
    }
    if (!passengerEmail.trim() || !passengerEmail.includes('@')) {
      setFormError('A valid passenger email address is required for ticket delivery.');
      return;
    }
    const ageNum = parseInt(passengerAge, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      setFormError('Please enter a valid passenger age between 1 and 120.');
      return;
    }
    if (occupiedSeats.includes(fullSeatNumber)) {
      setFormError(`Seat ${fullSeatNumber} is already reserved. Please select an open seat.`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          trainId: activeTrain.id,
          trainNumber: activeTrain.trainNumber,
          passengerName: passengerName.trim(),
          passengerAge: ageNum,
          passengerEmail: passengerEmail.trim(),
          travelDate,
          coachClass,
          seatNumber: fullSeatNumber,
          cateringAddon,
          baseFare: activeTrain.baseFare,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not complete ticket reservation');
      }
      onBookingSuccess();
    } catch (err: any) {
      setFormError(err.message || 'Reservation request failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Train Selector Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Reserve Indian Rail Ticket & Interactive Coach Seat Allocation
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Select your Indian Express train, preferred coach class, and exact window or aisle seat
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="booking-train-select" className="text-xs font-semibold text-slate-700">
              Selected Train:
            </label>
            <select
              id="booking-train-select"
              value={activeTrain.id}
              onChange={(e) => {
                const found = trains.find((t) => t.id === Number(e.target.value));
                if (found) onSelectTrain(found);
              }}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#D61F69] focus:outline-none"
            >
              {trains.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trainNumber} — {t.name} ({t.origin} → {t.destination}, {t.departureTime})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Split: Left Passenger & Seat Map | Right Live Itemized Bill */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form onSubmit={handleConfirmBooking} className="space-y-6 lg:col-span-8">
          {formError && (
            <div
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Step 1: Coach Class & Catering Selection */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900">
              01. Travel Date, Coach Class & Onboard Dining
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="travel-date-input" className="block text-xs font-medium text-slate-700">
                  Departure Date
                </label>
                <input
                  id="travel-date-input"
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#D61F69] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="coach-class-select" className="block text-xs font-medium text-slate-700">
                  Coach Class
                </label>
                <select
                  id="coach-class-select"
                  value={coachClass}
                  onChange={(e) => setCoachClass(e.target.value as CoachClass)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#D61F69] focus:outline-none"
                >
                  <option value="Standard">Standard Chair Car (Base Fare)</option>
                  <option value="Business">Executive AC Chair Car (+40%)</option>
                  <option value="First Class">First Class AC Coupe (+70%)</option>
                </select>
              </div>

              <div>
                <label htmlFor="catering-select" className="block text-xs font-medium text-slate-700">
                  Onboard Dining Service
                </label>
                <select
                  id="catering-select"
                  value={cateringAddon}
                  onChange={(e) => setCateringAddon(e.target.value as CateringOption)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#D61F69] focus:outline-none"
                >
                  <option value="None">None ($0)</option>
                  <option value="Light Refreshments">Chai & Light Refreshments (+$10)</option>
                  <option value="Artisanal Bistro Tray">Royal Indian Thali Tray (+$18)</option>
                  <option value="Executive Dining Service">Executive Rajdhani Dining (+$24)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Step 2: Interactive Coach Seat Map */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  02. Interactive Coach Seat Map — Coach {coachPrefix} ({coachClass})
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Columns A & D are panoramic window seats · Columns B & C are center aisle seats
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs border border-slate-300 bg-white" /> Available
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-[#D61F69]" /> Selected ({fullSeatNumber})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-slate-200" /> Reserved
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mx-auto max-w-md">
                <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-medium text-slate-500">
                  <span>Window (A)</span>
                  <span>Aisle (B)</span>
                  <span className="font-mono text-[#4D7C0F]">CORRIDOR</span>
                  <span>Aisle (C)</span>
                  <span>Window (D)</span>
                </div>

                <div className="space-y-2.5">
                  {COACH_SEATS.map((row, rIdx) => (
                    <div key={rIdx} className="grid grid-cols-5 items-center gap-2">
                      {row.slice(0, 2).map((seatCode) => {
                        const candidate = `${coachPrefix}-${seatCode}`;
                        const isOccupied = occupiedSeats.includes(candidate);
                        const isSelected = selectedSeatCode === seatCode;
                        return (
                          <motion.button
                            key={seatCode}
                            type="button"
                            disabled={isOccupied}
                            whileHover={!isOccupied ? { scale: 1.03 } : undefined}
                            whileTap={!isOccupied ? { scale: 0.97 } : undefined}
                            aria-label={`Select seat ${candidate}`}
                            onClick={() => setSelectedSeatCode(seatCode)}
                            className={`flex items-center justify-center gap-1 rounded-lg border py-2 font-mono text-xs font-semibold transition-colors ${
                              isOccupied
                                ? 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400 line-through'
                                : isSelected
                                  ? 'border-[#D61F69] bg-[#D61F69] text-white shadow-xs'
                                  : 'border-slate-300 bg-white text-slate-800 hover:border-[#D61F69]'
                            }`}
                          >
                            <Armchair className="h-3.5 w-3.5" />
                            {seatCode}
                          </motion.button>
                        );
                      })}

                      <div className="text-center font-mono text-xs text-slate-400">
                        Row 0{rIdx + 1}
                      </div>

                      {row.slice(2, 4).map((seatCode) => {
                        const candidate = `${coachPrefix}-${seatCode}`;
                        const isOccupied = occupiedSeats.includes(candidate);
                        const isSelected = selectedSeatCode === seatCode;
                        return (
                          <motion.button
                            key={seatCode}
                            type="button"
                            disabled={isOccupied}
                            whileHover={!isOccupied ? { scale: 1.03 } : undefined}
                            whileTap={!isOccupied ? { scale: 0.97 } : undefined}
                            aria-label={`Select seat ${candidate}`}
                            onClick={() => setSelectedSeatCode(seatCode)}
                            className={`flex items-center justify-center gap-1 rounded-lg border py-2 font-mono text-xs font-semibold transition-colors ${
                              isOccupied
                                ? 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-400 line-through'
                                : isSelected
                                  ? 'border-[#D61F69] bg-[#D61F69] text-white shadow-xs'
                                  : 'border-slate-300 bg-white text-slate-800 hover:border-[#D61F69]'
                            }`}
                          >
                            <Armchair className="h-3.5 w-3.5" />
                            {seatCode}
                          </motion.button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Passenger Information */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-bold text-slate-900">
              03. Passenger Identification & Contact Details
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="passenger-name-input" className="block text-xs font-medium text-slate-700">
                  Passenger Full Name
                </label>
                <input
                  id="passenger-name-input"
                  type="text"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="Full legal name"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#D61F69] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="passenger-age-input" className="block text-xs font-medium text-slate-700">
                  Age (Years — 60+ Senior Discount)
                </label>
                <input
                  id="passenger-age-input"
                  type="number"
                  min={1}
                  max={120}
                  value={passengerAge}
                  onChange={(e) => setPassengerAge(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#D61F69] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="passenger-email-input" className="block text-xs font-medium text-slate-700">
                  E-Ticket Delivery Email
                </label>
                <input
                  id="passenger-email-input"
                  type="email"
                  value={passengerEmail}
                  onChange={(e) => setPassengerEmail(e.target.value)}
                  placeholder="passenger@bharatrail.in"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#D61F69] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end border-t border-slate-200 pt-4">
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#D61F69] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#BE185D] disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {submitting
                  ? 'Confirming Reservation...'
                  : `Confirm Ticket & Pay $${fareBreakdown.totalAmount.toFixed(2)}`}
              </motion.button>
            </div>
          </div>
        </form>

        {/* Right Column: Live Itemized Bill Preview */}
        <div className="lg:col-span-4">
          <div className="sticky top-6 rounded-xl border border-slate-200 bg-slate-950 p-6 text-white">
            <div className="border-b border-slate-800 pb-4">
              <p className="text-xs font-semibold text-[#A3E635]">LIVE FARE ESTIMATE & BILL</p>
              <h3 className="mt-0.5 text-base font-bold text-white">
                {activeTrain.trainNumber} · {activeTrain.name}
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                {activeTrain.origin} ({activeTrain.departureTime}) → {activeTrain.destination} (
                {activeTrain.arrivalTime})
              </p>
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <Train className="h-3.5 w-3.5 text-[#A3E635]" />
                  Boarding Track
                </span>
                <span className="font-mono font-semibold text-white">{activeTrain.platform}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <Armchair className="h-3.5 w-3.5 text-[#EC4899]" />
                  Selected Coach & Seat
                </span>
                <span className="font-mono font-semibold text-[#EC4899]">
                  {coachClass} · {fullSeatNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <Utensils className="h-3.5 w-3.5 text-[#A3E635]" />
                  Dining Selection
                </span>
                <span className="font-medium text-white">{cateringAddon}</span>
              </div>
            </div>

            <div className="mt-5 space-y-2.5 border-t border-slate-800 pt-4 text-sm">
              <div className="flex items-center justify-between text-slate-300">
                <span>Base Corridor Fare</span>
                <span className="font-mono tabular-nums">${fareBreakdown.baseAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>{coachClass} Upgrade</span>
                <span className="font-mono tabular-nums">
                  +${fareBreakdown.classSurcharge.toFixed(2)}
                </span>
              </div>
              {fareBreakdown.discountLabel && (
                <div className="flex items-center justify-between text-xs font-medium text-[#A3E635]">
                  <span>{fareBreakdown.discountLabel}</span>
                  <span className="font-mono tabular-nums">
                    Applied (-${fareBreakdown.ageDiscount.toFixed(2)})
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-slate-300">
                <span>Onboard Catering</span>
                <span className="font-mono tabular-nums">
                  +${fareBreakdown.cateringCharge.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-xs text-slate-400">
                <span>Rail Tax & Levy (10%)</span>
                <span className="font-mono tabular-nums">+${fareBreakdown.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-base font-bold text-white">
                <span>Total Payable Bill</span>
                <span className="font-mono text-lg text-[#A3E635] tabular-nums">
                  ${fareBreakdown.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
              <p className="font-medium text-[#EC4899]">Instant E-Ticket & PNR Generation</p>
              <p className="mt-0.5">
                Your seat allocation and itemized tax invoice are immediately confirmed and
                available for instant download.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
