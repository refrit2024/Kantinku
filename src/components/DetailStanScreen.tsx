import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  FulfillmentType,
  getPublicStallUrl,
  getStallPaymentDetails,
  MenuItem,
  normalizeStallLocation,
  OrderItem,
  OrderStatusType,
  OrderTransaction,
  PaymentMethodType,
  Stall,
} from '../data/kantinData';
import { StallQrModal } from './StallQrModal';
import { OrderReceiptModal } from './OrderReceiptModal';
import {
  checkActionCooldown,
  isValidPersonName,
  isValidStudentNim,
  PRICE_BOUNDS,
} from '../utils/securityGuard';
import { StudentAccount } from '../data/kantinData';

interface DetailStanScreenProps {
  stall: Stall;
  orders: OrderTransaction[];
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onPlaceOrder: (
    orderData: Omit<OrderTransaction, 'id' | 'status' | 'createdAt'>
  ) => OrderTransaction;
  onUpdateOrderStatus?: (
    orderId: string,
    nextStatus: OrderStatusType,
    rejectionReason?: string
  ) => void;
  onAddReview: (
    stallId: string,
    studentName: string,
    majorAndYear: string,
    rating: number,
    comment: string
  ) => void;
  onBackToKatalog: () => void;
  onOpenReportModal: () => void;
  loggedInStudent?: StudentAccount | null;
  onShowToast?: (
    message: string,
    isError?: boolean,
    action?: { label: string; onClick: () => void }
  ) => void;
}

