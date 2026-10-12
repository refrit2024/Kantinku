import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { INITIAL_STALLS, OrderTransaction, Stall } from '../data/kantinData';
import { generateReceiptSecurityCode } from '../utils/securityGuard';
import { LiveGpsTrackerMap } from './LiveGpsTrackerMap';

interface OrderReceiptModalProps {
  order: OrderTransaction;
  stall?: Stall;
  onClose: () => void;
  onShowToast?: (message: string, isError?: boolean) => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  stall,
  onClose,
  onShowToast,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [showLiveRouteMap, setShowLiveRouteMap] = useState(true);

  const matchedStall =
    stall ||
    INITIAL_STALLS.find((s) => s.id === order.stallId || s.name === order.stallName) ||
    INITIAL_STALLS[0];

  const subtotal =
    order.subtotalAmount ??
    (order.items || []).reduce((sum, it) => sum + it.quantity * it.price, 0);
  const serviceFee =
    order.serviceFee ?? Math.max(0, (order.totalAmount || subtotal) - subtotal);
  const totalAmount = order.totalAmount || subtotal + serviceFee;
  const securityToken = generateReceiptSecurityCode({
    id: order.id,
    stallId: order.stallId,
    studentNim: order.studentNim,
    totalAmount,
  });

  const statusMeta =
    order.status === 'waiting_payment_verification'
      ? {
          label: 'MENUNGGU VERIFIKASI PENJUAL',
          badgeClass: 'bg-tertiary-fixed text-tertiary',
          paidText: 'Menunggu Konfirmasi Pembayaran',
        }
      : order.status === 'cooking'
      ? {
          label: 'SEDANG DISIAPKAN DI DAPUR',
          badgeClass: 'bg-primary-fixed text-on-primary-fixed',
          paidText:
            order.paymentMethod === 'tunai'
              ? 'Bayar Tunai Saat Ambil'
              : 'Lunas Terverifikasi',
        }
      : order.status === 'ready_pickup'
      ? {
          label: 'SIAP DIAMBIL DI STAN',
          badgeClass: 'bg-secondary text-on-secondary',
          paidText:
            order.paymentMethod === 'tunai'
              ? 'Bayar Tunai Saat Ambil'
              : 'Lunas Terverifikasi',
        }
      : order.status === 'completed'
      ? {
          label: 'PESANAN SELESAI DIAMBIL',
          badgeClass: 'bg-secondary-container text-on-secondary-container',
          paidText: 'Lunas & Selesai',
        }
      : {
          label: 'PESANAN DIBATALKAN / DITOLAK',
          badgeClass: 'bg-error-container text-on-error-container',
          paidText: 'Dibatalkan',
        };

