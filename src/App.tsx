import React, { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  AdminCredentials,
  INITIAL_ADMIN_CREDENTIALS,
  INITIAL_PRICE_REPORTS,
  INITIAL_RUNNER_PROFILE,
  INITIAL_SELLER_ACCOUNTS,
  INITIAL_STALLS,
  INITIAL_STUDENT_ACCOUNTS,
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
  StudentAccount,
  StudentRunnerProfile,
  VerificationRequest,
} from './data/kantinData';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AuthPortalScreen } from './components/AuthPortalScreen';
import { KatalogScreen, StudentSubTab } from './components/KatalogScreen';
import { DetailStanScreen } from './components/DetailStanScreen';
import { KelolaMenuScreen } from './components/KelolaMenuScreen';
import { AdminPortalScreen } from './components/AdminPortalScreen';
import { UnifoodLogo } from './components/UnifoodLogo';
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
  STUDENT_SESSION: 'kantinku_ibikkg_student_session_v1',
  STUDENT_ACCOUNTS: 'kantinku_ibikkg_student_accounts_v1',
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

  const [studentAccounts, setStudentAccounts] = useState<StudentAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STUDENT_ACCOUNTS);
      return saved ? JSON.parse(saved) : INITIAL_STUDENT_ACCOUNTS;
    } catch {
      return INITIAL_STUDENT_ACCOUNTS;
    }
  });

  const [loggedInStudent, setLoggedInStudent] = useState<StudentAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STUDENT_SESSION);
      if (saved) {
        const parsed: StudentAccount = JSON.parse(saved);
        // If parsed is a saved account and not the old unauthenticated default (32230104)
        if (parsed && parsed.name && parsed.nim !== '32230104') {
          return parsed;
        }
      }
      const savedName = localStorage.getItem('kantinku_student_name_v1');
      const savedNim = localStorage.getItem('kantinku_student_nim_v1');
      if (savedName && savedNim && savedNim !== '32230104') {
        return {
          id: `std-${savedNim}`,
          name: savedName,
          nim: savedNim,
          email: `${savedNim}@students.ibikkg.ac.id`,
          createdAt: 'Semester Ganjil 2026',
        };
      }
      // Default to Aldo Phiong (std-32230105) matching the active user account
      const aldoAccount = INITIAL_STUDENT_ACCOUNTS.find(
        (s) => s.nim === '32230105' || s.name.toLowerCase().includes('aldo')
      );
      return aldoAccount || INITIAL_STUDENT_ACCOUNTS[1] || INITIAL_STUDENT_ACCOUNTS[0];
    } catch {
      return INITIAL_STUDENT_ACCOUNTS[1] || INITIAL_STUDENT_ACCOUNTS[0];
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
      } else if (e.key === 'Escape') {
        setNavDrawerOpen(false);
        setReportModalOpen(false);
        setInfoModal(null);
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
  const studentAccountsRef = useRef(studentAccounts);
  studentAccountsRef.current = studentAccounts;


  const [runnerProfile, setRunnerProfile] = useState<StudentRunnerProfile>(() => {
    try {
      const saved = localStorage.getItem('unifood_runner_profile_v1');
      return saved ? JSON.parse(saved) : INITIAL_RUNNER_PROFILE;
    } catch {
      return INITIAL_RUNNER_PROFILE;
    }
  });

  const handleToggleRunnerOnline = () => {
    setRunnerProfile((prev) => {
      const updated = { ...prev, isOnline: !prev.isOnline };
      try {
        localStorage.setItem('unifood_runner_profile_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(runnerProfile.isOnline ? 'Status Kurir: Istirahat' : 'Status Kurir: Siap Antar (Online)!');
  };

  const handleAcceptJastip = (orderId: string) => {
    setOrders((prev) => {
      const next = prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            runnerId: runnerProfile.studentId,
            runnerName: runnerProfile.studentName,
            runnerNim: runnerProfile.studentNim,
            runnerStatus: 'assigned' as const,
          };
        }
        return ord;
      });
      ordersRef.current = next;
      syncStateToCloud(
        stallsRef.current,
        verificationsRef.current,
        sellerAccountsRef.current,
        adminCredentialsRef.current,
        next
      );
      return next;
    });
    showToast(`Order ${orderId} berhasil Anda ambil! Segera ambil pesanan di stan kantin.`);
  };

  const handleUpdateDeliveryStatus = (
    orderId: string,
    nextStatus: 'picking_up' | 'delivering_to_floor' | 'arrived_at_room' | 'delivered',
    pinInput?: string
  ): boolean => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return false;

    if (nextStatus === 'delivered') {
      const expectedPin = targetOrder.runnerPinCode || '1234';
      if ((pinInput || '').trim() !== expectedPin.trim()) {
        return false;
      }
    }

    setOrders((prev) => {
      const next = prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            runnerStatus: nextStatus,
            status: nextStatus === 'delivered' ? ('completed' as const) : ord.status,
          };
        }
        return ord;
      });
      ordersRef.current = next;
      syncStateToCloud(
        stallsRef.current,
        verificationsRef.current,
        sellerAccountsRef.current,
        adminCredentialsRef.current,
        next
      );
      return next;
    });

    if (nextStatus === 'delivered') {
      const earnedFee = targetOrder.jastipFee || 2500;
      setRunnerProfile((prev) => {
        const updated: StudentRunnerProfile = {
          ...prev,
          totalEarnings: prev.totalEarnings + earnedFee,
          completedDeliveries: prev.completedDeliveries + 1,
        };
        try {
          localStorage.setItem('unifood_runner_profile_v1', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      showToast(
        `Verifikasi PIN Sukses! Pesanan selesai dan +Rp ${earnedFee.toLocaleString('id-ID')} masuk ke dompet Anda!`
      );
    } else if (nextStatus === 'delivering_to_floor') {
      showToast('Status: Makanan telah diambil dari stan, naik ke lantai kelas.');
    } else if (nextStatus === 'arrived_at_room') {
      showToast(`Tiba di depan kelas (${targetOrder.deliveryRoom || 'Titik Temu'}). Minta 4 digit PIN pemesan.`);
    }

    return true;
  };

  const handleWithdrawRunnerEarnings = (amount: number, dest: string) => {
    setRunnerProfile((prev) => {
      const updated: StudentRunnerProfile = {
        ...prev,
        totalEarnings: Math.max(0, prev.totalEarnings - amount),
      };
      try {
        localStorage.setItem('unifood_runner_profile_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    showToast(`Penarikan uang saku Rp ${amount.toLocaleString('id-ID')} ke ${dest} berhasil diproses!`);
  };

  // Helper to push shared state to Firebase Firestore Cloud Database
  const syncStateToCloud = async (
    nextStalls: Stall[],
    nextVerifications: VerificationRequest[],
    nextSellerAccounts: SellerAccount[],
    nextAdminCreds: AdminCredentials = adminCredentialsRef.current,
    nextOrders: OrderTransaction[] = ordersRef.current,
    nextPriceReports: PriceDiscrepancyReport[] = priceReportsRef.current,
    nextStudentAccounts: StudentAccount[] = studentAccountsRef.current
  ) => {
    const stallsJson = JSON.stringify(nextStalls).slice(0, 449000);
    const verificationsJson = JSON.stringify(nextVerifications).slice(0, 199000);
    const sellerAccountsJson = JSON.stringify(nextSellerAccounts).slice(0, 199000);
    const adminCredentialsJson = JSON.stringify(nextAdminCreds).slice(0, 4900);
    const ordersJson = JSON.stringify(nextOrders).slice(0, 249000);
    const priceReportsJson = JSON.stringify(nextPriceReports).slice(0, 199000);
    const studentAccountsJson = JSON.stringify(nextStudentAccounts).slice(0, 199000);
    const updatedAtIso = new Date().toISOString();

    try {
      await setDoc(doc(db, 'kantinku_state', 'pilot_v1'), {
        stallsJson,
        verificationsJson,
        sellerAccountsJson,
        adminCredentialsJson,
        ordersJson,
        priceReportsJson,
        studentAccountsJson,
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
            if (typeof data.studentAccountsJson === 'string') {
              const parsedStudents: StudentAccount[] = JSON.parse(data.studentAccountsJson);
              if (Array.isArray(parsedStudents) && parsedStudents.length > 0) {
                setStudentAccounts(parsedStudents);
                setLoggedInStudent((prev) => {
                  if (!prev) return null;
                  const updated = parsedStudents.find((s) => s.id === prev.id || s.nim === prev.nim);
                  return updated || prev;
                });
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
            priceReportsRef.current,
            studentAccountsRef.current
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

  useEffect(() => {
    try {
      if (loggedInStudent) {
        localStorage.setItem(STORAGE_KEYS.STUDENT_SESSION, JSON.stringify(loggedInStudent));
        localStorage.setItem('kantinku_student_name_v1', loggedInStudent.name);
        localStorage.setItem('kantinku_student_nim_v1', loggedInStudent.nim);
      } else {
        localStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
      }
    } catch {
      // ignore
    }
  }, [loggedInStudent]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDENT_ACCOUNTS, JSON.stringify(studentAccounts));
    } catch {
      // ignore
    }
  }, [studentAccounts]);

  const handlePlaceOrder = (
    orderData: Omit<OrderTransaction, 'id' | 'status' | 'createdAt'>
  ): OrderTransaction => {
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const isAutoPaidGateway = orderData.paymentStatus === 'paid_gateway';
    const isCashOrder = orderData.paymentStatus === 'cash_on_pickup';
    const sanitizedItems = (orderData.items || []).map((it) => ({
      ...it,
      price: sanitizeMenuPrice(it.price).price,
      quantity: sanitizeOrderQuantity(it.quantity),
    }));
    const safeSubtotal = sanitizedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const safeFee = Math.max(0, Math.min(5000, orderData.serviceFee || 0));
    const safeTotal = safeSubtotal + safeFee;

    const assignedStudentId = orderData.studentId || (loggedInStudent ? loggedInStudent.id : undefined);
    const assignedStudentEmail = orderData.studentEmail || (loggedInStudent ? loggedInStudent.email : undefined);
    const assignedStudentName = orderData.studentName || (loggedInStudent ? loggedInStudent.name : 'Mahasiswa IBI KKG');
    const assignedStudentNim = orderData.studentNim || (loggedInStudent ? loggedInStudent.nim : '');

    const newOrder: OrderTransaction = {
      ...orderData,
      studentId: assignedStudentId,
      studentEmail: assignedStudentEmail,
      studentName: assignedStudentName,
      studentNim: assignedStudentNim,
      items: sanitizedItems,
      subtotalAmount: safeSubtotal,
      serviceFee: safeFee,
      totalAmount: safeTotal,
      id: `ORD-${Date.now().toString().slice(-6)}`,
      status: (isAutoPaidGateway || isCashOrder) ? 'cooking' : 'waiting_payment_verification',
      createdAt: `Hari ini, ${nowTime} WIB`,
    };
    // Auto-prune to max 80 recent orders so Firestore 1MB document limit is never exceeded
    const nextOrders = [newOrder, ...ordersRef.current].slice(0, 80);
    setOrders(nextOrders);
    ordersRef.current = nextOrders;
    try {
      const existingMyIds: string[] = JSON.parse(
        localStorage.getItem('kantinku_my_order_ids_v1') || '[]'
      );
      const updatedMyIds = [newOrder.id, ...existingMyIds.filter((id) => id !== newOrder.id)];
      localStorage.setItem('kantinku_my_order_ids_v1', JSON.stringify(updatedMyIds));
      localStorage.setItem('kantinku_student_name_v1', newOrder.studentName);
      localStorage.setItem('kantinku_student_nim_v1', newOrder.studentNim);
    } catch {
      // ignore storage error
    }
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
        ? `Pembayaran Lunas Otomatis! Pesanan ${newOrder.id} langsung diproses & dimasak oleh ${newOrder.stallName}.`
        : isCashOrder
        ? `Pesanan Tunai (COD) Berhasil Dibuat! Stan ${newOrder.stallName} langsung memasak pesanan Anda. Siapkan uang pas saat disajikan/diambil.`
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
      const isDineIn = target.fulfillmentType === 'dine_in';
      if (nextStatus === 'cooking') {
        showToast(
          isDineIn
            ? `Pembayaran ${target.studentName} diterima! Pesanan sedang disiapkan di piring untuk Meja ${target.tableNumber || '-'}.`
            : `Pembayaran ${target.studentName} diterima! Pesanan ditandai Sedang Disiapkan / Dibungkus.`
        );
      } else if (nextStatus === 'ready_pickup') {
        showToast(
          isDineIn
            ? `Notifikasi dikirim ke ${target.studentName}: Makanan siap & sedang disajikan ke Meja ${target.tableNumber || ''}!`
            : `Notifikasi dikirim ke ${target.studentName}: Pesanan sudah SIAP DIAMBIL di stan!`
        );
      } else if (nextStatus === 'completed') {
        showToast(
          isDineIn
            ? `Transaksi pesanan ${target.studentName} selesai (sudah dinikmati di Meja ${target.tableNumber || '-'})!`
            : `Transaksi pesanan ${target.studentName} selesai (sudah diambil)!`
        );
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

  // Toast State (Supporting Ben Shneiderman's 8 Golden Rules: Informative Feedback & Easy Reversal/Undo)
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    isError: boolean;
    action?: {
      label: string;
      onClick: () => void;
    };
  }>({
    visible: false,
    message: '',
    isError: false,
  });
  const toastTimeoutRef = useRef<number | null>(null);

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

  const showToast = (
    message: string,
    isError = false,
    action?: { label: string; onClick: () => void }
  ) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast({ visible: true, message, isError, action });
    toastTimeoutRef.current = window.setTimeout(
      () => {
        setToast((prev) => ({ ...prev, visible: false }));
      },
      action ? 5500 : 3500
    );
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
    showToast('Selamat datang di Unifood!');
  };

  const handleLoginStudentSuccess = (account: StudentAccount) => {
    setLoggedInStudent(account);
    setCurrentScreen('katalog');
    setStudentSubTab('pesanan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Masuk sebagai ${account.name} (NIM: ${account.nim}). Pesanan Anda terisolasi.`);
  };

  const handleRegisterStudent = (
    newAccData: Omit<StudentAccount, 'id' | 'createdAt'>
  ): StudentAccount => {
    const cleanNim = newAccData.nim.trim();
    const created: StudentAccount = {
      ...newAccData,
      id: `std-${cleanNim}`,
      createdAt: 'Semester Ganjil 2026',
    };
    const nextAccounts = [
      ...studentAccountsRef.current.filter((s) => s.nim !== cleanNim),
      created,
    ];
    setStudentAccounts(nextAccounts);
    studentAccountsRef.current = nextAccounts;
    setLoggedInStudent(created);
    setCurrentScreen('katalog');
    setStudentSubTab('pesanan');
    syncStateToCloud(
      stallsRef.current,
      verificationsRef.current,
      sellerAccountsRef.current,
      adminCredentialsRef.current,
      ordersRef.current,
      priceReportsRef.current,
      nextAccounts
    );
    showToast(`Akun mahasiswa "${created.name}" berhasil didaftarkan & masuk!`);
    return created;
  };

  const handleLogoutStudent = () => {
    setLoggedInStudent(null);
    showToast('Keluar dari akun mahasiswa.');
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
    const stallObj = stalls.find((s) => s.id === stallId);
    setFavoriteStallIds((prev) => {
      const exists = prev.includes(stallId);
      if (exists) {
        showToast(
          `${stallObj?.name || 'Kantin'} dihapus dari Favorit`,
          false,
          {
            label: 'Urungkan',
            onClick: () => {
              setFavoriteStallIds((old) => (old.includes(stallId) ? old : [...old, stallId]));
              showToast(`${stallObj?.name || 'Kantin'} dikembalikan ke Favorit`);
            },
          }
        );
        return prev.filter((id) => id !== stallId);
      } else {
        showToast(`${stallObj?.name || 'Kantin'} disimpan ke Favorit`);
        return [...prev, stallId];
      }
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
      title: 'Konsep Digitalisasi Kantin IBI KKG',
      content: (
        <div className="flex flex-col gap-2.5 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">Fokus Utama Layanan:</strong>
            <span>
              Membantu mahasiswa IBI KKG memesan makanan tanpa antre di jam istirahat, memantau antrean masak secara transparan, serta memudahkan mitra stan kantin mengelola menu dan pesanan secara digital.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">
              Perlindungan Konsumen &amp; Otorisasi:
            </strong>
            <span>
              Setiap stan di kantin diverifikasi oleh Biro Sarpras dan BAAK. Mahasiswa dilindungi oleh jaminan transparansi harga (fitur Lapor Selisih Harga) dan nota digital yang terverifikasi.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
            <strong className="text-emerald-950 block mb-1">Jastip Antar Kelas:</strong>
            <span>
              Memberdayakan mahasiswa yang sedang menuju ke lantai atas untuk membantu membelikan makanan teman sekelas dengan ongkos jastip transparan.
            </span>
          </div>
        </div>
      ),
    });
  };

  const openTermsModal = () => {
    setInfoModal({
      title: 'Syarat & Ketentuan Layanan Unifood',
      content: (
        <div className="flex flex-col gap-2.5 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">1. Transparansi Harga Stan</strong>
            <span>
              Harga yang ditampilkan di Unifood wajib sama persis dengan harga fisik di stan kantin Kampus IBI KKG. Jika kasir menagih harga lebih tinggi, mahasiswa berhak mengajukan komplain resmi melalui form Laporkan Selisih Harga.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">2. Waktu Penyiapan &amp; Pengambilan</strong>
            <span>
              Setelah notifikasi status &ldquo;Siap Diambil&rdquo; muncul di layar, mahasiswa diharapkan segera mengambil makanan di stan terkait dalam kurun waktu 15 menit agar kesegaran dan cita rasa hidangan tetap optimal.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">3. Kebijakan Pembatalan &amp; Pengembalian</strong>
            <span>
              Pesanan yang sudah mulai dimasak oleh dapur stan tidak dapat dibatalkan secara sepihak. Apabila bahan baku habis mendadak, mitra stan wajib mengonfirmasi penolakan dan pengembalian dana penuh kepada pemesan.
            </span>
          </div>
        </div>
      ),
    });
  };

  const openPrivacyModal = () => {
    setInfoModal({
      title: 'Kebijakan Privasi & Perlindungan Data Mahasiswa',
      content: (
        <div className="flex flex-col gap-2.5 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">1. Penggunaan NIM &amp; Data Identitas</strong>
            <span>
              Nomor Induk Mahasiswa (NIM) dan nama pemesan hanya dipakai untuk pelabelan nota dan pemanggilan antrean di stan kantin IBI KKG. Data ini tersimpan dengan aman dan tidak dibagikan ke pihak ketiga di luar kepentingan operasional kampus.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">2. Keamanan Pembayaran Digital</strong>
            <span>
              Setiap transaksi nontunai diproses melalui standar QRIS Bank Indonesia dan gateway resmi. Platform Unifood tidak menyimpan kredensial sensitif seperti PIN bank atau detail kartu pembayaran pengguna.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">3. Kendali &amp; Penghapusan Sesi</strong>
            <span>
              Mahasiswa memiliki hak penuh untuk keluar dari akun, membersihkan riwayat pesanan perangkat lokal, atau meminta pembaruan data melalui Admin Sarpras Kampus.
            </span>
          </div>
        </div>
      ),
    });
  };

  const openJastipGuideModal = () => {
    setInfoModal({
      title: 'Panduan Layanan Jastip Antar Kelas',
      content: (
        <div className="flex flex-col gap-2.5 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">Cara Pesan via Jastip:</strong>
            <span>
              Saat checkout, pilih opsi &ldquo;Jastip Antar ke Kelas&rdquo;, masukkan lantai dan nomor ruang kelas (misal: Lantai 3 Ruang 304). Kurir sesama mahasiswa yang sedang standby akan mengambilkan pesanan Anda dari kantin.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <strong className="text-slate-900 block mb-1">Ongkos Kirim Flat &amp; Transparan:</strong>
            <span>
              Tarif jastip berkisar antara Rp 2.500 – Rp 3.500 per pesanan. 100% biaya jastip langsung masuk sebagai uang saku tambahan bagi mahasiswa yang bertugas mengantar.
            </span>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950">
            <strong className="block mb-1 font-bold">Verifikasi 4 Digit PIN Pengambilan:</strong>
            <span>
              Demi keamanan, berikan 4 digit kode PIN yang tertera di nota pesanan Anda kepada kurir saat makanan tiba di depan ruang kelas sebagai bukti serah terima yang sah.
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
        <header className="sticky top-0 left-0 right-0 w-full z-40 bg-white/95 backdrop-blur-xl border-b border-stone-200/80 pt-safe">
        <div className="max-w-7xl mx-auto h-14 sm:h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left Zone: Brand Wordmark (Single Text Element Contract) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentScreen('katalog')}
              className="flex items-center text-left cursor-pointer min-h-[44px] group"
              aria-label="Unifood Beranda"
            >
              <UnifoodLogo size="md" />
            </button>
          </div>

          {/* Center Zone: Clean Single-Line Text Links on Desktop (lg: >= 1024px) */}
          <nav
            aria-label="Pilih Halaman & Peran"
            className="hidden lg:flex items-center gap-1 bg-stone-100/90 p-1 rounded-lg border border-stone-200/80 shrink-0"
          >
            <button
              type="button"
              onClick={() => navigateTo('katalog')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                currentScreen === 'katalog' || currentScreen === 'detail-stan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">storefront</span>
              <span>Katalog Menu</span>
            </button>

            {loggedInSeller && (
              <button
                type="button"
                onClick={() => navigateTo('kelola-menu')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
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
                className={`min-h-[38px] px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  currentScreen === 'admin-portal'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  admin_panel_settings
                </span>
                <span>Admin Kampus</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentScreen('auth-portal')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                currentScreen === 'auth-portal'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">login</span>
              <span>
                {loggedInSeller || isAdminLoggedIn ? 'Pindah Akun' : 'Portal Mitra'}
              </span>
            </button>
          </nav>

          {/* Right Zone: Primary Actions & Mobile Hamburger Menu (Touch Target >= 44px) */}
          <div className="flex items-center gap-2 shrink-0">
            {loggedInSeller || isAdminLoggedIn ? (
              <div className="hidden md:flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/80 text-xs">
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
            ) : loggedInStudent ? (
              <div className="hidden md:flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/90 text-xs">
                <span className="material-symbols-outlined text-[16px] text-emerald-700">school</span>
                <span className="text-emerald-950 font-semibold max-w-[130px] truncate">
                  {loggedInStudent.name}
                </span>
                <span className="text-emerald-300">·</span>
                <button
                  type="button"
                  onClick={handleLogoutStudent}
                  className="text-rose-600 hover:text-rose-700 hover:underline text-xs font-semibold cursor-pointer"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentScreen('auth-portal')}
                className="hidden md:inline-flex min-h-[38px] px-4 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">school</span>
                <span>Masuk Mahasiswa</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="hidden sm:inline-flex min-h-[44px] px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px] text-rose-600">gavel</span>
              <span>Lapor Harga</span>
            </button>

            {/* Hamburger Menu Button for Mobile & Tablet (< 1024px / lg:hidden) with 44px Touch Target */}
            <button
              aria-label="Buka Menu Navigasi & Peran"
              onClick={() => setNavDrawerOpen(true)}
              className="lg:hidden min-h-[44px] min-w-[44px] px-3 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 border border-slate-200/80"
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
            studentAccounts={studentAccounts}
            loggedInStudent={loggedInStudent}
            onContinueAsStudent={handleContinueAsStudent}
            onLoginStudentSuccess={handleLoginStudentSuccess}
            onRegisterStudent={handleRegisterStudent}
            onLogoutStudent={handleLogoutStudent}
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
            loggedInStudent={loggedInStudent}
            studentAccounts={studentAccounts}
            onLoginStudentSuccess={handleLoginStudentSuccess}
            onLogoutStudent={handleLogoutStudent}
            onOpenAuthPortal={() => navigateTo('auth-portal')}
            onPlaceOrder={handlePlaceOrder}
            onUpdateOrderStatus={handleUpdateOrderStatus}
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
            loggedInStudent={loggedInStudent}
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

      {/* FOOTER - REAL PRODUCTION CAMPUS FOOD & SERVICE FOOTER */}
      <footer className="w-full bg-white border-t border-slate-200/80 text-slate-600 pb-safe mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-7 sm:pb-9 flex flex-col gap-8">
          {/* Main Grid: 4 Production-Standard Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-7 sm:gap-8 items-start">
            {/* Column 1 (lg:col-span-4): Brand, Official Identity & Campus Location */}
            <div className="lg:col-span-4 flex flex-col gap-3.5">
              <button
                type="button"
                onClick={() => setCurrentScreen('katalog')}
                className="flex items-center text-left cursor-pointer group self-start"
                aria-label="Unifood Beranda"
              >
                <UnifoodLogo
                  size="md"
                  badgeText="Kantin IBI KKG"
                  subtitleText="Sistem Pemesanan & Antrean Digital Kampus"
                />
              </button>

              <p className="text-xs text-slate-600 leading-relaxed">
                Platform kuliner resmi terintegrasi untuk mahasiswa, staf pengajar, dan mitra UMKM kantin Kampus Institut Bisnis dan Informatika Kwik Kian Gie. Pesan santap makan tanpa antre, higienis, dan transparan.
              </p>

              {/* Physical Campus Location & Hours Box */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2 text-xs">
                <div className="flex items-start gap-2 text-slate-800">
                  <span className="material-symbols-outlined text-[17px] text-emerald-600 shrink-0 mt-0.5">
                    location_on
                  </span>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block">Area Kantin Hall D (Lantai Dasar)</span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Jl. Yos Sudarso Kav. 87, Sunter Podomoro, Jakarta Utara 14350
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-800 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Kantin Buka 07.30 – 17.00 WIB
                  </span>
                  <span className="text-slate-500 text-[10px]">Senin – Jumat &amp; Sabtu Kelas Karyawan</span>
                </div>
              </div>
            </div>

            {/* Column 2 (lg:col-span-2): Navigasi Layanan Mahasiswa */}
            <div className="lg:col-span-2 flex flex-col gap-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">restaurant</span>
                Layanan Mahasiswa
              </h3>
              <div className="flex flex-col gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('katalog');
                    setStudentSubTab('kantin');
                  }}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-emerald-700 shrink-0">
                    storefront
                  </span>
                  <span>Daftar Stan Kantin</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('katalog');
                    setStudentSubTab('kategori');
                  }}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-emerald-700 shrink-0">
                    category
                  </span>
                  <span>Jelajah Menu &amp; Kategori</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('katalog');
                    setStudentSubTab('pesanan');
                  }}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-emerald-700 shrink-0">
                    receipt_long
                  </span>
                  <span>Cek Antrean &amp; Nota</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigateTo('katalog');
                    setStudentSubTab('favorit');
                  }}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-emerald-700 shrink-0">
                    favorite
                  </span>
                  <span>Menu Favorit Saya</span>
                </button>
                <button
                  type="button"
                  onClick={openJastipGuideModal}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-amber-500 shrink-0">
                    local_shipping
                  </span>
                  <span>Panduan Jastip Kelas</span>
                </button>
              </div>
            </div>

            {/* Column 3 (lg:col-span-3): Bantuan & Transparansi Kampus */}
            <div className="lg:col-span-3 flex flex-col gap-2.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">verified_user</span>
                Bantuan &amp; Pengaduan
              </h3>
              <div className="flex flex-col gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-rose-600 hover:text-rose-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-rose-500 shrink-0">
                    report_problem
                  </span>
                  <span>Laporkan Selisih Harga (Sarpras)</span>
                </button>
                <button
                  type="button"
                  onClick={openPilotConceptModal}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-emerald-700 shrink-0">
                    lightbulb
                  </span>
                  <span>Konsep Digitalisasi Kantin</span>
                </button>
                <button
                  type="button"
                  onClick={openTermsModal}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-emerald-700 shrink-0">
                    gavel
                  </span>
                  <span>Syarat &amp; Ketentuan Layanan</span>
                </button>
                <button
                  type="button"
                  onClick={openPrivacyModal}
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-emerald-700 shrink-0">
                    security
                  </span>
                  <span>Kebijakan Privasi Mahasiswa</span>
                </button>
                <a
                  href="https://wa.me/6281299887766"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] py-1 flex items-center gap-2 text-slate-600 hover:text-emerald-700 transition-colors text-left cursor-pointer group font-medium"
                >
                  <span className="material-symbols-outlined text-[17px] text-emerald-600 shrink-0">
                    chat
                  </span>
                  <span>Hotline BAAK &amp; Kantin Kampus</span>
                </a>
              </div>
            </div>

            {/* Column 4 (lg:col-span-3): Keamanan Pembayaran & Akses Portal */}
            <div className="lg:col-span-3 flex flex-col gap-3.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">lock</span>
                Standar Pembayaran &amp; Portal
              </h3>

              {/* Payment Methods Badges */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Metode Resmi yang Didukung:</span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-bold text-slate-700">
                    QRIS Nasional
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-medium text-slate-700">
                    GoPay / OVO
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-medium text-slate-700">
                    ShopeePay / DANA
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-medium text-slate-700">
                    Tunai di Kasir
                  </span>
                </div>
              </div>

              {/* Official Portals */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-200/60">
                <span className="text-[11px] text-slate-500 font-medium">Akses Mitra Stan:</span>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentScreen('auth-portal')}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-emerald-700 flex items-center justify-between text-xs font-semibold transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-emerald-600">
                        storefront
                      </span>
                      <span>Portal Masuk Pemilik Stan</span>
                    </div>
                    <span className="material-symbols-outlined text-[15px] text-slate-400 group-hover:translate-x-0.5 transition-transform">
                      arrow_forward
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Copyright, Legal Micro-Links & Campus Transparency Tagline */}
          <div className="pt-5 sm:pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className="font-medium text-slate-700">© {new Date().getFullYear()} Unifood</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Institut Bisnis dan Informatika Kwik Kian Gie</span>
            </div>

            <div className="flex items-center justify-center sm:justify-end gap-3 text-[11px] text-slate-500 flex-wrap">
              <button
                type="button"
                onClick={openPrivacyModal}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                Kebijakan Privasi
              </button>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <button
                type="button"
                onClick={openTermsModal}
                className="hover:text-emerald-700 transition-colors cursor-pointer"
              >
                Syarat Layanan
              </button>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="hover:text-rose-600 transition-colors cursor-pointer font-medium text-rose-600/90"
              >
                Laporkan Kendala
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* NAVIGATION DRAWER MODAL - MODERN CLEAN MOBILE SHEET */}
      {navDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-xl sm:rounded-xl p-5 sm:p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto border border-slate-200 animate-in slide-in-from-bottom duration-300">
            {/* Header Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <UnifoodLogo size="md" subtitleText="Menu & Navigasi" />
              <button
                type="button"
                onClick={() => setNavDrawerOpen(false)}
                className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer shrink-0 transition-colors border border-slate-200/80"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Active Session Status Card */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    loggedInSeller || isAdminLoggedIn || loggedInStudent
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
                      : loggedInStudent
                      ? `${loggedInStudent.name} (${loggedInStudent.nim})`
                      : 'Tamu / Pengunjung'}
                  </span>
                  {loggedInSeller && (
                    <span className="text-[11px] text-emerald-800 font-medium truncate">
                      {loggedInSeller.email}
                    </span>
                  )}
                  {loggedInStudent && !loggedInSeller && (
                    <span className="text-[11px] text-emerald-800 font-medium truncate">
                      {loggedInStudent.email}
                    </span>
                  )}
                </div>
              </div>
              {(loggedInSeller || isAdminLoggedIn) ? (
                <button
                  type="button"
                  onClick={() => {
                    setNavDrawerOpen(false);
                    handleLogoutSession();
                  }}
                  className="px-3 py-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold cursor-pointer shrink-0 border border-rose-200 transition-colors"
                >
                  Keluar
                </button>
              ) : loggedInStudent ? (
                <button
                  type="button"
                  onClick={() => {
                    setNavDrawerOpen(false);
                    handleLogoutStudent();
                  }}
                  className="px-3 py-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold cursor-pointer shrink-0 border border-rose-200 transition-colors"
                >
                  Keluar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNavDrawerOpen(false);
                    setCurrentScreen('auth-portal');
                  }}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-bold cursor-pointer shrink-0 shadow-2xs"
                >
                  Masuk
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
                className={`min-h-[48px] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                  currentScreen === 'katalog'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">storefront</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">
                      Katalog Menu
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
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                    currentScreen === 'kelola-menu'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200'
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
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                    currentScreen === 'admin-portal'
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200'
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
                className={`min-h-[48px] px-3.5 py-2.5 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer ${
                  currentScreen === 'auth-portal'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200'
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
                className="min-h-[44px] px-3.5 py-2 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer bg-rose-50 hover:bg-rose-100/70 text-rose-700 border border-rose-200 mt-1"
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
            className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto border border-slate-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold">
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
                className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer transition-colors border border-slate-200/80"
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
                className="h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                className="h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                className="h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-emerald-700 font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="h-11 px-3.5 rounded-lg bg-slate-50 border border-rose-200 text-rose-700 font-bold text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
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
                className="h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                )}
                <label className="min-h-[42px] px-3.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 cursor-pointer w-full justify-center transition-colors">
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
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="w-1/2 min-h-[44px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200/80"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-1/2 min-h-[44px] rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer"
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
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 max-h-[90dvh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-black text-slate-900">{infoModal.title}</h4>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="w-8 h-8 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer transition-colors border border-slate-200/80"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">{infoModal.content}</div>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="w-full min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold mt-1 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL NOTIFICATION TOAST - BEN SHNEIDERMAN: INFORMATIVE FEEDBACK & REVERSAL OF ACTIONS (UNDO) */}
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 left-4 right-4 max-w-md mx-auto z-[80] bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-lg shadow-2xl flex items-center justify-between gap-3 transition-all duration-300 border border-slate-800 ${
          toast.visible
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-16 opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
              toast.isError
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {toast.isError ? 'warning' : 'check_circle'}
            </span>
          </div>
          <span className="text-xs font-semibold leading-tight text-slate-100">{toast.message}</span>
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              setToast((prev) => ({ ...prev, visible: false }));
            }}
            className="px-3 py-1.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shrink-0 transition-transform active:scale-95 shadow-sm cursor-pointer"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      </div>
    </APIProvider>
  );
}
