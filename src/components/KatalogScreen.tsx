import React, { useState, useEffect, useRef } from 'react';
import { normalizeStallLocation, OrderStatusType, OrderTransaction, Stall, StudentAccount } from '../data/kantinData';
import { OrderReceiptModal } from './OrderReceiptModal';
import { isValidStudentNim } from '../utils/securityGuard';

export type StudentSubTab = 'kantin' | 'kategori' | 'favorit' | 'pesanan';

interface KatalogScreenProps {
  stalls: Stall[];
  orders: OrderTransaction[];
  activeSubTab: StudentSubTab;
  onChangeSubTab: (tab: StudentSubTab) => void;
  favoriteStallIds: string[];
  onToggleFavoriteStall: (stallId: string) => void;
  onSelectStall: (stallId: string) => void;
  onNavigateMerchant: () => void;
  onNavigateAdmin: () => void;
  onOpenReportModal: () => void;
  onOpenInfoModal: (title: string, content: React.ReactNode) => void;
  loggedInStudent?: StudentAccount | null;
  studentAccounts?: StudentAccount[];
  onLoginStudentSuccess?: (account: StudentAccount) => void;
  onLogoutStudent?: () => void;
  onOpenAuthPortal?: () => void;
  onPlaceOrder?: (orderData: any) => OrderTransaction;
  onUpdateOrderStatus?: (orderId: string, nextStatus: OrderStatusType) => void;
  onShowToast?: (message: string, isError?: boolean) => void;
}

