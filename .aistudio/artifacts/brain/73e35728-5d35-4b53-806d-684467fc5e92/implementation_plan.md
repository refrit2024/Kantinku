# Spesifikasi Sistem & Diagram UML Platform Unifood
*(Campus Hyper-Local Food & Student Jastip Platform)*

Dokumen ini memuat **Spesifikasi Lengkap Alur Sistem, Diagram UML (Unified Modeling Language), dan Arsitektur Interaktif** untuk platform web **Unifood**. Halaman interaktif pada web app (`AlurSistemScreen.tsx`) menyediakan simulasi interaktif multi-peran serta bagan diagram UML lengkap.

---

## 1. Arsitektur Aktor & Spesifikasi Diagram UML

### A. UML Use Case Diagram
Menggambarkan interaksi antara aktor utama (**Mahasiswa / Pembeli**, **Kurir Jastip Mahasiswa**, **Mitra Stan UMKM**, **Admin Kampus**, dan **Sistem Eksternal Payment Gateway / QRIS**) dengan kapabilitas platform Unifood:

```
       +-------------------------------------------------------------------------+
       |                        SISTEM UNIFOOD KAMPUS                            |
       |                                                                         |
       |  +--------------------------------+                                     |
(M)--> |  Pencarian Menu & Multi-Kampus    |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Pilih Fulfillment (Jastip/Take/Dine)                                  |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Pre-Order Slot Jam Istirahat  |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Group Order & Split-Bill      |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+         +-------------------------+ |
 +---> |  Pembayaran QRIS / VA / Tunai  | <-----> | Gateway QRIS & VA Bank  | <---+ (P)
 |     +--------------------------------+         +-------------------------+ |
 |     +--------------------------------+                                     |
 +---> |  Pantau Live Kitchen & Runner  |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Verifikasi PIN Serah Terima   |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Rating & Lapor Selisih HET    |                                     |
       +--------------------------------+                                     |
                                                                              |
       +--------------------------------+                                     |
(R)--> |  Daftar & Verifikasi Status Mhs|                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Ambil Tiket Antar-Lantai (+2.5k)                                    |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Validasi PIN Mhs & Klaim Dana |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Tarik Saldo Dompet Runner     |                                     |
       +--------------------------------+                                     |
                                                                              |
       +--------------------------------+                                     |
(S)--> |  Kelola Katalog & Menu Mhs     |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Pantau KDS Dapur (Pesanan)    |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Konfirmasi Pembayaran Kasir   |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Lihat & Cetak Rekap Omzet     |                                     |
       +--------------------------------+                                     |
                                                                              |
       +--------------------------------+                                     |
(A)--> |  Verifikasi Stan & Wirausaha   |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Investigasi Selisih HET Struk |                                     |
 |     +--------------------------------+                                     |
 |     +--------------------------------+                                     |
 +---> |  Broadcast Pengumuman Kampus   |                                     |
       +--------------------------------+                                     |
       +-------------------------------------------------------------------------+
Aktor:
  (M) = Mahasiswa / Pembeli
  (R) = Kurir Jastip Mahasiswa (Student Runner)
  (S) = Pemilik Stan / Mitra UMKM & Koki
  (A) = Admin Kampus (Sarpras & Pengelola)
  (P) = Penyedia Payment Gateway (QRIS Nasional & Bank)
```

---

### B. UML Activity Diagram (dengan Swimlane)
Menjelaskan aliran aktivitas lintas entitas secara paralel dalam satu siklus transaksi pemesanan Jastip Antar-Lantai:

```
[Mahasiswa]               [Sistem Unifood]            [Dapur Mitra]         [Kurir Mahasiswa]
     |                           |                          |                      |
  (Mulai)                        |                          |                      |
     |                           |                          |                      |
 Pilih Menu &                    |                          |                      |
 Kamar Kuliah                    |                          |                      |
     |                           |                          |                      |
 Checkout (Opsi Jastip)          |                          |                      |
     |                           |                          |                      |
 Bayar (QRIS / Tunai) ---------> |                          |                      |
                                 |                          |                      |
                        Kirim Notif Dapur &                |                      |
                        Bursa Tugas Runner                  |                      |
                                 | \                        |                      |
                                 |  \-------- Alarm Chime ->|                      |
                                 |          Terima & Masak  |                      |
                                 |          Pesanan         |                      |
                                 |             |            |                      |
                                 |             v            |                      |
                        Pesanan Siap <---- Makanan Siap ----+                      |
                                 |                                                 |
                                 +----------------- Notifikasi Bursa ------------->|
                                                                            Ambil Tugas Jastip
                                                                                   |
                                                                            Ambil Makanan di
                                                                            Kantin Dasar
                                                                                   |
                                                                            Naik Tangga/Lift
                                                                            ke Ruang Kelas
                                                                                   |
 Terima Makanan & <------------- Serah Terima Fisik Makanan -----------------------+
 Sebutkan PIN 4 Digit            |
     |                           |
     +---- Masukkan PIN -------->|
                                 |
                        Verifikasi PIN Cocok
                                 |
                        [PIN Valid: Selesai]
                                 | \
                                 |  +----> Kreditkan Upah Rp 2.500 ke Dompet Runner
                                 v
                              (Selesai)
```

