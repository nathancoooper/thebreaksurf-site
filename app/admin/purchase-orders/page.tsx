'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface Supplier { name: string; supplier_name: string }
interface RawItem { name: string; item_code: string; item_name: string; stock_uom: string }
interface Warehouse { name: string; warehouse_name: string }
interface ChargeAccount { name: string; account_name: string }
interface Options { suppliers: Supplier[]; items: RawItem[]; warehouses: Warehouse[]; chargeAccounts: ChargeAccount[] }

interface Bank { name: string; account_name: string }
interface PIOptions { banks: Bank[]; modesOfPayment: string[] }

interface PORow {
  name: string;
  supplier: string;
  transaction_date: string;
  schedule_date: string;
  grand_total: number;
  status: string;
  docstatus: number;
}

interface POItemLine {
  name: string;
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  warehouse: string;
  uom: string;
}

interface TaxLine {
  charge_type: 'On Net Total' | 'Actual' | string;
  account_head: string;
  description: string;
  rate: number;
  tax_amount: number;
}

interface PODetail extends PORow {
  items: POItemLine[];
  taxes: TaxLine[];
  grand_total: number;
  custom_attach_receipt: string | null;
}

type ChargeType = 'On Net Total' | 'Actual';
interface ChargeRow { charge_type: ChargeType; account_head: string; description: string; value: string }

interface LineForm { item_code: string; qty: string; rate: string; amount: string; lastEdited: 'rate' | 'amount' | null }

