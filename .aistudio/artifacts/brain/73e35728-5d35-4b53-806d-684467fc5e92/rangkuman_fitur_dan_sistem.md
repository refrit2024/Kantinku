# Rangkuman Fitur, Sistem & Model Bisnis Platform Unifood
*(Campus Hyper-Local Food & Student Jastip Ecosystem)*

---

## I. PENDAHULUAN & FORMULASI ULANG STRATEGI (UNIFOOD)

Platform **Unifood** (sebelumnya beroperasi sebagai KantinKu) telah diformulasi ulang secara strategis berdasarkan evaluasi model bisnis dan adaptasi terhadap lingkungan kampus. 

### Pilar Utama Transformasi:
1. **Hyper-Local Closed-Loop Ecosystem**:
   Tidak bersaing langsung dengan agregator raksasa jalan raya (GoFood, GrabFood, ShopeeFood) yang mengandalkan armada motor di luar kampus. Unifood fokus 100% pada area mikro internal kampus: kantin dasar, selasar, lorong, dan antar-lantai gedung kuliah untuk mengatasi jeda waktu istirahat 15–20 menit yang sangat sempit dan antrean lift yang padat.
2. **Pemberdayaan Ekonomi Mahasiswa (Student Empowerment)**:
   - **Kurir Jastip Mahasiswa (*Student Runner*)**: Mahasiswa yang searah menuju lantai atas dapat mengambil pesanan teman dan mendapatkan ongkos mikro jastip (Rp 2.500/titipan) sebagai uang saku tambahan.
   - **Unipreneur Hub (Wirausaha Mahasiswa)**: Etalase khusus bebas biaya sewa untuk produk kuliner buatan mahasiswa aktif (kopi susu botolan, risoles mayo, cookies, bento hemat).
3. **Model Bisnis Transparan & Terjangkau (B2B2C Mikro)**:
   Tanpa potongan komisi 20%+ yang mencekik pedagang. Pendapatan berasal dari *platform convenience fee* Rp 1.000/transaksi, langganan POS dapur mitra stan yang terjangkau (Rp 29rb–49rb/bulan), biaya titip jastip mahasiswa, serta kemitraan sponsor acara BEM/HIMA.

---

## II. RANGKUMAN FITUR LENGKAP BERDASARKAN PERAN PENGGUNA

Sistem Unifood dirancang dengan arsitektur **Multi-Tenant Terpusat** yang melayani 4 profil pengguna utama:

### 1. Fitur Mahasiswa & Pembeli (Student & Customer Portal)
* **Katalog Kuliner & Multi-Kampus**:
  * Pemilihan kampus aktif (contoh: Kampus Sunter IBI KKG, Kampus Binus Kemanggisan, Kampus UBM).
  * Filter multi-gedung fisik: **Gedung A**, **Gedung B**, **Sentra UMKM Kuliner**, **Kantin Mitra**, dan **Booth Wirausaha Mahasiswa (Unipreneur Hub)**.
  * Filter kategori menu: Makanan Berat, Minuman Segar, Camilan Ringan, Menu Halal, serta Promo Mahasiswa.
  * Filter *Budget-Friendly*: Filter cepat makanan hemat $\le$ Rp 10.000 dan $\le$ Rp 15.000.
  * Pencarian instan (*live search*) berbasis kata kunci menu, bahan, rasa, atau nama stan.
  * Tampilan fleksibel: Mode Kotak Visual (*Grid View*) dan Mode Rinci (*List View*).
  * Status operasional stan langsung (*Real-Time Open/Closed/Rest Indicator*).
* **3 Opsi Pemenuhan Pesanan (Fulfillment Modes)**:
  * **Ambil Sendiri (*Self-Pickup*)**: Pesanan disiapkan stan untuk diambil langsung tanpa perlu antre berdesakan di depan etalase.
  * **Makan di Tempat (*Dine-In*)**: Input nomor meja kantin untuk penyajian langsung ke meja makan mahasiswa.
  * **Jastip Antar-Lantai (*Student Runner Delivery*)**: Pesanan diantar langsung oleh mahasiswa lain yang searah menuju gedung, lantai, dan nomor ruang kelas (contoh: Gedung A, Lantai 4, Ruang 402) dengan biaya jastip flat Rp 2.500.
* **Pre-Order Slot Waktu Istirahat (Break Time Pre-Order)**:
  * Pemesanan terjadwal untuk jam istirahat kuliah (contoh: Slot Istirahat Siang 11:30–12:00 atau Slot Sore 15:00–15:30) sehingga makanan sudah siap tepat saat kelas usai.
* **Fitur Group Order & Split-Bill Otomatis**:
  * Fitur pesan bareng teman satu kelas/kelompok belajar dengan kalkulator bagi tagihan rata otomatis per orang (*split bill*), mengurangi kerumitan transfer manual.
