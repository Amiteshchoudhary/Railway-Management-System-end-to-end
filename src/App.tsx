/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Download,
  Bell,
  ArrowRight,
  ArrowLeftRight,
  LogOut,
  RotateCcw,
  Ban,
  User,
  Award,
  MapPin,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import {
  TrainScheduleItem,
  filterTrains,
  computeAdjustedTime,
  formatPrintableTicket,
  calculateLoyaltySummary,
  LOYALTY_POINTS_PER_DOLLAR,
  INDIAN_RAILWAY_STATIONS,
} from './utils/fareCalculator';
import { AuthModal } from './components/AuthModal';
import { RouteTimelineModal } from './components/RouteTimelineModal';
import { BillAndTicketModal, EnrichedBooking } from './components/BillAndTicketModal';
import { BookingView } from './components/BookingView';

type ActiveSection = 'schedule' | 'book' | 'tickets' | 'alerts' | 'exit';

interface NotificationItem {
  id: number;
  trainId: number;
  trainNumber: string;
  trainName: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  createdAt: string;
}

const POPULAR_INDIAN_CORRIDORS = [
  {
    label: 'All India Corridors',
    origin: 'All',
    destination: 'All',
    hoverClass: 'hover:bg-[#D61F69] hover:text-white hover:border-[#D61F69]',
  },
  {
    label: 'New Delhi → Mumbai',
    origin: 'New Delhi (NDLS)',
    destination: 'Mumbai Central (MMCT)',
    hoverClass: 'hover:bg-[#4D7C0F] hover:text-white hover:border-[#4D7C0F]',
  },
  {
    label: 'New Delhi → Varanasi',
    origin: 'New Delhi (NDLS)',
    destination: 'Varanasi Junction (BSB)',
    hoverClass: 'hover:bg-[#0284C7] hover:text-white hover:border-[#0284C7]',
  },
  {
    label: 'Howrah → Chennai',
    origin: 'Howrah Junction (HWH)',
    destination: 'Chennai Central (MAS)',
    hoverClass: 'hover:bg-[#7C3AED] hover:text-white hover:border-[#7C3AED]',
  },
  {
    label: 'Chennai → Bengaluru',
    origin: 'Chennai Central (MAS)',
    destination: 'KSR Bengaluru (SBC)',
    hoverClass: 'hover:bg-[#0D9488] hover:text-white hover:border-[#0D9488]',
  },
  {
    label: 'Pune → Mumbai',
    origin: 'Pune Junction (PUNE)',
    destination: 'Mumbai Central (MMCT)',
    hoverClass: 'hover:bg-[#D97706] hover:text-white hover:border-[#D97706]',
  },
];

const HEADLINE_PREFIX = 'Search Trains Across India by ';
const HEADLINE_ACCENT = 'Starting Station & Ending Location';

