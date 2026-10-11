// Security Guard: Anti-Spam Cooldown, Brute-Force Lockout, Anti-Fake Receipt Signature (HMAC),
// Price & Quantity Bounds Sanitization, NIM Validation, Image Compression, and Session Activity Guard.

export type RateLimitAction = 'place_order' | 'price_report' | 'student_review';

const COOLDOWN_MS: Record<RateLimitAction, number> = {
  place_order: 30 * 1000, // 30 detik jeda antar pesanan
  price_report: 45 * 1000, // 45 detik jeda antar laporan harga
  student_review: 30 * 1000, // 30 detik jeda antar ulasan
};

const STORAGE_PREFIX = 'kantinku_guard_cd_';
const LOGIN_LOCK_PREFIX = 'kantinku_guard_login_';
const SESSION_ACTIVITY_KEY = 'kantinku_guard_last_active_ts';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 3 * 60 * 1000; // 3 menit kunci sementara setelah 5x salah sandi
export const SESSION_IDLE_TIMEOUT_MS = 45 * 60 * 1000; // 45 menit auto-logout jika perangkat ditinggal tanpa aktivitas

export const PRICE_BOUNDS = {
  MIN_PRICE: 1000,
  MAX_PRICE: 250000,
  MIN_QTY: 1,
  MAX_QTY_PER_ITEM: 30,
};

/**
 * 1. Rate-Limiting Cooldown Guard
 */
export function checkActionCooldown(action: RateLimitAction): {
  allowed: boolean;
  remainingSeconds: number;
} {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${action}`);
    if (!raw) return { allowed: true, remainingSeconds: 0 };
    const lastTs = parseInt(raw, 10);
    if (isNaN(lastTs)) return { allowed: true, remainingSeconds: 0 };

    const elapsed = Date.now() - lastTs;
    const limit = COOLDOWN_MS[action];
    if (elapsed < limit) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil((limit - elapsed) / 1000),
      };
    }
    return { allowed: true, remainingSeconds: 0 };
  } catch {
    return { allowed: true, remainingSeconds: 0 };
  }
}

export function recordActionTimestamp(action: RateLimitAction): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${action}`, String(Date.now()));
  } catch {
    // ignore storage errors
  }
}

/**
 * 2. Brute-Force Login Protection (Penjual & Admin)
 * Locks login for 3 minutes after 5 consecutive failed password attempts.
 */
interface LoginAttemptState {
  failedCount: number;
  lockedUntil: number;
}

export function checkLoginBruteForce(scope: 'seller' | 'admin'): {
  locked: boolean;
  remainingSeconds: number;
  failedCount: number;
  attemptsLeft: number;
} {
  try {
    const raw = localStorage.getItem(`${LOGIN_LOCK_PREFIX}${scope}`);
    if (!raw) {
      return {
        locked: false,
        remainingSeconds: 0,
        failedCount: 0,
        attemptsLeft: MAX_LOGIN_ATTEMPTS,
      };
    }
    const state: LoginAttemptState = JSON.parse(raw);
    const now = Date.now();
    if (state.lockedUntil && now < state.lockedUntil) {
      return {
        locked: true,
        remainingSeconds: Math.ceil((state.lockedUntil - now) / 1000),
        failedCount: state.failedCount,
        attemptsLeft: 0,
      };
    }
    // Reset if lockout period has expired
    if (state.lockedUntil && now >= state.lockedUntil) {
      localStorage.removeItem(`${LOGIN_LOCK_PREFIX}${scope}`);
      return {
        locked: false,
        remainingSeconds: 0,
        failedCount: 0,
        attemptsLeft: MAX_LOGIN_ATTEMPTS,
      };
    }
    return {
      locked: false,
      remainingSeconds: 0,
      failedCount: state.failedCount || 0,
      attemptsLeft: Math.max(0, MAX_LOGIN_ATTEMPTS - (state.failedCount || 0)),
    };
  } catch {
    return {
      locked: false,
      remainingSeconds: 0,
      failedCount: 0,
      attemptsLeft: MAX_LOGIN_ATTEMPTS,
    };
  }
}

export function recordFailedLoginAttempt(scope: 'seller' | 'admin'): {
  locked: boolean;
  remainingSeconds: number;
  attemptsLeft: number;
} {
  try {
    const current = checkLoginBruteForce(scope);
    const nextFailed = current.failedCount + 1;
    const isNowLocked = nextFailed >= MAX_LOGIN_ATTEMPTS;
    const lockedUntil = isNowLocked ? Date.now() + LOGIN_LOCKOUT_MS : 0;

    const nextState: LoginAttemptState = {
      failedCount: nextFailed,
      lockedUntil,
    };
    localStorage.setItem(`${LOGIN_LOCK_PREFIX}${scope}`, JSON.stringify(nextState));

    return {
      locked: isNowLocked,
      remainingSeconds: isNowLocked ? Math.ceil(LOGIN_LOCKOUT_MS / 1000) : 0,
      attemptsLeft: Math.max(0, MAX_LOGIN_ATTEMPTS - nextFailed),
    };
  } catch {
    return { locked: false, remainingSeconds: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };
  }
}

