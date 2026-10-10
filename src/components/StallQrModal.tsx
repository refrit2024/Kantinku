import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Stall } from '../data/kantinData';

interface StallQrModalProps {
  stall: Stall;
  allStalls?: Stall[];
  onClose: () => void;
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

  const activeStall =
    allStalls?.find((s) => s.id === selectedStallId) || initialStall;

  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`
      : 'https://kantinku.ibikkg.ac.id';
  const directStallUrl = `${baseUrl}/?stan=${encodeURIComponent(activeStall.id)}`;
  const displayCampusUrl = `kantinku.ibikkg.ac.id/?stan=${activeStall.id}`;

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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(directStallUrl);
      onShowToast?.(`Tautan langsung ke ${activeStall.name} berhasil disalin!`);
    } catch {
      onShowToast?.('Tautan siap dibagikan: ' + directStallUrl);
    }
  };

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
      className="fixed inset-0 z-50 bg-on-surface/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qrPosterModalTitle"
    >
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-surface-container-low border-b border-outline-variant/25 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h3
                id="qrPosterModalTitle"
                className="font-headline-sm text-base text-on-surface font-bold truncate"
              >
                Poster QR Code Etalase Stan
              </h3>
              <span className="font-body-sm text-xs text-on-surface-variant truncate">
                Tempel di gerobak/meja agar mahasiswa langsung scan ke menu stan ini
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Modal QR"
            className="w-9 h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Poster Preview Body */}
        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          {/* Optional Stall Switcher (When opened by Admin or Seller with multiple stalls) */}
          {allStalls && allStalls.length > 1 && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <label
                htmlFor="selectQrStall"
                className="font-label-sm text-xs text-on-surface-variant font-semibold"
              >
                Pilih Stan Kantin untuk Dicetak:
              </label>
              <select
                id="selectQrStall"
                value={activeStall.id}
                onChange={(e) => setSelectedStallId(e.target.value)}
                className="h-10 px-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-on-surface font-label-md text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
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
          <div className="shrink-0 rounded-2xl border-2 border-primary/30 bg-white text-slate-900 shadow-sm flex flex-col items-center text-center">
            {/* Poster Top Banner */}
            <div className="w-full rounded-t-[14px] bg-primary text-on-primary px-4 py-3.5 flex flex-col items-center gap-0.5 shrink-0">
              <div className="flex items-center gap-1.5 font-headline-sm text-sm font-bold tracking-wide uppercase">
                <span className="material-symbols-outlined text-[18px]">restaurant</span>
                <span>KANTINKU IBI KKG • DEKAT HALL D</span>
              </div>
              <span className="text-[11px] text-on-primary/85">
                Institut Bisnis dan Informatika Kwik Kian Gie (Kampus Sunter)
              </span>
            </div>

            {/* Poster Content */}
            <div className="p-4 sm:p-5 flex flex-col items-center gap-3 w-full shrink-0">
              <span className="px-3 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-[11px] font-bold uppercase tracking-wider">
                {activeStall.code} • Mitra Resmi Terverifikasi
              </span>

              <div className="flex flex-col gap-0.5">
                <h4 className="font-headline-md text-xl font-bold text-slate-900">
                  {activeStall.name}
                </h4>
                <p className="text-xs text-slate-600">{activeStall.specialty}</p>
              </div>

              {/* QR Image Box */}
              <div className="p-3 rounded-2xl bg-white border-2 border-primary shadow-xs flex flex-col items-center gap-1.5 shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code Menu ${activeStall.name}`}
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain block shrink-0"
                  />
                ) : (
                  <div className="w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center bg-slate-50 rounded-xl shrink-0">
                    <span className="material-symbols-outlined text-[48px] text-primary animate-pulse">
                      qr_code_2
                    </span>
                  </div>
                )}
                <span className="text-[10px] font-mono text-slate-600 font-semibold">
                  SCAN KAMERA HP • {activeStall.code.toUpperCase()}
                </span>
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <span className="font-label-lg text-sm font-bold text-primary uppercase tracking-tight">
                  📱 Scan Kamera HP untuk Cek Harga &amp; Pesan
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-secondary">
                  <span>✓ Tanpa Login</span>
                  <span>•</span>
                  <span>✓ Harga Resmi Transparan</span>
                  <span>•</span>
                  <span>✓ Bayar QRIS / DANA / Tunai</span>
                </div>
              </div>

              <div className="w-full mt-1 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Jam Buka: <strong>{activeStall.hours} WIB</strong>
                </span>
                <span>
                  Update: <strong>{activeStall.lastUpdatedDate}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Direct URL Preview & Copy */}
          <div className="shrink-0 p-3 rounded-xl bg-surface-container-low border border-outline-variant/25 flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-label-sm text-on-surface-variant uppercase">
                Tautan Menu Stan (Otomatis Mengikuti Domain Hosting):
              </span>
              <span className="font-mono text-xs text-primary font-semibold truncate">
                https://{displayCampusUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border border-outline-variant/30 font-label-sm text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">content_copy</span>
              <span>Salin Link</span>
            </button>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 bg-surface-container-low border-t border-outline-variant/25 flex flex-wrap sm:flex-nowrap items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border border-outline-variant/30 font-label-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">print</span>
            <span>Cetak Kertas</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPosterPng}
            className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-sm text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Unduh Poster QR (PNG)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
