import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Download, Printer, FileText, Ticket, CheckCircle2 } from 'lucide-react';
import { formatPrintableTicket } from '../utils/fareCalculator';

export interface EnrichedBooking {
  id: number;
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
  bookingStatus: string;
  createdAt?: string;
  trainNumber: string;
  trainName: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  platform: string;
  trainStatus: string;
  delayMinutes: number;
}

interface BillAndTicketModalProps {
  booking: EnrichedBooking | null;
  initialMode: 'bill' | 'ticket';
  onClose: () => void;
}

export const BillAndTicketModal: React.FC<BillAndTicketModalProps> = ({
  booking,
  initialMode,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'bill' | 'ticket'>(initialMode);
  const [downloadedNotice, setDownloadedNotice] = useState(false);

  if (!booking) return null;

  const handleDownloadTicketFile = () => {
    const content = formatPrintableTicket({
      pnr: booking.pnr,
      trainNumber: booking.trainNumber,
      trainName: booking.trainName,
      origin: booking.origin,
      destination: booking.destination,
      departureTime: booking.departureTime,
      arrivalTime: booking.arrivalTime,
      platform: booking.platform,
      travelDate: booking.travelDate,
      passengerName: booking.passengerName,
      passengerAge: booking.passengerAge,
      passengerEmail: booking.passengerEmail,
      coachClass: booking.coachClass,
      seatNumber: booking.seatNumber,
      cateringAddon: booking.cateringAddon,
      baseAmount: booking.baseAmount,
      classSurcharge: booking.classSurcharge,
      cateringCharge: booking.cateringCharge,
      taxAmount: booking.taxAmount,
      totalAmount: booking.totalAmount,
      bookingStatus: booking.bookingStatus,
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NamoExpress-Ticket-${booking.pnr}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadedNotice(true);
  };

  const subtotal = booking.baseAmount + booking.classSurcharge + booking.cateringCharge;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bill-ticket-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        {/* Header with Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-bold text-[#D61F69]">{booking.pnr}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#4D7C0F]">{booking.bookingStatus}</span>
              <span aria-hidden="true">·</span>
              <span>Travel Date: {booking.travelDate}</span>
            </div>
            <h2 id="bill-ticket-modal-title" className="mt-1 text-lg font-bold text-slate-900">
              {activeTab === 'bill'
                ? 'Official Itemized Fare Bill & Tax Receipt'
                : 'Digital Boarding Pass & Printable E-Ticket'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('bill')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'bill'
                    ? 'bg-[#D61F69] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Itemized Bill
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ticket')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'ticket'
                    ? 'bg-[#D61F69] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Ticket className="h-3.5 w-3.5" />
                Boarding E-Ticket
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close bill and ticket modal"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {downloadedNotice && (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg border border-[#84CC16] bg-[#F7FEE7] px-4 py-2.5 text-xs font-medium text-[#365314]"
            role="status"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4D7C0F]" />
            <span>
              E-Ticket & Receipt saved as <strong className="font-mono">NamoExpress-Ticket-{booking.pnr}.txt</strong>
            </span>
          </div>
        )}

        {activeTab === 'bill' ? (
          <div className="mt-5 space-y-5">
            {/* Passenger & Journey Metadata */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Billed To Passenger</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {booking.passengerName} (Age {booking.passengerAge})
                </p>
                <p className="font-mono text-xs text-slate-600">{booking.passengerEmail}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-slate-500">Train & Coach Allocation</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {booking.trainNumber} — {booking.trainName}
                </p>
                <p className="text-xs text-slate-600">
                  {booking.coachClass} · Seat{' '}
                  <span className="font-mono font-semibold text-[#D61F69]">{booking.seatNumber}</span> ·{' '}
                  {booking.platform}
                </p>
              </div>
            </div>

            {/* Itemized Fare Table */}
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Fare Component Description</th>
                    <th className="px-4 py-3">Allocation / Rate</th>
                    <th className="px-4 py-3 text-right">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  <tr>
                    <td className="px-4 py-3 font-medium">Base Corridor Rail Fare</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {booking.origin} → {booking.destination}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      ${booking.baseAmount.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Coach Class Surcharge</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {booking.coachClass} Coach — Seat {booking.seatNumber}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      ${booking.classSurcharge.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Onboard Dining & Catering</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{booking.cateringAddon}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      ${booking.cateringCharge.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70">
                    <td className="px-4 py-2.5 text-xs font-medium text-slate-600" colSpan={2}>
                      Subtotal Before Taxes
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-700 tabular-nums">
                      ${subtotal.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Rail Infrastructure & GST Levy</td>
                    <td className="px-4 py-3 text-xs text-slate-500">10% Statutory Transit Tax</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      ${booking.taxAmount.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-950 text-white">
                  <tr>
                    <td className="px-4 py-3.5 text-sm font-semibold" colSpan={2}>
                      Total Amount Billed ({booking.bookingStatus})
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-base font-bold text-[#A3E635] tabular-nums">
                      ${booking.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          /* E-Ticket Boarding Pass View */
          <div className="mt-5 rounded-xl border border-slate-300 bg-slate-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold text-[#D61F69]">NAMOEXPRESS BOARDING PASS</p>
                <h3 className="text-lg font-bold text-slate-900">
                  {booking.trainNumber} · {booking.trainName}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Reservation PNR</p>
                <p className="font-mono text-base font-bold text-[#D61F69]">{booking.pnr}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Starting Station</p>
                <p className="mt-0.5 text-base font-bold text-slate-900">{booking.origin}</p>
                <p className="font-mono text-sm font-semibold text-[#D61F69]">
                  Departs {booking.departureTime}
                </p>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-center font-mono text-xs text-slate-500">{booking.duration}</p>
                <div className="my-1.5 flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#D61F69]" />
                  <div className="h-0.5 flex-1 bg-[#84CC16]" />
                  <div className="h-2.5 w-2.5 rounded-full bg-[#4D7C0F]" />
                </div>
                <p className="text-center text-xs font-medium text-slate-700">{booking.platform}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-slate-500">Ending Location</p>
                <p className="mt-0.5 text-base font-bold text-slate-900">{booking.destination}</p>
                <p className="font-mono text-sm font-semibold text-[#4D7C0F]">
                  Arrives {booking.arrivalTime}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-dashed border-slate-300 pt-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Passenger</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{booking.passengerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Travel Date</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
                  {booking.travelDate}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Coach Class</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{booking.coachClass}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Assigned Seat</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-[#D61F69]">
                  {booking.seatNumber}
                </p>
              </div>
            </div>

            {/* Vector Barcode Strip */}
            <div className="mt-5 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-xs font-medium text-slate-700">
                  Gate Optical Scan Ready · Total Paid:{' '}
                  <span className="font-mono font-semibold text-[#4D7C0F]">
                    ${booking.totalAmount.toFixed(2)}
                  </span>
                </p>
                <p className="text-xs text-slate-500">Catering: {booking.cateringAddon}</p>
              </div>
              <svg
                className="h-8 w-36 text-slate-900"
                viewBox="0 0 160 32"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="2" y="2" width="4" height="28" />
                <rect x="9" y="2" width="2" height="28" />
                <rect x="14" y="2" width="6" height="28" />
                <rect x="24" y="2" width="2" height="28" />
                <rect x="29" y="2" width="4" height="28" />
                <rect x="37" y="2" width="8" height="28" />
                <rect x="48" y="2" width="2" height="28" />
                <rect x="54" y="2" width="4" height="28" />
                <rect x="62" y="2" width="2" height="28" />
                <rect x="68" y="2" width="6" height="28" />
                <rect x="78" y="2" width="4" height="28" />
                <rect x="86" y="2" width="2" height="28" />
                <rect x="92" y="2" width="8" height="28" />
                <rect x="104" y="2" width="2" height="28" />
                <rect x="110" y="2" width="4" height="28" />
                <rect x="118" y="2" width="6" height="28" />
                <rect x="128" y="2" width="2" height="28" />
                <rect x="134" y="2" width="4" height="28" />
                <rect x="142" y="2" width="6" height="28" />
                <rect x="152" y="2" width="4" height="28" />
              </svg>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Receipt / Pass
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadTicketFile}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D61F69] px-4 py-2 text-xs font-semibold text-white hover:bg-[#BE185D]"
            >
              <Download className="h-3.5 w-3.5" />
              Download E-Ticket (.txt)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
