export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'makanan' | 'minuman' | 'snack';
  status: 'ready' | 'habis';
  habisReason?: string;
  lastUpdated: string;
  imageCatalog: string;
  imageMerchant: string;
  altCatalog: string;
  altMerchant: string;
  icon: string;
}

export interface ReviewItem {
  id: string;
  studentName: string;
  majorAndYear: string;
  rating: number;
  date: string;
  comment: string;
  reply?: string;
}

export interface PaymentDetails {
  qrisEnabled: boolean;
  qrisMerchantName: string;
  qrisNmid: string;
  qrisImage?: string;
  ewalletEnabled: boolean;
  ewalletProviders: string; // e.g., 'DANA / GoPay / OVO / ShopeePay'
  ewalletNumber: string;
  ewalletAccountName: string;
  bankEnabled: boolean;
  bankName: string; // e.g., 'BCA / Mandiri / BRI'
  bankAccountNumber: string;
  bankAccountName: string;
  cashEnabled: boolean;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export type PaymentMethodType = 'qris' | 'ewallet' | 'bank' | 'tunai';

export type OrderStatusType =
  | 'waiting_payment_verification'
  | 'cooking'
  | 'ready_pickup'
  | 'completed'
  | 'rejected';

export interface OrderTransaction {
  id: string;
  stallId: string;
  stallName: string;
  stallLocation: string;
  studentName: string;
  studentNim: string;
  pickupTime: string;
  notes?: string;
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethodType;
  paymentProviderLabel: string;
  paymentReference?: string;
  status: OrderStatusType;
  rejectionReason?: string;
  createdAt: string;
}

export interface Stall {
  id: string;
  name: string;
  code: string;
  mapPinCode: 'Kantin A' | 'Kantin B' | 'Kantin C' | 'Kantin D';
  building: 'Gedung A' | 'Gedung B';
  distanceMeters: number;
  locationDetail: string;
  fullLocation: string;
  walkingGuide: string;
  specialty: string;
  description: string;
  daysOpen: string;
  hours: string;
  rating: number;
  reviewCount: number;
  visitorsCount: number;
  isOpen: boolean;
  lastUpdatedDate: string;
  lastUpdatedTime: string;
  verifiedAt: string;
  bannerImage: string;
  heroImage: string;
  bannerAlt: string;
  whatsapp: string;
  paymentMethods: string[];
  paymentDetails?: PaymentDetails;
  menuItems: MenuItem[];
  reviews: ReviewItem[];
}

export interface VerificationRequest {
  id: string;
  sellerAccountId?: string;
  badgeText: string;
  badgeType: 'new' | 'update';
  name: string;
  location: string;
  image: string;
  alt: string;
  approved: boolean;
  rejectedReason?: string;
  details: {
    label: string;
    value: string;
    isWhatsapp?: boolean;
    whatsappUrl?: string;
    isBadge?: boolean;
    isHighlight?: boolean;
  }[];
  primaryActionText: string;
  secondaryActionText: string;
  secondaryActionType: 'revisi' | 'modal';
}

export interface SellerAccount {
  id: string;
  ownerName: string;
  email: string;
  password: string;
  whatsapp: string;
  stallId: string;
  stallName: string;
  building: 'Gedung A' | 'Gedung B';
  locationDetail: string;
  categorySummary: string;
  hours: string;
  status: 'approved' | 'pending' | 'rejected';
  rejectedNote?: string;
}

export interface AdminCredentials {
  email: string;
  password: string;
  updatedAt?: string;
}

export const INITIAL_ADMIN_CREDENTIALS: AdminCredentials = {
  email: 'sarpras@ibikkg.ac.id',
  password: 'admin123',
};

export function getStallPaymentDetails(stall: Stall): PaymentDetails {
  if (stall.paymentDetails) return stall.paymentDetails;
  const cleanPhone = (stall.whatsapp || '081290001980').replace(/^62/, '0');
  return {
    qrisEnabled: true,
    qrisMerchantName: `${stall.name.toUpperCase()} - IBI KKG`,
    qrisNmid: `ID202600${stall.code.replace(/[^0-9]/g, '') || '101'}8829`,
    ewalletEnabled: true,
    ewalletProviders: 'DANA / GoPay / OVO / ShopeePay',
    ewalletNumber: cleanPhone,
    ewalletAccountName: stall.name,
    bankEnabled: true,
    bankName: 'BCA / Mandiri / Bank DKI',
    bankAccountNumber: '6840928114',
    bankAccountName: `Mitra ${stall.name}`,
    cashEnabled: true,
  };
}

export const INITIAL_SELLER_ACCOUNTS: SellerAccount[] = [
  {
    id: 'seller-bu-sari',
    ownerName: 'Ibu Sari Rahmawati',
    email: 'busari@ibikkg.ac.id',
    password: 'password123',
    whatsapp: '6281290001980',
    stallId: 'stan-bu-sari',
    stallName: 'Kantin Bu Sari',
    building: 'Gedung A',
    locationDetail: 'Gedung A Lt. 1 Stan 01',
    categorySummary: 'Masakan Rumahan & Ayam Geprek',
    hours: '07.00–20.00',
    status: 'approved',
  },
  {
    id: 'seller-mas-budi',
    ownerName: 'Budi Santoso',
    email: 'masbudi@ibikkg.ac.id',
    password: 'password123',
    whatsapp: '6281280002211',
    stallId: 'stan-mas-budi',
    stallName: 'Dapur Mas Budi (Mie & Soto)',
    building: 'Gedung A',
    locationDetail: 'Gedung A Lt. 1 Stan 04',
    categorySummary: 'Mie Ayam Bakso & Soto Lamongan',
    hours: '07.30–18.00',
    status: 'approved',
  },
  {
    id: 'seller-bu-nanik',
    ownerName: 'Nanik Rahayu',
    email: 'bunanik@gmail.com',
    password: 'password123',
    whatsapp: '6281288992211',
    stallId: 'stan-bu-nanik',
    stallName: 'Warung Nasi Uduk Bu Nanik',
    building: 'Gedung A',
    locationDetail: 'Selasar Gedung A Lt. 2 (Depan Lab Komputer)',
    categorySummary: 'Makanan Berat Tradisional & Gorengan',
    hours: '07.00–16.30',
    status: 'pending',
  },
];

export const INITIAL_BU_SARI_MENU: MenuItem[] = [
  {
    id: 'item-1',
    name: 'Nasi Ayam Geprek',
    description: 'Ayam geprek krispi + nasi putih hangat + sambal bawang + lalapan',
    price: 15000,
    category: 'makanan',
    status: 'ready',
    lastUpdated: '8 Oktober 2026',
    imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB33IS6pEIcAYrx6GRR1RsXoW7Trjn0Ywl6MK6PJl-7Ys6sR6mA09jO-Un5cgpdQLRDE6gTM60I6ZFsrZlygxQcDQHJdTO7oetSvvKLjufjsXi6gOaY3pAg4n3DI_2ONKgXL-xrjlFPkxi_Ftoue8RAJWpWCiY2QJ8s29RL7rypr0cHn9pNd9sg6isQbbf18mH56TlsXI2oWpZAcSTQQWd2vjbrgmymcIs7GoKr55WZ',
    imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBB_GqGXvtBAYrYVtpHoLMgh9TgWCMzpF7jUsbftyXtOPQ7XE271jj06bIzoy3Pl5z640WDlYdSN7UjQxwUjMpIBzhTD9V_6F3Ga6MoXW044HepLEmyboZGcNP1Ho3drG8qgmNG8Xi8HdItiBSI6WFegBLmXqKJ8S5fUJuF8g7cA5u2ZMDK-4m4BuNzfkMAvbk-UuTlE7Bftj1hqgwX-gXYwBDQhlpNGxgFycRom3NX',
    altMerchant: 'Nasi ayam geprek krispi disiram sambal bawang pedas khas nusantara disajikan di atas piring kantin kampus IBI KKG',
    altCatalog: 'Porsi Nasi Ayam Geprek khas warung Bu Sari IBI KKG dengan ayam krispi keemasan diulek cabai rawit pedas',
    icon: 'lunch_dining',
  },
  {
    id: 'item-2',
    name: 'Nasi Goreng Spesial',
    description: 'Nasi goreng rempah Jawa + telur ceplok + suwir ayam + kerupuk',
    price: 12000,
    category: 'makanan',
    status: 'ready',
    lastUpdated: '8 Oktober 2026',
    imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTuP8_3rlK7tIejRf6tGe1ub4OB5CkrThvPV56mK22-CIDqtukZLFklQUlSjlNoyVBhyrpxro6zVy7tZuxlQYDB3Gbae2T1-hIdd3MiM2FAQoYyg0rFFeAaEm_v4mE7CQS7zw7FgHBVtBm5YdvshSHPXauZS--0FWogpuCU_uqB74kZluJHgWZu7IQTh2YeGo5zNzWFCkhcBk_uRXTOcHn1ePi-C7mi9riux2BLUGU',
    imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCvIFBU2tfQqukNlQebwiqUjjQwnmQ6DX3CcSH_QYIEk9senYrnXMqbe-Obm7qjFZ_iSIBlcsxqGR5xQZtIQw-aooPgQrt_1D99wiqicXmkEQziNGuRffJq4mYc3Phz6GgoELVNOHmiWdZ0z7M1_-4mrc3bRTsNlFXfG75Llv-U3rML__zJRTH6vHfJEAaI3mCmO6E4_t8T8Vj6RKCBfIivnO_IwwNehco_vCsterDb',
    altMerchant: 'Nasi goreng spesial harum dengan telur mata sapi dan acar segar di piring keramik putih',
    altCatalog: 'Nasi Goreng Spesial Telur khas kantin kampus IBI KKG',
    icon: 'ramen_dining',
  },
  {
    id: 'item-3',
    name: 'Mie Ayam Bakso',
    description: 'Mie kenyal + topping ayam kecap manis + 2 bakso sapi halus',
    price: 12000,
    category: 'makanan',
    status: 'ready',
    lastUpdated: '8 Oktober 2026',
    imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClG5VdjIoR8LwnzW5-CNJR0S8OdL9_dtV5alBorYEflyaY-sXnx317TevIzp5AiFie-ps_i4iAopzqqgmRJ8TMHY7IfipeA74c69F83srSyditZSY5VoFr4ZSKzvB995kup5GMFx8ujHNKoi9ISo53dmzNRMOnFMtH4ZQlwoz_mzlWRkQk2W7OH6Q34kzxaTTpJrVk6JtO4KimphqPh8Zw3kxhBlHYeHDRUPX2iKb4',
    imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxWM-4iIfV_-XmePUALzxcsmQF1JkP9yzQDU7XmgsZkeWwroGPdxtwvlUu85GRa97j6cnnQgUgsSm1NHTWF2H2axsLoOQ3nQ-0gHQVtapSQRXZlBa31tBxyEhPI8k2atM50LiSqfhMKReD_y0XQEecUhMU4_UoPIc_Q45GCJb9F2N2DexhikVaUxuca16m7DGXoO0yKduhrm4-8OasKnL_0J1b6JLfELPfUi5JCIeg',
    altMerchant: 'Semangkuk mie ayam kenyal lezat ditaburi daging ayam kecap cincang dan bakso sapi gurih',
    altCatalog: 'Semangkuk Mie Ayam Bakso Pangsit lezat',
    icon: 'ramen_dining',
  },
  {
    id: 'item-4',
    name: 'Nasi Ayam Sambal Matah',
    description: 'Ayam suwir garing dengan rajangan serai, daun jeruk, dan minyak kelapa wangi.',
    price: 16000,
    category: 'makanan',
    status: 'habis',
    habisReason: 'Habis sejak 11:20 WIB (Bahan habis)',
    lastUpdated: '8 Oktober 2026',
    imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZrF_fAu0eafQo7C8aT3F_TyE5PJOqrXoE4tW6I5qE-Pndj5lCNmwhqfpq0NwNdm7AD8cKhc87RljaaVqzth7rliR8DrMFTToyCsTednoRedqHL_WrrPZ8gmMxGnCv-P9I04CszBynERBlzQw7b-m3-wKVrJpcok-PNLNQib1PyeG704x87Lcu3Ie52XN9TCJ1-NZD6Au4Mooqj3gZfnJUixeB0g7xIaeQe-zb3BUa',
    imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvQdU0s96WAZSCIDRQGz4QtNKdsiKlxBYkyFq54H1t4ohRjSgup7MQj34Lcn16kWDLBK50kjj2rMK_5e_8Lq9Xy_KbZEvHSNr87Re8gMoPWCmwOHzk9IRyEpT2VDPgs4M_xrDXnEUistOA-U2RUHCISD1qXaH3GuPiAo-mMTLqs-YS-ShOsmPjmdzb9P339xDGx2-hiOSFye7B1KKeOv0C-zMG8NRcsULsGz2onows',
    altMerchant: 'Nasi ayam suwir lezat dengan taburan irisan serai dan cabai rawit merah khas sambal matah Bali',
    altCatalog: 'Nasi Ayam Goreng disiram Sambal Matah Bali harum',
    icon: 'lunch_dining',
  },
  {
    id: 'item-5',
    name: 'Es Teh Manis Jumbo',
    description: 'Gelas cup 22oz racikan teh melati wangi + gula tebu asli',
    price: 5000,
    category: 'minuman',
    status: 'ready',
    lastUpdated: '8 Oktober 2026',
    imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAkgGtl4GxdpXZClh6ucObJmh53ySgoa63hdrPLpmweSYkhopHLuKCQ6bxbwjc7-xLIsFz_d3vlCGwwmVAM7pDM2cspI-IkryEisRwq1YHqfkb8WmA0x0hnjF6zRnTGsCfYC4jumTJ7nvwPqbfWw-6Z1unHb3CyvT3N-e3zhy98XRbZLc2uErClYaC8bI4YxfujCmXlYHqYWtYjlynMiYjhcwyjTngV8h_gqdGsZCG',
    imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwYUQd_6035-uC6NX4_saHezegX8IvrxP-DTFnuOUyPNDrOhQZRnOmkHmO_hildgcpNxo1tZ1OUBAQVDfRMEofBJrf_7_bSBrC44_nKBDYIU01QJdfLlbLYqFEzP57Q3nXZudUpCqCu_p5CBL0-vOWz3YK8hY-U15QkZeuydWcImSq-_sA_f06_dHyyUllGwb_Xyh29ghYlkYqW-bRmA5pvH07fF30feRKTIBWTivs',
    altMerchant: 'Gelas besar es teh melati segar dengan butiran es batu kristal jernih',
    altCatalog: 'Gelas cup jumbo 22oz Es Teh Manis dingin segar',
    icon: 'local_cafe',
  },
  {
    id: 'item-6',
    name: 'Es Jeruk Peras Asli',
    description: 'Jeruk peras Pontianak asli diperas segar seketika tanpa pemanis buatan',
    price: 7000,
    category: 'minuman',
    status: 'ready',
    lastUpdated: '8 Oktober 2026',
    imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcxolsptNDJ1HrmzaHxkur72kp7vLCMrtipABWOvsGVRQ7JB7J_PZJGirwNbcPkxmUUSCOgLCAqTNPd3KnBAhLhrroGzNNWreBEtAX0lwrRmO2v9uRFVZWGOdi5TSM3Zad3xYzRgcKB3Vo_DF7jsEMLfzExLXNUoSWdPGWIU_T19V22wq0D8Ap1Bv7E2prNsiuuh1viGmHv1y6UBV_iwdnJDGrsqXjW3n3yA5nkWJP',
    imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDGdZghvyLLZgfJr6cDz-AsJJ1p8G3KuiswjCO3SZXjB6L36E9kwIeO8Gm98uHMA6Qr_jrpGw6bdgaXiHmnnctzVC3cof7H8DGL8Dst_QkGxzX2e5PxQBv--B1QNLGN0HiPKW2KtMCrcqO9Bn3ObVzn4Gy1GoI6trRCtUIDg0OFbg99stAu3jplU9DFJYZrAiBFlYPxwnCamdedVz3xy96AXG-O8FjSPQm2HzhjtMvb',
    altMerchant: 'Segelas es jeruk peras murni warna oranye segar dengan irisan jeruk nipis',
    altCatalog: 'Segelas Es Jeruk Peras Murni kuning cerah berkilau',
    icon: 'local_cafe',
  },
  {
    id: 'item-7',
    name: 'Telur Dadar Crispy & Gorengan',
    description: 'Telur dadar krispi bersarang / tempe mendoan hangat pendamping makan.',
    price: 4000,
    category: 'snack',
    status: 'ready',
    lastUpdated: '8 Oktober 2026',
    imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4KN-sy1xRHIj7X9GGPRx6zhpo-fFDA4UwEZzGOgPcbiIeuHGtqZxPlAb6F774DTMbO3MyhTs9j0yoSmO_v-RUI7qjreZlElLMuq0M6sYP-cFqWwKi61bi-0TyYk64bOqHIYh7SOOVhrS1dq4ikA32s5A-TZ1dbN7W4XLxBnds0cKJQYVamp-bgBSL_v4K8yjn4ndSJg-sbi48jQpXq8UNC2jSnEUHHiv93ft6C-bi',
    imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4KN-sy1xRHIj7X9GGPRx6zhpo-fFDA4UwEZzGOgPcbiIeuHGtqZxPlAb6F774DTMbO3MyhTs9j0yoSmO_v-RUI7qjreZlElLMuq0M6sYP-cFqWwKi61bi-0TyYk64bOqHIYh7SOOVhrS1dq4ikA32s5A-TZ1dbN7W4XLxBnds0cKJQYVamp-bgBSL_v4K8yjn4ndSJg-sbi48jQpXq8UNC2jSnEUHHiv93ft6C-bi',
    altMerchant: 'Telur Dadar Crispy Padang tebal bersarang renyah warna cokelat keemasan',
    altCatalog: 'Telur Dadar Crispy Padang tebal bersarang renyah',
    icon: 'bakery_dining',
  },
];

export const INITIAL_STALLS: Stall[] = [
  {
    id: 'stan-bu-sari',
    name: 'Kantin Bu Sari',
    code: 'Stan A-01',
    mapPinCode: 'Kantin A',
    building: 'Gedung A',
    distanceMeters: 85,
    locationDetail: 'Gedung A Lt. 1 (Sayap Kiri Pujasera)',
    fullLocation: 'Gedung A Lantai 1 (Pujasera, Dekat Lift Timur)',
    walkingGuide:
      'Dari Lobi Utama Gedung A, berjalan lurus ±85 meter menuju lorong timur melewati Perpustakaan IBI KKG. Belok kanan di samping Lift Mahasiswa Timur. Kantin Bu Sari berada tepat di depan area meja makan bundar.',
    specialty: 'Spesialis Masakan Rumahan & Ayam Geprek',
    description:
      'Melayani mahasiswa dan dosen IBI KKG sejak 2018 dengan menu ayam geprek sambal bawang ulek dadakan, nasi goreng, dan minuman segar harga mahasiswa.',
    daysOpen: 'Senin–Jumat',
    hours: '07.00–20.00',
    rating: 4.7,
    reviewCount: 128,
    visitorsCount: 246,
    isOpen: true,
    lastUpdatedDate: '8 Oktober 2026',
    lastUpdatedTime: '08:30 WIB',
    verifiedAt: '8 Oktober 2026 • 08:30 WIB',
    bannerImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDV4ZsPa-9ofbCo7Y8JNWftZTjMhSlwaeS-Np58KVwB8qxACpcC5bnZotbd5yCQ6JPQBVnjAk-8yrDdJy622A1MRrePJrJLzv17BZc3DqxeBChRDBrFN1Zu6nJMeiMCMLPI-0lh5rYMJ_322KnGt3BcFqK2iHuinFM8zdDpo6zU-1TLbzLtcKe87MyR5XwG4AANx8x_guT4CCdzK7eNA0Ru9oJ7jx8nJwLdj8uoAeco',
    heroImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC6J2Q41BwGHK_uWwW8Vw41DBqvGrWJbenCkCvFi9MepJyHAlwnBzYJYQYUxTxewGCOTVGjQ1MX5OwSFIhehU6lU9qV7d9JqJb1PAEfNwVhdNYXPgtxoGkTqRqtwHcDFvTkgfaZD0NNr3SZxlRXvPXFYnhXXgcmolsJnTpmdwSpQ5N0iidGAA3ZbK56DmItE1FT0tMROLCY_f7GfZnHdOgh2qHlWT8EsskvsPhFhSsC',
    bannerAlt: 'Kantin Bu Sari di kampus IBI Kwik Kian Gie dengan etalase ayam geprek dan nasi goreng hangat',
    whatsapp: '6281290001980',
    paymentMethods: ['QRIS tersedia (Semua Bank & E-Wallet)', 'Tunai di Kasir'],
    menuItems: INITIAL_BU_SARI_MENU,
    reviews: [
      {
        id: 'rev-1',
        studentName: 'Kevin Wijaya',
        majorAndYear: 'Sistem Informasi 2024',
        rating: 5,
        date: '8 Oktober 2026',
        comment:
          'Harga di web KantinKu sama persis waktu bayar pakai QRIS di stan. Ayam gepreknya selalu hangat pas jam istirahat siang!',
        reply: 'Terima kasih Kak Kevin! Ditunggu kedatangannya lagi di jam istirahat kuliah ya.',
      },
      {
        id: 'rev-2',
        studentName: 'Nadia Putri',
        majorAndYear: 'Akuntansi 2023',
        rating: 5,
        date: '7 Oktober 2026',
        comment:
          'Sangat terbantu karena status Nasi Ayam Sambal Matah yang habis langsung diupdate Bu Sari di web, jadi tidak perlu antre jauh-jauh.',
      },
      {
        id: 'rev-3',
        studentName: 'Rizky Pratama',
        majorAndYear: 'Manajemen 2025',
        rating: 4,
        date: '5 Oktober 2026',
        comment:
          'Porsi nasi goreng spesialnya mengenyangkan buat modal kuliah siang sampai sore, harga Rp12.000 ramah banget di kantong.',
      },
    ],
  },
  {
    id: 'stan-mas-budi',
    name: 'Dapur Mas Budi (Mie & Soto)',
    code: 'Stan A-04',
    mapPinCode: 'Kantin B',
    building: 'Gedung A',
    distanceMeters: 180,
    locationDetail: 'Gedung A Lt. 1 Stan 04 (Depan Jalur Tangga)',
    fullLocation: 'Gedung A Lantai 1 (Depan Jalur Tangga Utama)',
    walkingGuide:
      'Terletak sekitar 180 meter dari gerbang depan Gedung A, tepat di bawah tangga utama menuju lantai 2.',
    specialty: 'Spesialis Mie Ayam Bakso & Soto Lamongan',
    description:
      'Menyajikan hidangan berkuah hangat, mie ayam racikan sendiri, dan soto ayam Lamongan koya gurih.',
    daysOpen: 'Senin–Jumat',
    hours: '07.30–18.00',
    rating: 4.8,
    reviewCount: 94,
    visitorsCount: 198,
    isOpen: true,
    lastUpdatedDate: '8 Oktober 2026',
    lastUpdatedTime: '07:45 WIB',
    verifiedAt: '8 Oktober 2026 • 07:45 WIB',
    bannerImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWlCrzL-F3nQn1FPQwU6A4hKT1zQHOfXSD9Q0N3105cSdFHPG6qY-0H1XgEsTSXhJd6GXMB-3c6QvrJwqcxPRXW_cDD7WAeRSajFh0Z0kmoyLevemadYQdgaWua8PZGV9bMjfrMLBKxVRwHC1CpGfCkC8r_q94BZkVRtogVilHIgZMi0Jitcm0DgLoHCUbuyq8ZV9pYGIrG7pg-3Re2v78JK-u6g21H-WD4Zk4hoc8',
    heroImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWlCrzL-F3nQn1FPQwU6A4hKT1zQHOfXSD9Q0N3105cSdFHPG6qY-0H1XgEsTSXhJd6GXMB-3c6QvrJwqcxPRXW_cDD7WAeRSajFh0Z0kmoyLevemadYQdgaWua8PZGV9bMjfrMLBKxVRwHC1CpGfCkC8r_q94BZkVRtogVilHIgZMi0Jitcm0DgLoHCUbuyq8ZV9pYGIrG7pg-3Re2v78JK-u6g21H-WD4Zk4hoc8',
    bannerAlt: 'Dapur Mas Budi di kantin kampus IBI KKG dengan kuah soto ayam hangat dan mie ayam bakso',
    whatsapp: '6281280002211',
    paymentMethods: ['QRIS tersedia', 'Tunai'],
    menuItems: [
      {
        id: 'budi-1',
        name: 'Mie Ayam Bakso Komplit',
        description: 'Mie keriting kenyal, ayam cincang jamur, 2 bakso urat sapi, pangsit rebus.',
        price: 13000,
        category: 'makanan',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxWM-4iIfV_-XmePUALzxcsmQF1JkP9yzQDU7XmgsZkeWwroGPdxtwvlUu85GRa97j6cnnQgUgsSm1NHTWF2H2axsLoOQ3nQ-0gHQVtapSQRXZlBa31tBxyEhPI8k2atM50LiSqfhMKReD_y0XQEecUhMU4_UoPIc_Q45GCJb9F2N2DexhikVaUxuca16m7DGXoO0yKduhrm4-8OasKnL_0J1b6JLfELPfUi5JCIeg',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClG5VdjIoR8LwnzW5-CNJR0S8OdL9_dtV5alBorYEflyaY-sXnx317TevIzp5AiFie-ps_i4iAopzqqgmRJ8TMHY7IfipeA74c69F83srSyditZSY5VoFr4ZSKzvB995kup5GMFx8ujHNKoi9ISo53dmzNRMOnFMtH4ZQlwoz_mzlWRkQk2W7OH6Q34kzxaTTpJrVk6JtO4KimphqPh8Zw3kxhBlHYeHDRUPX2iKb4',
        altCatalog: 'Semangkuk Mie Ayam Bakso Komplit',
        altMerchant: 'Semangkuk Mie Ayam Bakso Komplit',
        icon: 'ramen_dining',
      },
      {
        id: 'budi-2',
        name: 'Soto Ayam Lamongan + Nasi',
        description: 'Kuah kuning rempah koya gurih, suwiran ayam kampung, bihun, telur rebus.',
        price: 14000,
        category: 'makanan',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWlCrzL-F3nQn1FPQwU6A4hKT1zQHOfXSD9Q0N3105cSdFHPG6qY-0H1XgEsTSXhJd6GXMB-3c6QvrJwqcxPRXW_cDD7WAeRSajFh0Z0kmoyLevemadYQdgaWua8PZGV9bMjfrMLBKxVRwHC1CpGfCkC8r_q94BZkVRtogVilHIgZMi0Jitcm0DgLoHCUbuyq8ZV9pYGIrG7pg-3Re2v78JK-u6g21H-WD4Zk4hoc8',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDWlCrzL-F3nQn1FPQwU6A4hKT1zQHOfXSD9Q0N3105cSdFHPG6qY-0H1XgEsTSXhJd6GXMB-3c6QvrJwqcxPRXW_cDD7WAeRSajFh0Z0kmoyLevemadYQdgaWua8PZGV9bMjfrMLBKxVRwHC1CpGfCkC8r_q94BZkVRtogVilHIgZMi0Jitcm0DgLoHCUbuyq8ZV9pYGIrG7pg-3Re2v78JK-u6g21H-WD4Zk4hoc8',
        altCatalog: 'Soto Ayam Lamongan kuah kuning hangat',
        altMerchant: 'Soto Ayam Lamongan kuah kuning hangat',
        icon: 'soup_kitchen',
      },
      {
        id: 'budi-3',
        name: 'Pangsit Goreng Isi 5 (Snack)',
        description: 'Pangsit goreng renyah isi ayam cincang dengan saus asam manis.',
        price: 7000,
        category: 'snack',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4KN-sy1xRHIj7X9GGPRx6zhpo-fFDA4UwEZzGOgPcbiIeuHGtqZxPlAb6F774DTMbO3MyhTs9j0yoSmO_v-RUI7qjreZlElLMuq0M6sYP-cFqWwKi61bi-0TyYk64bOqHIYh7SOOVhrS1dq4ikA32s5A-TZ1dbN7W4XLxBnds0cKJQYVamp-bgBSL_v4K8yjn4ndSJg-sbi48jQpXq8UNC2jSnEUHHiv93ft6C-bi',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4KN-sy1xRHIj7X9GGPRx6zhpo-fFDA4UwEZzGOgPcbiIeuHGtqZxPlAb6F774DTMbO3MyhTs9j0yoSmO_v-RUI7qjreZlElLMuq0M6sYP-cFqWwKi61bi-0TyYk64bOqHIYh7SOOVhrS1dq4ikA32s5A-TZ1dbN7W4XLxBnds0cKJQYVamp-bgBSL_v4K8yjn4ndSJg-sbi48jQpXq8UNC2jSnEUHHiv93ft6C-bi',
        altCatalog: 'Pangsit Goreng Isi 5',
        altMerchant: 'Pangsit Goreng Isi 5',
        icon: 'bakery_dining',
      },
      {
        id: 'budi-4',
        name: 'Es Teh Manis Kampus',
        description: 'Teh melati segar dingin gelas besar.',
        price: 4000,
        category: 'minuman',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwYUQd_6035-uC6NX4_saHezegX8IvrxP-DTFnuOUyPNDrOhQZRnOmkHmO_hildgcpNxo1tZ1OUBAQVDfRMEofBJrf_7_bSBrC44_nKBDYIU01QJdfLlbLYqFEzP57Q3nXZudUpCqCu_p5CBL0-vOWz3YK8hY-U15QkZeuydWcImSq-_sA_f06_dHyyUllGwb_Xyh29ghYlkYqW-bRmA5pvH07fF30feRKTIBWTivs',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDAkgGtl4GxdpXZClh6ucObJmh53ySgoa63hdrPLpmweSYkhopHLuKCQ6bxbwjc7-xLIsFz_d3vlCGwwmVAM7pDM2cspI-IkryEisRwq1YHqfkb8WmA0x0hnjF6zRnTGsCfYC4jumTJ7nvwPqbfWw-6Z1unHb3CyvT3N-e3zhy98XRbZLc2uErClYaC8bI4YxfujCmXlYHqYWtYjlynMiYjhcwyjTngV8h_gqdGsZCG',
        altCatalog: 'Es Teh Manis dingin',
        altMerchant: 'Es Teh Manis dingin',
        icon: 'local_cafe',
      },
    ],
    reviews: [
      {
        id: 'rev-b1',
        studentName: 'Bagas Saputra',
        majorAndYear: 'Ilmu Komunikasi 2024',
        rating: 5,
        date: '8 Oktober 2026',
        comment: 'Kuah sotonya segar dan porsi mienya pas. Harga jelas Rp13.000 tidak berubah-ubah.',
      },
    ],
  },
  {
    id: 'stan-berkah-barokah',
    name: 'Kantin Berkah Barokah',
    code: 'Stan B-01',
    mapPinCode: 'Kantin C',
    building: 'Gedung B',
    distanceMeters: 340,
    locationDetail: 'Gedung B Lt. Dasar samping parkiran',
    fullLocation: 'Gedung B Lantai Dasar (Samping Parkiran Motor Mahasiswa)',
    walkingGuide:
      'Berjarak sekitar 340 meter dari Gedung A melalui selasar penghubung menuju Gedung B Lantai Dasar di dekat area parkir motor.',
    specialty: 'Nasi Rames Hemat & Aneka Gorengan Hangat',
    description:
      'Pilihan paling hemat untuk mahasiswa dengan paket nasi rames sayur lengkap di bawah Rp10.000 dan gorengan hangat.',
    daysOpen: 'Senin–Sabtu',
    hours: '06.30–17.30',
    rating: 4.6,
    reviewCount: 112,
    visitorsCount: 310,
    isOpen: true,
    lastUpdatedDate: '8 Oktober 2026',
    lastUpdatedTime: '07:15 WIB',
    verifiedAt: '8 Oktober 2026 • 07:15 WIB',
    bannerImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZN31YUkFNurz9q7IUEBRbteRp4PFsCn6Ygf6MWr4ekX3wYZt2sQqLCgt1lVVMNhA_pd-hIdnOxzc1r038vN2bDnwJujp8f6iWXiLLt1HghPmsIz6tWazrb0DB9jsH46MxhUbOju8DvKF6bGCY_MGvgo2VYl2KTXe6lqrLFfNytfx87sRsNdoDsb3BWS9xkalatGKUhNBxqIk-kgVi4UBv2o0VuWldY7PfUHfIogic',
    heroImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAZN31YUkFNurz9q7IUEBRbteRp4PFsCn6Ygf6MWr4ekX3wYZt2sQqLCgt1lVVMNhA_pd-hIdnOxzc1r038vN2bDnwJujp8f6iWXiLLt1HghPmsIz6tWazrb0DB9jsH46MxhUbOju8DvKF6bGCY_MGvgo2VYl2KTXe6lqrLFfNytfx87sRsNdoDsb3BWS9xkalatGKUhNBxqIk-kgVi4UBv2o0VuWldY7PfUHfIogic',
    bannerAlt: 'Kantin Berkah Barokah di Gedung B kampus IBI KKG',
    whatsapp: '6281299887766',
    paymentMethods: ['QRIS tersedia', 'Tunai'],
    menuItems: [
      {
        id: 'berkah-1',
        name: 'Nasi Rames Sayur + Telur Balado',
        description: 'Nasi putih hangat, tumis buncis tempe orek, telur balado utuh, sambal terasi.',
        price: 10000,
        category: 'makanan',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKRZAZhZgUABT21KQQyMihdBy_RG7SjtzahxVvkVUe57WKeshzusCRnnMBqyja36FxAU23sdLyzKXXHBJwc01syJgxv607G4cinlHC5PC9n2UAHfyLtGJOuvlzsDABN1uM888XvesFCvGVqarTpbyGY68Hq8DfrjmXLvtp9SPAr4Pb0aCeYqswDWNqpSFOTQqD8_51cg-6NfYw6CZ0YQQLzfYFIeJlKcgTj3jH3QXt',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKRZAZhZgUABT21KQQyMihdBy_RG7SjtzahxVvkVUe57WKeshzusCRnnMBqyja36FxAU23sdLyzKXXHBJwc01syJgxv607G4cinlHC5PC9n2UAHfyLtGJOuvlzsDABN1uM888XvesFCvGVqarTpbyGY68Hq8DfrjmXLvtp9SPAr4Pb0aCeYqswDWNqpSFOTQqD8_51cg-6NfYw6CZ0YQQLzfYFIeJlKcgTj3jH3QXt',
        altCatalog: 'Nasi Rames Sayur + Telur Balado',
        altMerchant: 'Nasi Rames Sayur + Telur Balado',
        icon: 'bento',
      },
      {
        id: 'berkah-2',
        name: 'Paket Gorengan Tempe & Bakwan (3 pcs)',
        description: 'Tempe mendoan garing dan bakwan sayur kol wortel hangat baru angkat.',
        price: 5000,
        category: 'snack',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4KN-sy1xRHIj7X9GGPRx6zhpo-fFDA4UwEZzGOgPcbiIeuHGtqZxPlAb6F774DTMbO3MyhTs9j0yoSmO_v-RUI7qjreZlElLMuq0M6sYP-cFqWwKi61bi-0TyYk64bOqHIYh7SOOVhrS1dq4ikA32s5A-TZ1dbN7W4XLxBnds0cKJQYVamp-bgBSL_v4K8yjn4ndSJg-sbi48jQpXq8UNC2jSnEUHHiv93ft6C-bi',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB4KN-sy1xRHIj7X9GGPRx6zhpo-fFDA4UwEZzGOgPcbiIeuHGtqZxPlAb6F774DTMbO3MyhTs9j0yoSmO_v-RUI7qjreZlElLMuq0M6sYP-cFqWwKi61bi-0TyYk64bOqHIYh7SOOVhrS1dq4ikA32s5A-TZ1dbN7W4XLxBnds0cKJQYVamp-bgBSL_v4K8yjn4ndSJg-sbi48jQpXq8UNC2jSnEUHHiv93ft6C-bi',
        altCatalog: 'Gorengan Tempe dan Bakwan',
        altMerchant: 'Gorengan Tempe dan Bakwan',
        icon: 'bakery_dining',
      },
      {
        id: 'berkah-3',
        name: 'Es Jeruk Peras',
        description: 'Es jeruk segar gelas reguler.',
        price: 5000,
        category: 'minuman',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDGdZghvyLLZgfJr6cDz-AsJJ1p8G3KuiswjCO3SZXjB6L36E9kwIeO8Gm98uHMA6Qr_jrpGw6bdgaXiHmnnctzVC3cof7H8DGL8Dst_QkGxzX2e5PxQBv--B1QNLGN0HiPKW2KtMCrcqO9Bn3ObVzn4Gy1GoI6trRCtUIDg0OFbg99stAu3jplU9DFJYZrAiBFlYPxwnCamdedVz3xy96AXG-O8FjSPQm2HzhjtMvb',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCcxolsptNDJ1HrmzaHxkur72kp7vLCMrtipABWOvsGVRQ7JB7J_PZJGirwNbcPkxmUUSCOgLCAqTNPd3KnBAhLhrroGzNNWreBEtAX0lwrRmO2v9uRFVZWGOdi5TSM3Zad3xYzRgcKB3Vo_DF7jsEMLfzExLXNUoSWdPGWIU_T19V22wq0D8Ap1Bv7E2prNsiuuh1viGmHv1y6UBV_iwdnJDGrsqXjW3n3yA5nkWJP',
        altCatalog: 'Es Jeruk Peras',
        altMerchant: 'Es Jeruk Peras',
        icon: 'local_cafe',
      },
    ],
    reviews: [
      {
        id: 'rev-c1',
        studentName: 'Aldo Phiong',
        majorAndYear: 'Informatika 2024',
        rating: 5,
        date: '8 Oktober 2026',
        comment: 'Nasi rames Rp10.000 paling penyelamat di akhir bulan. Lokasi dekat parkiran motor Gedung B.',
      },
    ],
  },
  {
    id: 'stan-kopi-roti',
    name: 'Kedai Kopi & Toast Mahasiswa',
    code: 'Stan B-03',
    mapPinCode: 'Kantin D',
    building: 'Gedung B',
    distanceMeters: 420,
    locationDetail: 'Gedung B Dasar, Stan B-03 (Saung Terbuka)',
    fullLocation: 'Gedung B Lantai Dasar, Area Saung Terbuka Stan B-03',
    walkingGuide:
      'Berjarak ±420 meter dari Lobi Utama Gedung A, berada di area Saung Terbuka Gedung B dekat ruang tunggu mahasiswa.',
    specialty: 'Kopi Susu Gula Aren & Roti Bakar Toast',
    description:
      'Tempat singgah favorit saat jeda kelas untuk membeli es kopi susu gula aren, matcha, dan roti bakar hangat.',
    daysOpen: 'Senin–Jumat',
    hours: '08.00–19.00',
    rating: 4.9,
    reviewCount: 76,
    visitorsCount: 164,
    isOpen: true,
    lastUpdatedDate: '8 Oktober 2026',
    lastUpdatedTime: '09:00 WIB',
    verifiedAt: '8 Oktober 2026 • 09:00 WIB',
    bannerImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
    heroImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
    bannerAlt: 'Kedai Kopi & Toast Mahasiswa di kampus IBI KKG',
    whatsapp: '6281277665544',
    paymentMethods: ['QRIS tersedia (Bank DKI & Semua E-Wallet)', 'Tunai'],
    menuItems: [
      {
        id: 'kopi-1',
        name: 'Es Kopi Susu Aren IBI KKG',
        description: 'Espresso kopi nusantara + susu segar + gula aren asli.',
        price: 12000,
        category: 'minuman',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
        altCatalog: 'Es Kopi Susu Aren IBI KKG',
        altMerchant: 'Es Kopi Susu Aren IBI KKG',
        icon: 'local_cafe',
      },
      {
        id: 'kopi-2',
        name: 'Roti Bakar Cokelat Keju',
        description: 'Roti bakar tebal dengan olesan mentega, meses cokelat, dan keju parut.',
        price: 12000,
        category: 'snack',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
        altCatalog: 'Roti Bakar Cokelat Keju',
        altMerchant: 'Roti Bakar Cokelat Keju',
        icon: 'bakery_dining',
      },
      {
        id: 'kopi-3',
        name: 'Toast Sosis Telur Panggang',
        description: 'Roti panggang gurih isi telur dadar, sosis sapi, selada, dan saus keju.',
        price: 15000,
        category: 'snack',
        status: 'ready',
        lastUpdated: '8 Oktober 2026',
        imageCatalog: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
        imageMerchant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
        altCatalog: 'Toast Sosis Telur Panggang',
        altMerchant: 'Toast Sosis Telur Panggang',
        icon: 'lunch_dining',
      },
    ],
    reviews: [
      {
        id: 'rev-d1',
        studentName: 'Clarissa Tan',
        majorAndYear: 'Bisnis Digital 2025',
        rating: 5,
        date: '8 Oktober 2026',
        comment: 'Toast sosis telurnya enak buat ganjal perut sebelum masuk kelas jam 1 siang!',
      },
    ],
  },
];

export const INITIAL_VERIFICATIONS: VerificationRequest[] = [
  {
    id: 'card-stan-1',
    sellerAccountId: 'seller-bu-nanik',
    badgeText: 'Pengajuan Baru',
    badgeType: 'new',
    name: 'Warung Nasi Uduk Bu Nanik',
    location: 'Selasar Gedung A Lt. 2 (Depan Lab Komputer)',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKRZAZhZgUABT21KQQyMihdBy_RG7SjtzahxVvkVUe57WKeshzusCRnnMBqyja36FxAU23sdLyzKXXHBJwc01syJgxv607G4cinlHC5PC9n2UAHfyLtGJOuvlzsDABN1uM888XvesFCvGVqarTpbyGY68Hq8DfrjmXLvtp9SPAr4Pb0aCeYqswDWNqpSFOTQqD8_51cg-6NfYw6CZ0YQQLzfYFIeJlKcgTj3jH3QXt',
    alt: 'Warm authentic Indonesian food stall display with traditional banana leaf nasi uduk and savory chicken dishes at a clean college cafeteria in Jakarta.',
    approved: false,
    details: [
      { label: 'Penanggung Jawab:', value: 'Nanik Rahayu (Mitra Eksternal)' },
      { label: 'Kontak WhatsApp:', value: '+62 812-8899-2211', isWhatsapp: true, whatsappUrl: 'https://wa.me/6281288992211' },
      { label: 'Kategori Menu:', value: 'Makanan Berat Tradisional & Gorengan' },
      { label: 'Jam Operasional:', value: 'Senin - Jumat (07:00 - 16:30 WIB)' },
    ],
    secondaryActionText: 'Tolak / Revisi',
    secondaryActionType: 'revisi',
    primaryActionText: 'Setujui & Terbitkan',
  },
  {
    id: 'card-stan-2',
    badgeText: 'Pembaruan Menu & QRIS',
    badgeType: 'update',
    name: 'Kopi Kenangan Mahasiswa & Roti',
    location: 'Gedung B Dasar, Stan B-03',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSSyE2IWiPyYSe0nTD5FxC6l3iWwYu4WfIUqmmKqW45KV1ZrLHOIEHhEvJkRZgKfnrS5sEErb8ZFKMLBL0tHJupooW5Lq6dXXrbtFYZ9zFDtydsaJZCpuXlUkxgJfeSIz6v24A_6ixa6jnWrwdQ-owK8XRSeTIpCndbj1rFQko_Uii0En-YGdlzIKt74tXAOLgugf90QyH6het7dK5olAYc06YD01qasqHRXu8U7vO',
    alt: 'Modern barista espresso coffee stall on a university campus interior with artisan bakery and toast bread displays.',
    approved: false,
    details: [
      { label: 'Perubahan Diajukan:', value: '6 Menu Baru (Kopi Susu Aren, Toast)' },
      { label: 'Status QRIS Statis:', value: 'NMID Terverifikasi Bank DKI', isBadge: true },
      { label: 'Patuhi Rentang Harga:', value: 'Sesuai SOP (Rp 8.000 - Rp 18.000)', isHighlight: true },
    ],
    secondaryActionText: 'Cek Rincian',
    secondaryActionType: 'modal',
    primaryActionText: 'Verifikasi Perubahan',
  },
];

export const RECEIPT_PROOF_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCPz0-Py7HEeBYGyr3yOfdWxbWM0CKe_NfFK4hC6rT1qJxqdUKJGEKNCZ6bV9JNlgi6J_iLcWhj-JdJxN7YRaUZdkIGp-kt-PRUBu9q_vqvlxRFGjBJr0s-m7g715_a_Mz0f8TmzN_wluiJZibpVOAEtXE9rmgRgRVpNdR6NJKqzxS0Z9PxN8hm9XfbvxXfkxyhkAlKnoLZ3xIiwxtN2ta0icZy0EhdH5Mxn8AJNRJi';
