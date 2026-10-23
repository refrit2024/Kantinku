import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  getPublicStallUrl,
  getStallPaymentDetails,
  MenuItem,
  normalizeStallLocation,
  OrderStatusType,
  OrderTransaction,
  PaymentDetails,
  PriceDiscrepancyReport,
  SellerAccount,
  Stall,
  WithdrawalRecord,
} from '../data/kantinData';
import { StallQrModal } from './StallQrModal';
import {
  compressUploadedImage,
  generateReceiptSecurityCode,
  PRICE_BOUNDS,
  sanitizeMenuPrice,
} from '../utils/securityGuard';

export type SellerSubTab =
  | 'dashboard'
  | 'pesanan'
  | 'menu'
  | 'pembayaran'
  | 'laporan'
  | 'profil'
  | 'ulasan'
  | 'pengaturan';

interface KelolaMenuScreenProps {
  stall: Stall;
  allStalls?: Stall[];
  orders: OrderTransaction[];
  priceReports?: PriceDiscrepancyReport[];
  onResolvePriceReport?: (
    reportId: string,
    nextStatus: 'sp_sent' | 'resolved' | 'dismissed',
    adminNote?: string,
    syncCatalogPrice?: boolean
  ) => void;
  sellerEmail?: string;
  loggedInSeller?: SellerAccount | null;
  onUpdateSellerPassword?: (accountId: string, newPassword: string) => void;
  onSwitchSellerStall?: (stallId: string) => void;
  onLogoutSeller?: () => void;
  onToggleStoreOpen: () => void;
  onToggleMenuStatus: (itemId: string) => void;
  onUpdateMenuPrice: (itemId: string, newPrice: number) => void;
  onAddMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  onEditMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (itemId: string) => void;
  onUpdateStallProfile: (updated: Partial<Stall>) => void;
  onUpdateOrderStatus: (orderId: string, nextStatus: OrderStatusType) => void;
  onReplyReview: (reviewId: string, replyText: string) => void;
  onShowToast: (
    message: string,
    isError?: boolean,
    action?: { label: string; onClick: () => void }
  ) => void;
}

const PRESET_FOOD_PHOTOS = [
  {
    label: 'Ayam Geprek / Lalapan',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB33IS6pEIcAYrx6GRR1RsXoW7Trjn0Ywl6MK6PJl-7Ys6sR6mA09jO-Un5cgpdQLRDE6gTM60I6ZFsrZlygxQcDQHJdTO7oetSvvKLjufjsXi6gOaY3pAg4n3DI_2ONKgXL-xrjlFPkxi_Ftoue8RAJWpWCiY2QJ8s29RL7rypr0cHn9pNd9sg6isQbbf18mH56TlsXI2oWpZAcSTQQWd2vjbrgmymcIs7GoKr55WZ',
  },
  {
    label: 'Nasi Goreng Telur',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTuP8_3rlK7tIejRf6tGe1ub4OB5CkrThvPV56mK22-CIDqtukZLFklQUlSjlNoyVBhyrpxro6zVy7tZuxlQYDB3Gbae2T1-hIdd3MiM2FAQoYyg0rFFeAaEm_v4mE7CQS7zw7FgHBVtBm5YdvshSHPXauZS--0FWogpuCU_uqB74kZluJHgWZu7IQTh2YeGo5zNzWFCkhcBk_uRXTOcHn1ePi-C7mi9riux2BLUGU',
  },
  {
    label: 'Mie Ayam Bakso',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClG5VdjIoR8LwnzW5-CNJR0S8OdL9_dtV5alBorYEflyaY-sXnx317TevIzp5AiFie-ps_i4iAopzqqgmRJ8TMHY7IfipeA74c69F83srSyditZSY5VoFr4ZSKzvB995kup5GMFx8ujHNKoi9ISo53dmzNRMOnFMtH4ZQlwoz_mzlWRkQk2W7OH6Q34kzxaTTpJrVk6JtO4KimphqPh8Zw3kxhBlHYeHDRUPX2iKb4',
  },
  {
    label: 'Es Teh / Minuman Dingin',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAkgGtl4GxdpXZClh6ucObJmh53ySgoa63hdrPLpmweSYkhopHLuKCQ6bxbwjc7-xLIsFz_d3vlCGwwmVAM7pDM2cspI-IkryEisRwq1YHqfkb8WmA0x0hnjF6zRnTGsCfYC4jumTJ7nvwPqbfWw-6Z1unHb3CyvT3N-e3zhy98XRbZLc2uErClYaC8bI4YxfujCmXlYHqYWtYjlynMiYjhcwyjTngV8h_gqdGsZCG',
  },
  {
    label: 'Gorengan / Telur Crispy',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4KN-sy1xRHIj7X9GGPRx6zhpo-fFDA4UwEZzGOgPcbiIeuHGtqZxPlAb6F774DTMbO3MyhTs9j0yoSmO_v-RUI7qjreZlElLMuq0M6sYP-cFqWwKi61bi-0TyYk64bOqHIYh7SOOVhrS1dq4ikA32s5A-TZ1dbN7W4XLxBnds0cKJQYVamp-bgBSL_v4K8yjn4ndSJg-sbi48jQpXq8UNC2jSnEUHHiv93ft6C-bi',
  },
];

