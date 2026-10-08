import React, { useState } from 'react';
import {
  getStallPaymentDetails,
  MenuItem,
  OrderStatusType,
  OrderTransaction,
  PaymentDetails,
  Stall,
} from '../data/kantinData';

export type SellerSubTab =
  | 'dashboard'
  | 'pesanan'
  | 'menu'
  | 'pembayaran'
  | 'profil'
  | 'ulasan'
  | 'pengaturan';

interface KelolaMenuScreenProps {
  stall: Stall;
  orders: OrderTransaction[];
  sellerEmail?: string;
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
  onShowToast: (message: string) => void;
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
  stall,
  orders,
  sellerEmail,
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
  const [sellerSubTab, setSellerSubTab] = useState<SellerSubTab>('dashboard');
  const [activeCategory, setActiveCategory] = useState<
    'all' | 'makanan' | 'minuman' | 'snack' | 'habis'
  >('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

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
  const activeOrdersCount = stallOrders.filter(
    (o) => o.status !== 'completed' && o.status !== 'rejected'
  ).length;
  const totalRevenueToday = stallOrders
    .filter((o) => o.status !== 'rejected')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const handleQrisImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPayQrisImage(reader.result);
        onShowToast('Gambar Barcode QRIS berhasil dipilih!');
      }
    };
    reader.readAsDataURL(file);
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
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (isProfile) {
          setProfHeroImg(reader.result);
          onShowToast('Foto profil kantin berhasil dipilih');
        } else {
          setFormImage(reader.result);
          onShowToast('Foto makanan berhasil diunggah');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Math.max(1000, parseInt(formPrice, 10) || 10000);
    if (!formName.trim()) return;

    if (editingItem) {
      onEditMenuItem({
        ...editingItem,
        name: formName.trim(),
        description: formDesc.trim() || 'Hidangan segar kantin kampus IBI KKG',
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
      lastUpdatedDate: '8 Oktober 2026',
      lastUpdatedTime: 'Baru saja',
    });
    onShowToast('Profil Kantin & Jam Operasional berhasil diperbarui!');
  };

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Top Sub-Navigation Penjual (min-h 44px touch targets) */}
      <div className="w-full bg-surface-container-high border-b border-outline-variant/30 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
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
              label: 'Rekening, DANA & QRIS',
              icon: 'account_balance_wallet',
            },
            { id: 'profil', label: 'Profil Kantin', icon: 'store' },
            { id: 'ulasan', label: `Ulasan (${stall.reviews.length})`, icon: 'reviews' },
            { id: 'pengaturan', label: 'Pengaturan', icon: 'settings' },
          ].map((tab) => {
            const isActive = sellerSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSellerSubTab(tab.id as SellerSubTab)}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shrink-0 active:scale-[0.98] ${
                  isActive
                    ? 'bg-primary text-on-primary font-semibold shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Responsive Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex flex-col gap-6">
        {/* TAB 1 & 2: DASHBOARD & MENU HARGA */}
        {(sellerSubTab === 'dashboard' || sellerSubTab === 'menu') && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (Desktop 4 cols): Welcome Card & Quick Stats */}
            <div className="lg:col-span-4 flex flex-col gap-4 min-w-0">
              <div className="bg-surface-container rounded-xl p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
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
                      {stall.isOpen ? '🟢 Stan Buka Sekarang' : '🔴 Stan Tutup Sementara'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-[14px]">sync</span>
                    <span>Diperbarui: {stall.lastUpdatedDate}</span>
                  </div>
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
                      {items.length + 5}
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

              {/* Quick Action: + Tambah Menu */}
              <button
                onClick={openAddModal}
                className="w-full min-h-[48px] bg-primary-container hover:bg-primary text-on-primary font-label-lg text-label-lg rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">add_circle</span>
                <span>+ Tambah Menu Baru</span>
              </button>
            </div>

            {/* RIGHT COLUMN (Desktop 8 cols): Inventory & Price Management List */}
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

                {/* Scrollable Horizontal Tabs (44px min-height) */}
                <div
                  className="flex gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar"
                  role="tablist"
                >
                  {[
                    { id: 'all', label: `Semua (${items.length})` },
                    { id: 'makanan', label: `Makanan (${makananCount})` },
                    { id: 'minuman', label: `Minuman (${minumanCount})` },
                    { id: 'snack', label: `Snack (${snackCount})` },
                    { id: 'habis', label: `🔴 Habis (${habisCount})` },
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
                      className={`menu-item bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col justify-between gap-3 min-w-0 ${
                        isHabis ? 'opacity-85' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <img
                          className={`w-16 h-16 rounded-lg object-cover shrink-0 bg-surface-container ${
                            isHabis ? 'grayscale' : ''
                          }`}
                          alt={item.altMerchant}
                          src={item.imageMerchant}
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex flex-col min-w-0 flex-grow">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4
                                className={`font-label-lg text-label-lg text-on-surface break-words ${
                                  isHabis ? 'line-through' : ''
                                }`}
                              >
                                {item.name}
                              </h4>
                              <span className="text-[11px] text-on-surface-variant block mt-0.5">
                                Kategori: <strong className="uppercase">{item.category}</strong> •{' '}
                                {item.lastUpdated}
                              </span>
                            </div>
                            {/* 44px height Status Toggle */}
                            <button
                              aria-label="Ubah status ketersediaan"
                              onClick={() => onToggleMenuStatus(item.id)}
                              className={`status-toggle-badge min-h-[40px] px-3 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 transition-transform ${
                                isHabis
                                  ? 'bg-error-container text-on-error-container'
                                  : 'bg-secondary-container text-on-secondary-container'
                              }`}
                              type="button"
                            >
                              <span className="badge-text">
                                {isHabis ? '🔴 Habis' : '🟢 Tersedia'}
                              </span>
                            </button>
                          </div>
                          <span
                            className={`font-body-sm text-body-sm mt-1 ${
                              isHabis ? 'text-error' : 'text-on-surface-variant'
                            }`}
                          >
                            {isHabis
                              ? item.habisReason || 'Status: Habis (Mahasiswa melihat label Habis)'
                              : item.description}
                          </span>
                        </div>
                      </div>

                      {/* Responsive Price Input + Edit/Delete Action Bar (Reflows cleanly without fixed-px overflow) */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between pt-2.5 border-t border-outline-variant/25 gap-2">
                        <div className="flex items-center gap-1.5 bg-surface-container-low px-3 h-11 rounded-lg flex-1 min-w-[130px]">
                          <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                            Rp
                          </span>
                          <input
                            aria-label={`Harga ${item.name}`}
                            className="price-input bg-transparent font-label-lg text-label-lg text-primary font-bold w-full min-w-0 focus:outline-none"
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
                              const val = parseInt(e.target.value, 10) || 0;
                              onShowToast(
                                `Harga ${item.name} diperbarui: Rp${val.toLocaleString('id-ID')} (Tanggal update: 8 Oktober 2026)`
                              );
                            }}
                          />
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">
                            edit
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => openEditModal(item)}
                            className="min-h-[44px] px-3.5 flex items-center justify-center gap-1 rounded-lg bg-surface-container-high text-on-surface hover:text-primary font-label-sm text-label-sm transition-colors cursor-pointer active:scale-95"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => onDeleteMenuItem(item.id)}
                            className="min-h-[44px] px-3.5 flex items-center justify-center gap-1 rounded-lg bg-error-container/70 text-error hover:bg-error-container font-label-sm text-label-sm transition-colors cursor-pointer active:scale-95"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
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
          <section className="max-w-4xl mx-auto w-full flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">
                  Pesanan Aktif Perlu Diproses
                </span>
                <span className="font-headline-lg-mobile text-primary font-bold">
                  {activeOrdersCount} Pesanan
                </span>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">
                  Total Transaksi Masuk
                </span>
                <span className="font-headline-lg-mobile text-on-surface font-bold">
                  {stallOrders.length} Transaksi
                </span>
              </div>
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">
                  Pemasukan Langsung (Rp 0 Potongan)
                </span>
                <span className="font-headline-lg-mobile text-secondary font-bold">
                  Rp {totalRevenueToday.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="fluid-headline-md text-on-surface">
                    Antrean Pesanan &amp; Pembayaran Mahasiswa
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Cek saldo masuk di aplikasi DANA / M-Banking / QRIS Anda, lalu ubah status pesanan di bawah agar mahasiswa mendapat pemberitahuan otomatis.
                  </p>
                </div>
                <span className="font-label-sm text-[11px] bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-md font-semibold">
                  Real-Time Firebase
                </span>
              </div>

              {stallOrders.length === 0 ? (
                <div className="p-8 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/40 flex flex-col items-center text-center gap-2">
                  <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                    receipt_long
                  </span>
                  <h4 className="font-label-lg text-on-surface font-bold">
                    Belum Ada Pesanan Masuk
                  </h4>
                  <p className="font-body-sm text-on-surface-variant max-w-md">
                    Saat mahasiswa memesan makanan dan membayar melalui QRIS, DANA/GoPay/OVO, Transfer Bank, atau Tunai di halaman <strong>{stall.name}</strong>, daftar pesanannya akan langsung muncul di sini secara real-time.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {stallOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-headline-md text-[16px] text-on-surface font-bold">
                              {ord.studentName}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-surface-container-highest text-on-surface font-semibold">
                              NIM: {ord.studentNim}
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              • {ord.createdAt}
                            </span>
                          </div>
                          <div className="text-[12px] text-primary font-semibold mt-0.5">
                            Jadwal Ambil: {ord.pickupTime}
                          </div>
                        </div>

                        <span
                          className={`text-label-sm px-2.5 py-1 rounded-lg font-bold ${
                            ord.status === 'waiting_payment_verification'
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                              : ord.status === 'cooking'
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : ord.status === 'ready_pickup'
                              ? 'bg-secondary text-on-secondary'
                              : ord.status === 'completed'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          {ord.status === 'waiting_payment_verification'
                            ? '⏳ Menunggu Konfirmasi Bayar'
                            : ord.status === 'cooking'
                            ? '🍳 Sedang Dimasak'
                            : ord.status === 'ready_pickup'
                            ? '✅ Siap Diambil Mahasiswa'
                            : ord.status === 'completed'
                            ? '🎉 Selesai'
                            : '❌ Ditolak'}
                        </span>
                      </div>

                      {/* Item List */}
                      <div className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/25 flex flex-col gap-1.5">
                        {ord.items.map((item, idx) => (
                          <div
                            key={idx}
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
                        {ord.notes && (
                          <div className="text-[11px] text-tertiary pt-1 border-t border-outline-variant/20">
                            <strong>Catatan Mahasiswa:</strong> &ldquo;{ord.notes}&rdquo;
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/25">
                          <div className="flex flex-col">
                            <span className="text-[11px] text-on-surface-variant">
                              Metode Pembayaran Mahasiswa:
                            </span>
                            <span className="font-label-sm text-on-surface font-bold">
                              {ord.paymentProviderLabel}
                            </span>
                            {ord.paymentReference && (
                              <span className="text-[11px] text-secondary">
                                Info Bayar: {ord.paymentReference}
                              </span>
                            )}
                          </div>
                          <span className="font-headline-md text-[18px] text-primary font-bold">
                            Rp {ord.totalAmount.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons for Seller */}
                      <div className="flex flex-wrap items-center gap-2">
                        {ord.status === 'waiting_payment_verification' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onUpdateOrderStatus(ord.id, 'cooking')}
                              className="min-h-[42px] px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                check_circle
                              </span>
                              <span>Terima Pembayaran &amp; Masak Pesanan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateOrderStatus(ord.id, 'rejected')}
                              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold cursor-pointer"
                            >
                              Tolak (Dana Belum Masuk)
                            </button>
                          </>
                        )}

                        {ord.status === 'cooking' && (
                          <button
                            type="button"
                            onClick={() => onUpdateOrderStatus(ord.id, 'ready_pickup')}
                            className="min-h-[42px] px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label-md text-label-md font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              notifications_active
                            </span>
                            <span>Tandai Siap Diambil di Stan!</span>
                          </button>
                        )}

                        {ord.status === 'ready_pickup' && (
                          <button
                            type="button"
                            onClick={() => onUpdateOrderStatus(ord.id, 'completed')}
                            className="min-h-[42px] px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-md text-label-md font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              task_alt
                            </span>
                            <span>Selesaikan Transaksi (Sudah Diambil)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB PENGATURAN REKENING BANK, DANA/E-WALLET & QRIS PENJUAL */}
        {sellerSubTab === 'pembayaran' && (
          <section className="max-w-3xl mx-auto w-full">
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2 border-b border-outline-variant/25 pb-3">
                <div>
                  <span className="font-label-sm text-[11px] text-secondary font-bold uppercase tracking-wider">
                    Direct-to-Merchant • Tanpa Potongan Payment Gateway
                  </span>
                  <h3 className="fluid-headline-md text-on-surface">
                    Pengaturan Rekening Bank, DANA/E-Wallet &amp; QRIS {stall.name}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Uang pembayaran dari mahasiswa langsung masuk 100% ke QRIS, DANA/GoPay/OVO, atau Rekening Bank Anda tanpa biaya potongan admin.
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
                      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                        {payQrisImage && (
                          <img
                            src={payQrisImage}
                            alt="QRIS"
                            className="w-16 h-16 object-contain rounded bg-surface-container-lowest p-1 border"
                          />
                        )}
                        <label className="min-h-[40px] px-3.5 py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-sm text-label-sm font-semibold inline-flex items-center gap-2 cursor-pointer">
                          <span className="material-symbols-outlined text-[18px]">upload</span>
                          <span>Upload Foto Barcode QRIS Kantin Anda (Opsional)</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleQrisImageUpload}
                            className="hidden"
                          />
                        </label>
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
                  className="w-full min-h-[48px] py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold shadow-sm cursor-pointer"
                >
                  Simpan Pengaturan Pembayaran (QRIS, DANA &amp; Bank)
                </button>
              </form>
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
                <span className="font-headline-md text-tertiary font-bold shrink-0">
                  ⭐ {stall.rating}
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
                      <span className="text-label-sm text-tertiary">
                        {'⭐'.repeat(rev.rating)} • {rev.date}
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
                    className={`min-h-[44px] px-3 rounded-lg font-label-sm text-label-sm cursor-pointer border ${
                      formStatus === 'ready'
                        ? 'bg-secondary-container text-on-secondary-container border-secondary font-bold'
                        : 'bg-surface-container-low text-on-surface-variant border-transparent'
                    }`}
                  >
                    🟢 Tersedia
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStatus('habis')}
                    className={`min-h-[44px] px-3 rounded-lg font-label-sm text-label-sm cursor-pointer border ${
                      formStatus === 'habis'
                        ? 'bg-error-container text-on-error-container border-error font-bold'
                        : 'bg-surface-container-low text-on-surface-variant border-transparent'
                    }`}
                  >
                    🔴 Habis
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
    </div>
  );
};
