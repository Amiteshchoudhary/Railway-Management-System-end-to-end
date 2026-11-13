import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, LogIn, UserCheck, LogOut, ShieldCheck, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoyaltySummary, LOYALTY_POINTS_PER_DOLLAR } from '../utils/fareCalculator';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  loyaltySummary: LoyaltySummary;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, loyaltySummary }) => {
  const { passenger, signInWithGoogle, signInAsPassenger, signOutPassenger, loading } = useAuth();
  const [nameInput, setNameInput] = useState(passenger?.name || '');
  const [emailInput, setEmailInput] = useState(passenger?.email || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePassengerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!nameInput.trim() || !emailInput.trim() || !emailInput.includes('@')) {
      setErrorMsg('Please enter both a valid passenger full name and email address.');
      return;
    }
    try {
      await signInAsPassenger(nameInput, emailInput);
      onClose();
    } catch {
      setErrorMsg('Unable to sign in with passenger credentials. Please try again.');
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Google Sign-In popup was closed or blocked. You can also use Passenger Direct Login below.'
      );
    }
  };

  const handleQuickDemoSwitch = async () => {
    setErrorMsg(null);
    await signInAsPassenger('Aarav Sharma', 'aarav.sharma@bharatrail.in', 'demo-passenger-01');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-slate-900">
              Passenger Profile & Loyalty Account
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage your Indian Railways session, earned loyalty balance, and ticket notifications
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {passenger && (
          <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-950 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400">Active Passenger Session</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{passenger.name}</p>
                <p className="font-mono text-xs text-slate-300">{passenger.email}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await signOutPassenger();
                  setNameInput('');
                  setEmailInput('');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <LogOut className="h-3.5 w-3.5 text-[#EC4899]" />
                Sign Out
              </button>
            </div>

            {/* Loyalty Points Balance in User Profile Area */}
            <div className="border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#A3E635]">
                  <Award className="h-4 w-4 text-[#EC4899]" />
                  <span>NamoExpress Loyalty Balance · {loyaltySummary.tierName}</span>
                </div>
                <span className="font-mono text-sm font-bold text-[#A3E635] tabular-nums">
                  {loyaltySummary.totalPoints.toLocaleString()} pts
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span>
                  {loyaltySummary.completedTripsCount} Completed Trip(s) · $
                  {loyaltySummary.completedSpend.toFixed(2)} Spend ({LOYALTY_POINTS_PER_DOLLAR} pts/$1)
                </span>
                {loyaltySummary.pendingPoints > 0 && (
                  <span className="font-mono text-[#EC4899] tabular-nums">
                    +{loyaltySummary.pendingPoints.toLocaleString()} pts pending
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700" role="alert">
            {errorMsg}
          </div>
        )}

        <div className="mt-5">
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4 text-[#D61F69]" />
            Continue with Google Account
          </button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">or passenger direct login</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handlePassengerSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="auth-passenger-name" className="block text-xs font-medium text-slate-700">
              Passenger Full Name
            </label>
            <input
              id="auth-passenger-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Priya Nair"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#D61F69] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="auth-passenger-email" className="block text-xs font-medium text-slate-700">
              Passenger Email Address
            </label>
            <input
              id="auth-passenger-email"
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="e.g. priya.nair@bharatrail.in"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#D61F69] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#D61F69] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#BE185D] disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              Sign In to Reservation Desk
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={handleQuickDemoSwitch}
            className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-[#D61F69] hover:underline"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Load Demo Passenger (Aarav Sharma — Active Indian Rail Bookings)
          </button>
        </div>
      </motion.div>
    </div>
  );
};
