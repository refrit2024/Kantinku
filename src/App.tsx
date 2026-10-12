import React, { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  AdminCredentials,
  INITIAL_ADMIN_CREDENTIALS,
  INITIAL_PRICE_REPORTS,
  INITIAL_SELLER_ACCOUNTS,
  INITIAL_STALLS,
  INITIAL_VERIFICATIONS,
  MenuItem,
  normalizeStallLocation,
  OrderStatusType,
  OrderTransaction,
  PriceDiscrepancyReport,
  RECEIPT_PROOF_IMAGE,
  ReviewItem,
  SellerAccount,
  Stall,
  VerificationRequest,
} from './data/kantinData';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AuthPortalScreen } from './components/AuthPortalScreen';
import { KatalogScreen, StudentSubTab } from './components/KatalogScreen';
import { DetailStanScreen } from './components/DetailStanScreen';
import { KelolaMenuScreen } from './components/KelolaMenuScreen';
import { AdminPortalScreen } from './components/AdminPortalScreen';
import {
  checkActionCooldown,
  compressUploadedImage,
  isSessionIdleExpired,
  isValidPersonName,
  isValidStudentNim,
  recordActionTimestamp,
  sanitizeMenuPrice,
  sanitizeOrderQuantity,
  touchSessionActivity,
} from './utils/securityGuard';

export type ScreenType =
  | 'auth-portal'
  | 'katalog'
  | 'detail-stan'
  | 'kelola-menu'
  | 'admin-portal';

const STORAGE_KEYS = {
  SELLER_SESSION: 'kantinku_ibikkg_seller_session_v1',
  ADMIN_SESSION: 'kantinku_ibikkg_admin_session_v1',
  ADMIN_CREDENTIALS: 'kantinku_ibikkg_admin_credentials_v1',
  SELLER_ACCOUNTS: 'kantinku_ibikkg_seller_accounts_v1',
  STALLS: 'kantinku_ibikkg_stalls_v1',
  VERIFICATIONS: 'kantinku_ibikkg_verifications_v1',
  ORDERS: 'kantinku_ibikkg_orders_v1',
  PRICE_REPORTS: 'kantinku_ibikkg_price_reports_v1',
};

const FIRESTORE_STATE_PATH = 'kantinku_state/pilot_v1';

