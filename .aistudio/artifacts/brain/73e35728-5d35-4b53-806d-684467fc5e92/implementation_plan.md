# Analisis & Perancangan Sistem Platform Kantinku & Multi-UMKM

Dokumen ini menyajikan cetak biru analisis kebutuhan, proses bisnis, diagram aliran data (DFD), skema entitas database (ERD), dan perancangan antarmuka pengguna (UI/UX) lengkap dengan visual wireframe layout untuk platform pemesanan makanan terpusat multi-kantin dan UMKM, dengan model pembayaran rekening bersama (rekber) otomatis ala Shopee serta pemenuhan pesanan tanpa armada kurir luar (Self-Pickup & Dine-In).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Dokumen ini telah diperbarui secara komprehensif dengan **Rancang Bangun dan Analisis UI/UX Mendalam**, yang memuat Persona Pengguna, Empathy Map, Ergonomi Dapur/Kasir (HCI), Arsitektur Informasi, Design Tokens, serta **7 Visual Wireframe ASCII** (Katalog Mahasiswa, Modal Checkout, Payment Gateway Snap Shopee-Style, Kitchen Display System Mobile, Tablet Kasir Landscape, Pelacak Status Real-Time, dan Dompet Saldo Penjualan).

- **Fokus Dokumen**: Analisis terpadu mencakup Proses Bisnis, Data Flow Diagram (DFD Level 0 & Level 1), Entity Relationship Diagram (ERD Database Firestore), dan Analisis & Wireframe UI/UX Lengkap.
- **Model Multi-Merchant**: Platform multi-tenant terpusat di mana setiap stan/kantin/UMKM memiliki manajemen menu mandiri, pemisahan pesanan real-time, dan dompet saldo penjualan (*Seller Balance*) masing-masing dengan fitur pencairan dana (*withdrawal*) tanpa potongan fee ke rekening pemilik stan.
- **Kebijakan Pengiriman**: Zero-Fleet Overhead — tidak menggunakan armada kurir luar seperti Gojek/Grab. Pemenuhan pesanan murni berfokus pada dua jalur:
  1. **Makan di Tempat (Dine-In)**: Pelanggan duduk di meja, pesanan dimasak, disajikan langsung ke nomor meja.
  2. **Ambil Sendiri di Stan (Self-Pickup)**: Pelanggan memesan secara digital untuk menghindari antrean fisik, lalu mengambil pesanan di etalase stan saat status siap.
- **Alur Pembayaran**:
  - **Online (QRIS ShopeePay, E-Wallet Instant, Virtual Account)**: Otomatis terverifikasi oleh gateway rekber platform, langsung masuk ke dapur stan, dana terkumpul di dompet stan tanpa perlu cek mutasi.
  - **Tunai (COD)**: Dimasak lebih dulu, uang tunai ditagihkan saat makanan diserahkan di meja (Dine-In) atau di kasir stan (Pickup).

---

## 1. Overview & Core Concept

### 1.1 Latar Belakang Masalah
Kantin kampus (seperti IBI KKG) dan sentra UMKM kuliner menghadapi masalah klasik:
1. **Penumpukan Antrean di Jam Istirahat**: Mahasiswa dan pekerja kehilangan 15–25 menit waktu istirahat hanya untuk mengantre memesan dan menunggu makanan dimasak.
2. **Kekacauan Verifikasi Transfer Manual**: Pemilik stan sering dibuat bingung memeriksa mutasi rekening satu per satu atau rentan terhadap bukti transfer editan/palsu.
3. **Komisi Ojol yang Memberatkan**: Layanan pesan-antar komersial (Gojek, Grab, ShopeeFood) mengenakan potongan komisi 20–25% serta biaya ongkir kurir yang tidak masuk akal untuk jarak makan di dalam satu gedung/area kantin.

