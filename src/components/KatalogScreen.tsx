import React, { useState } from 'react';
import { Stall } from '../data/kantinData';

export type StudentSubTab = 'beranda' | 'kantin' | 'kategori' | 'favorit' | 'profil';

interface KatalogScreenProps {
  stalls: Stall[];
  activeSubTab: StudentSubTab;
  onChangeSubTab: (tab: StudentSubTab) => void;
  favoriteStallIds: string[];
  onToggleFavoriteStall: (stallId: string) => void;
  onSelectStall: (stallId: string) => void;
  onNavigateMerchant: () => void;
  onNavigateAdmin: () => void;
  onOpenReportModal: () => void;
  onOpenInfoModal: (title: string, content: React.ReactNode) => void;
}

export const KatalogScreen: React.FC<KatalogScreenProps> = ({
  stalls,
  activeSubTab,
  onChangeSubTab,
  favoriteStallIds,
  onToggleFavoriteStall,
  onSelectStall,
  onNavigateMerchant,
  onNavigateAdmin,
  onOpenReportModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'makanan' | 'minuman' | 'snack'>('all');
  const [onlyOpenFilter, setOnlyOpenFilter] = useState<boolean>(false);
  const [mapBuildingTab, setMapBuildingTab] = useState<'A' | 'B'>('A');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);

  // Student evaluation survey state (Indikator Keberhasilan Tahap 1)
  const [surveyFastBudget, setSurveyFastBudget] = useState(true);
  const [surveyClearPrice, setSurveyClearPrice] = useState(true);
  const [surveyNearLocation, setSurveyNearLocation] = useState(true);
  const [surveySubmitted, setSurveySubmitted] = useState(false);

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

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Clean Horizontal Sub-Nav Bar for Student Web Application */}
      <div className="w-full bg-surface-container-low border-b border-outline-variant/25 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'beranda', label: 'Beranda & Peta', icon: 'map' },
            { id: 'kantin', label: 'Semua Kantin', icon: 'storefront' },
            { id: 'kategori', label: 'Kategori Menu', icon: 'restaurant_menu' },
            { id: 'favorit', label: `Favorit (${favoriteStallIds.length})`, icon: 'favorite' },
            { id: 'profil', label: 'Profil & Evaluasi', icon: 'person' },
          ].map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeSubTab(tab.id as StudentSubTab)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer active:scale-[0.98] ${
                  isActive
                    ? 'bg-primary text-on-primary font-semibold shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Container with 3-State Responsive Width */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex flex-col gap-5">
        {/* SUB-TAB PROFIL MAHASISWA & EVALUASI PILOT TAHAP 1 */}
        {activeSubTab === 'profil' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-headline-md font-bold shrink-0">
                    AP
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-secondary font-semibold">
                      Mahasiswa Aktif IBI KKG
                    </span>
                    <h2 className="fluid-headline-md text-on-surface truncate">
                      Aldo Phiong (NIM 32230104)
                    </h2>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Program Studi Informatika • Kampus Sunter
                    </span>
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1.5 text-body-sm text-on-surface-variant">
                  <span className="font-label-md text-on-surface font-semibold">
                    Alur Penggunaan Mahasiswa (Tahap 1):
                  </span>
                  <span className="leading-relaxed">
                    Buka Website → Masuk ke IBI KKG → Lihat Peta Kantin → Cari / Filter Budget &amp; Jarak → Pilih Kantin → Lihat Menu, Harga &amp; Waktu Update → Datang ke Kantin.
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-high rounded-xl p-4 sm:p-5 flex flex-col gap-3">
                <h3 className="fluid-headline-md text-on-surface">
                  Simulasi Peran Pengguna Lain (Tahap 1)
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Uji alur Penjual Kantin (menginput menu, mengubah harga Rp12.000 → Rp15.000 secara langsung, mengubah status Tersedia/Habis) atau Admin:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={onNavigateMerchant}
                    className="min-h-[44px] px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer active:scale-[0.98]"
                  >
                    Dashboard Penjual
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateAdmin}
                    className="min-h-[44px] px-4 py-2.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md font-semibold cursor-pointer active:scale-[0.98]"
                  >
                    Portal Admin
                  </button>
                </div>
              </div>
            </div>

            {/* Indikator Keberhasilan Tahap 1 */}
            <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="fluid-headline-md text-on-surface">
                  Evaluasi Pilot Project Tahap 1
                </h3>
                <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-lg shrink-0">
                  Riset Kampus
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Bantu tim riset mengukur apakah KantinKu IBI KKG benar-benar menyelesaikan masalah pencarian makan di kampus:
              </p>
              <div className="flex flex-col gap-2.5">
                <label className="min-h-[48px] flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low cursor-pointer">
                  <span className="font-body-sm text-body-sm text-on-surface">
                    1. Lebih cepat menemukan makanan sesuai budget?
                  </span>
                  <input
                    type="checkbox"
                    checked={surveyFastBudget}
                    onChange={(e) => setSurveyFastBudget(e.target.checked)}
                    className="w-5 h-5 accent-primary shrink-0"
                  />
                </label>
                <label className="min-h-[48px] flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low cursor-pointer">
                  <span className="font-body-sm text-body-sm text-on-surface">
                    2. Informasi harga &amp; &ldquo;Terakhir diperbarui&rdquo; lebih jelas?
                  </span>
                  <input
                    type="checkbox"
                    checked={surveyClearPrice}
                    onChange={(e) => setSurveyClearPrice(e.target.checked)}
                    className="w-5 h-5 accent-primary shrink-0"
                  />
                </label>
                <label className="min-h-[48px] flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low cursor-pointer">
                  <span className="font-body-sm text-body-sm text-on-surface">
                    3. Terbantu menemukan lokasi kantin terdekat?
                  </span>
                  <input
                    type="checkbox"
                    checked={surveyNearLocation}
                    onChange={(e) => setSurveyNearLocation(e.target.checked)}
                    className="w-5 h-5 accent-primary shrink-0"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => setSurveySubmitted(true)}
                className="w-full min-h-[44px] py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer active:scale-[0.98] mt-1"
              >
                {surveySubmitted
                  ? '✓ Terima Kasih! Evaluasi Tersimpan'
                  : 'Kirim Evaluasi Mahasiswa'}
              </button>
            </div>
          </div>
        ) : (
          /* THREE-STATE RESPONSIVE LAYOUT:
             - Mobile (<768px): Stacked single column
             - Tablet (768px-1023px): 2-column stall grid + full-width map banner
             - Desktop (>=1024px): 12-column split (Left 4 cols sticky Map & Filters, Right 8 cols 2-column Stall Grid)
          */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT RAIL (Desktop 4 cols sticky, Mobile/Tablet compact collapsible accordion) */}
            <div className="lg:col-span-4 lg:sticky lg:top-20 flex flex-col gap-3 min-w-0">
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                {/* Compact Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-label-sm text-[11px] text-secondary font-semibold">
                        🟢 {stalls.filter((s) => s.isOpen).length}/{stalls.length} Kantin Buka
                      </span>
                      <span className="text-outline-variant">•</span>
                      <span className="font-label-sm text-[11px] text-on-surface-variant">
                        Kampus IBI KKG
                      </span>
                    </div>
                    <h1 className="fluid-headline-md text-on-surface">
                      Mau Makan di Mana Hari Ini?
                    </h1>
                  </div>

                  {/* Mobile/Tablet Map Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setMobileMapOpen(!mobileMapOpen)}
                    className="lg:hidden min-h-[40px] px-3 py-1.5 rounded-lg bg-surface-container-high text-primary font-label-sm text-label-sm flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">map</span>
                    <span>{mobileMapOpen ? 'Tutup Peta' : 'Lihat Peta'}</span>
                  </button>
                </div>

                {/* Peta Lokasi Kantin IBI KKG (Always visible on Desktop lg+, Collapsible on Mobile/Tablet so it doesn't push stalls below the fold) */}
                <div
                  className={`${
                    mobileMapOpen ? 'flex' : 'hidden lg:flex'
                  } bg-surface-container-low rounded-xl p-3 flex-col gap-2.5 border border-outline-variant/30`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label-sm text-label-sm text-on-surface font-semibold truncate">
                      Peta Titik Kantin (A–D)
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setMapBuildingTab('A')}
                        className={`min-h-[32px] px-2.5 py-1 rounded-md text-label-sm font-semibold cursor-pointer transition-colors ${
                          mapBuildingTab === 'A'
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-lowest text-on-surface-variant'
                        }`}
                      >
                        Gedung A
                      </button>
                      <button
                        type="button"
                        onClick={() => setMapBuildingTab('B')}
                        className={`min-h-[32px] px-2.5 py-1 rounded-md text-label-sm font-semibold cursor-pointer transition-colors ${
                          mapBuildingTab === 'B'
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-lowest text-on-surface-variant'
                        }`}
                      >
                        Gedung B
                      </button>
                    </div>
                  </div>

                  {/* Interactive Pins */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                    {stalls.map((stall) => (
                      <button
                        key={stall.id}
                        type="button"
                        onClick={() => onSelectStall(stall.id)}
                        className="min-h-[48px] p-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high active:scale-[0.99] transition-all flex items-center justify-between gap-2 text-left shadow-xs cursor-pointer"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-label-sm text-[11px] text-primary font-bold">
                            📍 {stall.mapPinCode} • {stall.name}
                          </span>
                          <span className="font-body-sm text-[11px] text-on-surface-variant">
                            {stall.building} (±{stall.distanceMeters} m) •{' '}
                            <strong className={stall.isOpen ? 'text-secondary' : 'text-error'}>
                              {stall.isOpen ? 'Buka' : 'Tutup'}
                            </strong>
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">
                          arrow_forward
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="px-2.5 py-1.5 bg-surface-container-high rounded-md text-center text-[11px] text-on-surface-variant font-medium">
                    {mapBuildingTab === 'A'
                      ? 'Pujasera Gedung A Lt. 1 (Jarak ±85m – 180m)'
                      : 'Kantin Gedung B Lt. Dasar (Jarak ±340m – 420m)'}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT RAIL (Desktop 8 cols, Mobile/Tablet Full Width): Search, Filter Controls, & Stall Grid */}
            <div className="lg:col-span-8 flex flex-col gap-4 min-w-0">
              {/* Search & Filter Panel */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                {/* Search Input */}
                <form
                  className="flex flex-wrap sm:flex-nowrap gap-2 w-full"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div className="relative flex-grow min-w-0 w-full">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                      search
                    </span>
                    <input
                      className="w-full h-11 pl-10 pr-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                      id="menuSearchInput"
                      placeholder="Cari 'Nasi goreng', 'Ayam', 'Es teh', atau nama kantin..."
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className={`min-h-[44px] flex-1 sm:flex-initial px-3.5 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        showAdvancedFilters || activeFilterCount > 0
                          ? 'bg-primary-fixed text-on-primary-fixed font-semibold'
                          : 'bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">tune</span>
                      <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
                    </button>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="min-h-[44px] px-3.5 rounded-lg bg-surface-container text-error font-label-md text-label-md flex items-center justify-center cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </form>

                {/* Primary Quick Filter Buttons (44px min-height for mobile thumb ergonomics) */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  {[
                    { id: 'all', label: 'Semua Budget' },
                    { id: '<=10000', label: '≤ Rp10.000' },
                    { id: '<=15000', label: 'Harga ≤ Rp15.000' },
                    { id: '10000-15000', label: 'Rp10rb–Rp15rb' },
                    { id: '15000-20000', label: 'Rp15rb–Rp20rb' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriceFilter(p.id)}
                      className={`min-h-[44px] px-3.5 rounded-lg font-label-sm text-label-sm whitespace-nowrap transition-colors cursor-pointer shrink-0 active:scale-[0.98] ${
                        priceFilter === p.id
                          ? 'bg-primary text-on-primary font-semibold shadow-xs'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setOnlyOpenFilter(!onlyOpenFilter)}
                    className={`min-h-[44px] px-3.5 rounded-lg font-label-sm text-label-sm whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 active:scale-[0.98] ${
                      onlyOpenFilter
                        ? 'bg-secondary text-on-secondary font-semibold shadow-xs'
                        : 'bg-surface-container-low text-secondary hover:bg-surface-container-high'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        onlyOpenFilter ? 'bg-on-secondary' : 'bg-secondary'
                      }`}
                    ></span>
                    <span>Buka sekarang</span>
                  </button>
                </div>

                {/* Collapsible Distance & Category Filter Drawer (Prevents vertical crowding on mobile) */}
                {(showAdvancedFilters || distanceFilter !== 'all' || categoryFilter !== 'all') && (
                  <div className="pt-2 border-t border-outline-variant/25 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Filter Jarak dari Lokasi Anda:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { id: 'all', label: 'Semua' },
                          { id: '<100m', label: '<100 m' },
                          { id: '<500m', label: '<500 m' },
                          { id: '<1km', label: '<1 km' },
                        ].map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setDistanceFilter(d.id)}
                            className={`min-h-[44px] px-2.5 rounded-lg font-label-sm text-label-sm transition-colors cursor-pointer ${
                              distanceFilter === d.id
                                ? 'bg-primary text-on-primary font-semibold'
                                : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        Filter Kategori Menu:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { id: 'all', label: 'Semua' },
                          { id: 'makanan', label: 'Makanan' },
                          { id: 'minuman', label: 'Minuman' },
                          { id: 'snack', label: 'Snack' },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() =>
                              setCategoryFilter(
                                cat.id as 'all' | 'makanan' | 'minuman' | 'snack'
                              )
                            }
                            className={`min-h-[44px] px-2.5 rounded-lg font-label-sm text-label-sm transition-colors cursor-pointer ${
                              categoryFilter === cat.id
                                ? 'bg-primary text-on-primary font-semibold'
                                : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* KATEGORI VIEW OR STALL DIRECTORY GRID */}
              {activeSubTab === 'kategori' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="fluid-headline-md text-on-surface">
                      Daftar Menu Berdasarkan Kategori &amp; Harga
                    </h2>
                    <span className="font-label-sm text-label-sm text-on-surface-variant shrink-0">
                      {allMatchingMenuItems.length} Menu Sesuai
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {allMatchingMenuItems.map(({ item, stall }) => (
                      <div
                        key={`${stall.id}-${item.id}`}
                        onClick={() => onSelectStall(stall.id)}
                        className="bg-surface-container-lowest rounded-xl p-3.5 shadow-sm border border-outline-variant/25 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-container-low active:scale-[0.99] transition-all min-w-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={item.imageCatalog}
                            alt={item.altCatalog}
                            referrerPolicy="no-referrer"
                            className={`w-16 h-16 rounded-lg object-cover shrink-0 ${
                              item.status === 'habis' ? 'grayscale opacity-75' : ''
                            }`}
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-label-sm text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                                {item.category}
                              </span>
                              <span className="font-label-sm text-label-sm text-secondary truncate">
                                📍 {stall.distanceMeters} m • {stall.name}
                              </span>
                            </div>
                            <h3
                              className={`font-label-lg text-label-lg text-on-surface truncate mt-0.5 ${
                                item.status === 'habis' ? 'line-through' : ''
                              }`}
                            >
                              {item.name}
                            </h3>
                            <span className="font-body-sm text-[11px] text-on-surface-variant">
                              Diperbarui: <strong>{item.lastUpdated}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="font-headline-md text-[16px] text-primary font-bold">
                            Rp{item.price.toLocaleString('id-ID')}
                          </span>
                          <span
                            className={`font-label-sm text-[11px] px-2 py-0.5 rounded mt-1 ${
                              item.status === 'ready'
                                ? 'bg-secondary-container text-on-secondary-container'
                                : 'bg-error-container text-on-error-container'
                            }`}
                          >
                            {item.status === 'ready' ? '🟢 Tersedia' : '🔴 Habis'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Section Header */}
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="fluid-headline-md text-on-surface">
                      {activeSubTab === 'favorit'
                        ? 'Kantin Favorit Tersimpan'
                        : 'Daftar Kantin IBI KKG'}
                    </h2>
                    <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0">
                      {filteredStalls.length} Kantin Ditemukan
                    </span>
                  </div>

                  {/* 3-State Responsive Stall Cards Grid: 1 col on mobile, 2 cols on md/xl */}
                  {filteredStalls.length === 0 ? (
                    <div className="bg-surface-container-lowest rounded-xl p-6 text-center flex flex-col items-center gap-2 shadow-sm border border-outline-variant/25">
                      <span className="material-symbols-outlined text-[36px] text-on-surface-variant">
                        search_off
                      </span>
                      <p className="fluid-headline-md text-on-surface">
                        {activeSubTab === 'favorit'
                          ? 'Belum Ada Kantin Favorit'
                          : 'Kantin atau Menu Tidak Ditemukan'}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                        {activeSubTab === 'favorit'
                          ? 'Tekan tombol simpan pada kartu kantin untuk menyimpan ke daftar favorit Anda.'
                          : 'Tidak ada kantin yang sesuai dengan kombinasi filter saat ini. Coba tekan tombol Reset Filter.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (activeSubTab === 'favorit') onChangeSubTab('beranda');
                          else resetAllFilters();
                        }}
                        className="mt-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md cursor-pointer"
                      >
                        {activeSubTab === 'favorit' ? 'Lihat Semua Kantin' : 'Reset Filter'}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredStalls.map((stall) => {
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
                            className="w-full bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/25 overflow-hidden flex flex-col justify-between min-w-0"
                          >
                            <div>
                              <div className="relative w-full h-44 bg-surface-container">
                                <img
                                  className="w-full h-full object-cover"
                                  alt={stall.bannerAlt}
                                  src={stall.bannerImage}
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 pr-14">
                                  <span
                                    className={`px-2.5 py-1 rounded-md bg-surface-container-lowest/95 backdrop-blur-sm ${
                                      stall.isOpen ? 'text-secondary' : 'text-error'
                                    } font-label-sm text-label-sm flex items-center gap-1 shadow-xs`}
                                  >
                                    <span>{stall.isOpen ? '🟢 Buka' : '🔴 Tutup'}</span>
                                    <span>• {stall.hours}</span>
                                  </span>
                                  <span className="px-2.5 py-1 rounded-md bg-surface-container-lowest/95 backdrop-blur-sm text-on-surface font-label-sm text-label-sm shadow-xs">
                                    📍 {stall.distanceMeters} m
                                  </span>
                                </div>
                                {/* 44x44px Favorite Hitbox */}
                                <button
                                  type="button"
                                  aria-label="Simpan Favorit"
                                  onClick={() => onToggleFavoriteStall(stall.id)}
                                  className="absolute top-2 right-2 w-11 h-11 rounded-xl bg-surface-container-lowest/95 backdrop-blur-sm flex items-center justify-center text-primary shadow-sm cursor-pointer active:scale-95 transition-transform"
                                >
                                  <span
                                    className="material-symbols-outlined text-[22px]"
                                    style={{
                                      fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0",
                                    }}
                                  >
                                    favorite
                                  </span>
                                </button>
                              </div>

                              <div className="p-4 flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <h3 className="fluid-headline-md text-on-surface min-w-0">
                                      {stall.name}
                                    </h3>
                                    <span className="font-label-sm text-label-sm px-2 py-1 rounded bg-surface-container-high text-on-surface font-semibold shrink-0">
                                      ⭐ {stall.rating} ({stall.reviewCount})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                                    <span className="material-symbols-outlined text-[15px] text-secondary shrink-0">
                                      location_on
                                    </span>
                                    <span className="truncate">
                                      {stall.mapPinCode} ({stall.code}) • {stall.locationDetail}
                                    </span>
                                  </div>
                                </div>

                                {/* FITUR SANGAT PENTING: "Harga terakhir diperbarui: 8 Oktober 2026" */}
                                <div className="px-3 py-2 rounded-lg bg-secondary-container/40 border border-secondary/20 flex flex-wrap items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">
                                      verified
                                    </span>
                                    <span className="font-label-sm text-label-sm text-on-surface">
                                      Harga terakhir diperbarui:
                                    </span>
                                  </div>
                                  <span className="font-label-sm text-label-sm text-secondary font-bold">
                                    {stall.lastUpdatedDate} ({stall.lastUpdatedTime})
                                  </span>
                                </div>

                                {/* Highlight Menu */}
                                <div className="flex flex-col gap-1.5">
                                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                                    Menu &amp; Harga ({displayMenus.length} Menu):
                                  </span>
                                  <div className="flex flex-col gap-1.5">
                                    {displayMenus.slice(0, 3).map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-low min-w-0"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="material-symbols-outlined text-[16px] text-primary shrink-0">
                                            {item.icon}
                                          </span>
                                          <span
                                            className={`font-body-sm text-body-sm text-on-surface truncate ${
                                              item.status === 'habis'
                                                ? 'line-through opacity-70'
                                                : ''
                                            }`}
                                          >
                                            {item.name}
                                          </span>
                                        </div>
                                        <span className="font-label-md text-label-md text-primary font-bold shrink-0">
                                          Rp{item.price.toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Action Button (min-h 44px) */}
                            <div className="px-4 pb-4">
                              <button
                                type="button"
                                onClick={() => onSelectStall(stall.id)}
                                className="w-full min-h-[44px] rounded-lg bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-1.5 active:scale-[0.99] hover:opacity-95 transition-all cursor-pointer"
                              >
                                <span>Lihat Menu &amp; Detail Kantin</span>
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
                </>
              )}

              {/* Banner Komitmen Transparansi Harga Resmi */}
              <div className="bg-surface-container-high rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">policy</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-label-lg text-label-lg text-on-surface">
                      Dikelola Langsung oleh Penjual Kantin IBI KKG
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Harga dan status makanan diupdate langsung oleh pemilik kantin tanpa mark-up aplikasi.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenReportModal}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-surface-container-lowest text-primary font-label-sm text-label-sm font-semibold shadow-xs hover:bg-surface shrink-0 cursor-pointer"
                >
                  Lapor Selisih Harga →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
