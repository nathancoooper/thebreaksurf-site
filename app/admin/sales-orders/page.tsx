'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import CustomerPicker, { type CustomerOption } from '@/components/admin/CustomerPicker';
import SalesProductPicker, { type SalesProduct } from '@/components/admin/SalesProductPicker';

interface Customer { name: string; customer_name: string }
type Item = SalesProduct;
interface Warehouse { name: string; warehouse_name: string }
interface Account { name: string; account_name: string }
interface Bank { name: string; account_name: string; account: string }
interface Options {
  customers: Customer[];
  items: Item[];
  warehouses: Warehouse[];
  incomeAccounts: Account[];
  chargeAccounts: Account[];
  banks: Bank[];
  modesOfPayment: string[];
}

interface OrderRow {
  name: string;
  customer: string;
  customer_name: string;
  transaction_date: string;
  delivery_date: string;
  grand_total: number;
  status: string;
  docstatus: number;
  per_billed: number;
}

interface OrderItem {
  name: string;
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  warehouse: string;
  income_account: string;
  uom: string;
}

interface OrderTax {
  charge_type: string;
  account_head: string;
  description: string;
  rate: number;
  tax_amount: number;
  total: number;
}

interface OrderDetail extends OrderRow {
  items: OrderItem[];
  taxes: OrderTax[];
  po_no?: string | null;
  terms?: string | null;
}

type ChargeType = 'On Net Total' | 'Actual';
interface LineForm { item_code: string; qty: string; rate: string }
interface ChargeForm { charge_type: ChargeType; account_head: string; description: string; value: string }

const ERP_URL = process.env.NEXT_PUBLIC_ERPNEXT_URL ?? 'https://www.erpnext.nathanjohncooper.co.uk';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function emptyLine(): LineForm {
  return { item_code: '', qty: '1', rate: '' };
}

function emptyCharge(): ChargeForm {
  return { charge_type: 'Actual', account_head: '', description: '', value: '' };
}

function preferredWarehouse(options: Options | null) {
  return options?.warehouses.find(option => option.warehouse_name === 'Finished Goods')?.name
    ?? options?.warehouses[0]?.name
    ?? '';
}

function preferredIncomeAccount(options: Options | null) {
  return options?.incomeAccounts.find(option => option.account_name === 'Sales')?.name
    ?? options?.incomeAccounts[0]?.name
    ?? '';
}

function stripePaymentUrl(terms: string | null | undefined) {
  return terms?.match(/<!--\s*stripe-payment-url:(https:\/\/[^<\s]+)\s*-->/)?.[1] ?? null;
}