export function clearLoginBruteForce(scope: 'seller' | 'admin'): void {
  try {
    localStorage.removeItem(`${LOGIN_LOCK_PREFIX}${scope}`);
  } catch {
    // ignore
  }
}

/**
 * 3. Anti-Fake Digital Receipt Signature (Deterministic HMAC-like Hash)
 * Generates an 8-character cryptographic-style verification token from order fields
 * so students cannot photoshop a screenshot or forge a fake receipt QR code.
 */
export function generateReceiptSecurityCode(order: {
  id: string;
  stallId: string;
  studentNim: string;
  totalAmount: number;
}): string {
  const secretSalt = 'IBIKKG-KANTINKU-2026-VERIFIED';
  const payload = `${order.id}|${order.stallId}|${order.studentNim.trim()}|${order.totalAmount}|${secretSalt}`;

  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;

  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  const rawHex = combined.toString(36).toUpperCase().padStart(8, '0').slice(-8);
  return `KKG-${rawHex.slice(0, 4)}-${rawHex.slice(4, 8)}`;
}

/**
 * 4. Input Sanitization & Price/Quantity Bounds Validation
 */
export function sanitizeMenuPrice(rawPrice: number | string): {
  valid: boolean;
  price: number;
  reason?: string;
} {
  const parsed = typeof rawPrice === 'number' ? rawPrice : parseInt(String(rawPrice), 10);
  if (isNaN(parsed)) {
    return {
      valid: false,
      price: 10000,
      reason: 'Harga harus berupa angka yang valid.',
    };
  }
  if (parsed < PRICE_BOUNDS.MIN_PRICE) {
    return {
      valid: false,
      price: PRICE_BOUNDS.MIN_PRICE,
      reason: `Harga minimum menu kantin adalah Rp ${PRICE_BOUNDS.MIN_PRICE.toLocaleString('id-ID')}.`,
    };
  }
  if (parsed > PRICE_BOUNDS.MAX_PRICE) {
    return {
      valid: false,
      price: PRICE_BOUNDS.MAX_PRICE,
      reason: `Harga maksimum menu kantin dibatasi Rp ${PRICE_BOUNDS.MAX_PRICE.toLocaleString('id-ID')} untuk mencegah salah ketik.`,
    };
  }
  return { valid: true, price: Math.round(parsed) };
}

export function sanitizeOrderQuantity(qty: number): number {
  if (isNaN(qty) || qty < PRICE_BOUNDS.MIN_QTY) return PRICE_BOUNDS.MIN_QTY;
  if (qty > PRICE_BOUNDS.MAX_QTY_PER_ITEM) return PRICE_BOUNDS.MAX_QTY_PER_ITEM;
  return Math.floor(qty);
}

/**
 * 5. Session Idle Activity Guard (Penjual & Admin)
 */
export function touchSessionActivity(): void {
  try {
    localStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function isSessionIdleExpired(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_ACTIVITY_KEY);
    if (!raw) {
      touchSessionActivity();
      return false;
    }
    const lastActive = parseInt(raw, 10);
    if (isNaN(lastActive)) {
      touchSessionActivity();
      return false;
    }
    return Date.now() - lastActive > SESSION_IDLE_TIMEOUT_MS;
  } catch {
    return false;
  }
}

/**
 * Validates student NIM format (7 to 12 numeric digits, e.g. 32230104)
 */
export function isValidStudentNim(nim: string): boolean {
  const cleaned = nim.trim();
  return /^\d{7,12}$/.test(cleaned);
}

/**
 * Validates student/reporter name (at least 2 characters, not pure symbols)
 */
export function isValidPersonName(name: string): boolean {
  const cleaned = name.trim();
  return cleaned.length >= 2 && /[a-zA-Z]/.test(cleaned);
}

/**
 * Compresses an uploaded image file via HTML5 Canvas to JPEG (< ~35 KB)
 * so base64 payloads never bloat the 1MB Firestore document limit.
 */
export function compressUploadedImage(
  file: File,
  maxDimension = 640,
  quality = 0.68
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Format gambar tidak didukung'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(reader.result as string);
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }
          // Fill white background for transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch {
          resolve(reader.result as string);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
