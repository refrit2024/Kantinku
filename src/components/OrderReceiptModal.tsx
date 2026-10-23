import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { INITIAL_STALLS, OrderTransaction, Stall } from '../data/kantinData';
import { generateReceiptSecurityCode } from '../utils/securityGuard';

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
  const [isCopied, setIsCopied] = useState(false);

  // 8 Golden Rules: Universal Usability & Internal Locus of Control (Escape Key closes modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const isAutoPaid = order.paymentStatus === 'paid_gateway';

  const statusMeta =
    order.status === 'waiting_payment_verification'
      ? {
          label: isAutoPaid ? 'LUNAS • MENUNGGU DAPUR MEMPROSES' : 'MENUNGGU VERIFIKASI TRANSFER PENJUAL',
          badgeClass: 'bg-tertiary-fixed text-tertiary',
          paidText: isAutoPaid ? 'Lunas Otomatis (Payment Gateway)' : 'Menunggu Konfirmasi Pembayaran',
        }
      : order.status === 'cooking'
      ? {
          label:
            order.fulfillmentType === 'dine_in'
              ? `SEDANG DIMASAK / DISIAPKAN KE MEJA ${order.tableNumber || ''}`.trim()
              : 'SEDANG DISIAPKAN DI DAPUR',
          badgeClass: 'bg-primary-fixed text-on-primary-fixed',
          paidText: isAutoPaid
            ? 'Lunas Otomatis (Payment Gateway)'
            : order.paymentMethod === 'tunai'
            ? 'Bayar Tunai Saat Ambil'
            : 'Lunas Terverifikasi',
        }
      : order.status === 'ready_pickup'
      ? {
          label:
            order.fulfillmentType === 'dine_in'
              ? `DIANTAR KE MEJA ${order.tableNumber || ''}`.trim()
              : 'SIAP DIAMBIL DI STAN',
          badgeClass: 'bg-secondary text-on-secondary',
          paidText: isAutoPaid
            ? 'Lunas Otomatis (Payment Gateway)'
            : order.paymentMethod === 'tunai'
            ? 'Bayar Tunai di Tempat'
            : 'Lunas Terverifikasi',
        }
      : order.status === 'completed'
      ? {
          label:
            order.fulfillmentType === 'dine_in'
              ? 'PESANAN SELESAI DISAJIKAN'
              : 'PESANAN SELESAI DIAMBIL',
          badgeClass: 'bg-secondary-container text-on-secondary-container',
          paidText: isAutoPaid ? 'Lunas Otomatis (Payment Gateway)' : 'Lunas & Selesai',
        }
      : {
          label: 'PESANAN DIBATALKAN / DITOLAK',
          badgeClass: 'bg-error-container text-on-error-container',
          paidText: isAutoPaid ? 'Dana Dikembalikan (Refund Gateway)' : 'Dibatalkan',
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
      ctx.fillText('NOTA PESANAN RESMI — UNIFOOD', width / 2, 92);

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
      `Layanan: ${
        order.fulfillmentType === 'dine_in'
          ? `Makan di Tempat (Meja: ${order.tableNumber || '-'})`
          : `Ambil di Stan (${order.pickupTime})`
      }`,
      `Rincian Menu:`,
      itemLines,
      `Total Bayar: Rp ${totalAmount.toLocaleString('id-ID')} (${order.paymentProviderLabel})`,
      `Status: ${statusMeta.label}`,
    ].join('\n');

    navigator.clipboard?.writeText(summaryText).catch(() => {});
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
    if (onShowToast) {
      onShowToast(`Rincian Nota ${order.id} berhasil disalin ke Clipboard!`);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Top Receipt Header - Modern Emerald Gradient */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-[22px]">receipt_long</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-emerald-100 font-bold">
                Bukti Pesanan &amp; Antrean Resmi
              </span>
              <h3 className="text-base sm:text-lg font-black truncate">
                Nota Pesanan #{order.id}
              </h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup Nota"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4">
          {/* Petunjuk Pengambilan / Dine-In / Jastip Antar-Lantai */}
          {order.status !== 'rejected' && (
            order.fulfillmentType === 'jastip_lantai' ? (
              <div className="p-3.5 rounded-lg bg-purple-50/90 border border-purple-200/90 flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[20px]">directions_run</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-purple-950">Titip-Antar Mahasiswa (Jastip Kampus)</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-purple-200 text-purple-900 border border-purple-300">
                        {order.deliveryBuilding || 'Gedung A'} &bull; {order.deliveryFloor || 'Lt. 4'} ({order.deliveryRoom || 'Kelas'})
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-900 leading-relaxed mt-1">
                      Pesanan akan diantarkan langsung oleh kurir sesama mahasiswa ke depan ruangan kelas Anda.
                    </p>
                  </div>
                </div>

                {/* PIN Serah Terima Box */}
                <div className="bg-white p-3 rounded-md border border-purple-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">4-Digit PIN Serah Terima:</span>
                    <span className="font-mono text-xl font-extrabold text-purple-900 tracking-widest">
                      {order.runnerPinCode || '1234'}
                    </span>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 max-w-[200px]">
                    Tunjukkan PIN ini ke kurir mahasiswa saat makanan diserahkan.
                  </div>
                </div>
              </div>
            ) : order.fulfillmentType === 'dine_in' ? (
              <div className="p-3.5 rounded-lg bg-amber-50/90 border border-amber-200/90 flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">table_restaurant</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-amber-950">Makan di Tempat (Dine-In)</span>
                    <span className="text-[11px] font-black px-2 py-0.5 rounded-sm bg-amber-200 text-amber-900 border border-amber-300">
                      Meja {order.tableNumber || '-'}
                    </span>
                    {order.paymentMethod === 'tunai' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-amber-300 text-slate-950">
                        Bayar Tunai di Meja
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                    {order.paymentMethod === 'tunai'
                      ? `Silakan duduk santai di meja Anda. Pesanan langsung dimasak stan. Siapkan uang pas Rp ${totalAmount.toLocaleString('id-ID')} saat staf menyajikan makanan ke meja.`
                      : 'Silakan duduk santai di meja Anda. Pesanan sedang dimasak dan akan diantar langsung ke meja saat matang.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-emerald-50/90 border border-emerald-200/90 flex items-start gap-3">
                <div className="w-9 h-9 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-emerald-950">Ambil Sendiri di Stan (Self-Pickup)</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {order.pickupTime || 'Segera'}
                    </span>
                    {order.paymentMethod === 'tunai' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-amber-100 text-amber-900 border border-amber-300">
                        Bayar Tunai di Kasir
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    {order.paymentMethod === 'tunai'
                      ? `Pesanan langsung disiapkan oleh stan. Ambil di ${order.stallLocation || matchedStall.fullLocation} dan siapkan uang pas Rp ${totalAmount.toLocaleString('id-ID')} saat mengambil di kasir.`
                      : `Ambil pesanan di ${order.stallLocation || matchedStall.fullLocation} saat status berubah menjadi Siap Diambil.`}
                  </p>
                </div>
              </div>
            )
          )}

          {/* Ticket Number & Status Highlight */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Nomor Antrean / Nota
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {order.id}
              </span>
              <span className="text-[11px] text-slate-500">{order.createdAt}</span>
            </div>
            <span
              className={`px-3 py-1.5 rounded-md text-xs font-bold ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </span>
          </div>

          {/* Stall & Student Details */}
          <div className="flex flex-col gap-2.5 text-xs bg-slate-50/70 p-4 rounded-lg border border-slate-200">
            <div className="flex justify-between gap-2 pb-2.5 border-b border-slate-200/70">
              <span className="text-slate-500">Stan Kantin:</span>
              <div className="text-right">
                <strong className="text-slate-900 block text-xs">{order.stallName}</strong>
                <span className="text-[11px] text-slate-500">
                  {order.stallLocation}
                </span>
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Pemesan:</span>
              <strong className="text-slate-900 text-right">
                {order.studentName} (NIM: {order.studentNim})
              </strong>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500">Layanan:</span>
              <div className="text-right">
                {order.fulfillmentType === 'dine_in' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                    <span className="material-symbols-outlined text-[13px]">table_restaurant</span>
                    <span>Makan di Tempat • Meja {order.tableNumber || '-'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                    <span className="material-symbols-outlined text-[13px]">shopping_bag</span>
                    <span>Ambil Sendiri di Stan</span>
                  </span>
                )}
              </div>
            </div>
            {order.fulfillmentType === 'dine_in' ? (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Pengantaran:</span>
                <strong className="text-amber-700 text-right">
                  Diantar ke Meja {order.tableNumber || '-'} saat matang
                </strong>
              </div>
            ) : (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Jadwal Ambil:</span>
                <strong className="text-emerald-700 text-right">{order.pickupTime}</strong>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Metode Bayar:</span>
              <strong className="text-slate-900 text-right">
                {order.paymentProviderLabel}
              </strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Status Bayar:</span>
              <strong className="text-emerald-700 text-right">{statusMeta.paidText}</strong>
            </div>
            {order.paymentGatewayTxId && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Ref Gateway:</span>
                <span className="font-mono text-[11px] text-slate-800 font-semibold">
                  {order.paymentGatewayTxId}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2 pt-2 border-t border-slate-200/70 items-center">
              <span className="text-slate-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-emerald-600">
                  verified_user
                </span>
                <span>Token Keamanan Kasir:</span>
              </span>
              <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-md border border-emerald-200">
                {securityToken}
              </span>
            </div>
            {order.notes && (
              <div className="pt-2 border-t border-slate-200/70 text-slate-600">
                <strong className="text-slate-900">Catatan:</strong> &ldquo;{order.notes}&rdquo;
              </div>
            )}
          </div>

          {/* Itemized Menu List */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 flex flex-col gap-2.5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-100">
              <span>Rincian Menu ({(order.items || []).reduce((s, i) => s + i.quantity, 0)} Porsi)</span>
              <span>Subtotal</span>
            </div>

            {(order.items || []).map((it, idx) => (
              <div
                key={`${order.id}-receipt-item-${idx}`}
                className="flex items-center justify-between text-xs sm:text-sm text-slate-900"
              >
                <div className="flex flex-col">
                  <span>
                    <strong className="font-bold">{it.quantity}x</strong> {it.name}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    @ Rp {it.price.toLocaleString('id-ID')}
                  </span>
                </div>
                <span className="font-bold">
                  Rp {(it.price * it.quantity).toLocaleString('id-ID')}
                </span>
              </div>
            ))}

            {serviceFee > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span>Biaya Layanan Payment Gateway</span>
                <span>Rp {serviceFee.toLocaleString('id-ID')}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs sm:text-sm font-black text-slate-900">
                TOTAL PEMBAYARAN
              </span>
              <span className="text-lg sm:text-xl font-black text-emerald-600">
                Rp {totalAmount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* QR Code Bukti Ambil di Kasir */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-4">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`QR Nota ${order.id}`}
                className="w-20 h-20 rounded-md border border-slate-200 shrink-0 object-contain bg-white p-1 shadow-2xs"
              />
            )}
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-bold text-slate-900">
                Tunjukkan Nota Ini Saat Ambil Pesanan
              </span>
              <span className="text-[11px] text-slate-500 leading-relaxed">
                Penjual stan <strong>{order.stallName}</strong> dapat mencocokkan Kode Antrean{' '}
                <strong>{order.id}</strong> atau memindai QR code verifikasi ini di kasir.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
              isCopied
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">
              {isCopied ? 'check' : 'content_copy'}
            </span>
            <span>{isCopied ? 'Tersalin!' : 'Salin Rincian'}</span>
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadReceiptPng}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>{isDownloading ? 'Menyiapkan Nota...' : 'Unduh Gambar Nota (PNG)'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center justify-center cursor-pointer transition-colors border border-slate-300/80"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
