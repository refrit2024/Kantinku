import React, { useState } from 'react';
import { Stall } from '../data/kantinData';

interface DetailStanScreenProps {
  stall: Stall;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onAddReview: (
    stallId: string,
    studentName: string,
    majorAndYear: string,
    rating: number,
    comment: string
  ) => void;
  onBackToKatalog: () => void;
  onOpenReportModal: () => void;
}

export const DetailStanScreen: React.FC<DetailStanScreenProps> = ({
  stall,
  isFavorite,
  onToggleFavorite,
  onAddReview,
  onBackToKatalog,
  onOpenReportModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'makanan' | 'minuman' | 'snack'
  >('all');
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Review Form State
  const [revName, setRevName] = useState('');
  const [revMajor] = useState('Manajemen 2024');
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');

  const makananCount = stall.menuItems.filter((m) => m.category === 'makanan').length;
  const minumanCount = stall.menuItems.filter((m) => m.category === 'minuman').length;
  const snackCount = stall.menuItems.filter((m) => m.category === 'snack').length;

  const visibleMenu = stall.menuItems.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const toggleCalcCheckbox = (id: string) => {
    setCheckedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const totalCost = stall.menuItems
    .filter((item) => checkedItemIds.includes(item.id))
    .reduce((acc, item) => acc + item.price, 0);

  const maxBudget = 20000;
  const percentage = Math.min(Math.round((totalCost / maxBudget) * 100), 100);

  let statusText = 'Pilih menu untuk melihat simulasi';
  let statusColorClass = 'text-on-surface-variant font-semibold';
  let barColorClass = 'h-full bg-secondary transition-all duration-300';

  if (totalCost > 0 && totalCost <= maxBudget) {
    const sisa = maxBudget - totalCost;
    statusText = `Aman & Hemat! Sisa budget: Rp ${sisa.toLocaleString('id-ID')}`;
    statusColorClass = 'text-secondary font-semibold';
    barColorClass = 'h-full bg-secondary transition-all duration-300';
  } else if (totalCost > maxBudget) {
    const lebih = totalCost - maxBudget;
    statusText = `Melebihi target hemat Rp ${lebih.toLocaleString('id-ID')}`;
    statusColorClass = 'text-error font-semibold';
    barColorClass = 'h-full bg-error transition-all duration-300';
  }

  const calcItems = stall.menuItems.filter((m) => m.status === 'ready').slice(0, 5);

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
            <span>Kembali ke Direktori Kantin / {stall.building}</span>
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

      {/* Main Responsive Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex flex-col gap-6">
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
                    Dikelola Langsung oleh Penjual • {stall.mapPinCode}
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

          {/* Section 6 Header Bar: ⭐ 4.7 | 📍 85 m | 🟢 Buka | 07.00–20.00 */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-surface-container-lowest">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-label-lg text-label-lg text-on-surface flex items-center gap-1">
                ⭐ {stall.rating}{' '}
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  ({stall.reviewCount} ulasan)
                </span>
              </span>
              <span className="text-outline-variant">•</span>
              <span className="font-label-md text-label-md text-on-surface flex items-center gap-0.5">
                📍 {stall.distanceMeters} m
              </span>
              <span className="text-outline-variant">•</span>
              <span
                className={`font-label-md text-label-md font-semibold ${
                  stall.isOpen ? 'text-secondary' : 'text-error'
                }`}
              >
                {stall.isOpen ? '🟢 Buka' : '🔴 Tutup'}
              </span>
            </div>
            <div className="font-label-sm text-label-sm bg-surface-container-low text-on-surface px-3 py-1.5 rounded-lg">
              {stall.daysOpen} • {stall.hours} WIB
            </div>
          </div>
        </section>

        {/* 3-State Responsive Content Split:
            - Mobile (<1024px): Stacked cleanly
            - Desktop (>=1024px): Left 7 cols Menu & Reviews, Right 5 cols Info, Location & Budget Calculator
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT / MAIN COLUMN (7 cols on Desktop) */}
          <div className="lg:col-span-7 flex flex-col gap-5 min-w-0">
            {/* Banner "Harga terakhir diperbarui: 8 Oktober 2026" */}
            <div className="bg-secondary-container/45 border border-secondary/25 rounded-xl p-4 shadow-xs flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-secondary">
                  <span className="material-symbols-outlined text-[20px] shrink-0">update</span>
                  <span className="font-label-lg text-label-lg font-bold">
                    Harga terakhir diperbarui: {stall.lastUpdatedDate}
                  </span>
                </div>
                <span className="font-label-sm text-label-sm bg-surface-container-lowest text-secondary px-2.5 py-1 rounded font-semibold">
                  Pukul {stall.lastUpdatedTime}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                Informasi menu, ketersediaan, dan harga di halaman ini diinput dan diperbarui langsung oleh <strong>{stall.name}</strong> melalui Dashboard Penjual KantinKu IBI KKG.
              </p>
              <div>
                <button
                  type="button"
                  onClick={onOpenReportModal}
                  className="min-h-[40px] inline-flex items-center gap-1 font-label-sm text-label-sm text-primary font-semibold hover:underline cursor-pointer"
                >
                  <span>Temukan selisih harga di kasir? Laporkan ke Admin</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
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

              {/* Category Filter Buttons (min-h 44px) */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: 'all', label: `Semua (${stall.menuItems.length})` },
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
                    className={`min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md whitespace-nowrap shadow-xs cursor-pointer transition-colors shrink-0 ${
                      selectedCategory === cat.id
                        ? 'bg-primary text-on-primary font-semibold'
                        : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu List / Table (Zero horizontal overflow guaranteed) */}
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
                              className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${
                                item.status === 'ready'
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : 'bg-error-container text-on-error-container'
                              }`}
                            >
                              {item.status === 'ready' ? '🟢 Tersedia' : '🔴 Habis'}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
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
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                            <div className="flex flex-col">
                              <span
                                className={`font-headline-md text-[16px] sm:text-[17px] font-bold ${
                                  isAvailable ? 'text-primary' : 'text-on-surface-variant'
                                }`}
                              >
                                Rp {item.price.toLocaleString('id-ID')}
                              </span>
                              <span className="text-[10px] text-on-surface-variant">
                                Diperbarui: {item.lastUpdated}
                              </span>
                            </div>
                            {isAvailable ? (
                              <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-lg shrink-0">
                                🟢 Tersedia
                              </span>
                            ) : (
                              <span className="font-label-sm text-label-sm bg-error-container text-on-error-container px-2.5 py-1 rounded-lg shrink-0">
                                🔴 Habis
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
                  <span>⭐ {stall.rating}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {stall.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-lg bg-surface-container-low flex flex-col gap-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div>
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          {rev.studentName}
                        </span>
                        <span className="font-body-sm text-[11px] text-on-surface-variant ml-1.5">
                          • {rev.majorAndYear}
                        </span>
                      </div>
                      <span className="font-label-sm text-label-sm text-tertiary">
                        {'⭐'.repeat(rev.rating)}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                      {rev.comment}
                    </p>
                    <span className="text-[10px] text-on-surface-variant">{rev.date}</span>
                    {rev.reply && (
                      <div className="mt-1 p-2.5 rounded bg-surface-container-lowest border-l-2 border-primary text-body-sm text-on-surface-variant">
                        <strong className="text-on-surface">Balasan Penjual:</strong> {rev.reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Form Tambah Review Mahasiswa (44px inputs & button) */}
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
                    <option value={5}>⭐⭐⭐⭐⭐ (5/5 Sangat Puas)</option>
                    <option value={4}>⭐⭐⭐⭐ (4/5 Sesuai Harga)</option>
                    <option value={3}>⭐⭐⭐ (3/5 Cukup)</option>
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

          {/* RIGHT SIDEBAR COLUMN (5 cols on Desktop) */}
          <div className="lg:col-span-5 flex flex-col gap-5 min-w-0">
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
                    Metode Pembayaran di Kasir
                  </span>
                  <span className="font-body-md text-body-md text-on-surface">
                    {stall.paymentMethods.join(' • ')}
                  </span>
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
            </div>

            {/* Fitur Kalkulator Makan Siang Mahasiswa (Simulasi Budget) */}
            <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">calculate</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="font-headline-md text-[16px] text-on-surface font-bold leading-tight truncate">
                      Simulasi Budget Makan
                    </h3>
                    <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                      Hitung kombinasi menu sebelum datang
                    </span>
                  </div>
                </div>
                <span className="font-label-sm text-label-sm bg-surface-container text-on-surface px-2.5 py-1 rounded shrink-0">
                  Maks Rp 20rb
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {calcItems.map((item) => {
                  const checked = checkedItemIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className="min-h-[48px] flex items-center justify-between gap-2 p-3 rounded-lg bg-surface-container-low cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          className="calc-chk accent-primary w-5 h-5 rounded shrink-0"
                          checked={checked}
                          onChange={() => toggleCalcCheckbox(item.id)}
                          type="checkbox"
                        />
                        <span className="font-label-md text-label-md text-on-surface truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface font-semibold shrink-0">
                        Rp {item.price.toLocaleString('id-ID')}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div
                className="p-3.5 rounded-xl bg-surface-container flex flex-col gap-2 transition-colors"
                id="calc-summary-box"
              >
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Estimasi Total Makan:
                  </span>
                  <span
                    className="font-headline-md text-headline-md text-on-surface font-bold"
                    id="calc-total-display"
                  >
                    Rp {totalCost.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div
                    className={barColorClass}
                    id="calc-budget-bar"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] font-label-sm">
                  <span className={statusColorClass} id="calc-status-text">
                    {statusText}
                  </span>
                  <span className="text-on-surface-variant shrink-0">Batas Rp 20.000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
