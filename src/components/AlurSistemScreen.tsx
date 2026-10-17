import React, { useState } from 'react';

interface AlurSistemScreenProps {
  onBackToKatalog: () => void;
  onOpenJastipRunner: () => void;
  onOpenModelBisnis: () => void;
}

export const AlurSistemScreen: React.FC<AlurSistemScreenProps> = ({
  onBackToKatalog,
  onOpenJastipRunner,
  onOpenModelBisnis,
}) => {
  const [activeView, setActiveView] = useState<'simulator' | 'uml' | 'model_bisnis'>('simulator');
  const [roleTab, setRoleTab] = useState<'mahasiswa' | 'runner' | 'stan' | 'admin'>('mahasiswa');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [activeUmlTab, setActiveUmlTab] = useState<
    'usecase' | 'activity' | 'sequence' | 'state' | 'class'
  >('activity');

  const stepsMahasiswa = [
    {
      step: 1,
      title: 'Pilih Menu & Tenan Kampus',
      icon: 'storefront',
      badge: 'Hyper-Local Closed-Loop',
      desc: 'Mahasiswa membuka katalog Unifood, memilih gedung kuliah (Gedung A, Gedung B, Sentra UMKM, atau Booth Wirausaha Mahasiswa), serta memilih menu favorit.',
      trigger: 'Mahasiswa berada di ruang kelas / perpustakaan.',
      output: 'Menu masuk ke keranjang belanja digital.',
    },
    {
      step: 2,
      title: 'Tentukan Layanan: Jastip Antar-Lantai / Takeaway / Dine-In',
      icon: 'directions_run',
      badge: 'Solusi Jeda 15-20 Mnt',
      desc: 'Jika sedang sibuk nugas di lantai atas, pilih "Jastip Mahasiswa". Tentukan Lantai (Lt. 1-7), Nomor Ruang Kelas (cth: R. 504), dan Slot Waktu Antar (Break Pagi, Siang, atau Sore). Bebas antre lift!',
      trigger: 'Pilih metode fulfillment & opsi Split-Bill kelompok.',
      output: 'Ongkir mikro Rp 2.500 ditambahkan transparan.',
    },
    {
      step: 3,
      title: 'Multi-Payment & Kupon Organisasi',
      icon: 'payments',
      badge: 'Sistem Rekber Aman',
      desc: 'Pilih pembayaran instan QRIS (ShopeePay/Gopay/DANA/Bank) atau Bayar Tunai. Masukkan kupon event organisasi kampus (HIMA2026 / BEM) jika ada.',
      trigger: 'Konfirmasi pembayaran & generate 4-digit PIN keamanan.',
      output: 'Tiket pesanan terbit, status "Sedang Dimasak".',
    },
    {
      step: 4,
      title: 'Kurir Mahasiswa Mengambil & Antar ke Lantai',
      icon: 'elevator',
      badge: 'P2P Micro-Delivery',
      desc: 'Mahasiswa runner yang berada di dekat kantin mengambil pesanan dari tenan, lalu naik tangga/lift menuju ruang kelas tujuan Anda.',
      trigger: 'Runner klik "Tiba di Kelas".',
      output: 'Notifikasi & suara tiba di HP pemesan.',
    },
    {
      step: 5,
      title: 'Serah Terima Makanan & Verifikasi PIN 4 Digit',
      icon: 'verified',
      badge: 'Selesai & Aman',
      desc: 'Pemesan memberikan 4-digit PIN ke kurir mahasiswa untuk memvalidasi serah terima. Upah Rp 2.500 otomatis masuk ke dompet kurir mahasiswa.',
      trigger: 'Verifikasi PIN sukses.',
      output: 'Transaksi selesai, tanpa buang waktu turun tangga.',
    },
  ];

  const stepsRunner = [
    {
      step: 1,
      title: 'Daftar & Verifikasi Status Mahasiswa (KTM)',
      icon: 'badge',
      badge: 'Keamanan Komunitas',
      desc: 'Mahasiswa aktif mendaftar sebagai Kurir Jastip Unifood dengan verifikasi NIM dan KTM. Akun aman dan terpercaya di dalam lingkungan kampus.',
      trigger: 'Toggle Status: "Siap Antar" saat ada jam kosong kuliah.',
      output: 'Akses ke radar pesanan jastip aktif.',
    },
    {
      step: 2,
      title: 'Pilih Pesanan Jastip yang Searah ke Kelas',
      icon: 'near_me',
      badge: 'Efisiensi Rute',
      desc: 'Lihat daftar pesanan jastip di tab "Order Tersedia". Pilih pesanan yang stannya dekat dengan Anda dan tujuannya searah dengan ruang kelas Anda berikutnya.',
      trigger: 'Klik tombol "Ambil Jastip Ini".',
      output: 'Pesanan terkunci ke profil Anda.',
    },
    {
      step: 3,
      title: 'Jemput Makanan di Etalase Stan Kantin',
      icon: 'shopping_bag',
      badge: 'Pickup Cepat',
      desc: 'Datang ke stan kantin, tunjukkan kode tiket ke pedagang kantin, dan periksa kelengkapan bungkusan makanan.',
      trigger: 'Klik "Makanan Sudah Diambil".',
      output: 'Status pemesan terupdate: "Kurir Naik ke Lantai".',
    },
    {
      step: 4,
      title: 'Antar ke Depan Ruang Kelas / Titik Temu',
      icon: 'door_front',
      badge: 'Sopan & Tanpa Ganggu Kuliah',
      desc: 'Naik ke lantai tujuan (Lt. 3-7). Berdiri di depan ruang kelas atau titik temu yang ditentukan tanpa mengganggu jalannya perkuliahan.',
      trigger: 'Klik "Tiba di Depan Ruangan".',
      output: 'Pemesan keluar untuk serah terima.',
    },
    {
      step: 5,
      title: 'Input PIN Pemesan & Klaim Uang Saku',
      icon: 'account_balance_wallet',
      badge: 'Pemberdayaan Ekonomi',
      desc: 'Minta 4 digit PIN dari pemesan, masukkan ke aplikasi. Saldo Rp 2.500 langsung bertambah ke dompet Anda dan siap dicairkan ke GoPay/DANA/BCA!',
      trigger: 'Input PIN valid.',
      output: 'Uang saku bertambah langsung.',
    },
  ];

  const stepsStan = [
    {
      step: 1,
      title: 'Terima Pre-Order Pagi & Jadwal Istirahat',
      icon: 'receipt_long',
      badge: 'Zero Food Waste',
      desc: 'Pedagang kantin melihat ringkasan pesanan pre-order yang masuk sejak pagi hari untuk slot jam istirahat siang (12:00-13:00). Kepastian porsi masak terjamin.',
      trigger: 'Buka dashboard dapur KDS.',
      output: 'Daftar antrean masak terjadwal rapi.',
    },
    {
      step: 2,
      title: 'Alarm Audio Dapur & Mulai Memasak',
      icon: 'notifications_active',
      badge: 'KDS Realtime',
      desc: 'Saat jam persiapan tiba, sistem membunyikan alarm audio. Koki menekan tombol "Mulai Masak" sehingga pembeli/kurir tahu prosesnya.',
      trigger: 'Klik "Mulai Masak".',
      output: 'Status cloud berubah ke "cooking".',
    },
    {
      step: 3,
      title: 'Tandai Siap Ambil di Etalase',
      icon: 'check_circle',
      badge: 'Bebas Antre Fisik',
      desc: 'Makanan dibungkus higienis dan diletakkan di etalase pickup kantin dengan nomor nota terlihat jelas. Koki menekan "Siap Diambil".',
      trigger: 'Klik "Siap Diambil".',
      output: 'Chime otomatis berbunyi di ponsel pembeli/kurir.',
    },
    {
      step: 4,
      title: 'Serahkan ke Pembeli / Kurir Mahasiswa',
      icon: 'handshake',
      badge: 'Verifikasi Valid',
      desc: 'Cek nomor nota pemesan atau kurir mahasiswa yang mengambil. Transaksi terekam ke kasir digital POS tenan secara otomatis.',
      trigger: 'Serah terima makanan.',
      output: 'Omzet masuk ke buku kas digital.',
    },
    {
      step: 5,
      title: 'Rekapitulasi Harian & Cetak Struk Kasir',
      icon: 'print',
      badge: 'SaaS Tenan Pro',
      desc: 'Di akhir hari, tenan dapat melihat total omzet kotor, rincian pembayaran QRIS vs Tunai, menu terlaris, dan mencetak rekapitulasi ke printer termal.',
      trigger: 'Buka tab "Rekap & Laporan".',
      output: 'Laporan keuangan terotomatisasi.',
    },
  ];

  const stepsAdmin = [
    {
      step: 1,
      title: 'Verifikasi Mitra Tenan & Stan Mahasiswa',
      icon: 'verified_user',
      badge: 'Standarisasi Kampus',
      desc: 'Admin kampus memeriksa pendaftaran stan kantin baru atau booth wirausaha mahasiswa, memverifikasi menu dan legalitas operasional.',
      trigger: 'Pengajuan stan baru masuk.',
      output: 'Stan aktif di katalog publik Unifood.',
    },
    {
      step: 2,
      title: 'Pengawasan Transparansi & Integritas Harga',
      icon: 'gavel',
      badge: 'Anti Mark-Up',
      desc: 'Memantau laporan pengaduan selisih harga dari mahasiswa lengkap dengan bukti foto struk fisik untuk mencegah pungutan liar.',
      trigger: 'Laporan selisih harga masuk.',
      output: 'Investigasi & klarifikasi ke pihak tenan.',
    },
    {
      step: 3,
      title: 'Audit Sanitasi & Evaluasi Kepuasan',
      icon: 'fact_check',
      badge: 'Mutu Layanan',
      desc: 'Melihat rating kepuasan kantin dan ulasan mahasiswa secara berkala untuk menjaga kebersihan dan standar gizi makanan kampus.',
      trigger: 'Audit mingguan.',
      output: 'Rekomendasi perbaikan operasional.',
    },
    {
      step: 4,
      title: 'Broadcast Pengumuman & Jadwal Libur',
      icon: 'campaign',
      badge: 'Komunikasi Terpadu',
      desc: 'Menyiarkan pengumuman jadwal operasional kantin terpadu selama masa ujian akhir atau libur semester ke seluruh sivitas akademika.',
      trigger: 'Siaran pengumuman.',
      output: 'Notifikasi pop-up di layar mahasiswa & tenan.',
    },
  ];

  const currentSteps =
    roleTab === 'mahasiswa'
      ? stepsMahasiswa
      : roleTab === 'runner'
      ? stepsRunner
      : roleTab === 'stan'
      ? stepsStan
      : stepsAdmin;

  const activeStepData = currentSteps[currentStep - 1] || currentSteps[0];

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-slate-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-linear-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider">
                Unifood Architecture &amp; System Flow
              </span>
              <span className="text-xs text-emerald-200 font-medium">
                Hyper-Local Campus Closed-Loop Platform
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Alur Sistem &amp; Model Bisnis Unifood
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
              Panduan interaktif cara kerja platform kuliner hyper-local kampus: Dari pemesanan antar-lantai (Jastip Mahasiswa), KDS dapur tenan, hingga rekapitulasi data terpusat.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={onOpenModelBisnis}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>Model Bisnis &amp; Added Value</span>
            </button>

            <button
              type="button"
              onClick={onBackToKatalog}
              className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-sm"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Kembali ke Katalog</span>
            </button>
          </div>
        </div>

        {/* View Switcher: Simulator vs UML vs Model Bisnis */}
        <div className="flex border-b border-slate-200 bg-white p-1 rounded-2xl shadow-xs gap-1">
          <button
            type="button"
            onClick={() => setActiveView('simulator')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeView === 'simulator'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">play_circle</span>
            <span>Simulasi Alur Interaktif</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('uml')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeView === 'uml'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
            <span>Diagram UML &amp; Arsitektur</span>
          </button>
        </div>

        {/* VIEW 1: INTERACTIVE STEP-BY-STEP SIMULATOR */}
        {activeView === 'simulator' && (
          <div className="space-y-6">
            {/* Role Switcher Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'mahasiswa', label: '1. Mahasiswa (Pemesan)', icon: 'school' },
                { id: 'runner', label: '2. Kurir Jastip (Runner)', icon: 'directions_run' },
                { id: 'stan', label: '3. Tenan Kantin (KDS & POS)', icon: 'storefront' },
                { id: 'admin', label: '4. Admin Kampus (Sarpras)', icon: 'admin_panel_settings' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRoleTab(tab.id as any);
                    setCurrentStep(1);
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                    roleTab === tab.id
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Stepper Progress Bar */}
            <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-slate-100 pb-3">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Tahapan Proses ({roleTab.toUpperCase()}):</span>
                </span>
                <span>Langkah {currentStep} dari {currentSteps.length}</span>
              </div>

              {/* Horizontal Stepper */}
              <div className="grid grid-cols-5 gap-2">
                {currentSteps.map((s) => (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setCurrentStep(s.step)}
                    className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      currentStep === s.step
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30'
                        : currentStep > s.step
                        ? 'border-emerald-300 bg-white text-slate-700'
                        : 'border-slate-200 bg-slate-50/70 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-800 text-[11px] font-black flex items-center justify-center">
                        {s.step}
                      </span>
                      <span className="material-symbols-outlined text-[18px]">
                        {s.icon}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold line-clamp-1 mt-2">
                      {s.title}
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Step Detailed Card */}
              <div className="p-4 sm:p-6 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                      {activeStepData.badge}
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Langkah {activeStepData.step}: {activeStepData.title}
                    </h3>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-700 shadow-xs">
                    <span className="material-symbols-outlined text-[24px]">
                      {activeStepData.icon}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {activeStepData.desc}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Kondisi Pemicu (Trigger):</span>
                    <strong className="text-slate-800 text-xs block mt-0.5">{activeStepData.trigger}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Keluaran Sistem (Output):</span>
                    <strong className="text-emerald-800 text-xs block mt-0.5">{activeStepData.output}</strong>
                  </div>
                </div>

                {/* Step Navigation Controls */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    disabled={currentStep === 1}
                    onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                    className="px-4 py-2 rounded-xl bg-white border border-slate-300 disabled:opacity-40 text-slate-700 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
                  >
                    &larr; Langkah Sebelumnya
                  </button>

                  <div className="flex items-center gap-2">
                    {roleTab === 'runner' && (
                      <button
                        type="button"
                        onClick={onOpenJastipRunner}
                        className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer shadow-xs"
                      >
                        Buka Panel Kurir Langsung
                      </button>
                    )}

                    {currentStep < currentSteps.length ? (
                      <button
                        type="button"
                        onClick={() => setCurrentStep((prev) => Math.min(currentSteps.length, prev + 1))}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1"
                      >
                        <span>Langkah Berikutnya</span>
                        <span>&rarr;</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onBackToKatalog}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                      >
                        Coba Pesan di Katalog &rarr;
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: FULL UML DIAGRAMS */}
        {activeView === 'uml' && (
          <div className="space-y-4">
            {/* UML Selector Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'activity', label: 'UML Activity Diagram (Swimlane)', icon: 'commit' },
                { id: 'sequence', label: 'UML Sequence Diagram', icon: 'swap_horiz' },
                { id: 'usecase', label: 'UML Use Case Diagram', icon: 'group' },
                { id: 'state', label: 'UML State Machine', icon: 'sync' },
                { id: 'class', label: 'UML Class Diagram', icon: 'view_comfy' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveUmlTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    activeUmlTab === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Render Selected Diagram */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
              {/* UML Activity Diagram */}
              {activeUmlTab === 'activity' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        UML Activity Diagram: End-to-End Jastip &amp; Antar-Lantai Kampus
                      </h3>
                      <p className="text-xs text-slate-500">
                        Menjelaskan aliran kontrol dan swimlane antara Mahasiswa, Kurir Jastip, Tenan Kantin, dan Cloud DB.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                      Swimlanes
                    </span>
                  </div>

                  <pre className="font-mono text-[11px] sm:text-xs bg-slate-900 text-emerald-400 p-4 rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
{`+--------------------+   +-----------------------+   +----------------------+   +----------------------+
|     MAHASISWA      |   |    SISTEM / CLOUD     |   |     KURIR JASTIP     |   |     TENAN KANTIN     |
+--------------------+   +-----------------------+   +----------------------+   +----------------------+
          |                          |                          |                          |
       [MULAI]                       |                          |                          |
          |                          |                          |                          |
   Pilih Menu &                      |                          |                          |
   Lantai Tujuan                     |                          |                          |
          |                          |                          |                          |
   Pilih Opsi Jastip                 |                          |                          |
   (+Rp 2.500)                       |                          |                          |
          |                          |                          |                          |
          +---- Checkout Order ----->|                          |                          |
                                     v                          |                          |
                              Simpan Order di                   |                          |
                              Firestore (Pending)               |                          |
                                     |                          |                          |
                                     +---- Broadcast Event ---->|                          |
                                     |    (Order Tersedia)      v                          |
                                     |                   Lihat Permintaan Jastip           |
                                     |                   dan Klik "Ambil Order"            |
                                     |                          |                          |
                                     |<--- Assign Runner -------+                          |
                                     |                                                     |
                                     +------------------ Broadcast ke Dapur -------------->|
                                                                                           v
                                                                                    Alarm Masuk &
                                                                                    Mulai Memasak
                                                                                           |
                                                                |                          v
                                                                v                   Makanan Matang
                                                         Datang ke Stan <----+      (Siap Ambil)
                                                         dan Ambil Makanan   |             |
                                                                |            +-------------+
                                                                v
                                                         Naik ke Lantai
                                                         (Tangga / Lift)
                                                                |
                                                                v
                                                         Tiba di Depan
          |<--- Notifikasi Runner Tiba ----------------- Ruang Kelas
          v                                                     |
   Keluar Kelas &                                               |
   Beri PIN 4 Digit ------------------------------------------->|
                                                                v
                                                         Input PIN di HP &
                                                         Serahkan Makanan
                                                                |
                                     |<--- Konfirmasi PIN ------+
                                     v
                              Validasi Sukses &
                              Transfer Rp 2.500
                              ke Dompet Kurir
                                     |
          |<--- Notifikasi Selesai --+                          v
          v                                                  [SELESAI]
       [SELESAI]`}
                  </pre>
                </div>
              )}

              {/* UML Sequence Diagram */}
              {activeUmlTab === 'sequence' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        UML Sequence Diagram: Siklus Pesanan &amp; Verifikasi PIN
                      </h3>
                      <p className="text-xs text-slate-500">
                        Urutan pertukaran pesan antar aktor dan sistem peramban.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase">
                      Timeline
                    </span>
                  </div>

                  <pre className="font-mono text-[11px] sm:text-xs bg-slate-900 text-blue-400 p-4 rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
{`Mahasiswa         Web UI (React)      Cloud Firestore       Tenan Kantin       Kurir Jastip
    |                    |                    |                    |                 |
    |-- 1. Order Jastip->|                    |                    |                 |
    |                    |-- 2. addDoc(order)->|                   |                 |
    |                    |   (PIN: 4 Digit)   |-- 3. onSnapshot -->|                 |
    |                    |                    |                    |-- 4. Masak Menu |
    |                    |                    |-- 5. onSnapshot -------------------->|
    |                    |                    |    (Ada Jastip)    |                 |-- 6. Klaim Order
    |                    |                    |<-- 7. assignRunner ------------------|
    |                    |<-- 8. onSnapshot --|                    |                 |
    |<-- 9. Status Update|                    |                    |                 |
    |                    |                    |                    |-- 10. Siap Ambil|
    |                    |                    |<-- 11. updateStatus|                 |
    |                    |                    |-- 12. onSnapshot ------------------->|
    |                    |                    |                    |                 |-- 13. Ambil Makanan
    |                    |                    |                    |                 |-- 14. Naik ke Lantai
    |                    |<-- 15. Tiba di R. Kelas ----------------------------------|
    |<-- 16. Chime Alert |                    |                    |                 |
    |-- 17. Beri PIN ---------------------------------------------------------------->|
    |                    |                    |<-- 18. verifyPin(pinInput) ----------|
    |                    |                    |    (Valid: +Rp 2.500 Saldo Kurir)    |
    |<-- 19. Selesai ----|                    |                    |                 |`}
                  </pre>
                </div>
              )}

              {/* UML Use Case Diagram */}
              {activeUmlTab === 'usecase' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        UML Use Case Diagram: Interaksi 4 Aktor Sistem Unifood
                      </h3>
                      <p className="text-xs text-slate-500">
                        Aktor: Mahasiswa, Kurir Jastip, Tenan Kantin, dan Admin Kampus.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 uppercase">
                      Use Cases
                    </span>
                  </div>

                  <pre className="font-mono text-[11px] sm:text-xs bg-slate-900 text-amber-300 p-4 rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
{`       +-------------------------------------------------------------------+
       |                    PLATFORM KULINER UNIFOOD                       |
       |                                                                   |
(M)--> |  (UC-1: Cari Menu & Filter Lokasi Gedung Kampus)                  |
 |     |  (UC-2: Request Jastip Antar-Lantai / Takeaway / Dine-In)          |
 |     |  (UC-3: Pre-Order Harian & Slot Jam Istirahat)                    |
 |     |  (UC-4: Group Order & Split-Bill Otomatis)                        |
 |     |  (UC-5: Bayar QRIS Dinamis / Tunai Kasir)                         |
 |     |  (UC-6: Tukar Voucher HIMA / Organisasi Kampus)                   |
 |     |  (UC-7: Lapor Transparansi Harga / Whistleblowing)                |
       |                                                                   |
(K)--> |  (UC-8: Daftar Kurir Mahasiswa & Verifikasi KTM)                  |
 |     |  (UC-9: Klaim Permintaan Titip-Antar Searah)                      |
 |     |  (UC-10: Update Status Penjemputan Makanan)                       |
 |     |  (UC-11: Validasi PIN 4 Digit Serah Terima di Kelas)              |
 |     |  (UC-12: Tarik Uang Saku ke GoPay / DANA / Bank)                  |
       |                                                                   |
(T)--> |  (UC-13: Kelola Stok & Buka/Tutup Stan Realtime)                  |
 |     |  (UC-14: Pantau Kitchen Display System (KDS) & Alarm)             |
 |     |  (UC-15: Cetak Struk Rekapitulasi Kasir POS Termal)               |
       |                                                                   |
(A)--> |  (UC-16: Verifikasi Berkas Tenan & Stan Wirausaha Mahasiswa)      |
 |     |  (UC-17: Investigasi Laporan Mark-up Harga)                       |
 |     |  (UC-18: Broadcast Jadwal Operasional Kampus)                     |
       +-------------------------------------------------------------------+
Aktor:
  (M) = Mahasiswa Pemesan
  (K) = Kurir Mahasiswa (Runner)
  (T) = Tenan Kantin & Koki
  (A) = Admin Kampus (Sarpras)`}
                  </pre>
                </div>
              )}

              {/* UML State Machine */}
              {activeUmlTab === 'state' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        UML State Machine Diagram: Siklus Hidup Pesanan &amp; Pengiriman
                      </h3>
                      <p className="text-xs text-slate-500">
                        Status transisi dari inisiasi hingga serah terima selesai.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                      State Transition
                    </span>
                  </div>

                  <pre className="font-mono text-[11px] sm:text-xs bg-slate-900 text-teal-300 p-4 rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
{`   (*) Inisiasi Pesanan
      |
      v
  [ PENDING / MENUNGGU BAYAR ] ------( Dibatalkan )-----> [ REJECTED / CANCEL ] (*)
      |
      | Trigger: Pembayaran Lunas (QRIS) / Konfirmasi Tunai
      v
  [ COOKING / SEDANG DISIAPKAN ]
      |
      | Trigger: Makanan Selesai Dimasak oleh Tenan
      v
  [ READY_PICKUP / SIAP AMBIL ]
      |
      +---- JIKA AMBIL SENDIRI / DINE-IN ----> Diambil Pemesan ----> [ COMPLETED ] (*)
      |
      +---- JIKA JASTIP MAHASISWA:
            |
            v
        [ WAITING_RUNNER ] (Mencari mahasiswa searah)
            |
            | Trigger: Kurir Mahasiswa ambil order
            v
        [ RUNNER_ASSIGNED ] (Kurir menuju kantin)
            |
            | Trigger: Makanan diambil kurir dari stan
            v
        [ DELIVERING_TO_FLOOR ] (Kurir naik lift/tangga ke lantai)
            |
            | Trigger: Kurir tiba di depan kelas
            v
        [ ARRIVED_AT_ROOM ] (Menunggu pemesan keluar)
            |
            | Trigger: Input 4-Digit PIN pemesan valid
            v
        [ COMPLETED / SELESAI ] (*) (Fee Rp 2.500 cair)`}
                  </pre>
                </div>
              )}

              {/* UML Class Diagram */}
              {activeUmlTab === 'class' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        UML Class Diagram: Relasi Entitas Data Unifood
                      </h3>
                      <p className="text-xs text-slate-500">
                        Struktur entitas Stall, MenuItem, OrderTransaction, StudentRunnerProfile, dsb.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                      Entity Relations
                    </span>
                  </div>

                  <pre className="font-mono text-[11px] sm:text-xs bg-slate-900 text-slate-200 p-4 rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
{`+------------------------------------+          +------------------------------------+
|               Stall                | 1      * |              MenuItem              |
+------------------------------------+<-------->+------------------------------------+
| - id: string                       |          | - id: string                       |
| - name: string                     |          | - stallId: string                  |
| - campusName: string               |          | - name: string                     |
| - building: string                 |          | - price: number                    |
| - isStudentEntrepreneur: boolean   |          | - category: string                 |
| - isOpen: boolean                  |          | - status: 'ready' | 'habis'        |
| - rating: number                   |          | - isStudentEntrepreneur: boolean   |
+------------------------------------+          +------------------------------------+
                 ^
                 | 1
                 |
                 | 1
+------------------------------------+          +------------------------------------+
|        StudentRunnerProfile        |          |          OrderTransaction          |
+------------------------------------+          +------------------------------------+
| - studentId: string                | 1      * | - id: string                       |
| - studentNim: string               +--------->| - stallId: string                  |
| - studentName: string              |          | - studentNim: string               |
| - totalEarnings: number            |          | - fulfillmentType: FulfillmentType |
| - completedDeliveries: number      |          | - deliveryFloor: string            |
| - isVerifiedKtm: boolean           |          | - deliveryRoom: string             |
| - isOnline: boolean                |          | - runnerId: string                 |
+------------------------------------+          | - runnerPinCode: string            |
                                                | - jastipFee: number (Rp 2.500)     |
                                                | - convenienceFee: number (Rp 1.000)|
                                                | - isGroupOrder: boolean            |
                                                | - splitBillPerPerson: number       |
                                                | - status: OrderStatusType          |
                                                +------------------------------------+`}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
