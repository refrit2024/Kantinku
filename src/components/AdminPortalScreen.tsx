import React, { useState } from 'react';
import {
  AdminCredentials,
  OrderTransaction,
  RECEIPT_PROOF_IMAGE,
  SellerAccount,
  Stall,
  VerificationRequest,
} from '../data/kantinData';

interface AdminPortalScreenProps {
  stalls: Stall[];
  sellerAccounts: SellerAccount[];
  orders: OrderTransaction[];
  verifications: VerificationRequest[];
  adminCredentials: AdminCredentials;
  onUpdateAdminCredentials: (newEmail: string, newPassword: string) => void;
  onApproveVerification: (id: string, name: string) => void;
  onRejectVerification: (id: string, name: string, note: string) => void;
  onShowToast: (message: string, isError?: boolean) => void;
  onOpenNavDrawer: () => void;
}

export const AdminPortalScreen: React.FC<AdminPortalScreenProps> = ({
  stalls,
  sellerAccounts,
  orders,
  verifications,
  adminCredentials,
  onUpdateAdminCredentials,
  onApproveVerification,
  onRejectVerification,
  onShowToast,
  onOpenNavDrawer,
}) => {
  const [activeTab, setActiveTab] = useState<
    'verifikasi' | 'laporan' | 'kapasitas' | 'keamanan' | 'database'
  >('verifikasi');
  const [dbSubView, setDbSubView] = useState<
    'orders' | 'sellers' | 'stalls' | 'verifications' | 'raw_json'
  >('orders');
  const [spSending, setSpSending] = useState(false);
  const [spSent, setSpSent] = useState(false);

  // Admin Credential Change State
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState(adminCredentials.email);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [showAdminPasswords, setShowAdminPasswords] = useState(false);

  React.useEffect(() => {
    setNewAdminEmail(adminCredentials.email);
  }, [adminCredentials.email]);

  const handleSaveAdminCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPasswordInput !== adminCredentials.password) {
      onShowToast('Kata sandi Admin saat ini tidak sesuai.', true);
      return;
    }
    if (!newAdminEmail.trim()) {
      onShowToast('Email Admin baru tidak boleh kosong.', true);
      return;
    }
    const finalPassword = newAdminPassword.trim()
      ? newAdminPassword
      : adminCredentials.password;

    if (newAdminPassword.trim() && newAdminPassword.length < 6) {
      onShowToast('Kata sandi baru minimal 6 karakter.', true);
      return;
    }
    if (newAdminPassword.trim() && newAdminPassword !== confirmAdminPassword) {
      onShowToast('Konfirmasi kata sandi baru tidak cocok.', true);
      return;
    }

    onUpdateAdminCredentials(newAdminEmail.trim(), finalPassword);
    setCurrentPasswordInput('');
    setNewAdminPassword('');
    setConfirmAdminPassword('');
  };

  // Modals inside Admin screen
  const [detailModalTitle, setDetailModalTitle] = useState<string | null>(null);
  const [revisiTarget, setRevisiTarget] = useState<{ id: string; name: string } | null>(null);
  const [revisiNote, setRevisiNote] = useState(
    'Harap lengkapi sertifikat higienitas pangan dan denah outlet.'
  );
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  const pendingVerifications = verifications.filter(
    (v) => !v.approved && !v.rejectedReason
  );
  const pendingVerificationsCount = pendingVerifications.length;

  const handleSendSP = () => {
    if (spSending || spSent) return;
    setSpSending(true);
    setTimeout(() => {
      setSpSending(false);
      setSpSent(true);
      onShowToast(
        'Surat Peringatan Resmi #LP-049 berhasil disampaikan ke Stan Kantin Berkah!',
        false
      );
    }, 800);
  };

  const submitRevisi = (e: React.FormEvent) => {
    e.preventDefault();
    if (revisiTarget && revisiNote.trim()) {
      onRejectVerification(revisiTarget.id, revisiTarget.name, revisiNote.trim());
      setRevisiTarget(null);
    }
  };

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Sub-header Web Admin Portal Status Bar */}
      <div className="w-full bg-surface-container-low border-b border-outline-variant/25 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0">
              admin_panel_settings
            </span>
            <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
              Portal Admin Sarpras &amp; BAAK IBI KKG
            </span>
          </div>
          <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-md shrink-0">
            Otorisasi Aktif
          </span>
        </div>
      </div>

      {/* Main Responsive Container */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex flex-col gap-6">
        {/* Hero Status Pilot Project & Metrics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Pilot Status Banner (5 cols on lg) */}
          <div className="lg:col-span-5 rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-label-sm text-label-sm uppercase tracking-wider bg-secondary-container text-on-secondary-container px-2.5 py-1 rounded-md font-semibold">
                Pilot Project Aktif
              </span>
              <div className="flex items-center gap-1.5 text-secondary">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                <span className="font-label-sm text-label-sm font-semibold">Live Sync</span>
              </div>
            </div>
            <div>
              <h2 className="fluid-headline-xl text-on-surface">
                Program Pilot Tahap 1 - Kampus IBI KKG
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                Pengawasan operasional kantin terpadu, verifikasi penjual, dan moderasi transparansi harga di Gedung A dan Gedung B Sunter.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-outline-variant/25 text-on-surface-variant font-label-sm text-label-sm">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-primary">schedule</span>
                Pembaruan Terakhir: 8 Oktober 2026
              </span>
              <span className="font-semibold text-on-surface">Biro Sarpras IBI KKG</span>
            </div>
          </div>

          {/* Operational Metrics 2x2 on mobile, 4 cols on sm+ (7 cols on lg) */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
            {/* Metric 1: Total Stan */}
            <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm border border-outline-variant/25 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Total Stan
                </span>
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">storefront</span>
                </div>
              </div>
              <div className="mt-2">
                <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface leading-none">
                  14
                </span>
                <span className="font-label-sm text-label-sm text-on-surface ml-1">Stan</span>
              </div>
              <div className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                10 Gedung A • 4 Gedung B
              </div>
            </div>

            {/* Metric 2: Stan Buka */}
            <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm border border-outline-variant/25 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Buka Hari Ini
                </span>
                <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center text-on-secondary-container">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                </div>
              </div>
              <div className="mt-2">
                <span className="font-headline-lg-mobile text-headline-lg-mobile text-secondary leading-none">
                  12
                  <span className="font-body-md text-body-md text-on-surface-variant">/14</span>
                </span>
              </div>
              <div className="mt-1 font-label-sm text-label-sm text-secondary font-semibold">
                85.7% aktif melayani
              </div>
            </div>

            {/* Metric 3: Menunggu Verifikasi */}
            <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm border border-outline-variant/25 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Verifikasi Mitra
                </span>
                <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[18px]">rule_folder</span>
                </div>
              </div>
              <div className="mt-2">
                <span className="font-headline-lg-mobile text-headline-lg-mobile text-tertiary leading-none">
                  {pendingVerificationsCount}
                </span>
                <span className="font-label-sm text-label-sm text-tertiary ml-1">Stan</span>
              </div>
              <div className="mt-1 font-label-sm text-label-sm text-tertiary font-semibold">
                Perlu audit operasional
              </div>
            </div>

            {/* Metric 4: Laporan Pelanggaran */}
            <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm border border-outline-variant/25 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Laporan Harga
                </span>
                <div className="w-8 h-8 rounded-lg bg-error-container flex items-center justify-center text-on-error-container">
                  <span className="material-symbols-outlined text-[18px]">gavel</span>
                </div>
              </div>
              <div className="mt-2">
                <span className="font-headline-lg-mobile text-headline-lg-mobile text-error leading-none">
                  {spSent ? 0 : 1}
                </span>
                <span className="font-label-sm text-label-sm text-error ml-1">Kasus</span>
              </div>
              <div className="mt-1 font-label-sm text-label-sm text-error font-semibold">
                {spSent ? 'SP-1 Telah Diterbitkan' : 'Tenggat investigasi 16:00'}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Navigation Filter Tabs (min-h 44px) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            className={
              activeTab === 'verifikasi'
                ? 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-primary text-on-primary shadow-sm flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
                : 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container text-on-surface hover:bg-surface-container-high shadow-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
            }
            onClick={() => setActiveTab('verifikasi')}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
            <span>Verifikasi Stan</span>
            <span className="w-5 h-5 rounded-full bg-surface-container-lowest text-primary text-center leading-5 text-label-sm font-bold">
              {pendingVerificationsCount}
            </span>
          </button>

          <button
            className={
              activeTab === 'laporan'
                ? 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-primary text-on-primary shadow-sm flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
                : 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container text-on-surface hover:bg-surface-container-high shadow-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
            }
            onClick={() => setActiveTab('laporan')}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">price_change</span>
            <span>Laporan Harga</span>
            <span className="w-5 h-5 rounded-full bg-error-container text-on-error-container text-center leading-5 text-label-sm font-bold">
              {spSent ? 0 : 1}
            </span>
          </button>

          <button
            className={
              activeTab === 'kapasitas'
                ? 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-primary text-on-primary shadow-sm flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
                : 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container text-on-surface hover:bg-surface-container-high shadow-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
            }
            onClick={() => setActiveTab('kapasitas')}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">domain</span>
            <span>Kapasitas Gedung</span>
          </button>

          <button
            className={
              activeTab === 'keamanan'
                ? 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-primary text-on-primary shadow-sm flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
                : 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container text-on-surface hover:bg-surface-container-high shadow-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
            }
            onClick={() => setActiveTab('keamanan')}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
            <span>Pengaturan Akun Admin</span>
          </button>

          <button
            className={
              activeTab === 'database'
                ? 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-primary text-on-primary shadow-sm flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
                : 'min-h-[44px] px-4 py-2 rounded-lg font-label-md text-label-md bg-surface-container text-on-surface hover:bg-surface-container-high shadow-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shrink-0'
            }
            onClick={() => setActiveTab('database')}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">database</span>
            <span>Database Firebase (Live)</span>
            <span className="w-5 h-5 rounded-full bg-secondary-container text-on-secondary-container text-center leading-5 text-label-sm font-bold">
              {orders.length}
            </span>
          </button>
        </div>

        {/* CONTENT SECTION 1: Antrean Verifikasi Stan */}
        {activeTab === 'verifikasi' && (
          <div className="flex flex-col gap-4" id="section-verifikasi">
            <div className="flex items-center justify-between gap-2">
              <h3 className="fluid-headline-md text-on-surface">Antrean Verifikasi Mitra</h3>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {pendingVerificationsCount} Permohonan Menunggu
              </span>
            </div>

            {pendingVerifications.length === 0 ? (
              <div className="rounded-xl bg-surface-container-lowest p-6 sm:p-8 shadow-sm border border-outline-variant/25 flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">task_alt</span>
                </div>
                <h4 className="fluid-headline-md text-on-surface">
                  Seluruh Antrean Verifikasi Selesai Diproses
                </h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
                  Tidak ada permohonan verifikasi stan baru yang tertunda saat ini. Stan yang disetujui telah aktif, dan stan yang ditolak telah menerima alasan revisi pada akun mereka.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingVerifications.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col justify-between gap-3.5 transition-all min-w-0"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <img
                          className="w-16 h-16 rounded-lg object-cover shrink-0"
                          alt={item.alt}
                          src={item.image}
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`font-label-sm text-label-sm font-semibold px-2 py-0.5 rounded-md w-max mb-1 ${
                              item.badgeType === 'new'
                                ? 'bg-primary-fixed text-on-primary-fixed'
                                : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                            }`}
                          >
                            {item.badgeText}
                          </span>
                          <h4 className="fluid-headline-md text-on-surface break-words">
                            {item.name}
                          </h4>
                          <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[14px] shrink-0">
                              pin_drop
                            </span>
                            <span className="truncate">{item.location}</span>
                          </p>
                        </div>
                      </div>

                      {/* Stalls Detail Block */}
                      <div className="rounded-lg bg-surface-container-low p-3 flex flex-col gap-2 text-body-sm font-body-sm text-on-surface">
                        {item.details.map((detail, idx) => (
                          <div
                            key={idx}
                            className="flex flex-wrap justify-between items-center gap-2"
                          >
                            <span className="text-on-surface-variant font-label-sm text-label-sm">
                              {detail.label}
                            </span>
                            {detail.isWhatsapp ? (
                              <a
                                className="font-label-md text-label-md text-secondary font-semibold flex items-center gap-1 hover:underline"
                                href={detail.whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {detail.value}{' '}
                                <span className="material-symbols-outlined text-[14px]">
                                  open_in_new
                                </span>
                              </a>
                            ) : detail.isBadge ? (
                              <span className="font-label-sm text-label-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-md font-semibold">
                                {detail.value}
                              </span>
                            ) : detail.isHighlight ? (
                              <span className="font-label-md text-label-md text-secondary font-semibold">
                                {detail.value}
                              </span>
                            ) : (
                              <span className="font-label-md text-label-md text-on-surface text-right">
                                {detail.value}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons (min-h 44px) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <button
                        className="min-h-[44px] px-3 rounded-lg bg-error-container/70 hover:bg-error-container text-on-error-container font-label-lg text-label-lg text-center font-semibold transition-colors cursor-pointer"
                        onClick={() => {
                          setRevisiTarget({ id: item.id, name: item.name });
                        }}
                        type="button"
                      >
                        Tolak / Minta Revisi
                      </button>
                      <button
                        className="min-h-[44px] px-3 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg text-center font-semibold shadow-sm transition-colors cursor-pointer"
                        onClick={() => onApproveVerification(item.id, item.name)}
                        type="button"
                      >
                        {item.primaryActionText}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTENT SECTION 2: Moderasi Laporan Ketidaksesuaian Harga */}
        {(activeTab === 'laporan' || activeTab === 'verifikasi') && (
          <div
            className={`flex flex-col gap-3 ${activeTab === 'kapasitas' ? 'hidden' : ''}`}
            id="section-laporan"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-error">
                  notification_important
                </span>
                <h3 className="fluid-headline-md text-on-surface">Laporan Mahasiswa Aktif</h3>
              </div>
              <span className="font-label-sm text-label-sm bg-error-container text-on-error-container px-2.5 py-1 rounded-md font-semibold shrink-0">
                {spSent ? 'Selesai Ditindak' : '1 Menunggu Tindakan'}
              </span>
            </div>

            {/* Ticket Card LP-049 */}
            <div className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-label-sm text-label-sm text-error font-semibold uppercase tracking-wider">
                    Tiket #LP-049
                  </span>
                  <h4 className="fluid-headline-md text-on-surface mt-0.5">
                    Stan Kantin Berkah (Stan A-08)
                  </h4>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Pelapor: Mahasiswa Akuntansi 2023 (NIM Terverifikasi)
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-error shrink-0">
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                </div>
              </div>

              {/* Discrepancy Highlight Panel */}
              <div className="rounded-lg bg-surface-container p-3.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Ketidaksesuaian Harga: Es Jeruk Peras
                  </span>
                  <span className="font-label-sm text-label-sm text-error font-bold">
                    Selisih +Rp 1.000
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-body-sm font-body-sm pt-1">
                  <div className="p-2.5 rounded bg-surface-container-lowest">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      Tertera di Katalog:
                    </span>
                    <span className="font-label-lg text-label-lg text-secondary font-bold">
                      Rp 5.000
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-surface-container-lowest">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      Ditagih ke Mahasiswa:
                    </span>
                    <span className="font-label-lg text-label-lg text-error font-bold">
                      Rp 6.000
                    </span>
                  </div>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant italic pt-1">
                  &ldquo;Kasir stan menyatakan harga jeruk peras naik per kemarin, tetapi di portal IBI KKG belum diperbarui.&rdquo;
                </p>
              </div>

              {/* Bukti Struk Photo Attachment */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-lg bg-surface-container-low">
                <img
                  className="w-16 h-16 rounded-md object-cover shrink-0"
                  alt="Bukti struk transaksi"
                  src={RECEIPT_PROOF_IMAGE}
                  referrerPolicy="no-referrer"
                />
                <div className="flex flex-col justify-between gap-1 min-w-0">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Bukti Struk &amp; Nota Pembayaran
                  </span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Foto diunggah pukul 12:18 WIB • Resolusi Jelas
                  </span>
                  <button
                    type="button"
                    onClick={() => setReceiptPreviewOpen(true)}
                    className="min-h-[36px] font-label-sm text-label-sm text-primary font-semibold hover:underline text-left cursor-pointer w-fit"
                  >
                    Lihat Struk Resolusi Penuh →
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-1 text-tertiary font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                  Tenggat Klarifikasi: Hari Ini 16:00 WIB
                </span>
                <button
                  disabled={spSending || spSent}
                  onClick={handleSendSP}
                  className={
                    spSent
                      ? 'w-full sm:w-auto min-h-[44px] py-2.5 px-5 rounded-lg bg-surface-container text-on-surface-variant font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-xs'
                      : 'w-full sm:w-auto min-h-[44px] py-2.5 px-5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer'
                  }
                  type="button"
                >
                  {spSending ? (
                    <>
                      <span className="material-symbols-outlined text-[20px] animate-spin">
                        sync
                      </span>
                      <span>Mengirim Surat Peringatan...</span>
                    </>
                  ) : spSent ? (
                    <>
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      <span>SP-1 Terkirim ke WhatsApp Mitra</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">
                        send_and_archive
                      </span>
                      <span>Kirim Notifikasi Peringatan Resmi (SP-1)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT SECTION 3: Kapasitas Gedung */}
        {activeTab === 'kapasitas' && (
          <div className="flex flex-col gap-4" id="section-kapasitas">
            <div className="flex items-center justify-between gap-2">
              <h3 className="fluid-headline-md text-on-surface">Kapasitas Stan per Gedung</h3>
              <span className="font-label-sm text-label-sm text-secondary font-semibold">
                Tingkat Okupansi: 87.5%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Building A Progress */}
              <div className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-2">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <h4 className="fluid-headline-md text-on-surface">Gedung A (Utama)</h4>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Kantin Selasar Lt. 1 &amp; Lt. 2
                    </span>
                  </div>
                  <span className="font-headline-md text-headline-md text-primary font-bold">
                    10 / 12 Stan
                  </span>
                </div>
                <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden mt-1">
                  <div className="bg-primary h-full rounded-full" style={{ width: '83.3%' }}></div>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                  Tersedia 2 slot kosong untuk kemitraan wirausaha mahasiswa IBI KKG.
                </span>
              </div>

              {/* Building B Progress */}
              <div className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-2">
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <h4 className="fluid-headline-md text-on-surface">Gedung B (Pascasarjana)</h4>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Kantin Basemen &amp; Hall Lt. Dasar
                    </span>
                  </div>
                  <span className="font-headline-md text-headline-md text-secondary font-bold">
                    4 / 4 Stan
                  </span>
                </div>
                <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden mt-1">
                  <div className="bg-secondary h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
                <span className="font-label-sm text-label-sm text-secondary font-semibold mt-1">
                  Kapasitas Penuh (100% Okupansi Terisi).
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CONTENT SECTION 4: Pengaturan Email & Kata Sandi Admin */}
        {activeTab === 'keamanan' && (
          <div className="flex flex-col gap-4 max-w-3xl" id="section-keamanan">
            <div className="rounded-xl bg-surface-container-lowest p-5 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3 border-b border-outline-variant/25 pb-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[22px]">shield_person</span>
                    <h3 className="fluid-headline-md text-on-surface">
                      Ubah Email &amp; Kata Sandi Otorisasi Admin
                    </h3>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Kredensial baru yang Anda simpan akan langsung tersinkronisasi ke <strong>Cloud Database (Firebase)</strong> sehingga berlaku di semua laptop dan perangkat.
                  </p>
                </div>
              </div>

              {/* Status Kredensial Saat Ini */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Email Admin Aktif Saat Ini
                  </span>
                  <span className="font-label-md text-label-md text-on-surface font-bold">
                    {adminCredentials.email}
                  </span>
                </div>
                <span className="font-label-sm text-[11px] px-2.5 py-1 rounded-md bg-secondary-container text-on-secondary-container font-semibold">
                  Tersinkronisasi Cloud
                </span>
              </div>

              <form onSubmit={handleSaveAdminCredentials} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                    1. Verifikasi Kata Sandi Admin Saat Ini <span className="text-error">*</span>
                  </label>
                  <input
                    type={showAdminPasswords ? 'text' : 'password'}
                    required
                    placeholder="Masukkan kata sandi Admin yang sedang aktif"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/25">
                  <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                    2. Email Login Admin Baru <span className="text-error">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Contoh: admin.kantin@ibikkg.ac.id"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="font-body-sm text-[11px] text-on-surface-variant">
                    Anda juga dapat mengetikkan email Admin ini langsung di form Login Penjual untuk masuk ke Portal Admin secara tersembunyi.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                      3. Kata Sandi Admin Baru
                    </label>
                    <input
                      type={showAdminPasswords ? 'text' : 'password'}
                      placeholder="Kosongkan jika hanya ganti email"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-label-sm text-on-surface font-semibold">
                      4. Ulangi Kata Sandi Baru
                    </label>
                    <input
                      type={showAdminPasswords ? 'text' : 'password'}
                      placeholder="Ketik ulang kata sandi baru"
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                      className="h-11 px-3.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 text-body-sm text-on-surface-variant cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showAdminPasswords}
                      onChange={(e) => setShowAdminPasswords(e.target.checked)}
                      className="rounded accent-primary w-4 h-4"
                    />
                    <span>Tampilkan karakter kata sandi</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-fit min-h-[48px] px-6 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-[20px]">save</span>
                  <span>Simpan Email &amp; Kata Sandi Admin Baru</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CONTENT SECTION 5: Database Firebase (Live Inspector & Console Guide) */}
        {activeTab === 'database' && (
          <div className="flex flex-col gap-5" id="section-database">
            {/* Card 1: Informasi Koneksi Cloud Firestore & Cara Buka di Google Console */}
            <div className="rounded-xl bg-surface-container-lowest p-5 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/25 pb-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[22px]">cloud_done</span>
                    <h3 className="fluid-headline-md text-on-surface">
                      Inspektur Cloud Database (Firebase Firestore)
                    </h3>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Pantau seluruh rekaman data transaksi pesanan, akun penjual, menu stan, dan kredensial yang tersimpan secara <em>real-time</em> di Cloud Firestore.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold shrink-0">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  Firestore Connected
                </span>
              </div>

              {/* Detail Teknis Database untuk Presentasi / Cek Console */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-1">
                  <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Lokasi Koleksi &amp; Dokumen Firestore
                  </span>
                  <code className="font-mono text-xs text-primary font-bold break-all">
                    /kantinku_sync/pilot_ibikkg_v1
                  </code>
                  <span className="font-body-sm text-[11px] text-on-surface-variant">
                    Path dokumen utama sinkronisasi real-time
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 flex flex-col gap-1">
                  <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">
                    ID Database Firestore
                  </span>
                  <code className="font-mono text-xs text-on-surface font-bold break-all">
                    ai-studio-kantinkuibikkg-73e35728-5d35-4b53-806d-684467fc5e92
                  </code>
                  <span className="font-body-sm text-[11px] text-on-surface-variant">
                    Project ID: serene-feather-vlkcn
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 flex flex-col justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-wider">
                      Ekspor / Salin Cadangan Data
                    </span>
                    <span className="font-body-sm text-xs text-on-surface">
                      Salin seluruh isi database dalam format JSON untuk laporan/presentasi.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fullSnapshot = {
                        collection: 'kantinku_sync',
                        document: 'pilot_ibikkg_v1',
                        exportedAt: new Date().toISOString(),
                        summary: {
                          totalStalls: stalls.length,
                          totalSellerAccounts: sellerAccounts.length,
                          totalOrders: orders.length,
                          totalVerifications: verifications.length,
                        },
                        data: {
                          orders,
                          sellerAccounts,
                          verifications,
                          stalls,
                        },
                      };
                      navigator.clipboard?.writeText(JSON.stringify(fullSnapshot, null, 2));
                      onShowToast('Seluruh JSON Database Firebase berhasil disalin ke Clipboard!');
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    <span>Salin JSON Database</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-tab Pilih Tabel Koleksi Data */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setDbSubView('orders')}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  dbSubView === 'orders'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>Tabel Transaksi Pesanan ({orders.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDbSubView('sellers')}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  dbSubView === 'sellers'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">badge</span>
                <span>Tabel Akun Penjual ({sellerAccounts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDbSubView('stalls')}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  dbSubView === 'stalls'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">storefront</span>
                <span>Tabel Stan &amp; Menu ({stalls.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDbSubView('verifications')}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  dbSubView === 'verifications'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">fact_check</span>
                <span>Tabel Verifikasi ({verifications.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setDbSubView('raw_json')}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg font-label-sm text-label-sm font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  dbSubView === 'raw_json'
                    ? 'bg-secondary text-on-secondary shadow-xs'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">data_object</span>
                <span>Raw JSON Document</span>
              </button>
            </div>

            {/* ISI TABEL 1: ordersJson (Transaksi Pesanan) */}
            {dbSubView === 'orders' && (
              <div className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="fluid-headline-md text-on-surface">
                    Field: <code className="text-primary font-mono text-sm">ordersJson</code> ({orders.length} Transaksi)
                  </h4>
                </div>
                {orders.length === 0 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant py-6 text-center">
                    Belum ada data transaksi pesanan mahasiswa di dalam database. Coba buat pesanan dari halaman Detail Stan!
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-outline-variant/30 text-[11px] font-label-sm text-on-surface-variant uppercase">
                          <th className="py-2.5 px-3">ID Order</th>
                          <th className="py-2.5 px-3">Stan Kantin</th>
                          <th className="py-2.5 px-3">Mahasiswa (NIM)</th>
                          <th className="py-2.5 px-3">Item Pesanan</th>
                          <th className="py-2.5 px-3">Metode &amp; Total</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20 text-xs">
                        {orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-surface-container-low/60">
                            <td className="py-2.5 px-3 font-mono font-bold text-primary whitespace-nowrap">
                              {ord.id}
                              <div className="text-[10px] font-normal text-on-surface-variant">
                                {ord.createdAt}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-on-surface">
                              {ord.stallName}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-on-surface">{ord.studentName}</div>
                              <div className="text-[11px] text-on-surface-variant">
                                NIM: {ord.studentNim} • Ambil: {ord.pickupTime}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {(ord.items ?? []).map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-bold text-on-surface">
                                Rp {(ord.totalAmount ?? 0).toLocaleString('id-ID')}
                              </div>
                              <div className="text-[11px] text-on-surface-variant uppercase">
                                {ord.paymentMethod} {ord.paymentReference ? `• ${ord.paymentReference}` : ''}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-secondary-container text-on-secondary-container font-semibold text-[11px]">
                                {ord.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ISI TABEL 2: sellerAccountsJson (Akun Penjual) */}
            {dbSubView === 'sellers' && (
              <div className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                <h4 className="fluid-headline-md text-on-surface">
                  Field: <code className="text-primary font-mono text-sm">sellerAccountsJson</code> ({sellerAccounts.length} Akun)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-[11px] font-label-sm text-on-surface-variant uppercase">
                        <th className="py-2.5 px-3">ID Akun</th>
                        <th className="py-2.5 px-3">Nama Pemilik</th>
                        <th className="py-2.5 px-3">Email Login</th>
                        <th className="py-2.5 px-3">Nama Stan</th>
                        <th className="py-2.5 px-3">Gedung</th>
                        <th className="py-2.5 px-3">Status Verifikasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 text-xs">
                      {sellerAccounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-surface-container-low/60">
                          <td className="py-2.5 px-3 font-mono text-on-surface-variant">{acc.id}</td>
                          <td className="py-2.5 px-3 font-semibold text-on-surface">{acc.ownerName}</td>
                          <td className="py-2.5 px-3 font-mono text-primary">{acc.email}</td>
                          <td className="py-2.5 px-3 font-semibold">{acc.stallName}</td>
                          <td className="py-2.5 px-3">{acc.building}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                acc.status === 'verified'
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : acc.status === 'pending'
                                  ? 'bg-tertiary-fixed text-tertiary'
                                  : 'bg-error-container text-on-error-container'
                              }`}
                            >
                              {acc.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ISI TABEL 3: stallsJson (Data Stan, Menu & Rekening) */}
            {dbSubView === 'stalls' && (
              <div className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                <h4 className="fluid-headline-md text-on-surface">
                  Field: <code className="text-primary font-mono text-sm">stallsJson</code> ({stalls.length} Stan Aktif)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-[11px] font-label-sm text-on-surface-variant uppercase">
                        <th className="py-2.5 px-3">ID Stan</th>
                        <th className="py-2.5 px-3">Nama Stan &amp; Kode</th>
                        <th className="py-2.5 px-3">Lokasi</th>
                        <th className="py-2.5 px-3">Status Buka</th>
                        <th className="py-2.5 px-3">Jumlah Menu</th>
                        <th className="py-2.5 px-3">Ulasan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 text-xs">
                      {stalls.map((st) => (
                        <tr key={st.id} className="hover:bg-surface-container-low/60">
                          <td className="py-2.5 px-3 font-mono text-on-surface-variant">{st.id}</td>
                          <td className="py-2.5 px-3 font-semibold text-on-surface">
                            {st.name} <span className="text-on-surface-variant">({st.code})</span>
                          </td>
                          <td className="py-2.5 px-3">{st.building} • {st.locationDetail}</td>
                          <td className="py-2.5 px-3">
                            {st.isOpen ? '🟢 Buka' : '🔴 Tutup'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">{st.menuItems?.length ?? 0} Menu</td>
                          <td className="py-2.5 px-3">{st.reviews?.length ?? 0} Ulasan (⭐ {st.rating})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ISI TABEL 4: verificationsJson */}
            {dbSubView === 'verifications' && (
              <div className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                <h4 className="fluid-headline-md text-on-surface">
                  Field: <code className="text-primary font-mono text-sm">verificationsJson</code> ({verifications.length} Data)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-[11px] font-label-sm text-on-surface-variant uppercase">
                        <th className="py-2.5 px-3">ID Verifikasi</th>
                        <th className="py-2.5 px-3">Nama Stan</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3">Lokasi</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20 text-xs">
                      {verifications.map((vf) => (
                        <tr key={vf.id} className="hover:bg-surface-container-low/60">
                          <td className="py-2.5 px-3 font-mono text-on-surface-variant">{vf.id}</td>
                          <td className="py-2.5 px-3 font-semibold text-on-surface">{vf.name}</td>
                          <td className="py-2.5 px-3">{vf.badgeText}</td>
                          <td className="py-2.5 px-3">{vf.location}</td>
                          <td className="py-2.5 px-3">
                            {vf.approved
                              ? '✅ Disetujui'
                              : vf.rejectedReason
                              ? `❌ Ditolak (${vf.rejectedReason})`
                              : '⏳ Menunggu'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ISI TABEL 5: Raw JSON Document */}
            {dbSubView === 'raw_json' && (
              <div className="rounded-xl bg-surface-container-lowest p-4 sm:p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="fluid-headline-md text-on-surface">
                    Raw Firestore Document (<code className="text-primary font-mono text-sm">/kantinku_sync/pilot_ibikkg_v1</code>)
                  </h4>
                </div>
                <pre className="p-4 rounded-xl bg-inverse-surface text-inverse-on-surface font-mono text-xs overflow-x-auto max-h-[480px] leading-relaxed">
                  {JSON.stringify(
                    {
                      adminCredentials,
                      ordersCount: orders.length,
                      orders,
                      sellerAccounts,
                      verifications,
                      stallsSummary: stalls.map((s) => ({
                        id: s.id,
                        name: s.name,
                        isOpen: s.isOpen,
                        menuCount: s.menuItems?.length ?? 0,
                        paymentDetails: s.paymentDetails,
                      })),
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Modal Container: Detail Perubahan Menu */}
      {detailModalTitle && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 w-full max-w-md shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="fluid-headline-md text-on-surface">{detailModalTitle}</h4>
              <button
                className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
                onClick={() => setDetailModalTitle(null)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-2.5">
              <div className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-1.5">
                <span className="font-label-md text-label-md text-on-surface">
                  6 Menu Baru Terdaftar:
                </span>
                <ul className="list-disc pl-4 text-on-surface-variant text-body-sm space-y-1">
                  <li>Kopi Susu Aren IBI KKG (Rp 12.000)</li>
                  <li>Americano Dingin (Rp 10.000)</li>
                  <li>Matcha Latte Kampus (Rp 14.000)</li>
                  <li>Roti Bakar Cokelat Keju (Rp 12.000)</li>
                  <li>Toast Sosis Telur (Rp 15.000)</li>
                  <li>Air Mineral Botol 600ml (Rp 4.000)</li>
                </ul>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
                QRIS NMID: ID2025118928310 (Validitas Resmi Bank DKI)
              </div>
            </div>
            <button
              className="w-full min-h-[44px] rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold mt-1 cursor-pointer"
              onClick={() => setDetailModalTitle(null)}
              type="button"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      )}

      {/* Modal: Catatan Revisi / Penolakan Stan */}
      {revisiTarget && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={submitRevisi}
            className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 w-full max-w-md shadow-xl flex flex-col gap-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-[20px]">report</span>
                <h4 className="fluid-headline-md text-on-surface">
                  Alasan Penolakan / Revisi
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setRevisiTarget(null)}
                className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Tuliskan keterangan mengapa pengajuan{' '}
              <strong className="text-on-surface">&ldquo;{revisiTarget.name}&rdquo;</strong> ditolak agar penjual mengetahui bagian mana yang salah dan perlu diperbaiki:
            </p>

            {/* Pilihan Cepat Alasan Penolakan */}
            <div className="flex flex-col gap-1.5">
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Pilih Alasan Cepat (atau ketik manual di bawah):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Lokasi nomor stan tidak terdaftar di Gedung A/B IBI KKG.',
                  'Daftar harga awal melebihi batas wajar kantin mahasiswa.',
                  'Nomor kontak WhatsApp / identitas pemilik tidak dapat dihubungi.',
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRevisiNote(preset)}
                    className="text-left text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/30 cursor-pointer transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">
                Keterangan Lengkap untuk Penjual:
              </label>
              <textarea
                rows={3}
                required
                placeholder="Contoh: Nomor stan belum sesuai dengan data Biro Sarpras..."
                value={revisiNote}
                onChange={(e) => setRevisiNote(e.target.value)}
                className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-error"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setRevisiTarget(null)}
                className="w-1/2 min-h-[44px] rounded-lg bg-surface-container text-on-surface font-label-md text-label-md font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-1/2 min-h-[44px] rounded-lg bg-error text-on-primary font-label-md text-label-md font-semibold cursor-pointer"
              >
                Tolak &amp; Kirim Alasan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Bukti Struk Resolusi Penuh */}
      {receiptPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 w-full max-w-md shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="fluid-headline-md text-on-surface">Bukti Struk #LP-049</h4>
              <button
                type="button"
                onClick={() => setReceiptPreviewOpen(false)}
                className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <img
              src={RECEIPT_PROOF_IMAGE}
              alt="Bukti Struk Transaksi"
              className="w-full h-64 object-cover rounded-lg"
              referrerPolicy="no-referrer"
            />
            <div className="p-3 rounded-lg bg-surface-container-low text-body-sm text-on-surface-variant">
              Diunggah oleh Mahasiswa Akuntansi 2023 pada pukul 12:18 WIB. Terlihat item Es Jeruk Peras ditagih Rp 6.000 (katalog Rp 5.000).
            </div>
            <button
              type="button"
              onClick={() => setReceiptPreviewOpen(false)}
              className="w-full min-h-[44px] rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold cursor-pointer"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
