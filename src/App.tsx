import React, { useEffect, useState } from 'react';
import {
  INITIAL_SELLER_ACCOUNTS,
  INITIAL_STALLS,
  INITIAL_VERIFICATIONS,
  MenuItem,
  ReviewItem,
  SellerAccount,
  Stall,
  VerificationRequest,
} from './data/kantinData';
import { AuthPortalScreen } from './components/AuthPortalScreen';
import { KatalogScreen, StudentSubTab } from './components/KatalogScreen';
import { DetailStanScreen } from './components/DetailStanScreen';
import { KelolaMenuScreen } from './components/KelolaMenuScreen';
import { AdminPortalScreen } from './components/AdminPortalScreen';

export type ScreenType =
  | 'auth-portal'
  | 'katalog'
  | 'detail-stan'
  | 'kelola-menu'
  | 'admin-portal';

const STORAGE_KEYS = {
  SELLER_SESSION: 'kantinku_ibikkg_seller_session_v1',
  ADMIN_SESSION: 'kantinku_ibikkg_admin_session_v1',
  SELLER_ACCOUNTS: 'kantinku_ibikkg_seller_accounts_v1',
  STALLS: 'kantinku_ibikkg_stalls_v1',
  VERIFICATIONS: 'kantinku_ibikkg_verifications_v1',
};

