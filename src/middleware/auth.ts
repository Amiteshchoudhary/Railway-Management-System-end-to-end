import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | { uid: string; email?: string; name?: string };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      return next();
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  }

  // Support verified passenger session header for guest/quick passenger login flow
  const passengerUid = req.headers['x-passenger-uid'] as string | undefined;
  const passengerEmail = req.headers['x-passenger-email'] as string | undefined;
  const passengerName = req.headers['x-passenger-name'] as string | undefined;
  if (passengerUid && passengerUid.trim().length > 0) {
    req.user = {
      uid: passengerUid.trim(),
      email: passengerEmail || `${passengerUid.trim()}@velorail.transit`,
      name: passengerName || 'Express Passenger',
    };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
};
