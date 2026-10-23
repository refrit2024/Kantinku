import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  CUSTOM_DOMAIN_STORAGE_KEY,
  getPublicStallUrl,
  isAiStudioPreviewHost,
  Stall,
} from '../data/kantinData';

interface StallQrModalProps {
  stall: Stall;
  allStalls?: Stall[];
  onClose: () => void;
  onSimulateScan?: (stallId: string) => void;
  onShowToast?: (message: string) => void;
}

export const StallQrModal: React.FC<StallQrModalProps> = ({
  stall: initialStall,
  allStalls,
  onClose,
  onShowToast,
}) => {
  const [selectedStallId, setSelectedStallId] = useState(initialStall.id);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [customDomain] = useState<string>(() => {
    try {
      return localStorage.getItem(CUSTOM_DOMAIN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const activeStall =
    allStalls?.find((s) => s.id === selectedStallId) || initialStall;

  const directStallUrl = getPublicStallUrl(activeStall.id, customDomain);

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(directStallUrl, {
      width: 520,
      margin: 2,
      color: {
        dark: '#131B2E',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (isMounted) setQrDataUrl('');
      });

    return () => {
      isMounted = false;
    };
  }, [directStallUrl]);

  // 8 Golden Rules: Universal Usability & Internal Locus of Control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownloadPosterPng = () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const qrImg = new Image();
    qrImg.onload = () => {
      // Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Top Header Banner (KantinKu Primary Terracotta #9B2F00)
      ctx.fillStyle = '#9B2F00';
      ctx.fillRect(0, 0, canvas.width, 210);

      // Campus & App Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KANTINKU IBI KKG', canvas.width / 2, 95);

      ctx.font = '600 24px sans-serif';
      ctx.fillStyle = '#FFDBD0';
      ctx.fillText(
        'Area Kantin Dekat Hall D • Kampus IBI KKG Sunter',
        canvas.width / 2,
        145
      );

      // Stall Code Pill
      ctx.fillStyle = '#FFDBD0';
      ctx.fillRect(280, 250, 340, 54);
      ctx.fillStyle = '#390C00';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(
        `${activeStall.code.toUpperCase()} • MITRA RESMI`,
        canvas.width / 2,
        286
      );

      // Stall Name
      ctx.fillStyle = '#131B2E';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText(activeStall.name, canvas.width / 2, 365);

      // Specialty
      ctx.fillStyle = '#59413A';
      ctx.font = '26px sans-serif';
      ctx.fillText(activeStall.specialty, canvas.width / 2, 410);

      // QR Frame Box
      ctx.strokeStyle = '#9B2F00';
      ctx.lineWidth = 6;
      ctx.strokeRect(210, 450, 480, 480);
      ctx.drawImage(qrImg, 225, 465, 450, 450);

      // Scan Call to Action
      ctx.fillStyle = '#9B2F00';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText(
        'SCAN UNTUK CEK HARGA & PESAN MENU',
        canvas.width / 2,
        995
      );

      ctx.fillStyle = '#006C4E';
      ctx.font = 'bold 25px sans-serif';
      ctx.fillText(
        '✓ Tanpa Login   ✓ Tanpa Antre   ✓ Bayar QRIS / DANA / Tunai',
        canvas.width / 2,
        1045
      );

      // Operational & Price Guarantee Footer
      ctx.fillStyle = '#F2F3FF';
      ctx.fillRect(60, 1090, 780, 130);
      ctx.fillStyle = '#131B2E';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(
        `Jam Buka: ${activeStall.daysOpen} (${activeStall.hours} WIB)`,
        canvas.width / 2,
        1140
      );
      ctx.fillStyle = '#59413A';
      ctx.font = '20px sans-serif';
      ctx.fillText(
        'Harga dijamin 100% transparan sesuai daftar resmi kantin IBI KKG',
        canvas.width / 2,
        1182
      );

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Poster-QR-${activeStall.name.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
      onShowToast?.(
        `Poster QR Code "${activeStall.name}" berhasil diunduh (PNG siap cetak)!`
      );
    };
    qrImg.src = qrDataUrl;
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qrPosterModalTitle"
    >
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[22px]">qr_code_2</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h3
                id="qrPosterModalTitle"
                className="text-base font-black text-slate-900 truncate"
              >
                Poster QR Code Stan
              </h3>
              <span className="text-xs text-slate-500 truncate">
                Tempel di meja stan agar mahasiswa langsung scan ke menu
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Modal QR"
            className="w-8 h-8 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer shrink-0 transition-colors border border-slate-300/80"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          {allStalls && allStalls.length > 1 && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <label
                htmlFor="selectQrStall"
                className="text-xs font-bold text-slate-700"
              >
                Pilih Stan Kantin untuk Dicetak:
              </label>
              <select
                id="selectQrStall"
                value={activeStall.id}
                onChange={(e) => setSelectedStallId(e.target.value)}
                className="h-11 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {allStalls.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Printable Poster Card Preview */}
          <div className="shrink-0 rounded-xl border-2 border-emerald-500/40 bg-white text-slate-900 shadow-sm flex flex-col items-center text-center overflow-hidden">
            {/* Poster Top Banner */}
            <div className="w-full bg-emerald-600 text-white px-4 py-3.5 flex flex-col items-center gap-0.5 shrink-0">
              <div className="flex items-center gap-1.5 text-sm font-black tracking-wide uppercase">
                <span className="material-symbols-outlined text-[18px]">restaurant</span>
                <span>KANTINKU IBI KKG • DEKAT HALL D</span>
              </div>
              <span className="text-[11px] text-emerald-100 font-medium">
                Institut Bisnis dan Informatika Kwik Kian Gie (Kampus Sunter)
              </span>
            </div>

            {/* Poster Content */}
            <div className="p-4 sm:p-5 flex flex-col items-center gap-3 w-full shrink-0">
              <span className="px-3 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
                {activeStall.code} • Mitra Resmi Terverifikasi
              </span>

              <div className="flex flex-col gap-0.5">
                <h4 className="text-xl font-black text-slate-900">
                  {activeStall.name}
                </h4>
                <p className="text-xs text-slate-600">{activeStall.specialty}</p>
              </div>

              {/* QR Image Box */}
              <div className="p-3 rounded-lg bg-white border-2 border-emerald-600 shadow-xs flex flex-col items-center gap-1.5 shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code Menu ${activeStall.name}`}
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain block shrink-0"
                  />
                ) : (
                  <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center bg-slate-50 rounded-md shrink-0">
                    <span className="material-symbols-outlined text-[48px] text-emerald-600 animate-pulse">
                      qr_code_2
                    </span>
                  </div>
                )}
                <span className="text-[10px] font-mono text-slate-600 font-semibold">
                  SCAN KAMERA HP • {activeStall.code.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <span className="text-sm font-black text-emerald-700 uppercase tracking-tight">
                  Scan Kamera HP untuk Cek Harga &amp; Pesan
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-emerald-800">
                  <span>✓ Tanpa Login</span>
                  <span>•</span>
                  <span>✓ Harga Resmi Transparan</span>
                  <span>•</span>
                  <span>✓ Bayar QRIS / DANA / Tunai</span>
                </div>
              </div>

              <div className="w-full mt-1 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Jam Buka: <strong>{activeStall.hours} WIB</strong>
                </span>
                <span>
                  Update: <strong>{activeStall.lastUpdatedDate}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap sm:flex-nowrap items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">print</span>
            <span>Cetak Kertas</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPosterPng}
            className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Unduh Poster QR (PNG)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
