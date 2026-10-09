import React, { useState } from 'react';
import { AdminCredentials, SellerAccount } from '../data/kantinData';

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
        onShowToast(`🎉 Selamat! ${msg}`, false);
        fireSystemNotification('KantinKu IBI KKG — Akun Disetujui!', msg);
        setUnreadDecisionModal(pendingAccountAlert);
      } else if (pendingAccountAlert.status === 'rejected') {
        const msg = `Pengajuan "${pendingAccountAlert.stallName}" ditolak/perlu revisi: "${pendingAccountAlert.rejectedNote}"`;
        onShowToast(`⚠️ ${msg}`, true);
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

    // Hidden Admin Direct Login: If Admin types their current Admin email & password in the regular login form, route straight to Admin Portal!
    if (
      sellerEmail.trim().toLowerCase() === adminCredentials.email.trim().toLowerCase() &&
      sellerPassword === adminCredentials.password
    ) {
      setAdminPortalUnlocked(true);
      onLoginAdminSuccess();
      return;
    }

    const found = sellerAccounts.find(
      (acc) => acc.email.toLowerCase() === sellerEmail.trim().toLowerCase()
    );

    if (!found || found.password !== sellerPassword) {
      onShowToast('Email atau kata sandi penjual tidak sesuai.', true);
      return;
    }

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
    if (
      adminEmail.trim().toLowerCase() === adminCredentials.email.trim().toLowerCase() &&
      adminPassword === adminCredentials.password
    ) {
      onLoginAdminSuccess();
    } else {
      onShowToast('Email atau kata sandi Admin tidak sesuai.', true);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (5 cols on Desktop): Penjelasan Alur Sistem dari Nol (Tahap 1) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3.5">
            <button
              type="button"
              onClick={handleSecretAdminTap}
              title="Ketuk 5x untuk membuka akses internal Admin Kampus"
              className="inline-flex items-center gap-1.5 bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-md w-fit font-label-sm text-label-sm select-none cursor-default"
            >
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
              <span>Gerbang Akses Sistem • Pilot Tahap 1</span>
            </button>

            <h1 className="fluid-headline-xl text-on-surface">
              Alur Akses &amp; Autentikasi KantinKu IBI KKG
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Untuk menjaga keakuratan harga dan mencegah orang sembarangan mengubah menu, sistem membagi akses publik menjadi <strong>Mahasiswa</strong> dan <strong>Mitra Penjual Kantin</strong> (terverifikasi):
            </p>

            {/* Step-by-step Visual Flow */}
            <div className="flex flex-col gap-2.5 pt-1">
              <div className="p-3 rounded-lg bg-surface-container-low border-l-4 border-secondary flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-bold">
                    1. Mahasiswa IBI KKG
                  </span>
                  <span className="font-label-sm text-[11px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded">
                    Tanpa Login
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  Langsung membuka peta kantin, mencari makanan, memfilter harga (≤Rp15.000), dan melihat kapan harga terakhir diperbarui.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-container-low border-l-4 border-primary flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-bold">
                    2. Penjual Kantin (Mitra)
                  </span>
                  <span className="font-label-sm text-[11px] bg-primary-fixed text-on-primary-fixed px-2 py-0.5 rounded">
                    Wajib Registrasi &amp; Login
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  <strong>Alur dari Nol:</strong> Daftar Akun Stan → Menunggu Verifikasi Kampus → Login Dashboard → Input Menu, Harga &amp; Jam Buka.
                </p>
              </div>
            </div>
          </div>

          {/* Komitmen Transparansi Harga & Keaslian Kantin */}
          <div className="bg-surface-container-high rounded-xl p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-primary">
              <span className="material-symbols-outlined text-[18px]">shield_lock</span>
              <span className="font-label-md text-label-md font-bold">
                Proteksi Keaslian Data Kantin IBI KKG
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-on-surface-variant leading-relaxed">
              Setiap pendaftaran akun penjual baru akan divalidasi oleh pihak kampus terlebih dahulu agar hanya pemilik stan resmi di Area Kantin Dekat Hall D IBI KKG yang dapat memperbarui daftar menu serta harga.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols on Desktop): Interactive Role & Login/Register Card */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-5 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-5">
          {/* Role Selector Tabs (Only Mahasiswa & Penjual shown to public; Admin only appears when unlocked) */}
          <div className="flex flex-col gap-2">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Pilih Peran Pengguna:
            </span>
            <div
              className={`grid grid-cols-1 ${
                adminPortalUnlocked || isAdminLoggedIn ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
              } gap-2`}
            >
              <button
                type="button"
                onClick={() => setSelectedRole('mahasiswa')}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  selectedRole === 'mahasiswa'
                    ? 'bg-primary text-on-primary border-primary font-semibold shadow-xs'
                    : 'bg-surface-container-low text-on-surface border-transparent hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">school</span>
                <span>Mahasiswa</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('penjual')}
                className={`min-h-[48px] px-3 py-2.5 rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  selectedRole === 'penjual'
                    ? 'bg-primary text-on-primary border-primary font-semibold shadow-xs'
                    : 'bg-surface-container-low text-on-surface border-transparent hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">storefront</span>
                <span>Penjual Kantin</span>
              </button>

              {(adminPortalUnlocked || isAdminLoggedIn) && (
                <button
                  type="button"
                  onClick={() => setSelectedRole('admin')}
                  className={`min-h-[48px] px-3 py-2.5 rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                    selectedRole === 'admin'
                      ? 'bg-tertiary text-on-tertiary border-tertiary font-semibold shadow-xs'
                      : 'bg-tertiary-fixed/40 text-on-tertiary-fixed border-tertiary/30 hover:bg-tertiary-fixed'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    admin_panel_settings
                  </span>
                  <span>Admin Kampus (Internal)</span>
                </button>
              )}
            </div>
          </div>

          {/* ROLE 1: MAHASISWA (Direct Access without Login barrier) */}
          {selectedRole === 'mahasiswa' && (
            <div className="flex flex-col gap-4 pt-2 border-t border-outline-variant/25">
              <div className="p-4 rounded-xl bg-surface-container-low flex flex-col gap-2">
                <div className="flex items-center gap-2 text-secondary">
                  <span className="material-symbols-outlined text-[22px]">check_circle</span>
                  <h2 className="fluid-headline-md text-on-surface">
                    Akses Langsung Mahasiswa IBI KKG
                  </h2>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Sesuai konsep Tahap 1, mahasiswa tidak perlu membuat akun atau login yang rumit hanya untuk melihat harga makanan dan lokasi kantin saat jam istirahat kuliah yang singkat.
                </p>
              </div>

              <button
                type="button"
                onClick={onContinueAsStudent}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99]"
              >
                <span>Buka Katalog &amp; Peta Kantin IBI KKG</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          )}

          {/* ROLE 2: PENJUAL KANTIN (Login or Register New Stall) */}
          {selectedRole === 'penjual' && (
            <div className="flex flex-col gap-4 pt-2 border-t border-outline-variant/25">
              {/* If Seller is already logged in (Persistent Session), let them go straight in without re-logging in */}
              {loggedInSeller && (
                <div className="p-4 rounded-xl bg-secondary-container/45 border border-secondary/40 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-secondary">
                      <span className="material-symbols-outlined text-[22px]">verified</span>
                      <div>
                        <h3 className="font-label-lg text-label-lg text-on-surface font-bold">
                          Sesi Login Aktif: {loggedInSeller.stallName}
                        </h3>
                        <span className="font-body-sm text-[12px] text-on-surface-variant">
                          {loggedInSeller.ownerName} ({loggedInSeller.email}) • Tidak perlu login ulang
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <button
                      type="button"
                      onClick={onOpenSellerDashboard}
                      className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Lanjut ke Dashboard Penjual</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg bg-surface-container-lowest text-error border border-error/30 font-label-sm text-label-sm font-semibold cursor-pointer"
                    >
                      Keluar Akun
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-toggle: Login Penjual vs Daftar Stan Baru */}
              <div className="flex bg-surface-container p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSellerAuthMode('login')}
                  className={`flex-1 min-h-[42px] rounded-lg font-label-md text-label-md transition-colors cursor-pointer ${
                    sellerAuthMode === 'login'
                      ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Login Penjual Terdaftar
                </button>
                <button
                  type="button"
                  onClick={() => setSellerAuthMode('register')}
                  className={`flex-1 min-h-[42px] rounded-lg font-label-md text-label-md transition-colors cursor-pointer ${
                    sellerAuthMode === 'register'
                      ? 'bg-surface-container-lowest text-primary font-semibold shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  + Daftar Akun Penjual Baru
                </button>
              </div>

              {sellerAuthMode === 'login' ? (
                <form onSubmit={handleSellerLogin} className="flex flex-col gap-3.5">
                  <div>
                    <h2 className="fluid-headline-md text-on-surface">
                      Masuk ke Dashboard Penjual
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Hanya penjual kantin IBI KKG yang telah diverifikasi Admin yang dapat mengelola menu dan harga.
                    </p>
                  </div>

                  {/* Live Real-Time Status Notification Box (Pending / Approved / Rejected) */}
                  {pendingAccountAlert && (
                    <div
                      className={`p-4 rounded-xl border flex flex-col gap-2.5 transition-all ${
                        pendingAccountAlert.status === 'approved'
                          ? 'bg-secondary-container/60 border-secondary text-on-secondary-container'
                          : pendingAccountAlert.status === 'pending'
                          ? 'bg-tertiary-fixed/50 border-tertiary text-on-tertiary-fixed'
                          : 'bg-error-container border-error text-on-error-container'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-label-md font-bold">
                          <span className="material-symbols-outlined text-[20px]">
                            {pendingAccountAlert.status === 'approved'
                              ? 'check_circle'
                              : pendingAccountAlert.status === 'pending'
                              ? 'hourglass_top'
                              : 'cancel'}
                          </span>
                          <span>
                            {pendingAccountAlert.status === 'approved'
                              ? 'Notifikasi: Akun Telah Disetujui Admin!'
                              : pendingAccountAlert.status === 'pending'
                              ? 'Status Live: Menunggu Verifikasi Admin...'
                              : 'Notifikasi: Pendaftaran Ditolak / Perlu Revisi'}
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-lowest/80 text-on-surface font-semibold">
                          Live Sync
                        </span>
                      </div>

                      {pendingAccountAlert.status === 'approved' ? (
                        <div className="flex flex-col gap-2">
                          <p className="font-body-sm text-[12px] text-on-surface leading-relaxed">
                            Selamat! Pendaftaran <strong>{pendingAccountAlert.stallName}</strong> ({pendingAccountAlert.ownerName}) telah <strong>DISETUJUI</strong> oleh Admin Kampus IBI KKG. Anda sekarang memiliki akses penuh ke Dashboard Penjual.
                          </p>
                          <button
                            type="button"
                            onClick={() => onLoginSellerSuccess(pendingAccountAlert)}
                            className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <span>Masuk ke Dashboard {pendingAccountAlert.stallName} Sekarang</span>
                            <span className="material-symbols-outlined text-[18px]">
                              arrow_forward
                            </span>
                          </button>
                        </div>
                      ) : pendingAccountAlert.status === 'pending' ? (
                        <div className="flex flex-col gap-2">
                          <p className="font-body-sm text-[12px] leading-relaxed">
                            Pendaftaran <strong>{pendingAccountAlert.stallName}</strong> ({pendingAccountAlert.ownerName}) sedang menunggu persetujuan Admin Sarpras. Walaupun Anda menutup website ini selama beberapa jam, begitu Anda kembali membuka web (atau di latar belakang), hasil verifikasi akan langsung muncul otomatis!
                          </p>
                          {notifPerm !== 'granted' && (
                            <button
                              type="button"
                              onClick={requestBrowserNotificationPermission}
                              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1.5 border border-outline-variant/40 cursor-pointer w-fit"
                            >
                              <span className="material-symbols-outlined text-[16px] text-primary">
                                notifications_active
                              </span>
                              <span>Aktifkan Notifikasi Layar / Browser</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <p className="font-body-sm text-[12px]">
                            Maaf, pengajuan akun <strong>{pendingAccountAlert.stallName}</strong> ditolak oleh Admin Sarpras IBI KKG.
                          </p>
                          <div className="p-2.5 rounded-lg bg-surface-container-lowest/90 text-on-surface border border-error/30 flex flex-col gap-0.5">
                            <span className="font-label-sm text-[11px] text-error font-bold uppercase tracking-wider">
                              Keterangan / Alasan Penolakan Admin:
                            </span>
                            <span className="font-body-sm text-body-sm font-medium text-on-surface">
                              &ldquo;{pendingAccountAlert.rejectedNote}&rdquo;
                            </span>
                          </div>
                          <span className="text-[11px] opacity-90">
                            Silakan daftar ulang atau perbaiki data sesuai catatan Admin di atas.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      Email Akun Penjual
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Contoh: busari@ibikkg.ac.id"
                      value={sellerEmail}
                      onChange={(e) => setSellerEmail(e.target.value)}
                      className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
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
                        className="font-label-sm text-xs text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Lupa Kata Sandi?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showSellerPassword ? 'text' : 'password'}
                        required
                        placeholder="Masukkan kata sandi"
                        value={sellerPassword}
                        onChange={(e) => setSellerPassword(e.target.value)}
                        className="w-full h-11 pl-3.5 pr-10 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSellerPassword((p) => !p)}
                        className="absolute right-2.5 text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center"
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
                    className="w-full min-h-[48px] py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold shadow-sm cursor-pointer active:scale-[0.99]"
                  >
                    Login ke Dashboard Penjual
                  </button>

                  {/* Quick Fill Demo Accounts for Testing */}
                  <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Akun Simulasi Cepat (Klik untuk isi otomatis):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sellerAccounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setSellerEmail(acc.email);
                            setSellerPassword(acc.password);
                            trackSellerAccount(acc);
                          }}
                          className="p-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-left border border-outline-variant/25 flex flex-col gap-0.5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-label-sm text-on-surface font-bold truncate">
                              {acc.stallName}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                                acc.status === 'approved'
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : acc.status === 'rejected'
                                  ? 'bg-error-container text-on-error-container'
                                  : 'bg-tertiary-fixed text-on-tertiary-fixed'
                              }`}
                            >
                              {acc.status === 'approved'
                                ? 'Terverifikasi'
                                : acc.status === 'rejected'
                                ? 'Ditolak'
                                : 'Pending'}
                            </span>
                          </div>
                          <span className="text-[11px] text-on-surface-variant truncate">
                            {acc.email}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              ) : (
                /* FORM REGISTRASI PENJUAL BARU DARI NOL */
                <form onSubmit={handleSellerRegisterSubmit} className="flex flex-col gap-3">
                  <div>
                    <h2 className="fluid-headline-md text-on-surface">
                      Registrasi Mitra Penjual Kantin Baru
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Daftarkan stan kantin Anda di lingkungan IBI KKG. Setelah disetujui Admin, Anda dapat menginput menu dan harga dari nol.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Nama Pemilik / Penanggung Jawab
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Pak Hendra"
                        value={regOwnerName}
                        onChange={(e) => setRegOwnerName(e.target.value)}
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Nama Stan Kantin
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Kantin Ayam Bakar Pak Hendra"
                        value={regStallName}
                        onChange={(e) => setRegStallName(e.target.value)}
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Area Lokasi Kantin IBI KKG
                      </label>
                      <select
                        value={regBuilding}
                        onChange={(e) =>
                          setRegBuilding(e.target.value as 'Gedung A' | 'Gedung B')
                        }
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      >
                        <option value="Gedung A">Area Kantin Dekat Hall D (Deretan Utama)</option>
                        <option value="Gedung B">Area Kantin Dekat Hall D (Sudut Tempat Duduk)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Detail Nomor Stan / Patokan
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Stan 05 dekat pintu Hall D"
                        value={regLocationDetail}
                        onChange={(e) => setRegLocationDetail(e.target.value)}
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Kategori Hidangan
                      </label>
                      <input
                        type="text"
                        required
                        value={regCategory}
                        onChange={(e) => setRegCategory(e.target.value)}
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Jam Operasional
                      </label>
                      <input
                        type="text"
                        required
                        value={regHours}
                        onChange={(e) => setRegHours(e.target.value)}
                        placeholder="07.00–17.00"
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Nomor WhatsApp
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="62812xxxxxxx"
                        value={regWhatsapp}
                        onChange={(e) => setRegWhatsapp(e.target.value)}
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-outline-variant/25">
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Email Login Penjual
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="email@kantin.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-label-sm text-label-sm text-on-surface-variant">
                        Buat Kata Sandi
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Minimal 6 karakter"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[48px] py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold shadow-sm cursor-pointer active:scale-[0.99] mt-1"
                  >
                    Ajukan Pendaftaran Akun Penjual
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ROLE 3: ADMIN KAMPUS */}
          {selectedRole === 'admin' && (
            <form
              onSubmit={handleAdminLogin}
              className="flex flex-col gap-4 pt-2 border-t border-outline-variant/25"
            >
              <div>
                <h2 className="fluid-headline-md text-on-surface">
                  Login Portal Admin Sarpras &amp; BAAK
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Khusus staf berwenang IBI Kwik Kian Gie untuk memverifikasi pendaftaran akun penjual kantin dan memoderasi laporan harga.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Email Resmi Admin Kampus
                </label>
                <input
                  type="email"
                  required
                  placeholder="sarpras@ibikkg.ac.id"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Kata Sandi Otorisasi
                </label>
                <input
                  type="password"
                  required
                  placeholder="Masukkan kata sandi admin"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold shadow-sm cursor-pointer active:scale-[0.99]"
              >
                Masuk ke Portal Admin
              </button>

              {adminCredentials.email === 'sarpras@ibikkg.ac.id' &&
              adminCredentials.password === 'admin123' ? (
                <div className="p-3.5 rounded-xl bg-surface-container-low flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-on-surface font-bold">
                      Akun Bawaan Admin IBI KKG:
                    </span>
                    <span className="text-[12px] text-on-surface-variant">
                      Email: <strong>{adminCredentials.email}</strong> | Sandi:{' '}
                      <strong>{adminCredentials.password}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminEmail(adminCredentials.email);
                      setAdminPassword(adminCredentials.password);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-surface-container-lowest text-primary font-label-sm text-label-sm font-semibold shadow-xs cursor-pointer shrink-0"
                  >
                    Isi Otomatis
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-secondary-container/40 border border-secondary/30 text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-secondary">
                    lock
                  </span>
                  <span className="font-body-sm text-[12px] text-on-surface-variant">
                    Kredensial Admin telah diperbarui secara kustom &amp; tersinkronisasi di Cloud Database.
                  </span>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* POP-UP MODAL NOTIFIKASI HASIL VERIFIKASI (Muncul otomatis walau penjual baru buka web lagi setelah beberapa jam) */}
      {unreadDecisionModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-xl flex flex-col gap-4 border border-outline-variant/30">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    unreadDecisionModal.status === 'approved'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-error-container text-on-error-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {unreadDecisionModal.status === 'approved'
                      ? 'verified'
                      : 'notification_important'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Pemberitahuan Sistem Verifikasi
                  </span>
                  <h3 className="fluid-headline-md text-on-surface">
                    {unreadDecisionModal.status === 'approved'
                      ? 'Akun Kantin Anda Disetujui!'
                      : 'Pengajuan Kantin Ditolak / Revisi'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnreadDecisionModal(null)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {unreadDecisionModal.status === 'approved' ? (
              <div className="flex flex-col gap-3">
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  Admin Sarpras IBI KKG telah menyetujui pendaftaran stan{' '}
                  <strong className="text-on-surface">{unreadDecisionModal.stallName}</strong> ({unreadDecisionModal.ownerName}). Anda kini dapat langsung masuk ke Dashboard Penjual untuk mulai menginput menu dan harga.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const acc = unreadDecisionModal;
                    setUnreadDecisionModal(null);
                    onLoginSellerSuccess(acc);
                  }}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>Masuk ke Dashboard Penjual Sekarang</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Pengajuan stan{' '}
                  <strong className="text-on-surface">{unreadDecisionModal.stallName}</strong> belum dapat disetujui oleh Admin Sarpras IBI KKG dengan alasan berikut:
                </p>
                <div className="p-3.5 rounded-xl bg-error-container/60 border border-error text-on-error-container flex flex-col gap-1">
                  <span className="font-label-sm text-[11px] font-bold uppercase tracking-wider">
                    Alasan Penolakan / Revisi dari Admin:
                  </span>
                  <span className="font-body-md text-body-md font-semibold">
                    &ldquo;{unreadDecisionModal.rejectedNote}&rdquo;
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUnreadDecisionModal(null)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md font-semibold cursor-pointer"
                >
                  Saya Mengerti
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL LUPA KATA SANDI PENJUAL (VERIFIKASI MANDIRI EMAIL + WHATSAPP ATAU BANTUAN ADMIN) */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-xl flex flex-col gap-4 border border-outline-variant/30 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">lock_reset</span>
                </div>
                <div>
                  <span className="font-label-sm text-[11px] text-primary font-bold uppercase tracking-wider">
                    Pemulihan Akses Mitra Kantin
                  </span>
                  <h3 className="fluid-headline-md text-on-surface">
                    Lupa Kata Sandi Penjual?
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
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
                    onShowToast('Email akun penjual tersebut tidak ditemukan.', true);
                    return;
                  }

                  const accDigits = (foundAcc.whatsapp || '').replace(/[^0-9]/g, '');
                  const accLast4 = accDigits.slice(-4);

                  if (!last4Input || (digitsInput !== accDigits && last4Input !== accLast4)) {
                    onShowToast(
                      'Nomor WhatsApp atau 4 digit terakhir tidak cocok dengan data pendaftaran stan.',
                      true
                    );
                    return;
                  }

                  setVerifiedForgotAccount(foundAcc);
                  setForgotStep('reset');
                }}
                className="flex flex-col gap-3.5"
              >
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Ibu/Bapak Kantin dapat langsung mereset kata sandi secara mandiri dengan memverifikasi <strong>Email Akun</strong> dan <strong>Nomor WhatsApp</strong> (atau cukup 4 angka terakhir WA) yang terdaftar:
                </p>

                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                    1. Email Login Penjual
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Contoh: busari@ibikkg.ac.id"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                    2. Nomor WhatsApp Terdaftar (atau 4 Digit Terakhir)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 081290001980 atau 1980"
                    value={forgotWhatsapp}
                    onChange={(e) => setForgotWhatsapp(e.target.value)}
                    className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-[11px] text-on-surface-variant">
                    Petunjuk: Masukkan nomor WA saat mendaftar stan (misal: akhiran <strong>1980</strong> untuk Bu Sari, <strong>3311</strong> untuk Mas Budi).
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  <span>Verifikasi &amp; Buat Kata Sandi Baru</span>
                </button>

                <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-1.5">
                  <span className="font-label-sm text-xs text-on-surface font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-secondary">
                      support_agent
                    </span>
                    Lupa Email &amp; Nomor WhatsApp Sekaligus?
                  </span>
                  <p className="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
                    Jangan khawatir! Penjual cukup menghubungi <strong>Admin Kampus (Sarpras IBI KKG)</strong>. Admin dapat meresetkan kata sandi stan secara instan melalui <em>Portal Admin → Pengaturan Akun Admin / Tabel Akun Penjual</em>.
                  </p>
                </div>
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
                <div className="p-3 rounded-xl bg-secondary-container/50 border border-secondary/30 flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-secondary text-[22px]">
                    check_circle
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-xs text-on-surface font-bold">
                      Identitas Terverifikasi: {verifiedForgotAccount?.stallName}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {verifiedForgotAccount?.ownerName} ({verifiedForgotAccount?.email})
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                    Kata Sandi Baru
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Masukkan kata sandi baru yang mudah diingat"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                    Ulangi Kata Sandi Baru
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ketik ulang kata sandi baru"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotStep('verify')}
                    className="w-1/3 min-h-[44px] rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold cursor-pointer"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 min-h-[44px] rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer shadow-sm"
                  >
                    Simpan Kata Sandi Baru
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