---

### C. UML Sequence Diagram (Pemesanan & Sinkronisasi Real-Time)

```
Mahasiswa          Unifood Client        Firebase Firestore        Dapur Stan       Kurir Runner
   |                     |                       |                     |                 |
   |-- 1. Buat Pesanan ->|                       |                     |                 |
   |                     |-- 2. setDoc(orders) ->|                     |                 |
   |                     |                       |-- 3. onSnapshot --->|                 |
   |                     |                       |   (Order Masuk)     |-- 4. Chime () ->|
   |                     |                       |                     |   (Alarm Dapur) |
   |                     |                       |-- 5. onSnapshot --------------------->|
   |                     |                       |   (Tugas Jastip)    |                 |
   |                     |                       |                     |                 |-- 6. Ambil Jastip
   |                     |                       |<-- 7. updateDoc(runnerId) ------------|
   |                     |                       |                     |                 |
   |                     |                       |<- 8. Status "Siap" -|                 |
   |                     |                       |                     |                 |
   |<-- 9. Notif Siap ---|<-- onSnapshot --------|                     |                 |-- 10. Ambil di Dapur
   |                     |                       |                     |                 |-- 11. Antar ke Kelas
   |-- 12. Sebut PIN --->|                       |                     |                 |
   |                     |-- 13. updateStatus -->|<-- 14. Validasi PIN ------------------|
   |<-- 15. Selesai -----|                       |-- 16. Dompet +2.5k ------------------>|
```

---

### D. UML State Machine Diagram (Siklus Hidup Pesanan)

```
[*] --> PENDING_PAYMENT : Mahasiswa klik Checkout
PENDING_PAYMENT --> PREPARING : Pembayaran QRIS Berhasil / Konfirmasi Kasir
PREPARING --> WAITING_RUNNER : Makanan selesai dimasak & butuh Kurir Jastip
PREPARING --> READY_FOR_PICKUP : Makanan selesai (Mode Ambil Sendiri / Makan di Tempat)
WAITING_RUNNER --> DELIVERING_TO_FLOOR : Kurir Mahasiswa mengklaim tugas & menuju lantai tujuan
DELIVERING_TO_FLOOR --> COMPLETED : Serah terima fisik & verifikasi PIN 4 digit
READY_FOR_PICKUP --> COMPLETED : Pembeli mengambil makanan di stan
PENDING_PAYMENT --> CANCELLED : Batal / Waktu pembayaran habis
[*] <-- COMPLETED
[*] <-- CANCELLED
```

---

### E. UML Class Diagram (Struktur Entitas Data Utama)

```
+------------------------------------+          +------------------------------------+
|               Stall                |          |              MenuItem              |
+------------------------------------+          +------------------------------------+
| + id: string                       | 1      * | + id: string                       |
| + name: string                     |<>--------| + name: string                     |
| + campusName: string               |          | + price: number                    |
| + building: string                 |          | + category: makanan|minuman|snack  |
| + floor: string                    |          | + status: ready|habis              |
| + openStatus: buka|tutup|istirahat |          | + isStudentEntrepreneur: boolean   |
| + isStudentEntrepreneur: boolean   |          | + isPreOrderOnly: boolean          |
+------------------------------------+          +------------------------------------+
                  | 1
                  |
                  | *
+------------------------------------+          +------------------------------------+
|          OrderTransaction          |          |        StudentRunnerProfile        |
+------------------------------------+          +------------------------------------+
| + id: string                       |          | + studentNim: string               |
| + orderNumber: string              |          | + studentName: string              |
| + customerName: string             |          | + whatsappNumber: string           |
| + fulfillmentType: FulfillmentType |          | + faculty: string                  |
| + deliveryBuilding?: string        |          | + isAvailable: boolean             |
| + deliveryFloor?: string           |          | + totalDeliveriesCompleted: number |
| + deliveryRoom?: string            |          | + runnerWalletBalance: number      |
| + preOrderSlot?: string            |          +------------------------------------+
| + runnerNim?: string               |                            | 1
| + runnerFee: number (2500)         |                            |
| + deliveryVerificationPin: string  |                            | *
| + subtotalAmount: number           |----------------------------+
| + serviceFee: number (1000)        |
| + totalAmount: number              |
| + status: OrderStatusType          |
+------------------------------------+
```
