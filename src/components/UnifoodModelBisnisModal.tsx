import React from 'react';

interface UnifoodModelBisnisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnifoodModelBisnisModal: React.FC<UnifoodModelBisnisModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <span className="material-symbols-outlined text-[24px]">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Model Bisnis & Strategi Unifood
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-slate-950">
                  Formulasi Baru
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Penyempitan Lingkup (Hyper-Local Closed-Loop) & Pemberdayaan Ekonomi Mahasiswa
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup Modal"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* SECTION 1: Evaluasi & Solusi Positioning */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">tune</span>
              <span>1. Evaluasi & Solusi Penyesuaian Strategi (Positioning)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-bold text-rose-700 block">Tantangan Kompetitor:</span>
                <p className="text-slate-600 text-[11px]">
                  Banyak kompetitor besar (GoFood, GrabFood, ShopeeFood) dengan armada motor di jalan raya.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <strong className="text-emerald-800 block text-[11px]">Solusi Unifood:</strong>
                  <p className="text-slate-700 text-[11px] mt-0.5">
                    <strong>Hyper-Local Closed-Loop:</strong> Mengunci ekosistem hanya di dalam koridor & antar-lantai kampus untuk jeda 15-20 menit antar-kelas. Tanpa kurir jalan raya!
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-bold text-rose-700 block">Tantangan Model Bisnis:</span>
                <p className="text-slate-600 text-[11px]">
                  Model bisnis kurang jelas jika meniru sistem komisi tinggi 20%+ yang membebani tenan kantin.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <strong className="text-emerald-800 block text-[11px]">Solusi Unifood:</strong>
                  <p className="text-slate-700 text-[11px] mt-0.5">
                    <strong>B2B2C Mikro Berbasis Efisiensi:</strong> Biaya kenyamanan tetap datar (Rp 1.000) dan langganan kasir POS tenan yang sangat terjangkau (Rp 29rb - 49rb/bln).
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="font-bold text-rose-700 block">Tantangan Added Value:</span>
                <p className="text-slate-600 text-[11px]">
                  Nilai tambah belum kuat bila hanya sekadar alat memesan makanan biasa.
                </p>
                <div className="pt-2 border-t border-slate-200/80">
                  <strong className="text-emerald-800 block text-[11px]">Solusi Unifood:</strong>
                  <p className="text-slate-700 text-[11px] mt-0.5">
                    <strong>Pemberdayaan Ekonomi Mahasiswa:</strong> Wadah cari uang saku (Jastip antar-lantai Rp 2.500/order) dan etalase wirausaha mahasiswa (*Student Entrepreneur*).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Program Kreatif & Added Value */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-amber-600">star</span>
              <span>2. Program Kreatif & Fitur Added Value Khusus</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-700 text-[18px]">directions_run</span>
                  <strong className="text-emerald-950 font-bold">A. Titip-Antar Mahasiswa (P2P Jastip)</strong>
                </div>
                <p className="text-slate-700 text-[11px]">
                  Mahasiswa yang searah naik ke lantai atas membawa pesanan teman. Pembeli hemat waktu antre lift, kurir mahasiswa dapat tambahan uang saku (Rp 2.500/order) fleksibel di jam kosong.
                </p>
              </div>

              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-700 text-[18px]">calendar_today</span>
                  <strong className="text-blue-950 font-bold">B. Pre-Order Harian & Meal Prep</strong>
                </div>
                <p className="text-slate-700 text-[11px]">
                  Pemesanan pagi hari / H-1 sebelum perkuliahan. Tenan kantin mendapat kepastian kuota produksi (*zero food waste*), mahasiswa terhindar dari kehabisan menu di jam makan siang puncak.
                </p>
              </div>

              <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-700 text-[18px]">groups</span>
                  <strong className="text-purple-950 font-bold">C. Group Order & Split-Bill Otomatis</strong>
                </div>
                <p className="text-slate-700 text-[11px]">
                  Pemesanan gabungan kelompok belajar / organisasi kelas. Sistem langsung menghitung pembagian tagihan per individu secara otomatis tanpa repot kalkulator manual di grup WhatsApp.
                </p>
              </div>

              <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-700 text-[18px]">confirmation_number</span>
                  <strong className="text-amber-950 font-bold">D. Kemitraan HIMA/BEM & Kupon Digital</strong>
                </div>
                <p className="text-slate-700 text-[11px]">
                  Panitia acara / organisasi mahasiswa dapat mendistribusikan kupon konsumsi digital yang dapat ditukarkan di tenan kantin mitra melalui kode QR unik Unifood.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: 4 Pilar Skema Pendapatan (Reversed Business Model) */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-700">monetization_on</span>
              <span>3. Skema Pendapatan Bisnis (4 Pilar Monetisasi)</span>
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 text-[11px] uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Pilar Pendapatan</th>
                    <th className="p-2.5">Target Klien</th>
                    <th className="p-2.5">Besaran Tarif</th>
                    <th className="p-2.5">Nilai Tambah & Keunggulan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  <tr className="hover:bg-slate-50/60">
                    <td className="p-2.5 font-bold text-slate-900">1. Micro-Convenience Fee</td>
                    <td className="p-2.5 text-slate-600">B2C Mahasiswa</td>
                    <td className="p-2.5 font-bold text-emerald-700">Rp 1.000 / order</td>
                    <td className="p-2.5 text-slate-600">Tarif mikro flat untuk pre-order & kenyamanan bebas antre lift.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="p-2.5 font-bold text-slate-900">2. Jastip Platform Share</td>
                    <td className="p-2.5 text-slate-600">P2P Kurir Mahasiswa</td>
                    <td className="p-2.5 font-bold text-emerald-700">10% - 15% (Rp 300)</td>
                    <td className="p-2.5 text-slate-600">Potongan ringan dari ongkir Rp 2.500, Rp 2.200 bersih masuk dompet mahasiswa.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="p-2.5 font-bold text-slate-900">3. SaaS Tenan Kantin Pro</td>
                    <td className="p-2.5 text-slate-600">B2B Pedagang Kantin</td>
                    <td className="p-2.5 font-bold text-emerald-700">Rp 29rb - 49rb/bulan</td>
                    <td className="p-2.5 text-slate-600">Kasir digital POS, rekapitulasi stok harian, dan struk termal siap cetak.</td>
                  </tr>
                  <tr className="hover:bg-slate-50/60">
                    <td className="p-2.5 font-bold text-slate-900">4. Internal Ads / Student Booth</td>
                    <td className="p-2.5 text-slate-600">B2B Secondary (Wirausaha Mhs)</td>
                    <td className="p-2.5 font-bold text-emerald-700">Rp 10.000 / slot minggu</td>
                    <td className="p-2.5 text-slate-600">Slot banner promosi menu baru tenan atau produk titip-jual mahasiswa di koridor.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">
            Unifood &bull; Pilot Project Kampus Multi-Tower (IBIKKG, Binus, UBM)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