* **Multi-Channel Payment Gateway**:
  * **QRIS Dinamis**: Tampilan kode QR instan dengan nominal pas hingga rupiah terakhir.
  * **E-Wallet Simulasi**: GoPay, ShopeePay, OVO, dan DANA.
  * **Virtual Account Bank**: Bank BCA, Mandiri, BNI, dan BRI.
  * **Bayar Tunai di Kasir / COD Ruang Kelas**: Bayar langsung tunai di kasir stan atau saat serah terima oleh teman jastip.
  * **Voucher Sponsor BEM / HIMA**: Potongan diskon khusus menggunakan kode voucher kemitraan organisasi kemahasiswaan (misal: `HIMA-IBIKKG-HEMAT`).
* **Pelacakan Antrean Dapur & Kurir Real-Time**:
  * Penerbitan Nomor Tiket Pesanan digital unik.
  * Status transparan bertahap: `Menunggu Konfirmasi` $\rightarrow$ `Sedang Dimasak` $\rightarrow$ `Menunggu Runner / Siap Diambil` $\rightarrow$ `Kurir Sedang Naik Lantai` $\rightarrow$ `Selesai`.
  * **Notifikasi Suara (*Audio Chime*)**: Peringatan nada dering browser otomatis ketika pesanan siap diambil atau sudah tiba di depan kelas.
* **Struk Kasir Digital & Bukti Cetak Termal**:
  * Struk digital resmi lengkap dengan rincian hidangan, nama runner/nomor meja, barcode/QR validasi, dan rincian biaya.
  * Tombol cetak langsung berstandar POS termal 58mm/80mm atau simpan PDF struk.
* **Transparansi Harga & Pengaduan Pelanggaran (Whistleblowing)**:
  * Pelaporan jika stan menaikkan harga melebihi HET kampus atau berbeda dari harga menu tercetak, disertai unggah foto struk fisik untuk ditindaklanjuti admin kampus.

---

### 2. Fitur Kurir Jastip Mahasiswa (Student Runner Portal)
* **Pendaftaran & Verifikasi Runner**:
  * Mahasiswa mendaftar dengan NIM resmi, nomor WhatsApp, fakultas/jurusan, dan jadwal rute kuliah harian.
  * Verifikasi status mahasiswa aktif agar keamanan di area ruang kelas tetap terjamin.
* **Bursa Tugas Jastip Antar-Lantai (Runner Job Feed)**:
  * Daftar pesanan yang membutuhkan pengantaran ke lantai/ruang kelas tertentu dengan informasi asal stan kantin, tujuan pengantaran, dan estimasi waktu sebelum kelas dimulai.
  * Tombol satu-klik **"Ambil Tugas Jastip"** (+Rp 2.500 langsung masuk dompet saldo runner).
* **Dompet Saldo Jastip & Pencairan Dana (*Runner Wallet*)**:
  * Ringkasan penghasilan harian/mingguan dari tugas titipan yang diselesaikan.
  * Fitur permintaan penarikan dana (*payout request*) ke rekening bank atau e-wallet mahasiswa tanpa potongan memberatkan.

---

### 3. Fitur Mitra Stan & Dapur UMKM (Merchant Kitchen POS)
* **Pendaftaran Mandiri & Pengaturan Profil Stan**:
  * Registrasi akun pedagang kantin mandiri dengan informasi stan, legalitas/NIM pemilik, nomor kontak, kategori makanan, dan lokasi titik stan.
  * Sakelar operasional stan satu-klik: Buka, Tutup Sementara, atau Istirahat.
* **Manajemen Katalog Menu & Transparansi Tarif**:
  * Tambah, ubah, dan hapus menu dengan foto, nama, deskripsi bahan, harga pas, serta status ketersediaan (*Ready* / *Habis*).
  * Opsi penandaan khusus **"Produk Wirausaha Mahasiswa"** dan **"Khusus Pre-Order"**.
* **Kitchen Order Management (Live POS)**:
  * Panel dapur *real-time* yang menampilkan pesanan masuk secara berurutan.
  * Pembaruan status pesanan: Terima Pesanan $\rightarrow$ Sedang Dimasak $\rightarrow$ Panggil Pembeli / Serahkan ke Runner Mahasiswa.
  * Peringatan audio otomatis saat ada pesanan baru masuk agar koki tidak ketinggalan tiket.
* **Rekap Transaksi & Laporan Penjualan**:
  * Dashboard total omzet harian, jumlah pesanan, dan menu terlaris (*best-seller*).
  * Ekspor laporan pembukuan sederhana untuk keperluan evaluasi dagang dan pelaporan kampus.

---

### 4. Fitur Pengelola Kampus & Admin Sarpras (Super Admin Portal)
* **Verifikasi & Kurasi Stan / Tenan Baru**:
  * Tinjau permohonan buka stan UMKM baru dan lapak wirausaha mahasiswa.
  * Persetujuan atau penolakan dengan catatan resmi dari pihak kampus.
* **Pengawasan Transparansi Tarif & Penyelidikan Laporan**:
  * Panel pemantauan aduan harga dari mahasiswa.
  * Akses foto bukti struk yang diunggah dan tombol pemberian sanksi atau surat peringatan ke stan terkait.