### 1.2 Solusi & Nilai Utama (Key Value Proposition)
Platform ini memposisikan diri sebagai **Sistem Operasi Kantin & UMKM Terintegrasi**:
- **Bagi Pembeli (Mahasiswa/Karyawan)**: Pesan dari meja atau kelas tanpa antre, lacak status persiapan makanan secara real-time, dan bayar 1-klik via QRIS/ShopeePay/VA tanpa biaya kurir.
- **Bagi Penjual (Pemilik Stan/UMKM)**: Menerima pesanan yang sudah terverifikasi lunas dengan dering suara otomatis (*Ting-tong!*), mengelola stok menu secara dinamis, dan mencairkan uang hasil penjualan utuh 100% tanpa potongan komisi.
- **Bagi Pengelola (Admin Kampus/Sentra UMKM)**: Memantau kebersihan, transparansi harga kantin, audit legalitas stan, dan rekapitulasi data perputaran ekonomi lokal.

---

## 2. Proses Bisnis & Data Flow Diagram (DFD)

### 2.1 Alur Proses Bisnis Utama

```
[ PEMBELI / MAHASISWA ]
       │
       ▼
 1. Telusuri Stan & Pilih Menu
       │
       ▼
 2. Tentukan Pemenuhan: [Dine-In + No. Meja] ATAU [Self-Pickup]
       │
       ▼
 3. Pilih Metode Bayar:
    ├── Jalur A (Online - QRIS / ShopeePay / VA)
    │      ▼
    │   Gateway Callback LUNAS Otomatis ────┐
    │                                       │
    └── Jalur B (Tunai / COD Kasir & Meja)  │
           ▼                                │
        Konfirmasi Tunai Langsung ──────────┤
                                            │
                                            ▼
                               [ SISTEM PLATFORM ]
                                            │
                        Notifikasi Real-Time (Audio & Banner)
                                            │
                                            ▼
                                   [ DAPUR STAN / UMKM ]
                                            │
                                 Terima & Mulai Masak
                                            │
                                            ▼
                            Pesanan Selesai Disiapkan
                                            │
                 ┌──────────────────────────┴──────────────────────────┐
                 ▼                                                     ▼
        [ JALUR DINE-IN ]                                     [ JALUR SELF-PICKUP ]
     Antar Makanan ke Meja X                               Mahasiswa Datang ke Kasir
    (Tagih Tunai jika COD)                                 (Tagih Tunai jika COD)
                 │                                                     │
                 └──────────────────────────┬──────────────────────────┘
                                            ▼
                                   Pesanan Berstatus SELESAI
                                            │
                             (Saldo Masuk ke Dompet Penjual)
```

---

### 2.2 Data Flow Diagram (DFD)

#### Level 0: Context Diagram
```
                     ┌──────────────────────────────────┐
                     │          PEMBELI / USER          │
                     └──────┬────────────────────▲──────┘
                            │                    │
          Data Pesanan, NIM │                    │ Status Pesanan, Nota Digital,
         & Opsi Pembayaran  │                    │ Katalog Menu Terupdate
                            ▼                    │
                   ┌───────────────────────────────────────┐
                   │                                       │
                   │   0.0 SISTEM OPERASI KANTINKU & UMKM  │
                   │                                       │
                   └──────┬──────────────────────▲─────────┘
                          │                      │
       Tiket Masak, Data  │                      │ Update Kesiapan Menu,
       Order Real-time    │                      │ Status Dapur & Penarikan Saldo
                          ▼                      │
                     ┌───────────────────────────┴──────┐
                     │         PEMILIK STAN / UMKM      │
                     └──────────────────────────────────┘
```

#### Level 1: Data Flow Diagram (Decomposition)
```
[PEMBELI] ──> ( 1.0 Manajemen Katalog & Keranjang ) ──> [DB: Menus & Stalls]
                     │
                     ▼ Data Item Terpilih
              ( 2.0 Checkout & Pemilihan Layanan )
                ├── Dine-In: Catat No. Meja
                └── Pickup: Catat Estimasi Jam
                     │
                     ▼ Nilai Tagihan
              ( 3.0 Transaksi & Gateway Payment ) <──> [Payment Gateway API]
                ├── Callback Lunas: Flag 'paid_gateway'
                └── Tunai / COD: Flag 'cash_on_pickup'
                     │
                     ▼ Buat Record Order
              ( 4.0 Distribusi Pesanan ke Dapur ) ──> [DB: Orders Collection]
                     │                                         │
                     ▼ Sinyal Real-Time                        ▼
            [PANEL KELOLA STAN] <───────────────────── ( Dering Suara & Alert )
                     │
                     ▼ Ubah Status (Cooking -> Ready -> Completed)
              ( 5.0 Eksekusi & Pencairan Dana ) ──> [DB: Seller Balance / Wallets]
```