export default function App() {
  // Load persistent accounts & data from localStorage
  const [sellerAccounts, setSellerAccounts] = useState<SellerAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SELLER_ACCOUNTS);
      return saved ? JSON.parse(saved) : INITIAL_SELLER_ACCOUNTS;
    } catch {
      return INITIAL_SELLER_ACCOUNTS;
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

  // If seller is already logged in from a previous visit (belum keluar dari akunnya),
  // automatically open Dashboard Penjual without asking them to login again!
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    try {
      const savedSeller = localStorage.getItem(STORAGE_KEYS.SELLER_SESSION);
      if (savedSeller) return 'kelola-menu';
      const savedAdmin = localStorage.getItem(STORAGE_KEYS.ADMIN_SESSION);
      if (savedAdmin === 'true') return 'admin-portal';
    } catch {
      // ignore storage errors
    }
    return 'auth-portal';
  });

  const [studentSubTab, setStudentSubTab] = useState<StudentSubTab>('beranda');
  const [historyStack, setHistoryStack] = useState<ScreenType[]>([]);
  const [selectedStallId, setSelectedStallId] = useState<string>('stan-bu-sari');
  const [favoriteStallIds, setFavoriteStallIds] = useState<string[]>(['stan-bu-sari']);

  const [stalls, setStalls] = useState<Stall[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STALLS);
      return saved ? JSON.parse(saved) : INITIAL_STALLS;
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

  // Persist sessions & data changes automatically to localStorage
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

  // Report Form State
  const [reportStallName, setReportStallName] = useState('Kantin Berkah Barokah (Stan B-01)');
  const [reportMenuName, setReportMenuName] = useState('');
  const [reportCatalogPrice, setReportCatalogPrice] = useState('5000');
  const [reportChargedPrice, setReportChargedPrice] = useState('6000');
  const [reportNim, setReportNim] = useState('');
  const [reportNote, setReportNote] = useState('');

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
      location: `${createdAccount.building} • ${createdAccount.locationDetail}`,
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

    setSellerAccounts((prev) => [...prev, createdAccount]);
    setVerifications((prev) => [newVerificationCard, ...prev]);

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

  // Handlers for Merchant Screen (Operates on whichever seller is logged in!)
  const handleToggleStoreOpen = () => {
    setStalls((prev) =>
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

  const handleToggleMenuStatus = (itemId: string) => {
    setStalls((prev) =>
      prev.map((stall) => {
        if (stall.id === activeMerchantStallId) {
          const updatedMenu = stall.menuItems.map((item) => {
            if (item.id === itemId) {
              const nextStatus: 'ready' | 'habis' =
                item.status === 'habis' ? 'ready' : 'habis';
              showToast(
                `${item.name} ${
                  nextStatus === 'ready' ? 'sekarang 🟢 Tersedia' : 'ditandai 🔴 Habis'
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
    setStalls((prev) =>
      prev.map((stall) => {
        if (stall.id === activeMerchantStallId) {
          const updatedMenu = stall.menuItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  price: newPrice,
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
    setStalls((prev) =>
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
    setStalls((prev) =>
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
    setStalls((prev) =>
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
    setStalls((prev) =>
      prev.map((stall) =>
        stall.id === activeMerchantStallId ? { ...stall, ...updated } : stall
      )
    );
  };

  const handleReplyReview = (reviewId: string, replyText: string) => {
    setStalls((prev) =>
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
    const newRev: ReviewItem = {
      id: `rev-${Date.now()}`,
      studentName,
      majorAndYear,
      rating,
      date: '8 Oktober 2026',
      comment,
    };
    setStalls((prev) =>
      prev.map((stall) =>
        stall.id === stallId
          ? {
              ...stall,
              reviews: [newRev, ...stall.reviews],
              reviewCount: stall.reviewCount + 1,
            }
          : stall
      )
    );
    showToast('Terima kasih! Ulasan Anda telah ditampilkan di halaman kantin.');
  };

  // Handlers for Admin Screen (Approving a verification also unlocks the Seller Account and creates their Stall!)
  const handleApproveVerification = (id: string, name: string) => {
    const targetVerif = verifications.find((v) => v.id === id);

    setVerifications((prev) =>
      prev.map((v) => (v.id === id ? { ...v, approved: true } : v))
    );

    if (targetVerif?.sellerAccountId) {
      const targetAcc = sellerAccounts.find(
        (acc) => acc.id === targetVerif.sellerAccountId
      );

      setSellerAccounts((prev) =>
        prev.map((acc) =>
          acc.id === targetVerif.sellerAccountId
            ? { ...acc, status: 'approved', rejectedNote: undefined }
            : acc
        )
      );

      if (targetAcc) {
        setStalls((prev) => {
          const alreadyExists = prev.some((s) => s.id === targetAcc.stallId);
          if (alreadyExists) return prev;

          const newStall: Stall = {
            id: targetAcc.stallId,
            name: targetAcc.stallName,
            code:
              targetAcc.building === 'Gedung A'
                ? `Stan A-0${prev.length + 1}`
                : `Stan B-0${prev.length + 1}`,
            mapPinCode: targetAcc.building === 'Gedung A' ? 'Kantin A' : 'Kantin C',
            building: targetAcc.building,
            distanceMeters: targetAcc.building === 'Gedung A' ? 95 : 190,
            locationDetail: targetAcc.locationDetail,
            fullLocation: `${targetAcc.building}, ${targetAcc.locationDetail}`,
            walkingGuide: `Sekitar 1–2 menit jalan kaki menuju ${targetAcc.locationDetail}.`,
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
          return [newStall, ...prev];
        });
      }
    }

    showToast(
      `Akun & Stan "${name}" disetujui! Penjual kini dapat login ke Dashboard Penjual.`
    );
  };

  const handleRejectVerification = (id: string, name: string, note: string) => {
    const targetVerif = verifications.find((v) => v.id === id);

    setVerifications((prev) =>
      prev.map((v) => (v.id === id ? { ...v, rejectedReason: note } : v))
    );

    if (targetVerif?.sellerAccountId) {
      setSellerAccounts((prev) =>
        prev.map((acc) =>
          acc.id === targetVerif.sellerAccountId
            ? { ...acc, status: 'rejected', rejectedNote: note }
            : acc
        )
      );
    }

    showToast(`Pemberitahuan revisi dikirimkan ke mitra "${name}": "${note}"`);
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReportModalOpen(false);
    showToast(
      'Laporan ketidaksesuaian tarif berhasil dikirim ke Biro Sarpras & BAAK!'
    );
    setReportMenuName('');
    setReportNote('');
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

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen w-full antialiased relative">
      {/* SINGLE COMPACT STICKY HEADER */}
      <header className="sticky top-0 left-0 right-0 w-full z-40 bg-surface/95 backdrop-blur-xl border-b border-outline-variant/30 pt-safe">
        <div className="max-w-7xl mx-auto h-14 sm:h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          {/* Left Zone: Brand Identity */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setCurrentScreen('katalog')}
              className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-headline-md text-headline-md font-bold shrink-0 shadow-xs">
                K
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-headline-md text-[17px] sm:text-headline-md text-on-surface leading-none tracking-tight truncate">
                    KantinKu IBI KKG
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Center Zone: Navigation on Desktop (lg+) */}
          <nav
            aria-label="Pilih Halaman & Peran"
            className="hidden lg:flex items-center gap-1.5 bg-surface-container p-1 rounded-xl"
          >
            <button
              type="button"
              onClick={() => navigateTo('katalog')}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                currentScreen === 'katalog' || currentScreen === 'detail-stan'
                  ? 'bg-primary text-on-primary font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">map</span>
              <span>Katalog &amp; Peta Kantin</span>
            </button>

            {loggedInSeller && (
              <button
                type="button"
                onClick={() => navigateTo('kelola-menu')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  currentScreen === 'kelola-menu'
                    ? 'bg-primary text-on-primary font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">storefront</span>
                <span>Dashboard Penjual ({loggedInSeller.stallName})</span>
              </button>
            )}

            {isAdminLoggedIn && (
              <button
                type="button"
                onClick={() => navigateTo('admin-portal')}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  currentScreen === 'admin-portal'
                    ? 'bg-primary text-on-primary font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
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
              className={`min-h-[38px] px-3 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                currentScreen === 'auth-portal'
                  ? 'bg-primary text-on-primary font-semibold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">login</span>
              <span>
                {loggedInSeller || isAdminLoggedIn ? 'Pindah Peran / Akun' : 'Portal Login Mitra'}
              </span>
            </button>
          </nav>

          {/* Right Zone: Active Session Badge / Login Button + Compact Icon Menu Button */}
          <div className="flex items-center gap-2 shrink-0">
            {loggedInSeller || isAdminLoggedIn ? (
              <div className="hidden sm:flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1.5 rounded-lg border border-outline-variant/25">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                <span className="font-label-sm text-label-sm text-on-surface max-w-[140px] truncate">
                  {loggedInSeller ? loggedInSeller.stallName : 'Admin Sarpras'}
                </span>
                <button
                  type="button"
                  onClick={handleLogoutSession}
                  className="ml-1 text-error hover:underline font-label-sm text-[11px] font-semibold cursor-pointer"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentScreen('auth-portal')}
                className={`hidden sm:inline-flex min-h-[40px] px-3 rounded-lg font-label-sm text-label-sm items-center gap-1.5 transition-colors cursor-pointer ${
                  currentScreen === 'auth-portal'
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'bg-surface-container-low text-primary hover:bg-surface-container-high font-semibold'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                <span>Login / Daftar</span>
              </button>
            )}

            <button
              aria-label="Buka Menu Navigasi & Peran"
              onClick={() => setNavDrawerOpen(true)}
              className="w-11 h-11 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-colors cursor-pointer active:scale-95"
              type="button"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex flex-col relative w-full bg-surface flex-grow">
        {currentScreen === 'auth-portal' && (
          <AuthPortalScreen
            sellerAccounts={sellerAccounts}
            loggedInSeller={loggedInSeller}
            isAdminLoggedIn={isAdminLoggedIn}
            onContinueAsStudent={handleContinueAsStudent}
            onLoginSellerSuccess={handleLoginSellerSuccess}
            onRegisterSeller={handleRegisterSeller}
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
            activeSubTab={studentSubTab}
            onChangeSubTab={setStudentSubTab}
            favoriteStallIds={favoriteStallIds}
            onToggleFavoriteStall={toggleFavoriteStall}
            onSelectStall={(stallId) => navigateTo('detail-stan', stallId)}
            onNavigateMerchant={() => navigateTo('kelola-menu')}
            onNavigateAdmin={() => navigateTo('admin-portal')}
            onOpenReportModal={() => setReportModalOpen(true)}
            onOpenInfoModal={(title, content) => setInfoModal({ title, content })}
          />
        )}

        {currentScreen === 'detail-stan' && (
          <DetailStanScreen
            stall={activeStall}
            isFavorite={favoriteStallIds.includes(activeStall.id)}
            onToggleFavorite={() => toggleFavoriteStall(activeStall.id)}
            onAddReview={handleAddStudentReview}
            onBackToKatalog={() => navigateTo('katalog')}
            onOpenReportModal={() => {
              setReportStallName(`${activeStall.name} (${activeStall.code})`);
              setReportModalOpen(true);
            }}
          />
        )}

        {currentScreen === 'kelola-menu' && (
          <KelolaMenuScreen
            stall={currentMerchantStall}
            sellerEmail={loggedInSeller?.email}
            onLogoutSeller={handleLogoutSession}
            onToggleStoreOpen={handleToggleStoreOpen}
            onToggleMenuStatus={handleToggleMenuStatus}
            onUpdateMenuPrice={handleUpdateMenuPrice}
            onAddMenuItem={handleAddMenuItem}
            onEditMenuItem={handleEditMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            onUpdateStallProfile={handleUpdateStallProfile}
            onReplyReview={handleReplyReview}
            onShowToast={(msg) => showToast(msg, false)}
          />
        )}

        {currentScreen === 'admin-portal' && (
          <AdminPortalScreen
            verifications={verifications}
            onApproveVerification={handleApproveVerification}
            onRejectVerification={handleRejectVerification}
            onShowToast={showToast}
            onOpenNavDrawer={() => {
              setNavDrawerOpen(true);
            }}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-surface-container-low border-t border-outline-variant/25 text-on-surface-variant pb-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="font-label-md text-label-md text-on-surface font-bold">
                KantinKu IBI KKG • Pilot Project Tahap 1
              </span>
              <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-md">
                Aktif
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Platform digital khusus kantin Institut Bisnis dan Informatika Kwik Kian Gie (Sunter) untuk transparansi harga, lokasi, dan pengelolaan menu langsung oleh penjual kantin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentScreen('auth-portal')}
              className="min-h-[40px] font-label-sm text-label-sm text-primary font-semibold hover:underline cursor-pointer"
            >
              Portal Login &amp; Registrasi Mitra
            </button>
            <span className="text-outline-variant">•</span>
            <button
              type="button"
              onClick={openPilotConceptModal}
              className="min-h-[40px] font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              Konsep Tahap 1
            </button>
            <span className="text-outline-variant">•</span>
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="min-h-[40px] font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              Lapor Harga
            </button>
          </div>
        </div>
      </footer>

      {/* NAVIGATION DRAWER MODAL */}
      {navDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 w-full max-w-sm shadow-xl flex flex-col gap-3.5 max-h-[90dvh] overflow-y-auto border border-outline-variant/25">
            {/* Header Drawer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center font-headline-md font-bold shrink-0">
                  K
                </div>
                <div className="flex flex-col min-w-0">
                  <h4 className="fluid-headline-md text-on-surface leading-none truncate">
                    Menu &amp; Akun
                  </h4>
                  <span className="font-label-sm text-label-sm text-on-surface-variant mt-1 truncate">
                    KantinKu IBI KKG
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNavDrawerOpen(false)}
                className="w-10 h-10 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Active Session Status Card */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    loggedInSeller || isAdminLoggedIn
                      ? 'bg-secondary'
                      : 'bg-outline'
                  }`}
                ></span>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Sesi Saat Ini
                  </span>
                  <span className="font-label-md text-label-md text-on-surface font-bold truncate">
                    {loggedInSeller
                      ? loggedInSeller.stallName
                      : isAdminLoggedIn
                      ? 'Admin Sarpras IBI KKG'
                      : 'Mahasiswa / Pengunjung'}
                  </span>
                  {loggedInSeller && (
                    <span className="text-[11px] text-on-surface-variant truncate">
                      {loggedInSeller.email} (Tersimpan otomatis)
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
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold cursor-pointer shrink-0 hover:bg-error hover:text-on-primary transition-colors"
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
                className={`min-h-[52px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                  currentScreen === 'katalog'
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">map</span>
                  <div className="min-w-0">
                    <div className="font-label-md text-label-md">
                      Katalog &amp; Peta Kantin
                    </div>
                    <div
                      className={`font-body-sm text-[11px] truncate ${
                        currentScreen === 'katalog'
                          ? 'text-on-primary/85'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      Halaman utama mahasiswa (tanpa login)
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
                  className={`min-h-[52px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                    currentScreen === 'kelola-menu'
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                      storefront
                    </span>
                    <div className="min-w-0">
                      <div className="font-label-md text-label-md">
                        Dashboard Penjual Saya
                      </div>
                      <div
                        className={`font-body-sm text-[11px] truncate ${
                          currentScreen === 'kelola-menu'
                            ? 'text-on-primary/85'
                            : 'text-on-surface-variant'
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
                  className={`min-h-[52px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                    currentScreen === 'admin-portal'
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                      admin_panel_settings
                    </span>
                    <div className="min-w-0">
                      <div className="font-label-md text-label-md">
                        Portal Admin Kampus
                      </div>
                      <div
                        className={`font-body-sm text-[11px] truncate ${
                          currentScreen === 'admin-portal'
                            ? 'text-on-primary/85'
                            : 'text-on-surface-variant'
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
                className={`min-h-[52px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                  currentScreen === 'auth-portal'
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[20px] shrink-0">
                    login
                  </span>
                  <div className="min-w-0">
                    <div className="font-label-md text-label-md">
                      {loggedInSeller || isAdminLoggedIn
                        ? 'Ganti Peran / Pindah Akun'
                        : 'Login / Daftar Mitra Kantin'}
                    </div>
                    <div
                      className={`font-body-sm text-[11px] truncate ${
                        currentScreen === 'auth-portal'
                          ? 'text-on-primary/85'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      Akses khusus Penjual Kantin &amp; Admin Kampus
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] shrink-0">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT PRICE DISCREPANCY MODAL */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 w-full max-w-md shadow-xl flex flex-col gap-3 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-error">
                <span className="material-symbols-outlined text-[20px]">gavel</span>
                <h4 className="fluid-headline-md text-on-surface">
                  Lapor Ketidaksesuaian Harga
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">
                Kantin Terlapor
              </label>
              <select
                value={reportStallName}
                onChange={(e) => setReportStallName(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
              >
                {stalls.map((s) => (
                  <option key={s.id} value={`${s.name} (${s.code})`}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">
                Nama Makanan / Minuman
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Es Jeruk Peras / Nasi Goreng"
                value={reportMenuName}
                onChange={(e) => setReportMenuName(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Harga di Website (Rp)
                </label>
                <input
                  type="number"
                  required
                  value={reportCatalogPrice}
                  onChange={(e) => setReportCatalogPrice(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-secondary font-label-md text-label-md focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Harga di Kasir (Rp)
                </label>
                <input
                  type="number"
                  required
                  value={reportChargedPrice}
                  onChange={(e) => setReportChargedPrice(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-error font-label-md text-label-md focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">
                NIM Mahasiswa Pelapor
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 32230104"
                value={reportNim}
                onChange={(e) => setReportNim(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">
                Keterangan Singkat
              </label>
              <textarea
                rows={2}
                placeholder="Catatan singkat untuk diverifikasi Admin..."
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                className="p-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="w-1/2 min-h-[44px] rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-1/2 min-h-[44px] rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer"
              >
                Kirim Laporan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GENERIC INFO MODAL */}
      {infoModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 w-full max-w-md shadow-xl flex flex-col gap-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="fluid-headline-md text-on-surface">{infoModal.title}</h4>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div>{infoModal.content}</div>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="w-full min-h-[44px] rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold mt-1 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL NOTIFICATION TOAST */}
      <div
        className={`fixed bottom-6 left-4 right-4 max-w-md mx-auto z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 transition-all duration-300 ${
          toast.visible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] shrink-0 ${
            toast.isError ? 'text-error' : 'text-secondary-fixed'
          }`}
        >
          {toast.isError ? 'warning' : 'check_circle'}
        </span>
        <span className="font-label-md text-label-md flex-grow">{toast.message}</span>
      </div>
    </div>
  );
}