* **Papan Pengumuman & Kebijakan Kampus (Broadcast)**:
  * Pembuatan pengumuman resmi terkait jadwal operasional kantin, hari libur kampus, inspeksi kebersihan, dan program diskon BEM/HIMA.
* **Manajemen Keamanan & Kredensial**:
  * Manajemen kata sandi admin dan reset otorisasi akun mitra.

---

### 5. Halaman Edukasi: Alur Sistem Interaktif & Spesifikasi Diagram UML
* **Simulator Interaktif 3 Peran**:
  * Simulasi visual langkah demi langkah alur pemesanan Mahasiswa, proses operasional Mitra Stan UMKM, serta fungsi pengawasan Admin Kampus.
* **Spesifikasi 5 Diagram UML Lengkap**:
  * **UML Use Case Diagram**: Pemetaan menyeluruh aktor (Mahasiswa, Mitra Stan, Admin, Runner Mahasiswa) dan batasan sistem.
  * **UML Activity Diagram (dengan Swimlane)**: Alur aktivitas paralel antara Mahasiswa, Server Firebase, Dapur Mitra, dan Kurir Jastip.
  * **UML Sequence Diagram**: Runtutan pertukaran pesan transaksi mulai dari *checkout*, *broadcast Firestore*, konfirmasi kasir, hingga notifikasi audio.
  * **UML State Machine Diagram**: Siklus hidup status pesanan (`Draft` $\rightarrow$ `Pending_Payment` $\rightarrow$ `Preparing` $\rightarrow$ `Ready_For_Pickup` / `Out_For_Delivery` $\rightarrow$ `Completed`).
  * **UML Class Diagram**: Struktur relasi data entitas (`Stall`, `MenuItem`, `OrderTransaction`, `StudentRunnerProfile`, `SellerAccount`, `StudentAccount`).

---

## III. ARSITEKTUR TEKNOLOGI & INFRASTRUKTUR SISTEM

| Komponen | Teknologi | Peran & Manfaat Utama |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 (TypeScript) | Komponen UI modular, pengetikan ketat (*strict typing*), dan reaktivitas tinggi. |
| **Build Tool & Bundler** | Vite 6 | Waktu kompilasi sub-detik, *Hot Module Replacement* instan, dan optimasi aset produksi. |
| **CSS & Design Constitution** | Tailwind CSS v4 | Desain antarmuka *modern responsive*, prinsip *zero-pill*, target sentuh mobile $\ge$ 44px, dan hirarki tipografi tegas (*anti-AI slop*). |
| **Database Cloud Real-Time** | Firebase Firestore | Sinkronisasi multi-perangkat instan melalui *listener* `onSnapshot`, memastikan status antrean dapur dan jastip terdistribusi secara *real-time*. |
| **Penyimpanan Lokal Sesi** | Web LocalStorage API | *Offline-first fallback* dan persistensi sesi pengguna tanpa kehilangan status saat *refresh*. |
| **Audio Synthesizer** | Web Audio API (Chime Synth) | Nada dering alarm dapur dan pengumuman pesanan selesai tanpa ketergantungan berkas MP3 eksternal. |
| **Peta Denah & Rute** | Dual Engine: Google Maps API & Leaflet 1.9 | Visualisasi interaktif titik stan di lingkungan gedung kampus dan perhitungan jarak meter. |
| **Generator QR Code** | Library `qrcode` | Pembuatan QRIS dinamis dan kode QR meja stan secara instan di sisi klien (*client-side*). |
| **Print Engine Kasir** | CSS `@media print` | Cetak struk termal otomatis (58mm/80mm) yang menyembunyikan elemen navigasi browser saat tombol cetak ditekan. |
| **Keamanan Klien** | Security Guard Utility | Validasi format NIM mahasiswa, pembatasan laju aksi (*rate limiting/anti-spam*), kompresi gambar struk, dan pembersih input anti-XSS. |

---

## IV. RINGKASAN MODEL BISNIS & FINANCIAL PROJECTION

| Saluran Pendapatan | Mekanisme & Tarif | Target & Proyeksi |
| :--- | :--- | :--- |
| **Platform Convenience Fee** | Flat Rp 1.000 / transaksi | Ditanggung pembeli untuk pemeliharaan sistem cloud real-time. |
| **Bagi Hasil Jastip Mahasiswa** | Rp 500 platform + Rp 2.000 runner mahasiswa (total fee jastip Rp 2.500) | Menghasilkan pendapatan mikro sekaligus membuka lapangan kerja sambilan bagi mahasiswa aktif. |
| **SaaS POS Dapur Mitra Stan** | Langganan Rp 29.000 – Rp 49.000 / bulan | Manajemen antrean dapur bebas kertas, laporan rekap harian, dan tiket cetak kasir. |
| **Sponsorship & Slot Promosi BEM/HIMA** | Banner mitra acara kampus & voucher organisasi | Monetisasi kolaboratif bersama organisasi kemahasiswaan. |