---

## 3. Skema Database & Entity Relationship Diagram (ERD)

Arsitektur penyimpanan menggunakan dokumen NoSQL Firestore yang terdesentralisasi per entitas, dengan skema relasional terstruktur:

### 3.1 Entity Relationship Diagram (ERD)

```
┌──────────────────┐             1:N             ┌──────────────────┐
│      STALLS      │────────────────────────────<│    MENU_ITEMS    │
├──────────────────┤                             ├──────────────────┤
│ id (PK)          │                             │ id (PK)          │
│ name             │                             │ stallId (FK)     │
│ code / number    │                             │ name             │
│ category         │                             │ price            │
│ locationDescription│                           │ category         │
│ ownerName        │                             │ status (ready/out)│
│ isOpen           │                             │ imageUrl         │
│ isFrozen (Admin) │                             └──────────────────┘
└────────┬─────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐             1:N             ┌──────────────────┐
│   ORDER_TRANS    │────────────────────────────<│   ORDER_ITEMS    │
├──────────────────┤                             ├──────────────────┤
│ id (PK)          │                             │ menuItemId (FK)  │
│ stallId (FK)     │                             │ name             │
│ studentId (FK)   │                             │ price            │
│ studentName      │                             │ quantity         │
│ studentNim       │                             └──────────────────┘
│ fulfillmentType  │
│ tableNumber      │
│ pickupTime       │
│ subtotalAmount   │
│ serviceFee       │
│ totalAmount      │
│ paymentMethod    │
│ paymentStatus    │ (paid_gateway | cash_on_pickup)
│ status           │ (cooking | ready_pickup | completed | rejected)
│ securityToken    │
│ createdAt        │
└────────┬─────────┘
         │
         │ Terakumulasi
         ▼
┌──────────────────┐
│ SELLER_WALLET    │
├──────────────────┤
│ stallId (PK/FK)  │
│ totalRevenue     │
│ totalWithdrawn   │
│ availableBalance │
│ withdrawalHistory│ (Array of records: amount, bank, date)
│ payoutAccounts   │ (Config rekening penarikan dana)
└──────────────────┘
```

---

## 4. Analisis & Rancang Bangun UI/UX Mendalam

### 4.1 Persona Pengguna & Analisis Kebutuhan (User Personas & Pain Points)

#### Persona A: Mahasiswa / Pelanggan ("Aldo", 20 Tahun)
- **Karakteristik**: Waktu istirahat kuliah terbatas (hanya 30–45 menit), terbiasa dengan aplikasi Shopee/Gojek, menggunakan ponsel satu tangan saat jalan.
- **Pain Points**:
  - Malas mengantre panjang berdiri di depan etalase stan yang panas.
  - Sering tidak tahu apakah pesanan sudah mulai dimasak atau belum.
  - Takut bukti transfer mobile banking tidak terbaca oleh penjual atau curiga nomor rekening salah.
- **Kebutuhan UX**:
  - Pilihan jelas antara Makan di Meja (Dine-in) atau Ambil di Stan (Self-pickup).
  - Pembayaran instan 1-klik via QRIS ShopeePay / E-Wallet / VA tanpa perlu unggah struk manual.
  - Kartu status live tracking yang memperlihatkan progres dapur secara transparan.

#### Persona B: Pemilik Stan / Penjual ("Ibu Sari", 48 Tahun)
- **Karakteristik**: Berada di lingkungan dapur yang bising, sibuk menggoreng/meracik bumbu, tangan sering basah atau terkena minyak, menggunakan tablet kasir atau smartphone Android.
- **Pain Points**:
  - Tidak sempat bolak-balik buka aplikasi m-Banking untuk mengecek mutasi transfer setiap ada pembeli.
  - Sering terdistraksi dan tidak mendengar notifikasi chat biasa.
  - Tombol aplikasi yang terlalu kecil menyulitkan penekanan saat terburu-buru.
