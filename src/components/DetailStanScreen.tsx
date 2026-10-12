import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
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
  onShowToast?: (message: string, isError?: boolean) => void;
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
  onShowToast,
}) => {
  const stall = normalizeStallLocation(rawStall);
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'makanan' | 'minuman' | 'snack'
  >('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Shopping Cart & Direct-to-Merchant Checkout State
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [studentName, setStudentName] = useState(() => {
    try {
      return localStorage.getItem('kantinku_student_name_v1') || '';
    } catch {
      return '';
    }
  });
  const [studentNim, setStudentNim] = useState(() => {
    try {
      return localStorage.getItem('kantinku_student_nim_v1') || '';
    } catch {
      return '';
    }
  });
  const [pickupTime, setPickupTime] = useState('Istirahat Siang (12.00 WIB)');
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodType>('gateway');
  const [selectedEwalletProvider, setSelectedEwalletProvider] = useState<
    'DANA' | 'GoPay' | 'OVO' | 'ShopeePay'
  >('DANA');
  const [paymentReference, setPaymentReference] = useState('');

  // Payment Gateway Sandbox (Midtrans Snap Simulation) State
  const [snapGatewayOpen, setSnapGatewayOpen] = useState(false);
  const [snapChannel, setSnapChannel] = useState<
    'qris_snap' | 'gopay_dana' | 'bca_va' | 'mandiri_va'
  >('qris_snap');
  const [snapStep, setSnapStep] = useState<'select' | 'processing' | 'success'>('select');
  const [snapTxId, setSnapTxId] = useState('MID-IBIKKG-882910');
  const [receiptOrder, setReceiptOrder] = useState<OrderTransaction | null>(null);

  const PLATFORM_SERVICE_FEE = 1000;
  const paymentConfig = getStallPaymentDetails(stall);
  const [stallQrDataUrl, setStallQrDataUrl] = useState<string>('');
  const [paymentQrisDataUrl, setPaymentQrisDataUrl] = useState<string>('');
  const [isOpenedFromQrScan, setIsOpenedFromQrScan] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('stan') || params.get('stall'));
  });

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
      } else {
        copy[item.id] = nextQty;
      }
      return copy;
    });
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
  const activeServiceFee = selectedPaymentMethod === 'gateway' ? PLATFORM_SERVICE_FEE : 0;
  const cartTotalAmount = cartSubtotalAmount + activeServiceFee;

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
    const createdOrder = onPlaceOrder({
      stallId: stall.id,
      stallName: stall.name,
      stallLocation: stall.fullLocation,
      studentName: studentName.trim(),
      studentNim: studentNim.trim(),
      pickupTime,
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
    setPaymentReference('');
    setCheckoutModalOpen(false);
    setSnapGatewayOpen(false);
    setSnapStep('select');
    setReceiptOrder(createdOrder);
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0 || !studentName.trim() || !studentNim.trim()) return;

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
          'Format NIM tidak valid. Masukkan 7–12 digit angka NIM Mahasiswa IBI KKG (contoh: 32230104).',
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

    if (selectedPaymentMethod === 'gateway') {
      const generatedTx = `SANDBOX-SNAP-${Date.now().toString().slice(-6)}`;
      setSnapTxId(generatedTx);
      setSnapStep('select');
      setSnapGatewayOpen(true);
      return;
    }

    let providerLabel = 'Tunai di Kasir';
    if (selectedPaymentMethod === 'qris') {
      providerLabel = `QRIS Manual (${selectedEwalletProvider} / M-Banking)`;
    } else if (selectedPaymentMethod === 'ewallet') {
      providerLabel = `Transfer ${selectedEwalletProvider} (${paymentConfig.ewalletNumber})`;
    } else if (selectedPaymentMethod === 'bank') {
      providerLabel = `Transfer Bank ${paymentConfig.bankName}`;
    }

    completeOrderPlacement(
      providerLabel,
      selectedPaymentMethod === 'tunai'
        ? 'Bayar Tunai saat Ambil di Stan'
        : paymentReference.trim() || `Dibayar via ${providerLabel}`,
      selectedPaymentMethod === 'tunai' ? 'cash_on_pickup' : 'manual_verification'
    );
  };

  const handleSimulateGatewaySuccess = () => {
    setSnapStep('processing');
    setTimeout(() => {
      setSnapStep('success');
      const channelName =
        snapChannel === 'qris_snap'
          ? 'Payment Gateway • QRIS Otomatis (DANA/GoPay/OVO/M-Banking)'
          : snapChannel === 'gopay_dana'
          ? `Payment Gateway • ${selectedEwalletProvider} Instant`
          : snapChannel === 'bca_va'
          ? 'Payment Gateway • BCA Virtual Account'
          : 'Payment Gateway • Mandiri Bill Payment';

      setTimeout(() => {
        completeOrderPlacement(
          channelName,
          `LUNAS OTOMATIS (Sandbox Callback • ID: ${snapTxId})`,
          'paid_gateway',
          snapTxId
        );
      }, 1100);
    }, 900);
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
            className="min-h-[40px] px-3 py-1.5 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-emerald-700 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Kembali ke Katalog</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[17px] text-emerald-600">
                qr_code_2
              </span>
              <span className="hidden sm:inline">QR Etalase</span>
            </button>

            <button
              type="button"
              onClick={onToggleFavorite}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all border ${
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
          <div className="rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-sm flex items-center justify-between gap-2">
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
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* 3. SHOPEEFOOD / GOJEK STYLE STOREFRONT HERO HEADER */}
        <header className="relative w-full rounded-3xl overflow-hidden shadow-sm border border-slate-200/90 bg-white">
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
              <span className="px-3 py-1 rounded-full bg-emerald-600/95 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                <span>{stall.isOpen ? 'Buka Sekarang' : 'Tutup'}</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
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
                    title="Mitra Resmi Terverifikasi Kampus IBI KKG"
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
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-2xl font-black text-sm">
                  <span className="material-symbols-outlined text-[17px] text-amber-500">
                    star
                  </span>
                  <span>{stall.rating}</span>
                  <span className="font-normal text-xs text-amber-700">
                    ({stall.reviewCount} ulasan)
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-2xl font-bold text-xs">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">
                    location_on
                  </span>
                  <span>{stall.distanceMeters} meter</span>
                </div>
              </div>
            </div>

            {/* Price Transparency Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
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
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-bold text-xs whitespace-nowrap cursor-pointer transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
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
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
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
              <div className="bg-white rounded-2xl shadow-xs overflow-x-auto border border-slate-200">
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
                              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
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
                                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 p-1 rounded-xl border border-emerald-200">
                                  <button
                                    type="button"
                                    onClick={() => updateCartQty(item, -1)}
                                    className="w-7 h-7 rounded-lg bg-white font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    -
                                  </button>
                                  <span className="font-bold text-xs px-1">{inCartQty}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateCartQty(item, 1)}
                                    className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center cursor-pointer shadow-2xs"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item, 1)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
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
              /* 5. SHOPEEFOOD / GOJEK GRADE 2-COLUMN MENU CARD GRID */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {visibleMenu.map((item) => {
                  const isAvailable = item.status === 'ready';
                  const inCartQty = cartQuantities[item.id] || 0;

                  return (
                    <article
                      key={item.id}
                      className={`group bg-white rounded-2xl p-3.5 shadow-xs hover:shadow-md border border-slate-200/90 flex gap-3.5 min-w-0 transition-all duration-200 ${
                        !isAvailable ? 'opacity-70 bg-slate-50' : 'hover:border-emerald-300'
                      }`}
                    >
                      {/* Left: Text & Price */}
                      <div className="flex flex-col justify-between flex-grow min-w-0">
                        <div>
                          <h4
                            className={`text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2 ${
                              !isAvailable ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {item.name}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-end justify-between gap-2 pt-2 mt-2 border-t border-slate-100">
                          <div className="flex flex-col">
                            <span
                              className={`text-base sm:text-lg font-black ${
                                isAvailable ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              Rp {item.price.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Update: {item.lastUpdated}
                            </span>
                          </div>

                          {/* Stepper / Add Button */}
                          {isAvailable ? (
                            inCartQty > 0 ? (
                              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-900 p-1 rounded-xl border border-emerald-300 shadow-xs">
                                <button
                                  type="button"
                                  aria-label={`Kurangi ${item.name}`}
                                  onClick={() => updateCartQty(item, -1)}
                                  className="w-8 h-8 rounded-lg bg-white text-emerald-800 font-bold flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs"
                                >
                                  -
                                </button>
                                <span className="font-bold text-xs min-w-[20px] text-center">
                                  {inCartQty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Tambah ${item.name}`}
                                  onClick={() => updateCartQty(item, 1)}
                                  className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center cursor-pointer active:scale-95 shadow-2xs"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => updateCartQty(item, 1)}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                <span>Tambah</span>
                              </button>
                            )
                          ) : (
                            <span className="text-xs font-bold text-slate-400 px-2.5 py-1 rounded-lg bg-slate-200">
                              Habis
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Square Food Thumbnail */}
                      <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                        <img
                          src={item.imageCatalog}
                          alt={item.altCatalog}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                            !isAvailable ? 'grayscale' : ''
                          }`}
                        />
                        {!isAvailable && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold uppercase">
                            Habis
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* RATINGS & REVIEWS SECTION */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200 mt-2 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[24px]">
                    reviews
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    Ulasan Mahasiswa IBI KKG
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  {stall.reviewCount} Mahasiswa telah menilai
                </span>
              </div>

              {/* Review Input Form */}
              <form onSubmit={handleReviewSubmit} className="flex flex-col gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-700">
                  Tulis Ulasan Makanan &amp; Layanan Stan:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Nama Anda (Mahasiswa)"
                    value={revName}
                    onChange={(e) => setRevName(e.target.value)}
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <select
                    value={revRating}
                    onChange={(e) => setRevRating(Number(e.target.value))}
                    className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="flex-grow h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs active:scale-95"
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
                      className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col gap-1.5"
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
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col gap-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Informasi &amp; Lokasi Stan
              </h3>

              <div className="flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">
                  location_on
                </span>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900">{stall.fullLocation}</span>
                  <span className="text-slate-500 mt-0.5">
                    ±{stall.distanceMeters} meter dari lobby utama
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs">
                <span className="material-symbols-outlined text-[20px] text-emerald-600 shrink-0">
                  schedule
                </span>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900">
                    {stall.daysOpen} • {stall.hours} WIB
                  </span>
                  <span className="text-slate-500 mt-0.5">
                    {stall.isOpen ? 'Sedang buka melayani pesanan' : 'Sedang istirahat/tutup'}
                  </span>
                </div>
              </div>

              {/* Walking Guide */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">
                    directions_walk
                  </span>
                  Panduan Jalan Kaki:
                </span>
                <p className="text-slate-600 leading-relaxed">{stall.walkingGuide}</p>
              </div>

              {/* Payment Methods Pill Badges */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-700">Metode Bayar Didukung:</span>
                <div className="flex flex-wrap gap-1.5">
                  {paymentConfig.qrisEnabled && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                      QRIS Semua Bank
                    </span>
                  )}
                  {paymentConfig.ewalletEnabled && (
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[11px]">
                      DANA / GoPay
                    </span>
                  )}
                  {paymentConfig.cashEnabled && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]">
                      Tunai di Stan
                    </span>
                  )}
                </div>
              </div>

              {/* QR Code Etalase Preview */}
              {stallQrDataUrl && (
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-3">
                  <img
                    src={stallQrDataUrl}
                    alt={`QR Stan ${stall.name}`}
                    className="w-14 h-14 object-contain rounded-lg bg-white p-1 border border-emerald-200 shrink-0 cursor-pointer hover:scale-105 transition-transform"
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
          <div className="bg-slate-900 text-white rounded-3xl p-3.5 sm:p-4 shadow-2xl flex items-center justify-between gap-3 border border-slate-800 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-md shrink-0">
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
                onClick={() => setCartQuantities({})}
                className="hidden sm:inline-flex min-h-[42px] px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(true)}
                className="min-h-[46px] px-5 sm:px-6 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/40 cursor-pointer active:scale-95 transition-all"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleCheckoutSubmit}
            className="bg-white rounded-3xl p-4 sm:p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto border border-slate-200"
          >
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
                aria-label="Tutup Checkout"
                onClick={() => setCheckoutModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Cart Summary */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-2 text-xs">
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
                  className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Pickup Time & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Waktu Ambil di Stan:</label>
                <select
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">Metode Pembayaran:</label>

              {/* Gateway Sandbox */}
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('gateway')}
                className={`w-full p-3 rounded-2xl flex items-center justify-between gap-3 border text-left transition-all cursor-pointer ${
                  selectedPaymentMethod === 'gateway'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[24px]">bolt</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">
                      Payment Gateway Otomatis (Simulasi Sandbox)
                    </span>
                    <span
                      className={`text-[11px] ${
                        selectedPaymentMethod === 'gateway' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      QRIS Dinamis, DANA, GoPay &amp; VA • Otomatis Lunas!
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">
                  Cepat
                </span>
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {paymentConfig.qrisEnabled && (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('qris')}
                    className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                      selectedPaymentMethod === 'qris'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                    <span>QRIS Manual</span>
                  </button>
                )}

                {paymentConfig.ewalletEnabled && (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('ewallet')}
                    className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                      selectedPaymentMethod === 'ewallet'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      account_balance_wallet
                    </span>
                    <span>DANA / GoPay</span>
                  </button>
                )}

                {paymentConfig.bankEnabled && (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('bank')}
                    className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                      selectedPaymentMethod === 'bank'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">account_balance</span>
                    <span>Transfer Bank</span>
                  </button>
                )}

                {paymentConfig.cashEnabled && (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('tunai')}
                    className={`p-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                      selectedPaymentMethod === 'tunai'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">payments</span>
                    <span>Tunai Kasir</span>
                  </button>
                )}
              </div>
            </div>

            {/* Direct QRIS Image Box */}
            {selectedPaymentMethod === 'qris' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Scan QRIS Resmi {paymentConfig.qrisMerchantName}
                </span>
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center gap-1">
                  {paymentConfig.qrisImage || paymentQrisDataUrl ? (
                    <img
                      src={paymentConfig.qrisImage || paymentQrisDataUrl}
                      alt="QRIS Kantin"
                      className="w-40 h-40 object-contain rounded"
                    />
                  ) : null}
                  <span className="text-xs font-bold text-emerald-700">
                    Nominal: Rp {cartTotalAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {/* E-Wallet Direct Info */}
            {selectedPaymentMethod === 'ewallet' && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">
                    {selectedEwalletProvider} ({paymentConfig.ewalletAccountName}):
                  </span>
                  <span className="font-mono text-base font-bold text-slate-900">
                    {paymentConfig.ewalletNumber}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(paymentConfig.ewalletNumber, 'Nomor E-Wallet')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                >
                  Salin
                </button>
              </div>
            )}

            {/* Cash note */}
            {selectedPaymentMethod === 'tunai' && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Silakan siapkan uang pas <strong>Rp {cartTotalAmount.toLocaleString('id-ID')}</strong> saat mengambil pesanan di stan.
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="w-1/3 min-h-[46px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-2/3 min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95"
              >
                <span>
                  {selectedPaymentMethod === 'gateway'
                    ? 'Lanjut ke Sandbox Gateway'
                    : 'Konfirmasi & Kirim Pesanan'}
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
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 flex flex-col">
            <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                  Sandbox Simulation
                </span>
                <h4 className="text-base font-bold mt-1">Pembayaran — {stall.name}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSnapGatewayOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center cursor-pointer"
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
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'qris_snap', label: 'QRIS Otomatis', icon: 'qr_code_2' },
                      { id: 'gopay_dana', label: 'DANA / GoPay', icon: 'account_balance_wallet' },
                      { id: 'bca_va', label: 'BCA Virtual Account', icon: 'account_balance' },
                      { id: 'mandiri_va', label: 'Mandiri Livin', icon: 'credit_card' },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() =>
                          setSnapChannel(
                            ch.id as 'qris_snap' | 'gopay_dana' | 'bca_va' | 'mandiri_va'
                          )
                        }
                        className={`p-3 rounded-2xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                          snapChannel === ch.id
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px] text-emerald-600">
                          {ch.icon}
                        </span>
                        <span>{ch.label}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateGatewaySuccess}
                    className="w-full min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md"
                  >
                    <span className="material-symbols-outlined text-[20px]">verified</span>
                    <span>Simulasikan Pembayaran Berhasil</span>
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