const STATUS: Record<number, { label: string; badge: string; dot: string }> = {
  0: { label: 'Draft',     badge: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400' },
  1: { label: 'Submitted', badge: 'bg-green-50 text-green-700',  dot: 'bg-green-400' },
  2: { label: 'Cancelled', badge: 'bg-red-50 text-red-500',      dot: 'bg-red-400' },
};

function fmt(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusBadge({ docstatus }: { docstatus: number }) {
  const s = STATUS[docstatus] ?? STATUS[0];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function emptyLine(): LineForm { return { item_code: '', qty: '1', rate: '', amount: '', lastEdited: null }; }

function recomputeLine(line: LineForm, patch: Partial<LineForm>): LineForm {
  const next = { ...line, ...patch };
  const qty = parseFloat(next.qty);
  if ('rate' in patch) {
    next.lastEdited = 'rate';
    if (qty > 0 && next.rate !== '') next.amount = (qty * parseFloat(next.rate)).toFixed(2);
  } else if ('amount' in patch) {
    next.lastEdited = 'amount';
    if (qty > 0 && next.amount !== '') next.rate = (parseFloat(next.amount) / qty).toFixed(2);
  } else if ('qty' in patch) {
    if (next.lastEdited === 'amount' && next.amount !== '' && qty > 0) next.rate = (parseFloat(next.amount) / qty).toFixed(2);
    else if (next.lastEdited === 'rate' && next.rate !== '' && qty > 0) next.amount = (qty * parseFloat(next.rate)).toFixed(2);
  }
  return next;
}

function chargeAmount(charge: ChargeRow, netTotal: number): number {
  const value = parseFloat(charge.value) || 0;
  return charge.charge_type === 'On Net Total' ? netTotal * (value / 100) : value;
}

function emptyCharge(): ChargeRow { return { charge_type: 'Actual', account_head: '', description: '', value: '' }; }

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseOrdersPageInner />
    </Suspense>
  );
}

function PurchaseOrdersPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listPath = pathname.startsWith('/admin')
    ? '/admin/purchase-orders'
    : pathname.startsWith('/finance')
      ? '/finance/purchase-orders'
      : '/purchase-orders';
  const overviewPath = pathname.startsWith('/admin')
    ? '/admin/finance-overview'
    : pathname.startsWith('/finance')
      ? '/finance'
      : '/';
  const [linkTxn, setLinkTxn]       = useState<string | null>(null);
  const [orders, setOrders]         = useState<PORow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [hasMore, setHasMore]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [detail, setDetail]         = useState<Record<string, PODetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  // New PO panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [options, setOptions]     = useState<Options | null>(null);
  const [creating, setCreating]   = useState(false);
  const [supplier, setSupplier]   = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouse, setWarehouse] = useState('');
  const [lines, setLines]         = useState<LineForm[]>([emptyLine()]);
  const [charges, setCharges]     = useState<ChargeRow[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // New Purchase Invoice panel
  const [piOpen, setPiOpen]           = useState(false);
  const [piSource, setPiSource]       = useState<PODetail | null>(null);
  const [piOptions, setPiOptions]     = useState<PIOptions | null>(null);
  const [piCreating, setPiCreating]   = useState(false);
  const [piItems, setPiItems]         = useState<LineForm[]>([]);
  const [piCharges, setPiCharges]     = useState<ChargeRow[]>([]);
  const [piPostingDate, setPiPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [piPostingTime, setPiPostingTime] = useState(new Date().toTimeString().slice(0, 5));
  const [piIsPaid, setPiIsPaid]       = useState(true);
  const [piUpdateStock, setPiUpdateStock] = useState(true);
  const [piModeOfPayment, setPiModeOfPayment] = useState('');
  const [piCashBankAccount, setPiCashBankAccount] = useState('');

  const netTotal = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const chargesTotal = charges.reduce((sum, c) => sum + chargeAmount(c, netTotal), 0);
  const total = netTotal + chargesTotal;

  const piNetTotal = piItems.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const piChargesTotal = piCharges.reduce((sum, c) => sum + chargeAmount(c, piNetTotal), 0);
  const piTotal = piNetTotal + piChargesTotal;

  const fetchOptions = useCallback(async () => {
    if (options) return;
    const r = await fetch('/api/admin/purchase-orders/options', { credentials: 'include' });
    if (r.ok) {
      const data: Options = await r.json();
      setOptions(data);
      setSupplier(data.suppliers[0]?.name ?? '');
      setWarehouse(data.warehouses.find(w => w.warehouse_name === 'Stores')?.name ?? data.warehouses[0]?.name ?? '');
    }
  }, [options]);

  function openPanel() { setPanelOpen(true); setReceiptFile(null); fetchOptions(); }

  function closePanel() {
    setPanelOpen(false);
    setLines([emptyLine()]);
    setCharges([]);
    setReceiptFile(null);
    setLinkTxn(null);
  }

  // Arriving from Finance Overview's "+ PO" action against an unmatched bank
  // transaction — open straight to the form with the transaction's date
  // ready, and remember which row to link back once this order is created.
  useEffect(() => {
    if (searchParams.get('open') !== '1') return;
    const date = searchParams.get('date');
    const txn = searchParams.get('linkTxn');
    setPanelOpen(true);
    setReceiptFile(null);
    fetchOptions();
    if (date) { setOrderDate(date); setDeliveryDate(date); }
    if (txn) setLinkTxn(txn);
    router.replace(listPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLine(i: number, patch: Partial<LineForm>) {
    setLines(prev => prev.map((l, j) => j === i ? recomputeLine(l, patch) : l));
  }

  function addLine() { setLines(prev => [...prev, emptyLine()]); }
  function removeLine(i: number) { setLines(prev => prev.length > 1 ? prev.filter((_, j) => j !== i) : prev); }

  function updateCharge(i: number, patch: Partial<ChargeRow>) {
    setCharges(prev => prev.map((c, j) => j === i ? { ...c, ...patch } : c));
  }
  function removeCharge(i: number) { setCharges(prev => prev.filter((_, j) => j !== i)); }

  function addVatCharge() {
    const vat = options?.chargeAccounts.find(a => a.account_name === 'VAT');
    setCharges(prev => [...prev, { charge_type: 'On Net Total', account_head: vat?.name ?? '', description: 'VAT @ 20.0', value: '20' }]);
  }
  function addShippingCharge() {
    const freight = options?.chargeAccounts.find(a => a.account_name.includes('Freight'));
    setCharges(prev => [...prev, { charge_type: 'Actual', account_head: freight?.name ?? '', description: 'Shipping', value: '' }]);
  }

  function buildTaxes(rows: ChargeRow[], net: number) {
    return rows
      .filter(c => c.account_head && parseFloat(c.value) >= 0)
      .map(c => ({
        charge_type: c.charge_type,
        account_head: c.account_head,
        description: c.description || (c.charge_type === 'On Net Total' ? `${c.value}%` : 'Charge'),
        rate: c.charge_type === 'On Net Total' ? parseFloat(c.value) || 0 : 0,
        tax_amount: c.charge_type === 'Actual' ? parseFloat(c.value) || 0 : 0,
      }));
  }

  async function createOrder() {
    const validLines = lines.filter(l => l.item_code && parseFloat(l.qty) > 0);
    if (!supplier || validLines.length === 0) return;
    setCreating(true);
    const r = await fetch('/api/admin/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        supplier,
        transaction_date: orderDate,
        schedule_date: deliveryDate,
        items: validLines.map(l => ({
          item_code: l.item_code,
          qty: parseFloat(l.qty),
          rate: parseFloat(l.rate) || 0,
          warehouse,
        })),
        taxes: buildTaxes(charges, netTotal),
      }),
    });
    if (r.ok) {
      const order = await r.json();
      if (receiptFile) {
        const form = new FormData();
        form.append('file', receiptFile);
        await fetch(`/api/admin/purchase-orders/${encodeURIComponent(order.name)}/receipt`, {
          method: 'POST', credentials: 'include', body: form,
        });
      }
      if (linkTxn) {
        await fetch(`/api/admin/bank-transactions/${encodeURIComponent(linkTxn)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ linked_doctype: 'Purchase Order', linked_name: order.name }),
        });
        router.push(overviewPath);
        setCreating(false);
        return;
      }
      closePanel();
      await load(0);
    }
    setCreating(false);
  }

  async function load(start = 0) {
    const r = await fetch(`/api/admin/purchase-orders?start=${start}`, { credentials: 'include' });
    if (!r.ok) return;
    const data = await r.json();
    setOrders(prev => start > 0 ? [...prev, ...data.orders] : data.orders);
    setHasMore(data.hasMore);
  }

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function toggle(name: string) {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    if (!detail[name]) {
      setLoadingDetail(name);
      const r = await fetch(`/api/admin/purchase-orders/${encodeURIComponent(name)}`, { credentials: 'include' });
      if (r.ok) { const json = await r.json(); setDetail(prev => ({ ...prev, [name]: json })); }
      setLoadingDetail(null);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    await load(orders.length);
    setLoadingMore(false);
  }

  const fetchPiOptions = useCallback(async () => {
    if (piOptions) return;
    const r = await fetch('/api/admin/purchase-invoices/options', { credentials: 'include' });
    if (r.ok) {
      const data: PIOptions = await r.json();
      setPiOptions(data);
      setPiCashBankAccount(data.banks.find(b => b.name.includes('Revolut'))?.name ?? data.banks[0]?.name ?? '');
      setPiModeOfPayment(data.modesOfPayment.find(m => m === 'Wire Transfer') ?? data.modesOfPayment[0] ?? '');
    }
  }, [piOptions]);

  function openPiPanel(order: PODetail) {
    setPiSource(order);
    setPiItems(order.items.map(it => ({
      item_code: it.item_code,
      qty: String(it.qty),
      rate: it.rate.toFixed(2),
      amount: it.amount.toFixed(2),
      lastEdited: 'rate',
    })));
    setPiCharges(order.taxes.map(t => ({
      charge_type: (t.charge_type as ChargeType) === 'On Net Total' ? 'On Net Total' : 'Actual',
      account_head: t.account_head,
      description: t.description,
      value: t.charge_type === 'On Net Total' ? String(t.rate) : String(t.tax_amount),
    })));
    setPiPostingDate(new Date().toISOString().slice(0, 10));
    setPiPostingTime(new Date().toTimeString().slice(0, 5));
    setPiIsPaid(true);
    setPiUpdateStock(true);
    setPiOpen(true);
    fetchPiOptions();
  }

  function closePiPanel() {
    setPiOpen(false);
    setPiSource(null);
    setPiItems([]);
    setPiCharges([]);
  }

  function updatePiLine(i: number, patch: Partial<LineForm>) {
    setPiItems(prev => prev.map((l, j) => j === i ? recomputeLine(l, patch) : l));
  }

  async function createInvoice() {
    if (!piSource) return;
    const validLines = piItems.filter(l => l.item_code && parseFloat(l.qty) > 0);
    if (validLines.length === 0) return;
    setPiCreating(true);
    const r = await fetch('/api/admin/purchase-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        supplier: piSource.supplier,
        posting_date: piPostingDate,
        posting_time: `${piPostingTime}:00`,
        is_paid: piIsPaid,
        update_stock: piUpdateStock,
        mode_of_payment: piModeOfPayment,
        cash_bank_account: piCashBankAccount,
        paid_amount: piTotal,
        items: validLines.map((l, i) => {
          const source = piSource.items[i];
          return {
            item_code: l.item_code,
            qty: parseFloat(l.qty),
            rate: parseFloat(l.rate) || 0,
            warehouse: source?.warehouse,
            uom: source?.uom,
            purchase_order: piSource.name,
            po_detail: source?.name,
          };
        }),
        taxes: buildTaxes(piCharges, piNetTotal),
      }),
    });
    if (r.ok) {
      closePiPanel();
    }
    setPiCreating(false);
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
          <p className="mt-0.5 text-sm text-gray-400">Live from ERPNext</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-400">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
          <button
            onClick={openPanel}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            + New order
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}

      {!loading && orders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">No purchase orders found in ERPNext.</p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="grid grid-cols-[1fr_140px_140px_120px_140px_40px] gap-4 border-b border-gray-100 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <span>Supplier</span>
            <span>Order date</span>
            <span>Expected</span>
            <span className="text-right">Total</span>
            <span>Status</span>
            <span />
          </div>

          {orders.map((order, i) => (
            <div key={order.name} className={i < orders.length - 1 ? 'border-b border-gray-50' : ''}>
              <button
                onClick={() => toggle(order.name)}
                className="grid w-full grid-cols-[1fr_140px_140px_120px_140px_40px] gap-4 px-6 py-4 text-left transition-colors hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{order.supplier}</p>
                  <p className="truncate text-xs text-gray-400">{order.name}</p>
                </div>
                <div className="self-center">
                  <p className="text-sm text-gray-700">{fmtDate(order.transaction_date)}</p>
                </div>
                <div className="self-center">
                  <p className="text-sm text-gray-700">{order.schedule_date ? fmtDate(order.schedule_date) : '—'}</p>
                </div>
                <div className="self-center text-right">
                  <p className="text-sm font-medium text-gray-900">{fmt(order.grand_total)}</p>
                </div>
                <div className="self-center">
                  <StatusBadge docstatus={order.docstatus} />
                </div>
                <div className="flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    className={`text-gray-300 transition-transform ${expanded === order.name ? 'rotate-180' : ''}`}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </button>

              {expanded === order.name && (
                <div className="border-t border-gray-50 bg-gray-50/60 px-6 py-5">
                  {loadingDetail === order.name && <p className="text-sm text-gray-400">Loading…</p>}
                  {detail[order.name] && (() => {
                    const d = detail[order.name];
                    return (
                      <>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[11px] text-gray-400">
                              <th className="pb-2 text-left font-medium">Item</th>
                              <th className="pb-2 text-right font-medium">Qty</th>
                              <th className="pb-2 text-right font-medium">Rate</th>
                              <th className="pb-2 text-right font-medium">Amount</th>
                              <th className="pb-2 text-left font-medium pl-4">Warehouse</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {d.items.map((line, j) => (
                              <tr key={j}>
                                <td className="py-2 pr-4 text-gray-900">{line.item_name}</td>
                                <td className="py-2 text-right text-gray-700">{line.qty}</td>
                                <td className="py-2 text-right text-gray-700">{fmt(line.rate)}</td>
                                <td className="py-2 text-right text-gray-700">{fmt(line.amount)}</td>
                                <td className="py-2 pl-4 text-gray-400">{line.warehouse}</td>
                              </tr>
                            ))}
                            {d.taxes?.map((t, j) => (
                              <tr key={`tax-${j}`}>
                                <td className="py-2 pr-4 text-gray-500" colSpan={3}>{t.description || t.account_head}</td>
                                <td className="py-2 text-right text-gray-700">{fmt(t.tax_amount)}</td>
                                <td />
                              </tr>
                            ))}
                            <tr className="border-t border-gray-200 font-medium">
                              <td className="pt-2 text-gray-700" colSpan={3}>Total</td>
                              <td className="pt-2 text-right text-gray-900">{fmt(d.grand_total)}</td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                        <div className="mt-4 flex items-center gap-4">
                          <button
                            onClick={e => { e.stopPropagation(); openPiPanel(d); }}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
                          >
                            Create Purchase Invoice
                          </button>
                          {d.custom_attach_receipt && (
                            <a
                              href={`${process.env.NEXT_PUBLIC_ERPNEXT_URL ?? 'https://www.erpnext.nathanjohncooper.co.uk'}${d.custom_attach_receipt}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-700"
                            >
                              View receipt
                            </a>
                          )}
                          <a
                            href={`${process.env.NEXT_PUBLIC_ERPNEXT_URL ?? 'https://www.erpnext.nathanjohncooper.co.uk'}/app/purchase-order/${order.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            Open in ERPNext
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </a>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button onClick={loadMore} disabled={loadingMore}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {/* Full-screen panel — sits to the right of the admin sidebar (w-60) */}
      {panelOpen && (
        <div className="fixed inset-y-0 right-0 left-60 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-8 py-4">
            <h2 className="text-lg font-semibold text-gray-900">New purchase order</h2>
            <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="flex-1 overflow-auto px-8 py-6">
            {!options ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="mx-auto max-w-4xl space-y-8">
                <div className="grid grid-cols-4 gap-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Supplier</span>
                    <select value={supplier} onChange={e => setSupplier(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                      {options.suppliers.map(s => <option key={s.name} value={s.name}>{s.supplier_name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Date</span>
                    <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Required by</span>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Deliver to warehouse</span>
                    <select value={warehouse} onChange={e => setWarehouse(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                      {options.warehouses.map(w => <option key={w.name} value={w.name}>{w.warehouse_name}</option>)}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Attach receipt</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                    >
                      {receiptFile ? 'Replace file' : 'Choose file…'}
                    </button>
                    {receiptFile && <span className="text-sm text-gray-600">{receiptFile.name}</span>}
                    <input
                      ref={receiptInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </label>

                {/* Items table */}
                <div>
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Items</span>
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-[11px] text-gray-400">
                          <th className="px-4 py-2.5 text-left font-medium">Item</th>
                          <th className="w-28 px-4 py-2.5 text-right font-medium">Qty</th>
                          <th className="w-32 px-4 py-2.5 text-right font-medium">Rate (£)</th>
                          <th className="w-32 px-4 py-2.5 text-right font-medium">Amount (£)</th>
                          <th className="w-10 px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lines.map((line, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2">
                              <select value={line.item_code} onChange={e => updateLine(i, { item_code: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                                <option value="">Select item…</option>
                                {options.items.map(it => <option key={it.name} value={it.name}>{it.item_name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" step="1" placeholder="0" value={line.qty}
                                onChange={e => updateLine(i, { qty: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" step="0.01" placeholder="0.00" value={line.rate}
                                onChange={e => updateLine(i, { rate: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" step="0.01" placeholder="0.00" value={line.amount}
                                onChange={e => updateLine(i, { amount: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-gray-500">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={addLine} className="mt-3 text-xs font-medium text-gray-500 hover:text-gray-800">
                    + Add item
                  </button>
                </div>

                {/* Taxes and charges table */}
                <div>
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Taxes and charges</span>
                  {charges.length > 0 && (
                    <div className="mb-3 overflow-hidden rounded-2xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50 text-[11px] text-gray-400">
                            <th className="px-4 py-2.5 text-left font-medium">Account</th>
                            <th className="w-40 px-4 py-2.5 text-left font-medium">Description</th>
                            <th className="w-36 px-4 py-2.5 text-left font-medium">Type</th>
                            <th className="w-28 px-4 py-2.5 text-right font-medium">Value</th>
                            <th className="w-28 px-4 py-2.5 text-right font-medium">Amount</th>
                            <th className="w-10 px-4 py-2.5" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {charges.map((c, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2">
                                <select value={c.account_head} onChange={e => updateCharge(i, { account_head: e.target.value })}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                                  <option value="">Select account…</option>
                                  {options.chargeAccounts.map(a => <option key={a.name} value={a.name}>{a.account_name}</option>)}
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <input value={c.description} onChange={e => updateCharge(i, { description: e.target.value })}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                              </td>
                              <td className="px-4 py-2">
                                <select value={c.charge_type} onChange={e => updateCharge(i, { charge_type: e.target.value as ChargeType })}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                                  <option value="On Net Total">% of net total</option>
                                  <option value="Actual">Fixed amount</option>
                                </select>
                              </td>
                              <td className="px-4 py-2">
                                <input type="number" min="0" step="0.01" placeholder={c.charge_type === 'On Net Total' ? '%' : '£'} value={c.value}
                                  onChange={e => updateCharge(i, { value: e.target.value })}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-500">{fmt(chargeAmount(c, netTotal))}</td>
                              <td className="px-4 py-2 text-center">
                                <button onClick={() => removeCharge(i)} className="text-gray-300 hover:text-gray-500">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={addVatCharge} className="text-xs font-medium text-gray-500 hover:text-gray-800">+ Add VAT</button>
                    <button onClick={addShippingCharge} className="text-xs font-medium text-gray-500 hover:text-gray-800">+ Add shipping</button>
                    <button onClick={() => setCharges(prev => [...prev, emptyCharge()])} className="text-xs font-medium text-gray-500 hover:text-gray-800">+ Add charge</button>
                  </div>
                </div>

                <div className="space-y-1 border-t border-gray-100 pt-4 text-sm">
                  <div className="flex items-center justify-end gap-3 text-gray-500">
                    <span>Net total</span>
                    <span className="w-28 text-right">{fmt(netTotal)}</span>
                  </div>
                  {charges.length > 0 && (
                    <div className="flex items-center justify-end gap-3 text-gray-500">
                      <span>Taxes and charges</span>
                      <span className="w-28 text-right">{fmt(chargesTotal)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-gray-500">Total</span>
                    <span className="w-28 text-right text-lg font-semibold text-gray-900">{fmt(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {options && (
            <div className="border-t border-gray-100 px-8 py-4">
              <div className="mx-auto flex max-w-4xl justify-end">
                <button
                  onClick={createOrder}
                  disabled={creating || !supplier || !lines.some(l => l.item_code && parseFloat(l.qty) > 0)}
                  className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {creating ? 'Creating…' : 'Save as draft'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full-screen panel — new Purchase Invoice from an existing PO */}
      {piOpen && piSource && (
        <div className="fixed inset-y-0 right-0 left-60 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-8 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">New purchase invoice</h2>
              <p className="text-xs text-gray-400">From {piSource.name} — {piSource.supplier}</p>
            </div>
            <button onClick={closePiPanel} className="text-gray-400 hover:text-gray-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="flex-1 overflow-auto px-8 py-6">
            {!piOptions ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="mx-auto max-w-4xl space-y-8">
                <div className="grid grid-cols-4 gap-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Posting date</span>
                    <input type="date" value={piPostingDate} onChange={e => setPiPostingDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Posting time</span>
                    <input type="time" value={piPostingTime} onChange={e => setPiPostingTime(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2">
                    <input type="checkbox" checked={piIsPaid} onChange={e => setPiIsPaid(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400" />
                    <span className="text-sm text-gray-700">Is paid</span>
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2">
                    <input type="checkbox" checked={piUpdateStock} onChange={e => setPiUpdateStock(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400" />
                    <span className="text-sm text-gray-700">Update stock</span>
                  </label>
                </div>

                {piIsPaid && (
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Mode of payment</span>
                      <select value={piModeOfPayment} onChange={e => setPiModeOfPayment(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                        {piOptions.modesOfPayment.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Paid from account</span>
                      <select value={piCashBankAccount} onChange={e => setPiCashBankAccount(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                        {piOptions.banks.map(b => <option key={b.name} value={b.name}>{b.account_name}</option>)}
                      </select>
                    </label>
                  </div>
                )}

                <div>
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Items</span>
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-[11px] text-gray-400">
                          <th className="px-4 py-2.5 text-left font-medium">Item</th>
                          <th className="w-28 px-4 py-2.5 text-right font-medium">Qty</th>
                          <th className="w-32 px-4 py-2.5 text-right font-medium">Rate (£)</th>
                          <th className="w-32 px-4 py-2.5 text-right font-medium">Amount (£)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {piItems.map((line, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-sm text-gray-900">{piSource.items[i]?.item_name}</td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" step="1" value={line.qty}
                                onChange={e => updatePiLine(i, { qty: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" step="0.01" value={line.rate}
                                onChange={e => updatePiLine(i, { rate: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" step="0.01" value={line.amount}
                                onChange={e => updatePiLine(i, { amount: e.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {piCharges.length > 0 && (
                  <div>
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Taxes and charges (from {piSource.name})</span>
                    <div className="overflow-hidden rounded-2xl border border-gray-200">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {piCharges.map((c, j) => (
                            <tr key={j}>
                              <td className="px-4 py-2 text-gray-700">{c.description}</td>
                              <td className="px-4 py-2 text-right text-gray-500">{fmt(chargeAmount(c, piNetTotal))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4 text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="w-28 text-right text-lg font-semibold text-gray-900">{fmt(piTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {piOptions && (
            <div className="border-t border-gray-100 px-8 py-4">
              <div className="mx-auto flex max-w-4xl justify-end">
                <button
                  onClick={createInvoice}
                  disabled={piCreating || !piItems.some(l => l.item_code && parseFloat(l.qty) > 0) || (piIsPaid && (!piModeOfPayment || !piCashBankAccount))}
                  className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {piCreating ? 'Creating…' : 'Save as draft'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