export const KelolaMenuScreen: React.FC<KelolaMenuScreenProps> = ({
  stall: rawStall,
  allStalls = [],
  orders,
  priceReports = [],
  onResolvePriceReport,
  sellerEmail,
  loggedInSeller,
  onUpdateSellerPassword,
  onSwitchSellerStall,
  onLogoutSeller,
  onToggleStoreOpen,
  onToggleMenuStatus,
  onUpdateMenuPrice,
  onAddMenuItem,
  onEditMenuItem,
  onDeleteMenuItem,
  onUpdateStallProfile,
  onUpdateOrderStatus,
  onReplyReview,
  onShowToast,
}) => {
  const stall = normalizeStallLocation(rawStall);
  const stallPriceReports = priceReports.filter(
    (r) =>
      (r.stallId === stall.id || r.stallName.toLowerCase() === stall.name.toLowerCase()) &&
      (r.status === 'sp_sent' || r.status === 'pending')
  );
  const activeSpReports = stallPriceReports.filter((r) => r.status === 'sp_sent');
  const [sellerSubTab, setSellerSubTab] = useState<SellerSubTab>('dashboard');
  const [newSellerPassInput, setNewSellerPassInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'makanan' | 'minuman' | 'snack' | 'habis'
  >('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<MenuItem | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [stallQrDataUrl, setStallQrDataUrl] = useState<string>('');
  const [qrisPreviewDataUrl, setQrisPreviewDataUrl] = useState<string>('');

  // Laporan Penjualan & Ekspor Struk State
  const [reportPeriod, setReportPeriod] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [isPrintRecapOpen, setIsPrintRecapOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const stallUrl = getPublicStallUrl(stall.id);

    QRCode.toDataURL(stallUrl, {
      width: 320,
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
    const nmid = stall.paymentDetails?.qrisNmid || 'ID2026001018829';
    const merchant = stall.paymentDetails?.qrisMerchantName || stall.name;
    const payload = `00020101021226660016ID.CO.QRIS.WWW011893600914${nmid}5204581253033605802ID5925${merchant.slice(0, 24)}6013JAKARTA UTARA6304A1B2`;
    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
      color: { dark: '#181C22', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (mounted) setQrisPreviewDataUrl(url);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [stall.name, stall.paymentDetails?.qrisNmid, stall.paymentDetails?.qrisMerchantName]);

  // Direct-to-Merchant Payment Settings State (QRIS, DANA/GoPay/OVO, Bank, Tunai)
  const initialPay = getStallPaymentDetails(stall);
  const [payQrisEnabled, setPayQrisEnabled] = useState(initialPay.qrisEnabled);
  const [payQrisMerchantName, setPayQrisMerchantName] = useState(initialPay.qrisMerchantName);
  const [payQrisNmid, setPayQrisNmid] = useState(initialPay.qrisNmid);
  const [payQrisImage, setPayQrisImage] = useState(initialPay.qrisImage || '');

  const [payEwalletEnabled, setPayEwalletEnabled] = useState(initialPay.ewalletEnabled);
  const [payEwalletProviders, setPayEwalletProviders] = useState(initialPay.ewalletProviders);
  const [payEwalletNumber, setPayEwalletNumber] = useState(initialPay.ewalletNumber);
  const [payEwalletAccountName, setPayEwalletAccountName] = useState(
    initialPay.ewalletAccountName
  );

  const [payBankEnabled, setPayBankEnabled] = useState(initialPay.bankEnabled);
  const [payBankName, setPayBankName] = useState(initialPay.bankName);
  const [payBankAccountNumber, setPayBankAccountNumber] = useState(
    initialPay.bankAccountNumber
  );
  const [payBankAccountName, setPayBankAccountName] = useState(initialPay.bankAccountName);
  const [payCashEnabled, setPayCashEnabled] = useState(initialPay.cashEnabled);

  const stallOrders = orders.filter((o) => o.stallId === stall.id);
  const otherStallOrders = orders.filter(
    (o) => o.stallId !== stall.id && o.status !== 'rejected'
  );
  const activeOrdersCount = stallOrders.filter(
    (o) => o.status !== 'completed' && o.status !== 'rejected'
  ).length;
  const totalRevenueToday = stallOrders
    .filter((o) => o.status !== 'rejected')
    .reduce((sum, o) => sum + (o.subtotalAmount ?? o.totalAmount), 0);

  const filteredReportOrders = useMemo(() => {
    if (reportPeriod === 'today') {
      return stallOrders.filter(
        (o) =>
          o.createdAt.toLowerCase().includes('hari ini') ||
          o.createdAt.toLowerCase().includes('baru saja')
      );
    }
    if (reportPeriod === '7days') {
      return stallOrders.filter(
        (o) =>
          o.createdAt.toLowerCase().includes('hari ini') ||
          o.createdAt.toLowerCase().includes('kemarin') ||
          o.createdAt.toLowerCase().includes('baru saja')
      );
    }
    return stallOrders;
  }, [stallOrders, reportPeriod]);

  const reportMetrics = useMemo(() => {
    const completed = filteredReportOrders.filter(
      (o) => o.status === 'completed' || o.status === 'ready_pickup' || o.status === 'cooking'
    );
    const rejected = filteredReportOrders.filter((o) => o.status === 'rejected');
    const totalOmset = completed.reduce(
      (sum, o) => sum + (o.subtotalAmount ?? o.totalAmount),
      0
    );
    const gatewayOmset = completed
      .filter((o) => o.paymentStatus === 'paid_gateway')
      .reduce((sum, o) => sum + (o.subtotalAmount ?? o.totalAmount), 0);
    const cashOmset = completed
      .filter((o) => o.paymentStatus !== 'paid_gateway')
      .reduce((sum, o) => sum + (o.subtotalAmount ?? o.totalAmount), 0);
    const dineInCount = completed.filter((o) => o.fulfillmentType === 'dine_in').length;
    const pickupCount = completed.filter((o) => o.fulfillmentType === 'pickup').length;

    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    completed.forEach((ord) => {
      ord.items.forEach((item) => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = { name: item.name, quantity: 0, revenue: 0 };
        }
        itemMap[item.name].quantity += item.quantity;
        itemMap[item.name].revenue += item.price * item.quantity;
      });
    });
    const bestSellers = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
    const avgBasket = completed.length > 0 ? Math.round(totalOmset / completed.length) : 0;

    return {
      completedCount: completed.length,
      rejectedCount: rejected.length,
      totalOmset,
      gatewayOmset,
      cashOmset,
      dineInCount,
      pickupCount,
      bestSellers,
      avgBasket,
    };
  }, [filteredReportOrders]);

  // Real-Time Sound Alert ("Ting-Tong!") & Live Order Banner State for Seller
  const [soundAlertEnabled, setSoundAlertEnabled] = useState<boolean>(true);
  const [liveOrderAlert, setLiveOrderAlert] = useState<OrderTransaction | null>(null);
  const seenOrderIdsRef = useRef<Set<string> | null>(null);
  const lastStallIdRef = useRef<string>(stall.id);

  // Web Audio API Synthesizer for clear 2-tone "Ting-Tong!" Kitchen Bell
  const playTingTongSound = (announceText?: string) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        // First chime: "TING!" (High E5 - 659.25 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.45, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.46);

        // Second chime: "TONG!" (Warm C5 - 523.25 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(523.25, now + 0.28);
        gain2.gain.setValueAtTime(0.001, now + 0.28);
        gain2.gain.exponentialRampToValueAtTime(0.5, now + 0.31);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.28);
        osc2.stop(now + 1.08);

        // Repeat chime once more after 1.15s so busy seller definitely hears it
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(783.99, now + 1.15); // G5
        gain3.gain.setValueAtTime(0.001, now + 1.15);
        gain3.gain.exponentialRampToValueAtTime(0.4, now + 1.18);
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.55);
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(now + 1.15);
        osc3.stop(now + 1.56);

        const osc4 = ctx.createOscillator();
        const gain4 = ctx.createGain();
        osc4.type = 'sine';
        osc4.frequency.setValueAtTime(523.25, now + 1.42); // C5
        gain4.gain.setValueAtTime(0.001, now + 1.42);
        gain4.gain.exponentialRampToValueAtTime(0.45, now + 1.45);
        gain4.gain.exponentialRampToValueAtTime(0.001, now + 2.15);
        osc4.connect(gain4);
        gain4.connect(ctx.destination);
        osc4.start(now + 1.42);
        osc4.stop(now + 2.18);
      }

      // Optional Indonesian Voice Announcement if supported by browser
      if (announceText && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(announceText);
        utter.lang = 'id-ID';
        utter.rate = 1.02;
        setTimeout(() => {
          window.speechSynthesis.speak(utter);
        }, 700);
      }
    } catch {
      // ignore audio context block if no user interaction yet
    }
  };

  // Detect brand new incoming orders in real-time from Firestore
  useEffect(() => {
    // Reset seen set if seller switches stall
    if (lastStallIdRef.current !== stall.id) {
      lastStallIdRef.current = stall.id;
      seenOrderIdsRef.current = new Set(stallOrders.map((o) => o.id));
      return;
    }

    if (seenOrderIdsRef.current === null) {
      seenOrderIdsRef.current = new Set(stallOrders.map((o) => o.id));
      return;
    }

    const newlyArrived = stallOrders.filter(
      (o) => !seenOrderIdsRef.current!.has(o.id) && o.status !== 'rejected'
    );

    if (newlyArrived.length > 0) {
      newlyArrived.forEach((o) => seenOrderIdsRef.current!.add(o.id));
      const latestOrder = newlyArrived[0];
      setLiveOrderAlert(latestOrder);
      if (soundAlertEnabled) {
        const menuSummary = latestOrder.items
          .map((i) => `${i.quantity} ${i.name}`)
          .join(', ');
        const fulfillmentText =
          latestOrder.fulfillmentType === 'dine_in'
            ? `makan di tempat meja ${latestOrder.tableNumber || 'kantin'}`
            : 'ambil di stan';
        const isPaidGateway = latestOrder.paymentStatus === 'paid_gateway';
        const payStatusVoice = isPaidGateway ? 'sudah lunas otomatis' : 'menunggu konfirmasi';
        playTingTongSound(
          `Pesanan baru masuk ${payStatusVoice} di ${stall.name}, ${fulfillmentText}, atas nama ${latestOrder.studentName}, ${menuSummary}`
        );
      }
    }
  }, [stallOrders, stall.id, stall.name, soundAlertEnabled]);

  const totalGatewayEarned = stallOrders
    .filter(
      (o) =>
        o.status !== 'rejected' &&
        (o.paymentStatus === 'paid_gateway' ||
          o.paymentMethod === 'gateway' ||
          o.paymentMethod === 'qris' ||
          o.paymentMethod === 'ewallet' ||
          o.paymentMethod === 'bank' ||
          o.status !== 'waiting_payment_verification')
    )
    .reduce((sum, o) => sum + (o.subtotalAmount ?? o.totalAmount), 0);

  const withdrawalHistory: WithdrawalRecord[] = stall.withdrawalHistory || [];
  const totalWithdrawn = withdrawalHistory.reduce((sum, w) => sum + w.amount, 0);
  const gatewayBalance = Math.max(0, totalGatewayEarned - totalWithdrawn);

  const [withdrawDestination, setWithdrawDestination] = useState<'ewallet' | 'bank'>('ewallet');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleWithdrawSellerBalance = () => {
    if (gatewayBalance <= 0 || isWithdrawing) {
      onShowToast('Belum ada saldo penjualan baru yang siap ditarik.');
      return;
    }
    setIsWithdrawing(true);
    const nowStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const destLabel =
      withdrawDestination === 'ewallet'
        ? `${payEwalletProviders} (${payEwalletNumber} a.n. ${payEwalletAccountName})`
        : `Bank ${payBankName} (${payBankAccountNumber} a.n. ${payBankAccountName})`;

    setTimeout(() => {
      const newRecord: WithdrawalRecord = {
        id: `WD-${Date.now().toString().slice(-6)}`,
        amount: gatewayBalance,
        destinationType: withdrawDestination,
        destinationLabel: destLabel,
        status: 'completed',
        createdAt: `Hari ini, ${nowStr} WIB`,
      };
      onUpdateStallProfile({
        withdrawalHistory: [newRecord, ...withdrawalHistory],
        lastUpdatedDate: '8 Oktober 2026',
        lastUpdatedTime: 'Baru saja',
      });
      setIsWithdrawing(false);
      onShowToast(
        `Berhasil! Saldo Rp ${newRecord.amount.toLocaleString('id-ID')} (Bebas Potongan Rp 0) telah ditransfer ke ${destLabel}!`
      );
    }, 900);
  };

  const handleCopyRecapWhatsApp = () => {
    const periodLabel =
      reportPeriod === 'today'
        ? 'Hari Ini'
        : reportPeriod === '7days'
        ? '7 Hari Terakhir'
        : reportPeriod === 'month'
        ? 'Bulan Ini'
        : 'Semua Riwayat';
    const menuLines = reportMetrics.bestSellers
      .map((m) => `• ${m.quantity}x ${m.name} = Rp ${m.revenue.toLocaleString('id-ID')}`)
      .join('\n');
    const text =
      `*📊 REKAP PENJUALAN - ${stall.name.toUpperCase()}*\n` +
      `📅 Periode: ${periodLabel}\n` +
      `⏰ Waktu Rekap: ${new Date().toLocaleTimeString('id-ID')} WIB\n\n` +
      `*💰 RINGKASAN OMSET:*\n` +
      `• Total Penjualan: Rp ${reportMetrics.totalOmset.toLocaleString('id-ID')}\n` +
      `• Gateway (QRIS/VA): Rp ${reportMetrics.gatewayOmset.toLocaleString('id-ID')}\n` +
      `• Kasir Tunai: Rp ${reportMetrics.cashOmset.toLocaleString('id-ID')}\n` +
      `• Total Pesanan: ${reportMetrics.completedCount} berhasil (${reportMetrics.rejectedCount} batal)\n` +
      `• Makan di Meja: ${reportMetrics.dineInCount} | Ambil Stan: ${reportMetrics.pickupCount}\n\n` +
      `*🍽️ MENU TERJUAL:*\n` +
      `${menuLines || 'Belum ada data menu terjual'}\n\n` +
      `_Sistem Operasi KantinKu IBI KKG & Multi-UMKM_`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      onShowToast('✓ Ringkasan rekap berhasil disalin ke clipboard! Siap kirim ke WhatsApp.');
    } else {
      onShowToast('Format teks telah disiapkan.');
    }
  };

  const handleQrisImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressUploadedImage(file, 640, 0.72)
      .then((compressed) => {
        setPayQrisImage(compressed);
        onShowToast('Gambar Barcode QRIS berhasil dikompresi & dipilih!');
      })
      .catch(() => {
        onShowToast('Gagal memproses gambar QRIS.');
      });
  };

  const handleSavePaymentSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedDetails: PaymentDetails = {
      qrisEnabled: payQrisEnabled,
      qrisMerchantName: payQrisMerchantName.trim() || `${stall.name.toUpperCase()} - IBI KKG`,
      qrisNmid: payQrisNmid.trim() || 'ID2026001018829',
      qrisImage: payQrisImage || undefined,
      ewalletEnabled: payEwalletEnabled,
      ewalletProviders: payEwalletProviders.trim() || 'DANA / GoPay / OVO / ShopeePay',
      ewalletNumber: payEwalletNumber.trim() || '081290001980',
      ewalletAccountName: payEwalletAccountName.trim() || stall.name,
      bankEnabled: payBankEnabled,
      bankName: payBankName.trim() || 'BCA / Mandiri',
      bankAccountNumber: payBankAccountNumber.trim() || '6840928114',
      bankAccountName: payBankAccountName.trim() || stall.name,
      cashEnabled: payCashEnabled,
    };

    const summaryLabels: string[] = [];
    if (updatedDetails.qrisEnabled) summaryLabels.push('QRIS (Semua Bank & E-Wallet)');
    if (updatedDetails.ewalletEnabled)
      summaryLabels.push(`${updatedDetails.ewalletProviders} (${updatedDetails.ewalletNumber})`);
    if (updatedDetails.bankEnabled)
      summaryLabels.push(`Transfer ${updatedDetails.bankName}`);
    if (updatedDetails.cashEnabled) summaryLabels.push('Tunai di Kasir');

    onUpdateStallProfile({
      paymentDetails: updatedDetails,
      paymentMethods: summaryLabels.length > 0 ? summaryLabels : ['Tunai di Kasir'],
      lastUpdatedDate: '8 Oktober 2026',
      lastUpdatedTime: 'Baru saja',
    });
    onShowToast(
      'Pengaturan Rekening, DANA/E-Wallet & QRIS berhasil disimpan ke halaman mahasiswa!'
    );
  };

  // Add/Edit Menu Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('15000');
  const [formCategory, setFormCategory] = useState<'makanan' | 'minuman' | 'snack'>('makanan');
  const [formStatus, setFormStatus] = useState<'ready' | 'habis'>('ready');
  const [formImage, setFormImage] = useState(PRESET_FOOD_PHOTOS[0].url);

  // Profil Kantin Form State
  const [profName, setProfName] = useState(stall.name);
  const [profSpecialty, setProfSpecialty] = useState(stall.specialty);
  const [profDesc, setProfDesc] = useState(stall.description);
  const [profLocation, setProfLocation] = useState(stall.fullLocation);
  const [profDays, setProfDays] = useState(stall.daysOpen);
  const [profHours, setProfHours] = useState(stall.hours);
  const [profWhatsapp, setProfWhatsapp] = useState(stall.whatsapp);
  const [profQris, setProfQris] = useState(true);
  const [profDineIn, setProfDineIn] = useState(stall.dineInAvailable !== false);
  const [profHeroImg, setProfHeroImg] = useState(stall.heroImage);

  // Reply state for reviews
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // Seller Evaluation State
  const [sellerAccountEmail] = useState('busari.kantin@ibikkg.ac.id');
  const [evalSelfInput, setEvalSelfInput] = useState(true);
  const [evalPriceUpdate, setEvalPriceUpdate] = useState(true);
  const [evalContinueUse, setEvalContinueUse] = useState(true);

  const items = stall.menuItems;
  const makananCount = items.filter((i) => i.category === 'makanan').length;
  const minumanCount = items.filter((i) => i.category === 'minuman').length;
  const snackCount = items.filter((i) => i.category === 'snack').length;
  const habisCount = items.filter((i) => i.status === 'habis').length;

  const filteredItems = items.filter((item) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'habis') return item.status === 'habis';
    return item.category === activeCategory;
  });

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormDesc('');
    setFormPrice('15000');
    setFormCategory('makanan');
    setFormStatus('ready');
    setFormImage(PRESET_FOOD_PHOTOS[0].url);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormDesc(item.description);
    setFormPrice(String(item.price));
    setFormCategory(item.category);
    setFormStatus(item.status);
    setFormImage(item.imageMerchant);
    setIsAddModalOpen(true);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>, isProfile = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressUploadedImage(file, 720, 0.7)
      .then((compressed) => {
        if (isProfile) {
          setProfHeroImg(compressed);
          onShowToast('Foto profil kantin berhasil dikompresi & dipilih');
        } else {
          setFormImage(compressed);
          onShowToast('Foto makanan berhasil dikompresi & diunggah');
        }
      })
      .catch(() => {
        onShowToast('Gagal memproses file foto');
      });
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const priceCheck = sanitizeMenuPrice(formPrice);
    if (!priceCheck.valid) {
      onShowToast(
        priceCheck.reason ||
          `Harga menu harus di antara Rp ${PRICE_BOUNDS.MIN_PRICE.toLocaleString('id-ID')} – Rp ${PRICE_BOUNDS.MAX_PRICE.toLocaleString('id-ID')}.`
      );
      return;
    }
    const numericPrice = priceCheck.price;
    if (!formName.trim()) return;

    if (editingItem) {
      onEditMenuItem({
        ...editingItem,
        name: formName.trim().slice(0, 80),
        description: (formDesc.trim() || 'Hidangan segar kantin kampus IBI KKG').slice(0, 220),
        price: numericPrice,
        category: formCategory,
        status: formStatus,
        lastUpdated: '8 Oktober 2026 (Baru saja)',
        imageCatalog: formImage,
        imageMerchant: formImage,
      });
      onShowToast(
        `Menu "${formName.trim()}" disimpan (Rp${numericPrice.toLocaleString('id-ID')}) & tampil di katalog mahasiswa!`
      );
    } else {
      onAddMenuItem({
        name: formName.trim(),
        description: formDesc.trim() || 'Ayam geprek + nasi + sambal',
        price: numericPrice,
        category: formCategory,
        status: formStatus,
        lastUpdated: '8 Oktober 2026 (Baru saja)',
        imageCatalog: formImage,
        imageMerchant: formImage,
        altCatalog: formName.trim(),
        altMerchant: formName.trim(),
        icon:
          formCategory === 'minuman'
            ? 'local_cafe'
            : formCategory === 'snack'
            ? 'bakery_dining'
            : 'lunch_dining',
      });
      onShowToast(`Menu baru "${formName.trim()}" berhasil diterbitkan ke mahasiswa!`);
    }
    setIsAddModalOpen(false);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStallProfile({
      name: profName.trim() || stall.name,
      specialty: profSpecialty.trim() || stall.specialty,
      description: profDesc.trim() || stall.description,
      fullLocation: profLocation.trim() || stall.fullLocation,
      daysOpen: profDays.trim() || stall.daysOpen,
      hours: profHours.trim() || stall.hours,
      whatsapp: profWhatsapp.trim() || stall.whatsapp,
      heroImage: profHeroImg,
      bannerImage: profHeroImg,
      paymentMethods: profQris
        ? ['QRIS tersedia (Semua Bank & E-Wallet)', 'Tunai di Kasir']
        : ['Tunai di Kasir'],
      dineInAvailable: profDineIn,
      lastUpdatedDate: '8 Oktober 2026',
      lastUpdatedTime: 'Baru saja',
    });
    onShowToast('Profil Kantin & Jam Operasional berhasil diperbarui!');
  };

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Top Sub-Navigation Penjual (min-h 44px touch targets) + Sound Alert Control */}
      <div className="w-full bg-surface-container-low border-b border-outline-variant/25 px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1">
            {[
              { id: 'dashboard', label: 'Dashboard & Stok', icon: 'space_dashboard' },
              {
                id: 'pesanan',
                label: `Pesanan Masuk (${activeOrdersCount})`,
                icon: 'receipt_long',
              },
              { id: 'menu', label: 'Menu & Harga', icon: 'restaurant_menu' },
              {
                id: 'pembayaran',
                label: 'Rekening & Dompet',
                icon: 'account_balance_wallet',
              },
              {
                id: 'laporan',
                label: 'Rekap & Laporan',
                icon: 'monitoring',
              },
              { id: 'profil', label: 'Profil Kantin', icon: 'store' },
              { id: 'ulasan', label: `Ulasan (${stall.reviews.length})`, icon: 'reviews' },
              { id: 'pengaturan', label: 'Pengaturan', icon: 'settings' },
            ].map((tab) => {
              const isActive = sellerSubTab === tab.id;
              const isPesananWithActive = tab.id === 'pesanan' && activeOrdersCount > 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSellerSubTab(tab.id as SellerSubTab)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shrink-0 active:scale-[0.98] ${
                    isActive
                      ? 'bg-primary text-on-primary font-semibold shadow-xs'
                      : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface border border-outline-variant/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {isPesananWithActive && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-on-primary' : 'bg-secondary'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center shrink-0 pl-2 border-l border-outline-variant/25">
            <button
              type="button"
              onClick={() => {
                const next = !soundAlertEnabled;
                setSoundAlertEnabled(next);
                if (next) {
                  playTingTongSound();
                  onShowToast('Suara pengingat pesanan masuk ("Ting-Tong!") diaktifkan.');
                } else {
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  onShowToast('Suara pengingat pesanan masuk dinonaktifkan.');
                }
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl font-label-sm text-xs font-semibold flex items-center gap-1.5 border whitespace-nowrap transition-colors cursor-pointer active:scale-[0.98] ${
                soundAlertEnabled
                  ? 'bg-secondary-container text-on-secondary-container border-secondary/30 shadow-2xs'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/25'
              }`}
              title="Aktifkan/Matikan suara dering otomatis saat ada pesanan baru"
            >
              <span className="material-symbols-outlined text-[16px]">
                {soundAlertEnabled ? 'notifications_active' : 'notifications_off'}
              </span>
              <span className="hidden sm:inline">
                {soundAlertEnabled ? 'Suara Dering: ON' : 'Suara Dering: OFF'}
              </span>
              <span className="sm:hidden">{soundAlertEnabled ? 'Dering ON' : 'Dering OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Responsive Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex flex-col gap-5">
        {isQrModalOpen && (
          <StallQrModal
            stall={stall}
            allStalls={allStalls}
            onClose={() => setIsQrModalOpen(false)}
            onShowToast={onShowToast}
          />
        )}

        {liveOrderAlert && (
          <div
            role="alert"
            className="w-full rounded-xl bg-secondary text-on-secondary p-4 sm:p-5 shadow-lg border-2 border-secondary-container flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-on-secondary text-secondary flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[28px]">
                  notifications_active
                </span>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {liveOrderAlert.paymentStatus === 'paid_gateway' ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-400 text-slate-950 font-label-sm text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>TING-TONG! PESANAN LUNAS OTOMATIS (GATEWAY)</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-on-secondary text-secondary font-label-sm text-xs font-extrabold uppercase tracking-wider">
                      TING-TONG! PESANAN BARU MASUK
                    </span>
                  )}
                  <span className="font-mono text-xs font-bold text-on-secondary/90">
                    {liveOrderAlert.id} • {liveOrderAlert.createdAt}
                  </span>
                </div>
                <h3 className="font-headline-md text-lg sm:text-xl font-bold text-on-secondary leading-snug">
                  {liveOrderAlert.studentName} (NIM: {liveOrderAlert.studentNim}) —{' '}
                  <span className="underline decoration-2">
                    Rp {(liveOrderAlert.subtotalAmount ?? liveOrderAlert.totalAmount).toLocaleString('id-ID')}
                  </span>
                </h3>
                <div className="text-xs sm:text-sm text-on-secondary/95 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    <strong>Menu:</strong>{' '}
                    {liveOrderAlert.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </span>
                  <span>•</span>
                  <span>
                    {liveOrderAlert.fulfillmentType === 'dine_in' ? (
                      <span className="bg-amber-300 text-slate-950 px-2 py-0.5 rounded font-black inline-flex items-center gap-1 shadow-2xs">
                        <span className="material-symbols-outlined text-[14px]">table_restaurant</span>
                        <span>ANTAR KE MEJA: {liveOrderAlert.tableNumber || '-'}</span>
                      </span>
                    ) : (
                      <span>
                        <strong>Ambil:</strong> {liveOrderAlert.pickupTime}
                      </span>
                    )}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Bayar:</strong> {liveOrderAlert.paymentProviderLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => playTingTongSound()}
                className="min-h-[44px] px-3.5 py-2 rounded-lg bg-on-secondary/15 hover:bg-on-secondary/25 text-on-secondary border border-on-secondary/30 font-label-sm text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">replay</span>
                <span>Bunyikan Lagi</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSellerSubTab('pesanan');
                  setLiveOrderAlert(null);
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                }}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-on-secondary text-secondary hover:opacity-95 font-label-md text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                <span>Lihat &amp; Proses Pesanan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLiveOrderAlert(null);
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                }}
                aria-label="Tutup Pengingat Pesanan"
                className="w-11 h-11 rounded-lg bg-on-secondary/15 hover:bg-on-secondary/25 text-on-secondary flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* BANNER PEMBEKUAN OPERASIONAL STAN OLEH ADMIN SARPRAS */}
        {stall.isFrozen && (
          <div
            role="alert"
            className="w-full rounded-xl bg-error text-on-error p-4 sm:p-5 shadow-md flex flex-col gap-2"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[24px]">gpp_bad</span>
              <span className="font-label-lg text-sm font-extrabold uppercase tracking-wider">
                OPERASIONAL STAN DIBEKUKAN SEMENTARA OLEH ADMIN SARPRAS &amp; BAAK
              </span>
            </div>
            <p className="font-body-sm text-xs sm:text-sm text-on-error/95 leading-relaxed">
              {stall.frozenReason ||
                'Operasional stan Anda ditutup sementara hingga seluruh laporan harga diselesaikan dan diverifikasi oleh Admin Kampus.'}
            </p>
          </div>
        )}

        {/* BANNER PERINGATAN RESMI (SP-1) & LAPORAN HARGA DARI PORTAL ADMIN */}
        {stallPriceReports.length > 0 && (
          <div
            role="alert"
            className="w-full rounded-xl bg-error-container/85 text-on-error-container p-4 sm:p-5 shadow-md border-2 border-error/40 flex flex-col gap-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-error text-on-error flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">gavel</span>
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-error text-on-error font-label-sm text-[11px] font-bold uppercase tracking-wider">
                      {activeSpReports.length > 0
                        ? `SURAT PERINGATAN RESMI (SP-1) • ${activeSpReports.length} KASUS`
                        : `LAPORAN SELISIH HARGA MAHASISWA • ${stallPriceReports.length} TIKET`}
                    </span>
                    <span className="font-label-sm text-xs font-semibold text-on-error-container/90">
                      Biro Sarpras &amp; BAAK IBI KKG
                    </span>
                  </div>
                  <h3 className="fluid-headline-md text-on-error-container mt-0.5">
                    Harap Sesuaikan Harga Menu Katalog dengan Harga Kasir
                  </h3>
                  <p className="font-body-sm text-xs sm:text-sm text-on-error-container/90">
                    Mahasiswa melaporkan adanya perbedaan harga antara katalog digital dan kasir stan{' '}
                    <strong>{stall.name}</strong>. Silakan perbarui harga di bawah ini agar tiket peringatan ditutup otomatis:
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {stallPriceReports.map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-xl bg-surface-container-lowest text-on-surface p-3.5 border border-error/30 flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-error">
                        Tiket #{rep.id} • {rep.createdAt}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          rep.status === 'sp_sent'
                            ? 'bg-error text-on-error'
                            : 'bg-tertiary-fixed text-tertiary'
                        }`}
                      >
                        {rep.status === 'sp_sent'
                          ? 'SP-1 Diterbitkan Admin'
                          : 'Dilaporkan Mahasiswa'}
                      </span>
                    </div>
                    <div className="font-label-lg text-sm font-bold text-on-surface">
                      Menu: {rep.menuName}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-surface-container-low p-2.5 rounded-lg">
                      <div>
                        <span className="text-on-surface-variant block text-[11px]">
                          Harga di Katalog:
                        </span>
                        <strong className="text-secondary font-bold">
                          Rp {rep.catalogPrice.toLocaleString('id-ID')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-on-surface-variant block text-[11px]">
                          Ditagih di Kasir:
                        </span>
                        <strong className="text-error font-bold">
                          Rp {rep.chargedPrice.toLocaleString('id-ID')}
                        </strong>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant italic">
                      &ldquo;{rep.description}&rdquo;
                    </p>
                  </div>

                  {onResolvePriceReport && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-outline-variant/25">
                      <button
                        type="button"
                        onClick={() =>
                          onResolvePriceReport(
                            rep.id,
                            'resolved',
                            `Penjual (${stall.name}) telah menyamakan harga katalog "${rep.menuName}" menjadi Rp ${rep.chargedPrice.toLocaleString('id-ID')}.`,
                            true
                          )
                        }
                        className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          price_check
                        </span>
                        <span>
                          Ubah Katalog Jadi Rp {rep.chargedPrice.toLocaleString('id-ID')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onResolvePriceReport(
                            rep.id,
                            'resolved',
                            `Penjual (${stall.name}) menyatakan tetap mengikuti harga katalog Rp ${rep.catalogPrice.toLocaleString('id-ID')} di kasir.`,
                            false
                          )
                        }
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Tetap Rp {rep.catalogPrice.toLocaleString('id-ID')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1 & 2: DASHBOARD & MENU HARGA */}
        {(sellerSubTab === 'dashboard' || sellerSubTab === 'menu') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (Desktop 4 cols, Tablet 2-col balanced): Welcome Card, Quick Stats & QR Etalase */}
            <div className="lg:col-span-4 flex flex-col gap-4 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4 items-stretch">
                <div className="bg-surface-container rounded-xl p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-sm text-label-sm text-primary font-semibold">
                        Dashboard Penjual Kantin IBI KKG
                      </span>
                      <h2 className="fluid-headline-md text-on-surface mt-0.5 break-words">
                        Selamat datang, {stall.name}
                      </h2>
                      <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0">
                          location_on
                        </span>
                        <span className="truncate">
                          {stall.fullLocation} • {stall.daysOpen} ({stall.hours})
                        </span>
                      </p>
                    </div>
                    {/* Master Store Toggle Switch wrapped in 44x44px hitbox */}
                    <button
                      aria-checked={stall.isOpen}
                      aria-label="Status Buka Toko"
                      onClick={onToggleStoreOpen}
                      className="min-h-[44px] min-w-[56px] flex items-center justify-center cursor-pointer shrink-0"
                      role="switch"
                      type="button"
                    >
                      <span
                        className={`relative inline-flex h-8 w-14 rounded-full transition-colors duration-200 ease-in-out ${
                          stall.isOpen ? 'bg-secondary' : 'bg-surface-variant'
                        }`}
                      >
                        <span
                          className={`${
                            stall.isOpen ? 'translate-x-7' : 'translate-x-0'
                          } pointer-events-none inline-block h-6 w-6 transform rounded-full bg-surface shadow-md ring-0 transition duration-200 ease-in-out my-1 ml-1`}
                        ></span>
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/25">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          stall.isOpen ? 'bg-secondary' : 'bg-error'
                        }`}
                      ></span>
                      <span
                        className={`font-label-md text-label-md font-semibold ${
                          stall.isOpen ? 'text-secondary' : 'text-error'
                        }`}
                      >
                        {stall.isOpen ? 'Stan Buka Sekarang' : 'Stan Tutup Sementara'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                      <span className="material-symbols-outlined text-[14px]">sync</span>
                      <span>Diperbarui: {stall.lastUpdatedDate}</span>
                    </div>
                  </div>
                </div>

                {/* DOMPET PENJUALAN (ALA SHOPEE SELLER BALANCE) */}
                <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border-2 border-secondary/35 flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary text-[18px]">
                        account_balance_wallet
                      </span>
                      <span className="font-label-sm text-xs font-bold text-on-surface">
                        Saldo Penjualan (Siap Tarik)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                      Bebas Potongan 100%
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-headline-md text-[22px] font-bold text-secondary leading-none">
                      Rp {gatewayBalance.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Total dicairkan: Rp {totalWithdrawn.toLocaleString('id-ID')}
                    </span>
                  </div>
                  {gatewayBalance === 0 && otherStallOrders.length > 0 && onSwitchSellerStall && (
                    <div className="p-2.5 rounded-lg bg-tertiary-fixed/50 border border-tertiary/30 text-[11px] text-on-surface flex flex-col gap-1.5">
                      <span>
                        Ada <strong>{otherStallOrders.length} pesanan masuk</strong> di{' '}
                        <strong>{otherStallOrders[0].stallName}</strong> (Rp{' '}
                        {(
                          otherStallOrders[0].subtotalAmount ?? otherStallOrders[0].totalAmount
                        ).toLocaleString('id-ID')}
                        ), sedangkan Anda sedang membuka dashboard <strong>{stall.name}</strong>.
                      </span>
                      <button
                        type="button"
                        onClick={() => onSwitchSellerStall(otherStallOrders[0].stallId)}
                        className="min-h-[44px] px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-[11px] cursor-pointer self-start"
                      >
                        Buka Dashboard {otherStallOrders[0].stallName} →
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSellerSubTab('pembayaran')}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-secondary/15 hover:bg-secondary/25 text-secondary font-label-sm text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">payments</span>
                    <span>Tarik Saldo ke Rekening / DANA</span>
                  </button>
                </div>
              </div>

              {/* Quick Stats Grid: 2 cols on mobile/desktop sidebar, 4 cols on tablet */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
                <div className="bg-surface-container-lowest p-4 rounded-xl flex flex-col gap-1 shadow-sm border border-outline-variant/25">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Total Menu
                    </span>
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      restaurant_menu
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
                      {items.length}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      menu
                    </span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-4 rounded-xl flex flex-col gap-1 shadow-sm border border-outline-variant/25">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Rating
                    </span>
                    <span className="material-symbols-outlined text-tertiary-container text-[18px]">
                      grade
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
                      {stall.rating}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      / 5.0
                    </span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-4 rounded-xl flex flex-col gap-1 shadow-sm border border-outline-variant/25">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Pengunjung
                    </span>
                    <span className="material-symbols-outlined text-secondary text-[18px]">
                      group
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
                      {stall.visitorsCount}
                    </span>
                    <span className="font-label-sm text-label-sm text-secondary">mahasiswa</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-4 rounded-xl flex flex-col gap-1 shadow-sm border border-outline-variant/25">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Stok Habis
                    </span>
                    <span className="material-symbols-outlined text-error text-[18px]">
                      warning
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="font-headline-lg-mobile text-headline-lg-mobile text-error">
                      {habisCount}
                    </span>
                    <span className="font-label-sm text-label-sm text-error">habis</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions: + Tambah Menu & Kartu Preview QR Code Stan */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={openAddModal}
                  className="w-full min-h-[46px] bg-primary-container hover:bg-primary text-on-primary font-label-lg text-label-lg rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">add_circle</span>
                  <span>+ Tambah Menu Baru</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSellerSubTab('laporan')}
                  className="w-full min-h-[44px] bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-md text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-outline-variant/30 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">monitoring</span>
                  <span>Lihat Rekap Penjualan &amp; Cetak Struk</span>
                </button>

                <div className="bg-surface-container-lowest p-3.5 rounded-xl border-2 border-primary/30 shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {stallQrDataUrl && (
                      <button
                        type="button"
                        onClick={() => setIsQrModalOpen(true)}
                        title="Klik untuk perbesar & unduh Poster QR Code"
                        className="w-16 h-16 rounded-lg bg-white p-1 border border-primary/30 shrink-0 cursor-pointer hover:scale-105 transition-transform"
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
                        QR Etalase {stall.name}
                      </span>
                      <span className="text-[11px] text-on-surface-variant leading-snug">
                        Tempel di gerobak agar mahasiswa scan langsung ke menu {stall.code}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsQrModalOpen(true)}
                    className="min-h-[44px] px-3.5 py-2 bg-primary hover:bg-primary-container text-on-primary font-label-sm text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    <span>Cetak QR</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 flex flex-col gap-4 min-w-0">
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <h3 className="fluid-headline-md text-on-surface">
                      Kelola Menu &amp; Harga Kantin
                    </h3>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Ubah harga (mis. Rp12.000 → Rp15.000) atau status Tersedia/Habis secara langsung
                    </span>
                  </div>
                </div>

                <div
                  className="flex gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar"
                  role="tablist"
                >
                  {[
                    { id: 'all', label: `Semua (${items.length})` },
                    { id: 'makanan', label: `Makanan (${makananCount})` },
                    { id: 'minuman', label: `Minuman (${minumanCount})` },
                    { id: 'snack', label: `Snack (${snackCount})` },
                    { id: 'habis', label: `Habis (${habisCount})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() =>
                        setActiveCategory(
                          t.id as 'all' | 'makanan' | 'minuman' | 'snack' | 'habis'
                        )
                      }
                      className={
                        activeCategory === t.id
                          ? 'tab-btn min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md whitespace-nowrap bg-primary text-on-primary transition-colors flex items-center gap-1 shadow-xs cursor-pointer shrink-0'
                          : 'tab-btn min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md whitespace-nowrap bg-surface-container-low text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1 cursor-pointer shrink-0'
                      }
                      type="button"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Items Grid: 1 col on mobile, 2 cols on md+ */}
              {items.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-xl p-6 sm:p-8 shadow-sm border border-dashed border-primary/40 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-fixed/60 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
                  </div>
                  <div className="flex flex-col gap-1 max-w-md">
                    <h4 className="fluid-headline-md text-on-surface">
                      Stan Baru Terverifikasi — Belum Ada Menu
                    </h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Akun kantin <strong>{stall.name}</strong> telah aktif! Silakan tambahkan menu makanan, minuman, beserta harganya agar langsung tampil di halaman mahasiswa IBI KKG.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>+ Input Menu Pertama Sekarang</span>
                  </button>
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
                  id="menuItemsContainer"
                >
                  {filteredItems.map((item) => {
                  const isHabis = item.status === 'habis';
                  return (
                    <article
                      key={item.id}
                      className={`menu-item group bg-white rounded-lg p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between gap-3.5 min-w-0 ${
                        isHabis
                          ? 'border-rose-200/80 bg-rose-50/15'
                          : 'border-slate-200/90 hover:border-emerald-300 hover:shadow-md shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Food Image with Hover Effect & Sold-Out Overlay */}
                        <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-md overflow-hidden shrink-0 bg-slate-100 border border-slate-200/80 shadow-2xs">
                          <img
                            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                              isHabis ? 'grayscale opacity-75' : ''
                            }`}
                            alt={item.altMerchant}
                            src={item.imageMerchant}
                            referrerPolicy="no-referrer"
                          />
                          {isHabis && (
                            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="text-[10px] font-black tracking-wider uppercase text-white bg-rose-600/95 px-1.5 py-0.5 rounded shadow-xs">
                                Habis
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Title, Category & Availability Toggle */}
                        <div className="flex flex-col min-w-0 flex-grow">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                  {item.category}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {item.lastUpdated}
                                </span>
                              </div>
                              <h4
                                className={`font-bold text-slate-900 text-sm sm:text-base leading-snug mt-1 break-words ${
                                  isHabis ? 'line-through text-slate-400' : ''
                                }`}
                              >
                                {item.name}
                              </h4>
                            </div>

                            {/* Status Toggle Switch / Badge */}
                            <button
                              aria-label="Ubah status ketersediaan"
                              onClick={() => onToggleMenuStatus(item.id)}
                              className={`status-toggle-badge min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 border transition-all active:scale-95 ${
                                isHabis
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-2xs'
                              }`}
                              type="button"
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isHabis ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'
                                }`}
                              />
                              <span className="badge-text">
                                {isHabis ? 'Habis' : 'Tersedia'}
                              </span>
                            </button>
                          </div>

                          <p
                            className={`text-xs mt-1.5 line-clamp-2 leading-relaxed ${
                              isHabis ? 'text-rose-600 font-medium' : 'text-slate-500'
                            }`}
                          >
                            {isHabis
                              ? item.habisReason || 'Stok habis sementara (ditandai habis bagi mahasiswa)'
                              : item.description}
                          </p>
                        </div>
                      </div>

                      {/* Quick Price Editor + Action Buttons */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between pt-3 border-t border-slate-100 gap-2.5">
                        <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/30 border border-slate-200 px-3 h-10 rounded-xl flex-1 min-w-[140px] transition-all">
                          <span className="text-xs font-bold text-slate-500 shrink-0">
                            Rp
                          </span>
                          <input
                            aria-label={`Harga ${item.name}`}
                            className="price-input bg-transparent font-bold text-sm text-emerald-700 w-full min-w-0 focus:outline-none tabular-nums"
                            inputMode="numeric"
                            type="number"
                            value={item.price}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                onUpdateMenuPrice(item.id, val);
                              }
                            }}
                            onBlur={(e) => {
                              const check = sanitizeMenuPrice(e.target.value);
                              if (!check.valid) {
                                onUpdateMenuPrice(item.id, check.price);
                                onShowToast(
                                  check.reason ||
                                    `Harga disesuaikan ke batas aman Rp${check.price.toLocaleString('id-ID')}`
                                );
                              } else {
                                onShowToast(
                                  `Harga ${item.name} diperbarui: Rp${check.price.toLocaleString('id-ID')}`
                                );
                              }
                            }}
                          />
                          <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0" title="Klik untuk ubah harga cepat">
                            edit
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openEditModal(item)}
                            className="min-h-[38px] px-3 flex items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 hover:border-emerald-200 border border-transparent text-xs font-semibold transition-all cursor-pointer active:scale-95"
                            type="button"
                            title="Edit detail menu lengkap"
                          >
                            <span className="material-symbols-outlined text-[17px] text-emerald-600">edit_square</span>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setConfirmDeleteItem(item)}
                            className="min-h-[38px] px-3 flex items-center justify-center gap-1 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 hover:border-rose-200 border border-transparent text-xs font-semibold transition-all cursor-pointer active:scale-95"
                            type="button"
                            title="Hapus menu dari stan"
                          >
                            <span className="material-symbols-outlined text-[17px] text-rose-500">delete</span>
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB PESANAN MASUK & TRANSAKSI MAHASISWA (REAL-TIME) */}
        {sellerSubTab === 'pesanan' && (
          <section className="w-full flex flex-col gap-3.5">
            {/* Top 3 Stats Summary - Compact & Tidy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3.5 shadow-2xs border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-500">
                    Pesanan Aktif
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-amber-600 leading-tight mt-0.5">
                    {activeOrdersCount}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">pending_actions</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-3.5 shadow-2xs border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-500">
                    Total Transaksi
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight mt-0.5">
                    {stallOrders.length}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-3.5 shadow-2xs border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-500">
                    Total Pendapatan
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-emerald-700 leading-tight mt-0.5">
                    Rp {totalRevenueToday.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">payments</span>
                </div>
              </div>
            </div>

            {/* Orders Section Card - Clean, Concise & Airy */}
            <div className="bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200 flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Daftar Pesanan
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {stallOrders.length} Pesanan
                </span>
              </div>

              {stallOrders.length === 0 ? (
                <div className="py-10 px-4 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 flex flex-col items-center text-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-slate-300">
                    receipt_long
                  </span>
                  <h4 className="text-sm font-semibold text-slate-700">
                    Belum Ada Pesanan Masuk
                  </h4>
                  <p className="text-xs text-slate-400">
                    Pesanan baru dari mahasiswa akan muncul di sini.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {stallOrders.map((ord) => {
                    const isDineIn = ord.fulfillmentType === 'dine_in';
                    const isAutoPaid = ord.paymentStatus === 'paid_gateway';

                    return (
                      <div
                        key={ord.id}
                        className={`rounded-xl p-3.5 sm:p-4 border transition-all flex flex-col justify-between gap-3 ${
                          ord.status === 'ready_pickup'
                            ? 'bg-emerald-50/20 border-emerald-300 ring-1 ring-emerald-300/40 shadow-xs'
                            : ord.status === 'cooking'
                            ? 'bg-blue-50/15 border-blue-200 shadow-xs'
                            : ord.status === 'waiting_payment_verification'
                            ? 'bg-amber-50/15 border-amber-200 shadow-xs'
                            : ord.status === 'completed'
                            ? 'bg-slate-50/50 border-slate-200'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-col gap-2.5">
                          {/* 1. Header: ID + Time + Status Badge */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                                #{ord.id}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {ord.createdAt}
                              </span>
                            </div>

                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 shrink-0 ${
                                ord.status === 'waiting_payment_verification'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : ord.status === 'cooking'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : ord.status === 'ready_pickup'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : ord.status === 'completed'
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  ord.status === 'waiting_payment_verification'
                                    ? 'bg-amber-500'
                                    : ord.status === 'cooking'
                                    ? 'bg-blue-500'
                                    : ord.status === 'ready_pickup'
                                    ? 'bg-emerald-500'
                                    : ord.status === 'completed'
                                    ? 'bg-slate-400'
                                    : 'bg-rose-500'
                                }`}
                              />
                              <span>
                                {ord.status === 'waiting_payment_verification'
                                  ? 'Pesanan Baru'
                                  : ord.status === 'cooking'
                                  ? 'Dimasak'
                                  : ord.status === 'ready_pickup'
                                  ? 'Siap Diambil'
                                  : ord.status === 'completed'
                                  ? 'Selesai'
                                  : 'Dibatalkan'}
                              </span>
                            </span>
                          </div>

                          {/* 2. Customer & Fulfillment Badge */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center justify-center shrink-0">
                                {ord.studentName ? ord.studentName.charAt(0).toUpperCase() : 'M'}
                              </span>
                              <span className="font-semibold text-slate-800 text-xs sm:text-sm truncate">
                                {ord.studentName}
                              </span>
                              {ord.studentNim && (
                                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                  ({ord.studentNim})
                                </span>
                              )}
                            </div>

                            {/* Fulfillment Tag */}
                            {isDineIn ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px] font-medium shrink-0">
                                <span className="material-symbols-outlined text-[14px] text-amber-600">table_restaurant</span>
                                <span>Meja {ord.tableNumber || '-'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/70 text-[11px] font-medium shrink-0">
                                <span className="material-symbols-outlined text-[14px] text-emerald-600">shopping_bag</span>
                                <span>Ambil {ord.pickupTime}</span>
                              </span>
                            )}
                          </div>

                          {/* 3. Menu Items List */}
                          <div className="bg-slate-50/70 rounded-lg p-2.5 border border-slate-200/60 flex flex-col gap-1.5">
                            {ord.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs gap-2"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                  <span className="min-w-[22px] h-4.5 px-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                                    {item.quantity}x
                                  </span>
                                  <span className="text-slate-800 truncate">
                                    {item.name}
                                  </span>
                                </div>
                                <span className="font-semibold text-slate-700 tabular-nums shrink-0">
                                  Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))}
                            {ord.notes && (
                              <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200/60 flex items-start gap-1 mt-0.5">
                                <span className="font-semibold shrink-0">Catatan:</span>
                                <span className="break-words">&ldquo;{ord.notes}&rdquo;</span>
                              </div>
                            )}
                          </div>

                          {/* 4. Payment & Total Row */}
                          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50/50 border border-slate-200/50 text-xs">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-slate-500 text-[11px] truncate">
                                {ord.paymentProviderLabel}
                              </span>
                              {isAutoPaid ? (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-[10px]">
                                  Lunas
                                </span>
                              ) : ord.paymentStatus === 'cash_on_pickup' ? (
                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200 text-[10px]">
                                  Tunai
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200 text-[10px]">
                                  Transfer
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-1 shrink-0">
                              <span className="text-[11px] text-slate-400">Total:</span>
                              <span className="font-bold text-emerald-700 tabular-nums text-sm">
                                Rp {(ord.subtotalAmount ?? ord.totalAmount).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 5. Action Buttons - Compact & Direct */}
                        <div className="pt-1 mt-auto">
                          {ord.status === 'waiting_payment_verification' && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => onUpdateOrderStatus(ord.id, 'cooking')}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
                              >
                                <span className="material-symbols-outlined text-[16px]">soup_kitchen</span>
                                <span>Mulai Masak</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateOrderStatus(ord.id, 'rejected')}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                              >
                                <span>Tolak</span>
                              </button>
                            </div>
                          )}

                          {ord.status === 'cooking' && (
                            <button
                              type="button"
                              onClick={() => onUpdateOrderStatus(ord.id, 'ready_pickup')}
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined text-[17px]">notifications_active</span>
                              <span>{isDineIn ? 'Siap Disajikan' : 'Siap Diambil'}</span>
                            </button>
                          )}

                          {ord.status === 'ready_pickup' && (
                            <button
                              type="button"
                              onClick={() => onUpdateOrderStatus(ord.id, 'completed')}
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined text-[17px]">task_alt</span>
                              <span>Selesaikan Pesanan</span>
                            </button>
                          )}

                          {ord.status === 'completed' && (
                            <div className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-medium flex items-center justify-center gap-1.5">
                              <span className="material-symbols-outlined text-[16px] text-emerald-600">task_alt</span>
                              <span>Pesanan Selesai</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {sellerSubTab === 'pembayaran' && (
          <section className="max-w-3xl mx-auto w-full flex flex-col gap-4">
            {gatewayBalance === 0 && otherStallOrders.length > 0 && onSwitchSellerStall && (
              <div className="p-4 rounded-xl bg-tertiary-fixed/50 border-2 border-tertiary/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-label-md font-bold text-on-surface">
                    Pesanan Mahasiswa Tadi Masuk ke Kantin Lain ({otherStallOrders[0].stallName})
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    Saat ini Anda sedang membuka dashboard <strong>{stall.name}</strong>, sedangkan pesanan terakhir dibuat di <strong>{otherStallOrders[0].stallName}</strong>. Klik tombol di samping untuk langsung pindah ke kantin tersebut dan menarik saldonya:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSwitchSellerStall(otherStallOrders[0].stallId)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold cursor-pointer shrink-0 shadow-xs"
                >
                  Pindah ke {otherStallOrders[0].stallName} →
                </button>
              </div>
            )}

            {/* DOMPET PENJUALAN & TARIK DANA */}
            <div className="bg-white rounded-xl p-5 sm:p-6 shadow-xs border border-slate-200/90 flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                      0% Potongan
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Bebas biaya admin penarikan
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className="text-xs font-semibold text-slate-500 block">
                      Saldo Siap Ditarik
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                      Rp {gatewayBalance.toLocaleString('id-ID')}
                    </h3>
                  </div>
                </div>

                <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 flex flex-col sm:items-end shrink-0">
                  <span className="text-xs text-slate-500 font-medium">
                    Total Sudah Dicairkan
                  </span>
                  <span className="text-base sm:text-lg font-bold text-slate-800 tabular-nums mt-0.5">
                    Rp {totalWithdrawn.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Pilihan Tujuan Pencairan & Tombol Tarik */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                <div className="sm:col-span-8 flex flex-col gap-2.5">
                  <span className="text-xs font-bold text-slate-700">
                    Tujuan Pencairan:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setWithdrawDestination('ewallet')}
                      className={`p-3 rounded-xl border text-left flex items-center gap-3 cursor-pointer transition-all ${
                        withdrawDestination === 'ewallet'
                          ? 'border-emerald-600 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-600/30 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-emerald-700 text-[22px] shrink-0">
                        smartphone
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold truncate text-slate-900">
                          E-Wallet ({payEwalletProviders.split('/')[0].trim()})
                        </span>
                        <span className="text-[11px] text-slate-500 truncate font-mono">
                          {payEwalletNumber} • {payEwalletAccountName}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWithdrawDestination('bank')}
                      className={`p-3 rounded-xl border text-left flex items-center gap-3 cursor-pointer transition-all ${
                        withdrawDestination === 'bank'
                          ? 'border-emerald-600 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-600/30 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-emerald-700 text-[22px] shrink-0">
                        account_balance
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold truncate text-slate-900">
                          Rekening {payBankName}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate font-mono">
                          {payBankAccountNumber} • {payBankAccountName}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-4 flex flex-col justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={gatewayBalance <= 0 || isWithdrawing}
                    onClick={handleWithdrawSellerBalance}
                    className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all ${
                      gatewayBalance > 0 && !isWithdrawing
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-sm'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isWithdrawing ? 'sync' : 'payments'}
                    </span>
                    <span>
                      {isWithdrawing
                        ? 'Memproses Transfer...'
                        : gatewayBalance > 0
                        ? `Tarik Rp ${gatewayBalance.toLocaleString('id-ID')}`
                        : 'Saldo Rp 0'}
                    </span>
                  </button>
                  <span className="text-[11px] text-center text-slate-500">
                    Bebas biaya transfer
                  </span>
                </div>
              </div>

              {/* Riwayat Penarikan Dana */}
              {withdrawalHistory.length > 0 && (
                <div className="flex flex-col gap-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[17px] text-emerald-700">
                        history
                      </span>
                      Riwayat Pencairan Saldo
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold">
                      {withdrawalHistory.length} Transaksi
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {withdrawalHistory.map((wd) => (
                      <div
                        key={wd.id}
                        className="p-3 sm:p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                {wd.destinationLabel}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 shrink-0">
                                Berhasil Cair
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                              #{wd.id} • {wd.createdAt}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-baseline sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 shrink-0">
                          <span className="font-black text-emerald-700 text-sm sm:text-base tabular-nums">
                            + Rp {wd.amount.toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Diterima Utuh (0% Potongan)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2 border-b border-outline-variant/25 pb-3">
                <div>
                  <span className="font-label-sm text-[11px] text-secondary font-bold uppercase tracking-wider">
                    Tujuan Pencairan Payment Gateway &amp; Pembayaran Langsung
                  </span>
                  <h3 className="fluid-headline-md text-on-surface">
                    Pengaturan Rekening Bank, DANA/E-Wallet &amp; QRIS {stall.name}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Rekening dan E-Wallet di bawah ini digunakan sebagai tujuan pencairan dana Payment Gateway otomatis maupun transfer langsung dari mahasiswa.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePaymentSettings} className="flex flex-col gap-4">
                {/* 1. QRIS KANTIN */}
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">qr_code_2</span>
                      <span className="font-label-lg text-on-surface font-bold">
                        1. Pembayaran QRIS Kantin (DANA, GoPay, OVO, M-Banking)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={payQrisEnabled}
                      onChange={(e) => setPayQrisEnabled(e.target.checked)}
                      className="w-5 h-5 accent-primary"
                    />
                  </div>

                  {payQrisEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-on-surface-variant">
                          Nama Merchant pada QRIS
                        </label>
                        <input
                          type="text"
                          value={payQrisMerchantName}
                          onChange={(e) => setPayQrisMerchantName(e.target.value)}
                          placeholder="Contoh: KANTIN BU SARI - IBI KKG"
                          className="h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-on-surface-variant">
                          Nomor NMID QRIS (Opsional)
                        </label>
                        <input
                          type="text"
                          value={payQrisNmid}
                          onChange={(e) => setPayQrisNmid(e.target.value)}
                          placeholder="ID2026001018829"
                          className="h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2 flex flex-wrap items-center gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30">
                        {(payQrisImage || qrisPreviewDataUrl) && (
                          <img
                            src={payQrisImage || qrisPreviewDataUrl}
                            alt="QRIS Kantin"
                            className="w-20 h-20 object-contain rounded-lg bg-white p-1.5 border border-primary/30 shrink-0"
                          />
                        )}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-bold text-on-surface">
                            {payQrisImage
                              ? 'Barcode QRIS Kustom Aktif'
                              : 'Barcode QRIS Standar Aktif Otomatis'}
                          </span>
                          <label className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-sm text-label-sm font-semibold inline-flex items-center gap-2 cursor-pointer self-start">
                            <span className="material-symbols-outlined text-[18px]">upload</span>
                            <span>Ganti / Upload Foto QRIS Kantin Anda (Opsional)</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleQrisImageUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. E-WALLET LANGSUNG (DANA / GOPAY / OVO / SHOPEEPAY) */}
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">
                        account_balance_wallet
                      </span>
                      <span className="font-label-lg text-on-surface font-bold">
                        2. Nomor DANA / GoPay / OVO / ShopeePay Penjual
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={payEwalletEnabled}
                      onChange={(e) => setPayEwalletEnabled(e.target.checked)}
                      className="w-5 h-5 accent-primary"
                    />
                  </div>

                  {payEwalletEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-on-surface-variant">
                          Aplikasi E-Wallet yang Diterima
                        </label>
                        <input
                          type="text"
                          value={payEwalletProviders}
                          onChange={(e) => setPayEwalletProviders(e.target.value)}
                          placeholder="DANA / GoPay / OVO"
                          className="h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-on-surface-variant">
                          Nomor HP DANA / E-Wallet
                        </label>
                        <input
                          type="text"
                          value={payEwalletNumber}
                          onChange={(e) => setPayEwalletNumber(e.target.value)}
                          placeholder="081290001980"
                          className="h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm font-bold focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-on-surface-variant">
                          Atas Nama Akun DANA/E-Wallet
                        </label>
                        <input
                          type="text"
                          value={payEwalletAccountName}
                          onChange={(e) => setPayEwalletAccountName(e.target.value)}
                          placeholder="Ibu Sari Rahmawati"
                          className="h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. TRANSFER REKENING BANK PENJUAL */}
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">
                        account_balance
                      </span>
                      <span className="font-label-lg text-on-surface font-bold">
                        3. Rekening Bank Penjual (BCA / Mandiri / BRI / Bank DKI)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={payBankEnabled}
                      onChange={(e) => setPayBankEnabled(e.target.checked)}
                      className="w-5 h-5 accent-primary"
                    />
                  </div>

                  {payBankEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-on-surface-variant">
                          Nama Bank
                        </label>
                        <input
                          type="text"
                          value={payBankName}
                          onChange={(e) => setPayBankName(e.target.value)}
                          placeholder="Contoh: BCA / Mandiri"
                          className="h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-on-surface-variant">
                          Nomor Rekening
                        </label>
                        <input
                          type="text"
                          value={payBankAccountNumber}
                          onChange={(e) => setPayBankAccountNumber(e.target.value)}
                          placeholder="6840928114"
                          className="h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm font-bold focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-label-sm text-on-surface-variant">
                          Atas Nama Rekening
                        </label>
                        <input
                          type="text"
                          value={payBankAccountName}
                          onChange={(e) => setPayBankAccountName(e.target.value)}
                          placeholder="Ibu Sari Rahmawati"
                          className="h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. TUNAI DI KASIR */}
                <label className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-2 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">payments</span>
                    <span className="font-label-md text-on-surface font-bold">
                      4. Terima Pembayaran Tunai Saat Ambil di Stan (Cash)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={payCashEnabled}
                    onChange={(e) => setPayCashEnabled(e.target.checked)}
                    className="w-5 h-5 accent-primary"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-[19px]">save</span>
                  <span>Simpan Pengaturan Pembayaran</span>
                </button>
              </form>
            </div>
          </section>
        )}

        {/* TAB: REKAP & LAPORAN PENJUALAN STAN */}
        {sellerSubTab === 'laporan' && (
          <section className="max-w-5xl mx-auto w-full flex flex-col gap-6">
            {/* Header & Filter Controls */}
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[24px]">
                      monitoring
                    </span>
                    <h2 className="fluid-headline-md text-on-surface font-bold">
                      Rekap &amp; Laporan Penjualan Stan
                    </h2>
                  </div>
                  <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                    Laporan keuangan harian dan performa penjualan <strong>{stall.name}</strong>. Terkumpul utuh 100% tanpa potongan komisi pihak ketiga.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPrintRecapOpen(true)}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-primary-container cursor-pointer transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">print</span>
                    <span>Cetak / Unduh Struk Rekap</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyRecapWhatsApp}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs font-semibold flex items-center gap-1.5 border border-outline-variant/30 cursor-pointer transition-all active:scale-95"
                    title="Salin ringkasan ke format pesan WhatsApp"
                  >
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">
                      content_copy
                    </span>
                    <span>Salin WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Segmented Filter Periode */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-outline-variant/20">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <span className="text-xs font-bold text-on-surface-variant mr-1">
                    Filter Periode:
                  </span>
                  {[
                    { id: 'today', label: 'Hari Ini' },
                    { id: '7days', label: '7 Hari Terakhir' },
                    { id: 'month', label: 'Bulan Ini' },
                    { id: 'all', label: 'Semua Riwayat' },
                  ].map((p) => {
                    const isSelected = reportPeriod === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setReportPeriod(p.id as typeof reportPeriod)}
                        className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-on-primary shadow-xs font-bold'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/25'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <span className="text-xs text-on-surface-variant font-medium">
                  Menampilkan <strong>{filteredReportOrders.length} transaksi</strong>
                </span>
              </div>
            </div>

            {/* 4 Financial & Operational Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Omset */}
              <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-lg border border-outline-variant/30 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Total Omset Penjualan
                  </span>
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    payments
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xl sm:text-2xl font-bold text-primary font-mono">
                    Rp {reportMetrics.totalOmset.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    ✓ Bersih 100% (0% potongan komisi)
                  </span>
                </div>
              </div>

              {/* Card 2: Pemisahan Gateway vs Tunai */}
              <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-lg border border-outline-variant/30 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Penerimaan Saldo
                  </span>
                  <span className="material-symbols-outlined text-secondary text-[20px]">
                    account_balance_wallet
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Gateway (QRIS/VA):</span>
                    <span className="font-bold text-secondary font-mono">
                      Rp {reportMetrics.gatewayOmset.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Kas Tunai (COD):</span>
                    <span className="font-bold text-on-surface font-mono">
                      Rp {reportMetrics.cashOmset.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Pesanan & Rata-rata Nilai */}
              <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-lg border border-outline-variant/30 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Volume Transaksi
                  </span>
                  <span className="material-symbols-outlined text-tertiary text-[20px]">
                    receipt_long
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-bold text-on-surface">
                      {reportMetrics.completedCount}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      berhasil ({reportMetrics.rejectedCount} batal)
                    </span>
                  </div>
                  <span className="text-[11px] text-on-surface-variant">
                    Rata-rata: Rp {reportMetrics.avgBasket.toLocaleString('id-ID')}/order
                  </span>
                </div>
              </div>

              {/* Card 4: Distribusi Dine-In vs Pickup */}
              <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-lg border border-outline-variant/30 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Jalur Pemenuhan
                  </span>
                  <span className="material-symbols-outlined text-purple-600 text-[20px]">
                    restaurant
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-on-surface-variant">
                      <span>🍽️</span> Makan di Meja:
                    </span>
                    <span className="font-bold text-on-surface">
                      {reportMetrics.dineInCount} pesanan
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-on-surface-variant">
                      <span>🛍️</span> Ambil di Stan:
                    </span>
                    <span className="font-bold text-on-surface">
                      {reportMetrics.pickupCount} pesanan
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Terlaris (Performance Breakdown) */}
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="fluid-headline-md text-on-surface font-bold">
                    Performa Menu Terlaris (Sales by Item)
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant">
                    Rincian menu yang paling sering dipesan oleh mahasiswa selama periode terpilih
                  </p>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                  {reportMetrics.bestSellers.length} Menu Terjual
                </span>
              </div>

              {reportMetrics.bestSellers.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-low rounded-lg border border-dashed border-outline-variant/40 flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40">
                    fastfood
                  </span>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Belum ada data menu terjual pada periode ini.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {reportMetrics.bestSellers.map((item, idx) => {
                    const totalQty = reportMetrics.bestSellers.reduce((s, i) => s + i.quantity, 0);
                    const percentage = totalQty > 0 ? Math.round((item.quantity / totalQty) * 100) : 0;
                    return (
                      <div
                        key={item.name}
                        className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/25 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-on-surface truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-semibold text-on-surface-variant">
                              {item.quantity} porsi ({percentage}%)
                            </span>
                            <span className="font-bold text-primary font-mono">
                              Rp {item.revenue.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                        {/* Contribution Bar */}
                        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tabel Riwayat Transaksi Lengkap */}
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="fluid-headline-md text-on-surface font-bold">
                    Daftar Rincian Transaksi
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant">
                    Seluruh tiket pesanan mahasiswa dalam periode terpilih
                  </p>
                </div>
              </div>

              {filteredReportOrders.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/40 flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40">
                    receipt
                  </span>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Tidak ada pesanan pada filter periode ini.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-on-surface-variant font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Tiket &amp; Waktu</th>
                        <th className="py-2.5 px-3">Mahasiswa</th>
                        <th className="py-2.5 px-3">Penyajian</th>
                        <th className="py-2.5 px-3">Rincian Menu</th>
                        <th className="py-2.5 px-3">Pembayaran</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {filteredReportOrders.map((ord) => {
                        const isPaidGateway = ord.paymentStatus === 'paid_gateway';
                        return (
                          <tr key={ord.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="py-3 px-3 align-top whitespace-nowrap">
                              <span className="font-bold font-mono text-on-surface block">
                                #{ord.id}
                              </span>
                              <span className="text-[11px] text-on-surface-variant">
                                {ord.createdAt}
                              </span>
                            </td>
                            <td className="py-3 px-3 align-top whitespace-nowrap">
                              <span className="font-bold text-on-surface block">
                                {ord.studentName}
                              </span>
                              <span className="text-[11px] text-on-surface-variant font-mono">
                                {ord.studentNim}
                              </span>
                            </td>
                            <td className="py-3 px-3 align-top whitespace-nowrap">
                              {ord.fulfillmentType === 'dine_in' ? (
                                <span className="font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                                  🍽️ Meja {ord.tableNumber || '-'}
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  🛍️ Ambil di Stan
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 align-top max-w-xs">
                              <span className="text-on-surface block font-medium">
                                {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                              </span>
                            </td>
                            <td className="py-3 px-3 align-top whitespace-nowrap">
                              {isPaidGateway ? (
                                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                  ✓ Gateway Lunas
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                                  💵 Tunai Kasir
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                              <span className="font-bold font-mono text-on-surface">
                                Rp {(ord.subtotalAmount ?? ord.totalAmount).toLocaleString('id-ID')}
                              </span>
                            </td>
                            <td className="py-3 px-3 align-top text-center whitespace-nowrap">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                                  ord.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ord.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {ord.status === 'completed'
                                  ? 'Selesai'
                                  : ord.status === 'rejected'
                                  ? 'Dibatalkan'
                                  : 'Diproses'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: PROFIL KANTIN */}
        {sellerSubTab === 'profil' && (
          <section className="max-w-3xl mx-auto w-full">
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="fluid-headline-md text-on-surface">Kelola Profil Kantin</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Perbarui jam operasional, lokasi, foto kantin, dan metode pembayaran QRIS
                  </p>
                </div>
                <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded shrink-0">
                  Aktif
                </span>
              </div>



              <form onSubmit={handleSaveProfile} className="flex flex-col gap-3.5 pt-1">
                <div className="flex flex-col gap-2">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    Foto Kantin
                  </label>
                  <div className="relative h-44 sm:h-56 w-full rounded-xl overflow-hidden bg-surface-container">
                    <img
                      src={profHeroImg}
                      alt="Preview Kantin"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <label className="min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm cursor-pointer hover:bg-surface-container-highest">
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span>Ganti Foto Kantin (Upload dari Perangkat)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoFileChange(e, true)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      Nama Kantin
                    </label>
                    <input
                      type="text"
                      required
                      value={profName}
                      onChange={(e) => setProfName(e.target.value)}
                      className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      Spesialisasi Singkat
                    </label>
                    <input
                      type="text"
                      required
                      value={profSpecialty}
                      onChange={(e) => setProfSpecialty(e.target.value)}
                      className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    Deskripsi Kantin
                  </label>
                  <textarea
                    rows={2}
                    value={profDesc}
                    onChange={(e) => setProfDesc(e.target.value)}
                    className="p-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    Lokasi di Lingkungan IBI KKG
                  </label>
                  <input
                    type="text"
                    required
                    value={profLocation}
                    onChange={(e) => setProfLocation(e.target.value)}
                    className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      Hari Buka
                    </label>
                    <input
                      type="text"
                      required
                      value={profDays}
                      onChange={(e) => setProfDays(e.target.value)}
                      placeholder="Senin–Jumat"
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
                      value={profHours}
                      onChange={(e) => setProfHours(e.target.value)}
                      placeholder="07.00–20.00"
                      className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm text-on-surface-variant">
                      Nomor Kontak Penjual
                    </label>
                    <input
                      type="text"
                      required
                      value={profWhatsapp}
                      onChange={(e) => setProfWhatsapp(e.target.value)}
                      className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none"
                    />
                  </div>
                </div>

                <label className="min-h-[52px] flex items-center justify-between gap-3 p-3.5 rounded-lg bg-surface-container-low cursor-pointer">
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-on-surface">
                      Metode Pembayaran QRIS Tersedia
                    </span>
                    <span className="font-body-sm text-[11px] text-on-surface-variant">
                      Tampilkan badge &ldquo;QRIS tersedia&rdquo; di halaman mahasiswa
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profQris}
                    onChange={(e) => setProfQris(e.target.checked)}
                    className="w-5 h-5 accent-primary shrink-0"
                  />
                </label>

                <label className="min-h-[52px] flex items-center justify-between gap-3 p-3.5 rounded-lg bg-surface-container-low cursor-pointer border border-outline-variant/20">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px] text-primary">table_restaurant</span>
                      <span className="font-label-md text-label-md text-on-surface font-semibold">
                        Layanan Makan di Tempat (Dine-In ke Meja)
                      </span>
                    </div>
                    <span className="font-body-sm text-[11px] text-on-surface-variant">
                      Mahasiswa dapat memasukkan nomor meja saat checkout, dan pesanan disajikan langsung ke meja mereka di kantin/pujasera.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profDineIn}
                    onChange={(e) => setProfDineIn(e.target.checked)}
                    className="w-5 h-5 accent-primary shrink-0"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full min-h-[48px] py-3 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-semibold shadow-sm cursor-pointer active:scale-[0.99]"
                >
                  Simpan &amp; Terbitkan Profil Kantin
                </button>
              </form>
            </div>
          </section>
        )}

        {/* TAB 4: ULASAN MAHASISWA */}
        {sellerSubTab === 'ulasan' && (
          <section className="max-w-3xl mx-auto w-full">
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="fluid-headline-md text-on-surface">
                    Ulasan Mahasiswa IBI KKG
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Tanggapi masukan mahasiswa mengenai menu &amp; kesesuaian harga
                  </p>
                </div>
                <span className="font-headline-md text-tertiary font-bold shrink-0 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">grade</span>
                  <span>{stall.rating}</span>
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {stall.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div>
                        <span className="font-label-md text-on-surface font-bold">
                          {rev.studentName}
                        </span>
                        <span className="text-[11px] text-on-surface-variant ml-1.5">
                          ({rev.majorAndYear})
                        </span>
                      </div>
                      <span className="text-label-sm text-tertiary font-semibold">
                        Rating {rev.rating}/5 • {rev.date}
                      </span>
                    </div>
                    <p className="font-body-sm text-on-surface leading-relaxed">{rev.comment}</p>
                    {rev.reply ? (
                      <div className="p-2.5 rounded-lg bg-surface-container-lowest border-l-2 border-secondary text-body-sm text-on-surface-variant">
                        <strong className="text-secondary">Balasan Anda:</strong> {rev.reply}
                      </div>
                    ) : (
                      <div className="flex flex-wrap sm:flex-nowrap gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Ketik balasan untuk mahasiswa..."
                          value={replyDrafts[rev.id] || ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                          }
                          className="flex-grow h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm focus:outline-none min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const text = replyDrafts[rev.id];
                            if (text && text.trim()) {
                              onReplyReview(rev.id, text.trim());
                              onShowToast('Balasan ulasan berhasil dikirim!');
                            }
                          }}
                          className="min-h-[44px] px-4 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm cursor-pointer shrink-0"
                        >
                          Balas
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* TAB 5: PENGATURAN & INDIKATOR KEBERHASILAN PENJUAL */}
        {sellerSubTab === 'pengaturan' && (
          <section className="max-w-3xl mx-auto w-full flex flex-col gap-4">
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="fluid-headline-md text-on-surface">
                  Sesi Akun Penjual Terverifikasi
                </h3>
                <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-md font-semibold">
                  Sesi Tersimpan Otomatis
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Akun Anda tetap masuk secara otomatis di perangkat ini sehingga Anda tidak perlu login berulang kali setiap membuka website. Anda hanya perlu login kembali jika menekan tombol <strong>Keluar dari Akun</strong> di bawah.
              </p>
              <div className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-2 text-body-sm">
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="text-on-surface-variant">Email Login Penjual:</span>
                  <strong className="text-on-surface">
                    {sellerEmail || sellerAccountEmail}
                  </strong>
                </div>
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="text-on-surface-variant">Kode Kios Kampus:</span>
                  <strong className="text-on-surface">
                    {stall.mapPinCode} ({stall.code})
                  </strong>
                </div>
                <div className="flex flex-wrap justify-between gap-1">
                  <span className="text-on-surface-variant">Status Verifikasi Admin:</span>
                  <strong className="text-secondary">Terverifikasi Resmi IBI KKG</strong>
                </div>
              </div>
              {onLogoutSeller && (
                <button
                  type="button"
                  onClick={onLogoutSeller}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-error-container text-on-error-container hover:bg-error hover:text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Keluar dari Akun Penjual (Logout)</span>
                </button>
              )}
            </div>

            {/* Ubah Kata Sandi Akun Penjual */}
            {loggedInSeller && onUpdateSellerPassword && (
              <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                    <h4 className="fluid-headline-md text-on-surface">
                      Kata Sandi Akun Penjual
                    </h4>
                  </div>
                  <span className="font-label-sm text-xs bg-surface-container-high px-2.5 py-1 rounded text-on-surface">
                    Sandi Saat Ini: <strong>{loggedInSeller.password}</strong>
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Jika Anda ingin mengganti kata sandi agar lebih mudah diingat, ketik kata sandi baru di bawah ini:
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newSellerPassInput.trim() || newSellerPassInput.trim().length < 4) {
                      onShowToast('Kata sandi baru minimal 4 karakter.');
                      return;
                    }
                    onUpdateSellerPassword(loggedInSeller.id, newSellerPassInput.trim());
                    setNewSellerPassInput('');
                  }}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <input
                    type="text"
                    required
                    value={newSellerPassInput}
                    onChange={(e) => setNewSellerPassInput(e.target.value)}
                    placeholder="Ketik kata sandi baru (min. 4 karakter)"
                    className="flex-1 h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer shrink-0"
                  >
                    Simpan Sandi Baru
                  </button>
                </form>
              </div>
            )}

            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
              <h4 className="fluid-headline-md text-on-surface">
                Evaluasi Kemudahan Penjual (Tahap 1)
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Indikator keberhasilan sistem dari sisi penjual kantin IBI KKG:
              </p>
              <label className="min-h-[48px] flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low cursor-pointer">
                <span className="font-body-sm text-body-sm text-on-surface">
                  1. Mampu menginput menu &amp; foto sendiri dengan mudah?
                </span>
                <input
                  type="checkbox"
                  checked={evalSelfInput}
                  onChange={(e) => setEvalSelfInput(e.target.checked)}
                  className="w-5 h-5 accent-primary shrink-0"
                />
              </label>
              <label className="min-h-[48px] flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low cursor-pointer">
                <span className="font-body-sm text-body-sm text-on-surface">
                  2. Mampu mengubah harga tanpa bantuan admin?
                </span>
                <input
                  type="checkbox"
                  checked={evalPriceUpdate}
                  onChange={(e) => setEvalPriceUpdate(e.target.checked)}
                  className="w-5 h-5 accent-primary shrink-0"
                />
              </label>
              <label className="min-h-[48px] flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low cursor-pointer">
                <span className="font-body-sm text-body-sm text-on-surface">
                  3. Bersedia terus menggunakan sistem KantinKu?
                </span>
                <input
                  type="checkbox"
                  checked={evalContinueUse}
                  onChange={(e) => setEvalContinueUse(e.target.checked)}
                  className="w-5 h-5 accent-primary shrink-0"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  onShowToast(
                    'Terima kasih! Umpan balik penjual untuk Pilot Tahap 1 telah disimpan.'
                  )
                }
                className="w-full min-h-[48px] py-2.5 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-semibold cursor-pointer"
              >
                Simpan Evaluasi Penjual
              </button>
            </div>
          </section>
        )}
      </div>

      {/* MODAL TAMBAH / UPDATE MENU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 w-full max-w-md shadow-xl flex flex-col gap-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="fluid-headline-md text-on-surface">
                {editingItem ? 'Edit Menu & Harga' : 'Tambah Menu Baru'}
              </h4>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Nama Menu
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Nasi Ayam Geprek"
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    Kategori
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as 'makanan' | 'minuman' | 'snack')
                    }
                    className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none"
                  >
                    <option value="makanan">Makanan</option>
                    <option value="minuman">Minuman</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm text-on-surface-variant">
                    Harga (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="15000"
                    className="h-11 px-3 rounded-lg bg-surface-container-low text-primary font-label-lg text-label-lg font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Foto Makanan (Upload / Pilih)
                </label>
                <div className="flex items-center gap-3">
                  <img
                    src={formImage}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover bg-surface-container shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex flex-col gap-1.5 flex-grow min-w-0">
                    <label className="min-h-[40px] px-3 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center justify-center text-center cursor-pointer hover:bg-surface-container-highest">
                      <span>Upload Foto dari HP/Laptop</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoFileChange(e, false)}
                        className="hidden"
                      />
                    </label>
                    <select
                      value={formImage}
                      onChange={(e) => setFormImage(e.target.value)}
                      className="h-9 px-2 rounded bg-surface-container-low text-on-surface text-[11px] focus:outline-none w-full"
                    >
                      {PRESET_FOOD_PHOTOS.map((p, idx) => (
                        <option key={idx} value={p.url}>
                          Foto: {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Deskripsi
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Contoh: Ayam geprek + nasi + sambal"
                  className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant">
                  Ketersediaan
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormStatus('ready')}
                    className={`min-h-[44px] px-3 rounded-lg font-label-sm text-label-sm cursor-pointer border flex items-center justify-center gap-1.5 ${
                      formStatus === 'ready'
                        ? 'bg-secondary-container text-on-secondary-container border-secondary font-bold'
                        : 'bg-surface-container-low text-on-surface-variant border-transparent'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    <span>Tersedia</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('habis')}
                    className={`min-h-[44px] px-3 rounded-lg font-label-sm text-label-sm cursor-pointer border flex items-center justify-center gap-1.5 ${
                      formStatus === 'habis'
                        ? 'bg-error-container text-on-error-container border-error font-bold'
                        : 'bg-surface-container-low text-on-surface-variant border-transparent'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-error" />
                    <span>Habis</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-1/2 min-h-[44px] rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-1/2 min-h-[44px] rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI KEAMANAN HAPUS MENU */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl p-5 w-full max-w-sm shadow-xl border border-error/30 flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5 text-error">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h4 className="fluid-headline-md text-on-surface">
                Konfirmasi Hapus Menu
              </h4>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Apakah Anda yakin ingin menghapus menu{' '}
              <strong className="text-on-surface">&ldquo;{confirmDeleteItem.name}&rdquo;</strong>{' '}
              (Rp {confirmDeleteItem.price.toLocaleString('id-ID')}) dari katalog mahasiswa?
            </p>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="flex-1 min-h-[44px] rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMenuItem(confirmDeleteItem.id);
                  setConfirmDeleteItem(null);
                }}
                className="flex-1 min-h-[44px] rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold cursor-pointer"
              >
                Ya, Hapus Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CETAK & UNDUH STRUK REKAPITULASI PENJUALAN FORMAL */}
      {isPrintRecapOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden my-6 border border-slate-200">
            {/* Header Control Buttons (Hidden when printing via no-print) */}
            <div className="no-print p-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[20px]">
                  receipt_long
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">
                  Preview Struk Rekap Stan
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintRecapOpen(false)}
                className="w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Printable Thermal Receipt Paper Container */}
            <div
              id="printable-receipt"
              className="p-6 font-mono text-slate-900 text-xs flex flex-col gap-3 bg-white"
            >
              <div className="text-center flex flex-col gap-1 pb-2 border-b border-dashed border-slate-300">
                <span className="text-sm font-bold tracking-wider">
                  KANTINKU IBI KKG &amp; UMKM
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {stall.name.toUpperCase()}
                </span>
                <span className="text-[11px] text-slate-600">
                  {stall.fullLocation || stall.building}
                </span>
                <span className="text-[10px] text-slate-500 mt-1">
                  Dicetak: {new Date().toLocaleString('id-ID')} WIB
                </span>
              </div>

              <div className="flex flex-col gap-1 text-[11px] py-1 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span>Periode Rekap</span>
                  <span className="font-bold">
                    {reportPeriod === 'today'
                      ? 'Hari Ini'
                      : reportPeriod === '7days'
                      ? '7 Hari Terakhir'
                      : reportPeriod === 'month'
                      ? 'Bulan Ini'
                      : 'Semua Riwayat'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Transaksi</span>
                  <span className="font-bold">
                    {reportMetrics.completedCount} berhasil ({reportMetrics.rejectedCount} batal)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Makan di Meja</span>
                  <span>{reportMetrics.dineInCount} pesanan</span>
                </div>
                <div className="flex justify-between">
                  <span>Ambil di Stan</span>
                  <span>{reportMetrics.pickupCount} pesanan</span>
                </div>
              </div>

              {/* Rincian Penjualan Menu */}
              <div className="flex flex-col gap-1.5 py-1 border-b border-dashed border-slate-300">
                <span className="font-bold text-[11px] text-slate-700">
                  RINCIAN MENU TERJUAL:
                </span>
                {reportMetrics.bestSellers.length === 0 ? (
                  <span className="text-[11px] text-slate-400 italic">
                    Belum ada menu terjual
                  </span>
                ) : (
                  reportMetrics.bestSellers.map((item) => (
                    <div key={item.name} className="flex justify-between items-start text-[11px]">
                      <span className="min-w-0 pr-2">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="shrink-0 font-bold font-mono">
                        Rp {item.revenue.toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Ringkasan Finansial */}
              <div className="flex flex-col gap-1 text-[11px] py-1 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-bold text-xs pt-1">
                  <span>TOTAL OMSET KOTOR</span>
                  <span className="font-mono">
                    Rp {reportMetrics.totalOmset.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>• Via Gateway (QRIS/VA)</span>
                  <span className="font-mono">
                    Rp {reportMetrics.gatewayOmset.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>• Via Kasir Tunai (COD)</span>
                  <span className="font-mono">
                    Rp {reportMetrics.cashOmset.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold pt-1">
                  <span>Potongan Komisi (0%)</span>
                  <span>Rp 0</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                  <span>DITERIMA BERSIH</span>
                  <span className="font-mono text-emerald-800">
                    Rp {reportMetrics.totalOmset.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2 flex flex-col gap-0.5">
                <span>*** DOKUMEN REKAP RESMI STAN ***</span>
                <span>Sistem Operasi Kantinku &amp; Multi-UMKM Terpadu</span>
              </div>
            </div>

            {/* Bottom Actions (no-print) */}
            <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Cetak Struk Sekarang</span>
              </button>
              <button
                type="button"
                onClick={handleCopyRecapWhatsApp}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                <span>Salin WA</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPrintRecapOpen(false)}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