  useEffect(() => {
    let mounted = true;
    const verificationPayload = JSON.stringify({
      nota: order.id,
      stan: order.stallName,
      nim: order.studentNim,
      nama: order.studentName,
      total: totalAmount,
      status: order.status,
      token: securityToken,
    });

    QRCode.toDataURL(verificationPayload, {
      width: 280,
      margin: 1,
      color: { dark: '#131B2E', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [order.id, order.stallName, order.studentNim, order.studentName, totalAmount, order.status]);

  const handleDownloadReceiptPng = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const itemsCount = (order.items || []).length;
      const width = 720;
      const height = 840 + itemsCount * 46;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, width, height);

      // Receipt Card Container
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(36, 36, width - 72, height - 72, 24);
      ctx.fill();
      ctx.stroke();

      // Header Banner
      ctx.fillStyle = '#131B2E';
      ctx.beginPath();
      ctx.roundRect(36, 36, width - 72, 132, [24, 24, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText('NOTA PESANAN RESMI — KANTINKU IBI KKG', width / 2, 92);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 15px Inter, sans-serif';
      ctx.fillText(
        `${order.stallName} (${order.stallLocation || 'Area Kantin Dekat Hall D'})`,
        width / 2,
        126
      );

      // Order Code & Status Box
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.roundRect(68, 192, width - 136, 92, 16);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748B';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText('KODE ANTREAN / NOTA', 92, 222);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 28px monospace';
      ctx.fillText(order.id, 92, 260);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F766E';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(statusMeta.label, width - 92, 232);

      ctx.fillStyle = '#475569';
      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillText(order.createdAt, width - 92, 258);

      // Student & Payment Metadata
      let y = 320;
      const drawMetaRow = (label: string, val: string) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748B';
        ctx.font = '500 15px Inter, sans-serif';
        ctx.fillText(label, 68, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillText(val, width - 68, y);
        y += 32;
      };

      drawMetaRow('Pemesan Mahasiswa', `${order.studentName} (NIM: ${order.studentNim})`);
      drawMetaRow('Jadwal Pengambilan', order.pickupTime);
      drawMetaRow('Metode Pembayaran', order.paymentProviderLabel);
      drawMetaRow('Status Pembayaran', statusMeta.paidText);
      drawMetaRow('Token Keamanan Kasir', securityToken);

      // Dashed Separator
      y += 8;
      ctx.strokeStyle = '#CBD5E1';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(68, y);
      ctx.lineTo(width - 68, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Items Header
      y += 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText('RINCIAN MENU PESANAN', 68, y);
      ctx.textAlign = 'right';
      ctx.fillText('SUBTOTAL', width - 68, y);
      y += 28;

      (order.items || []).forEach((it) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0F172A';
        ctx.font = '600 16px Inter, sans-serif';
        ctx.fillText(`${it.quantity}x  ${it.name}`, 68, y);

        ctx.textAlign = 'right';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText(`Rp ${(it.price * it.quantity).toLocaleString('id-ID')}`, width - 68, y);
        y += 42;
      });

      if (serviceFee > 0) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748B';
        ctx.font = '500 14px Inter, sans-serif';
        ctx.fillText('Biaya Layanan Payment Gateway', 68, y);
        ctx.textAlign = 'right';
        ctx.fillText(`Rp ${serviceFee.toLocaleString('id-ID')}`, width - 68, y);
        y += 34;
      }

      // Total Line
      ctx.strokeStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.moveTo(68, y - 12);
      ctx.lineTo(width - 68, y - 12);
      ctx.stroke();

      y += 22;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText('TOTAL PEMBAYARAN', 68, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#1D4ED8';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.fillText(`Rp ${totalAmount.toLocaleString('id-ID')}`, width - 68, y);

      // QR Code Verification at Bottom
      if (qrDataUrl) {
        const qrImg = new Image();
        await new Promise<void>((resolve) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = () => resolve();
          qrImg.src = qrDataUrl;
        });
        ctx.drawImage(qrImg, width / 2 - 70, y + 32, 140, 140);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748B';
      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillText(
        'Tunjukkan Nota Digital ini kepada kasir stan saat mengambil pesanan.',
        width / 2,
        height - 62
      );

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `Nota-${order.id}-${order.studentNim}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (onShowToast) {
        onShowToast(`Nota pesanan ${order.id} berhasil diunduh sebagai gambar PNG!`);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopySummary = () => {
    const itemLines = (order.items || [])
      .map((i) => `- ${i.quantity}x ${i.name} (Rp ${(i.price * i.quantity).toLocaleString('id-ID')})`)
      .join('\n');
    const summaryText = [
      `NOTA PESANAN KANTINKU IBI KKG`,
      `Kode Order: ${order.id} (Token: ${securityToken})`,
      `Stan: ${order.stallName} (${order.stallLocation})`,
      `Pemesan: ${order.studentName} (NIM: ${order.studentNim})`,
      `Jam Ambil: ${order.pickupTime}`,
      `Rincian Menu:`,
      itemLines,
      `Total Bayar: Rp ${totalAmount.toLocaleString('id-ID')} (${order.paymentProviderLabel})`,
      `Status: ${statusMeta.label}`,
    ].join('\n');

    navigator.clipboard?.writeText(summaryText).catch(() => {});
    if (onShowToast) {
      onShowToast(`Rincian Nota ${order.id} berhasil disalin ke Clipboard!`);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-inverse-surface/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-xl shadow-2xl border border-outline-variant/30 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Top Receipt Header */}
        <div className="bg-primary text-on-primary px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-on-primary/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">local_shipping</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-[10px] uppercase tracking-wider text-on-primary/80 font-semibold">
                Lacak Rute Pengambilan &amp; Bukti Transaksi Resmi
              </span>
              <h3 className="font-headline-md text-base sm:text-lg font-bold truncate">
                Peta Rute &amp; Nota Pesanan #{order.id}
              </h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup Nota"
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-on-primary/15 hover:bg-on-primary/25 text-on-primary flex items-center justify-center cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4">
          {/* SHOPEE-STYLE AUTOMATIC LIVE MAP & ROUTE TRACKER AT TOP OF ORDER RECEIPT */}
          {order.status !== 'rejected' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-xs font-bold text-secondary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                  <span>Peta Rute Pengambilan Pesanan (Otomatis Aktif)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowLiveRouteMap((prev) => !prev)}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  {showLiveRouteMap ? 'Sembunyikan Peta' : 'Tampilkan Peta Rute'}
                </button>
              </div>
              {showLiveRouteMap && (
                <LiveGpsTrackerMap
                  stalls={[matchedStall]}
                  selectedStallId={matchedStall.id}
                  order={order}
                  mode="order-tracking"
                  compact={true}
                  onShowToast={onShowToast}
                />
              )}
            </div>
          )}

          {/* Ticket Number & Status Highlight */}
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider">
                Nomor Antrean / Kode Order
              </span>
              <span className="font-mono text-xl font-bold text-primary tracking-tight">
                {order.id}
              </span>
              <span className="text-[11px] text-on-surface-variant">{order.createdAt}</span>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg font-label-sm text-[11px] font-bold ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </span>
          </div>

          {/* Stall & Student Details */}
          <div className="flex flex-col gap-2 text-xs bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/25">
            <div className="flex justify-between gap-2 pb-2 border-b border-outline-variant/20">
              <span className="text-on-surface-variant">Stan Kantin:</span>
              <div className="text-right">
                <strong className="text-on-surface block">{order.stallName}</strong>
                <span className="text-[11px] text-on-surface-variant">
                  {order.stallLocation}
                </span>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant">Pemesan:</span>
              <strong className="text-on-surface text-right">
                {order.studentName} (NIM: {order.studentNim})
              </strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant">Jadwal Ambil:</span>
              <strong className="text-primary text-right">{order.pickupTime}</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant">Metode Bayar:</span>
              <strong className="text-on-surface text-right">
                {order.paymentProviderLabel}
              </strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-on-surface-variant">Status Bayar:</span>
              <strong className="text-secondary text-right">{statusMeta.paidText}</strong>
            </div>
            {order.paymentGatewayTxId && (
              <div className="flex justify-between gap-2">
                <span className="text-on-surface-variant">Ref Gateway:</span>
                <span className="font-mono text-[11px] text-on-surface font-semibold">
                  {order.paymentGatewayTxId}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2 pt-1.5 border-t border-outline-variant/20">
              <span className="text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-secondary">
                  verified_user
                </span>
                Token Anti-Palsu:
              </span>
              <span className="font-mono text-xs font-bold text-secondary bg-secondary-container/40 px-2 py-0.5 rounded">
                {securityToken}
              </span>
            </div>
            {order.notes && (
              <div className="pt-1.5 border-t border-outline-variant/20 text-on-surface-variant">
                <strong className="text-on-surface">Catatan:</strong> &ldquo;{order.notes}&rdquo;
              </div>
            )}
          </div>

          {/* Itemized Menu List */}
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-dashed border-outline-variant/50 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] font-label-sm text-on-surface-variant uppercase tracking-wider pb-1 border-b border-outline-variant/25">
              <span>Rincian Menu ({(order.items || []).reduce((s, i) => s + i.quantity, 0)} Porsi)</span>
              <span>Subtotal</span>
            </div>

            {(order.items || []).map((it, idx) => (
              <div
                key={`${order.id}-receipt-item-${idx}`}
                className="flex items-center justify-between text-xs sm:text-sm text-on-surface"
              >
                <div className="flex flex-col">
                  <span>
                    <strong>{it.quantity}x</strong> {it.name}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    @ Rp {it.price.toLocaleString('id-ID')}
                  </span>
                </div>
                <span className="font-semibold">
                  Rp {(it.price * it.quantity).toLocaleString('id-ID')}
                </span>
              </div>
            ))}

            {serviceFee > 0 && (
              <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1.5 border-t border-outline-variant/20">
                <span>Biaya Layanan Payment Gateway</span>
                <span>Rp {serviceFee.toLocaleString('id-ID')}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2.5 border-t border-outline-variant/35">
              <span className="font-label-md text-sm font-bold text-on-surface">
                TOTAL PEMBAYARAN
              </span>
              <span className="font-headline-md text-lg font-bold text-primary">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* QR Code Bukti Ambil di Kasir */}
          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/25 flex items-center gap-3.5">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`QR Nota ${order.id}`}
                className="w-20 h-20 rounded-lg border border-outline-variant/30 shrink-0 object-contain bg-white p-1"
              />
            )}
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-label-sm font-bold text-on-surface">
                Tunjukkan Nota Ini Saat Ambil Pesanan
              </span>
              <span className="text-[11px] text-on-surface-variant leading-relaxed">
                Penjual stan <strong>{order.stallName}</strong> dapat mencocokkan Kode{' '}
                <strong>{order.id}</strong> atau memindai QR verifikasi di samping.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons (min-h 44px) */}
        <div className="p-4 bg-surface-container-low border-t border-outline-variant/25 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">content_copy</span>
            <span>Salin Teks</span>
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadReceiptPng}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>{isDownloading ? 'Menyiapkan Nota...' : 'Unduh Gambar Nota (PNG)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