function orderStatus(order: OrderRow) {
  if (order.docstatus === 2) return { label: 'Cancelled', className: 'bg-red-50 text-red-600', dot: 'bg-red-400' };
  if ((order.per_billed ?? 0) >= 99.99) return { label: 'Paid', className: 'bg-green-50 text-green-700', dot: 'bg-green-500' };
  if (order.docstatus === 1) return { label: 'Awaiting payment', className: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400' };
  return { label: 'Draft', className: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' };
}

function StatusBadge({ order }: { order: OrderRow }) {
  const status = orderStatus(order);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
      {status.label}
    </span>
  );
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, OrderDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderDetail | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [customer, setCustomer] = useState('');
  const [orderDate, setOrderDate] = useState(today());
  const [deliveryDate, setDeliveryDate] = useState(daysFromToday(7));
  const [customerReference, setCustomerReference] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [incomeAccount, setIncomeAccount] = useState('');
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);
  const [pickerLine, setPickerLine] = useState<number | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [charges, setCharges] = useState<ChargeForm[]>([]);
  const [createStripeLink, setCreateStripeLink] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdPaymentLink, setCreatedPaymentLink] = useState<{ order: string; url: string } | null>(null);

  const [paymentOrder, setPaymentOrder] = useState<OrderRow | null>(null);
  const [paymentDate, setPaymentDate] = useState(today());
  const [modeOfPayment, setModeOfPayment] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async (start = 0) => {
    const response = await fetch(`/api/admin/sales-orders?start=${start}`, { credentials: 'include' });
    if (!response.ok) {
      setError('Could not load Sales Orders from ERPNext.');
      return;
    }
    const data = await response.json();
    setOrders(previous => start ? [...previous, ...data.orders] : data.orders);
    setHasMore(data.hasMore);
  }, []);

  useEffect(() => {
    // The initial load deliberately owns the page-level loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().finally(() => setLoading(false));
  }, [load]);

  const fetchOptions = useCallback(async (initializeOrderForm = true) => {
    if (options || optionsLoading) return;
    setOptionsLoading(true);
    const response = await fetch('/api/admin/sales-orders/options', { credentials: 'include' });
    if (response.ok) {
      const data: Options = await response.json();
      setOptions(data);
      if (initializeOrderForm) {
        setCustomer(data.customers.find(option => option.name === 'Unknown')?.name ?? data.customers[0]?.name ?? '');
        setWarehouse(preferredWarehouse(data));
        setIncomeAccount(preferredIncomeAccount(data));
      } else {
        // Older Sales Orders may not carry these child-row defaults. Keep
        // their real values when present and fill only genuinely blank ones.
        setWarehouse(current => current || preferredWarehouse(data));
        setIncomeAccount(current => current || preferredIncomeAccount(data));
      }
      setModeOfPayment(data.modesOfPayment.find(mode => mode === 'Wire Transfer') ?? data.modesOfPayment[0] ?? '');
      setBankAccount(data.banks.find(bank => bank.account_name.includes('Revolut'))?.account ?? data.banks[0]?.account ?? '');
    } else {
      setError('Could not load ERPNext Sales Order options.');
    }
    setOptionsLoading(false);
  }, [options, optionsLoading]);

  function openPanel() {
    setError(null);
    setEditingOrder(null);
    setPanelOpen(true);
    fetchOptions();
  }

  function closePanel() {
    setPanelOpen(false);
    setEditingOrder(null);
    setOrderDate(today());
    setDeliveryDate(daysFromToday(7));
    setCustomerReference('');
    setLines([emptyLine()]);
    setPickerLine(null);
    setCustomerPickerOpen(false);
    setCharges([]);
    setCreateStripeLink(false);
  }

  const netTotal = useMemo(
    () => lines.reduce((sum, line) => sum + (parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0), 0),
    [lines],
  );
  const chargesTotal = useMemo(
    () => charges.reduce((sum, charge) => {
      const value = parseFloat(charge.value) || 0;
      return sum + (charge.charge_type === 'On Net Total' ? netTotal * value / 100 : value);
    }, 0),
    [charges, netTotal],
  );

  function updateLine(index: number, patch: Partial<LineForm>) {
    setLines(previous => previous.map((line, current) => current === index ? { ...line, ...patch } : line));
  }

  function updateCharge(index: number, patch: Partial<ChargeForm>) {
    setCharges(previous => previous.map((charge, current) => current === index ? { ...charge, ...patch } : charge));
  }

  function addVat() {
    const vat = options?.chargeAccounts.find(account => account.account_name.toLowerCase().includes('vat'));
    setCharges(previous => [...previous, {
      charge_type: 'On Net Total',
      account_head: vat?.name ?? '',
      description: 'VAT @ 20%',
      value: '20',
    }]);
  }

  function addShipping() {
    const sales = options?.incomeAccounts.find(account => account.account_name === 'Sales');
    setCharges(previous => [...previous, {
      charge_type: 'Actual',
      account_head: sales?.name ?? incomeAccount,
      description: 'Shipping',
      value: '',
    }]);
  }

  async function createOrder() {
    const validLines = lines.filter(line => line.item_code && parseFloat(line.qty) > 0 && parseFloat(line.rate) >= 0);
    if (!customer || validLines.length === 0 || !warehouse || !incomeAccount) {
      setError('Choose a customer, warehouse, income account, and at least one valid item.');
      return;
    }

    setCreating(true);
    setError(null);
    const response = await fetch(
      editingOrder
        ? `/api/admin/sales-orders/${encodeURIComponent(editingOrder.name)}`
        : '/api/admin/sales-orders',
      {
        method: editingOrder ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customer,
          transaction_date: orderDate,
          delivery_date: deliveryDate,
          customer_reference: customerReference,
          items: validLines.map(line => ({
            item_code: line.item_code,
            qty: parseFloat(line.qty),
            rate: parseFloat(line.rate),
            warehouse,
            income_account: incomeAccount,
          })),
          taxes: charges
            .filter(charge => charge.account_head && parseFloat(charge.value) >= 0)
            .map(charge => ({
              charge_type: charge.charge_type,
              account_head: charge.account_head,
              description: charge.description || 'Charge',
              rate: charge.charge_type === 'On Net Total' ? parseFloat(charge.value) || 0 : 0,
              tax_amount: charge.charge_type === 'Actual' ? parseFloat(charge.value) || 0 : 0,
            })),
          create_stripe_payment_link: createStripeLink,
        }),
      },
    );

    if (response.ok) {
      const data = await response.json();
      closePanel();
      await load();
      if (data.stripe_payment_url) {
        setCreatedPaymentLink({ order: data.name, url: data.stripe_payment_url });
      }
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'ERPNext rejected this Sales Order.');
    }
    setCreating(false);
  }

  function editOrder(order: OrderDetail) {
    setError(null);
    setEditingOrder(order);
    setCustomer(order.customer);
    setOrderDate(order.transaction_date);
    setDeliveryDate(order.delivery_date);
    setCustomerReference(order.po_no ?? '');
    setWarehouse(order.items[0]?.warehouse || preferredWarehouse(options));
    setIncomeAccount(order.items[0]?.income_account || preferredIncomeAccount(options));
    setLines(order.items.map(item => ({
      item_code: item.item_code,
      qty: String(item.qty),
      rate: String(item.rate),
    })));
    setCharges(order.taxes.map(tax => ({
      charge_type: tax.charge_type === 'On Net Total' ? 'On Net Total' : 'Actual',
      account_head: tax.account_head,
      description: tax.description,
      value: String(tax.charge_type === 'On Net Total' ? tax.rate : tax.tax_amount),
    })));
    setCreateStripeLink(Boolean(stripePaymentUrl(order.terms)));
    setPanelOpen(true);
    fetchOptions(false);
  }

  async function toggle(order: OrderRow) {
    if (expanded === order.name) {
      setExpanded(null);
      return;
    }
    setExpanded(order.name);
    if (!details[order.name]) {
      setLoadingDetail(order.name);
      const response = await fetch(`/api/admin/sales-orders/${encodeURIComponent(order.name)}`, { credentials: 'include' });
      if (response.ok) {
        const detail = await response.json();
        setDetails(previous => ({ ...previous, [order.name]: detail }));
      }
      setLoadingDetail(null);
    }
  }

  function openPayment(order: OrderRow) {
    setPaymentOrder(order);
    setPaymentDate(today());
    setPaymentError(null);
    fetchOptions();
  }

  async function markPaid() {
    if (!paymentOrder || !modeOfPayment) return;
    setMarkingPaid(true);
    setPaymentError(null);
    const response = await fetch(`/api/admin/sales-orders/${encodeURIComponent(paymentOrder.name)}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        posting_date: paymentDate,
        mode_of_payment: modeOfPayment,
        cash_bank_account: bankAccount || undefined,
      }),
    });

    if (response.ok) {
      setPaymentOrder(null);
      setDetails(previous => {
        const next = { ...previous };
        delete next[paymentOrder.name];
        return next;
      });
      await load();
    } else {
      const data = await response.json().catch(() => ({}));
      setPaymentError(data.error ?? 'ERPNext could not complete this sale.');
    }
    setMarkingPaid(false);
  }

  async function cancelOrder(order: OrderRow) {
    if (!window.confirm(`Cancel ${order.name}? This cannot be undone.`)) return;
    setCancelling(order.name);
    setError(null);
    const response = await fetch(`/api/admin/sales-orders/${encodeURIComponent(order.name)}/cancel`, {
      method: 'POST',
      credentials: 'include',
    });
    if (response.ok) {
      await load();
    } else {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? 'ERPNext rejected this cancellation.');
    }
    setCancelling(null);
  }

  const erpOrderUrl = (name: string) => `${ERP_URL}/app/sales-order/${encodeURIComponent(name)}`;
  const printUrl = (name: string) => `/api/admin/sales-orders/${encodeURIComponent(name)}/pdf`;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Orders</h1>
          <p className="mt-1 text-sm text-gray-400">Create pro-forma orders, then invoice, take payment, and update stock in one step.</p>
        </div>
        <button onClick={openPanel}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700">
          New sales order
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        {loading ? (
          <p className="p-6 text-sm text-gray-400">Loading Sales Orders…</p>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-gray-700">No Sales Orders yet</p>
            <p className="mt-1 text-sm text-gray-400">Create one when you need to request payment before recording the sale.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map(order => {
              const detail = details[order.name];
              const paymentUrl = stripePaymentUrl(detail?.terms);
              const canMarkPaid = order.docstatus === 1 && (order.per_billed ?? 0) < 0.01;
              const canCancel = canMarkPaid;
              return (
                <div key={order.name}>
                  <button onClick={() => toggle(order)}
                    className="grid w-full grid-cols-[1.1fr_1.5fr_1fr_1fr_1fr_24px] items-center gap-4 px-5 py-4 text-left hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{order.name}</p>
                      <p className="text-xs text-gray-400">{fmtDate(order.transaction_date)}</p>
                    </div>
                    <p className="truncate text-sm text-gray-700">{order.customer_name || order.customer}</p>
                    <p className="text-sm text-gray-500">Due {fmtDate(order.delivery_date)}</p>
                    <StatusBadge order={order} />
                    <p className="text-right text-sm font-semibold text-gray-900">{fmt(order.grand_total)}</p>
                    <span className={`text-gray-400 transition-transform ${expanded === order.name ? 'rotate-180' : ''}`}>⌄</span>
                  </button>

                  {expanded === order.name && (
                    <div className="border-t border-gray-100 bg-gray-50/60 px-6 py-5">
                      {loadingDetail === order.name || !detail ? (
                        <p className="text-sm text-gray-400">Loading details…</p>
                      ) : (
                        <div className="space-y-5">
                          {detail.po_no && (
                            <p className="text-xs text-gray-500">Customer reference: <span className="font-medium text-gray-700">{detail.po_no}</span></p>
                          )}
                          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
                                <tr>
                                  <th className="px-4 py-2.5 text-left font-medium">Item</th>
                                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                                  <th className="px-4 py-2.5 text-right font-medium">Rate</th>
                                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {detail.items.map(item => (
                                  <tr key={item.name}>
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-gray-800">{item.item_name}</p>
                                      <p className="text-xs text-gray-400">{item.item_code}</p>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-600">{item.qty} {item.uom}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{fmt(item.rate)}</td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(item.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <a href={erpOrderUrl(order.name)} target="_blank" rel="noreferrer"
                                className="text-xs font-medium text-gray-500 hover:text-gray-900">Open in ERPNext ↗</a>
                              <a href={printUrl(order.name)}
                                className="text-xs font-medium text-gray-500 hover:text-gray-900">Export PDF ↓</a>
                              {paymentUrl && (
                                <a href={paymentUrl} target="_blank" rel="noreferrer"
                                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Stripe payment link ↗</a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {canCancel && (
                                <button onClick={() => editOrder(detail)}
                                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900">
                                  Edit order
                                </button>
                              )}
                              {canCancel && (
                                <button onClick={() => cancelOrder(order)} disabled={cancelling === order.name}
                                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-red-200 hover:text-red-600 disabled:opacity-40">
                                  {cancelling === order.name ? 'Cancelling…' : 'Cancel order'}
                                </button>
                              )}
                              {canMarkPaid && (
                                <button onClick={() => openPayment(order)}
                                  className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700">
                                  Mark paid
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <button disabled={loadingMore} onClick={async () => {
            setLoadingMore(true);
            await load(orders.length);
            setLoadingMore(false);
          }} className="text-sm font-medium text-gray-500 hover:text-gray-900 disabled:opacity-40">
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {panelOpen && (
        <div className="fixed inset-y-0 right-0 left-60 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-8 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editingOrder ? `Edit ${editingOrder.name}` : 'New sales order'}</h2>
              <p className="text-xs text-gray-400">
                {editingOrder
                  ? 'ERPNext will retain the original as cancelled and create an amended replacement.'
                  : 'A submitted ERPNext order with no ledger or stock movement until paid.'}
              </p>
            </div>
            <button onClick={closePanel} className="text-xl text-gray-400 hover:text-gray-700">×</button>
          </div>

          <div className="flex-1 overflow-auto px-8 py-6">
            {optionsLoading || !options ? (
              <p className="text-sm text-gray-400">Loading ERPNext options…</p>
            ) : (
              <div className="mx-auto max-w-4xl space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Customer</span>
                    <button
                      type="button"
                      onClick={() => setCustomerPickerOpen(true)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-gray-400 focus:border-gray-400 focus:outline-none"
                    >
                      <span>{options.customers.find(option => option.name === customer)?.customer_name ?? 'Choose a customer…'}</span>
                      <span className="text-xs text-gray-400">Browse</span>
                    </button>
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Customer reference (optional)</span>
                    <input value={customerReference} onChange={event => setCustomerReference(event.target.value)} placeholder="Their PO or reference"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Order date</span>
                    <input type="date" value={orderDate} onChange={event => setOrderDate(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Expected payment / delivery</span>
                    <input type="date" min={orderDate} value={deliveryDate} onChange={event => setDeliveryDate(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Warehouse</span>
                    <select value={warehouse} onChange={event => setWarehouse(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                      {options.warehouses.map(option => <option key={option.name} value={option.name}>{option.warehouse_name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Income account</span>
                    <select value={incomeAccount} onChange={event => setIncomeAccount(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none">
                      {!incomeAccount && <option value="">Choose an income account…</option>}
                      {options.incomeAccounts.map(option => <option key={option.name} value={option.name}>{option.account_name}</option>)}
                    </select>
                  </label>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Items</span>
                    <button onClick={() => setLines(previous => [...previous, emptyLine()])}
                      className="text-xs font-medium text-gray-500 hover:text-gray-900">+ Add item</button>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium">Item</th>
                          <th className="w-28 px-4 py-2.5 text-right font-medium">Qty</th>
                          <th className="w-32 px-4 py-2.5 text-right font-medium">Rate (£)</th>
                          <th className="w-32 px-4 py-2.5 text-right font-medium">Amount</th>
                          <th className="w-12" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lines.map((line, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => setPickerLine(index)}
                                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-gray-400 focus:border-gray-400 focus:outline-none"
                              >
                                <span className={line.item_code ? 'text-gray-700' : 'text-gray-400'}>
                                  {options.items.find(item => item.name === line.item_code)?.item_name ?? 'Choose item…'}
                                </span>
                                <span className="text-xs text-gray-400">Browse</span>
                              </button>
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0.001" step="1" value={line.qty} onChange={event => updateLine(index, { qty: event.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" step="0.01" value={line.rate} onChange={event => updateLine(index, { rate: event.target.value })}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700 focus:border-gray-400 focus:outline-none" />
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-gray-700">{fmt((parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0))}</td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => setLines(previous => previous.length > 1 ? previous.filter((_, current) => current !== index) : previous)}
                                className="text-gray-300 hover:text-red-500">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Taxes and charges</span>
                    <div className="flex gap-3">
                      <button onClick={addVat} className="text-xs font-medium text-gray-500 hover:text-gray-900">+ VAT</button>
                      <button onClick={addShipping} className="text-xs font-medium text-gray-500 hover:text-gray-900">+ Shipping</button>
                      <button onClick={() => setCharges(previous => [...previous, emptyCharge()])}
                        className="text-xs font-medium text-gray-500 hover:text-gray-900">+ Other</button>
                    </div>
                  </div>
                  {charges.length > 0 && (
                    <div className="space-y-2">
                      {charges.map((charge, index) => (
                        <div key={index} className="grid grid-cols-[1fr_1.2fr_1.2fr_120px_32px] gap-2">
                          <select value={charge.charge_type} onChange={event => updateCharge(index, { charge_type: event.target.value as ChargeType })}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                            <option value="Actual">Fixed amount</option>
                            <option value="On Net Total">% of net</option>
                          </select>
                          <select value={charge.account_head} onChange={event => updateCharge(index, { account_head: event.target.value })}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                            <option value="">Account…</option>
                            {options.chargeAccounts.map(account => <option key={account.name} value={account.name}>{account.account_name}</option>)}
                          </select>
                          <input value={charge.description} onChange={event => updateCharge(index, { description: event.target.value })} placeholder="Description"
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700" />
                          <input type="number" min="0" step="0.01" value={charge.value} onChange={event => updateCharge(index, { value: event.target.value })}
                            placeholder={charge.charge_type === 'On Net Total' ? '%' : '£'} className="rounded-lg border border-gray-200 px-3 py-2 text-right text-sm text-gray-700" />
                          <button onClick={() => setCharges(previous => previous.filter((_, current) => current !== index))}
                            className="text-gray-300 hover:text-red-500">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1 border-t border-gray-100 pt-4 text-sm">
                  <div className="flex justify-end gap-6 text-gray-500"><span>Net total</span><span className="w-28 text-right">{fmt(netTotal)}</span></div>
                  {charges.length > 0 && <div className="flex justify-end gap-6 text-gray-500"><span>Taxes and charges</span><span className="w-28 text-right">{fmt(chargesTotal)}</span></div>}
                  <div className="flex justify-end gap-6"><span className="text-gray-500">Total</span><span className="w-28 text-right text-lg font-semibold">{fmt(netTotal + chargesTotal)}</span></div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={createStripeLink}
                    onChange={event => setCreateStripeLink(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">Add a Stripe payment link</span>
                    <span className="mt-0.5 block text-xs text-gray-400">
                      Automatically creates a single-use card payment link and includes it in the exported Sales Order PDF.
                    </span>
                  </span>
                </label>
                {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              </div>
            )}
          </div>

          {options && (
            <div className="border-t border-gray-100 px-8 py-4">
              <div className="mx-auto flex max-w-4xl justify-end">
                <button onClick={createOrder} disabled={creating || !customer || !lines.some(line => line.item_code)}
                  className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40">
                  {creating ? (editingOrder ? 'Saving…' : 'Creating…') : (editingOrder ? 'Save amended order' : 'Create sales order')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {pickerLine !== null && options && (
        <SalesProductPicker
          items={options.items}
          onClose={() => setPickerLine(null)}
          onItemCreated={item => {
            setOptions(previous => previous ? { ...previous, items: [...previous.items, item] } : previous);
          }}
          onPick={(item: SalesProduct) => {
            updateLine(pickerLine, { item_code: item.name });
            setPickerLine(null);
          }}
        />
      )}

      {customerPickerOpen && options && (
        <CustomerPicker
          customers={options.customers}
          onClose={() => setCustomerPickerOpen(false)}
          onCreated={(created: CustomerOption) => {
            setOptions(previous => previous ? { ...previous, customers: [...previous.customers, created] } : previous);
          }}
          onPick={(picked: CustomerOption) => {
            setCustomer(picked.name);
            setCustomerPickerOpen(false);
          }}
        />
      )}

      {paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Mark {paymentOrder.name} paid</h2>
                <p className="mt-1 text-sm text-gray-400">
                  This creates and submits a {fmt(paymentOrder.grand_total)} Sales Invoice, records payment, and deducts stock.
                </p>
              </div>
              <button onClick={() => setPaymentOrder(null)} className="text-xl text-gray-400 hover:text-gray-700">×</button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Payment date</span>
                <input type="date" value={paymentDate} onChange={event => setPaymentDate(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Mode of payment</span>
                <select value={modeOfPayment} onChange={event => setModeOfPayment(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  {options?.modesOfPayment.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Paid into</span>
                <select value={bankAccount} onChange={event => setBankAccount(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                  <option value="">Use the mode of payment default</option>
                  {options?.banks.map(bank => <option key={bank.name} value={bank.account}>{bank.account_name}</option>)}
                </select>
              </label>
              {paymentError && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{paymentError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setPaymentOrder(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={markPaid} disabled={markingPaid || !modeOfPayment}
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40">
                {markingPaid ? 'Completing sale…' : 'Create paid invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {createdPaymentLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{createdPaymentLink.order} created</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Its single-use Stripe payment link is included in the Sales Order PDF.
                </p>
              </div>
              <button onClick={() => setCreatedPaymentLink(null)} className="text-xl text-gray-400 hover:text-gray-700">×</button>
            </div>
            <div className="mt-5 break-all rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {createdPaymentLink.url}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(createdPaymentLink.url)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-gray-400"
              >
                Copy link
              </button>
              <a
                href={`/api/admin/sales-orders/${encodeURIComponent(createdPaymentLink.order)}/pdf`}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:border-gray-400"
              >
                Export PDF
              </a>
              <a
                href={createdPaymentLink.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Open link ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
