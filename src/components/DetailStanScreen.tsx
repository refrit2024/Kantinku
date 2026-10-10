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
  onUpdateOrderStatus,
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
      const nextQty = Math.max(0, (prev[item.id] || 0) + delta);
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
      color: { dark: '#131B2E', light: '#FFFFFF' },
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
      color: { dark: '#181C22', light: '#FFFFFF' },
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

  // Active orders for this stall (completed/rejected automatically disappear from live board)
  const stallOrders = orders.filter(
    (o) =>
      o.stallId === stall.id &&
      o.status !== 'completed' &&
      o.status !== 'rejected'
  );

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
    onPlaceOrder({
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
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0 || !studentName.trim() || !studentNim.trim()) return;

    try {
      localStorage.setItem('kantinku_student_name_v1', studentName.trim());
      localStorage.setItem('kantinku_student_nim_v1', studentNim.trim());
    } catch {
      // ignore
    }

    // If Payment Gateway Sandbox is selected, open the interactive Midtrans Snap Sandbox Modal
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
  };

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Breadcrumb Bar */}
      <div className="w-full bg-surface-container-low border-b border-outline-variant/25 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToKatalog}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary font-label-md text-label-md transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Kembali ke Direktori Kantin • Dekat Hall D ({stall.code})</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-lowest text-on-surface hover:text-primary border border-outline-variant/30 font-label-sm text-label-sm shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                qr_code_2
              </span>
              <span>QR Stan</span>
            </button>
            <button
              type="button"
              onClick={onToggleFavorite}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-lowest text-primary font-label-sm text-label-sm shadow-xs cursor-pointer active:scale-95 transition-transform"
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}
              >
                favorite
              </span>
              <span>{isFavorite ? 'Tersimpan di Favorit' : 'Simpan Favorit'}</span>
            </button>
          </div>
        </div>
      </div>

      {isQrModalOpen && (
        <StallQrModal
          stall={stall}
          onClose={() => setIsQrModalOpen(false)}
          onSimulateScan={() => setIsOpenedFromQrScan(true)}
          onShowToast={onShowToast}
        />
      )}

      {/* Main Responsive Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex flex-col gap-5">
        {isOpenedFromQrScan && (
          <div className="rounded-xl bg-secondary text-on-secondary px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              <span className="font-label-md text-xs sm:text-sm font-bold">
                Akses Langsung via Scan QR Etalase Aktif — Anda berada di menu resmi{' '}
                <span className="underline">{stall.name}</span> ({stall.code})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpenedFromQrScan(false)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-on-secondary/15 hover:bg-on-secondary/25 text-on-secondary text-xs font-semibold cursor-pointer"
            >
              Tutup Info
            </button>
          </div>
        )}

        {/* Hero Profile Banner */}
        <section className="flex flex-col w-full rounded-xl overflow-hidden shadow-sm border border-outline-variant/25 bg-surface-container-lowest">
          <div className="relative w-full h-52 sm:h-64 bg-surface-container-high overflow-hidden">
            <img
              className="w-full h-full object-cover"
              alt={stall.bannerAlt}
              src={stall.heroImage}
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/90 via-on-surface/35 to-transparent flex items-end p-4 sm:p-6">
              <div className="flex flex-col gap-1.5 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-md w-fit">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  <span className="font-label-sm text-label-sm">
                    Dikelola Langsung oleh Penjual • {stall.code} (Dekat Hall D)
                  </span>
                </div>
                <h2 className="fluid-headline-xl text-surface-bright tracking-tight">
                  {stall.name}
                </h2>
                <p className="font-body-md text-body-md text-surface-container-high">
                  {stall.specialty}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-surface-container-lowest">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-label-lg text-label-lg text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px] text-tertiary">star</span>
                <span>{stall.rating}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  ({stall.reviewCount} ulasan)
                </span>
              </span>
              <span className="text-outline-variant">•</span>
              <span className="font-label-md text-label-md text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-secondary">
                  location_on
                </span>
                <span>{stall.distanceMeters} m</span>
              </span>
              <span className="text-outline-variant">•</span>
              <span
                className={`font-label-md text-label-md font-semibold inline-flex items-center gap-1.5 ${
                  stall.isOpen ? 'text-secondary' : 'text-error'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    stall.isOpen ? 'bg-secondary' : 'bg-error'
                  }`}
                />
                <span>{stall.isOpen ? 'Buka' : 'Tutup'}</span>
              </span>
            </div>
            <div className="font-label-sm text-label-sm bg-surface-container-low text-on-surface px-3 py-1.5 rounded-lg">
              {stall.daysOpen} • {stall.hours} WIB
            </div>
          </div>
        </section>

        {/* 3-State Responsive Content Split:
            - Mobile (<1024px): Stacked cleanly
            - Desktop (>=1024px): Left 8 cols Menu (2-col grid) & Reviews, Right 4 cols sticky Info, Location & Budget Calculator
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT / MAIN COLUMN (8 cols on Desktop) */}
          <div className="lg:col-span-8 flex flex-col gap-5 min-w-0">
            {/* Banner "Harga terakhir diperbarui: 8 Oktober 2026" */}
            <div className="bg-secondary-container/45 border border-secondary/25 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-secondary">
                    <span className="material-symbols-outlined text-[20px] shrink-0">update</span>
                    <span className="font-label-lg text-label-lg font-bold">
                      Harga terakhir diperbarui: {stall.lastUpdatedDate}
                    </span>
                  </div>
                  <span className="font-label-sm text-label-sm bg-surface-container-lowest text-secondary px-2.5 py-0.5 rounded font-semibold">
                    Pukul {stall.lastUpdatedTime}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                  Informasi menu, ketersediaan, dan harga diinput langsung oleh <strong>{stall.name}</strong> tanpa biaya mark-up.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenReportModal}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-surface-container-lowest text-primary font-label-sm text-label-sm font-semibold hover:bg-surface shadow-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer self-start sm:self-center"
              >
                <span>Lapor Selisih Harga</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

            {/* Menu Section Header & Controls */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="fluid-headline-md text-on-surface">Daftar Menu &amp; Harga</h3>
                <div className="flex items-center gap-1 bg-surface-container p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`min-h-[38px] px-3 py-1.5 rounded-md text-label-sm font-label-sm cursor-pointer transition-colors ${
                      viewMode === 'cards'
                        ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    Foto &amp; Kartu
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`min-h-[38px] px-3 py-1.5 rounded-md text-label-sm font-label-sm cursor-pointer transition-colors ${
                      viewMode === 'table'
                        ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    Tabel Ringkas
                  </button>
                </div>
              </div>

              {/* Category Filter Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
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
                    className={`min-h-[42px] px-4 py-2 rounded-xl font-label-md text-label-md whitespace-nowrap shadow-xs cursor-pointer transition-colors shrink-0 ${
                      selectedCategory === cat.id
                        ? 'bg-primary text-on-primary font-semibold'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu List / Table (2 columns on Desktop & Tablet, 1 column on Mobile) */}
            <div className="flex flex-col gap-3" id="menu-container">
              {viewMode === 'table' ? (
                <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-x-auto border border-outline-variant/30">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-high text-on-surface font-label-md text-label-md">
                        <th className="py-3 px-4">Menu</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-4 text-right">Harga</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30 font-body-md text-body-md">
                      {visibleMenu.map((item) => (
                        <tr key={item.id} className="hover:bg-surface-container-low">
                          <td className="py-3 px-4">
                            <div
                              className={`font-semibold text-on-surface ${
                                item.status === 'habis' ? 'line-through opacity-70' : ''
                              }`}
                            >
                              {item.name}
                            </div>
                            <div className="text-[11px] text-on-surface-variant">
                              Update: {item.lastUpdated}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`font-label-sm text-label-sm px-2 py-0.5 rounded inline-flex items-center gap-1.5 ${
                                item.status === 'ready'
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : 'bg-error-container text-on-error-container'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.status === 'ready' ? 'bg-secondary' : 'bg-error'
                                }`}
                              />
                              <span>{item.status === 'ready' ? 'Tersedia' : 'Habis'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-label-lg text-primary font-bold whitespace-nowrap">
                            Rp{item.price.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {visibleMenu.map((item) => {
                    const isAvailable = item.status === 'ready';
                    return (
                      <article
                        key={item.id}
                        className={`menu-card bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-outline-variant/25 flex gap-3.5 min-w-0 ${
                          !isAvailable ? 'opacity-80' : ''
                        }`}
                      >
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container-high relative">
                          <img
                            className={`w-full h-full object-cover ${
                              !isAvailable ? 'grayscale' : ''
                            }`}
                            alt={item.altCatalog}
                            src={item.imageCatalog}
                            referrerPolicy="no-referrer"
                          />
                          {!isAvailable && (
                            <div className="absolute inset-0 bg-on-surface/55 flex items-center justify-center p-1 text-center">
                              <span className="font-label-sm text-[10px] leading-tight text-surface font-bold uppercase">
                                Habis
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col justify-between flex-grow min-w-0">
                          <div>
                            <h4
                              className={`font-headline-md text-[15px] sm:text-[16px] leading-snug text-on-surface font-semibold break-words ${
                                !isAvailable ? 'line-through' : ''
                              }`}
                            >
                              {item.name}
                            </h4>
                            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
                              {item.description}
                            </p>
                          </div>
                          <div className="flex items-end justify-between gap-2 pt-2.5 mt-1 border-t border-outline-variant/15">
                            <div className="flex flex-col min-w-0">
                              <span
                                className={`font-headline-md text-[15px] sm:text-[16px] font-bold whitespace-nowrap ${
                                  isAvailable ? 'text-primary' : 'text-on-surface-variant'
                                }`}
                              >
                                Rp {item.price.toLocaleString('id-ID')}
                              </span>
                              <span className="text-[11px] text-on-surface-variant truncate">
                                Update: {item.lastUpdated}
                              </span>
                            </div>
                            {isAvailable ? (
                              <div className="flex items-center shrink-0">
                                {(cartQuantities[item.id] || 0) > 0 ? (
                                  <div className="flex items-center gap-1 bg-primary-fixed text-on-primary-fixed p-1 rounded-xl border border-primary/30">
                                    <button
                                      type="button"
                                      aria-label={`Kurangi ${item.name}`}
                                      onClick={() => updateCartQty(item, -1)}
                                      className="w-9 h-9 rounded-lg bg-surface-container-lowest text-primary font-bold flex items-center justify-center cursor-pointer active:scale-95"
                                    >
                                      -
                                    </button>
                                    <span className="font-label-md font-bold min-w-[24px] text-center">
                                      {cartQuantities[item.id]}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Tambah ${item.name}`}
                                      onClick={() => updateCartQty(item, 1)}
                                      className="w-9 h-9 rounded-lg bg-primary text-on-primary font-bold flex items-center justify-center cursor-pointer active:scale-95"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => updateCartQty(item, 1)}
                                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-sm text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">
                                      add_shopping_cart
                                    </span>
                                    <span>+ Pesan</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="font-label-sm text-xs bg-error-container text-on-error-container px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap">
                                Habis
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rating & Review Mahasiswa IBI KKG */}
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="fluid-headline-md text-on-surface">
                    Rating &amp; Ulasan Mahasiswa
                  </h3>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Pengalaman makan langsung di {stall.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-tertiary-fixed text-on-tertiary-fixed px-3 py-1.5 rounded-lg font-label-md font-bold shrink-0">
                  <span className="material-symbols-outlined text-[16px]">star</span>
                  <span>{stall.rating}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {(Array.isArray(stall.reviews) ? stall.reviews : []).map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div>
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          {rev.studentName}
                        </span>
                        <span className="font-body-sm text-xs text-on-surface-variant ml-1.5">
                          • {rev.majorAndYear}
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-tertiary font-bold">
                        {Math.max(1, Math.min(5, Number(rev.rating) || 5))}/5 Bintang
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                      {rev.comment}
                    </p>
                    <span className="text-[11px] text-on-surface-variant">{rev.date}</span>
                    {rev.reply && (
                      <div className="mt-1 p-2.5 rounded bg-surface-container-lowest border-l-2 border-primary text-body-sm text-on-surface-variant">
                        <strong className="text-on-surface">Balasan Penjual:</strong> {rev.reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleReviewSubmit}
                className="pt-3 border-t border-outline-variant/30 flex flex-col gap-2.5"
              >
                <span className="font-label-md text-label-md text-on-surface">
                  Tulis Ulasan Singkat Anda
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="Nama Anda"
                    value={revName}
                    onChange={(e) => setRevName(e.target.value)}
                    className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                  />
                  <select
                    value={revRating}
                    onChange={(e) => setRevRating(Number(e.target.value))}
                    className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                  >
                    <option value={5}>5/5 — Sangat Puas</option>
                    <option value={4}>4/5 — Sesuai Harga</option>
                    <option value={3}>3/5 — Cukup</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Bagaimana kesesuaian harga dan rasa makanannya?"
                  required
                  value={revComment}
                  onChange={(e) => setRevComment(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full min-h-[44px] py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer active:scale-[0.99]"
                >
                  Kirim Ulasan Mahasiswa
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT SIDEBAR COLUMN (2-col side-by-side on Tablet md, 4 cols vertical on Desktop lg) */}
          <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-col gap-5 min-w-0 items-start">
            {/* Profil Informasi Kantin Lengkap */}
            <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-sm border border-outline-variant/25 flex flex-col gap-3.5">
              <h3 className="fluid-headline-md text-on-surface">Informasi &amp; Lokasi Kantin</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {stall.description}
              </p>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">location_on</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Lokasi &amp; Jarak Kampus
                  </span>
                  <span className="font-label-lg text-label-lg text-on-surface">
                    {stall.fullLocation} (±{stall.distanceMeters} meter)
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">schedule</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Jam Operasional
                  </span>
                  <span className="font-body-md text-body-md text-on-surface">
                    {stall.daysOpen} • {stall.hours} WIB
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">payments</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    Metode Pembayaran Langsung (Tanpa Biaya Admin)
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {paymentConfig.qrisEnabled && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">
                        QRIS (Semua Bank &amp; E-Wallet)
                      </span>
                    )}
                    {paymentConfig.ewalletEnabled && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-semibold">
                        {paymentConfig.ewalletProviders}
                      </span>
                    )}
                    {paymentConfig.bankEnabled && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">
                        Transfer {paymentConfig.bankName}
                      </span>
                    )}
                    {paymentConfig.cashEnabled && (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-semibold">
                        Tunai di Kasir
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Petunjuk Arah Lokasi Fisik */}
              <div className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-on-surface">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    explore
                  </span>
                  <span className="font-label-md text-label-md font-bold">
                    Panduan Jalan Kaki ke {stall.name}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {stall.walkingGuide}
                </p>
              </div>

              {/* QR Code Etalase Stan Langsung Terlihat */}
              <div className="p-3.5 rounded-xl bg-primary-fixed/35 border border-primary/25 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {stallQrDataUrl && (
                    <button
                      type="button"
                      onClick={() => setIsQrModalOpen(true)}
                      title="Klik untuk perbesar Poster QR Code Stan"
                      className="w-16 h-16 rounded-lg bg-white p-1 border border-primary/30 shadow-xs shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    >
                      <img
                        src={stallQrDataUrl}
                        alt={`QR Code ${stall.name}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-xs font-bold text-on-surface">
                      QR Code Etalase {stall.name}
                    </span>
                    <span className="text-[11px] text-on-surface-variant leading-snug">
                      Scan atau bagikan QR ini agar teman langsung membuka menu {stall.code}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                  <span>Perbesar</span>
                </button>
              </div>
            </div>

            {/* LIVE TRACKER PESANAN MAHASISWA DI KANTIN INI */}
            {stallOrders.length > 0 && (
              <div className="md:col-span-2 lg:col-span-1 bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm border-2 border-primary/35 flex flex-col gap-3 w-full">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                    <h3 className="font-headline-md text-[16px] text-on-surface font-bold">
                      Status Pesanan Live ({stallOrders.length})
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">
                    Real-Time Sync
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {stallOrders.slice(0, 4).map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label-sm text-on-surface font-bold">
                          {ord.studentName} ({ord.studentNim})
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                            ord.status === 'ready_pickup'
                              ? 'bg-secondary text-on-secondary'
                              : ord.status === 'cooking'
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : ord.status === 'completed'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : ord.status === 'rejected'
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-tertiary-fixed text-on-tertiary-fixed'
                          }`}
                        >
                          {ord.status === 'waiting_payment_verification'
                            ? 'Menunggu Konfirmasi Penjual'
                            : ord.status === 'cooking'
                            ? 'Sedang Disiapkan / Dibungkus'
                            : ord.status === 'ready_pickup'
                            ? 'SIAP DIAMBIL DI STAN'
                            : ord.status === 'completed'
                            ? 'Selesai Diambil'
                            : 'Dibatalkan / Revisi'}
                        </span>
                      </div>
                      <div className="text-[12px] text-on-surface-variant">
                        {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-outline-variant/20 text-[11px]">
                        <span className="text-on-surface-variant">{ord.paymentProviderLabel}</span>
                        <strong className="text-primary">
                          Rp {ord.totalAmount.toLocaleString('id-ID')}
                        </strong>
                      </div>
                      {ord.status === 'ready_pickup' && onUpdateOrderStatus && (
                        <button
                          type="button"
                          onClick={() => onUpdateOrderStatus(ord.id, 'completed')}
                          className="mt-1 w-full min-h-[44px] px-3 py-2 rounded-lg bg-secondary text-on-secondary hover:opacity-95 font-label-sm text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-[0.99]"
                        >
                          <span className="material-symbols-outlined text-[16px]">task_alt</span>
                          <span>Sudah Saya Ambil (Selesaikan)</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FLOATING STICKY CART BAR (Appears when student selects >= 1 item) */}
      {cartTotalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-3xl mx-auto">
          <div className="bg-on-surface text-surface rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 border border-outline-variant/30">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center font-headline-md font-bold shrink-0">
                {cartTotalItems}
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-[11px] text-surface/80">
                  Total Pesanan di {stall.name} (Rp 0 Biaya Admin)
                </span>
                <span className="font-headline-md text-[18px] text-surface font-bold">
                  Rp {cartTotalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setCartQuantities({})}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-surface/15 hover:bg-surface/25 text-surface font-label-sm text-label-sm cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(true)}
                className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"
              >
                <span>Pilih Pembayaran &amp; Checkout</span>
                <span className="material-symbols-outlined text-[18px]">payments</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT TRANSAKSI DIRECT-TO-MERCHANT (QRIS / DANA / GOPAY / OVO / BANK / TUNAI) */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCheckoutSubmit}
            className="bg-surface-container-lowest rounded-2xl p-4 sm:p-6 w-full max-w-lg shadow-xl flex flex-col gap-4 max-h-[92dvh] overflow-y-auto border border-outline-variant/30"
          >
            <div className="flex items-start justify-between gap-2 border-b border-outline-variant/25 pb-3">
              <div>
                <span className="font-label-sm text-[11px] text-secondary font-bold uppercase tracking-wider">
                  Transaksi Langsung ke Penjual • Rp 0 Biaya Admin
                </span>
                <h3 className="fluid-headline-md text-on-surface">
                  Checkout Pesanan — {stall.name}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Tutup Checkout"
                onClick={() => setCheckoutModalOpen(false)}
                className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Ringkasan Item Pesanan */}
            <div className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2">
              <div className="flex items-center justify-between text-label-sm text-on-surface-variant font-semibold">
                <span>Rincian Menu ({cartTotalItems} item)</span>
                <span>Subtotal</span>
              </div>
              {cartItems.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex items-center justify-between text-body-sm text-on-surface"
                >
                  <span>
                    <strong>{item.quantity}x</strong> {item.name}
                  </span>
                  <span className="font-semibold">
                    Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
              {selectedPaymentMethod === 'gateway' && (
                <div className="flex items-center justify-between text-xs text-secondary pt-1 border-t border-outline-variant/20">
                  <span>Biaya Layanan Platform &amp; Payment Gateway</span>
                  <span className="font-semibold">
                    +Rp {PLATFORM_SERVICE_FEE.toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
                <span className="font-label-md text-on-surface font-bold">
                  Total Pembayaran
                </span>
                <span className="font-headline-md text-[18px] text-primary font-bold">
                  Rp {cartTotalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Data Pemesan Mahasiswa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Nama Mahasiswa <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kevin Pratama"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  NIM Mahasiswa <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 32230104"
                  value={studentNim}
                  onChange={(e) => setStudentNim(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Waktu Ambil di Stan
                </label>
                <select
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                >
                  <option value="Sekarang (Langsung Ambil)">Sekarang (Langsung Ambil)</option>
                  <option value="Istirahat Pagi (09.45 WIB)">Istirahat Pagi (09.45 WIB)</option>
                  <option value="Istirahat Siang (12.00 WIB)">Istirahat Siang (12.00 WIB)</option>
                  <option value="Sore (15.00 WIB)">Sore (15.00 WIB)</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Catatan Pesanan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Sambal pisah / tidak pedas"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                />
              </div>
            </div>

            {/* PILIH METODE PEMBAYARAN (PAYMENT GATEWAY SANDBOX VS DIRECT) */}
            <div className="flex flex-col gap-2">
              <label className="font-label-sm text-label-sm text-on-surface font-bold">
                Pilih Metode Pembayaran:
              </label>

              {/* Featured Option: Payment Gateway Otomatis (Simulasi Sandbox) */}
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('gateway')}
                className={`w-full p-3 rounded-xl flex items-center justify-between gap-3 border text-left transition-all cursor-pointer ${
                  selectedPaymentMethod === 'gateway'
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[24px]">bolt</span>
                  <div className="flex flex-col">
                    <span className="font-label-md font-bold flex items-center gap-1.5">
                      Payment Gateway Otomatis (Simulasi Sandbox)
                    </span>
                    <span
                      className={`text-[11px] ${
                        selectedPaymentMethod === 'gateway'
                          ? 'text-on-primary/90'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      QRIS Dinamis, GoPay, DANA, OVO &amp; Virtual Account • Otomatis Lunas!
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 ${
                    selectedPaymentMethod === 'gateway'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-primary-fixed text-on-primary-fixed'
                  }`}
                >
                  Rekomendasi
                </span>
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {paymentConfig.qrisEnabled && (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('qris')}
                    className={`min-h-[46px] p-2 rounded-xl font-label-sm text-label-sm flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                      selectedPaymentMethod === 'qris'
                        ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                        : 'bg-surface-container-low text-on-surface border-outline-variant/30'
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
                    className={`min-h-[46px] p-2 rounded-xl font-label-sm text-label-sm flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                      selectedPaymentMethod === 'ewallet'
                        ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                        : 'bg-surface-container-low text-on-surface border-outline-variant/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      account_balance_wallet
                    </span>
                    <span>DANA / E-Wallet</span>
                  </button>
                )}

                {paymentConfig.bankEnabled && (
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('bank')}
                    className={`min-h-[46px] p-2 rounded-xl font-label-sm text-label-sm flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                      selectedPaymentMethod === 'bank'
                        ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                        : 'bg-surface-container-low text-on-surface border-outline-variant/30'
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
                    className={`min-h-[46px] p-2 rounded-xl font-label-sm text-label-sm flex flex-col items-center justify-center gap-0.5 border cursor-pointer ${
                      selectedPaymentMethod === 'tunai'
                        ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                        : 'bg-surface-container-low text-on-surface border-outline-variant/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">payments</span>
                    <span>Tunai Kasir</span>
                  </button>
                )}
              </div>
            </div>

            {/* INSTRUKSI PEMBAYARAN SESUAI METODE YANG DIPILIH */}
            {selectedPaymentMethod === 'gateway' && (
              <div className="p-3.5 rounded-xl bg-secondary-container/40 border border-secondary/30 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-secondary font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">verified_user</span>
                    Mode Simulasi Payment Gateway (Midtrans Snap Sandbox)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-lowest text-secondary font-bold">
                    Saldo Aman Rp 0
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-on-surface leading-relaxed">
                  Klik tombol di bawah untuk membuka jendela simulasi pembayaran otomatis. Begitu Anda klik <strong>&ldquo;Simulasikan Pembayaran Berhasil&rdquo;</strong>, status pesanan otomatis <strong>LUNAS TERVERIFIKASI</strong> dan saldo penjual langsung bertambah!
                </p>
              </div>
            )}

            {selectedPaymentMethod === 'qris' && (
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col items-center text-center gap-2.5">
                <div className="flex items-center justify-between w-full text-left">
                  <span className="font-label-sm text-on-surface font-bold">
                    Scan QRIS Resmi {paymentConfig.qrisMerchantName}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-bold">
                    NMID: {paymentConfig.qrisNmid}
                  </span>
                </div>

                {/* Visual QRIS Box */}
                <div className="bg-white p-3.5 rounded-xl border-2 border-primary/30 flex flex-col items-center gap-1.5 shadow-xs">
                  {paymentConfig.qrisImage || paymentQrisDataUrl ? (
                    <img
                      src={paymentConfig.qrisImage || paymentQrisDataUrl}
                      alt="QRIS Kantin"
                      className="w-44 h-44 object-contain rounded"
                    />
                  ) : (
                    <div className="w-40 h-40 rounded-lg bg-surface-container flex flex-col items-center justify-center p-2 border-2 border-dashed border-on-surface/30">
                      <span className="material-symbols-outlined text-[64px] text-on-surface">
                        qr_code_2
                      </span>
                      <span className="text-[10px] font-bold text-on-surface">
                        QRIS STANDAR NASIONAL
                      </span>
                    </div>
                  )}
                  <span className="text-[10px] font-mono font-bold text-slate-600">
                    QRIS STANDAR NASIONAL • {paymentConfig.qrisNmid}
                  </span>
                  <span className="font-label-md text-primary font-bold">
                    Nominal: Rp {cartTotalAmount.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
                  {(['DANA', 'GoPay', 'OVO', 'ShopeePay'] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setSelectedEwalletProvider(prov)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer border ${
                        selectedEwalletProvider === prov
                          ? 'bg-secondary text-on-secondary border-secondary'
                          : 'bg-surface-container-lowest text-on-surface border-outline-variant/30'
                      }`}
                    >
                      Bayar pakai {prov}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedPaymentMethod === 'ewallet' && (
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-on-surface font-bold">
                    Transfer Langsung ke E-Wallet Penjual
                  </span>
                  <span className="text-[11px] text-secondary font-semibold">
                    Bebas Biaya Admin
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['DANA', 'GoPay', 'OVO', 'ShopeePay'] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setSelectedEwalletProvider(prov)}
                      className={`px-3 py-1 rounded-lg text-label-sm font-semibold cursor-pointer border ${
                        selectedEwalletProvider === prov
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-lowest text-on-surface border-outline-variant/30'
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-on-surface-variant">
                      Nomor {selectedEwalletProvider} ({paymentConfig.ewalletAccountName}):
                    </span>
                    <span className="font-headline-md text-[17px] text-on-surface font-bold tracking-wide">
                      {paymentConfig.ewalletNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        paymentConfig.ewalletNumber,
                        `Nomor ${selectedEwalletProvider}`
                      )
                    }
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold cursor-pointer"
                  >
                    Salin Nomor
                  </button>
                </div>
              </div>
            )}

            {selectedPaymentMethod === 'bank' && (
              <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2">
                <span className="font-label-sm text-on-surface font-bold">
                  Transfer Rekening Bank Penjual ({paymentConfig.bankName})
                </span>
                <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-on-surface-variant">
                      A.n. {paymentConfig.bankAccountName}
                    </span>
                    <span className="font-headline-md text-[17px] text-on-surface font-bold tracking-wide">
                      {paymentConfig.bankAccountNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(paymentConfig.bankAccountNumber, 'Nomor Rekening')
                    }
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold cursor-pointer"
                  >
                    Salin Rekening
                  </button>
                </div>
              </div>
            )}

            {selectedPaymentMethod === 'tunai' && (
              <div className="p-3.5 rounded-xl bg-tertiary-fixed/40 border border-tertiary/40 text-on-surface flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[22px] text-tertiary">
                  point_of_sale
                </span>
                <span className="font-body-sm text-[12px] leading-relaxed">
                  Pesanan Anda akan langsung dikirim ke layar <strong>{stall.name}</strong>. Silakan siapkan uang tunai pas sebesar{' '}
                  <strong>Rp {cartTotalAmount.toLocaleString('id-ID')}</strong> saat mengambil makanan di stan.
                </span>
              </div>
            )}

            {selectedPaymentMethod !== 'tunai' && selectedPaymentMethod !== 'gateway' && (
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Catatan / Nama Pengirim di {selectedEwalletProvider} / M-Banking (Untuk Dicek Penjual)
                </label>
                <input
                  type="text"
                  placeholder={`Contoh: Sudah transfer dari ${selectedEwalletProvider} a.n. ${
                    studentName || 'Kevin'
                  }`}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                />
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="w-1/3 min-h-[48px] rounded-xl bg-surface-container text-on-surface font-label-md text-label-md font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-2/3 min-h-[48px] rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {selectedPaymentMethod === 'gateway' ? 'bolt' : 'check_circle'}
                </span>
                <span>
                  {selectedPaymentMethod === 'gateway'
                    ? 'Lanjut ke Payment Gateway (Simulasi)'
                    : selectedPaymentMethod === 'tunai'
                    ? 'Kirim Pesanan ke Stan'
                    : 'Konfirmasi Sudah Bayar'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POP-UP SIMULASI PAYMENT GATEWAY OTOMATIS (MIDTRANS SNAP SANDBOX) */}
      {snapGatewayOpen && (
        <div className="fixed inset-0 z-[60] bg-on-surface/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-outline-variant/40 flex flex-col">
            {/* Top Sandbox Header Bar */}
            <div className="bg-primary text-on-primary px-5 py-4 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed font-mono text-[10px] font-bold uppercase">
                    SANDBOX SIMULATOR
                  </span>
                  <span className="text-[11px] text-on-primary/80 font-medium">
                    KantinKu Pay • Midtrans Snap
                  </span>
                </div>
                <span className="font-headline-md text-[17px] font-bold mt-0.5">
                  {stall.name} — IBI KKG
                </span>
              </div>
              <button
                type="button"
                aria-label="Tutup Simulator"
                onClick={() => setSnapGatewayOpen(false)}
                className="w-11 h-11 rounded-full bg-on-primary/15 text-on-primary flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Amount & Order ID Banner */}
            <div className="bg-surface-container-low px-5 py-3 border-b border-outline-variant/30 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[11px] text-on-surface-variant">Total Tagihan</span>
                <span className="font-headline-md text-[20px] text-primary font-bold">
                  Rp {cartTotalAmount.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-on-surface-variant">ID Transaksi Sandbox</span>
                <span className="font-mono text-xs font-bold text-on-surface">{snapTxId}</span>
              </div>
            </div>

            {/* Body Step: Select Channel / Processing / Success */}
            <div className="p-5 flex flex-col gap-4">
              {snapStep === 'select' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <span className="font-label-sm text-on-surface font-bold">
                      Pilih Kanal Pembayaran Otomatis:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          id: 'qris_snap',
                          label: 'QRIS Dinamis',
                          sub: 'DANA, GoPay, OVO, M-Banking',
                          icon: 'qr_code_2',
                        },
                        {
                          id: 'gopay_dana',
                          label: 'GoPay / DANA Instant',
                          sub: 'Auto-Debit E-Wallet',
                          icon: 'account_balance_wallet',
                        },
                        {
                          id: 'bca_va',
                          label: 'BCA Virtual Account',
                          sub: 'Cek Otomatis',
                          icon: 'account_balance',
                        },
                        {
                          id: 'mandiri_va',
                          label: 'Mandiri Bill / Livin',
                          sub: 'Cek Otomatis',
                          icon: 'credit_card',
                        },
                      ].map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() =>
                            setSnapChannel(
                              ch.id as 'qris_snap' | 'gopay_dana' | 'bca_va' | 'mandiri_va'
                            )
                          }
                          className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 cursor-pointer transition-all ${
                            snapChannel === ch.id
                              ? 'bg-primary-fixed/60 border-primary text-on-primary-fixed font-bold'
                              : 'bg-surface-container-low border-outline-variant/30 text-on-surface'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-primary">
                              {ch.icon}
                            </span>
                            <span className="text-xs font-bold">{ch.label}</span>
                          </div>
                          <span className="text-[10px] text-on-surface-variant">{ch.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visual Preview inside Snap */}
                  {snapChannel === 'qris_snap' && (
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col items-center text-center gap-2">
                      <div className="rounded-xl bg-white border-2 border-primary/30 flex flex-col items-center justify-center p-3 shadow-xs gap-1">
                        {paymentQrisDataUrl ? (
                          <img
                            src={paymentQrisDataUrl}
                            alt="QRIS Dinamis"
                            className="w-40 h-40 object-contain"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-[72px] text-on-surface">
                            qr_code_2
                          </span>
                        )}
                        <span className="text-[9px] font-mono font-bold text-primary">
                          QRIS DINAMIS • {snapTxId}
                        </span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        Nominal <strong>Rp {cartTotalAmount.toLocaleString('id-ID')}</strong> sudah terkunci otomatis di dalam kode QRIS ini.
                      </span>
                    </div>
                  )}

                  {snapChannel === 'gopay_dana' && (
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                      <span className="text-xs font-bold text-on-surface">
                        Pilih Aplikasi E-Wallet Simulasi:
                      </span>
                      <div className="flex gap-2">
                        {(['DANA', 'GoPay', 'OVO', 'ShopeePay'] as const).map((prov) => (
                          <button
                            key={prov}
                            type="button"
                            onClick={() => setSelectedEwalletProvider(prov)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                              selectedEwalletProvider === prov
                                ? 'bg-secondary text-on-secondary border-secondary'
                                : 'bg-surface-container-lowest text-on-surface border-outline-variant/30'
                            }`}
                          >
                            {prov}
                          </button>
                        ))}
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        Klik tombol hijau di bawah untuk menyimulasikan pelunasan instan via{' '}
                        <strong>{selectedEwalletProvider}</strong>.
                      </span>
                    </div>
                  )}

                  {(snapChannel === 'bca_va' || snapChannel === 'mandiri_va') && (
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1.5">
                      <span className="text-[11px] text-on-surface-variant">
                        Nomor Virtual Account Simulasi ({snapChannel === 'bca_va' ? 'BCA' : 'Mandiri'}):
                      </span>
                      <div className="flex items-center justify-between bg-surface-container-lowest p-2.5 rounded-lg border border-outline-variant/30">
                        <span className="font-mono text-base font-bold text-on-surface tracking-wider">
                          {snapChannel === 'bca_va' ? '88012 0812 9000 198' : '70014 0812 9000 198'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText('8801208129000198', 'Nomor Virtual Account')
                          }
                          className="text-xs text-primary font-bold cursor-pointer"
                        >
                          Salin
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Rincian Aliran Dana */}
                  <div className="p-3 rounded-xl bg-surface-container text-[11px] text-on-surface-variant flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span>Hak Bersih Penjual ({stall.name}):</span>
                      <strong className="text-on-surface">
                        Rp {cartSubtotalAmount.toLocaleString('id-ID')}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Pendapatan Platform (Biaya Layanan):</span>
                      <strong className="text-secondary">
                        Rp {PLATFORM_SERVICE_FEE.toLocaleString('id-ID')}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateGatewaySuccess}
                    className="w-full min-h-[48px] py-3 rounded-xl bg-secondary hover:opacity-95 text-on-secondary font-label-lg text-label-lg font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-[0.99]"
                  >
                    <span className="material-symbols-outlined text-[20px]">verified</span>
                    <span>Simulasikan Pembayaran Berhasil (Lunas)</span>
                  </button>
                </>
              )}

              {snapStep === 'processing' && (
                <div className="py-8 flex flex-col items-center text-center gap-3">
                  <span className="material-symbols-outlined text-[44px] text-primary animate-spin">
                    sync
                  </span>
                  <h4 className="font-headline-md text-[17px] text-on-surface font-bold">
                    Memverifikasi Callback Payment Gateway...
                  </h4>
                  <p className="font-body-sm text-xs text-on-surface-variant max-w-xs">
                    Menghubungkan ke server Sandbox &amp; meneruskan notifikasi lunas otomatis ke Dashboard {stall.name}.
                  </p>
                </div>
              )}

              {snapStep === 'success' && (
                <div className="py-6 flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-secondary-container text-secondary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[34px]">check_circle</span>
                  </div>
                  <h4 className="font-headline-md text-[18px] text-secondary font-bold">
                    Pembayaran Berhasil &amp; Terverifikasi!
                  </h4>
                  <p className="font-body-sm text-xs text-on-surface-variant max-w-xs">
                    Dana Rp {cartSubtotalAmount.toLocaleString('id-ID')} telah masuk ke saldo {stall.name}. Pesanan Anda sedang disiapkan!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