export default function App() {
  // Load persistent accounts & data from localStorage as instant initial fallback before Cloud Sync arrives
  const [sellerAccounts, setSellerAccounts] = useState<SellerAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SELLER_ACCOUNTS);
      const parsed: SellerAccount[] = saved ? JSON.parse(saved) : INITIAL_SELLER_ACCOUNTS;
      return parsed.map((acc, idx) => normalizeStallLocation(acc, idx));
    } catch {
      return INITIAL_SELLER_ACCOUNTS;
    }
  });

  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_CREDENTIALS);
      return saved ? JSON.parse(saved) : INITIAL_ADMIN_CREDENTIALS;
    } catch {
      return INITIAL_ADMIN_CREDENTIALS;
    }
  });

  const [loggedInSeller, setLoggedInSeller] = useState<SellerAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SELLER_SESSION);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true';
    } catch {
      return false;
    }
  });

  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Default to 'katalog' (Katalog Kantin) immediately for visitors/students,
  // or auto-open DetailStanScreen if scanned from a Stall QR Code (?stan=...),
  // or auto-open Dashboard Penjual / Admin Portal if an active session exists.
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash.toLowerCase();
        if (params.has('admin') || params.get('portal') === 'admin' || hash.includes('admin')) {
          return 'auth-portal';
        }
        if (params.get('stan') || params.get('stall') || hash.startsWith('#stan-')) {
          return 'detail-stan';
        }
      }
      const savedSeller = localStorage.getItem(STORAGE_KEYS.SELLER_SESSION);
      if (savedSeller) return 'kelola-menu';
      const savedAdmin = localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION);
      if (savedAdmin === 'true') return 'admin-portal';
    } catch {
      // ignore storage errors
    }
    return 'katalog';
  });

  const [studentSubTab, setStudentSubTab] = useState<StudentSubTab>('kantin');
  const [historyStack, setHistoryStack] = useState<ScreenType[]>([]);
  const [selectedStallId, setSelectedStallId] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qrStall = params.get('stan') || params.get('stall');
        if (qrStall) return qrStall;
        const hash = window.location.hash;
        if (hash.startsWith('#stan-')) return hash.slice(1);
      }
    } catch {
      // ignore
    }
    return 'stan-bu-sari';
  });
  const [favoriteStallIds, setFavoriteStallIds] = useState<string[]>(['stan-bu-sari']);
  const [footerSecretTap, setFooterSecretTap] = useState(0);

  // Global URL routing for QR Code Scan (?stan=...) and secret Admin entry (?admin / #admin / Ctrl+Shift+A)
  useEffect(() => {
    const checkUrlRouting = () => {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      const hashLower = hash.toLowerCase();
      if (params.has('admin') || params.get('portal') === 'admin' || hashLower.includes('admin')) {
        setCurrentScreen('auth-portal');
        return;
      }
      const qrStall = params.get('stan') || params.get('stall');
      if (qrStall) {
        setSelectedStallId(qrStall);
        setCurrentScreen('detail-stan');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (hashLower.startsWith('#stan-')) {
        setSelectedStallId(hash.slice(1));
        setCurrentScreen('detail-stan');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    const handleGlobalAdminKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        window.location.hash = 'admin';
        setCurrentScreen('auth-portal');
      }
    };
    checkUrlRouting();
    window.addEventListener('hashchange', checkUrlRouting);
    window.addEventListener('popstate', checkUrlRouting);
    window.addEventListener('keydown', handleGlobalAdminKey);
    return () => {
      window.removeEventListener('hashchange', checkUrlRouting);
      window.removeEventListener('popstate', checkUrlRouting);
      window.removeEventListener('keydown', handleGlobalAdminKey);
    };
  }, []);

  const [stalls, setStalls] = useState<Stall[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STALLS);
      const parsed: Stall[] = saved ? JSON.parse(saved) : INITIAL_STALLS;
      return parsed.map((s, idx) => normalizeStallLocation(s, idx));
    } catch {
      return INITIAL_STALLS;
    }
  });

  const [verifications, setVerifications] = useState<VerificationRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VERIFICATIONS);
      return saved ? JSON.parse(saved) : INITIAL_VERIFICATIONS;
    } catch {
      return INITIAL_VERIFICATIONS;
    }
  });

  const [orders, setOrders] = useState<OrderTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [priceReports, setPriceReports] = useState<PriceDiscrepancyReport[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRICE_REPORTS);
      return saved ? JSON.parse(saved) : INITIAL_PRICE_REPORTS;
    } catch {
      return INITIAL_PRICE_REPORTS;
    }
  });

  // Refs to always access latest state inside synchronous handlers
  const stallsRef = useRef(stalls);
  stallsRef.current = stalls;
  const verificationsRef = useRef(verifications);
  verificationsRef.current = verifications;
  const sellerAccountsRef = useRef(sellerAccounts);
  sellerAccountsRef.current = sellerAccounts;
  const adminCredentialsRef = useRef(adminCredentials);
  adminCredentialsRef.current = adminCredentials;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const priceReportsRef = useRef(priceReports);
  priceReportsRef.current = priceReports;

  // Helper to push shared state to Firebase Firestore Cloud Database
  const syncStateToCloud = async (
    nextStalls: Stall[],
    nextVerifications: VerificationRequest[],
    nextSellerAccounts: SellerAccount[],
    nextAdminCreds: AdminCredentials = adminCredentialsRef.current,
    nextOrders: OrderTransaction[] = ordersRef.current,
    nextPriceReports: PriceDiscrepancyReport[] = priceReportsRef.current
  ) => {
    const stallsJson = JSON.stringify(nextStalls).slice(0, 449000);
    const verificationsJson = JSON.stringify(nextVerifications).slice(0, 199000);
    const sellerAccountsJson = JSON.stringify(nextSellerAccounts).slice(0, 199000);
    const adminCredentialsJson = JSON.stringify(nextAdminCreds).slice(0, 4900);
    const ordersJson = JSON.stringify(nextOrders).slice(0, 249000);
    const priceReportsJson = JSON.stringify(nextPriceReports).slice(0, 199000);
    const updatedAtIso = new Date().toISOString();

    try {
      await setDoc(doc(db, 'kantinku_state', 'pilot_v1'), {
        stallsJson,
        verificationsJson,
        sellerAccountsJson,
        adminCredentialsJson,
        ordersJson,
        priceReportsJson,
        updatedAtIso,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, FIRESTORE_STATE_PATH);
    }
  };

  // Real-time Firebase Firestore listener (onSnapshot) across all laptops & phones
  useEffect(() => {
    const docRef = doc(db, 'kantinku_state', 'pilot_v1');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          try {
            if (typeof data.stallsJson === 'string') {
              const parsedStalls = JSON.parse(data.stallsJson);
              if (Array.isArray(parsedStalls) && parsedStalls.length > 0) {
                setStalls(
                  parsedStalls.map((s: Stall, idx: number) => ({
                    ...normalizeStallLocation(s, idx),
                    menuItems: Array.isArray(s.menuItems) ? s.menuItems : [],
                    reviews: Array.isArray(s.reviews) ? s.reviews : [],
                    paymentMethods: Array.isArray(s.paymentMethods)
                      ? s.paymentMethods
                      : ['QRIS tersedia (Semua Bank & E-Wallet)', 'Tunai di Kasir'],
                  }))
                );
              }
            }
            if (typeof data.verificationsJson === 'string') {
              const parsedVerifs = JSON.parse(data.verificationsJson);
              if (Array.isArray(parsedVerifs)) {
                setVerifications(
                  parsedVerifs.map((v: VerificationRequest) => ({
                    ...v,
                    location: /Gedung [AB]|Stan [AB]-/i.test(v.location || '')
                      ? 'Area Kantin Dekat Hall D'
                      : v.location,
                  }))
                );
              }
            }
            if (typeof data.sellerAccountsJson === 'string') {
              const parsedAccounts: SellerAccount[] = JSON.parse(data.sellerAccountsJson);
              if (Array.isArray(parsedAccounts)) {
                const cleanedAccounts = parsedAccounts.map((acc, idx) =>
                  normalizeStallLocation(acc, idx)
                );
                setSellerAccounts(cleanedAccounts);
                // Keep loggedInSeller status in sync if Admin approves/rejects from another laptop
                setLoggedInSeller((prev) => {
                  if (!prev) return null;
                  const updatedSelf = cleanedAccounts.find((a) => a.id === prev.id);
                  return updatedSelf || prev;
                });
              }
            }
            if (typeof data.adminCredentialsJson === 'string') {
              const parsedAdmin: AdminCredentials = JSON.parse(data.adminCredentialsJson);
              if (parsedAdmin && parsedAdmin.email && parsedAdmin.password) {
                setAdminCredentials(parsedAdmin);
              }
            }
            if (typeof data.ordersJson === 'string') {
              const parsedOrders: OrderTransaction[] = JSON.parse(data.ordersJson);
              if (Array.isArray(parsedOrders)) {
                setOrders(parsedOrders);
              }
            }
            if (typeof data.priceReportsJson === 'string') {
              const parsedReports: PriceDiscrepancyReport[] = JSON.parse(data.priceReportsJson);
              if (Array.isArray(parsedReports)) {
                setPriceReports(parsedReports);
              }
            }
          } catch (e) {
            console.error('Failed to parse synced Firestore state:', e);
          }
        } else {
          // Seed initial Pilot Project state to Cloud Database on first run
          syncStateToCloud(
            stallsRef.current,
            verificationsRef.current,
            sellerAccountsRef.current,
            adminCredentialsRef.current,
            ordersRef.current,
            priceReportsRef.current
          );
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, FIRESTORE_STATE_PATH);
      }
    );

    return () => unsubscribe();
  }, []);

  // Persist local device session & cache to localStorage
  useEffect(() => {
    try {
      if (loggedInSeller) {
        localStorage.setItem(STORAGE_KEYS.SELLER_SESSION, JSON.stringify(loggedInSeller));
      } else {
        localStorage.removeItem(STORAGE_KEYS.SELLER_SESSION);
      }
    } catch {
      // ignore storage errors
    }
  }, [loggedInSeller]);

  useEffect(() => {
    try {
      if (isAdminLoggedIn) {
        localStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
      }
    } catch {
      // ignore storage errors
    }
  }, [isAdminLoggedIn]);

  // Session Idle Timeout Guard (45 minutes inactivity auto-logout for Seller & Admin)
  useEffect(() => {
    if (!loggedInSeller && !isAdminLoggedIn) return;

    touchSessionActivity();
    const onUserActivity = () => {
      touchSessionActivity();
    };

    window.addEventListener('pointerdown', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });

    const interval = window.setInterval(() => {
      if (isSessionIdleExpired()) {
        setLoggedInSeller(null);
        setIsAdminLoggedIn(false);
        setCurrentScreen('auth-portal');
        showToast(
          'Sesi Anda otomatis dikeluarkan demi keamanan karena tidak ada aktivitas selama 45 menit.',
          false
        );
      }
    }, 30000);

    return () => {
      window.removeEventListener('pointerdown', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      window.clearInterval(interval);
    };
  }, [loggedInSeller, isAdminLoggedIn]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SELLER_ACCOUNTS, JSON.stringify(sellerAccounts));
    } catch {
      // ignore
    }
  }, [sellerAccounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STALLS, JSON.stringify(stalls));
    } catch {
      // ignore
    }
  }, [stalls]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VERIFICATIONS, JSON.stringify(verifications));
    } catch {
      // ignore
    }
  }, [verifications]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ADMIN_CREDENTIALS, JSON.stringify(adminCredentials));
    } catch {
      // ignore
    }
  }, [adminCredentials]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    } catch {
      // ignore
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRICE_REPORTS, JSON.stringify(priceReports));
    } catch {
      // ignore
    }
  }, [priceReports]);

  const handlePlaceOrder = (
    orderData: Omit<OrderTransaction, 'id' | 'status' | 'createdAt'>
  ): OrderTransaction => {
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const isAutoPaidGateway = orderData.paymentStatus === 'paid_gateway';
    const sanitizedItems = (orderData.items || []).map((it) => ({
      ...it,
      price: sanitizeMenuPrice(it.price).price,
      quantity: sanitizeOrderQuantity(it.quantity),
    }));
    const safeSubtotal = sanitizedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const safeFee = Math.max(0, Math.min(5000, orderData.serviceFee || 0));
    const safeTotal = safeSubtotal + safeFee;

    const newOrder: OrderTransaction = {
      ...orderData,
      items: sanitizedItems,
      subtotalAmount: safeSubtotal,
      serviceFee: safeFee,
      totalAmount: safeTotal,
      id: `ORD-${Date.now().toString().slice(-6)}`,
      status: isAutoPaidGateway ? 'cooking' : 'waiting_payment_verification',
      createdAt: `Hari ini, ${nowTime} WIB`,
    };
    // Auto-prune to max 80 recent orders so Firestore 1MB document limit is never exceeded
    const nextOrders = [newOrder, ...ordersRef.current].slice(0, 80);
    setOrders(nextOrders);
    ordersRef.current = nextOrders;
    recordActionTimestamp('place_order');
    syncStateToCloud(
      stallsRef.current,
      verificationsRef.current,
      sellerAccountsRef.current,
      adminCredentialsRef.current,
      nextOrders
    );
    showToast(
      isAutoPaidGateway
        ? `Pembayaran Lunas Otomatis! Pesanan ${newOrder.id} langsung diproses oleh ${newOrder.stallName}.`
        : `Pesanan ${newOrder.id} (Rp ${newOrder.totalAmount.toLocaleString('id-ID')}) berhasil dikirim ke ${newOrder.stallName}!`
    );
    return newOrder;
  };

  const handleUpdateOrderStatus = (orderId: string, nextStatus: OrderStatusType) => {
    const nextOrders = ordersRef.current.map((ord) =>
      ord.id === orderId ? { ...ord, status: nextStatus } : ord
    );
    setOrders(nextOrders);
    ordersRef.current = nextOrders;
    syncStateToCloud(
      stallsRef.current,
      verificationsRef.current,
      sellerAccountsRef.current,
      adminCredentialsRef.current,
      nextOrders
    );

    const target = nextOrders.find((o) => o.id === orderId);
    if (target) {
      if (nextStatus === 'cooking') {
        showToast(
          `Pembayaran ${target.studentName} diterima! Pesanan ditandai Sedang Disiapkan / Dibungkus.`
        );
      } else if (nextStatus === 'ready_pickup') {
        showToast(
          `Notifikasi dikirim ke ${target.studentName}: Pesanan sudah SIAP DIAMBIL di stan!`
        );
      } else if (nextStatus === 'completed') {
        showToast(`Transaksi pesanan ${target.studentName} selesai!`);
      } else if (nextStatus === 'rejected') {
        showToast(`Pesanan ${target.studentName} ditolak karena pembayaran belum masuk.`, true);
      }
    }
  };

  const handleUpdateAdminCredentials = (newEmail: string, newPassword: string) => {
    const updated: AdminCredentials = {
      email: newEmail.trim(),
      password: newPassword,
      updatedAt: new Date().toISOString(),
    };
    setAdminCredentials(updated);
    adminCredentialsRef.current = updated;
    syncStateToCloud(
      stallsRef.current,
      verificationsRef.current,
      sellerAccountsRef.current,
      updated
    );
    showToast(
      `Email & Kata Sandi Admin berhasil diperbarui (${updated.email}) dan disinkronkan ke Cloud!`
    );
  };

  const handleUpdateSellerPassword = (accountId: string, newPassword: string) => {
    const nextAccounts = sellerAccountsRef.current.map((acc) =>
      acc.id === accountId ? { ...acc, password: newPassword } : acc
    );
    setSellerAccounts(nextAccounts);
    sellerAccountsRef.current = nextAccounts;
    setLoggedInSeller((prev) =>
      prev && prev.id === accountId ? { ...prev, password: newPassword } : prev
    );
    syncStateToCloud(
      stallsRef.current,
      verificationsRef.current,
      nextAccounts,
      adminCredentialsRef.current,
      ordersRef.current
    );
    const targetAcc = nextAccounts.find((a) => a.id === accountId);
    showToast(
      `Kata sandi untuk "${targetAcc?.stallName || 'Penjual'}" berhasil diperbarui & disinkronkan ke Cloud!`
    );
  };

  // Toast State
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    isError: boolean;
  }>({
    visible: false,
    message: '',
    isError: false,
  });

  // Modals & Drawers
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<{
    title: string;
    content: React.ReactNode;
  } | null>(null);

  const [reportStallId, setReportStallId] = useState('stan-berkah-barokah');
  const [reportMenuName, setReportMenuName] = useState('');
  const [reportCatalogPrice, setReportCatalogPrice] = useState('5000');
  const [reportChargedPrice, setReportChargedPrice] = useState('6000');
  const [reportNim, setReportNim] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [reportProofImage, setReportProofImage] = useState<string>('');

  const showToast = (message: string, isError = false) => {
    setToast({ visible: true, message, isError });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3500);
  };

  const navigateTo = (screen: ScreenType, stallId?: string) => {
    if (stallId) {
      setSelectedStallId(stallId);
    }

    // Route Guard: Penjual Kantin must login with a verified seller account first
    if (screen === 'kelola-menu' && !loggedInSeller) {
      showToast(
        'Silakan login atau registrasi akun Penjual Kantin terlebih dahulu.',
        false
      );
      setCurrentScreen('auth-portal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Route Guard: Admin Portal requires Admin login first
    if (screen === 'admin-portal' && !isAdminLoggedIn) {
      showToast('Silakan login menggunakan akun Admin Kampus terlebih dahulu.', false);
      setCurrentScreen('auth-portal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (screen !== currentScreen) {
      setHistoryStack((prev) => [...prev, currentScreen]);
      setCurrentScreen(screen);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Auth Portal Handlers
  const handleContinueAsStudent = () => {
    setCurrentScreen('katalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Selamat datang di Katalog & Peta Kantin IBI KKG!');
  };

  const handleLoginSellerSuccess = (account: SellerAccount) => {
    setLoggedInSeller(account);
    setCurrentScreen('kelola-menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Selamat datang kembali, ${account.stallName}!`);
  };

  const handleRegisterSeller = (
    newAccData: Omit<SellerAccount, 'id' | 'stallId' | 'status'>
  ): SellerAccount => {
    const timestamp = Date.now();
    const newAccountId = `seller-${timestamp}`;
    const newStallId = `stan-${timestamp}`;

    const createdAccount: SellerAccount = {
      ...newAccData,
      id: newAccountId,
      stallId: newStallId,
      status: 'pending',
    };

    const newVerificationCard: VerificationRequest = {
      id: `verif-${timestamp}`,
      sellerAccountId: newAccountId,
      badgeText: 'Pendaftaran Akun Baru',
      badgeType: 'new',
      name: createdAccount.stallName,
      location: `Area Kantin Dekat Hall D • ${createdAccount.locationDetail}`,
      image:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDKRZAZhZgUABT21KQQyMihdBy_RG7SjtzahxVvkVUe57WKeshzusCRnnMBqyja36FxAU23sdLyzKXXHBJwc01syJgxv607G4cinlHC5PC9n2UAHfyLtGJOuvlzsDABN1uM888XvesFCvGVqarTpbyGY68Hq8DfrjmXLvtp9SPAr4Pb0aCeYqswDWNqpSFOTQqD8_51cg-6NfYw6CZ0YQQLzfYFIeJlKcgTj3jH3QXt',
      alt: createdAccount.stallName,
      approved: false,
      details: [
        { label: 'Penanggung Jawab:', value: createdAccount.ownerName },
        { label: 'Email Login:', value: createdAccount.email },
        {
          label: 'Kontak WhatsApp:',
          value: createdAccount.whatsapp,
          isWhatsapp: true,
          whatsappUrl: `https://wa.me/${createdAccount.whatsapp}`,
        },
        { label: 'Kategori Menu:', value: createdAccount.categorySummary },
        { label: 'Jam Operasional:', value: `Senin–Jumat (${createdAccount.hours})` },
      ],
      secondaryActionText: 'Tolak / Revisi',
      secondaryActionType: 'revisi',
      primaryActionText: 'Setujui & Terbitkan',
    };

    const nextAccounts = [...sellerAccountsRef.current, createdAccount];
    const nextVerifications = [newVerificationCard, ...verificationsRef.current];

    setSellerAccounts(nextAccounts);
    setVerifications(nextVerifications);
    syncStateToCloud(stallsRef.current, nextVerifications, nextAccounts);

    showToast(
      `Pendaftaran "${createdAccount.stallName}" berhasil dikirim! Menunggu verifikasi Admin Kampus.`
    );
    return createdAccount;
  };

  const handleLoginAdminSuccess = () => {
    setIsAdminLoggedIn(true);
    setCurrentScreen('admin-portal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Login Otorisasi Admin Sarpras & BAAK berhasil!');
  };

  const handleLogoutSession = () => {
    setLoggedInSeller(null);
    setIsAdminLoggedIn(false);
    setCurrentScreen('auth-portal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Anda telah keluar dari sesi. Kembali ke halaman Login.');
  };

  const toggleFavoriteStall = (stallId: string) => {
    setFavoriteStallIds((prev) => {
      const exists = prev.includes(stallId);
      const stallObj = stalls.find((s) => s.id === stallId);
      showToast(
        exists
          ? `${stallObj?.name || 'Kantin'} dihapus dari daftar Favorit`
          : `${stallObj?.name || 'Kantin'} disimpan ke Favorit mahasiswa`
      );
      return exists ? prev.filter((id) => id !== stallId) : [...prev, stallId];
    });
  };

  const activeStall = stalls.find((s) => s.id === selectedStallId) || stalls[0];
  const activeMerchantStallId = loggedInSeller?.stallId || 'stan-bu-sari';
  const currentMerchantStall =
    stalls.find((s) => s.id === activeMerchantStallId) || stalls[0];

  // Helper to update stalls and broadcast to Firebase Cloud
  const updateStallsAndSync = (updater: (prev: Stall[]) => Stall[]) => {
    const nextStalls = updater(stallsRef.current);
    setStalls(nextStalls);
    syncStateToCloud(nextStalls, verificationsRef.current, sellerAccountsRef.current);
  };

  // Handlers for Merchant Screen (Operates on whichever seller is logged in!)
  const handleToggleStoreOpen = () => {
    const targetStall = stallsRef.current.find((s) => s.id === activeMerchantStallId);
    if (targetStall?.isFrozen) {
      showToast(
        `Operasional "${targetStall.name}" sedang dibekukan oleh Admin Sarpras: ${targetStall.frozenReason || 'Pelanggaran harga/aturan kampus'}.`,
        true
      );
      return;
    }

    updateStallsAndSync((prev) =>
      prev.map((stall) => {
        if (stall.id === activeMerchantStallId) {
          const nextOpen = !stall.isOpen;
          showToast(
            nextOpen
              ? `${stall.name} telah DIBUKA untuk mahasiswa.`
              : `${stall.name} dinonaktifkan sementara dari katalog.`
          );
          return {
            ...stall,
            isOpen: nextOpen,
            lastUpdatedDate: '8 Oktober 2026',
            lastUpdatedTime: 'Baru saja',
          };
        }
        return stall;
      })
    );
  };

  const handleToggleFreezeStall = (stallId: string, freeze: boolean, reason?: string) => {
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const target = stallsRef.current.find((s) => s.id === stallId);
    updateStallsAndSync((prev) =>
      prev.map((s) =>
        s.id === stallId
          ? {
              ...s,
              isFrozen: freeze,
              isOpen: freeze ? false : true,
              frozenReason: freeze
                ? reason?.trim() || 'Dibekukan sementara oleh Biro Sarpras & BAAK IBI KKG.'
                : undefined,
              lastUpdatedDate: 'Hari ini',
              lastUpdatedTime: `${nowTime} WIB`,
            }
          : s
      )
    );
    if (target) {
      showToast(
        freeze
          ? `Operasional stan "${target.name}" resmi DIBEKUKAN sementara oleh Admin.`
          : `Pembekuan stan "${target.name}" telah DICABUT & kembali aktif melayani mahasiswa.`
      );
    }
  };

  const handleToggleMenuStatus = (itemId: string) => {
    updateStallsAndSync((prev) =>
      prev.map((stall) => {
        if (stall.id === activeMerchantStallId) {
          const updatedMenu = stall.menuItems.map((item) => {
            if (item.id === itemId) {
              const nextStatus: 'ready' | 'habis' =
                item.status === 'habis' ? 'ready' : 'habis';
              showToast(
                `${item.name} ${
                  nextStatus === 'ready' ? 'sekarang Tersedia' : 'ditandai Habis'
                }`
              );
              return {
                ...item,
                status: nextStatus,
                lastUpdated: '8 Oktober 2026 (Baru saja)',
              };
            }
            return item;
          });
          return {
            ...stall,
            menuItems: updatedMenu,
            lastUpdatedDate: '8 Oktober 2026',
            lastUpdatedTime: 'Baru saja',
          };
        }
        return stall;
      })
    );
  };

  const handleUpdateMenuPrice = (itemId: string, newPrice: number) => {
    const safePrice = sanitizeMenuPrice(newPrice).price;
    updateStallsAndSync((prev) =>
      prev.map((stall) => {
        if (stall.id === activeMerchantStallId) {
          const updatedMenu = stall.menuItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  price: safePrice,
                  lastUpdated: '8 Oktober 2026 (Baru saja)',
                }
              : item
          );
          return {
            ...stall,
            menuItems: updatedMenu,
            lastUpdatedDate: '8 Oktober 2026',
            lastUpdatedTime: 'Baru saja',
          };
        }
        return stall;
      })
    );
  };

  const handleAddMenuItem = (newItem: Omit<MenuItem, 'id'>) => {
    const created: MenuItem = {
      ...newItem,
      id: `custom-${Date.now()}`,
    };
    updateStallsAndSync((prev) =>
      prev.map((stall) =>
        stall.id === activeMerchantStallId
          ? {
              ...stall,
              menuItems: [created, ...stall.menuItems],
              lastUpdatedDate: '8 Oktober 2026',
              lastUpdatedTime: 'Baru saja',
            }
          : stall
      )
    );
  };

  const handleEditMenuItem = (updatedItem: MenuItem) => {
    updateStallsAndSync((prev) =>
      prev.map((stall) =>
        stall.id === activeMerchantStallId
          ? {
              ...stall,
              menuItems: stall.menuItems.map((m) =>
                m.id === updatedItem.id ? updatedItem : m
              ),
              lastUpdatedDate: '8 Oktober 2026',
              lastUpdatedTime: 'Baru saja',
            }
          : stall
      )
    );
  };

  const handleDeleteMenuItem = (itemId: string) => {
    const target = currentMerchantStall.menuItems.find((m) => m.id === itemId);
    updateStallsAndSync((prev) =>
      prev.map((stall) =>
        stall.id === activeMerchantStallId
          ? {
              ...stall,
              menuItems: stall.menuItems.filter((m) => m.id !== itemId),
              lastUpdatedDate: '8 Oktober 2026',
              lastUpdatedTime: 'Baru saja',
            }
          : stall
      )
    );
    if (target) {
      showToast(`Menu "${target.name}" telah dihapus dari daftar`);
    }
  };

  const handleUpdateStallProfile = (updated: Partial<Stall>) => {
    updateStallsAndSync((prev) =>
      prev.map((stall) =>
        stall.id === activeMerchantStallId ? { ...stall, ...updated } : stall
      )
    );
  };

  const handleReplyReview = (reviewId: string, replyText: string) => {
    updateStallsAndSync((prev) =>
      prev.map((stall) =>
        stall.id === activeMerchantStallId
          ? {
              ...stall,
              reviews: stall.reviews.map((r) =>
                r.id === reviewId ? { ...r, reply: replyText } : r
              ),
            }
          : stall
      )
    );
  };

  const handleAddStudentReview = (
    stallId: string,
    studentName: string,
    majorAndYear: string,
    rating: number,
    comment: string
  ) => {
    const cd = checkActionCooldown('student_review');
    if (!cd.allowed) {
      showToast(
        `Anti-Spam Aktif: Mohon tunggu ${cd.remainingSeconds} detik sebelum mengirim ulasan berikutnya.`,
        true
      );
      return;
    }
    if (!isValidPersonName(studentName)) {
      showToast('Masukkan nama mahasiswa yang valid (minimal 2 huruf).', true);
      return;
    }

    const newRev: ReviewItem = {
      id: `rev-${Date.now()}`,
      studentName: studentName.trim(),
      majorAndYear,
      rating,
      date: '8 Oktober 2026',
      comment: comment.trim().slice(0, 300),
    };
    recordActionTimestamp('student_review');
    updateStallsAndSync((prev) =>
      prev.map((stall) =>
        stall.id === stallId
          ? {
              ...stall,
              reviews: [newRev, ...stall.reviews].slice(0, 40),
              reviewCount: stall.reviewCount + 1,
            }
          : stall
      )
    );
    showToast('Terima kasih! Ulasan Anda telah ditampilkan di halaman kantin.');
  };

  // Handlers for Admin Screen (Approving a verification also unlocks the Seller Account and creates their Stall in Cloud!)
  const handleApproveVerification = (id: string, name: string) => {
    const targetVerif = verificationsRef.current.find((v) => v.id === id);

    const nextVerifications = verificationsRef.current.map((v) =>
      v.id === id ? { ...v, approved: true } : v
    );
    let nextAccounts = sellerAccountsRef.current;
    let nextStalls = stallsRef.current;

    if (targetVerif?.sellerAccountId) {
      const targetAcc = sellerAccountsRef.current.find(
        (acc) => acc.id === targetVerif.sellerAccountId
      );

      nextAccounts = sellerAccountsRef.current.map((acc) =>
        acc.id === targetVerif.sellerAccountId
          ? { ...acc, status: 'approved', rejectedNote: undefined }
          : acc
      );

      if (targetAcc) {
        const alreadyExists = stallsRef.current.some((s) => s.id === targetAcc.stallId);
        if (!alreadyExists) {
          const newStall: Stall = {
            id: targetAcc.stallId,
            name: targetAcc.stallName,
            code: `Stan 0${stallsRef.current.length + 1}`,
            mapPinCode: 'Kantin A',
            building: targetAcc.building,
            distanceMeters: 60,
            locationDetail: targetAcc.locationDetail,
            fullLocation: `Gedung Kampus IBI KKG, ${targetAcc.locationDetail}`,
            walkingGuide: `Berada di area kantin dekat Hall D (${targetAcc.locationDetail}).`,
            specialty: targetAcc.categorySummary,
            description: `Mitra kantin terverifikasi di lingkungan kampus IBI Kwik Kian Gie yang dikelola langsung oleh ${targetAcc.ownerName}.`,
            daysOpen: 'Senin–Jumat',
            hours: targetAcc.hours,
            rating: 5.0,
            reviewCount: 1,
            visitorsCount: 1,
            isOpen: true,
            lastUpdatedDate: '8 Oktober 2026',
            lastUpdatedTime: 'Baru saja',
            verifiedAt: '8 Oktober 2026 • Baru saja',
            bannerImage: targetVerif.image,
            heroImage: targetVerif.image,
            bannerAlt: targetAcc.stallName,
            whatsapp: targetAcc.whatsapp,
            paymentMethods: ['QRIS tersedia (Semua Bank & E-Wallet)', 'Tunai di Kasir'],
            menuItems: [],
            reviews: [
              {
                id: `rev-init-${Date.now()}`,
                studentName: 'Biro Sarpras IBI KKG',
                majorAndYear: 'Verifikasi Mitra Kampus',
                rating: 5,
                date: '8 Oktober 2026',
                comment:
                  'Stan kantin telah diverifikasi resmi untuk Pilot Project Tahap 1 IBI KKG.',
              },
            ],
          };
          nextStalls = [newStall, ...stallsRef.current];
        }
      }
    }

    setVerifications(nextVerifications);
    setSellerAccounts(nextAccounts);
    setStalls(nextStalls);
    syncStateToCloud(nextStalls, nextVerifications, nextAccounts);

    showToast(
      `Akun & Stan "${name}" disetujui! Penjual kini dapat login ke Dashboard Penjual.`
    );
  };

  const handleRejectVerification = (id: string, name: string, note: string) => {
    const targetVerif = verificationsRef.current.find((v) => v.id === id);

    const nextVerifications = verificationsRef.current.map((v) =>
      v.id === id ? { ...v, rejectedReason: note } : v
    );
    let nextAccounts = sellerAccountsRef.current;

    if (targetVerif?.sellerAccountId) {
      nextAccounts = sellerAccountsRef.current.map((acc) =>
        acc.id === targetVerif.sellerAccountId
          ? { ...acc, status: 'rejected', rejectedNote: note }
          : acc
      );
    }

    setVerifications(nextVerifications);
    setSellerAccounts(nextAccounts);
    syncStateToCloud(stallsRef.current, nextVerifications, nextAccounts);

    showToast(`Pemberitahuan revisi dikirimkan ke mitra "${name}": "${note}"`);
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cd = checkActionCooldown('price_report');
    if (!cd.allowed) {
      showToast(
        `Anti-Spam Aktif: Mohon tunggu ${cd.remainingSeconds} detik sebelum mengirim laporan harga berikutnya.`,
        true
      );
      return;
    }

    if (!isValidStudentNim(reportNim)) {
      showToast(
        'Format NIM tidak valid. Masukkan 7–12 digit angka NIM Mahasiswa IBI KKG (contoh: 32230104).',
        true
      );
      return;
    }

    const targetStall =
      stallsRef.current.find((s) => s.id === reportStallId) || stallsRef.current[0];
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const catalogNum = Math.max(500, parseInt(reportCatalogPrice, 10) || 5000);
    const chargedNum = Math.max(500, parseInt(reportChargedPrice, 10) || 6000);

    const newReport: PriceDiscrepancyReport = {
      id: `LP-${Math.floor(100 + Math.random() * 900)}`,
      stallId: targetStall?.id || 'stan-berkah',
      stallName: targetStall?.name || 'Kantin Berkah Barokah',
      stallLocation: `${targetStall?.code || 'Stan 03'} • Dekat Hall D`,
      menuName: (reportMenuName.trim() || 'Menu Kantin').slice(0, 80),
      catalogPrice: catalogNum,
      chargedPrice: chargedNum,
      reporterNim: reportNim.trim(),
      reporterName: `Mahasiswa IBI KKG`,
      description: (
        reportNote.trim() ||
        'Harga yang ditagih di kasir berbeda dengan harga yang tertera di katalog KantinKu.'
      ).slice(0, 350),
      receiptImageUrl: reportProofImage || RECEIPT_PROOF_IMAGE,
      createdAt: `Hari ini, ${nowTime} WIB`,
      status: 'pending',
    };

    // Auto-prune to max 40 reports so Firestore document stays compact
    const nextReports = [newReport, ...priceReportsRef.current].slice(0, 40);
    setPriceReports(nextReports);
    priceReportsRef.current = nextReports;
    recordActionTimestamp('price_report');
    syncStateToCloud(
      stallsRef.current,
      verificationsRef.current,
      sellerAccountsRef.current,
      adminCredentialsRef.current,
      ordersRef.current,
      nextReports
    );

    setReportModalOpen(false);
    showToast(
      `Laporan #${newReport.id} (${newReport.menuName} di ${newReport.stallName}) berhasil dikirim ke Portal Admin Sarpras!`
    );
    setReportMenuName('');
    setReportNote('');
    setReportProofImage('');
  };

  const handleResolvePriceReport = (
    reportId: string,
    nextStatus: 'sp_sent' | 'resolved' | 'dismissed',
    adminNote?: string,
    syncCatalogPrice?: boolean
  ) => {
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const targetReport = priceReportsRef.current.find((r) => r.id === reportId);
    const nextReports = priceReportsRef.current.map((r) =>
      r.id === reportId
        ? {
            ...r,
            status: nextStatus,
            adminNote: adminNote || r.adminNote,
            adminActionAt: `Hari ini, ${nowTime} WIB`,
          }
        : r
    );

    let nextStalls = stallsRef.current;
    if (syncCatalogPrice && targetReport) {
      nextStalls = stallsRef.current.map((st) => {
        if (st.id !== targetReport.stallId) return st;
        const normalizedReportMenu = targetReport.menuName.trim().toLowerCase();
        let matched = false;
        const updatedMenus = st.menuItems.map((m) => {
          if (
            m.name.trim().toLowerCase() === normalizedReportMenu ||
            m.name.toLowerCase().includes(normalizedReportMenu) ||
            normalizedReportMenu.includes(m.name.toLowerCase())
          ) {
            matched = true;
            return {
              ...m,
              price: targetReport.chargedPrice,
              lastUpdated: `Disinkronkan (${nowTime} WIB)`,
            };
          }
          return m;
        });

        return {
          ...st,
          lastUpdatedDate: 'Hari ini',
          lastUpdatedTime: `${nowTime} WIB`,
          menuItems: matched ? updatedMenus : st.menuItems,
        };
      });
      setStalls(nextStalls);
      stallsRef.current = nextStalls;
    }

    setPriceReports(nextReports);
    priceReportsRef.current = nextReports;
    syncStateToCloud(
      nextStalls,
      verificationsRef.current,
      sellerAccountsRef.current,
      adminCredentialsRef.current,
      ordersRef.current,
      nextReports
    );

    if (targetReport) {
      if (nextStatus === 'sp_sent') {
        showToast(
          `Surat Peringatan Resmi (SP-1) #${targetReport.id} berhasil diterbitkan ke Dashboard ${targetReport.stallName}!`
        );
      } else if (nextStatus === 'resolved') {
        showToast(
          `Tiket #${targetReport.id} diselesaikan & harga katalog "${targetReport.menuName}" telah disinkronkan!`
        );
      } else {
        showToast(`Tiket laporan #${targetReport.id} telah ditolak / ditutup.`);
      }
    }
  };

  const openPilotConceptModal = () => {
    setInfoModal({
      title: 'Konsep Pilot Project Tahap 1 — IBI KKG',
      content: (
        <div className="flex flex-col gap-2.5 text-body-sm text-on-surface-variant">
          <div className="p-3 rounded-lg bg-surface-container-low">
            <strong className="text-on-surface block">Fokus Utama Tahap 1:</strong>
            <span>
              Membantu mahasiswa IBI KKG menemukan makanan berdasarkan lokasi, harga, dan menu, serta memungkinkan penjual mengelola informasi kantinnya secara langsung.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-surface-container-low">
            <strong className="text-on-surface block">
              Sistem Keamanan Akses Penjual:
            </strong>
            <span>
              Penjual wajib mendaftar terlebih dahulu dan diverifikasi oleh Admin Kampus agar tidak sembarang orang dapat mengubah harga atau menu kantin.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-secondary-container/40 text-on-surface">
            <strong className="text-secondary block">Roadmap Pengembangan:</strong>
            <span>
              Tahap 1: Riset &amp; Evaluasi IBI KKG → Tahap 2: Kantin Kampus Lain → Tahap 3: Ekspansi Platform Kantin Kampus.
            </span>
          </div>
        </div>
      ),
    });
  };

  const gmpApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

  return (
    <APIProvider
      apiKey={gmpApiKey}
      language="id"
      region="ID"
      libraries={['marker', 'routes']}
    >
      <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen w-full antialiased relative">
        {gmpQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}
        {/* SINGLE COMPACT STICKY HEADER */}
        <header className="sticky top-0 left-0 right-0 w-full z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 pt-safe">
        <div className="max-w-7xl mx-auto h-14 sm:h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left Zone: Brand Wordmark (Single Text Element Contract) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentScreen('katalog')}
              className="flex items-center gap-2.5 text-left cursor-pointer min-h-[44px] group"
              aria-label="KantinKu IBI KKG Beranda"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">restaurant</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap">
                KantinKu <span className="text-emerald-700">IBI KKG</span>
              </span>
            </button>
          </div>

          {/* Center Zone: Clean Single-Line Text Links on Desktop (lg: >= 1024px) */}
          <nav
            aria-label="Pilih Halaman & Peran"
            className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shrink-0"
          >
            <button
              type="button"
              onClick={() => navigateTo('katalog')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                currentScreen === 'katalog' || currentScreen === 'detail-stan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">storefront</span>
              <span>Katalog Kantin</span>
            </button>

            {loggedInSeller && (
              <button
                type="button"
                onClick={() => navigateTo('kelola-menu')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  currentScreen === 'kelola-menu'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">space_dashboard</span>
                <span>Dashboard ({loggedInSeller.stallName})</span>
              </button>
            )}

            {isAdminLoggedIn && (
              <button
                type="button"
                onClick={() => navigateTo('admin-portal')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  currentScreen === 'admin-portal'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  admin_panel_settings
                </span>
                <span>Portal Admin Kampus</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentScreen('auth-portal')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                currentScreen === 'auth-portal'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">login</span>
              <span>
                {loggedInSeller || isAdminLoggedIn ? 'Pindah Akun' : 'Portal Mitra Kantin'}
              </span>
            </button>
          </nav>

          {/* Right Zone: Primary Actions & Mobile Hamburger Menu (Touch Target >= 44px) */}
          <div className="flex items-center gap-2 shrink-0">
            {loggedInSeller || isAdminLoggedIn ? (
              <div className="hidden md:flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 text-xs">
                <span className="text-emerald-950 font-semibold max-w-[140px] truncate">
                  {loggedInSeller ? loggedInSeller.stallName : 'Admin Sarpras'}
                </span>
                <span className="text-emerald-300">·</span>
                <button
                  type="button"
                  onClick={handleLogoutSession}
                  className="text-rose-600 hover:text-rose-700 hover:underline text-xs font-semibold cursor-pointer"
                >
                  Keluar
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="hidden sm:inline-flex min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px] text-rose-600">gavel</span>
              <span>Lapor Harga</span>
            </button>

            {/* Hamburger Menu Button for Mobile & Tablet (< 1024px / lg:hidden) with 44px Touch Target */}
            <button
              aria-label="Buka Menu Navigasi & Peran"
              onClick={() => setNavDrawerOpen(true)}
              className="lg:hidden min-h-[44px] min-w-[44px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 border border-slate-200/80"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
              <span className="hidden sm:inline text-xs font-semibold">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex flex-col relative w-full bg-surface flex-grow">
        {currentScreen === 'auth-portal' && (
          <AuthPortalScreen
            sellerAccounts={sellerAccounts}
            adminCredentials={adminCredentials}
            loggedInSeller={loggedInSeller}
            isAdminLoggedIn={isAdminLoggedIn}
            onContinueAsStudent={handleContinueAsStudent}
            onLoginSellerSuccess={handleLoginSellerSuccess}
            onRegisterSeller={handleRegisterSeller}
            onUpdateSellerPassword={handleUpdateSellerPassword}
            onLoginAdminSuccess={handleLoginAdminSuccess}
            onOpenSellerDashboard={() => navigateTo('kelola-menu')}
            onOpenAdminDashboard={() => navigateTo('admin-portal')}
            onLogout={handleLogoutSession}
            onShowToast={showToast}
          />
        )}

        {currentScreen === 'katalog' && (
          <KatalogScreen
            stalls={stalls}
            orders={orders}
            activeSubTab={studentSubTab}
            onChangeSubTab={setStudentSubTab}
            favoriteStallIds={favoriteStallIds}
            onToggleFavoriteStall={toggleFavoriteStall}
            onSelectStall={(stallId) => navigateTo('detail-stan', stallId)}
            onNavigateMerchant={() => navigateTo('kelola-menu')}
            onNavigateAdmin={() => navigateTo('admin-portal')}
            onOpenReportModal={() => setReportModalOpen(true)}
            onOpenInfoModal={(title, content) => setInfoModal({ title, content })}
            onShowToast={showToast}
          />
        )}

        {currentScreen === 'detail-stan' && (
          <DetailStanScreen
            stall={activeStall}
            orders={orders}
            isFavorite={favoriteStallIds.includes(activeStall.id)}
            onToggleFavorite={() => toggleFavoriteStall(activeStall.id)}
            onPlaceOrder={handlePlaceOrder}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onAddReview={handleAddStudentReview}
            onBackToKatalog={() => navigateTo('katalog')}
            onOpenReportModal={() => {
              setReportStallId(activeStall.id);
              setReportModalOpen(true);
            }}
            onShowToast={showToast}
          />
        )}

        {currentScreen === 'kelola-menu' && (
          <KelolaMenuScreen
            stall={currentMerchantStall}
            allStalls={stalls}
            orders={orders}
            priceReports={priceReports}
            onResolvePriceReport={handleResolvePriceReport}
            sellerEmail={loggedInSeller?.email}
            loggedInSeller={loggedInSeller}
            onUpdateSellerPassword={handleUpdateSellerPassword}
            onSwitchSellerStall={(targetStallId) => {
              const matchingAcc = sellerAccounts.find((a) => a.stallId === targetStallId);
              if (matchingAcc) {
                setLoggedInSeller(matchingAcc);
                showToast(`Beralih ke Dashboard Penjual: ${matchingAcc.stallName}`);
              } else {
                const targetStall = stalls.find((s) => s.id === targetStallId);
                if (targetStall) {
                  setLoggedInSeller((prev) =>
                    prev
                      ? { ...prev, stallId: targetStall.id, stallName: targetStall.name }
                      : null
                  );
                  showToast(`Beralih ke Dashboard Penjual: ${targetStall.name}`);
                }
              }
            }}
            onLogoutSeller={handleLogoutSession}
            onToggleStoreOpen={handleToggleStoreOpen}
            onToggleMenuStatus={handleToggleMenuStatus}
            onUpdateMenuPrice={handleUpdateMenuPrice}
            onAddMenuItem={handleAddMenuItem}
            onEditMenuItem={handleEditMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            onUpdateStallProfile={handleUpdateStallProfile}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onReplyReview={handleReplyReview}
            onShowToast={(msg) => showToast(msg, false)}
          />
        )}

        {currentScreen === 'admin-portal' && (
          <AdminPortalScreen
            stalls={stalls}
            sellerAccounts={sellerAccounts}
            orders={orders}
            verifications={verifications}
            priceReports={priceReports}
            adminCredentials={adminCredentials}
            onUpdateAdminCredentials={handleUpdateAdminCredentials}
            onUpdateSellerPassword={handleUpdateSellerPassword}
            onApproveVerification={handleApproveVerification}
            onRejectVerification={handleRejectVerification}
            onResolvePriceReport={handleResolvePriceReport}
            onToggleFreezeStall={handleToggleFreezeStall}
            onShowToast={showToast}
            onOpenNavDrawer={() => {
              setNavDrawerOpen(true);
            }}
          />
        )}
      </main>

      {/* FOOTER - MODERN CLEAN FOOD APP (SHOPEEFOOD / GOJEK STYLE) */}
      <footer className="w-full bg-white border-t border-slate-200/80 text-slate-600 pb-safe mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-8 flex flex-col gap-6 sm:gap-8">
          {/* Main Grid: Responsive Mobile to Desktop Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
            {/* Column 1 (lg:col-span-4): Brand Identity & Campus Note */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-[22px]">restaurant</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900 tracking-tight leading-none">
                      KantinKu <span className="text-emerald-700">IBI KKG</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = footerSecretTap + 1;
                        if (next >= 5) {
                          setFooterSecretTap(0);
                          window.location.hash = 'admin';
                          setCurrentScreen('auth-portal');
                          showToast('Gerbang Internal Admin Kampus dibuka.');
                        } else {
                          setFooterSecretTap(next);
                        }
                      }}
                      className="text-xs font-medium text-slate-600 hover:text-emerald-700 select-none cursor-pointer"
                      title="Klik 5x untuk akses cepat admin"
                    >
                      v1.0
                    </button>
                  </div>
                  <span className="text-xs text-slate-500 font-medium mt-1">
                    Kampus Sunter · Hall D & Wing C
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Platform direktori &amp; pemesanan digital resmi untuk transparansi menu kantin{' '}
                <strong className="text-slate-900 font-semibold">
                  Institut Bisnis dan Informatika Kwik Kian Gie
                </strong>
                . Memudahkan mahasiswa membandingkan tarif makanan &amp; membantu mitra kantin mengelola transaksi.
              </p>

              <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200/80">
                <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 mt-0.5">
                  location_on
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-slate-900">Lokasi Kantin Kampus</span>
                  <span className="text-xs text-slate-500 leading-normal">
                    Jl. Yos Sudarso Kav. 87, Sunter, Jakarta Utara · Gedung Utama Lantai Dasar
                  </span>
                </div>
              </div>
            </div>

            {/* Column 2 & 3: Navigasi Mahasiswa & Akses (2-Col Grid on Mobile for compact thumb navigation) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4 sm:gap-6">
              {/* Navigasi Mahasiswa */}
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
                  Navigasi Mahasiswa
                </h3>
                <div className="flex flex-col gap-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('katalog');
                      setStudentSubTab('kantin');
                    }}
                    className="min-h-[40px] sm:min-h-[44px] py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-slate-600 group-hover:text-emerald-700 shrink-0">
                      storefront
                    </span>
                    <span className="line-clamp-1">Semua Stan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('katalog');
                      setStudentSubTab('kategori');
                    }}
                    className="min-h-[40px] sm:min-h-[44px] py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-slate-600 group-hover:text-emerald-700 shrink-0">
                      restaurant_menu
                    </span>
                    <span className="line-clamp-1">Jelajah Menu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('katalog');
                      setStudentSubTab('peta-gps');
                    }}
                    className="min-h-[40px] sm:min-h-[44px] py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-slate-600 group-hover:text-emerald-700 shrink-0">
                      map
                    </span>
                    <span className="line-clamp-1">Peta &amp; Rute</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('katalog');
                      setStudentSubTab('pesanan');
                    }}
                    className="min-h-[40px] sm:min-h-[44px] py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-slate-600 group-hover:text-emerald-700 shrink-0">
                      receipt_long
                    </span>
                    <span className="line-clamp-1">Pesanan Saya</span>
                  </button>
                  <button
                    type="button"
                    onClick={openPilotConceptModal}
                    className="min-h-[40px] sm:min-h-[44px] py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-slate-600 group-hover:text-emerald-700 shrink-0">
                      info
                    </span>
                    <span className="line-clamp-1">Konsep Kampus</span>
                  </button>
                </div>
              </div>

              {/* Akses & Tata Tertib */}
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
                  Akses &amp; Tertib
                </h3>
                <div className="flex flex-col gap-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setCurrentScreen('auth-portal')}
                    className="min-h-[40px] sm:min-h-[44px] py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-slate-600 group-hover:text-emerald-700 shrink-0">
                      login
                    </span>
                    <span className="line-clamp-1">Portal Mitra</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentScreen('auth-portal');
                      window.location.hash = 'admin';
                    }}
                    className="min-h-[40px] sm:min-h-[44px] py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-slate-600 group-hover:text-emerald-700 shrink-0">
                      shield_person
                    </span>
                    <span className="line-clamp-1">Admin Sarpras</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(true)}
                    className="min-h-[40px] sm:min-h-[44px] py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 text-rose-600 hover:text-rose-700 transition-colors text-left cursor-pointer group font-semibold"
                  >
                    <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-rose-500 shrink-0">
                      gavel
                    </span>
                    <span className="line-clamp-1">Lapor Harga</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Column 4 (lg:col-span-3): Jam Operasional Card */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-900">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">
                    schedule
                  </span>
                  <span className="font-semibold text-xs">Jam Operasional Kantin</span>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span className="font-medium">Senin – Jumat:</span>
                    <span className="font-semibold text-slate-900 tabular-nums">07.30 – 17.00 WIB</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Sabtu – Minggu:</span>
                    <span className="font-medium text-rose-600">Libur Perkuliahan</span>
                  </div>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 pt-1 border-t border-slate-200/60 leading-normal">
                  Pesan lebih awal via web untuk menghindari antrean di jam istirahat kuliah.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Unboxed Information */}
          <div className="pt-5 sm:pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-xs text-slate-500 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 flex-wrap">
              <span>© {new Date().getFullYear()} KantinKu IBI KKG</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Institut Bisnis dan Informatika Kwik Kian Gie</span>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 text-xs text-slate-500">
              <span>Kampus Sunter</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-emerald-700 font-semibold">Transparan &amp; Higienis</span>
            </div>
          </div>
        </div>
      </footer>

      {/* NAVIGATION DRAWER MODAL - MODERN CLEAN MOBILE SHEET */}
      {navDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto border border-slate-100 animate-in slide-in-from-bottom duration-300">
            {/* Header Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-[22px]">restaurant</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <h4 className="text-base font-black text-slate-900 leading-tight truncate">
                    Menu &amp; Navigasi
                  </h4>
                  <span className="text-xs text-slate-500 font-medium truncate">
                    KantinKu IBI KKG
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNavDrawerOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer shrink-0 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Active Session Status Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    loggedInSeller || isAdminLoggedIn
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                ></span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Sesi Aktif
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {loggedInSeller
                      ? loggedInSeller.stallName
                      : isAdminLoggedIn
                      ? 'Admin Sarpras IBI KKG'
                      : 'Mahasiswa / Pengunjung'}
                  </span>
                  {loggedInSeller && (
                    <span className="text-[11px] text-emerald-800 font-medium truncate">
                      {loggedInSeller.email}
                    </span>
                  )}
                </div>
              </div>
              {(loggedInSeller || isAdminLoggedIn) && (
                <button
                  type="button"
                  onClick={() => {
                    setNavDrawerOpen(false);
                    handleLogoutSession();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold cursor-pointer shrink-0 border border-rose-200 transition-colors"
                >
                  Keluar
                </button>
              )}
            </div>

            {/* Clean Navigation Links */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  navigateTo('katalog');
                  setNavDrawerOpen(false);
                }}
                className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                  currentScreen === 'katalog'
                    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                    : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">storefront</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">
                      Katalog &amp; Peta Kantin
                    </div>
                    <div
                      className={`text-[11px] truncate ${
                        currentScreen === 'katalog' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Beranda mahasiswa (tanpa login)
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] shrink-0">
                  chevron_right
                </span>
              </button>

              {loggedInSeller && (
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('kelola-menu');
                    setNavDrawerOpen(false);
                  }}
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    currentScreen === 'kelola-menu'
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                      space_dashboard
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold">
                        Dashboard Penjual Saya
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          currentScreen === 'kelola-menu' ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        Kelola menu &amp; harga {loggedInSeller.stallName}
                      </div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[18px] shrink-0">
                    chevron_right
                  </span>
                </button>
              )}

              {isAdminLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('admin-portal');
                    setNavDrawerOpen(false);
                  }}
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    currentScreen === 'admin-portal'
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                      admin_panel_settings
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold">
                        Portal Admin Kampus
                      </div>
                      <div
                        className={`text-[11px] truncate ${
                          currentScreen === 'admin-portal' ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        Verifikasi penjual &amp; moderasi laporan
                      </div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[18px] shrink-0">
                    chevron_right
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('auth-portal');
                  setNavDrawerOpen(false);
                }}
                className={`min-h-[48px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                  currentScreen === 'auth-portal'
                    ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/20'
                    : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">
                    login
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">
                      {loggedInSeller || isAdminLoggedIn
                        ? 'Ganti Peran / Pindah Akun'
                        : 'Login / Daftar Mitra Kantin'}
                    </div>
                    <div
                      className={`text-[11px] truncate ${
                        currentScreen === 'auth-portal' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Akses mitra stan &amp; admin sarpras
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] shrink-0">
                  chevron_right
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNavDrawerOpen(false);
                  setReportModalOpen(true);
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer bg-rose-50 hover:bg-rose-100/70 text-rose-700 border border-rose-200/80 mt-1"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] text-rose-600">gavel</span>
                  <span className="text-xs font-bold">Lapor Selisih Harga Kasir</span>
                </div>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT PRICE DISCREPANCY MODAL - MODERN CLEAN REDESIGN */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleReportSubmit}
            className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto border border-slate-100"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">gavel</span>
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 leading-tight">
                    Lapor Selisih Harga
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    Transparansi Tarif KantinKu IBI KKG
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Kantin Terlapor
              </label>
              <select
                value={reportStallId}
                onChange={(e) => {
                  setReportStallId(e.target.value);
                  setReportMenuName('');
                }}
                className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {stalls.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Pilih dari Daftar Menu Stan
              </label>
              <select
                value=""
                onChange={(e) => {
                  const chosenId = e.target.value;
                  const targetStall = stalls.find((s) => s.id === reportStallId);
                  const foundMenu = targetStall?.menuItems.find((m) => m.id === chosenId);
                  if (foundMenu) {
                    setReportMenuName(foundMenu.name);
                    setReportCatalogPrice(String(foundMenu.price));
                    setReportChargedPrice(String(foundMenu.price + 2000));
                  }
                }}
                className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Pilih cepat menu atau ketik manual di bawah --</option>
                {(stalls.find((s) => s.id === reportStallId)?.menuItems || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Katalog: Rp {m.price.toLocaleString('id-ID')})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Nama Makanan / Minuman
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Es Jeruk Peras / Nasi Goreng"
                value={reportMenuName}
                onChange={(e) => setReportMenuName(e.target.value)}
                className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Harga di Website (Rp)
                </label>
                <input
                  type="number"
                  required
                  value={reportCatalogPrice}
                  onChange={(e) => setReportCatalogPrice(e.target.value)}
                  className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-emerald-700 font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Harga Ditagih Kasir (Rp)
                </label>
                <input
                  type="number"
                  required
                  value={reportChargedPrice}
                  onChange={(e) => setReportChargedPrice(e.target.value)}
                  className="h-11 px-3.5 rounded-xl bg-slate-50 border border-rose-200 text-rose-700 font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                NIM Mahasiswa Pelapor
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 32230104"
                value={reportNim}
                onChange={(e) => setReportNim(e.target.value)}
                className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Bukti Foto Struk / Kasir (Opsional)
              </label>
              <div className="flex items-center gap-3">
                {reportProofImage && (
                  <img
                    src={reportProofImage}
                    alt="Pratinjau Bukti Struk"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                )}
                <label className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 cursor-pointer w-full justify-center transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">
                    add_a_photo
                  </span>
                  <span>
                    {reportProofImage
                      ? 'Ganti Foto Bukti Struk'
                      : 'Unggah Foto Struk / Nota'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      compressUploadedImage(file, 640, 0.68)
                        .then((compressed) => {
                          setReportProofImage(compressed);
                          showToast('Foto struk berhasil dikompresi & siap dikirim.');
                        })
                        .catch(() => {
                          showToast('Gagal memproses foto bukti struk.', true);
                        });
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Keterangan Singkat Kejadian
              </label>
              <textarea
                rows={2}
                placeholder="Contoh: Kasir menyebutkan harga naik Rp 2.000 namun belum diubah di aplikasi..."
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="w-1/2 min-h-[44px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-1/2 min-h-[44px] rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Kirim ke Admin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GENERIC INFO MODAL - MODERN CLEAN */}
      {infoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 max-h-[90dvh] overflow-y-auto border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-black text-slate-900">{infoModal.title}</h4>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">{infoModal.content}</div>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="w-full min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold mt-1 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL NOTIFICATION TOAST - MODERN FLOATING CARD */}
      <div
        className={`fixed bottom-6 left-4 right-4 max-w-md mx-auto z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 transition-all duration-300 border border-slate-800 ${
          toast.visible
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-16 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            toast.isError
              ? 'bg-rose-500/20 text-rose-400'
              : 'bg-emerald-500/20 text-emerald-400'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {toast.isError ? 'warning' : 'check_circle'}
          </span>
        </div>
        <span className="text-xs font-semibold flex-grow leading-tight">{toast.message}</span>
      </div>
      </div>
    </APIProvider>
  );
}