- **Kebutuhan UX**:
  - Dering audio keras (*Ting-tong*) dan suara bicara sintetis bahasa Indonesia saat pesanan masuk.
  - Tombol aksi berukuran besar (> 48px) dengan warna kontras tinggi (*Fitts's Law*).
  - Tanda status hijau mencolok: *"LUNAS OTOMATIS (GATEWAY) • TIDAK PERLU CEK MUTASI"*, sehingga stan bisa langsung fokus memasak.
  - Satu tombol penarikan saldo dompet (*Withdrawal*) tanpa potongan biaya admin/komisi.

---

### 4.2 Prinsip Desain & Ergonomi (HCI & Design Guidelines)

1. **Hick's Law (Meminimalkan Beban Kognitif Saat Checkout)**:
   - Pemilihan cara makan disederhanakan menjadi 2 kartu besar sejajar: `[🍽️ MAKAN DI TEMPAT]` vs `[🛍️ AMBIL DI STAN]`.
   - Jika memilih Makan di Tempat, kolom nomor meja langsung muncul dengan teks besar.
2. **Fitts's Law (Target Sentuh Ergonomis Kasir)**:
   - Pada panel dapur/kasir stan, tombol status seperti `[🍽️ TANDAI SIAP & ANTAR KE MEJA]` dan `[✅ PESANAN SELESAI]` memiliki tinggi minimal **48px–54px** dengan padding lega, mencegah salah tekan saat layar terkena sedikit minyak/air.
3. **Zero-Pill Discipline & Typographic Hierarchy**:
   - Menghindari kapsul/pill badge berlebihan yang mengotori layar.
   - Status disajikan dengan kartu latar lembut dan teks tebal berbobot visual jelas.
4. **Multimodal Sensory Feedback**:
   - Visual: Perubahan badge status real-time dengan kode warna tegas (Amber untuk memasak, Emerald untuk siap saji/lunas).
   - Audio: Web Audio API chimes sintetis dua nada (*High-Low Bell*) dipadu *Web Speech API* yang menyebutkan nama stan dan nomor meja.

---

### 4.3 Arsitektur Informasi (Information Architecture)

```
[ APLIKASI PLATFORM KANTINKU & UMKM ]
 │
 ├── MODUL PEMBELI (MAHASISWA)
 │    ├── 1. Beranda & Katalog (Pencarian, Filter Kategori, Status Buka/Tutup)
 │    ├── 2. Halaman Stan & Menu (Katalog Menu, Detail Harga, Modifier Jumlah)
 │    ├── 3. Keranjang & Modal Checkout (Dine-In + No. Meja vs Self-Pickup)
 │    ├── 4. Gateway Sheet Pembayaran (QRIS Dinamis, E-Wallet Shopee, VA Bank)
 │    └── 5. Nota Digital & Live Status Tracker (Pelacak Masak, Siap Ambil, Selesai)
 │
 ├── MODUL PENJUAL (DAPUR & KASIR STAN)
 │    ├── 1. Live Kitchen Feed (Antrean Pesanan Masuk, Audio Alert, Identitas Meja)
 │    ├── 2. Manajemen Status Pesanan (Mulai Masak -> Siap Antar/Ambil -> Selesai)
 │    ├── 3. Kelola Menu & Stok (Tambah Menu, Ubah Harga, Saklar Habis/Ready)
 │    ├── 4. Dompet Penjualan Stan (Saldo Masuk, Histori Penarikan, Form Tarik Dana)
 │    └── 5. Pengaturan & QR Stan (Download QR Meja / QR Stan Fisik)
 │
 └── MODUL SUPER ADMIN (KAMPUS / SENTRA UMKM)
      ├── 1. Ringkasan Ekosistem (Total Stan Aktif, Volume Transaksi Harian)
      ├── 2. Audit Stan & Freeze Akun (Pemeriksaan Kebersihan & Sanksi Stan)
      └── 3. Monitoring Harga & Transparansi
```

---

### 4.4 Wireframe Antarmuka Sistem (Visual ASCII Mockups)

#### Wireframe 1: Layar Katalog Mahasiswa (Mobile View - 390px)
```
┌──────────────────────────────────────────────────────────┐
│ [≡] KANTINKU IBI KKG                    (👤 Aldo Phiong) │
├──────────────────────────────────────────────────────────┤
│ 🔍 Cari nasi goreng, es teh, ayam bakar...              │
├──────────────────────────────────────────────────────────┤
│ [ Semua Stan ]  [ Makanan Berat ]  [ Minuman ]  [ Camilan ] │
├──────────────────────────────────────────────────────────┤
│ STAN 03 • ANEKA NASI & AYAM BU SARI              ● BUKA  │
│ 📍 Kantin Gedung B, Lantai 1                             │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [Foto]  Ayam Bakar Madu + Nasi                       │ │
│ │         Ayam bakar bumbu manis gurih khas Bu Sari    │ │
│ │         Rp 18.000                  [ - ]  1  [ + ]   │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ [Foto]  Es Teh Manis Jumbo (500ml)                   │ │
│ │         Teh melati wangi gula asli dingin            │ │
│ │         Rp  4.000                  [ - ]  2  [ + ]   │ │
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ 🛒 Keranjang: 3 Item • Total Rp 26.000 [ CHECKOUT → ]    │
└──────────────────────────────────────────────────────────┘
```

#### Wireframe 2: Modal Checkout & Pemilihan Layanan (Dine-In vs Pickup)
```
┌──────────────────────────────────────────────────────────┐
│ ✕ Form Pemesanan Makanan — Bu Sari                       │
├──────────────────────────────────────────────────────────┤
│ Pemesan: Aldo Phiong  |  NIM: 32230104                   │
├──────────────────────────────────────────────────────────┤
│ CARA PENYAJIAN:                                          │
│ ┌───────────────────────────┬──────────────────────────┐ │
│ │ [•] 🍽️ MAKAN DI TEMPAT   │ [ ] 🛍️ AMBIL DI STAN    │ │
│ │     (Dine-In di Meja)     │     (Self-Pickup)        │ │
│ └───────────────────────────┴──────────────────────────┘ │
│                                                          │
│ Nomor Meja Anda : [ Meja 14                     ] *Wajib │
│ Catatan Khusus  : [ Sambal dipisah ya bu                 │
├──────────────────────────────────────────────────────────┤
│ METODE PEMBAYARAN (Sistem Rekber ala Shopee):            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [•] 📱 QRIS ShopeePay & Semua Bank (Otomatis Lunas)  │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ [ ] 💳 ShopeePay / E-Wallet Instant                  │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ [ ] 🏦 Virtual Account Bank (BCA / Mandiri / BRI)    │ │
│ ├──────────────────────────────────────────────────────┤ │
│ │ [ ] 💵 Bayar Tunai di Kasir Stan (COD di Meja)       │ │
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ Subtotal Menu      : Rp 26.000                           │
│ Biaya Penanganan   : Rp  1.000 (Rp 0 jika Tunai)         │
│ TOTAL PEMBAYARAN   : Rp 27.000                           │
├──────────────────────────────────────────────────────────┤
│ [ BATAL ]                  [ BAYAR SEKARANG (OTOMATIS) → ]│
└──────────────────────────────────────────────────────────┘
```

#### Wireframe 3: Dialog Pembayaran Gateway Otomatis (Shopee / Midtrans Style)
```
┌──────────────────────────────────────────────────────────┐
│ PEMBAYARAN PLATFORM KANTINKU                          ✕  │
├──────────────────────────────────────────────────────────┤
│ Stan Penerima : Aneka Nasi & Ayam Bu Sari                │
│ Total Tagihan : Rp 27.000          ID: SHOPEE-SNAP-882910│
├──────────────────────────────────────────────────────────┤
│ [ QRIS Shopee & Bank ] [ ShopeePay / E-Wallet ] [ VA ]   │
├──────────────────────────────────────────────────────────┤
│                   ⏱️ Selesaikan dalam 14:59             │
│                                                          │
│               ┌───────────────────────┐                  │
│               │ █▀▀▀▀▀█ ▄▄ █ █▀▀▀▀▀█  │                  │
│               │ █ ███ █ █▄ ▄ █ ███ █  │                  │
│               │ █ ▀▀▀ █ ▄▀██ █ ▀▀▀ █  │                  │
│               │ ▀▀▀▀▀▀▀ ▀ █▀ ▀▀▀▀▀▀▀  │                  │
│               │  ▄█ ▀▄▀▀ ▀█▄▄  █▄ ▄   │                  │
│               │ █▀▀▀▀▀█ ▄█▄█ █▀ ▀▀ █  │                  │
│               │ █ ███ █ ▀█ ▄▀█ ▄█▀▀█  │                  │
│               │ ▀▀▀▀▀▀▀ ▀▀   ▀▀  ▀▀▀  │                  │
│               └───────────────────────┘                  │
│            NMID: ID2026880019 • IBI KKG REKBER           │
│                                                          │
│ Buka aplikasi ShopeePay, GoPay, DANA, OVO, atau          │
│ M-Banking apa saja, lalu scan kode QR di atas.           │
├──────────────────────────────────────────────────────────┤
│ [  ✓ SIMULASIKAN PEMBAYARAN BERHASIL (CALLBACK LUNAS)  ] │
└──────────────────────────────────────────────────────────┘
```

#### Wireframe 4: Layar Antrean Dapur & Kasir Stan (Panel Penjual Mobile)
```
┌──────────────────────────────────────────────────────────┐
│ STAN BU SARI • PANEL KASIR & DAPUR       🔔 Dering: ON   │
├──────────────────────────────────────────────────────────┤
│ [ Pesanan Masuk (3) ]   [ Kelola Menu ]   [ Dompet (Rp) ]│
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │ #ORD-882910 • 12.05 WIB                🍽️ DINE-IN   │ │
│ │ Pemesan: Aldo Phiong (NIM: 32230104)   MEJA: 14      │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ • 1x Ayam Bakar Madu + Nasi             Rp 18.000    │ │
│ │ • 2x Es Teh Manis Jumbo                 Rp  8.000    │ │
│ │ Catatan: "Sambal dipisah ya bu"                      │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ ✅ LUNAS OTOMATIS (GATEWAY) • TIDAK PERLU CEK MUTASI │ │
│ │ Pemasukan Stan: Rp 26.000                            │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ Status: [ SEDANG DIMASAK / DISIAPKAN ]               │ │
│ │ [ 🍽️ TANDAI SIAP & ANTAR KE MEJA 14 ]                │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ #ORD-882911 • 12.08 WIB                🛍️ PICKUP     │ │
│ │ Pemesan: Cynthia (NIM: 32230188)       JAM: 12.15    │ │
│ │ • 1x Nasi Goreng Spesial                Rp 15.000    │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ 💵 BAYAR TUNAI (COD) • TAGIH RP 15.000 DI KASIR      │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ [ MULAI MASAK ]   [ SELESAIKAN (TERIMA TUNAI RP 15K)│ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

#### Wireframe 5: Tampilan Kasir Tablet Dapur (Landscape 1024px)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [🏪 STAN 03 - AYAM BU SARI]           Status Stan: ● BUKA          🔔 Dering: ON [🔊] │
├────────────────────────────────────┬───────────────────────────────────────────────────┤
│ ANTREAN PESANAN AKTIF (4 PESANAN)  │ DETAIL PESANAN TERPILIH                           │
├────────────────────────────────────┼───────────────────────────────────────────────────┤
│ [•] #ORD-882910  12.05 WIB         │ Tiket Pesanan: #ORD-882910                        │
│     Aldo Phiong  • MEJA 14         │ Pemesan      : Aldo Phiong (NIM: 32230104)        │
│     🍽️ Dine-In   • LUNAS GATEWAY   │ Layanan      : 🍽️ Dine-In (Antar ke Meja 14)      │
│     Status: Sedang Dimasak         │ Waktu Masuk  : 12:05 WIB (3 menit lalu)           │
├────────────────────────────────────┤ ───────────────────────────────────────────────── │
│ [ ] #ORD-882911  12.08 WIB         │ Rincian Menu Dapur:                               │
│     Cynthia      • AMBIL DI STAN   │ • 1x Ayam Bakar Madu + Nasi             Rp 18.000 │
│     🛍️ Pickup    • TUNAI (COD)     │ • 2x Es Teh Manis Jumbo                 Rp  8.000 │
│     Status: Menunggu Dimasak       │ Catatan: "Sambal dipisah ya bu"                   │
├────────────────────────────────────┤ ───────────────────────────────────────────────── │
│ [ ] #ORD-882912  12.11 WIB         │ Status Pembayaran:                                │
│     Budi Pratama • MEJA 03         │ ✅ LUNAS OTOMATIS VIA QRIS SHOPEEPAY              │
│     🍽️ Dine-In   • LUNAS GATEWAY   │ Saldo Masuk ke Dompet: Rp 26.000                  │
├────────────────────────────────────┼───────────────────────────────────────────────────┤
│ TOTAL OMSET HARI INI: Rp 1.450.000 │ [ 🍽️ TANDAI SIAP & SAJIKAN KE MEJA 14 (SIAP MAKAN)]│
└────────────────────────────────────┴───────────────────────────────────────────────────┘
```

#### Wireframe 6: Nota Digital & Pelacak Pesanan Mahasiswa (Live Tracking)
```
┌──────────────────────────────────────────────────────────┐
│ NOTA DIGITAL & STATUS PESANAN                         ✕  │
├──────────────────────────────────────────────────────────┤
│ Nomor Pesanan : #ORD-882910                              │
│ Stan Makanan  : Aneka Nasi & Ayam Bu Sari                │
│ Waktu Pesan   : 14 Okt 2026, 12:05 WIB                   │
├──────────────────────────────────────────────────────────┤
│ INDIKATOR STATUS REAL-TIME:                              │
│                                                          │
│  [✓] Diterima ──> [✓] Lunas ──> [●] Dimasak ──> [ ] Siap │
│                                                          │
│ Status Saat Ini : 🍳 SEDANG DIMASAK DI DAPUR             │
│ Estimasi Siap   : 5 - 8 Menit Lagi                       │
├──────────────────────────────────────────────────────────┤
│ Detail Penyajian : 🍽️ MAKAN DI TEMPAT                   │
│ Lokasi Antar     : Meja Nomor 14 (Kantin Gedung B)       │
│ Kode Verifikasi  : SEC-8829-KANTIN (Tunjukkan ke pelayan)│
├──────────────────────────────────────────────────────────┤
│ Rincian Pesanan:                                         │
│ • 1x Ayam Bakar Madu + Nasi                    Rp 18.000 │
│ • 2x Es Teh Manis Jumbo                        Rp  8.000 │
│ Biaya Layanan Gateway                          Rp  1.000 │
│ ──────────────────────────────────────────────────────── │
│ TOTAL PEMBAYARAN                               Rp 27.000 │
│ Status Bayar : ✅ LUNAS OTOMATIS (SHOPEEPAY GATEWAY)    │
├──────────────────────────────────────────────────────────┤
│ [ 🔄 REFRESH STATUS ]                [ TUTUP NOTA ]     │
└──────────────────────────────────────────────────────────┘
```

#### Wireframe 7: Dompet Saldo Penjualan Stan (Shopee-Style Seller Balance)
```
┌──────────────────────────────────────────────────────────┐
│ DOMPET PENJUALAN STAN (Sistem Mirip Shopee Balance)      │
├──────────────────────────────────────────────────────────┤
│ 💰 SALDO SIAP DITARIK : Rp 480.000                       │
│    (Terkumpul Utuh 100% • 0% Potongan Komisi)            │
├──────────────────────────────────────────────────────────┤
│ Pilih Rekening Tujuan Pencairan:                         │
│ (•) DANA / GoPay  : 081290001980 a.n. Bu Sari            │
│ ( ) Bank BCA      : 6840928114 a.n. Siti Saripah         │
│                                                          │
│ [ 💳 TARIK SALDO KE REKENING (Rp 0 BIAYA ADMIN) ]       │
├──────────────────────────────────────────────────────────┤
│ Riwayat Penarikan Dana Terakhir:                         │
│ • 14 Okt 2026, 17.00 WIB — Rp 350.000 (DANA)   ● SUKSES │
│ • 13 Okt 2026, 16.45 WIB — Rp 520.000 (BCA)    ● SUKSES │
└──────────────────────────────────────────────────────────┘
```

---

### 4.5 Design System Tokens

- **Primary Color**: Emerald Green (`#047857`, `#059669`) — melambangkan kesegaran, kebersihan, rasa aman, dan makanan higienis.
- **Secondary Color**: Warm Amber / Gold (`#d97706`, `#f59e0b`) — melambangkan selera makan, kehangatan, dan pembeda visual Makan di Tempat (Dine-In).
- **Surface & Background**:
  - Background Utama: Slate Canvas (`#f8fafc`, `#f1f5f9`) — menjaga kenyamanan mata di bawah pencahayaan kantin.
  - Card Surface: Pure White (`#ffffff`) dengan radius sudut `16px–24px` dan bayangan lembut (`shadow-sm`, `shadow-md`).
- **Typography Tokens**:
  - Headings & Judul Menu: Plus Jakarta Sans (Bold/Semi-bold, 18px–24px)
  - Body & Label Form: Inter (Regular & Medium, 13px–15px)
  - Data Finansial & Token: JetBrains Mono (Nomor Tiket & Nomor Meja)
- **Komponen & Feedback State**:
  - Tombol Aksi Kasir: Min. 48px tinggi (`h-12` s/d `h-14`), padding horizontal `px-5`, font bold.
  - Badge Status Lunas: Latar hijau emerald lembut dengan teks gelap kontras tinggi, bebas dari dekorasi pill berlebihan.

---

## 5. Rencana Arsitektur Teknis & Komponen

```
┌────────────────────────────────────────────────────────────────────────┐
│                          APLIKASI REACT SPA                            │
├────────────────────────────┬────────────────────────────┬──────────────┤
│    Modul Mahasiswa         │    Modul Pemilik Stan      │ Modul Admin  │
│    (KatalogScreen,         │    (KelolaMenuScreen,      │ (AdminPortal)│
│     DetailStanScreen,      │     StallQrModal,          │              │
│     OrderReceiptModal)     │     WithdrawalManager)     │              │
├────────────────────────────┴────────────────────────────┴──────────────┤
│                         LAPISAN LOGIKA & STATE                         │
│  - Storage Keys & Local Session Fallback                               │
│  - Anti-Spam Security Cooldown & Price Bounds Guard                     │
│  - Real-Time Web Audio Synthesizer (Ting-Tong Chime)                   │
├────────────────────────────────────────────────────────────────────────┤
│                    INTEGRASI EKSTERNAL & PERSISTENSI                   │
│  - Firebase Firestore (Sinkronisasi Antar Device & Cloud Backup)       │
│  - Payment Gateway Rekber Platform (Simulasi Callback Otomatis)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Peta Jalan Pengembangan & Langkah Selanjutnya

1. **Tahap 1: Validasi Rancangan**: Menyetujui dokumen analisis, proses bisnis, diagram DFD/ERD, dan visualisasi 7 wireframe UI/UX di atas.
2. **Tahap 2: Penguatan Model Multi-Tenant UMKM**: Memastikan pendaftaran stan baru dapat dilakukan secara fleksibel untuk kantin di luar kampus IBI KKG.
3. **Tahap 3: Finalisasi Laporan & Rekap Penjualan**: Menambahkan fitur ekspor rekap harian/bulanan untuk pemilik stan dalam format cetak/PDF nota.
