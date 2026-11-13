import React from 'react';
import { motion } from 'motion/react';
import { X, Clock, MapPin, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { TrainScheduleItem, computeAdjustedTime } from '../utils/fareCalculator';

interface RouteStop {
  station: string;
  time: string;
  status: string;
}

interface RouteTimelineModalProps {
  train: TrainScheduleItem | null;
  onClose: () => void;
  onSelectForBooking: (train: TrainScheduleItem) => void;
}

export const RouteTimelineModal: React.FC<RouteTimelineModalProps> = ({
  train,
  onClose,
  onSelectForBooking,
}) => {
  if (!train) return null;

  let stops: RouteStop[] = [];
  try {
    stops = JSON.parse(train.routeStops || '[]');
  } catch {
    stops = [];
  }

  const adjustedArrival = computeAdjustedTime(train.arrivalTime, train.delayMinutes);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="timeline-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-bold text-[#D61F69]">{train.trainNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{train.platform}</span>
              <span aria-hidden="true">·</span>
              <span>{train.duration} transit duration</span>
            </div>
            <h2 id="timeline-modal-title" className="mt-1 text-xl font-bold text-slate-900">
              {train.name} — Live Indian Corridor Schedule
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close route timeline"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corridor Summary Strip */}
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-950 p-4 text-white sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-400">Starting Station</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{train.origin}</p>
            <p className="font-mono text-sm font-medium text-[#A3E635]">{train.departureTime}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Ending Location</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{train.destination}</p>
            <div className="flex items-center gap-2 font-mono text-sm">
              <span
                className={
                  train.delayMinutes > 0 ? 'text-slate-400 line-through' : 'font-medium text-[#A3E635]'
                }
              >
                {train.arrivalTime}
              </span>
              {train.delayMinutes > 0 && (
                <span className="font-semibold text-[#EC4899]">Est. {adjustedArrival}</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Operating Status</p>
            <p
              className={`mt-0.5 text-sm font-semibold ${
                train.delayMinutes > 0
                  ? 'text-[#EC4899]'
                  : train.status === 'Platform Changed'
                    ? 'text-amber-400'
                    : 'text-[#A3E635]'
              }`}
            >
              {train.status}
              {train.delayMinutes > 0 ? ` (+${train.delayMinutes} min)` : ''}
            </p>
            <p className="font-mono text-xs text-slate-300">
              {train.availableSeats} of {train.totalSeats} seats open
            </p>
          </div>
        </div>

        {/* Intermediate Stops Timeline */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-slate-700">
            Station-by-Station Indian Corridor Progression ({stops.length} Halts)
          </h3>
          <div className="mt-3 space-y-2.5">
            {stops.map((stop, idx) => {
              const isDelayedStop = stop.status.toLowerCase().includes('delay');
              const isDeparted =
                stop.status.toLowerCase().includes('departed') ||
                stop.status.toLowerCase().includes('boarding');
              return (
                <motion.div
                  key={`${stop.station}-${idx}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: idx * 0.04 }}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 hover:border-[#D61F69]/40"
                >
                  <div className="flex items-center gap-3">
                    {isDelayedStop ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-[#D61F69]" />
                    ) : isDeparted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4D7C0F]" />
                    ) : (
                      <MapPin className="h-4 w-4 shrink-0 text-[#D61F69]" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {idx + 1}. {stop.station}
                      </p>
                      <p className="text-xs text-slate-500">
                        {idx === 0
                          ? 'Starting Station (Origin)'
                          : idx === stops.length - 1
                            ? 'Ending Location (Terminal)'
                            : 'Intermediate Junction Halt'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-slate-900">{stop.time}</p>
                    <p
                      className={`text-xs font-semibold ${
                        isDelayedStop ? 'text-[#D61F69]' : 'text-[#4D7C0F]'
                      }`}
                    >
                      {stop.status}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Clock className="h-4 w-4 text-[#D61F69]" />
            <span>
              Base Fare from <strong className="font-mono text-slate-900">${train.baseFare}.00</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Close Schedule
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectForBooking(train);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D61F69] px-4 py-2 text-xs font-semibold text-white hover:bg-[#BE185D]"
            >
              Reserve Seat on {train.trainNumber}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
