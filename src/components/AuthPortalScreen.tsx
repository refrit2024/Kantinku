import React, { useState } from 'react';
import { AdminCredentials, SellerAccount } from '../data/kantinData';
import {
  checkLoginBruteForce,
  clearLoginBruteForce,
  recordFailedLoginAttempt,
} from '../utils/securityGuard';

interface AuthPortalScreenProps {
  sellerAccounts: SellerAccount[];
  adminCredentials: AdminCredentials;
  loggedInSeller: SellerAccount | null;
  isAdminLoggedIn: boolean;
  onContinueAsStudent: () => void;
  onLoginSellerSuccess: (account: SellerAccount) => void;
  onRegisterSeller: (newAccount: Omit<SellerAccount, 'id' | 'stallId' | 'status'>) => SellerAccount;
  onUpdateSellerPassword: (accountId: string, newPassword: string) => void;
  onLoginAdminSuccess: () => void;
  onOpenSellerDashboard: () => void;
  onOpenAdminDashboard: () => void;
  onLogout: () => void;
  onShowToast: (message: string, isError?: boolean) => void;
}

export const AuthPortalScreen: React.FC<AuthPortalScreenProps> = ({
  sellerAccounts,
  adminCredentials,
  loggedInSeller,
  isAdminLoggedIn,
  onContinueAsStudent,
  onLoginSellerSuccess,
  onRegisterSeller,
  onUpdateSellerPassword,
  onLoginAdminSuccess,
  onOpenSellerDashboard,
  onOpenAdminDashboard,
  onLogout,
  onShowToast,
}) => {
  const [selectedRole, setSelectedRole] = useState<'mahasiswa' | 'penjual' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.toLowerCase();
      if (params.has('admin') || params.get('portal') === 'admin' || hash.includes('admin')) {
        return 'admin';
      }
    }
    return 'penjual';
  });
  const [adminPortalUnlocked, setAdminPortalUnlocked] = useState<boolean>(() => {
    if (isAdminLoggedIn) return true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.toLowerCase();
      if (params.has('admin') || params.get('portal') === 'admin' || hash.includes('admin')) {
        return true;
      }
    }
    return false;
  });
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [sellerAuthMode, setSellerAuthMode] = useState<'login' | 'register'>('login');

  // Listen for URL hash changes (#admin) or Secret Keyboard Shortcut (Ctrl+Shift+A / Alt+Shift+A)
  React.useEffect(() => {
    const checkHash = () => {
      if (window.location.hash.toLowerCase().includes('admin')) {
        setAdminPortalUnlocked(true);
        setSelectedRole('admin');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAdminPortalUnlocked(true);
        setSelectedRole('admin');
        onShowToast('Mode Otorisasi Admin Kampus dibuka.', false);
      }
    };
    window.addEventListener('hashchange', checkHash);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSecretAdminTap = () => {
    const next = secretTapCount + 1;
    if (next >= 5) {
      setAdminPortalUnlocked(true);
      setSelectedRole('admin');
      setSecretTapCount(0);
      onShowToast('Gerbang Rahasia Admin Sarpras diaktifkan.', false);
    } else {
      setSecretTapCount(next);
    }
  };

  // Seller Login State
  const [sellerEmail, setSellerEmail] = useState('');
  const [sellerPassword, setSellerPassword] = useState('');
  const [showSellerPassword, setShowSellerPassword] = useState(false);

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotWhatsapp, setForgotWhatsapp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'verify' | 'reset'>('verify');
  const [verifiedForgotAccount, setVerifiedForgotAccount] = useState<SellerAccount | null>(null);
  const [trackedAccountId, setTrackedAccountId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('kantinku_ibikkg_tracked_seller_id_v1');
    } catch {
      return null;
    }
  });
  const [lastKnownStatus, setLastKnownStatus] = useState<string | null>(() => {
    try {
      return localStorage.getItem('kantinku_ibikkg_tracked_seller_status_v1');
    } catch {
      return null;
    }
  });
  const [unreadDecisionModal, setUnreadDecisionModal] = useState<SellerAccount | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  );

  // Register Service Worker for background/OS notifications
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // ignore sw registration errors in restricted iframes
      });
    }
  }, []);

  const requestBrowserNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
      if (perm === 'granted') {
        onShowToast('Notifikasi Browser/Perangkat berhasil diaktifkan!', false);
      }
    } catch {
      // ignore
    }
  };

  const fireSystemNotification = (title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              body,
              tag: 'kantinku-verification-status',
              renotify: true,
            } as NotificationOptions);
          })
          .catch(() => {
            new Notification(title, { body });
          });
      } else {
        new Notification(title, { body });
      }
    } catch {
      // ignore
    }
  };

  // Derive live account object directly from synced sellerAccounts array
  const pendingAccountAlert =
    sellerAccounts.find((a) => a.id === trackedAccountId) ||
    sellerAccounts.find(
      (a) => sellerEmail.trim() && a.email.toLowerCase() === sellerEmail.trim().toLowerCase()
    ) ||
    null;

  // Watch for status transitions (both live AND when returning after closing the website for 2 hours!)
  React.useEffect(() => {
    if (!pendingAccountAlert) return;

    // Auto-fill email & password for the tracked account so the seller doesn't have to re-type
    if (!sellerEmail && pendingAccountAlert.email) {
      setSellerEmail(pendingAccountAlert.email);
      setSellerPassword(pendingAccountAlert.password);
    }

    if (lastKnownStatus && lastKnownStatus !== pendingAccountAlert.status) {
      if (pendingAccountAlert.status === 'approved') {
        const msg = `Pendaftaran "${pendingAccountAlert.stallName}" telah DISETUJUI oleh Admin Kampus IBI KKG!`;
        onShowToast(`Selamat! ${msg}`, false);
        fireSystemNotification('KantinKu IBI KKG — Akun Disetujui!', msg);
        setUnreadDecisionModal(pendingAccountAlert);
      } else if (pendingAccountAlert.status === 'rejected') {
        const msg = `Pengajuan "${pendingAccountAlert.stallName}" ditolak/perlu revisi: "${pendingAccountAlert.rejectedNote}"`;
        onShowToast(msg, true);
        fireSystemNotification('KantinKu IBI KKG — Perlu Revisi', msg);
        setUnreadDecisionModal(pendingAccountAlert);
      }
    }

    setLastKnownStatus(pendingAccountAlert.status);
    try {
      localStorage.setItem(
        'kantinku_ibikkg_tracked_seller_status_v1',
        pendingAccountAlert.status
      );
    } catch {
      // ignore
    }
  }, [pendingAccountAlert?.status, pendingAccountAlert?.rejectedNote]);

  const trackSellerAccount = (acc: SellerAccount | null) => {
    const id = acc ? acc.id : null;
    const status = acc ? acc.status : null;
    setTrackedAccountId(id);
    setLastKnownStatus(status);
    try {
      if (id && status) {
        localStorage.setItem('kantinku_ibikkg_tracked_seller_id_v1', id);
        localStorage.setItem('kantinku_ibikkg_tracked_seller_status_v1', status);
      } else {
        localStorage.removeItem('kantinku_ibikkg_tracked_seller_id_v1');
        localStorage.removeItem('kantinku_ibikkg_tracked_seller_status_v1');
      }
    } catch {
      // ignore
    }
  };

  // Seller Registration State
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regStallName, setRegStallName] = useState('');
  const [regBuilding, setRegBuilding] = useState<'Gedung A' | 'Gedung B'>('Gedung A');
  const [regLocationDetail, setRegLocationDetail] = useState('');
  const [regCategory, setRegCategory] = useState('Makanan Berat & Minuman');
  const [regHours, setRegHours] = useState('07.00–17.00');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Admin Login State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleSellerLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const bf = checkLoginBruteForce('seller');
    if (bf.locked) {
      onShowToast(
        `Proteksi Keamanan Aktif: Terlalu banyak percobaan gagal. Silakan tunggu ${bf.remainingSeconds} detik lagi.`,
        true
      );
      return;
    }

    // Hidden Admin Direct Login: If Admin types their current Admin email & password in the regular login form, route straight to Admin Portal!
    if (
      sellerEmail.trim().toLowerCase() === adminCredentials.email.trim().toLowerCase() &&
      sellerPassword === adminCredentials.password
    ) {
      clearLoginBruteForce('seller');
      clearLoginBruteForce('admin');
      setAdminPortalUnlocked(true);
      onLoginAdminSuccess();
      return;
    }

    const found = sellerAccounts.find(
      (acc) => acc.email.toLowerCase() === sellerEmail.trim().toLowerCase()
    );

    if (!found || found.password !== sellerPassword) {
      const attempt = recordFailedLoginAttempt('seller');
      if (attempt.locked) {
        onShowToast(
          `Akun dikunci sementara selama 3 menit karena 5x salah kata sandi (Proteksi Brute-Force).`,
          true
        );
      } else {
        onShowToast(
          `Email atau kata sandi penjual tidak sesuai (Sisa percobaan: ${attempt.attemptsLeft}x).`,
          true
        );
      }
      return;
    }

    clearLoginBruteForce('seller');
    trackSellerAccount(found);

    if (found.status === 'pending') {
      onShowToast(
        `Akun "${found.stallName}" masih menunggu verifikasi Admin Sarpras IBI KKG.`,
        true
      );
      return;
    }

    if (found.status === 'rejected') {
      onShowToast(
        `Pengajuan "${found.stallName}" memerlukan revisi dari Admin.`,
        true
      );
      return;
    }

    onLoginSellerSuccess(found);
  };

  const handleSellerRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regOwnerName.trim() || !regStallName.trim() || !regEmail.trim() || !regPassword.trim()) {
      return;
    }

    const exists = sellerAccounts.some(
      (acc) => acc.email.toLowerCase() === regEmail.trim().toLowerCase()
    );
    if (exists) {
      onShowToast('Email tersebut sudah terdaftar pada sistem.', true);
      return;
    }

    const created = onRegisterSeller({
      ownerName: regOwnerName.trim(),
      stallName: regStallName.trim(),
      building: regBuilding,
      locationDetail: regLocationDetail.trim() || 'Area Kantin Dekat Hall D',
      categorySummary: regCategory.trim(),
      hours: regHours.trim(),
      whatsapp: regWhatsapp.trim() || '6281200000000',
      email: regEmail.trim(),
      password: regPassword,
    });

    setSellerEmail(created.email);
    setSellerPassword(created.password);
    trackSellerAccount(created);
    setSellerAuthMode('login');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const bf = checkLoginBruteForce('admin');
    if (bf.locked) {
      onShowToast(
        `Proteksi Brute-Force Admin Aktif: Tunggu ${bf.remainingSeconds} detik sebelum mencoba login kembali.`,
        true
      );
      return;
    }

    if (
      adminEmail.trim().toLowerCase() === adminCredentials.email.trim().toLowerCase() &&
      adminPassword === adminCredentials.password
    ) {
      clearLoginBruteForce('admin');
      onLoginAdminSuccess();
    } else {
      const attempt = recordFailedLoginAttempt('admin');
      if (attempt.locked) {
        onShowToast(
          'Akses Login Admin dikunci sementara selama 3 menit karena 5x gagal.',
          true
        );
      } else {
        onShowToast(
          `Email atau kata sandi Admin tidak sesuai (Sisa percobaan: ${attempt.attemptsLeft}x).`,
          true
        );
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* LEFT COLUMN (5 cols on Desktop): Campus Transparency & Flow */}
        <div className="lg:col-span-5 flex flex-col gap-4 order-2 lg:order-1">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleSecretAdminTap}
                title="Ketuk 5x untuk membuka akses internal Admin Kampus"
                className="inline-flex items-center gap-1.5 text-emerald-800 text-xs font-bold select-none cursor-default"
              >
                <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
                <span>Portal Kampus · IBI KKG</span>
              </button>
              <span className="text-[11px] text-slate-400 font-medium">Hall D</span>
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                Transparansi Digital Kantin IBI KKG
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Platform terpadu direktori menu, stan resmi, dan monitoring harga kampus IBI Kwik Kian Gie Sunter.
              </p>
            </div>

            {/* Visual Step List - clean unboxed typography */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Mahasiswa Bebas Akses</span>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Langsung jelajah menu, cek stan buka/tutup, dan pesan tanpa kewajiban login.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">Mitra Stan Terverifikasi</span>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    Diverifikasi Biro Sarpras untuk memastikan keabsahan stan & kesesuaian harga kasir.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0 mt-0.5">
                verified
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                Harga di sistem terhubung langsung ke kasir stan untuk melindungi mahasiswa dari perbedaan tarif.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols on Desktop): Main Auth Card (Clean, Un-cluttered) */}
        <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-slate-200/80 shadow-xs flex flex-col gap-5 order-1 lg:order-2">
          {/* Role Selector Bar */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pilih Peran Akses:
            </span>
            <div
              className={`grid grid-cols-2 ${
                adminPortalUnlocked || isAdminLoggedIn ? 'sm:grid-cols-3' : ''
              } gap-1.5 bg-slate-100 p-1 rounded-xl`}
            >
              <button
                type="button"
                onClick={() => setSelectedRole('mahasiswa')}
                className={`min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedRole === 'mahasiswa'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">school</span>
                <span>Mahasiswa</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('penjual')}
                className={`min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedRole === 'penjual'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">storefront</span>
                <span>Penjual Stan</span>
              </button>

              {(adminPortalUnlocked || isAdminLoggedIn) && (
                <button
                  type="button"
                  onClick={() => setSelectedRole('admin')}
                  className={`col-span-2 sm:col-span-1 min-h-[42px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    admin_panel_settings
                  </span>
                  <span>Admin</span>
                </button>
              )}
            </div>
          </div>

          {/* ROLE 1: MAHASISWA */}
          {selectedRole === 'mahasiswa' && (
            <div className="flex flex-col gap-4 pt-1">
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Akses Langsung Tanpa Login
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mahasiswa dapat langsung menjelajah katalog menu, memeriksa stan yang sedang buka di Hall D, dan membuat pesanan saat istirahat kuliah tanpa login.
                </p>
              </div>

              <button
                type="button"
                onClick={onContinueAsStudent}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99] transition-all"
              >
                <span>Buka Katalog &amp; Peta Kantin IBI KKG</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          )}

          {/* ROLE 2: PENJUAL KANTIN */}
          {selectedRole === 'penjual' && (
            <div className="flex flex-col gap-4 pt-1">
              {/* If Seller is already logged in */}
              {loggedInSeller && (
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600">verified</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {loggedInSeller.stallName}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {loggedInSeller.ownerName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenSellerDashboard}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-700 transition-colors"
                    >
                      <span>Dashboard</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer hover:bg-rose-100"
                    >
                      Keluar
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tab: Login vs Register */}
              <div className="flex border-b border-slate-200 pb-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSellerAuthMode('login')}
                  className={`pb-2 px-1 text-xs font-bold transition-all cursor-pointer relative ${
                    sellerAuthMode === 'login'
                      ? 'text-emerald-700 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Masuk ke Akun Stan
                </button>
                <button
                  type="button"
                  onClick={() => setSellerAuthMode('register')}
                  className={`pb-2 px-1 text-xs font-bold transition-all cursor-pointer relative ${
                    sellerAuthMode === 'register'
                      ? 'text-emerald-700 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  + Daftar Stan Baru
                </button>
              </div>

              {sellerAuthMode === 'login' ? (
                /* LOGIN FORM */
                <form onSubmit={handleSellerLogin} className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Login Mitra Penjual
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kelola menu, update harga kasir, dan pantau pesanan stan Anda di Hall D.
                    </p>
                  </div>

                  {/* Live Real-Time Status Notification Banner */}
                  {pendingAccountAlert && (
                    <div
                      className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                        pendingAccountAlert.status === 'approved'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : pendingAccountAlert.status === 'pending'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <span className="material-symbols-outlined text-[18px]">
                            {pendingAccountAlert.status === 'approved'
                              ? 'check_circle'
                              : pendingAccountAlert.status === 'pending'
                              ? 'hourglass_top'
                              : 'cancel'}
                          </span>
                          <span>
                            {pendingAccountAlert.status === 'approved'
                              ? 'Akun Disetujui Admin Kampus'
                              : pendingAccountAlert.status === 'pending'
                              ? 'Menunggu Verifikasi Sarpras'
                              : 'Pendaftaran Ditolak / Perlu Revisi'}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/80 font-semibold text-slate-700">
                          Live Sync
                        </span>
                      </div>

                      {pendingAccountAlert.status === 'approved' ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs leading-relaxed">
                            Pendaftaran <strong>{pendingAccountAlert.stallName}</strong> telah disetujui. Silakan masuk untuk mengelola stan.
                          </p>
                          <button
                            type="button"
                            onClick={() => onLoginSellerSuccess(pendingAccountAlert)}
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>Buka Dashboard {pendingAccountAlert.stallName}</span>
                            <span className="material-symbols-outlined text-[16px]">
                              arrow_forward
                            </span>
                          </button>
                        </div>
                      ) : pendingAccountAlert.status === 'pending' ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs leading-relaxed">
                            Pendaftaran <strong>{pendingAccountAlert.stallName}</strong> sedang diverifikasi. Pembaruan akan tampil otomatis di sini.
                          </p>
                          {notifPerm !== 'granted' && (
                            <button
                              type="button"
                              onClick={requestBrowserNotificationPermission}
                              className="px-3 py-1.5 rounded-lg bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 cursor-pointer w-fit"
                            >
                              <span className="material-symbols-outlined text-[15px] text-emerald-600">
                                notifications_active
                              </span>
                              <span>Aktifkan Notifikasi Layar</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <p className="text-xs">
                            Pengajuan <strong>{pendingAccountAlert.stallName}</strong> ditolak oleh Admin.
                          </p>
                          <div className="p-2 rounded-lg bg-white/90 border border-rose-200 text-slate-800 text-xs">
                            <span className="font-bold text-rose-700">Catatan Admin: </span>
                            &ldquo;{pendingAccountAlert.rejectedNote}&rdquo;
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Email Akun Penjual
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Contoh: busari@ibikkg.ac.id"
                      value={sellerEmail}
                      onChange={(e) => setSellerEmail(e.target.value)}
                      className="h-11 px-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-700">
                        Kata Sandi
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(sellerEmail);
                          setForgotWhatsapp('');
                          setForgotNewPassword('');
                          setForgotConfirmPassword('');
                          setForgotStep('verify');
                          setVerifiedForgotAccount(null);
                          setForgotModalOpen(true);
                        }}
                        className="text-xs text-emerald-700 hover:underline font-semibold cursor-pointer"
                      >
                        Lupa Sandi?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showSellerPassword ? 'text' : 'password'}
                        required
                        placeholder="Masukkan kata sandi"
                        value={sellerPassword}
                        onChange={(e) => setSellerPassword(e.target.value)}
                        className="w-full h-11 pl-3.5 pr-10 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSellerPassword((p) => !p)}
                        className="absolute right-1 w-9 h-9 text-slate-400 hover:text-slate-600 cursor-pointer flex items-center justify-center"
                        title={showSellerPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showSellerPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[46px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-[0.99] transition-all"
                  >
                    Masuk ke Dashboard Penjual
                  </button>

                  {/* Clean, Compact Quick Fill Demo Chips (Zero Clutter) */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Akun Simulasi Cepat (Klik untuk Isi):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sellerAccounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setSellerEmail(acc.email);
                            setSellerPassword(acc.password);
                            trackSellerAccount(acc);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left flex items-center gap-1.5 cursor-pointer text-xs transition-colors"
                        >
                          <span className="font-semibold text-slate-800">{acc.stallName}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                              acc.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : acc.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {acc.status === 'approved'
                              ? 'Aktif'
                              : acc.status === 'rejected'
                              ? 'Ditolak'
                              : 'Pending'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              ) : (
                /* REGISTRATION FORM (Organized, Spaced, Not Crammed) */
                <form onSubmit={handleSellerRegisterSubmit} className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Pendaftaran Stan Kantin Baru
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Daftarkan stan di Hall D. Akun akan diverifikasi Biro Sarpras sebelum aktif di web.
                    </p>
                  </div>

                  {/* Section 1: Profil Stan */}
                  <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      1. Identitas Stan &amp; Lokasi
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Nama Pemilik Stan
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Pak Hendra"
                          value={regOwnerName}
                          onChange={(e) => setRegOwnerName(e.target.value)}
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Nama Stan Kantin
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Ayam Bakar Pak Hendra"
                          value={regStallName}
                          onChange={(e) => setRegStallName(e.target.value)}
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Area Gedung Kantin
                        </label>
                        <select
                          value={regBuilding}
                          onChange={(e) =>
                            setRegBuilding(e.target.value as 'Gedung A' | 'Gedung B')
                          }
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        >
                          <option value="Gedung A">Area Kantin Dekat Hall D (Deretan Utama)</option>
                          <option value="Gedung B">Area Kantin Dekat Hall D (Sudut Duduk)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Nomor / Patokan Stan
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Stan 05 dekat pintu Hall D"
                          value={regLocationDetail}
                          onChange={(e) => setRegLocationDetail(e.target.value)}
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Operasional & Kredensial Akun */}
                  <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      2. Operasional &amp; Akun Login
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Kategori Menu
                        </label>
                        <input
                          type="text"
                          required
                          value={regCategory}
                          onChange={(e) => setRegCategory(e.target.value)}
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Jam Buka
                        </label>
                        <input
                          type="text"
                          required
                          value={regHours}
                          onChange={(e) => setRegHours(e.target.value)}
                          placeholder="07.00–17.00"
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          No. WhatsApp
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="62812xxxxxxx"
                          value={regWhatsapp}
                          onChange={(e) => setRegWhatsapp(e.target.value)}
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Email Login
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="email@kantin.com"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-slate-700">
                          Kata Sandi
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Minimal 6 karakter"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="h-10 px-3 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[46px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-[0.99] transition-all mt-1"
                  >
                    Ajukan Pendaftaran Stan Penjual
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ROLE 3: ADMIN KAMPUS */}
          {selectedRole === 'admin' && (
            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4 pt-1">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Portal Admin Sarpras &amp; BAAK
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Khusus staf berwenang IBI KKG untuk verifikasi stan dan moderasi laporan harga.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Email Resmi Admin
                </label>
                <input
                  type="email"
                  required
                  placeholder="sarpras@ibikkg.ac.id"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="h-11 px-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Kata Sandi Otorisasi
                </label>
                <input
                  type="password"
                  required
                  placeholder="Masukkan kata sandi admin"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="h-11 px-3.5 rounded-xl bg-slate-50/80 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-[0.99] transition-all"
              >
                Masuk ke Portal Admin
              </button>

              {adminCredentials.email === 'sarpras@ibikkg.ac.id' &&
              adminCredentials.password === 'admin123' ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">
                      Akun Bawaan Admin:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      sarpras@ibikkg.ac.id / admin123
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminEmail(adminCredentials.email);
                      setAdminPassword(adminCredentials.password);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-emerald-700 text-xs font-bold shadow-2xs hover:bg-slate-50 cursor-pointer"
                  >
                    Isi Otomatis
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">
                    lock
                  </span>
                  <span>Kredensial Admin kustom aktif &amp; tersinkronisasi di database.</span>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {unreadDecisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-xl flex flex-col gap-4 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    unreadDecisionModal.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {unreadDecisionModal.status === 'approved'
                      ? 'verified'
                      : 'notification_important'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                    Verifikasi Biro Sarpras
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {unreadDecisionModal.status === 'approved'
                      ? 'Stan Disetujui Admin!'
                      : 'Pengajuan Ditolak / Revisi'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnreadDecisionModal(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {unreadDecisionModal.status === 'approved' ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Admin Sarpras IBI KKG telah menyetujui pendaftaran stan{' '}
                  <strong className="text-slate-900">{unreadDecisionModal.stallName}</strong> ({unreadDecisionModal.ownerName}). Anda kini dapat langsung masuk ke Dashboard Penjual untuk mengelola menu dan pesanan.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const acc = unreadDecisionModal;
                    setUnreadDecisionModal(null);
                    onLoginSellerSuccess(acc);
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Masuk ke Dashboard Penjual</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-slate-600">
                  Pengajuan stan{' '}
                  <strong className="text-slate-900">{unreadDecisionModal.stallName}</strong> belum dapat disetujui dengan catatan berikut:
                </p>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                    Alasan dari Admin:
                  </span>
                  <span className="text-xs font-medium">
                    &ldquo;{unreadDecisionModal.rejectedNote}&rdquo;
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUnreadDecisionModal(null)}
                  className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                >
                  Saya Mengerti
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL LUPA KATA SANDI PENJUAL */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-xl flex flex-col gap-4 border border-slate-200 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                </div>
                <div>
                  <span className="text-[11px] text-emerald-700 font-bold uppercase tracking-wider">
                    Pemulihan Sandi Stan
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Lupa Kata Sandi?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {forgotStep === 'verify' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const cleanEmail = forgotEmail.trim().toLowerCase();
                  const digitsInput = forgotWhatsapp.replace(/[^0-9]/g, '');
                  const last4Input = digitsInput.slice(-4);

                  const foundAcc = sellerAccounts.find(
                    (a) => a.email.toLowerCase() === cleanEmail
                  );
                  if (!foundAcc) {
                    onShowToast('Email akun penjual tidak ditemukan.', true);
                    return;
                  }

                  const accDigits = (foundAcc.whatsapp || '').replace(/[^0-9]/g, '');
                  const accLast4 = accDigits.slice(-4);

                  if (!last4Input || (digitsInput !== accDigits && last4Input !== accLast4)) {
                    onShowToast(
                      'Nomor WhatsApp atau 4 digit terakhir tidak cocok dengan data stan.',
                      true
                    );
                    return;
                  }

                  setVerifiedForgotAccount(foundAcc);
                  setForgotStep('reset');
                }}
                className="flex flex-col gap-3.5"
              >
                <p className="text-xs text-slate-600 leading-relaxed">
                  Reset kata sandi mandiri dengan memverifikasi <strong>Email</strong> dan <strong>Nomor WhatsApp</strong> stan terdaftar:
                </p>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">
                    1. Email Login Penjual
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Contoh: busari@ibikkg.ac.id"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">
                    2. Nomor WhatsApp Terdaftar (atau 4 Digit Terakhir)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 081290001980 atau 1980"
                    value={forgotWhatsapp}
                    onChange={(e) => setForgotWhatsapp(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                  />
                  <span className="text-[11px] text-slate-400">
                    Contoh: akhiran <strong>1980</strong> untuk Bu Sari, <strong>3311</strong> untuk Mas Budi.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">verified_user</span>
                  <span>Verifikasi &amp; Lanjut</span>
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!verifiedForgotAccount) return;
                  if (forgotNewPassword.trim().length < 4) {
                    onShowToast('Kata sandi baru minimal 4 karakter.', true);
                    return;
                  }
                  if (forgotNewPassword !== forgotConfirmPassword) {
                    onShowToast('Konfirmasi kata sandi baru tidak cocok.', true);
                    return;
                  }

                  onUpdateSellerPassword(verifiedForgotAccount.id, forgotNewPassword);
                  setSellerEmail(verifiedForgotAccount.email);
                  setSellerPassword(forgotNewPassword);
                  setForgotModalOpen(false);
                }}
                className="flex flex-col gap-3.5"
              >
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                    check_circle
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">
                      Terverifikasi: {verifiedForgotAccount?.stallName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {verifiedForgotAccount?.ownerName}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Kata Sandi Baru
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masukkan sandi baru"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Ulangi Kata Sandi Baru
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ketik ulang sandi baru"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotStep('verify')}
                    className="w-1/3 min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 min-h-[42px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                  >
                    Simpan Sandi Baru
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
