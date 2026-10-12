# Rencana Redesain UI Modern Clean (ShopeeFood / Gojek) untuk KantinKu IBI KKG

Berikut adalah rencana arsitektur dan rancangan visual untuk meredesain antarmuka (UI) web **KantinKu IBI KKG** menjadi **Modern Clean App (ala ShopeeFood & Gojek)** dalam format **Mobile-Responsive Website**.

---

## 1. Pratinjau Desain Visual (UI Mockup)

### A. Tampilan Halaman Beranda & Katalog Kantin
Tampilan beranda mengusung warna hijau segar khas kampus (*Emerald Green*) dipadu kartu putih bersih, bar pencarian terpusat ala GoFood/Shopee, ikon kategori makanan cepat, dan kartu stan makanan berfoto menggugah selera:

![Mockup Beranda & Katalog Kantin](/src/assets/images/mockup_beranda_katalog_1791818048189.jpg)

**Karakteristik Desain:**
- **Pencarian Cepat**: Kolom pencarian ramah jempol *"Mau makan apa di Kantin IBI KKG hari ini?"*.
- **Kategori Ikonik**: Nasi & Lauk, Mie & Bakso, Minuman Dingin, Snack.
- **Kartu Stan Makanan**: Foto makanan 16:9, informasi bintang ulasan (`⭐ 4.8`), jarak meter (`120 m`), estimasi penyiapan (`15 mnt`), dan tombol aksi cepat *"Pesan Sekarang"*.

---

### B. Tampilan Halaman Detail Stan & Keranjang Belanja
Tampilan pemesanan langsung stan dirancang ramping dan fungsional, dengan kartu makanan dua kolom serta *Sticky Bottom Cart Bar* yang memudahkan checkout:

![Mockup Detail Stan & Menu Keranjang](/src/assets/images/mockup_detail_menu_cart_1791818061176.jpg)

**Karakteristik Desain:**
- **Header Profil Stan**: Identitas stan terverifikasi resmi kampus, jam operasional, dan ulasan.
- **Stepper Kuantitas Langsung**: Tombol `[-]` `[Qty]` `[+]` langsung di kartu menu makanan tanpa pop-up berbelit.
- **Sticky Cart Bottom Bar**: Baris melayang di bawah layar yang menampilkan jumlah porsi pesanan, subtotal rupiah, dan tombol hijau *"Lanjut Pembayaran"*.

---

## 2. User Review & Critical Decisions

> [!IMPORTANT]
> - **Gaya Tampilan**: Modern Clean App ala ShopeeFood & Gojek (palet emerald green `#059669` / `#10B981` dan slate netral bersih).
> - **Target Layar**: **Mobile-Responsive Website** (rapi dan nyaman diakses di smartphone layar 360px–430px, tablet, maupun layar laptop 1440px tanpa terpotong).
> - **Fokus Pengerjaan**: 
>   1. `src/components/KatalogScreen.tsx` (Beranda, Direktori Stan, Filter, Sub-navigasi).
>   2. `src/components/DetailStanScreen.tsx` (Profil Stan, Grid Menu Makanan, Stepper Pesanan, Sticky Cart, Modal Checkout).

---

## 3. Tahapan Eksekusi Pembangunan

1. **Tahap 1: Redesain Halaman Beranda / Katalog Kantin (`src/components/KatalogScreen.tsx`)**
   - Mengubah bilah sub-navigasi menjadi tab kapsul modern responsif.
   - Mengintegrasikan search bar terpadu bergaya Gojek/ShopeeFood.
   - Merombak grid kartu stan kantin agar menampilkan gambar berkualitas tinggi, metadata ringkas tanpa badge bertumpuk, dan tombol pintasan rute peta/pesan.
2. **Tahap 2: Redesain Halaman Detail Stan & Keranjang Belanja (`src/components/DetailStanScreen.tsx`)**
   - Memodernisasi profil stan dengan badge verifikasi resmi IBI KKG.
   - Menerapkan kartu menu dengan kontrol kuantitas taktil (`-` / `+`).
   - Menyematkan *Sticky Floating Cart Bar* di bagian bawah layar untuk pengalaman pemesanan kilat.
   - Merapikan formulir checkout (nama, NIM, pilihan QRIS/E-Wallet/Tunai).
3. **Tahap 3: Verifikasi Fungsional & Kompilasi**
   - Memastikan seluruh fitur (penghitungan harga, QR Code, keranjang belanja, sinkronisasi pesanan Firestore, live GPS) tetap berjalan normal.
   - Menjalankan `compile_applet` untuk memastikan build produksi sukses.