function RailwayReservationApp() {
  const { passenger, getAuthHeaders, signOutPassenger } = useAuth();

  const [activeSection, setActiveSection] = useState<ActiveSection>('schedule');
  const [trains, setTrains] = useState<TrainScheduleItem[]>([]);
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Filter States for Starting Station & Ending Location Search
  const [originFilter, setOriginFilter] = useState<string>('All');
  const [destinationFilter, setDestinationFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [swapRotation, setSwapRotation] = useState<number>(0);

  // Selected states for modals & booking
  const [selectedTrainForBooking, setSelectedTrainForBooking] = useState<TrainScheduleItem | null>(
    null
  );
  const [timelineTrain, setTimelineTrain] = useState<TrainScheduleItem | null>(null);
  const [billModalState, setBillModalState] = useState<{
    booking: EnrichedBooking | null;
    mode: 'bill' | 'ticket';
  }>({ booking: null, mode: 'bill' });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Alert Simulator State
  const [alertTrainId, setAlertTrainId] = useState<number>(1);
  const [alertType, setAlertType] = useState<'Delay Alert' | 'Platform Change' | 'Boarding Call'>(
    'Delay Alert'
  );
  const [alertDelayMins, setAlertDelayMins] = useState<string>('20');
  const [alertNewPlatform, setAlertNewPlatform] = useState<string>('Platform 5');
  const [dispatchingAlert, setDispatchingAlert] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const fetchAllData = useCallback(async () => {
    setErrorBanner(null);
    try {
      const [trainsRes, alertsRes] = await Promise.all([
        fetch('/api/trains'),
        fetch('/api/notifications'),
      ]);

      if (trainsRes.ok) {
        const trainsData = await trainsRes.json();
        setTrains(trainsData);
        if (trainsData.length > 0 && !selectedTrainForBooking) {
          setSelectedTrainForBooking(trainsData[0]);
          setAlertTrainId(trainsData[0].id);
        }
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setNotifications(alertsData);
      }

      if (passenger) {
        const bookingsRes = await fetch('/api/bookings', {
          headers: getAuthHeaders(),
        });
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setBookings(bookingsData);
        }
      } else {
        setBookings([]);
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Unable to synchronize live railway data.');
    } finally {
      setLoadingData(false);
    }
  }, [passenger, getAuthHeaders, selectedTrainForBooking]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Combine INDIAN_RAILWAY_STATIONS with any stations present in trains
  const allIndianStations = Array.from(
    new Set([
      ...INDIAN_RAILWAY_STATIONS,
      ...trains.map((t) => t.origin),
      ...trains.map((t) => t.destination),
    ])
  );

  const stationOptions = ['All', ...allIndianStations];

  const visibleTrains = filterTrains(trains, {
    origin: originFilter,
    destination: destinationFilter,
    status: statusFilter,
    searchQuery,
  });

  const handleSwapStations = () => {
    setSwapRotation((prev) => prev + 180);
    const prevOrigin = originFilter;
    setOriginFilter(destinationFilter);
    setDestinationFilter(prevOrigin);
  };

  const handleInstantDownloadTicket = (booking: EnrichedBooking) => {
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
    showToast(`Downloaded E-Ticket NamoExpress-Ticket-${booking.pnr}.txt`);
  };

  const handleCompleteBooking = async (bookingId: number, pnr: string, totalAmount: number) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const awarded = Math.round(totalAmount) * LOYALTY_POINTS_PER_DOLLAR;
        showToast(
          `Trip ${pnr} marked as Completed! Earned +${awarded.toLocaleString()} loyalty points.`
        );
        await fetchAllData();
      }
    } catch {
      setErrorBanner('Failed to mark trip as completed. Please try again.');
    }
  };

  const handleCancelBooking = async (bookingId: number, pnr: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast(`Reservation ${pnr} has been cancelled and seat released.`);
        await fetchAllData();
      }
    } catch {
      setErrorBanner('Failed to cancel reservation. Please try again.');
    }
  };

  const handleDispatchAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchingAlert(true);
    try {
      const res = await fetch('/api/notifications/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainId: alertTrainId,
          type: alertType,
          delayMinutes: alertType === 'Delay Alert' ? Number(alertDelayMins || 15) : undefined,
          newPlatform: alertType === 'Platform Change' ? alertNewPlatform.trim() : undefined,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        showToast(`Published ${alertType}: ${result.notification?.title}`);
        await fetchAllData();
      }
    } catch {
      setErrorBanner('Could not publish railway alert.');
    } finally {
      setDispatchingAlert(false);
    }
  };

  const activeBookingsCount = bookings.filter((b) => b.bookingStatus !== 'Cancelled').length;
  const loyaltySummary = calculateLoyaltySummary(bookings);

  return (
    <div className="relative min-h-screen text-[#0F172A]">
      {/* Full-Viewport Production Background Image Layer (/assets/aistudio/image_b456a72d.png) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(11, 15, 25, 0.72) 0%, rgba(11, 15, 25, 0.58) 42%, rgba(11, 15, 25, 0.82) 100%), url('/assets/aistudio/image_b456a72d.png')`,
        }}
      />

      {/* Strict 3-Zone Top Bar Contract with True Pink & Lime Green Accents */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-x-8 gap-y-2.5 border-b border-white/15 bg-[#0B0F19]/90 px-4 py-3 text-white backdrop-blur-md md:flex-nowrap md:px-6 md:py-4">
        {/* Zone 1: Single text element wordmark — NamoExpress */}
        <a
          href="#schedule"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('schedule');
          }}
          className="font-display text-lg font-extrabold tracking-[-0.03em] text-white transition-colors duration-200 hover:text-[#A3E635] whitespace-nowrap shrink-0"
        >
          Namo<span className="font-serif-editorial italic font-normal text-[#EC4899]">Express</span>
        </a>

        {/* Zone 2: 5 concise single-line navigation links with multi-color hover effects */}
        <nav
          aria-label="Primary Railway Navigation"
          className="order-3 flex w-full items-center gap-5 overflow-x-auto border-t border-white/10 pt-2 text-xs font-medium text-slate-300 md:order-none md:w-auto md:gap-6 md:border-0 md:pt-0 md:text-sm"
        >
          <button
            type="button"
            onClick={() => setActiveSection('schedule')}
            className={`border-b-2 py-1 transition-all duration-200 whitespace-nowrap shrink-0 ${
              activeSection === 'schedule'
                ? 'border-[#A3E635] font-semibold text-white'
                : 'border-transparent hover:border-[#A3E635] hover:text-[#A3E635]'
            }`}
          >
            Live Schedule
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('book')}
            className={`border-b-2 py-1 transition-all duration-200 whitespace-nowrap shrink-0 ${
              activeSection === 'book'
                ? 'border-[#EC4899] font-semibold text-white'
                : 'border-transparent hover:border-[#EC4899] hover:text-[#EC4899]'
            }`}
          >
            Book Ticket
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('tickets')}
            className={`border-b-2 py-1 transition-all duration-200 whitespace-nowrap shrink-0 ${
              activeSection === 'tickets'
                ? 'border-[#38BDF8] font-semibold text-white'
                : 'border-transparent hover:border-[#38BDF8] hover:text-[#38BDF8]'
            }`}
          >
            My Tickets & Bills ({activeBookingsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('alerts')}
            className={`border-b-2 py-1 transition-all duration-200 whitespace-nowrap shrink-0 ${
              activeSection === 'alerts'
                ? 'border-[#FBBF24] font-semibold text-white'
                : 'border-transparent hover:border-[#FBBF24] hover:text-[#FBBF24]'
            }`}
          >
            Platform Alerts ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('exit')}
            className={`border-b-2 py-1 transition-all duration-200 whitespace-nowrap shrink-0 ${
              activeSection === 'exit'
                ? 'border-[#C084FC] font-semibold text-white'
                : 'border-transparent hover:border-[#C084FC] hover:text-[#C084FC]'
            }`}
          >
            Exit Session
          </button>
        </nav>

        {/* Zone 3: 1 primary action (User Profile Area with Loyalty Balance) */}
        <div className="flex items-center gap-3 shrink-0">
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            aria-label={
              passenger
                ? `Passenger Profile: ${passenger.name}, ${loyaltySummary.totalPoints} loyalty points`
                : 'Passenger Login'
            }
            onClick={() => setIsAuthModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#D61F69] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all duration-200 hover:bg-[#7C3AED] whitespace-nowrap shrink-0"
          >
            <User className="h-3.5 w-3.5" />
            {passenger ? (
              <span>
                {passenger.name} ·{' '}
                <span className="font-mono text-[#A3E635] tabular-nums">
                  {loyaltySummary.totalPoints.toLocaleString()} pts
                </span>
              </span>
            ) : (
              'Passenger Login'
            )}
          </motion.button>
        </div>
      </header>

      {/* Main Content Container (1440px baseline, max-w-7xl) */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <AnimatePresence>
          {toastNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              role="status"
              className="mb-6 flex items-center justify-between rounded-lg border border-[#84CC16] bg-[#F7FEE7] px-4 py-3 text-xs font-medium text-[#365314]"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4D7C0F]" />
                <span>{toastNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastNotice(null)}
                className="text-xs font-semibold text-[#365314] hover:underline"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {errorBanner && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#D61F69]" />
              <span>{errorBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-xs font-semibold text-red-800 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeSection === 'schedule' && (
            <motion.section
              key="schedule-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              {/* Hero Split Section: Editorial Typography + Uploaded Train Photograph Backdrop */}
              <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
                <div className="flex flex-col justify-between rounded-2xl border border-white/25 bg-white/95 p-8 shadow-xl backdrop-blur-md lg:col-span-7">
                  <div>
                    <div className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.16em] text-[#D61F69] uppercase">
                      <span>NAMOEXPRESS INDIAN RAILWAYS</span>
                      <span aria-hidden="true" className="text-slate-300">
                        /
                      </span>
                      <span className="text-[#4D7C0F]">LIVE CORRIDOR DISPATCH</span>
                    </div>

                    {/* Writing Text Animation on Headline */}
                    <h1
                      aria-label="Search Trains Across India by Starting Station & Ending Location"
                      className="mt-3 font-display text-[clamp(2rem,3.3vw,3.1rem)] leading-[1.06] font-extrabold tracking-[-0.03em] text-slate-950"
                      style={{ textWrap: 'balance' }}
                    >
                      <span>
                        {Array.from(HEADLINE_PREFIX).map((char, idx) => (
                          <motion.span
                            key={`prefix-${idx}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.05,
                              delay: idx * 0.022,
                              ease: 'easeOut',
                            }}
                          >
                            {char}
                          </motion.span>
                        ))}
                      </span>
                      <span className="font-serif-editorial italic font-normal text-[#D61F69] transition-colors duration-300 hover:text-[#4D7C0F]">
                        {Array.from(HEADLINE_ACCENT).map((char, idx) => (
                          <motion.span
                            key={`accent-${idx}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: 0.05,
                              delay: (HEADLINE_PREFIX.length + idx) * 0.022,
                              ease: 'easeOut',
                            }}
                          >
                            {char}
                          </motion.span>
                        ))}
                      </span>
                      <motion.span
                        aria-hidden="true"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.65, repeat: 4, ease: 'linear' }}
                        className="ml-1 inline-block h-[0.88em] w-[3px] translate-y-0.5 rounded-full bg-gradient-to-b from-[#D61F69] to-[#84CC16] align-baseline"
                      />
                    </h1>

                    <p className="mt-3.5 max-w-[62ch] text-[15px] leading-[1.65] font-normal text-slate-600">
                      Track Vande Bharat, Rajdhani, Shatabdi, and Superfast Express departures
                      across every major Indian junction. Reserve AC coach seats, inspect itemized
                      bills, and receive live platform change advisories.
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-[#D61F69] pl-3 text-xs font-semibold tracking-tight text-slate-700">
                      <span className="text-[#4D7C0F] transition-colors hover:text-[#D61F69]">
                        25+ All-India Rail Junctions
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-[#D61F69] transition-colors hover:text-[#0284C7]">
                        Direct & Intermediate Halt Search
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="font-mono text-slate-800 transition-colors hover:text-[#7C3AED] tabular-nums">
                        10 Loyalty Pts / $1 Spend
                      </span>
                    </div>
                  </div>

                  {/* Starting Station -> Ending Location Search Engine */}
                  <div className="mt-6 border-t border-slate-200/90 pt-6">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-4">
                        <label
                          htmlFor="filter-origin"
                          className="flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] text-slate-700 uppercase"
                        >
                          <MapPin className="h-3.5 w-3.5 text-[#D61F69]" />
                          Starting Station (From)
                        </label>
                        <select
                          id="filter-origin"
                          value={originFilter}
                          onChange={(e) => setOriginFilter(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 shadow-2xs transition-colors hover:border-[#D61F69] focus:border-[#D61F69] focus:outline-none"
                        >
                          {stationOptions.map((orig) => (
                            <option key={orig} value={orig}>
                              {orig === 'All' ? 'All Indian Starting Stations' : orig}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex justify-center sm:col-span-1">
                        <motion.button
                          type="button"
                          onClick={handleSwapStations}
                          animate={{ rotate: swapRotation }}
                          transition={{ duration: 0.2 }}
                          aria-label="Swap starting station and ending location"
                          title="Swap Starting Station and Ending Location"
                          className="inline-flex h-9.5 w-9.5 items-center justify-center rounded-lg border border-slate-300 bg-white text-[#D61F69] shadow-2xs transition-all duration-200 hover:border-[#4D7C0F] hover:bg-[#F7FEE7] hover:text-[#365314]"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </motion.button>
                      </div>

                      <div className="sm:col-span-4">
                        <label
                          htmlFor="filter-destination"
                          className="flex items-center gap-1 text-[11px] font-bold tracking-[0.06em] text-slate-700 uppercase"
                        >
                          <MapPin className="h-3.5 w-3.5 text-[#4D7C0F]" />
                          Ending Location (To)
                        </label>
                        <select
                          id="filter-destination"
                          value={destinationFilter}
                          onChange={(e) => setDestinationFilter(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 shadow-2xs transition-colors hover:border-[#4D7C0F] focus:border-[#D61F69] focus:outline-none"
                        >
                          {stationOptions.map((dest) => (
                            <option key={dest} value={dest}>
                              {dest === 'All' ? 'All Indian Ending Locations' : dest}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label
                          htmlFor="filter-search"
                          className="block text-[11px] font-bold tracking-[0.06em] text-slate-700 uppercase"
                        >
                          Station / Train Search
                        </label>
                        <div className="relative mt-1.5">
                          <Search className="pointer-events-none absolute top-2.5 left-3 h-3.5 w-3.5 text-[#D61F69]" />
                          <input
                            id="filter-search"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="e.g. Kota, Surat, 12952"
                            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-8 text-xs font-medium text-slate-900 shadow-2xs transition-colors hover:border-[#0284C7] focus:border-[#D61F69] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Popular Indian Corridor Selector with Multi-Color Hover Effects */}
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[11px] font-bold tracking-[0.08em] text-slate-500 uppercase">
                        Corridors:
                      </span>
                      {POPULAR_INDIAN_CORRIDORS.map((corridor) => {
                        const isSelected =
                          originFilter === corridor.origin &&
                          destinationFilter === corridor.destination;
                        return (
                          <button
                            key={corridor.label}
                            type="button"
                            onClick={() => {
                              setOriginFilter(corridor.origin);
                              setDestinationFilter(corridor.destination);
                            }}
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-all duration-200 whitespace-nowrap shrink-0 ${
                              isSelected
                                ? 'border-[#D61F69] bg-[#D61F69] text-white shadow-2xs'
                                : `border-slate-200 bg-slate-100 text-slate-700 ${corridor.hoverClass}`
                            }`}
                          >
                            {corridor.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Uploaded Golden-Hour Train Photograph Background Showcase (No Vector Train SVG) */}
                <div
                  className="relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-white/20 bg-cover bg-center p-7 text-white shadow-xl lg:col-span-5"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(11, 15, 25, 0.76) 0%, rgba(11, 15, 25, 0.28) 45%, rgba(11, 15, 25, 0.92) 100%), url('/assets/aistudio/image_b456a72d.png')`,
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.14em] uppercase">
                      <span className="text-[#A3E635]">
                        BHARAT EXPRESS CORRIDOR TELEMETRY
                      </span>
                      <span className="font-mono text-[#EC4899] tabular-nums">
                        {trains.length} Active Indian Lines
                      </span>
                    </div>
                    <h2 className="mt-2 font-display text-2xl leading-tight font-extrabold tracking-[-0.02em] text-white">
                      Golden Quadrilateral &{' '}
                      <span className="font-serif-editorial italic font-normal text-[#A3E635]">
                        Vande Bharat Network
                      </span>
                    </h2>
                    <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-200">
                      Real-time dispatch across New Delhi, Kota Junction, Vadodara, Surat, Mumbai
                      Central, Howrah, and Chennai Central.
                    </p>
                  </div>

                  {/* Clean Typographic Station Progression Strip + Live Advisory Over Photo Scrim */}
                  <div className="mt-8 space-y-3">
                    <div className="grid grid-cols-4 gap-2 border-t border-b border-white/20 py-3 font-mono text-[11px] tracking-tight">
                      <div>
                        <span className="block text-[10px] text-[#EC4899]">ORIGIN</span>
                        <span className="font-bold text-white">NEW DELHI</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#A3E635]">HALT 01</span>
                        <span className="font-semibold text-slate-100">KOTA JN</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-[#A3E635]">HALT 02</span>
                        <span className="font-semibold text-slate-100">VADODARA</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-[#EC4899]">TERMINAL</span>
                        <span className="font-bold text-[#A3E635]">MUMBAI MMCT</span>
                      </div>
                    </div>

                    {/* Latest Platform or Delay Notice */}
                    {notifications[0] && (
                      <div className="rounded-xl border border-white/15 bg-[#0B0F19]/85 p-3.5 backdrop-blur-xs">
                        <div className="flex items-center justify-between text-[11px] tracking-wide">
                          <span className="font-bold text-[#A3E635] uppercase">
                            LIVE INDIAN RAIL ALERT · {notifications[0].type}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveSection('alerts')}
                            className="font-semibold text-[#EC4899] underline hover:text-pink-300"
                          >
                            View All ({notifications.length})
                          </button>
                        </div>
                        <p className="mt-1 text-xs font-bold text-white">
                          {notifications[0].title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-300">
                          {notifications[0].message}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Train Schedule Board */}
              <div className="overflow-hidden rounded-2xl border border-white/25 bg-white/95 shadow-xl backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.14em] text-[#D61F69] uppercase">
                      LIVE TIMETABLE & PLATFORM TELEMETRY
                    </p>
                    <h2 className="mt-0.5 font-display text-lg font-extrabold tracking-[-0.02em] text-slate-950">
                      All-India Live Departures & Corridor Timetable
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Showing {visibleTrains.length} of {trains.length} Indian Express trains
                      {originFilter !== 'All' ? ` from ${originFilter}` : ''}
                      {destinationFilter !== 'All' ? ` to ${destinationFilter}` : ''} · Click any
                      train to inspect halts or reserve seats
                    </p>
                  </div>

                  {/* Functional Segmented Status Filter Controls with Multi-Color Hover States */}
                  <div
                    className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
                    role="group"
                    aria-label="Filter trains by status"
                  >
                    {(
                      [
                        { label: 'All', hover: 'hover:bg-[#D61F69] hover:text-white' },
                        { label: 'On Time', hover: 'hover:bg-[#4D7C0F] hover:text-white' },
                        { label: 'Boarding', hover: 'hover:bg-[#0284C7] hover:text-white' },
                        { label: 'Delayed', hover: 'hover:bg-[#E11D48] hover:text-white' },
                        { label: 'Platform Changed', hover: 'hover:bg-[#D97706] hover:text-white' },
                      ] as const
                    ).map((statusOption) => (
                      <button
                        key={statusOption.label}
                        type="button"
                        onClick={() => setStatusFilter(statusOption.label)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 whitespace-nowrap shrink-0 ${
                          statusFilter === statusOption.label
                            ? 'bg-[#D61F69] text-white shadow-xs'
                            : `text-slate-600 ${statusOption.hover}`
                        }`}
                      >
                        {statusOption.label === 'All' ? 'All Trains' : statusOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingData ? (
                  <div className="space-y-3 p-6">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="h-12 w-full animate-pulse rounded-lg bg-slate-100"
                      />
                    ))}
                  </div>
                ) : visibleTrains.length === 0 ? (
                  <div className="p-10 text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      No Indian trains match your selected starting station and ending location
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Reset the station filters below to view all 12 pan-India Express and Rajdhani
                      corridors.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setOriginFilter('All');
                        setDestinationFilter('All');
                        setStatusFilter('All');
                        setSearchQuery('');
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#D61F69] px-4 py-2 text-xs font-semibold text-white hover:bg-[#BE185D]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset All Station Filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-950 text-xs font-semibold text-slate-200">
                        <tr>
                          <th className="px-6 py-3.5">Train No. & Service</th>
                          <th className="px-6 py-3.5">Starting Station → Ending Location</th>
                          <th className="px-6 py-3.5">Schedule & Real-Time ETA</th>
                          <th className="px-6 py-3.5">Platform / Status</th>
                          <th className="px-6 py-3.5 text-right">Seats</th>
                          <th className="px-6 py-3.5 text-right">Base Fare</th>
                          <th className="px-6 py-3.5 text-right">Reservation Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {visibleTrains.map((train, idx) => {
                          const adjustedEta = computeAdjustedTime(
                            train.arrivalTime,
                            train.delayMinutes
                          );
                          const isDelayed =
                            train.status === 'Delayed' || train.delayMinutes > 0;
                          const isPlatformChanged = train.status === 'Platform Changed';

                          return (
                            <motion.tr
                              key={train.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.16, delay: idx * 0.025 }}
                              className="transition-all duration-200 hover:bg-gradient-to-r hover:from-pink-50/80 hover:via-lime-50/70 hover:to-cyan-50/50"
                            >
                              <td className="px-6 py-4">
                                <div className="font-mono text-xs font-bold text-[#D61F69]">
                                  #{train.trainNumber}
                                </div>
                                <div className="font-semibold text-slate-900">{train.name}</div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-900">
                                  <span>{train.origin}</span>
                                  <span aria-hidden="true" className="font-bold text-[#D61F69]">
                                    →
                                  </span>
                                  <span>{train.destination}</span>
                                </div>
                                <div className="mt-0.5 text-xs text-slate-500">
                                  Duration {train.duration}
                                </div>
                              </td>

                              <td className="px-6 py-4 font-mono text-xs tabular-nums">
                                <div className="text-slate-900">
                                  Dep <strong>{train.departureTime}</strong> · Arr{' '}
                                  <strong
                                    className={
                                      isDelayed ? 'text-slate-400 line-through' : 'text-slate-900'
                                    }
                                  >
                                    {train.arrivalTime}
                                  </strong>
                                </div>
                                {isDelayed ? (
                                  <div className="mt-0.5 font-semibold text-[#D61F69]">
                                    Expected Arrival {adjustedEta} (+{train.delayMinutes}m)
                                  </div>
                                ) : (
                                  <div className="mt-0.5 font-medium text-[#4D7C0F]">
                                    Running on scheduled timetable
                                  </div>
                                )}
                              </td>

                              {/* Zero-Pill Metadata: Clean unboxed text with separators & semantic icon */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <span className="font-mono font-semibold text-slate-900">
                                    {train.platform}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300">
                                    ·
                                  </span>
                                  {isDelayed ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-[#D61F69]">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Delayed +{train.delayMinutes}m
                                    </span>
                                  ) : isPlatformChanged ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      Track Reassigned
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-semibold text-[#4D7C0F]">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      {train.status}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4 text-right font-mono text-xs tabular-nums">
                                <span className="font-bold text-[#4D7C0F]">
                                  {train.availableSeats}
                                </span>
                                <span className="text-slate-400">/{train.totalSeats}</span>
                              </td>

                              <td className="px-6 py-4 text-right font-mono text-sm font-bold text-slate-900 tabular-nums">
                                ${train.baseFare}.00
                              </td>

                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    aria-label={`Route Stops for ${train.trainNumber}`}
                                    onClick={() => setTimelineTrain(train)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all duration-200 hover:border-[#4D7C0F] hover:bg-[#F7FEE7] hover:text-[#365314] whitespace-nowrap shrink-0"
                                  >
                                    Route Stops
                                  </button>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.98 }}
                                    aria-label={`Reserve Seat on ${train.trainNumber}`}
                                    onClick={() => {
                                      setSelectedTrainForBooking(train);
                                      setActiveSection('book');
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#D61F69] px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-[#4D7C0F] whitespace-nowrap shrink-0"
                                  >
                                    Reserve Seat
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </motion.button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeSection === 'book' && (
            <motion.section
              key="book-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <BookingView
                trains={trains}
                selectedTrain={selectedTrainForBooking}
                onSelectTrain={(t) => setSelectedTrainForBooking(t)}
                onBookingSuccess={async () => {
                  await fetchAllData();
                  showToast(
                    'Seat reservation confirmed! Your itemized fare bill and downloadable e-ticket are ready below.'
                  );
                  setActiveSection('tickets');
                }}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
              />
            </motion.section>
          )}

          {activeSection === 'tickets' && (
            <motion.section
              key="tickets-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    My Reserved Tickets, Itemized Bills & Loyalty Rewards
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {passenger
                      ? `Showing Indian Railway reservations for ${passenger.name} (${passenger.email}) · Earn ${LOYALTY_POINTS_PER_DOLLAR} loyalty points per $1 on completed trips`
                      : 'Sign in to view or manage your railway reservations'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('book')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#D61F69] px-4 py-2 text-xs font-semibold text-white hover:bg-[#BE185D] whitespace-nowrap shrink-0"
                >
                  Book Another Train
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {passenger && (
                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-900 bg-[#0B0F19] p-6 text-white sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-slate-400">Earned Loyalty Balance</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-[#A3E635] tabular-nums">
                      {loyaltySummary.totalPoints.toLocaleString()} pts
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {LOYALTY_POINTS_PER_DOLLAR} pts per $1 of completed totalAmount
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Passenger Tier Status</p>
                    <p className="mt-1 flex items-center gap-1.5 text-base font-bold text-white">
                      <Award className="h-4 w-4 text-[#EC4899]" />
                      {loyaltySummary.tierName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {loyaltySummary.nextTierName
                        ? `${loyaltySummary.pointsToNextTier.toLocaleString()} pts to ${loyaltySummary.nextTierName}`
                        : 'Highest Express Tier Reached'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Completed Trips & Spend</p>
                    <p className="mt-1 font-mono text-base font-bold text-white tabular-nums">
                      {loyaltySummary.completedTripsCount} Trip(s) · $
                      {loyaltySummary.completedSpend.toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Verified completed Indian rail journeys
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Pending Points (Upcoming)</p>
                    <p className="mt-1 font-mono text-base font-bold text-[#EC4899] tabular-nums">
                      +{loyaltySummary.pendingPoints.toLocaleString()} pts
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Awarded when confirmed trips complete
                    </p>
                  </div>
                </div>
              )}

              {!passenger ? (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                  <p className="text-base font-semibold text-slate-900">
                    Passenger Sign-In Required
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Please sign in to access your booked tickets, itemized receipts, and boarding
                    passes.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="mt-4 rounded-lg bg-[#D61F69] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#BE185D]"
                  >
                    Sign In to View Tickets
                  </button>
                </div>
              ) : bookings.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                  <p className="text-base font-semibold text-slate-900">
                    No Reservations Found for {passenger.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Select any Indian Express train on the live schedule board to reserve a seat and
                    generate your itemized bill.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSection('schedule')}
                    className="mt-4 rounded-lg bg-[#D61F69] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#BE185D]"
                  >
                    Browse Indian Train Schedules
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking, idx) => {
                    const isCancelled = booking.bookingStatus === 'Cancelled';
                    const isCompleted = booking.bookingStatus === 'Completed';
                    const isDelayed =
                      booking.trainStatus === 'Delayed' || booking.delayMinutes > 0;
                    const adjustedArr = computeAdjustedTime(
                      booking.arrivalTime,
                      booking.delayMinutes
                    );
                    const tripPoints = Math.round(booking.totalAmount) * LOYALTY_POINTS_PER_DOLLAR;

                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16, delay: idx * 0.04 }}
                        className="rounded-xl border border-slate-200 bg-white p-6"
                      >
                        {/* Top Metadata Row (Zero-Pill Unboxed Text) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs text-slate-500">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-[#D61F69]">
                              {booking.pnr}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Travel Date: {booking.travelDate}</span>
                            <span aria-hidden="true">·</span>
                            <span>Passenger: {booking.passengerName}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-semibold ${
                                isCancelled
                                  ? 'text-red-700'
                                  : isCompleted
                                    ? 'text-[#4D7C0F]'
                                    : 'text-[#D61F69]'
                              }`}
                            >
                              {booking.bookingStatus}
                            </span>
                            {!isCancelled && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`font-mono font-semibold tabular-nums ${
                                    isCompleted ? 'text-[#4D7C0F]' : 'text-[#D61F69]'
                                  }`}
                                >
                                  {isCompleted
                                    ? `+${tripPoints.toLocaleString()} pts Earned`
                                    : `+${tripPoints.toLocaleString()} pts on Completion`}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="font-mono text-xs text-slate-700">
                            Total Billed:{' '}
                            <strong className="text-sm text-slate-900">
                              ${booking.totalAmount.toFixed(2)}
                            </strong>
                          </div>
                        </div>

                        {/* Middle Journey & Allocation Row */}
                        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-12">
                          <div className="md:col-span-4">
                            <p className="font-mono text-xs font-semibold text-slate-500">
                              #{booking.trainNumber} · {booking.trainName}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-base font-bold text-slate-900">
                              <span>{booking.origin}</span>
                              <span aria-hidden="true" className="text-[#D61F69]">
                                →
                              </span>
                              <span>{booking.destination}</span>
                            </div>
                            <p className="mt-1 font-mono text-xs text-slate-600 tabular-nums">
                              Departs {booking.departureTime} · Arrives {booking.arrivalTime}
                              {isDelayed && (
                                <span className="ml-2 font-semibold text-[#D61F69]">
                                  (Est. {adjustedArr}, +{booking.delayMinutes}m delay)
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-4 md:col-span-4">
                            <div>
                              <p className="text-xs text-slate-500">Boarding Track</p>
                              <p className="mt-0.5 font-mono text-xs font-semibold text-slate-900">
                                {booking.platform}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Coach & Seat</p>
                              <p className="mt-0.5 font-mono text-xs font-bold text-[#D61F69]">
                                {booking.seatNumber} ({booking.coachClass})
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Dining</p>
                              <p className="mt-0.5 truncate text-xs font-medium text-slate-800">
                                {booking.cateringAddon}
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons: Complete Trip, See Bill, Download Ticket, Cancel */}
                          <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-4">
                            {booking.bookingStatus === 'Confirmed' && (
                              <button
                                type="button"
                                aria-label={`Complete Trip for ${booking.pnr}`}
                                onClick={() =>
                                  handleCompleteBooking(
                                    booking.id,
                                    booking.pnr,
                                    booking.totalAmount
                                  )
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#84CC16] bg-[#F7FEE7] px-3 py-2 text-xs font-semibold text-[#365314] transition-colors hover:bg-[#ECFCCB] whitespace-nowrap shrink-0"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#4D7C0F]" />
                                Complete Trip
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`See Bill for ${booking.pnr}`}
                              onClick={() => setBillModalState({ booking, mode: 'bill' })}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-[#D61F69] hover:text-[#D61F69] whitespace-nowrap shrink-0"
                            >
                              <FileText className="h-3.5 w-3.5 text-[#D61F69]" />
                              See Bill
                            </button>
                            <button
                              type="button"
                              aria-label={`Download Ticket for ${booking.pnr}`}
                              onClick={() => {
                                handleInstantDownloadTicket(booking);
                                setBillModalState({ booking, mode: 'ticket' });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D61F69] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#BE185D] whitespace-nowrap shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download Ticket
                            </button>
                            {booking.bookingStatus === 'Confirmed' && (
                              <button
                                type="button"
                                aria-label={`Cancel ${booking.pnr}`}
                                onClick={() => handleCancelBooking(booking.id, booking.pnr)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 whitespace-nowrap shrink-0"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {activeSection === 'alerts' && (
            <motion.section
              key="alerts-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 gap-6 lg:grid-cols-12"
            >
              {/* Left 8 Cols: Live Notifications Feed */}
              <div className="space-y-4 lg:col-span-8">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h2 className="text-lg font-bold text-slate-900">
                    Real-Time Indian Railway Delay & Platform Change Notifications
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Live operational advisories broadcast across all Indian rail corridors and
                    passenger bookings
                  </p>

                  <div className="mt-5 divide-y divide-slate-200">
                    {notifications.map((item) => {
                      const isCritical = item.severity === 'critical';
                      const isWarning = item.severity === 'warning';
                      return (
                        <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                              {isCritical ? (
                                <AlertTriangle className="h-4 w-4 text-[#D61F69]" />
                              ) : isWarning ? (
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                              ) : (
                                <Bell className="h-4 w-4 text-[#4D7C0F]" />
                              )}
                              <span className="font-mono font-bold text-slate-900">
                                #{item.trainNumber}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`font-semibold ${
                                  isCritical
                                    ? 'text-[#D61F69]'
                                    : isWarning
                                      ? 'text-amber-700'
                                      : 'text-[#4D7C0F]'
                                }`}
                              >
                                {item.type}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{item.trainName}</span>
                            </div>
                          </div>
                          <h3 className="mt-1.5 text-sm font-bold text-slate-900">{item.title}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            {item.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right 4 Cols: Dispatch Live Delay / Platform Change Alert */}
              <div className="lg:col-span-4">
                <form
                  onSubmit={handleDispatchAlert}
                  className="rounded-xl border border-slate-900 bg-[#0B0F19] p-6 text-white"
                >
                  <p className="text-xs font-semibold text-[#A3E635]">
                    INDIAN RAILWAYS CONTROL DISPATCH
                  </p>
                  <h3 className="mt-1 text-base font-bold text-white">
                    Simulate Delay or Platform Change
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Broadcast a live schedule update to verify passenger notifications and
                    real-time ETA recalculation.
                  </p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label
                        htmlFor="alert-train-select"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Target Indian Express Train
                      </label>
                      <select
                        id="alert-train-select"
                        value={alertTrainId}
                        onChange={(e) => setAlertTrainId(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-[#EC4899] focus:outline-none"
                      >
                        {trains.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.trainNumber} — {t.name} ({t.platform})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="alert-type-select"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Notification Type
                      </label>
                      <select
                        id="alert-type-select"
                        value={alertType}
                        onChange={(e) =>
                          setAlertType(
                            e.target.value as 'Delay Alert' | 'Platform Change' | 'Boarding Call'
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:border-[#EC4899] focus:outline-none"
                      >
                        <option value="Delay Alert">Delay Alert</option>
                        <option value="Platform Change">Platform Change</option>
                        <option value="Boarding Call">Boarding Call</option>
                      </select>
                    </div>

                    {alertType === 'Delay Alert' && (
                      <div>
                        <label
                          htmlFor="alert-delay-input"
                          className="block text-xs font-medium text-slate-300"
                        >
                          Delay Duration (Minutes)
                        </label>
                        <input
                          id="alert-delay-input"
                          type="number"
                          min={5}
                          max={180}
                          value={alertDelayMins}
                          onChange={(e) => setAlertDelayMins(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:border-[#EC4899] focus:outline-none"
                        />
                      </div>
                    )}

                    {alertType === 'Platform Change' && (
                      <div>
                        <label
                          htmlFor="alert-platform-input"
                          className="block text-xs font-medium text-slate-300"
                        >
                          New Assigned Platform
                        </label>
                        <input
                          id="alert-platform-input"
                          type="text"
                          value={alertNewPlatform}
                          onChange={(e) => setAlertNewPlatform(e.target.value)}
                          placeholder="e.g. Platform 5"
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:border-[#EC4899] focus:outline-none"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={dispatchingAlert}
                      className="w-full rounded-lg bg-[#D61F69] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#BE185D] disabled:opacity-50"
                    >
                      {dispatchingAlert
                        ? 'Broadcasting Update...'
                        : `Broadcast ${alertType} Now`}
                    </button>
                  </div>
                </form>
              </div>
            </motion.section>
          )}

          {activeSection === 'exit' && (
            <motion.section
              key="exit-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-2xl"
            >
              <div className="rounded-xl border border-slate-200 bg-white p-8">
                <p className="text-xs font-bold text-[#D61F69]">
                  PASSENGER TERMINAL SESSION SUMMARY
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Thank You for Traveling with NamoExpress
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Your Indian Railways reservations, itemized bills, and loyalty rewards are safely
                  stored. Review your active bookings below before exiting the terminal.
                </p>

                <div className="mt-6 rounded-lg border border-slate-900 bg-[#0B0F19] p-4 text-white">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Passenger Account</span>
                    <span className="font-mono font-semibold text-white">
                      {passenger ? `${passenger.name} (${passenger.email})` : 'Guest Session'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                    <span>Earned Loyalty Balance ({loyaltySummary.tierName})</span>
                    <span className="font-mono font-bold text-[#A3E635] tabular-nums">
                      {loyaltySummary.totalPoints.toLocaleString()} pts ({loyaltySummary.completedTripsCount}{' '}
                      completed)
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                    <span>Active & Completed Reservations</span>
                    <span className="font-mono font-bold text-[#EC4899]">
                      {activeBookingsCount} Ticket(s)
                    </span>
                  </div>
                </div>

                {activeBookingsCount > 0 && (
                  <div className="mt-4 space-y-2">
                    {bookings
                      .filter((b) => b.bookingStatus !== 'Cancelled')
                      .map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-[#D61F69]">{b.pnr}</span> ·{' '}
                            <span className="font-semibold text-slate-900">
                              #{b.trainNumber} ({b.origin} → {b.destination})
                            </span>{' '}
                            · <span className="text-[#4D7C0F]">{b.bookingStatus}</span>
                          </div>
                          <div className="font-mono text-slate-700">
                            {b.travelDate} · Seat <strong>{b.seatNumber}</strong> · $
                            {b.totalAmount.toFixed(2)}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={() => setActiveSection('schedule')}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:border-[#4D7C0F] hover:bg-[#F7FEE7] hover:text-[#365314]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Return to Live Schedule Board
                  </button>

                  {passenger && (
                    <button
                      type="button"
                      onClick={async () => {
                        await signOutPassenger();
                        showToast('Passenger session closed safely.');
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#D61F69] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4D7C0F]"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out & Clear Terminal Session
                    </button>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Clean Editorial Footer */}
      <footer className="mt-16 border-t border-white/15 bg-[#0B0F19]/90 py-6 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[#A3E635]">
              Namo<span className="font-serif-editorial italic font-normal text-[#EC4899]">Express</span>
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>All-India Passenger Railway Reservation & Real-Time Schedule System</span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <button
              type="button"
              onClick={() => setActiveSection('schedule')}
              className="transition-colors hover:text-[#A3E635]"
            >
              Indian Timetables
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('tickets')}
              className="transition-colors hover:text-[#EC4899]"
            >
              Tickets & Loyalty
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('alerts')}
              className="transition-colors hover:text-[#38BDF8]"
            >
              Corridor Advisories
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        loyaltySummary={loyaltySummary}
      />

      <RouteTimelineModal
        train={timelineTrain}
        onClose={() => setTimelineTrain(null)}
        onSelectForBooking={(t) => {
          setSelectedTrainForBooking(t);
          setActiveSection('book');
        }}
      />

      <BillAndTicketModal
        booking={billModalState.booking}
        initialMode={billModalState.mode}
        onClose={() => setBillModalState({ booking: null, mode: 'bill' })}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RailwayReservationApp />
    </AuthProvider>
  );
}