export const KatalogScreen: React.FC<KatalogScreenProps> = ({
  stalls,
  orders,
  activeSubTab,
  onChangeSubTab,
  favoriteStallIds,
  onToggleFavoriteStall,
  onSelectStall,
  onOpenReportModal,
  loggedInStudent = null,
  studentAccounts = [],
  onLoginStudentSuccess,
  onLogoutStudent,
  onOpenAuthPortal,
  onPlaceOrder,
  onUpdateOrderStatus,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'makanan' | 'minuman' | 'snack'>('all');
  const [onlyOpenFilter, setOnlyOpenFilter] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [orderLookupQuery, setOrderLookupQuery] = useState('');
  const [selectedReceiptOrder, setSelectedReceiptOrder] =
    useState<OrderTransaction | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 8 Golden Rules: Rule 2 (Universal Usability) & Rule 7 (Internal Locus of Control)
  // Keyboard Shortcut '/' or 'Ctrl+K' focuses search; 'Escape' dismisses receipt modal or clears search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedReceiptOrder) {
          setSelectedReceiptOrder(null);
        } else if (searchQuery) {
          setSearchQuery('');
        }
      } else if (
        (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReceiptOrder, searchQuery]);

  // Student Identity & Order Ownership Isolation
  const [currentStudentName, setCurrentStudentName] = useState<string>(() => {
    if (loggedInStudent?.name) return loggedInStudent.name;
    try {
      return localStorage.getItem('kantinku_student_name_v1') || '';
    } catch {
      return '';
    }
  });
  const [currentStudentNim, setCurrentStudentNim] = useState<string>(() => {
    if (loggedInStudent?.nim) return loggedInStudent.nim;
    try {
      return localStorage.getItem('kantinku_student_nim_v1') || '';
    } catch {
      return '';
    }
  });
  const [myOrderIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('kantinku_my_order_ids_v1') || '[]');
    } catch {
      return [];
    }
  });
  const [orderScopeTab, setOrderScopeTab] = useState<'my_orders'>('my_orders');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [tempNameInput, setTempNameInput] = useState(currentStudentName);
  const [tempNimInput, setTempNimInput] = useState(currentStudentNim);

  // Keep student identity strictly aligned with loggedInStudent
  useEffect(() => {
    if (loggedInStudent) {
      setCurrentStudentName(loggedInStudent.name);
      setCurrentStudentNim(loggedInStudent.nim);
      setTempNameInput(loggedInStudent.name);
      setTempNimInput(loggedInStudent.nim);
    }
  }, [loggedInStudent]);

  // Check if an order belongs to the currently logged in student / device
  const isOrderOwnedByMe = (ord: OrderTransaction) => {
    // 1. Strict authenticated account isolation
    if (loggedInStudent) {
      if (ord.studentId && ord.studentId === loggedInStudent.id) return true;
      if (
        ord.studentNim &&
        ord.studentNim.trim().toLowerCase() === loggedInStudent.nim.trim().toLowerCase()
      ) {
        return true;
      }
      if (
        ord.studentEmail &&
        loggedInStudent.email &&
        ord.studentEmail.trim().toLowerCase() === loggedInStudent.email.trim().toLowerCase()
      ) {
        return true;
      }
      if (
        ord.studentName &&
        loggedInStudent.name &&
        ord.studentName.trim().toLowerCase() === loggedInStudent.name.trim().toLowerCase()
      ) {
        return true;
      }
      // Strictly prevent other students' orders from showing
      return false;
    }

    // 2. Fallback when not logged in: matched by device order placement history
    if (myOrderIds.includes(ord.id)) return true;
    // 3. Matched by student name
    if (
      currentStudentName.trim() &&
      ord.studentName.toLowerCase().trim() === currentStudentName.toLowerCase().trim()
    ) {
      return true;
    }
    // 4. Matched by student NIM
    if (
      currentStudentNim.trim() &&
      ord.studentNim.trim().toLowerCase() === currentStudentNim.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  const handleSaveIdentity = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = tempNameInput.trim();
    const cleanNim = tempNimInput.trim();
    if (cleanNim && !isValidStudentNim(cleanNim)) {
      if (onShowToast) {
        onShowToast('Format NIM harus 7–12 digit angka resmi kampus (contoh: 32230104).', true);
      }
      return;
    }
    setCurrentStudentName(cleanName);
    setCurrentStudentNim(cleanNim);
    setIsEditingIdentity(false);
    try {
      if (cleanName) {
        localStorage.setItem('kantinku_student_name_v1', cleanName);
      } else {
        localStorage.removeItem('kantinku_student_name_v1');
      }
      if (cleanNim) {
        localStorage.setItem('kantinku_student_nim_v1', cleanNim);
      } else {
        localStorage.removeItem('kantinku_student_nim_v1');
      }
    } catch {
      // ignore
    }
    if (onShowToast) {
      onShowToast(
        cleanName
          ? `Nama pemesan diatur ke: "${cleanName}". Pesanan pribadi difilter otomatis.`
          : 'Filter nama dibersihkan.'
      );
    }
  };

  const myOrdersList = orders.filter(isOrderOwnedByMe);
  const myActiveOrdersCount = myOrdersList.filter(
    (o) =>
      o.status === 'waiting_payment_verification' ||
      o.status === 'cooking' ||
      o.status === 'ready_pickup'
  ).length;

  // 100% Strict Account Isolation: "Pesanan Saya" ONLY displays orders of the active account.
  // Never dump other students' orders into this screen.
  const scopedOrders = myOrdersList;

  const filteredStudentOrders = scopedOrders
    .filter((ord) => {
      if (orderStatusFilter === 'active') {
        return ord.status !== 'completed' && ord.status !== 'rejected';
      }
      if (orderStatusFilter === 'completed') {
        return ord.status === 'completed' || ord.status === 'rejected';
      }
      return true;
    })
    .filter((ord) => {
      const q = orderLookupQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        ord.studentNim.toLowerCase().includes(q) ||
        ord.studentName.toLowerCase().includes(q) ||
        ord.id.toLowerCase().includes(q) ||
        ord.stallName.toLowerCase().includes(q)
      );
    });

  // Filter logic for Stalls & Menu Items
  const filteredStalls = stalls.filter((stall) => {
    if (activeSubTab === 'favorit' && !favoriteStallIds.includes(stall.id)) {
      return false;
    }

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      stall.name.toLowerCase().includes(query) ||
      stall.specialty.toLowerCase().includes(query) ||
      stall.menuItems.some((m) => m.name.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    if (onlyOpenFilter && !stall.isOpen) return false;

    if (distanceFilter === '<100m' && stall.distanceMeters >= 100) return false;
    if (distanceFilter === '<500m' && stall.distanceMeters >= 500) return false;
    if (distanceFilter === '<1km' && stall.distanceMeters >= 1000) return false;

    const hasMatchingItem = stall.menuItems.some((item) => {
      const catMatch = categoryFilter === 'all' || item.category === categoryFilter;
      let priceMatch = true;
      if (priceFilter === '<=10000') priceMatch = item.price <= 10000;
      else if (priceFilter === '10000-15000') priceMatch = item.price >= 10000 && item.price <= 15000;
      else if (priceFilter === '<=15000') priceMatch = item.price <= 15000;
      else if (priceFilter === '15000-20000') priceMatch = item.price >= 15000 && item.price <= 20000;
      return catMatch && priceMatch;
    });

    return hasMatchingItem;
  });

  // Flattened menu items for Kategori tab
  const allMatchingMenuItems = stalls.flatMap((stall) =>
    stall.menuItems
      .filter((item) => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !query ||
          item.name.toLowerCase().includes(query) ||
          stall.name.toLowerCase().includes(query);
        if (!matchesSearch) return false;
        if (onlyOpenFilter && !stall.isOpen) return false;
        if (distanceFilter === '<100m' && stall.distanceMeters >= 100) return false;
        if (distanceFilter === '<500m' && stall.distanceMeters >= 500) return false;
        if (distanceFilter === '<1km' && stall.distanceMeters >= 1000) return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (priceFilter === '<=10000' && item.price > 10000) return false;
        if (priceFilter === '10000-15000' && (item.price < 10000 || item.price > 15000))
          return false;
        if (priceFilter === '<=15000' && item.price > 15000) return false;
        if (priceFilter === '15000-20000' && (item.price < 15000 || item.price > 20000))
          return false;
        return true;
      })
      .map((item) => ({ item, stall }))
  );

  const resetAllFilters = () => {
    setSearchQuery('');
    setPriceFilter('all');
    setDistanceFilter('all');
    setCategoryFilter('all');
    setOnlyOpenFilter(false);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    priceFilter !== 'all' ||
    distanceFilter !== 'all' ||
    categoryFilter !== 'all' ||
    onlyOpenFilter;

  const activeFilterCount =
    (priceFilter !== 'all' ? 1 : 0) +
    (distanceFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (onlyOpenFilter ? 1 : 0);

  const openStallsCount = stalls.filter((s) => s.isOpen).length;

  return (
    <div className="flex flex-col flex-1 w-full pb-6 sm:pb-8 bg-stone-50/70">
      {/* 1. SHOPEEFOOD/GOJEK STYLE SUB-NAV BAR (Sticky Under Top Bar) */}
      <nav aria-label="Navigasi Menu Utama" className="sticky top-14 sm:top-16 z-30 w-full bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 lg:px-8 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5 py-1.5 sm:py-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto py-0.5">
            {[
              { id: 'kantin', label: 'Semua Stan', icon: 'storefront' },
              { id: 'kategori', label: 'Eksplor Menu', icon: 'restaurant_menu' },
              {
                id: 'favorit',
                label: 'Favorit',
                icon: 'favorite',
                count: favoriteStallIds.length,
              },
              {
                id: 'pesanan',
                label: 'Pesanan Saya',
                icon: 'receipt_long',
                activeCount: myActiveOrdersCount,
                totalCount: myOrdersList.length,
              },
            ].map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeSubTab(tab.id as StudentSubTab)}
                  className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'bg-stone-100/90 text-stone-700 hover:text-stone-900 hover:bg-stone-200/80'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-white' : 'text-stone-600'}`}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>

                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="tabular-nums font-bold text-xs opacity-90">
                      ({tab.count})
                    </span>
                  )}

                  {tab.activeCount !== undefined && tab.activeCount > 0 && (
                    <span
                      className={`tabular-nums font-bold text-[11px] px-1.5 py-0.5 rounded-full transition-colors ${
                        isActive
                          ? 'bg-white text-emerald-800 font-black'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {tab.activeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Campus Status Indicator on Desktop */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-600 shrink-0">
            <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
              <span>{openStallsCount} dari {stalls.length} Stan Buka</span>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-medium text-slate-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px] text-emerald-600">domain</span>
              Kantin Hall D · IBI KKG
            </span>
          </div>
        </div>
      </nav>

      {/* 2. MAIN CONTAINER */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 sm:pt-2.5 flex flex-col gap-3">

        {activeSubTab === 'pesanan' ? (
          /* SUB-TAB: PESANAN SAYA (ShopeeFood / Gojek Order Tracker) */
          <div className="flex flex-col gap-2.5">
            {/* Clean Compact Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[19px] text-emerald-600">receipt_long</span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Pesanan Saya
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 tabular-nums">
                    {filteredStudentOrders.length}
                  </span>
                </div>

                {loggedInStudent ? (
                  <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/90 text-xs">
                    <span className="material-symbols-outlined text-[14px] text-emerald-700">verified_user</span>
                    <span className="text-slate-700">
                      Akun: <strong className="text-slate-900">{loggedInStudent.name}</strong>
                      <span className="text-slate-500 font-mono ml-1">({loggedInStudent.nim})</span>
                    </span>
                    {onLogoutStudent && (
                      <button
                        type="button"
                        onClick={onLogoutStudent}
                        className="ml-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                      >
                        Keluar
                      </button>
                    )}
                  </div>
                ) : currentStudentName ? (
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs text-xs">
                    <span className="material-symbols-outlined text-[14px] text-emerald-600">person</span>
                    <span className="text-slate-600">
                      Pemesan: <strong className="text-slate-900">{currentStudentName}</strong>
                      {currentStudentNim && <span className="text-slate-500 font-mono ml-1">({currentStudentNim})</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTempNameInput(currentStudentName);
                        setTempNimInput(currentStudentNim);
                        setIsEditingIdentity(true);
                      }}
                      className="ml-1 text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Ubah
                    </button>
                  </div>
                ) : onOpenAuthPortal ? (
                  <button
                    type="button"
                    onClick={onOpenAuthPortal}
                    className="min-h-[28px] px-3 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">login</span>
                    <span>Masuk Portal</span>
                  </button>
                ) : null}
              </div>

              <div className="relative w-full sm:w-60 shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">
                  search
                </span>
                <input
                  type="search"
                  value={orderLookupQuery}
                  onChange={(e) => setOrderLookupQuery(e.target.value)}
                  placeholder="Cari ID nota atau menu..."
                  className="w-full h-9 pl-8.5 pr-7 rounded-full bg-white text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200 shadow-2xs"
                />
                {orderLookupQuery && (
                  <button
                    type="button"
                    onClick={() => setOrderLookupQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    aria-label="Bersihkan pencarian"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter Tabs (Semua, Sedang Berjalan, Selesai) */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('all')}
                  className={`min-h-[34px] px-3.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                    orderStatusFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>Semua</span>
                  <span className="text-[11px] opacity-80 tabular-nums">({myOrdersList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('active')}
                  className={`min-h-[34px] px-3.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                    orderStatusFilter === 'active'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Sedang Berjalan</span>
                  <span className="text-[11px] opacity-90 font-bold tabular-nums">({myActiveOrdersCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('completed')}
                  className={`min-h-[34px] px-3.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                    orderStatusFilter === 'completed'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  <span>Riwayat Selesai</span>
                  <span className="text-[11px] opacity-80 tabular-nums">
                    ({myOrdersList.filter((o) => o.status === 'completed' || o.status === 'rejected').length})
                  </span>
                </button>
              </div>

              <span className="hidden sm:inline text-[11px] text-slate-500 font-medium">
                Pesanan yang telah diambil tetap tersimpan sebagai riwayat nota.
              </span>
            </div>

            {/* Inline Identity Editor Drawer */}
            {isEditingIdentity && (
              <form
                onSubmit={handleSaveIdentity}
                className="bg-white rounded-xl p-3 border border-emerald-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-xs font-bold text-slate-700">Nama Mahasiswa Pemesan:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Benedict"
                    value={tempNameInput}
                    onChange={(e) => setTempNameInput(e.target.value)}
                    className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:w-44">
                  <label className="text-xs font-bold text-slate-700">NIM Mahasiswa (Opsional):</label>
                  <input
                    type="text"
                    placeholder="Contoh: 32230104"
                    value={tempNimInput}
                    onChange={(e) => setTempNimInput(e.target.value)}
                    className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1 sm:pt-4">
                  <button
                    type="submit"
                    className="min-h-[36px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    Terapkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingIdentity(false)}
                    className="min-h-[36px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}

            {filteredStudentOrders.length === 0 ? (
              <div className="bg-white rounded-xl p-5 sm:p-6 text-center flex flex-col items-center gap-2 shadow-2xs border border-slate-200/80">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                </div>
                <div className="flex flex-col gap-0.5 max-w-md">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {orderLookupQuery.trim()
                      ? 'Pesanan Tidak Ditemukan'
                      : `Belum Ada Pesanan untuk "${loggedInStudent ? loggedInStudent.name : currentStudentName || 'Akun Anda'}"`}
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (orderLookupQuery.trim()) setOrderLookupQuery('');
                      else onChangeSubTab('kantin');
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs sm:text-sm cursor-pointer shadow-sm hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">storefront</span>
                    <span>{orderLookupQuery.trim() ? 'Bersihkan Pencarian' : 'Buka Katalog Kantin & Pesan Menu'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Orders List Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredStudentOrders.map((ord) => {
                    const isAutoPaid = ord.paymentStatus === 'paid_gateway';
                    const statusConfig = {
                      waiting_payment_verification: {
                        label: isAutoPaid ? 'Lunas • Menunggu Dapur' : 'Menunggu Konfirmasi Transfer',
                        bg: 'bg-amber-50 text-amber-800 border-amber-200',
                        dot: 'bg-amber-500',
                      },
                      cooking: {
                        label:
                          ord.fulfillmentType === 'dine_in'
                            ? 'Sedang Dimasak / Disajikan'
                            : 'Sedang Disiapkan di Stan',
                        bg: 'bg-orange-50 text-orange-800 border-orange-200',
                        dot: 'bg-orange-500',
                      },
                      ready_pickup: {
                        label:
                          ord.fulfillmentType === 'dine_in'
                            ? `Siap di Meja ${ord.tableNumber || ''}!`
                            : 'Siap Diambil di Stan!',
                        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                        dot: 'bg-emerald-500',
                      },
                      completed: {
                        label: 'Selesai',
                        bg: 'bg-slate-100 text-slate-700 border-slate-200',
                        dot: 'bg-slate-400',
                      },
                      rejected: {
                        label: 'Dibatalkan',
                        bg: 'bg-rose-50 text-rose-800 border-rose-200',
                        dot: 'bg-rose-500',
                      },
                    }[ord.status];

                    return (
                      <div
                        key={ord.id}
                        className={`rounded-lg p-4 sm:p-5 border transition-all flex flex-col justify-between gap-3.5 ${
                          ord.status === 'ready_pickup'
                            ? 'bg-emerald-50/40 border-emerald-400 ring-1 ring-emerald-400/40 shadow-sm'
                            : ord.status === 'completed'
                            ? 'bg-white border-slate-200/90 shadow-2xs hover:shadow-sm'
                            : 'bg-white border-slate-200 shadow-xs hover:shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col gap-3">
                          {/* Card Header: Stall Name, Date, and Status Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-slate-900 text-base sm:text-lg leading-snug truncate">
                                {ord.stallName}
                              </h4>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">
                                #{ord.id} • {ord.createdAt}
                              </p>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 shrink-0 ${statusConfig.bg}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                              <span>
                                {ord.status === 'ready_pickup' && ord.fulfillmentType === 'dine_in'
                                  ? `Diantar ke Meja ${ord.tableNumber || ''}`.trim()
                                  : statusConfig.label}
                              </span>
                            </span>
                          </div>

                          {/* Context Tags Row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ord.fulfillmentType === 'dine_in' ? (
                              <span className="text-[11px] font-bold text-amber-900 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">table_restaurant</span>
                                Makan di Meja {ord.tableNumber || '-'}
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">shopping_bag</span>
                                Ambil di Stan
                              </span>
                            )}
                            {isAutoPaid ? (
                              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                                Lunas Otomatis
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                                {ord.paymentProviderLabel}
                              </span>
                            )}
                          </div>

                          {/* Status Feedback Banner */}
                          {ord.status === 'ready_pickup' && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] shrink-0">notifications_active</span>
                                <span className="text-xs font-bold leading-tight">
                                  {ord.fulfillmentType === 'dine_in'
                                    ? `Makanan siap disajikan di Meja ${ord.tableNumber || '-'}!`
                                    : 'Pesanan sudah siap diambil di stan!'}
                                </span>
                              </div>
                              {onUpdateOrderStatus && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateOrderStatus(ord.id, 'completed');
                                    onShowToast?.(`Pesanan #${ord.id} berhasil ditandai sudah diambil!`);
                                  }}
                                  className="min-h-[32px] px-3 py-1 rounded-lg bg-white text-emerald-800 text-xs font-bold hover:bg-emerald-50 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs flex items-center justify-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                                  <span>Sudah Diambil ✓</span>
                                </button>
                              )}
                            </div>
                          )}
                          {ord.status === 'completed' && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 text-[11px] text-slate-600 font-medium border border-slate-200/80">
                              <span className="material-symbols-outlined text-[15px] text-emerald-600 shrink-0">check_circle</span>
                              <span>Pesanan sudah selesai diambil &amp; tercatat di riwayat.</span>
                            </div>
                          )}

                          {/* Info Box: Pemesan, Jam Ambil & Metode */}
                          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Pemesan:</span>
                              <span className="font-semibold text-slate-900 text-right">
                                {ord.studentName} {ord.studentNim ? `(${ord.studentNim})` : ''}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Jam Ambil:</span>
                              <span className="font-bold text-emerald-700">{ord.pickupTime}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span>Metode Bayar:</span>
                              <span className="font-medium text-slate-800">{ord.paymentProviderLabel}</span>
                            </div>
                          </div>

                          {/* Menu Items List */}
                          <div className="flex flex-col gap-1.5 pt-1">
                            {(ord.items ?? []).map((it, idx) => (
                              <div
                                key={`${ord.id}-item-${idx}`}
                                className="flex items-center justify-between text-xs text-slate-700"
                              >
                                <span className="line-clamp-1 pr-2">
                                  <span className="font-bold text-slate-900">{it.quantity}x</span> {it.name}
                                </span>
                                <span className="font-medium shrink-0 tabular-nums">
                                  Rp {(it.price * it.quantity).toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs sm:text-sm font-bold text-slate-900">
                              <span>Total Bayar:</span>
                              <span className="text-emerald-700 text-sm sm:text-base tabular-nums font-black">
                                Rp {(ord.totalAmount ?? 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 mt-auto">
                          {onUpdateOrderStatus && (ord.status === 'ready_pickup' || ord.status === 'cooking') && (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateOrderStatus(ord.id, 'completed');
                                onShowToast?.(`Pesanan #${ord.id} berhasil ditandai sudah diambil!`);
                              }}
                              className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined text-[17px]">task_alt</span>
                              <span>Konfirmasi Sudah Saya Ambil</span>
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setSelectedReceiptOrder(ord)}
                              className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                                ord.status === 'completed'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                              <span>Nota Digital</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectStall(ord.stallId)}
                              className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">storefront</span>
                              <span>Buka Stan</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* SUB-TAB: SEMUA KANTIN / EKSPLOR MENU / FAVORIT */
          <div className="flex flex-col gap-3.5 sm:gap-4">
            {/* 3. HERO BANNER & SEARCH SECTION - Modern Crisp Style */}
            <section className="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-4 sm:p-5 shadow-xs border border-emerald-800/80">
              {/* Subtle appetizing dual glow: emerald + warm sunset orange */}
              <div className="absolute -top-16 -right-12 w-60 h-60 rounded-full bg-orange-500/15 blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-16 -left-12 w-60 h-60 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                    Pesan Makanan &amp; Jastip
                  </h1>
                </div>

                {/* Search Bar - Prominent Stadium Oval Capsule */}
                <form
                  onSubmit={(e) => e.preventDefault()}
                  className="w-full max-w-3xl relative"
                >
                  <div className="relative flex items-center w-full">
                    <input
                      ref={searchInputRef}
                      type="search"
                      id="menuSearchInput"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari menu makanan, minuman, atau stan (tekan '/' untuk cari)..."
                      className="w-full h-12 sm:h-13.5 pl-12 sm:pl-14 pr-24 sm:pr-28 rounded-full bg-white text-stone-900 placeholder:text-stone-400 text-xs sm:text-sm font-medium border-2 border-emerald-400/80 shadow-lg shadow-emerald-950/25 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-400/30 focus:outline-none transition-all"
                    />
                    <div className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center pointer-events-none shadow-xs">
                      <span className="material-symbols-outlined text-[20px] sm:text-[22px]">search</span>
                    </div>
                    <div className="flex items-center gap-1.5 absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2">
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Bersihkan pencarian"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      ) : (
                        <kbd
                          title="Tekan '/' atau 'Ctrl+K' untuk mencari"
                          className="hidden sm:inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-[10px] font-mono text-stone-500 select-none shadow-2xs"
                        >
                          /
                        </kbd>
                      )}
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Cari
                      </button>
                    </div>
                  </div>
                </form>

                {/* Tactile Category Pill Controls */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                  {[
                    { id: 'all', label: 'Semua', icon: 'restaurant' },
                    { id: 'makanan', label: 'Makanan', icon: 'lunch_dining' },
                    { id: 'minuman', label: 'Minuman', icon: 'local_cafe' },
                    { id: 'snack', label: 'Snack', icon: 'bakery_dining' },
                  ].map((cat) => {
                    const isSelected = categoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setCategoryFilter(cat.id as 'all' | 'makanan' | 'minuman' | 'snack')
                        }
                        className={`min-h-[36px] px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                          isSelected
                            ? 'bg-white text-emerald-950 shadow-sm font-bold border border-white'
                            : 'bg-emerald-900/50 hover:bg-emerald-900/70 text-emerald-100 border border-emerald-400/20'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {cat.icon}
                        </span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 4. EXPANDABLE FILTER ROW - Mixed with Pill Badges */}
            <div className="bg-white rounded-xl border border-stone-200/90 shadow-2xs overflow-hidden transition-all duration-200">
              {/* Primary Bar: Quick Filters & Actions */}
              <div className="p-2 sm:px-3 sm:py-2 flex items-center justify-between gap-2 flex-wrap">
                {/* Left: Filter Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-stone-400 uppercase tracking-wider mr-0.5 select-none">
                    <span className="material-symbols-outlined text-[15px] text-stone-400">filter_alt</span>
                    <span>Filter:</span>
                  </div>

                  {/* Quick Toggle: Stan Buka (Pill) */}
                  <button
                    type="button"
                    onClick={() => setOnlyOpenFilter(!onlyOpenFilter)}
                    className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                      onlyOpenFilter
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs font-bold'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full transition-colors ${onlyOpenFilter ? 'bg-emerald-600' : 'bg-stone-300'}`} />
                    <span>Stan Buka</span>
                  </button>

                  {/* Quick Toggle: Budget Hemat (Pill) */}
                  <button
                    type="button"
                    onClick={() => setPriceFilter(priceFilter === '<=15000' ? 'all' : '<=15000')}
                    className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                      priceFilter === '<=15000'
                        ? 'bg-orange-50 text-orange-900 border-orange-300 font-bold shadow-2xs'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[15px] ${priceFilter === '<=15000' ? 'text-orange-600' : 'text-stone-400'}`}>
                      savings
                    </span>
                    <span>Hemat ≤ Rp15rb</span>
                  </button>

                  {/* Active filter summary tag if custom */}
                  {priceFilter !== 'all' && priceFilter !== '<=15000' && (
                    <span className="inline-flex items-center gap-1 min-h-[32px] px-3 py-1 rounded-full bg-orange-50 text-orange-900 font-bold text-xs border border-orange-200">
                      <span className="material-symbols-outlined text-[13px] text-orange-600">sell</span>
                      <span>
                        {priceFilter === '<=10000'
                          ? '≤ Rp10rb'
                          : priceFilter === '10000-15000'
                          ? 'Rp10rb–15rb'
                          : 'Rp15rb–20rb'}
                      </span>
                    </span>
                  )}

                  {/* Active distance filter tag if custom */}
                  {distanceFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 min-h-[32px] px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 font-bold text-xs border border-emerald-200">
                      <span className="material-symbols-outlined text-[13px] text-emerald-600">near_me</span>
                      <span>{distanceFilter === '<100m' ? '< 100m' : '< 500m'}</span>
                    </span>
                  )}

                  {/* Reset Button */}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Reset semua filter"
                    >
                      <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                      <span>Reset</span>
                    </button>
                  )}
                </div>

                {/* Right: Expand Filter Button */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`min-h-[32px] px-3.5 py-1 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border ${
                      showAdvancedFilters || (distanceFilter !== 'all' || (priceFilter !== 'all' && priceFilter !== '<=15000'))
                        ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                        : 'bg-stone-100 hover:bg-stone-200/80 text-stone-700 border-stone-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {showAdvancedFilters ? 'expand_less' : 'tune'}
                    </span>
                    <span>{showAdvancedFilters ? 'Tutup' : 'Filter Lanjutan'}</span>
                    {(distanceFilter !== 'all' || (priceFilter !== 'all' && priceFilter !== '<=15000')) && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
                        {(distanceFilter !== 'all' ? 1 : 0) + (priceFilter !== 'all' && priceFilter !== '<=15000' ? 1 : 0)}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Integrated Collapsible Advanced Filters Drawer */}
              {showAdvancedFilters && (
                <div className="border-t border-stone-200/80 bg-stone-50/70 p-4 sm:p-5 flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Distance Filter */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">location_on</span>
                        <span>Jarak dari Kampus IBI KKG:</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { id: 'all', label: 'Semua Jarak' },
                          { id: '<100m', label: '< 100m' },
                          { id: '<500m', label: '< 500m' },
                        ].map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setDistanceFilter(d.id)}
                            className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all active:scale-95 ${
                              distanceFilter === d.id
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200/90'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price Bounds Filter */}
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700">
                        <span className="material-symbols-outlined text-[15px] text-orange-600">payments</span>
                        <span>Batas Budget Kantong Mahasiswa:</span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { id: 'all', label: 'Semua Harga' },
                          { id: '<=10000', label: '≤ Rp10.000' },
                          { id: '10000-15000', label: 'Rp10.000 – Rp15.000' },
                          { id: '<=15000', label: '≤ Rp15.000' },
                          { id: '15000-20000', label: 'Rp15.000 – Rp20.000' },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPriceFilter(p.id)}
                            className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all active:scale-95 ${
                              priceFilter === p.id
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200/90'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer Status & Quick Actions */}
                  <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between text-xs text-stone-600">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-emerald-600">storefront</span>
                      <span>Menampilkan <strong className="text-stone-900 font-bold">{filteredStalls.length} stan</strong></span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters(false)}
                      className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <span>Tutup</span>
                      <span className="material-symbols-outlined text-[14px]">expand_less</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 5. VIEW TOGGLE: KATEGORI EXPLORE VS STALL DIRECTORY */}
            {activeSubTab === 'kategori' ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    Jelajah Menu ({allMatchingMenuItems.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allMatchingMenuItems.map(({ item, stall }) => (
                    <div
                      key={`${stall.id}-${item.id}`}
                      onClick={() => onSelectStall(stall.id)}
                      className="bg-white rounded-lg p-3 shadow-xs border border-stone-200 hover:shadow-md hover:border-emerald-300 transition-all flex gap-3 cursor-pointer group"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden bg-slate-100 shrink-0 relative border border-slate-200/80">
                        <img
                          src={item.imageCatalog}
                          alt={item.altCatalog}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {item.status === 'habis' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-bold uppercase">
                            Habis
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col justify-between flex-grow min-w-0">
                        <div>
                          <span className="text-[11px] font-bold text-emerald-700 truncate block">
                            {stall.name}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-1">
                            {item.name}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-sm font-black text-emerald-700">
                            Rp {item.price.toLocaleString('id-ID')}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400 group-hover:text-emerald-700 flex items-center gap-0.5">
                            Pesan
                            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* STALLS DIRECTORY GRID */
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    {activeSubTab === 'favorit'
                      ? `Stan Favorit (${filteredStalls.length})`
                      : `Daftar Stan (${filteredStalls.length})`}
                  </h2>
                </div>

                {filteredStalls.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 sm:p-12 text-center flex flex-col items-center gap-3 shadow-xs border border-slate-200">
                    <span className="material-symbols-outlined text-[48px] text-slate-300">
                      search_off
                    </span>
                    <h3 className="text-lg font-bold text-slate-800">
                      Tidak Ada Stan yang Sesuai
                    </h3>
                    <p className="text-sm text-slate-500 max-w-md">
                      Coba ubah kata kunci pencarian atau bersihkan filter budget harga.
                    </p>
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="mt-2 min-h-[40px] px-5 py-2 rounded-md bg-emerald-600 text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95"
                    >
                      Reset Semua Filter
                    </button>
                  </div>
                ) : (
                  /* 6. MODERN CRISP STALL CARD GRID */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredStalls.map((rawStall, idx) => {
                      const stall = normalizeStallLocation(rawStall, idx);
                      const isFav = favoriteStallIds.includes(stall.id);
                      const matchingMenus = stall.menuItems.filter((item) => {
                        const catMatch =
                          categoryFilter === 'all' || item.category === categoryFilter;
                        let priceMatch = true;
                        if (priceFilter === '<=10000') priceMatch = item.price <= 10000;
                        else if (priceFilter === '10000-15000')
                          priceMatch = item.price >= 10000 && item.price <= 15000;
                        else if (priceFilter === '<=15000') priceMatch = item.price <= 15000;
                        else if (priceFilter === '15000-20000')
                          priceMatch = item.price >= 15000 && item.price <= 20000;
                        return catMatch && priceMatch;
                      });
                      const displayMenus =
                        matchingMenus.length > 0 ? matchingMenus : stall.menuItems;

                      return (
                        <article
                          key={stall.id}
                          className="group bg-white rounded-lg sm:rounded-xl shadow-2xs hover:shadow-md border border-stone-200 hover:border-emerald-400 overflow-hidden flex flex-col justify-between transition-all duration-200"
                        >
                          <div>
                            {/* Card Hero Image */}
                            <div className="relative w-full h-44 sm:h-48 bg-slate-100 overflow-hidden">
                              <img
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                alt={stall.bannerAlt}
                                src={stall.bannerImage}
                                referrerPolicy="no-referrer"
                              />

                              {/* Subtle bottom gradient overlay for readability */}
                              <div className="absolute inset-0 bg-linear-to-t from-slate-950/75 via-transparent to-black/20"></div>

                              {/* Top Left Status Indicator - Crisp Tags */}
                              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-2.5 py-0.5 rounded-md text-xs font-semibold shadow-sm backdrop-blur-md ${
                                    stall.isOpen
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-800/90 text-slate-200'
                                  }`}
                                >
                                  {stall.isOpen ? 'Buka' : 'Tutup'}
                                </span>

                                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-black/60 backdrop-blur-md text-white shadow-sm flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px] text-amber-400">
                                    timer
                                  </span>
                                  <span>~10-15 mnt</span>
                                </span>
                              </div>

                              {/* Favorite Button - Modern Crisp Square */}
                              <button
                                type="button"
                                aria-label={`Simpan favorit ${stall.name}`}
                                onClick={() => onToggleFavoriteStall(stall.id)}
                                className="absolute top-2.5 right-2.5 min-h-[38px] min-w-[38px] rounded-lg bg-white/90 backdrop-blur-md hover:bg-white text-rose-500 flex items-center justify-center shadow-xs cursor-pointer active:scale-90 transition-all border border-stone-200/60"
                              >
                                <span
                                  className="material-symbols-outlined text-[19px]"
                                  style={{
                                    fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0",
                                  }}
                                >
                                  favorite
                                </span>
                              </button>

                              {/* Bottom Overlay Info on Image */}
                              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white text-xs">
                                <span className="flex items-center gap-1 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-md font-medium text-[11px]">
                                  <span className="material-symbols-outlined text-[13px] text-emerald-400">
                                    location_on
                                  </span>
                                  <span>{stall.locationDetail} · <span className="tabular-nums">{stall.distanceMeters}m</span></span>
                                </span>

                                <span className="flex items-center gap-1 bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-md shadow-xs tabular-nums text-xs">
                                  <span className="material-symbols-outlined text-[13px]">star</span>
                                  <span>{stall.rating}</span>
                                </span>
                              </div>
                            </div>

                            {/* Card Body - Crisp & Spacious */}
                            <div className="p-4 flex flex-col gap-3">
                              {/* Stall Identity & Specialty */}
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                                      {stall.name}
                                    </h3>
                                    <span
                                      className="material-symbols-outlined text-[17px] text-emerald-600 shrink-0"
                                      title={
                                        stall.campusName
                                          ? `Mitra Resmi Terverifikasi · ${stall.campusName}`
                                          : 'Mitra Resmi Kantin Kampus Terverifikasi'
                                      }
                                    >
                                      verified
                                    </span>
                                  </div>

                                  {stall.isStudentEntrepreneur && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded shrink-0">
                                      <span className="material-symbols-outlined text-[12px]">school</span>
                                      Usaha Mahasiswa
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-500 line-clamp-1 font-medium">
                                  {stall.specialty}
                                </p>

                                {/* Location & Operating Hours */}
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap pt-0.5">
                                  <span className="flex items-center gap-1 text-slate-700">
                                    <span className="material-symbols-outlined text-[13px] text-slate-400">
                                      storefront
                                    </span>
                                    {stall.building}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300">·</span>
                                  <span className="flex items-center gap-1 text-slate-600">
                                    <span className="material-symbols-outlined text-[13px] text-slate-400">
                                      schedule
                                    </span>
                                    {stall.hours}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300">·</span>
                                  <span className="text-emerald-700 font-semibold">
                                    {stall.menuItems.length} pilihan menu
                                  </span>
                                </div>
                              </div>

                              {/* Price Transparency & Payment Acceptance Row */}
                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap gap-1">
                                <span className="flex items-center gap-1 text-slate-700 font-semibold">
                                  <span className="material-symbols-outlined text-[14px] text-emerald-600">
                                    verified_user
                                  </span>
                                  Tarif Resmi Stan
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                  {stall.paymentMethods && stall.paymentMethods.length > 0 ? (
                                    <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {stall.paymentMethods.slice(0, 2).join(' / ')}
                                      {stall.paymentMethods.length > 2 && ` +${stall.paymentMethods.length - 2}`}
                                    </span>
                                  ) : (
                                    <span>QRIS / Tunai</span>
                                  )}
                                </div>
                              </div>

                              {/* Menu Andalan Preview */}
                              <div className="flex flex-col gap-1.5 pt-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px] text-amber-500">
                                      local_fire_department
                                    </span>
                                    Menu Andalan
                                  </span>
                                  <span className="text-[11px] font-semibold text-emerald-700 group-hover:text-emerald-800 flex items-center gap-0.5">
                                    <span>Lihat semua</span>
                                    <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                                  </span>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  {displayMenus.slice(0, 2).map((item) => (
                                    <div
                                      key={item.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectStall(stall.id);
                                      }}
                                      className="group/item flex items-center gap-2.5 p-1.5 rounded-md bg-slate-50/80 hover:bg-emerald-50/70 border border-slate-200/70 hover:border-emerald-300 transition-all duration-150 cursor-pointer"
                                      title={`Lihat detail ${item.name}`}
                                    >
                                      {/* Mini Food Thumbnail */}
                                      <div className="relative w-11 h-11 rounded overflow-hidden bg-slate-200 shrink-0 border border-slate-200/80">
                                        {item.imageCatalog ? (
                                          <img
                                            src={item.imageCatalog}
                                            alt={item.name}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-200"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-sm bg-emerald-50">
                                            {item.icon || '🍱'}
                                          </div>
                                        )}
                                        {item.status === 'habis' && (
                                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[8px] font-bold">
                                            HABIS
                                          </div>
                                        )}
                                      </div>

                                      {/* Food Information */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                          <h4 className="text-xs font-semibold text-slate-800 truncate group-hover/item:text-emerald-700 transition-colors">
                                            {item.name}
                                          </h4>
                                          <span className="font-bold text-xs text-emerald-700 shrink-0 tabular-nums">
                                            Rp {item.price.toLocaleString('id-ID')}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                          <span className="capitalize">{item.category}</span>
                                          <span aria-hidden="true" className="text-slate-300">·</span>
                                          {item.status === 'ready' ? (
                                            <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                              Tersedia
                                            </span>
                                          ) : (
                                            <span className="text-rose-500 font-medium">Habis</span>
                                          )}
                                          {item.isPreOrderDiscount && (
                                            <>
                                              <span aria-hidden="true" className="text-slate-300">·</span>
                                              <span className="text-amber-600 font-semibold flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-[10px]">bolt</span>
                                                Promo PO
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer Action */}
                          <div className="p-4 pt-0">
                            <button
                              type="button"
                              onClick={() => onSelectStall(stall.id)}
                              className="w-full min-h-[42px] py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs cursor-pointer active:scale-95 transition-all"
                            >
                              <span>Lihat Menu &amp; Pesan</span>
                              <span className="material-symbols-outlined text-[18px]">
                                arrow_forward
                              </span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. DIGITAL RECEIPT MODAL */}
      {selectedReceiptOrder && (
        <OrderReceiptModal
          order={selectedReceiptOrder}
          onClose={() => setSelectedReceiptOrder(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
