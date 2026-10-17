import React, { useState } from 'react';
import {
  OrderTransaction,
  StudentAccount,
  StudentRunnerProfile,
} from '../data/kantinData';

interface JastipRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  runnerProfile: StudentRunnerProfile;
  activeOrders: OrderTransaction[];
  onAcceptJastip: (orderId: string) => void;
  onUpdateDeliveryStatus: (
    orderId: string,
    status:
      | 'picking_up'
      | 'delivering_to_floor'
      | 'arrived_at_room'
      | 'delivered',
    pinInput?: string
  ) => boolean;
  onToggleOnline: () => void;
  onWithdrawEarnings: (amount: number, dest: string) => void;
  loggedInStudent: StudentAccount | null;
}

export const JastipRunnerModal: React.FC<JastipRunnerModalProps> = ({
  isOpen,
  onClose,
  runnerProfile,
  activeOrders,
  onAcceptJastip,
  onUpdateDeliveryStatus,
  onToggleOnline,
  onWithdrawEarnings,
  loggedInStudent,
}) => {
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'wallet' | 'guide'>('available');
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [pinError, setPinError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(25000);
  const [withdrawDest, setWithdrawDest] = useState<string>('GoPay / DANA');
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter orders that requested Jastip
  const jastipRequestedOrders = activeOrders.filter(
    (o) => o.fulfillmentType === 'jastip_lantai' && !o.runnerId && o.status !== 'completed' && o.status !== 'rejected'
  );

  const myAssignedOrders = activeOrders.filter(
    (o) => o.fulfillmentType === 'jastip_lantai' && o.runnerId === runnerProfile.studentId && o.status !== 'completed'
  );

  const handleVerifyPinAndComplete = (order: OrderTransaction) => {
    const inputPin = pinInputs[order.id] || '';
    if (inputPin.trim().length !== 4) {
      setPinError('Masukkan 4 digit PIN serah terima dari pemesan.');
      return;
    }
    const success = onUpdateDeliveryStatus(order.id, 'delivered', inputPin);
    if (!success) {
      setPinError('PIN salah! Minta 4 digit PIN valid dari pemesan di depan kelas.');
    } else {
      setPinError(null);
      setPinInputs((prev) => ({ ...prev, [order.id]: '' }));
    }
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmount <= 0 || withdrawAmount > runnerProfile.totalEarnings) {
      return;
    }
    onWithdrawEarnings(withdrawAmount, withdrawDest);
    setWithdrawSuccess(`Penarikan uang saku Rp ${withdrawAmount.toLocaleString('id-ID')} ke ${withdrawDest} berhasil diajukan!`);
    setTimeout(() => setWithdrawSuccess(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="bg-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/80 flex items-center justify-center text-white border border-emerald-600">
              <span className="material-symbols-outlined text-[24px]">directions_run</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Kurir Jastip Mahasiswa
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900 uppercase tracking-wider">
                  Unifood P2P
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                Titip-Antar antar-lantai kampus: Tambahan uang saku di sela jam kuliah
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-emerald-700/60 hover:bg-emerald-700 text-emerald-100 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup Panel"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Runner Status & Switch Bar */}
        <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${runnerProfile.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <div>
              <span className="font-bold text-slate-900">
                {runnerProfile.studentName}
              </span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span className="text-emerald-800 font-medium">NIM {runnerProfile.studentNim}</span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span className="text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                KTM Terverifikasi ✓
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleOnline}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                runnerProfile.isOnline
                  ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {runnerProfile.isOnline ? 'radio_button_checked' : 'pause_circle'}
              </span>
              <span>{runnerProfile.isOnline ? 'Status: Siap Antar' : 'Status: Istirahat'}</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 gap-2 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('available')}
            className={`py-2.5 px-3 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'available'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">near_me</span>
            <span>Order Tersedia ({jastipRequestedOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`py-2.5 px-3 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'active'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory</span>
            <span>Titipan Aktif ({myAssignedOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className={`py-2.5 px-3 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'wallet'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
            <span>Uang Saku (Rp {runnerProfile.totalEarnings.toLocaleString('id-ID')})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`py-2.5 px-3 border-b-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">school</span>
            <span>Aturan Jastip</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-grow">
          {/* TAB 1: AVAILABLE JASTIP ORDERS */}
          {activeTab === 'available' && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0 mt-0.5">
                  info
                </span>
                <div>
                  <p className="font-semibold">Tips Mahasiswa Runner:</p>
                  <p className="text-amber-800 mt-0.5">
                    Ambil order jika posisi Anda sedang berada di dekat kantin dan akan naik ke lantai atas menuju kelas/lounge. Anda akan mendapatkan ongkir titip <strong>Rp 2.500</strong> langsung setelah pesanan diserahkan.
                  </p>
                </div>
              </div>

              {jastipRequestedOrders.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 mx-auto flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[28px]">search</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Belum Ada Permintaan Titip-Antar
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Permintaan jastip dari mahasiswa di lantai atas akan muncul di sini secara otomatis. Coba buat pesanan jastip dari mode pemesan untuk simulasi!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jastipRequestedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs hover:border-emerald-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {order.id}
                          </span>
                          <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            +Rp {(order.jastipFee || 2500).toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div className="text-xs text-slate-900 font-semibold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-amber-600">storefront</span>
                          <span>{order.stallName}</span>
                          <span className="text-slate-400">➔</span>
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">location_on</span>
                          <span className="text-emerald-800 font-bold">
                            {order.deliveryBuilding || 'Gedung A'}, {order.deliveryFloor || 'Lt. 4'} ({order.deliveryRoom || 'R. 402'})
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500">
                          Pemesan: <strong className="text-slate-700">{order.studentName}</strong> (NIM {order.studentNim}) · {order.items.length} Menu
                        </div>

                        {order.deliveryNotes && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded italic">
                            Catatan: &ldquo;{order.deliveryNotes}&rdquo;
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onAcceptJastip(order.id)}
                        className="min-h-[40px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>Ambil Jastip Ini</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY ACTIVE ASSIGNED JASTIP */}
          {activeTab === 'active' && (
            <div className="space-y-4">
              {myAssignedOrders.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
                  <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-500 mx-auto flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[28px]">inventory_2</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Tidak Ada Titipan Aktif
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Pilih order dari tab &quot;Order Tersedia&quot; untuk mulai mengantar dan mendapatkan penghasilan tambahan.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myAssignedOrders.map((order) => {
                    const status = order.runnerStatus || 'assigned';

                    return (
                      <div
                        key={order.id}
                        className="border-2 border-emerald-500/80 rounded-2xl p-4 sm:p-5 bg-white shadow-sm space-y-3.5"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                              Tiket {order.id}
                            </span>
                            <span className="text-xs text-emerald-800 font-bold ml-2">
                              Upah: Rp {(order.jastipFee || 2500).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 uppercase">
                            {status === 'assigned' && '1. Menuju Kantin'}
                            {status === 'picking_up' && '2. Ambil di Stan'}
                            {status === 'delivering_to_floor' && '3. Naik ke Lantai'}
                            {status === 'arrived_at_room' && '4. Tiba di Depan Kelas'}
                          </span>
                        </div>

                        {/* Location Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Titik Jemput Makanan:</span>
                            <strong className="text-slate-800 flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[16px] text-amber-600">store</span>
                              {order.stallName}
                            </strong>
                            <p className="text-[11px] text-slate-500">{order.stallLocation}</p>
                          </div>

                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tujuan Antar:</span>
                            <strong className="text-slate-800 flex items-center gap-1 mt-0.5">
                              <span className="material-symbols-outlined text-[16px] text-emerald-600">room</span>
                              {order.deliveryBuilding || 'Gedung A'}, {order.deliveryFloor || 'Lt. 4'}
                            </strong>
                            <p className="text-[11px] text-emerald-800 font-semibold">
                              Ruangan/Titik: {order.deliveryRoom || 'R. 402'} (Pemesan: {order.studentName})
                            </p>
                          </div>
                        </div>

                        {/* Order Items Preview */}
                        <div className="text-xs text-slate-600">
                          <strong className="text-slate-800">Item Pesanan:</strong>
                          <ul className="list-disc pl-4 mt-1 text-[11px] space-y-0.5">
                            {order.items.map((it, idx) => (
                              <li key={idx}>
                                {it.quantity}x {it.name} (Rp {(it.price * it.quantity).toLocaleString('id-ID')})
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Delivery Progress Action Buttons */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          {status === 'assigned' && (
                            <button
                              type="button"
                              onClick={() => onUpdateDeliveryStatus(order.id, 'picking_up')}
                              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">storefront</span>
                              <span>Saya Sudah di Stan Kantin</span>
                            </button>
                          )}

                          {status === 'picking_up' && (
                            <button
                              type="button"
                              onClick={() => onUpdateDeliveryStatus(order.id, 'delivering_to_floor')}
                              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">elevator</span>
                              <span>Makanan Sudah Diambil &bull; Naik ke Lantai</span>
                            </button>
                          )}

                          {status === 'delivering_to_floor' && (
                            <button
                              type="button"
                              onClick={() => onUpdateDeliveryStatus(order.id, 'arrived_at_room')}
                              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">door_front</span>
                              <span>Saya Tiba di Depan Ruangan / Titik Temu</span>
                            </button>
                          )}

                          {status === 'arrived_at_room' && (
                            <div className="w-full bg-emerald-50 border border-emerald-200 p-3 rounded-xl space-y-2">
                              <div className="text-xs text-emerald-950 font-bold flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px] text-emerald-700">lock_open</span>
                                <span>Verifikasi PIN 4 Digit Serah Terima:</span>
                              </div>
                              <p className="text-[11px] text-slate-600">
                                Minta 4-digit PIN yang muncul di layar HP pemesan ({order.studentName}) untuk verifikasi keamanan.
                              </p>

                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  maxLength={4}
                                  placeholder="Contoh: 1234"
                                  value={pinInputs[order.id] || ''}
                                  onChange={(e) =>
                                    setPinInputs({ ...pinInputs, [order.id]: e.target.value.replace(/\D/g, '') })
                                  }
                                  className="w-32 px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-sm tracking-widest text-center font-bold"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleVerifyPinAndComplete(order)}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px]">done_all</span>
                                  <span>Selesai &bull; Klaim Rp 2.500</span>
                                </button>
                              </div>

                              {pinError && (
                                <p className="text-[11px] text-rose-600 font-medium">
                                  {pinError} (PIN pemesan: <strong>{order.runnerPinCode || '1234'}</strong>)
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WALLET & EARNINGS */}
          {activeTab === 'wallet' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">Saldo Siap Tarik</span>
                  <strong className="text-xl font-extrabold text-emerald-900 block mt-1">
                    Rp {runnerProfile.totalEarnings.toLocaleString('id-ID')}
                  </strong>
                  <span className="text-[10px] text-emerald-600 mt-1 block">Tarik kapan saja</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Antaran Sukses</span>
                  <strong className="text-xl font-extrabold text-slate-900 block mt-1">
                    {runnerProfile.completedDeliveries} Pesanan
                  </strong>
                  <span className="text-[10px] text-slate-500 mt-1 block">100% On-time</span>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                  <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">Rating Reputasi</span>
                  <strong className="text-xl font-extrabold text-amber-900 flex items-center gap-1 mt-1">
                    ★ {runnerProfile.rating.toFixed(1)}
                  </strong>
                  <span className="text-[10px] text-amber-700 mt-1 block">Kurir Terpercaya</span>
                </div>
              </div>

              {withdrawSuccess && (
                <div className="p-3 bg-emerald-100 text-emerald-800 text-xs rounded-xl border border-emerald-300 font-medium">
                  {withdrawSuccess}
                </div>
              )}

              {/* Form Withdraw */}
              <form onSubmit={handleWithdraw} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-emerald-700">payments</span>
                  <span>Cairkan Uang Saku Mahasiswa:</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nominal Penarikan (Rp):
                    </label>
                    <input
                      type="number"
                      step={5000}
                      min={10000}
                      max={runnerProfile.totalEarnings}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tujuan E-Wallet / Bank:
                    </label>
                    <select
                      value={withdrawDest}
                      onChange={(e) => setWithdrawDest(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium"
                    >
                      <option value="GoPay">GoPay ({loggedInStudent?.nim || '32230105'})</option>
                      <option value="DANA">DANA ({loggedInStudent?.nim || '32230105'})</option>
                      <option value="ShopeePay">ShopeePay</option>
                      <option value="BCA Virtual Account">BCA Tabungan</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={runnerProfile.totalEarnings < 10000}
                  className="w-full min-h-[40px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]">send_money</span>
                  <span>Ajukan Penarikan Saldo</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: GUIDELINES & ETHICS */}
          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs text-slate-700">
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2 bg-slate-50">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <span className="material-symbols-outlined text-[16px] text-emerald-700">verified_user</span>
                  <span>Kode Etik & Aturan Kurir Jastip Unifood:</span>
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
                  <li>
                    <strong>Hanya di Lingkungan Kampus:</strong> Jastip Unifood beroperasi secara *closed-loop* di koridor dan antar-lantai kampus (tanpa jalan raya/motor).
                  </li>
                  <li>
                    <strong>Sopan & Menghormati Perkuliahan:</strong> Saat tiba di depan ruang kelas, hubungi pemesan lewat chat atau tunggu di depan pintu tanpa mengganggu jalannya perkuliahan.
                  </li>
                  <li>
                    <strong>Verifikasi PIN Wajib:</strong> Pastikan selalu meminta 4 digit PIN dari pemesan saat serah terima untuk mengamankan upah Anda.
                  </li>
                  <li>
                    <strong>Jaga Kebersihan Makanan:</strong> Pastikan kemasan makanan tetap tertutup rapat dan higienis selama perjalanan lift/tangga.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-700">bolt</span>
            <span>Unifood P2P Micro-Delivery &bull; Kampus Berdaya</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