export const DetailStanScreen: React.FC<DetailStanScreenProps> = ({
  stall: rawStall,
  orders,
  isFavorite,
  onToggleFavorite,
  onPlaceOrder,
  onAddReview,
  onBackToKatalog,
  onOpenReportModal,
  loggedInStudent = null,
  onShowToast,
}) => {
  const stall = normalizeStallLocation(rawStall);
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'makanan' | 'minuman' | 'snack'
  >('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  // Shopping Cart & Direct-to-Merchant Checkout State
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [studentName, setStudentName] = useState(() => {
    if (loggedInStudent?.name) return loggedInStudent.name;
    try {
      return localStorage.getItem('kantinku_student_name_v1') || '';
    } catch {
      return '';
    }
  });
  const [studentNim, setStudentNim] = useState(() => {
    if (loggedInStudent?.nim) return loggedInStudent.nim;
    try {
      return localStorage.getItem('kantinku_student_nim_v1') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (loggedInStudent) {
      setStudentName(loggedInStudent.name);
      setStudentNim(loggedInStudent.nim);
    }
  }, [loggedInStudent]);

  const [pickupTime, setPickupTime] = useState('Istirahat Siang (12.00 WIB)');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('pickup');
  const [tableNumber, setTableNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Jastip Antar-Lantai & Micro-Location State
  const [deliveryBuilding, setDeliveryBuilding] = useState('Gedung A');
  const [deliveryFloor, setDeliveryFloor] = useState('Lantai 4 (Perpustakaan & Lounge)');
  const [deliveryRoom, setDeliveryRoom] = useState('R. 402');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [preOrderSlot, setPreOrderSlot] = useState('Sekarang (Langsung Masak 15-20 mnt)');
  const [isGroupOrder, setIsGroupOrder] = useState(false);
  const [splitBillCount, setSplitBillCount] = useState(3);
  const [himaVoucherInput, setHimaVoucherInput] = useState('');
  const [himaDiscountApplied, setHimaDiscountApplied] = useState(0);
  const [himaVoucherMsg, setHimaVoucherMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodType>('qris');
  const [selectedEwalletProvider, setSelectedEwalletProvider] = useState<
    'DANA' | 'GoPay' | 'OVO' | 'ShopeePay'
  >('ShopeePay');
  const [paymentReference, setPaymentReference] = useState('');

  // Payment Gateway Sandbox (Midtrans Snap Simulation) State
  const [snapGatewayOpen, setSnapGatewayOpen] = useState(false);
  const [snapChannel, setSnapChannel] = useState<
    'qris_snap' | 'gopay_dana' | 'bca_va' | 'mandiri_va'
  >('qris_snap');
  const [snapStep, setSnapStep] = useState<'select' | 'processing' | 'success'>('select');
  const [snapTxId, setSnapTxId] = useState('MID-IBIKKG-882910');
  const [receiptOrder, setReceiptOrder] = useState<OrderTransaction | null>(null);

  // 8 Golden Rules: Universal Usability & Internal Locus of Control (Escape Key closes any open modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (snapGatewayOpen) {
          setSnapGatewayOpen(false);
        } else if (checkoutModalOpen) {
          setCheckoutModalOpen(false);
        } else if (isQrModalOpen) {
          setIsQrModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snapGatewayOpen, checkoutModalOpen, isQrModalOpen]);

  const PLATFORM_SERVICE_FEE = 1000;
  const paymentConfig = getStallPaymentDetails(stall);
  const [stallQrDataUrl, setStallQrDataUrl] = useState<string>('');
  const [paymentQrisDataUrl, setPaymentQrisDataUrl] = useState<string>('');
  const [isOpenedFromQrScan, setIsOpenedFromQrScan] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('stan') || params.get('stall'));
  });

  // 8 Golden Rules: Rule 6 (Permit easy reversal of actions - Undo) & Rule 5 (Prevent errors)
  const updateCartQty = (item: MenuItem, delta: number) => {
    if (item.status !== 'ready' && delta > 0) return;
    setCartQuantities((prev) => {
      const currentQty = prev[item.id] || 0;
      if (delta > 0 && currentQty >= PRICE_BOUNDS.MAX_QTY_PER_ITEM) {
        if (onShowToast) {
          onShowToast(
            `Batas aman pesanan adalah maksimal ${PRICE_BOUNDS.MAX_QTY_PER_ITEM} porsi per menu.`,
            true
          );
        }
        return prev;
      }
      const nextQty = Math.max(0, Math.min(PRICE_BOUNDS.MAX_QTY_PER_ITEM, currentQty + delta));
      const copy = { ...prev };
      if (nextQty === 0) {
        delete copy[item.id];
        if (currentQty > 0 && onShowToast) {
          onShowToast(
            `"${item.name}" dikeluarkan dari keranjang`,
            false,
            {
              label: 'Urungkan',
              onClick: () => {
                setCartQuantities((revertState) => ({
                  ...revertState,
                  [item.id]: currentQty,
                }));
                onShowToast(`"${item.name}" dikembalikan ke keranjang!`);
              },
            }
          );
        }
      } else {
        copy[item.id] = nextQty;
      }
      return copy;
    });
  };

  const handleResetCart = () => {
    const backup = { ...cartQuantities };
    const totalCount = Object.values(backup).reduce((a, b) => a + b, 0);
    if (totalCount === 0) return;
    setCartQuantities({});
    if (onShowToast) {
      onShowToast(
        `Keranjang belanja (${totalCount} porsi) dikosongkan`,
        false,
        {
          label: 'Urungkan',
          onClick: () => {
            setCartQuantities(backup);
            onShowToast('Keranjang belanja berhasil dipulihkan!');
          },
        }
      );
    }
  };

  const safeMenuItems = Array.isArray(stall.menuItems) ? stall.menuItems : [];

  const cartItems: OrderItem[] = safeMenuItems
    .filter((m) => (cartQuantities[m.id] || 0) > 0)
    .map((m) => ({
      menuItemId: m.id,
      name: m.name,
      price: m.price,
      quantity: cartQuantities[m.id],
    }));

  const cartTotalItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartSubtotalAmount = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const JASTIP_RUNNER_FEE = 2500;
  const activeJastipFee = fulfillmentType === 'jastip_lantai' ? JASTIP_RUNNER_FEE : 0;
  const activeServiceFee = selectedPaymentMethod === 'tunai' ? 0 : PLATFORM_SERVICE_FEE;
  const rawSubtotal = cartSubtotalAmount + activeServiceFee + activeJastipFee;
  const cartTotalAmount = Math.max(0, rawSubtotal - himaDiscountApplied);
  const splitBillPerPerson =
    isGroupOrder && splitBillCount > 1
      ? Math.ceil(cartTotalAmount / splitBillCount)
      : cartTotalAmount;

  useEffect(() => {
    let mounted = true;
    const stallUrl = getPublicStallUrl(stall.id);

    QRCode.toDataURL(stallUrl, {
      width: 360,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (mounted) setStallQrDataUrl(url);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [stall.id]);

  useEffect(() => {
    let mounted = true;
    const safeMerchant = (paymentConfig.qrisMerchantName || stall.name || 'KANTINKU').slice(
      0,
      24
    );
    const safeNmid = paymentConfig.qrisNmid || 'ID2026001018829';
    const qrisPayload = `00020101021226660016ID.CO.QRIS.WWW011893600914${safeNmid}520458125303360540${cartTotalAmount || 15000}5802ID5925${safeMerchant}6013JAKARTA UTARA6304A1B2`;
    QRCode.toDataURL(qrisPayload, {
      width: 360,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (mounted) setPaymentQrisDataUrl(url);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [paymentConfig.qrisNmid, paymentConfig.qrisMerchantName, stall.name, cartTotalAmount]);

  const handleCopyText = (text: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2500);
    if (onShowToast) {
      onShowToast(`${label} (${text}) berhasil disalin!`, false);
    }
  };

  const completeOrderPlacement = (
    providerLabel: string,
    refNote: string,
    payStatus: 'paid_gateway' | 'manual_verification' | 'cash_on_pickup',
    txId?: string
  ) => {
    const isDineIn = fulfillmentType === 'dine_in';
    const isJastip = fulfillmentType === 'jastip_lantai';
    const cleanTable = tableNumber.trim();
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    const createdOrder = onPlaceOrder({
      stallId: stall.id,
      stallName: stall.name,
      stallLocation: stall.fullLocation,
      studentId: loggedInStudent ? loggedInStudent.id : undefined,
      studentEmail: loggedInStudent ? loggedInStudent.email : undefined,
      studentName: studentName.trim(),
      studentNim: studentNim.trim(),
      fulfillmentType,
      tableNumber: isDineIn ? cleanTable : undefined,
      pickupTime: isDineIn
        ? `Makan di Meja ${cleanTable || 'Kantin'}`
        : isJastip
        ? `Jastip Mahasiswa • ${preOrderSlot}`
        : pickupTime,
      campusName: stall.campusName || 'Institut Bisnis dan Informatika Kwik Kian Gie (IBI KKG)',
      deliveryBuilding: isJastip ? deliveryBuilding : undefined,
      deliveryFloor: isJastip ? deliveryFloor : undefined,
      deliveryRoom: isJastip ? deliveryRoom.trim() : undefined,
      deliveryNotes: isJastip ? deliveryNotes.trim() : undefined,
      jastipFee: isJastip ? JASTIP_RUNNER_FEE : 0,
      convenienceFee: activeServiceFee,
      runnerPinCode: isJastip ? pin : undefined,
      runnerStatus: isJastip ? 'waiting_runner' : undefined,
      preOrderSlot: isJastip ? preOrderSlot : undefined,
      isGroupOrder: isGroupOrder,
      splitBillCount: isGroupOrder ? splitBillCount : undefined,
      splitBillPerPerson: isGroupOrder ? splitBillPerPerson : undefined,
      himaVoucherCode: himaDiscountApplied > 0 ? himaVoucherInput.trim().toUpperCase() : undefined,
      himaDiscount: himaDiscountApplied,
      notes: orderNotes.trim() || undefined,
      items: cartItems,
      subtotalAmount: cartSubtotalAmount,
      serviceFee: activeServiceFee,
      totalAmount: cartTotalAmount,
      paymentMethod: selectedPaymentMethod,
      paymentProviderLabel: providerLabel,
      paymentReference: refNote,
      paymentStatus: payStatus,
      paymentGatewayTxId: txId,
    });

    setCartQuantities({});
    setOrderNotes('');
    setTableNumber('');
    setDeliveryNotes('');
    setPaymentReference('');
    setCheckoutModalOpen(false);
    setSnapGatewayOpen(false);
    setSnapStep('select');
    setReceiptOrder(createdOrder);
  };

  const handleApplyHimaVoucher = () => {
    const code = himaVoucherInput.trim().toUpperCase();
    if (!code) {
      setHimaVoucherMsg({ text: 'Masukkan kode kupon HIMA / Organisasi Kampus.', isError: true });
      return;
    }
    if (code === 'HIMA2026' || code === 'BEMPEDULI' || code === 'STUDENTPREP' || code === 'UNIFOOD5K') {
      const discount = 5000;
      setHimaDiscountApplied(discount);
      setHimaVoucherMsg({ text: `Kupon ${code} Aktif! Potongan Rp 5.000 berhasil diterapkan.`, isError: false });
    } else {
      setHimaVoucherMsg({ text: `Kode kupon '${code}' tidak valid atau kedaluwarsa.`, isError: true });
    }
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0 || !studentName.trim() || !studentNim.trim()) return;

    if (fulfillmentType === 'dine_in' && !tableNumber.trim()) {
      if (onShowToast) {
        onShowToast('Silakan isi Nomor Meja Anda untuk layanan Makan di Tempat (Dine-In).', true);
      }
      return;
    }

    if (fulfillmentType === 'jastip_lantai' && !deliveryRoom.trim()) {
      if (onShowToast) {
        onShowToast('Silakan isi Nomor Ruang Kelas / Titik Temu di lantai untuk layanan Jastip Mahasiswa.', true);
      }
      return;
    }

    const cd = checkActionCooldown('place_order');
    if (!cd.allowed) {
      if (onShowToast) {
        onShowToast(
          `Anti-Spam Aktif: Mohon tunggu ${cd.remainingSeconds} detik sebelum membuat pesanan berikutnya.`,
          true
        );
      }
      return;
    }

    if (!isValidPersonName(studentName)) {
      if (onShowToast) {
        onShowToast('Masukkan nama pemesan yang valid (minimal 2 huruf).', true);
      }
      return;
    }

    if (!isValidStudentNim(studentNim)) {
      if (onShowToast) {
        onShowToast(
          'Format NIM tidak valid. Masukkan 7–12 digit angka NIM Mahasiswa (contoh: 32230104).',
          true
        );
      }
      return;
    }

    try {
      localStorage.setItem('kantinku_student_name_v1', studentName.trim());
      localStorage.setItem('kantinku_student_nim_v1', studentNim.trim());
    } catch {
      // ignore
    }

    if (selectedPaymentMethod === 'tunai') {
      completeOrderPlacement(
        'COD / Bayar Tunai di Kasir Stan',
        'Bayar Tunai saat Makan di Meja / Ambil di Stan',
        'cash_on_pickup'
      );
      return;
    }

    // Online Payments (Sistem Rekber ala Shopee / Auto-Verified Gateway)
    const generatedTx = `SHOPEE-SNAP-${Date.now().toString().slice(-6)}`;
    setSnapTxId(generatedTx);
    if (selectedPaymentMethod === 'qris') {
      setSnapChannel('qris_snap');
    } else if (selectedPaymentMethod === 'ewallet') {
      setSnapChannel('gopay_dana');
    } else {
      setSnapChannel('bca_va');
    }
    setSnapStep('select');
    setSnapGatewayOpen(true);
  };

  const handleSimulateGatewaySuccess = () => {
    setSnapStep('processing');
    setTimeout(() => {
      setSnapStep('success');
      const channelName =
        snapChannel === 'qris_snap'
          ? 'QRIS Otomatis (ShopeePay / Semua Bank & E-Wallet)'
          : snapChannel === 'gopay_dana'
          ? `ShopeePay / ${selectedEwalletProvider} Instant`
          : snapChannel === 'bca_va'
          ? 'Virtual Account Bank BCA (Otomatis)'
          : 'Virtual Account Bank Mandiri (Otomatis)';

      setTimeout(() => {
        completeOrderPlacement(
          channelName,
          `LUNAS OTOMATIS (Shopee / Gateway Callback • ID: ${snapTxId})`,
          'paid_gateway',
          snapTxId
        );
      }, 1000);
    }, 850);
  };

  // Review Form State
  const [revName, setRevName] = useState('');
  const [revMajor] = useState('Manajemen 2024');
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');

  const makananCount = safeMenuItems.filter((m) => m.category === 'makanan').length;
  const minumanCount = safeMenuItems.filter((m) => m.category === 'minuman').length;
  const snackCount = safeMenuItems.filter((m) => m.category === 'snack').length;

  const visibleMenu = safeMenuItems.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revName.trim() || !revComment.trim()) return;
    onAddReview(stall.id, revName.trim(), revMajor.trim(), revRating, revComment.trim());
    setRevName('');
    setRevComment('');
    if (onShowToast) {
      onShowToast('Terima kasih! Ulasan mahasiswa berhasil ditambahkan.', false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-24 min-h-screen bg-slate-50/70">
      {/* 1. TOP BREADCRUMB & QUICK ACTIONS BAR */}
      <nav aria-label="Navigasi Halaman Stan" className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 py-2.5">
          <button
            type="button"
            onClick={onBackToKatalog}
            className="min-h-[40px] px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-emerald-700 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Kembali ke Katalog</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all border border-slate-200/80"
            >
              <span className="material-symbols-outlined text-[17px] text-emerald-600">
                qr_code_2
              </span>
              <span className="hidden sm:inline">QR Etalase</span>
            </button>

            <button
              type="button"
              onClick={onToggleFavorite}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all border ${
                isFavorite
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <span
                className="material-symbols-outlined text-[18px] text-rose-500"
                style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}
              >
                favorite
              </span>
              <span className="hidden sm:inline">
                {isFavorite ? 'Favorit' : 'Simpan'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* QR Code Modal */}
      {isQrModalOpen && (
        <StallQrModal
          stall={stall}
          onClose={() => setIsQrModalOpen(false)}
          onSimulateScan={() => setIsOpenedFromQrScan(true)}
          onShowToast={onShowToast}
        />
      )}

      {/* 2. MAIN STOREFRONT CONTAINER */}
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 flex flex-col gap-5">
        {isOpenedFromQrScan && (
          <div className="rounded-lg bg-emerald-600 text-white px-4 py-3 shadow-xs flex items-center justify-between gap-2 border border-emerald-500">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-amber-300">
                qr_code_scanner
              </span>
              <span className="text-xs sm:text-sm font-bold">
                Scan QR Berhasil! Anda berada di menu resmi {stall.name} ({stall.code})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpenedFromQrScan(false)}
              className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* 3. SHOPEEFOOD / GOJEK STYLE STOREFRONT HERO HEADER */}
        <header className="relative w-full rounded-xl overflow-hidden shadow-xs border border-stone-200 bg-white">
          {/* Banner cover */}
          <div className="relative w-full h-48 sm:h-64 bg-slate-900 overflow-hidden">
            <img
              className="w-full h-full object-cover opacity-90"
              alt={stall.bannerAlt}
              src={stall.heroImage}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-950/80 via-slate-950/20 to-black/30"></div>

            {/* Top Badges */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-md bg-emerald-600/95 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 shadow-xs border border-emerald-500/50">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                <span>{stall.isOpen ? 'Buka Sekarang' : 'Tutup'}</span>
              </span>
              <span className="px-3 py-1 rounded-md bg-black/60 backdrop-blur-md text-white text-xs font-semibold border border-white/10">
                {stall.hours} WIB
              </span>
            </div>
          </div>

          {/* Floating Profile Info Overlap */}
          <div className="p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {stall.name}
                  </h1>
                  <span
                    className="material-symbols-outlined text-[22px] text-emerald-600"
                    title={`Mitra Resmi Terverifikasi ${stall.campusName || 'Kampus'}`}
                  >
                    verified
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {stall.specialty}
                </p>
              </div>

              {/* Rating & Distance Badges */}
              <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg font-black text-sm">
                  <span className="material-symbols-outlined text-[17px] text-amber-500">
                    star
                  </span>
                  <span>{stall.rating}</span>
                  <span className="font-normal text-xs text-amber-700">
                    ({stall.reviewCount} ulasan)
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg font-bold text-xs">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">
                    location_on
                  </span>
                  <span>{stall.distanceMeters} meter</span>
                </div>
              </div>
            </div>

            {/* Price Transparency Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-4 rounded-lg bg-emerald-50/70 border border-emerald-200/80">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-700 shrink-0">
                  verified_user
                </span>
                <span className="text-xs font-semibold text-emerald-900">
                  Harga resmi dari pengelola stan: <strong>{stall.lastUpdatedDate}</strong> ({stall.lastUpdatedTime} WIB) • Bebas biaya tambahan markup.
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenReportModal}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer self-start sm:self-auto shrink-0"
              >
                Lapor Selisih Harga
              </button>
            </div>
          </div>
        </header>

        {/* 4. CONTENT GRID: MENU LIST (LEFT) & STALL INFO / REVIEWS (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: MENU ITEMS */}
          <section aria-label="Daftar Menu Stan" className="lg:col-span-8 flex flex-col gap-4 min-w-0">
            {/* Category Navigation Bar & View Mode */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: 'all', label: `Semua (${safeMenuItems.length})` },
                  { id: 'makanan', label: `Makanan (${makananCount})` },
                  { id: 'minuman', label: `Minuman (${minumanCount})` },
                  { id: 'snack', label: `Snack (${snackCount})` },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategory(cat.id as 'all' | 'makanan' | 'minuman' | 'snack')
                    }
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-md font-bold text-xs whitespace-nowrap cursor-pointer transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md shrink-0 self-end sm:self-auto border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition-all ${
                    viewMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Kartu Foto
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition-all ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tabel Ringkas
                </button>
              </div>
            </div>

            {/* MENU DISPLAY */}
            {viewMode === 'table' ? (
              <div className="bg-white rounded-lg shadow-xs overflow-x-auto border border-slate-200">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-3 px-4">Menu Makanan / Minuman</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-4 text-right">Harga</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleMenu.map((item) => {
                      const isAvailable = item.status === 'ready';
                      const inCartQty = cartQuantities[item.id] || 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <span className={`font-bold text-slate-900 block ${!isAvailable ? 'line-through text-slate-400' : ''}`}>
                              {item.name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {item.description}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-bold ${
                                isAvailable
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {isAvailable ? 'Tersedia' : 'Habis'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700 whitespace-nowrap">
                            Rp {item.price.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isAvailable ? (
                              inCartQty > 0 ? (
                                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 p-1 rounded-md border border-emerald-200">
                                  <button
                                    type="button"
                                    onClick={() => updateCartQty(item, -1)}
                                    className="w-7 h-7 rounded bg-white font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    -
                                  </button>
                                  <span className="font-bold text-xs px-1">{inCartQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateCartQty(item, 1)}
                                    className="w-7 h-7 rounded bg-emerald-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item, 1)}
                                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                                >
                                  + Tambah
                                </button>
                              )
                            ) : (
                              <span className="text-xs text-slate-400">Habis</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* 5. SHOPEEFOOD / GOJEK GRADE 2-COLUMN MENU CARD GRID - TIDY & SPACIOUS */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visibleMenu.map((item) => {
                  const isAvailable = item.status === 'ready';
                  const inCartQty = cartQuantities[item.id] || 0;

                  return (
                    <article
                      key={item.id}
                      className={`group bg-white rounded-lg p-4 shadow-xs hover:shadow-md border border-stone-200 flex flex-col justify-between transition-all duration-200 ${
                        !isAvailable ? 'opacity-75 bg-stone-50/70' : 'hover:border-emerald-300'
                      }`}
                    >
                      {/* Top Row: Information & Food Thumbnail */}
                      <div className="flex gap-3.5 items-start justify-between">
                        <div className="flex flex-col flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                              {item.category}
                            </span>
                            {isAvailable ? (
                              <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Tersedia
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-rose-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                Habis
                              </span>
                            )}
                          </div>

                          <h4
                            className={`text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2 ${
                              !isAvailable ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {item.name}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        {/* Square Food Thumbnail */}
                        <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-md overflow-hidden bg-slate-100 shrink-0 relative border border-slate-200/60 shadow-2xs">
                          <img
                            src={item.imageCatalog}
                            alt={item.altCatalog}
                            referrerPolicy="no-referrer"
                            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                              !isAvailable ? 'grayscale' : ''
                            }`}
                          />
                          {!isAvailable && (
                            <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-wider">
                              Habis
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Official Price on left, Stepper/Add Button on right */}
                      <div className="flex items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-100">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-slate-400 font-medium">Harga Resmi</span>
                          <span
                            className={`text-base sm:text-lg font-black tracking-tight tabular-nums ${
                              isAvailable ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            Rp {item.price.toLocaleString('id-ID')}
                          </span>
                        </div>

                        {/* Stepper / Add Button */}
                        {isAvailable ? (
                          inCartQty > 0 ? (
                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-900 p-1 rounded-md border border-emerald-300 shadow-2xs">
                              <button
                                type="button"
                                aria-label={`Kurangi ${item.name}`}
                                onClick={() => updateCartQty(item, -1)}
                                className="w-8 h-8 rounded bg-white hover:bg-slate-50 text-emerald-800 font-bold flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs transition-all"
                              >
                                -
                              </button>
                              <span className="font-bold text-xs min-w-[22px] text-center tabular-nums">
                                {inCartQty}
                              </span>
                              <button
                                type="button"
                                aria-label={`Tambah ${item.name}`}
                                onClick={() => updateCartQty(item, 1)}
                                className="w-8 h-8 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs transition-all"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateCartQty(item, 1)}
                              className="min-h-[38px] px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                              <span>Tambah</span>
                            </button>
                          )
                        ) : (
                          <span className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200">
                            Habis
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* RATINGS & REVIEWS SECTION */}
            <div className="bg-white rounded-lg p-4 sm:p-6 shadow-xs border border-slate-200 mt-2 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[24px]">
                    reviews
                  </span>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      Ulasan Mahasiswa &amp; Pelanggan
                    </h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {stall.campusName || 'Kantin Kampus Mitra'}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  {stall.reviewCount} Ulasan
                </span>
              </div>

              {/* Review Input Form */}
              <form onSubmit={handleReviewSubmit} className="flex flex-col gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-700">
                  Tulis Ulasan Makanan &amp; Layanan Stan:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Nama Anda (Mahasiswa / Pembeli)"
                    value={revName}
                    onChange={(e) => setRevName(e.target.value)}
                    className="h-10 px-3 rounded-md bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <select
                    value={revRating}
                    onChange={(e) => setRevRating(Number(e.target.value))}
                    className="h-10 px-3 rounded-md bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5/5) Sangat Enak &amp; Cepat</option>
                    <option value={4}>⭐⭐⭐⭐ (4/5) Enak &amp; Porsi Pas</option>
                    <option value={3}>⭐⭐⭐ (3/5) Cukup Sesuai</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Komentar Anda tentang rasa makanan atau kecepatan pembuatan..."
                    value={revComment}
                    onChange={(e) => setRevComment(e.target.value)}
                    className="flex-grow h-10 px-3 rounded-md bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs active:scale-95"
                  >
                    Kirim
                  </button>
                </div>
              </form>

              {/* Existing Reviews List */}
              <div className="flex flex-col gap-3">
                {stall.reviews && stall.reviews.length > 0 ? (
                  stall.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 rounded-md bg-slate-50 border border-slate-200 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{rev.studentName}</span>
                          <span className="text-slate-400">• {rev.majorAndYear}</span>
                        </div>
                        <div className="flex items-center text-amber-500 font-bold">
                          {'★'.repeat(rev.rating)}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600">{rev.comment}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-2">
                    Belum ada ulasan untuk stan ini. Jadilah yang pertama memberikan ulasan!
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT SIDEBAR: STALL INFO & CAMPUS GUIDE */}
          <aside aria-label="Informasi dan Lokasi Stan" className="lg:col-span-4 flex flex-col gap-4 min-w-0">
            {/* Stall Information Card */}
            <div className="bg-white p-4 sm:p-5 rounded-lg shadow-xs border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-base font-bold text-slate-900">
                  Informasi &amp; Lokasi Stan
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200/80">
                  Stan Terverifikasi
                </span>
              </div>

              {/* Kampus Asal Stan */}
              <div className="flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">
                  school
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Kampus Mitra
                  </span>
                  <span className="font-bold text-slate-900 leading-snug">
                    {stall.campusName || 'Kampus Mitra Terdaftar'}
                  </span>
                </div>
              </div>

              {/* Area & Posisi Stan */}
              <div className="flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">
                  location_on
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Area Kantin &amp; Posisi
                  </span>
                  <span className="font-bold text-slate-900">{stall.fullLocation}</span>
                  <span className="text-slate-500 mt-0.5">
                    ±{stall.distanceMeters} meter dari lobby utama
                  </span>
                </div>
              </div>

              {/* Jam Operasional Mengikuti Kampus */}
              <div className="flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">
                  schedule
                </span>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Jadwal Operasional
                  </span>
                  <span className="font-bold text-slate-900">
                    {stall.daysOpen} • {stall.hours} WIB
                  </span>
                  <span className="text-slate-500 mt-0.5">
                    {stall.isOpen ? 'Sedang buka melayani pesanan' : 'Sedang istirahat/tutup'}
                  </span>
                </div>
              </div>

              {/* Walking Guide */}
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">
                    directions_walk
                  </span>
                  Panduan Menuju Stan:
                </span>
                <p className="text-slate-600 leading-relaxed">{stall.walkingGuide}</p>
              </div>

              {/* Payment Methods Pill Badges */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-700">Metode Bayar Didukung:</span>
                <div className="flex flex-wrap gap-1.5">
                  {paymentConfig.qrisEnabled && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                      QRIS Semua Bank
                    </span>
                  )}
                  {paymentConfig.ewalletEnabled && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[11px]">
                      DANA / GoPay
                    </span>
                  )}
                  {paymentConfig.cashEnabled && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]">
                      Tunai di Stan
                    </span>
                  )}
                </div>
              </div>

              {/* QR Code Etalase Preview */}
              {stallQrDataUrl && (
                <div className="p-3 rounded-md bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-3">
                  <img
                    src={stallQrDataUrl}
                    alt={`QR Stan ${stall.name}`}
                    className="w-14 h-14 object-contain rounded-md bg-white p-1 border border-emerald-200 shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setIsQrModalOpen(true)}
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-emerald-950">
                      QR Code Menu {stall.code}
                    </span>
                    <span className="text-[11px] text-emerald-800">
                      Klik untuk memperbesar atau scan langsung untuk bagikan ke teman.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* 6. SHOPEEFOOD / GOJEK STYLE FLOATING BOTTOM CART BAR (Appears when items in cart) */}
      {cartTotalItems > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-6 sm:right-6 z-40 max-w-4xl mx-auto">
          <div className="bg-slate-900 text-white rounded-xl p-3.5 sm:p-4 shadow-2xl flex items-center justify-between gap-3 border border-slate-800 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-md shrink-0">
                <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  {cartTotalItems}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-300 font-medium">
                  {cartTotalItems} menu di {stall.name}
                </span>
                <span className="text-base sm:text-lg font-black text-white">
                  Rp {cartTotalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetCart}
                title="Kosongkan seluruh menu dari keranjang (tersedia tombol Urungkan)"
                className="hidden sm:inline-flex min-h-[42px] px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors border border-slate-700"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(true)}
                className="min-h-[46px] px-5 sm:px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/40 cursor-pointer active:scale-95 transition-all"
              >
                <span>Checkout Pesanan</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. SHOPEEFOOD-STYLE CHECKOUT SHEET / MODAL */}
      {checkoutModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setCheckoutModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
        >
          <form
            onSubmit={handleCheckoutSubmit}
            className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-lg shadow-xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto border border-slate-200"
          >
            {/* 8 Golden Rules: Rule 4 (Dialogs to Yield Closure) - 3-Step Checkout Sequence */}
            <div className="flex items-center justify-between gap-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-500">
              <div className="flex items-center gap-1 text-emerald-700">
                <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Pilih Menu</span>
              </div>
              <span className="text-slate-300">&rarr;</span>
              <div className="flex items-center gap-1 text-emerald-700">
                <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Lokasi &amp; Data</span>
              </div>
              <span className="text-slate-300">&rarr;</span>
              <div className="flex items-center gap-1 text-slate-700">
                <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-800 flex items-center justify-center text-[10px]">3</span>
                <span>Konfirmasi Bayar</span>
              </div>
            </div>

            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Pesanan Kampus • Langsung ke Pedagang
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                  Checkout — {stall.name}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Tutup Checkout (Tekan Escape)"
                title="Tutup (Esc)"
                onClick={() => setCheckoutModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-colors border border-slate-200/80"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Cart Summary */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2 text-xs">
              <span className="font-bold text-slate-700">Rincian Menu ({cartTotalItems} item):</span>
              {cartItems.map((item) => (
                <div key={item.menuItemId} className="flex justify-between text-slate-800">
                  <span>
                    <strong>{item.quantity}x</strong> {item.name}
                  </span>
                  <span className="font-bold">
                    Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
              {selectedPaymentMethod === 'gateway' && (
                <div className="flex justify-between text-emerald-700 pt-1 border-t border-slate-200/60">
                  <span>Biaya Layanan Platform Gateway:</span>
                  <span className="font-bold">+Rp {PLATFORM_SERVICE_FEE.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Pembayaran:</span>
                <span className="text-emerald-700">
                  Rp {cartTotalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Student Info */}
            {loggedInStudent && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-700">verified_user</span>
                  <span className="text-emerald-950">
                    Pesanan terhubung ke akun <strong>{loggedInStudent.name}</strong> ({loggedInStudent.nim})
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                  Terotentikasi
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">
                  Nama Mahasiswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kevin Pratama"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">
                  NIM Mahasiswa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 32230104"
                  value={studentNim}
                  onChange={(e) => setStudentNim(e.target.value)}
                  className={`h-11 px-3 rounded-lg bg-slate-50 border text-slate-900 text-xs focus:outline-none focus:ring-2 ${
                    studentNim.trim().length > 0 && !isValidStudentNim(studentNim)
                      ? 'border-amber-400 focus:ring-amber-500'
                      : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                />
                {studentNim.trim().length > 0 && !isValidStudentNim(studentNim) && (
                  <span className="text-[10px] text-amber-700 font-medium">
                    * Masukkan 7–12 digit angka NIM resmi kampus
                  </span>
                )}
              </div>
            </div>

            {/* Pilihan Layanan: Ambil Sendiri vs Makan di Tempat vs Jastip Mahasiswa */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Pilih Layanan &amp; Pengiriman:</span>
                <span className="text-[11px] text-emerald-700 font-semibold">
                  {fulfillmentType === 'jastip_lantai'
                    ? '🏃 Jastip Mahasiswa (Antar ke Lantai)'
                    : fulfillmentType === 'dine_in'
                    ? '🍽️ Antar ke Meja (Dine-In)'
                    : '🛍️ Ambil di Stan (Self-Pickup)'}
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Self-Pickup */}
                <button
                  type="button"
                  onClick={() => setFulfillmentType('pickup')}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    fulfillmentType === 'pickup'
                      ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900 shadow-xs'
                      : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      fulfillmentType === 'pickup'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      Ambil Sendiri
                    </span>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Bungkus di stan tanpa antre.
                    </span>
                  </div>
                </button>

                {/* 2. Dine-In */}
                {stall.dineInAvailable !== false && (
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('dine_in')}
                    className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                      fulfillmentType === 'dine_in'
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900 shadow-xs'
                        : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80 text-slate-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                        fulfillmentType === 'dine_in'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">table_restaurant</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-slate-900 leading-tight">
                          Dine-In
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                        Duduk di meja kantin.
                      </span>
                    </div>
                  </button>
                )}

                {/* 3. Jastip Mahasiswa (Student Runner P2P) */}
                <button
                  type="button"
                  onClick={() => setFulfillmentType('jastip_lantai')}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    fulfillmentType === 'jastip_lantai'
                      ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 text-slate-900 shadow-xs'
                      : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      fulfillmentType === 'jastip_lantai'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">directions_run</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-900 leading-tight">
                        Jastip Mahasiswa
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black">
                        P2P
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Diantar teman ke kelas (+Rp 2.500)
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Dynamic Inputs according to fulfillment type */}
            {fulfillmentType === 'jastip_lantai' && (
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <strong className="text-emerald-950 font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-emerald-700">room</span>
                    <span>Lokasi Pengantaran Antar-Lantai (Micro-Location):</span>
                  </strong>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Jeda 15-20 Mnt Kelas
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Gedung Kampus:</label>
                    <select
                      value={deliveryBuilding}
                      onChange={(e) => setDeliveryBuilding(e.target.value)}
                      className="h-10 px-2.5 w-full rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Gedung A">Gedung A</option>
                      <option value="Gedung B">Gedung B</option>
                      <option value="Tower Utama">Tower Utama</option>
                      <option value="Sentra UMKM">Sentra UMKM</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Lantai Tujuan:</label>
                    <select
                      value={deliveryFloor}
                      onChange={(e) => setDeliveryFloor(e.target.value)}
                      className="h-10 px-2.5 w-full rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Lantai 1">Lantai 1 (Dasar / Hall)</option>
                      <option value="Lantai 2">Lantai 2 (Student Center)</option>
                      <option value="Lantai 3">Lantai 3 (Kelas 301-310)</option>
                      <option value="Lantai 4">Lantai 4 (Perpustakaan &amp; Lounge)</option>
                      <option value="Lantai 5">Lantai 5 (Kelas 501-512)</option>
                      <option value="Lantai 6">Lantai 6 (Lab Komputer)</option>
                      <option value="Lantai 7">Lantai 7 (Auditorium &amp; Dosen)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Ruangan / Titik Temu <span className="text-rose-500">*</span>:</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: R. 504 / Depan Lab 2"
                      value={deliveryRoom}
                      onChange={(e) => setDeliveryRoom(e.target.value)}
                      className="h-10 px-2.5 w-full rounded-lg bg-white border border-slate-300 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500"
                    >
                    </input>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Slot Pre-Order / Jam Antar:</label>
                    <select
                      value={preOrderSlot}
                      onChange={(e) => setPreOrderSlot(e.target.value)}
                      className="h-10 px-2.5 w-full rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Sekarang (Langsung Masak 15-20 mnt)">Sekarang (Langsung Masak 15-20 mnt)</option>
                      <option value="Slot Istirahat Pagi (10:00 - 10:30 WIB)">Slot Istirahat Pagi (10:00 - 10:30 WIB)</option>
                      <option value="Slot Makan Siang Puncak (12:00 - 13:00 WIB)">Slot Makan Siang Puncak (12:00 - 13:00 WIB)</option>
                      <option value="Slot Break Sore (15:00 - 15:30 WIB)">Slot Break Sore (15:00 - 15:30 WIB)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Catatan Titip Khusus:</label>
                    <input
                      type="text"
                      placeholder="Contoh: Titip ke ketua kelas / wa saat sampai"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      className="h-10 px-2.5 w-full rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-emerald-800 bg-white/70 p-2 rounded-md border border-emerald-200/80 flex items-center justify-between">
                  <span>💡 Ongkos Titip-Antar Mahasiswa: <strong>Rp 2.500</strong></span>
                  <span className="text-slate-500">Bebas antre lift saat jam istirahat padat</span>
                </div>
              </div>
            )}

            {fulfillmentType === 'pickup' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Waktu Ambil di Stan:</label>
                  <select
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Sekarang (Langsung Ambil)">Sekarang (Langsung Ambil)</option>
                    <option value="Istirahat Pagi (09.45 WIB)">Istirahat Pagi (09.45 WIB)</option>
                    <option value="Istirahat Siang (12.00 WIB)">Istirahat Siang (12.00 WIB)</option>
                    <option value="Sore (15.00 WIB)">Sore (15.00 WIB)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Catatan Pesanan:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Sambal pisah / jangan pedas"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {fulfillmentType === 'dine_in' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Nomor Meja Anda:</span>
                    <span className="text-[10px] text-amber-700 font-semibold bg-amber-100/70 px-2 py-0.5 rounded">Wajib Diisi</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                      pin_drop
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Meja 14 / Meja B-04 / Gazebo"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="h-11 pl-9 pr-3 w-full rounded-lg bg-slate-50 border border-amber-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:font-normal placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Catatan Pesanan:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Dekat kipas angin / sendok garpu"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="h-11 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Fitur Added Value: Group Order / Split Bill & Kupon HIMA */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isGroupOrder}
                    onChange={(e) => setIsGroupOrder(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Pesan Bareng Kelompok / Split-Bill Otomatis</span>
                </label>
                {isGroupOrder && (
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">
                    Kalkulator Aktif
                  </span>
                )}
              </div>

              {isGroupOrder && (
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-[11px]">Bagi untuk:</span>
                    <div className="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSplitBillCount(Math.max(2, splitBillCount - 1))}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 font-bold text-slate-900 text-xs">{splitBillCount} Orang</span>
                      <button
                        type="button"
                        onClick={() => setSplitBillCount(Math.min(10, splitBillCount + 1))}
                        className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Patungan per orang:</span>
                    <strong className="text-purple-800 text-sm font-extrabold">
                      Rp {splitBillPerPerson.toLocaleString('id-ID')} / org
                    </strong>
                  </div>
                </div>
              )}

              {/* Kupon Kemitraan HIMA/BEM */}
              <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-xs">
                <div className="relative flex-grow">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                    confirmation_number
                  </span>
                  <input
                    type="text"
                    placeholder="Kode Kupon HIMA/Event (Cth: HIMA2026)"
                    value={himaVoucherInput}
                    onChange={(e) => setHimaVoucherInput(e.target.value)}
                    className="h-9 pl-8 pr-2.5 w-full rounded-lg bg-white border border-slate-300 text-xs uppercase font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyHimaVoucher}
                  className="h-9 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Terapkan
                </button>
              </div>

              {himaVoucherMsg && (
                <p className={`text-[11px] font-medium ${himaVoucherMsg.isError ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {himaVoucherMsg.text}
                </p>
              )}
            </div>

            {/* Metod Pembayaran ala Shopee */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-amber-600">verified_user</span>
                  <span>Metode Pembayaran (Sistem Rekber Shopee):</span>
                </label>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                  Otomatis Lunas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* 1. QRIS ShopeePay & Semua Bank */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('qris')}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    selectedPaymentMethod === 'qris'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-1 ring-emerald-500 shadow-2xs font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] text-emerald-600 shrink-0 mt-0.5">qr_code_2</span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">QRIS Shopee &amp; Bank</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black">POPULER</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      ShopeePay, GoPay, DANA, BCA, Mandiri, dll.
                    </span>
                  </div>
                </button>

                {/* 2. ShopeePay / E-Wallet Instant */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('ewallet')}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    selectedPaymentMethod === 'ewallet'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-1 ring-emerald-500 shadow-2xs font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] text-emerald-600 shrink-0 mt-0.5">account_balance_wallet</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-slate-900">ShopeePay / E-Wallet</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Pembayaran 1-klik instan saldo e-wallet
                    </span>
                  </div>
                </button>

                {/* 3. Virtual Account Bank */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('bank')}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    selectedPaymentMethod === 'bank'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-1 ring-emerald-500 shadow-2xs font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] text-emerald-600 shrink-0 mt-0.5">account_balance</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-xs text-slate-900">Virtual Account Bank</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      BCA, Mandiri, BRI, BNI (Cek Otomatis)
                    </span>
                  </div>
                </button>

                {/* 4. COD / Tunai Kasir */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod('tunai')}
                  className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                    selectedPaymentMethod === 'tunai'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-1 ring-emerald-500 shadow-2xs font-medium'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] text-amber-600 shrink-0 mt-0.5">payments</span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">Bayar Tunai di Stan (COD)</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Bayar kasir saat makan atau ambil pesanan
                    </span>
                  </div>
                </button>
              </div>

              {/* Rincian Proteksi Shopee */}
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">security</span>
                  <span>Uang aman di sistem rekber platform. Penjual langsung terima notifikasi masak.</span>
                </div>
              </div>
            </div>

            {/* Rincian Pembayaran Transparan (Micro B2B2C) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({cartTotalItems} item):</span>
                <span className="font-semibold text-slate-900">
                  Rp {cartSubtotalAmount.toLocaleString('id-ID')}
                </span>
              </div>

              {activeServiceFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>Convenience Fee Mikro (B2C):</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">
                      Unifood
                    </span>
                  </span>
                  <span className="font-semibold text-slate-900">
                    Rp {activeServiceFee.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {fulfillmentType === 'jastip_lantai' && (
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>Ongkir Jastip Mahasiswa (P2P):</span>
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
                      Uang Saku Teman
                    </span>
                  </span>
                  <span className="font-bold text-amber-800">
                    +Rp {JASTIP_RUNNER_FEE.toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {himaDiscountApplied > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Potongan Kupon Organisasi:</span>
                  <span>-Rp {himaDiscountApplied.toLocaleString('id-ID')}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                <span className="font-extrabold text-slate-900">Total Pembayaran:</span>
                <span className="font-black text-emerald-700 text-base">
                  Rp {cartTotalAmount.toLocaleString('id-ID')}
                </span>
              </div>

              {isGroupOrder && splitBillCount > 1 && (
                <div className="text-right text-[11px] text-purple-700 font-bold bg-purple-50 p-1.5 rounded border border-purple-200">
                  Patungan {splitBillCount} Orang: Rp {splitBillPerPerson.toLocaleString('id-ID')} / orang
                </div>
              )}
            </div>

            {/* Cash note */}
            {selectedPaymentMethod === 'tunai' && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">info</span>
                <span>
                  Silakan siapkan uang pas <strong>Rp {cartTotalAmount.toLocaleString('id-ID')}</strong>{' '}
                  saat pesanan disajikan / diambil di kasir.
                </span>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="w-1/3 min-h-[46px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer border border-slate-200/80"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-2/3 min-h-[46px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
              >
                <span>
                  {selectedPaymentMethod === 'tunai'
                    ? 'Konfirmasi Pesanan (Bayar Tunai)'
                    : 'Bayar Sekarang (Otomatis)'}
                </span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8. PAYMENT GATEWAY SANDBOX SIMULATION MODAL */}
      {snapGatewayOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                  Sandbox Simulation
                </span>
                <h4 className="text-base font-bold mt-1">Pembayaran — {stall.name}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSnapGatewayOpen(false)}
                className="w-8 h-8 rounded-md bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block">Total Tagihan</span>
                <span className="text-lg font-black text-emerald-700">
                  Rp {cartTotalAmount.toLocaleString('id-ID')}
                </span>
              </div>
              <span className="font-mono text-slate-500 text-[11px]">{snapTxId}</span>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {snapStep === 'select' && (
                <>
                  <div className="flex rounded-md bg-slate-100 p-1 gap-1 text-xs font-bold border border-slate-200/60">
                    {[
                      { id: 'qris_snap', label: 'QRIS Shopee & Bank' },
                      { id: 'gopay_dana', label: 'ShopeePay / E-Wallet' },
                      { id: 'bca_va', label: 'Virtual Account' },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() =>
                          setSnapChannel(
                            ch.id as 'qris_snap' | 'gopay_dana' | 'bca_va'
                          )
                        }
                        className={`flex-1 py-1.5 px-2 rounded text-center transition-all cursor-pointer ${
                          snapChannel === ch.id
                            ? 'bg-white text-emerald-800 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>

                  {snapChannel === 'qris_snap' && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center text-center gap-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded font-bold border border-amber-200/80">
                        <span className="material-symbols-outlined text-[15px]">timer</span>
                        <span>Berlaku 14:59 menit</span>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col items-center gap-1.5">
                        {paymentConfig.qrisImage || paymentQrisDataUrl || stallQrDataUrl ? (
                          <img
                            src={paymentConfig.qrisImage || paymentQrisDataUrl || stallQrDataUrl}
                            alt="QRIS Dinamis"
                            className="w-40 h-40 object-contain rounded"
                          />
                        ) : (
                          <div className="w-40 h-40 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-[48px]">qr_code_2</span>
                          </div>
                        )}
                        <span className="font-mono text-[11px] text-slate-500 font-bold">
                          NMID: ID2026880019 • REKBER KANTIN UNIFOOD
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 max-w-xs">
                        Buka aplikasi <strong>ShopeePay, GoPay, DANA, OVO, BCA Mobile</strong>, atau m-banking apa saja lalu scan kode QR di atas.
                      </p>
                    </div>
                  )}

                  {snapChannel === 'bca_va' && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
                      <span className="text-xs font-bold text-slate-700">Nomor Virtual Account Bank (BCA / Mandiri):</span>
                      <div className="p-3 bg-white rounded-md border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-base font-bold text-slate-900 block tracking-wider">
                            8801 3223 0104 9912
                          </span>
                          <span className="text-[11px] text-slate-500">
                            a.n. REKBER KANTINKU - {stall.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText('8801322301049912', 'Nomor Virtual Account')}
                          className={`px-3 py-1.5 rounded-md text-white font-bold text-xs cursor-pointer active:scale-95 transition-all flex items-center gap-1 ${
                            copiedLabel === 'Nomor Virtual Account' ? 'bg-emerald-700 ring-2 ring-emerald-300' : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          {copiedLabel === 'Nomor Virtual Account' ? (
                            <>
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              <span>Tersalin!</span>
                            </>
                          ) : (
                            'Salin'
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Transfer ke nomor VA di atas. Sistem rekber otomatis mendeteksi tanpa perlu unggah bukti transfer manual.
                      </p>
                    </div>
                  )}

                  {snapChannel === 'gopay_dana' && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-3 text-center items-center">
                      <div className="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[28px]">account_balance_wallet</span>
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-slate-900">ShopeePay / DANA Instant</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Saldo otomatis terpotong Rp {cartTotalAmount.toLocaleString('id-ID')} saat Anda klik konfirmasi.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSimulateGatewaySuccess}
                    className="w-full min-h-[46px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md"
                  >
                    <span className="material-symbols-outlined text-[20px]">verified</span>
                    <span>Simulasikan Pembayaran Berhasil (Callback Lunas)</span>
                  </button>
                </>
              )}

              {snapStep === 'processing' && (
                <div className="py-8 flex flex-col items-center text-center gap-3">
                  <span className="material-symbols-outlined text-[44px] text-emerald-600 animate-spin">
                    sync
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    Memverifikasi Callback Gateway...
                  </span>
                </div>
              )}

              {snapStep === 'success' && (
                <div className="py-6 flex flex-col items-center text-center gap-3">
                  <span className="material-symbols-outlined text-[48px] text-emerald-600">
                    check_circle
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    Pembayaran Berhasil!
                  </span>
                  <span className="text-xs text-slate-500">
                    Pesanan Anda telah diteruskan ke dapur stan {stall.name}.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. ORDER RECEIPT MODAL */}
      {receiptOrder && (
        <OrderReceiptModal
          order={receiptOrder}
          stall={stall}
          onClose={() => setReceiptOrder(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
