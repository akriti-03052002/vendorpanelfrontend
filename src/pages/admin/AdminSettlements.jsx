import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, History, Landmark, RefreshCw, Search, Info, CalendarX2, X, Plus, Clock3, FileText, Download, FolderOpen } from "lucide-react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import { Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";

const STATUS_OPTIONS = ["draft", "pending_approval", "approved", "processing", "on_hold", "paid", "failed", "cancelled"];
const OWED_STATUSES = ["draft", "pending_approval", "approved", "processing", "on_hold"];
const HOLDABLE_STATUSES = ["draft", "pending_approval", "approved", "processing"];

// Settlement cycle, Razorpay-style: how often this partner's payouts run,
// not a per-transaction T+N promise — see SettlementSetting.settlementType.
const CYCLE_LABEL = {
  monthly: "Monthly cycle",
  quarterly: "Quarterly cycle",
  threshold: "Threshold-based",
  manual: "Manual"
};

const maskedAccount = (bankAccount) =>
  bankAccount ? `${bankAccount.bankName} •••• ${bankAccount.accountNumberLast4}` : "—";

const DURATIONS = [
  { key: "all", label: "All time", days: null },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 3 months", days: 90 },
  { key: "365d", label: "Last 1 year", days: 365 }
];

const money = (n, currency = "INR") =>
  `${currency === "INR" ? "₹" : currency + " "}${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const isToday = (date) => {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const timeAgo = (date) => {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours > 1 ? "s" : ""} ago`;
};

export default function AdminSettlements() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [duration, setDuration] = useState("all");
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [vendors, setVendors] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bill, setBill] = useState(null);
  const [billActionError, setBillActionError] = useState("");
  const [history, setHistory] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [partners, setPartners] = useState([]);
  const [partnerId, setPartnerId] = useState("");
  const [approvedCommissions, setApprovedCommissions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // { settlementId, paymentId, fetching, payment, error, submitting }
  const [payModal, setPayModal] = useState(null);
  // { mode: "hold" | "fail", settlementId, reason, submitting, error }
  const [reasonModal, setReasonModal] = useState(null);

  const load = () => {
    setLoading(true);
    return adminApi.get("/admin/settlements", { params: { partnerId: vendorFilter || undefined } })
      .then((res) => { setSettlements(res.data.data); setLastFetchedAt(new Date()); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [vendorFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    adminApi.get("/admin/partners", { params: { partnerType: "vendor" } }).then((res) => setVendors(res.data.data));
  }, []);

  useEffect(() => {
    if (showCreate) adminApi.get("/admin/partners", { params: { status: "active" } }).then((res) => setPartners(res.data.data));
  }, [showCreate]);

  useEffect(() => {
    if (partnerId) {
      adminApi.get("/admin/commissions", { params: { status: "approved", partnerId } })
        .then((res) => { setApprovedCommissions(res.data.data); setSelectedIds([]); });
    }
  }, [partnerId]);

  const loadBill = (id) => adminApi.get(`/admin/settlements/${id}/bill`).then((res) => setBill(res.data.data));

  useEffect(() => {
    if (!activeId) { setDetail(null); setBill(null); setHistory([]); return; }
    setDetailLoading(true);
    setBillActionError("");
    Promise.all([
      adminApi.get(`/admin/settlements/${activeId}`).then((res) => setDetail(res.data.data)),
      loadBill(activeId),
      adminApi.get(`/admin/settlements/${activeId}/history`).then((res) => setHistory(res.data.data))
    ]).finally(() => setDetailLoading(false));
  }, [activeId]);

  const verifyBillAction = async (status) => {
    setBillActionError("");
    const rejectionReason = status === "rejected" ? window.prompt("Reason for rejecting this bill:") : undefined;
    if (status === "rejected" && rejectionReason === null) return;
    try {
      await adminApi.patch(`/admin/settlements/${activeId}/bill/verify`, { status, rejectionReason });
      await Promise.all([loadBill(activeId), adminApi.get(`/admin/settlements/${activeId}`).then((res) => setDetail(res.data.data))]);
      load();
    } catch (err) {
      setBillActionError(err.response?.data?.message || "Something went wrong verifying the bill.");
    }
  };

  const previousPayout = useMemo(
    () => [...settlements].filter((s) => s.status === "paid").sort((a, b) => new Date(b.payment?.paidAt || 0) - new Date(a.payment?.paidAt || 0))[0],
    [settlements]
  );

  const todaysPayoutTotal = useMemo(
    () => settlements.filter((s) => isToday(s.payment?.paidAt)).reduce((sum, s) => sum + (s.amount?.net || 0), 0),
    [settlements]
  );

  const pendingApproval = useMemo(() => {
    const rows = settlements.filter((s) => ["draft", "pending_approval"].includes(s.status));
    return { count: rows.length, amount: rows.reduce((sum, s) => sum + (s.amount?.net || 0), 0) };
  }, [settlements]);

  const totalOwed = useMemo(
    () => settlements.filter((s) => OWED_STATUSES.includes(s.status)).reduce((sum, s) => sum + (s.amount?.net || 0), 0),
    [settlements]
  );

  const filtered = useMemo(() => {
    const durationDef = DURATIONS.find((d) => d.key === duration);
    const cutoff = durationDef?.days ? Date.now() - durationDef.days * 24 * 60 * 60 * 1000 : null;
    const q = search.trim().toLowerCase();

    return settlements.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (cutoff && new Date(s.createdAt).getTime() < cutoff) return false;
      if (q && !(s.settlementNumber?.toLowerCase().includes(q) || s.payment?.transactionId?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [settlements, statusFilter, duration, search]);

  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const createBatch = async () => {
    setError("");
    if (selectedIds.length === 0) { setError("Select at least one approved commission."); return; }
    setCreating(true);

    try {
      await adminApi.post("/admin/settlements", { partnerId, commissionIds: selectedIds });
      setShowCreate(false);
      setPartnerId("");
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong creating the settlement.");
    } finally {
      setCreating(false);
    }
  };

  const approve = async (id) => {
    await adminApi.patch(`/admin/settlements/${id}/approve`);
    load();
  };

  // Three ways to mark a settlement paid — see MarkPaidModal. Razorpay verify
  // never takes a transaction ID on faith: it's always fetched live from
  // Razorpay first so the admin sees the real amount/status before
  // confirming, and the backend independently re-fetches/validates it again.
  const openMarkPaid = (id) => setPayModal({
    settlementId: id, tab: "offline",
    paymentId: "", fetching: false, payment: null,
    offlineMethod: "bank_transfer", referenceNumber: "", note: "",
    error: "", submitting: false
  });

  const fetchRazorpayPayment = async () => {
    if (!payModal.paymentId.trim()) return;
    setPayModal((m) => ({ ...m, fetching: true, error: "", payment: null }));
    try {
      const res = await adminApi.get(`/admin/settlements/razorpay-payment/${payModal.paymentId.trim()}`);
      setPayModal((m) => ({ ...m, fetching: false, payment: res.data.data }));
    } catch (err) {
      setPayModal((m) => ({ ...m, fetching: false, error: err.response?.data?.message || "Couldn't fetch this payment from Razorpay." }));
    }
  };

  const confirmMarkPaid = async () => {
    setPayModal((m) => ({ ...m, submitting: true, error: "" }));
    try {
      await adminApi.patch(`/admin/settlements/${payModal.settlementId}/mark-paid`, { transactionId: payModal.paymentId.trim() });
      setPayModal(null);
      load();
    } catch (err) {
      setPayModal((m) => ({ ...m, submitting: false, error: err.response?.data?.message || "Couldn't mark this settlement paid." }));
    }
  };

  const confirmMarkPaidOffline = async () => {
    if (!payModal.referenceNumber.trim()) {
      setPayModal((m) => ({ ...m, error: "A reference number (UTR / cheque no. / etc) is required." }));
      return;
    }
    setPayModal((m) => ({ ...m, submitting: true, error: "" }));
    try {
      await adminApi.patch(`/admin/settlements/${payModal.settlementId}/mark-paid-offline`, {
        method: payModal.offlineMethod,
        referenceNumber: payModal.referenceNumber.trim(),
        note: payModal.note.trim() || undefined
      });
      setPayModal(null);
      load();
    } catch (err) {
      setPayModal((m) => ({ ...m, submitting: false, error: err.response?.data?.message || "Couldn't mark this settlement paid." }));
    }
  };

  // window.prompt() used to be used here — swapped for a real modal since
  // native dialogs silently do nothing in browsers/extensions that block
  // them, and the old code had no error handling either, so any backend
  // rejection (e.g. wrong status) failed completely silently too.
  const openReasonModal = (mode, id) => setReasonModal({ mode, settlementId: id, reason: "", submitting: false, error: "" });

  const submitReasonModal = async () => {
    setReasonModal((m) => ({ ...m, submitting: true, error: "" }));
    try {
      const path = reasonModal.mode === "hold" ? "hold" : "fail";
      await adminApi.patch(`/admin/settlements/${reasonModal.settlementId}/${path}`, { reason: reasonModal.reason });
      setReasonModal(null);
      load();
    } catch (err) {
      setReasonModal((m) => ({ ...m, submitting: false, error: err.response?.data?.message || `Couldn't ${reasonModal.mode === "hold" ? "hold" : "fail"} this settlement.` }));
    }
  };

  const releaseSettlement = async (id) => {
    try {
      await adminApi.patch(`/admin/settlements/${id}/release`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Couldn't release this hold.");
    }
  };

  const retrySettlement = async (id) => {
    await adminApi.patch(`/admin/settlements/${id}/retry`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Settlements</h1>
          {lastFetchedAt && <span className="text-xs text-slate-400">{timeAgo(lastFetchedAt)}</span>}
          <button onClick={load} disabled={loading} className="text-slate-400 hover:text-slate-600 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <span className="flex items-center gap-2"><Plus size={16} /> New Settlement Batch</span>
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <OverviewItem
            icon={CheckCircle2}
            iconTone="bg-emerald-50 text-emerald-600"
            label="Previous Payout"
            primary={previousPayout ? money(previousPayout.amount.net, previousPayout.amount.currency) : "No payout yet"}
            secondary={previousPayout?.payment?.paidAt ? new Date(previousPayout.payment.paidAt).toLocaleDateString() : null}
          />
          <OverviewItem
            icon={History}
            iconTone="bg-emerald-50 text-emerald-600"
            label="Today's Payouts"
            primary={money(todaysPayoutTotal)}
          />
          <OverviewItem
            icon={Info}
            iconTone="bg-amber-50 text-amber-600"
            label="Awaiting Approval"
            primary={`${pendingApproval.count} batch${pendingApproval.count === 1 ? "" : "es"}`}
            secondary={money(pendingApproval.amount)}
          />
          <div className="pt-4 lg:pt-0 lg:pl-6">
            <p className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4">Total Owed to Partners</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{money(totalOwed)}</p>
          </div>
        </div>
      </Card>

      {showCreate && (
        <Card className="p-6 space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

          <Select label="Partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Select a partner</option>
            {partners.map((p) => <option key={p._id} value={p._id}>{p.legalEntity.businessName || `${p.partnerCode} (incomplete profile)`}</option>)}
          </Select>

          {partnerId && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Approved commissions available</p>
              {approvedCommissions.length === 0 ? (
                <p className="text-sm text-slate-400">No approved commissions for this partner.</p>
              ) : (
                <div className="space-y-2">
                  {approvedCommissions.map((c) => (
                    <label key={c._id} className="flex items-center gap-3 text-sm border border-slate-100 rounded-xl p-3">
                      <input type="checkbox" checked={selectedIds.includes(c._id)} onChange={() => toggleSelect(c._id)} />
                      ₹{c.calculation.netCommission.toLocaleString()} — earned {new Date(c.createdAt).toLocaleDateString()}
                    </label>
                  ))}
                </div>
              )}
              <div className="flex justify-end mt-4">
                <Button onClick={createBatch} loading={creating}>Create Batch</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-2">
            <FilterPill label="All" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            {STATUS_OPTIONS.map((s) => (
              <FilterPill key={s} label={s.replace(/_/g, " ")} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="w-56">
              <option value="">All partners</option>
              {vendors.map((v) => (
                <option key={v._id} value={v._id}>{v.legalEntity.businessName} ({v.partnerCode})</option>
              ))}
            </Select>
            <Select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-40">
              {DURATIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </Select>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search settlement ID / UTR"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-3 w-56 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
              />
            </div>
          </div>
        </div>

        <Card>
          {loading ? (
            <p className="text-slate-400 text-sm p-6">Loading...</p>
          ) : (
            <Table
              empty={
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <CalendarX2 size={28} strokeWidth={1.5} />
                  <span>No settlements found</span>
                </div>
              }
              rows={filtered}
              columns={[
                { key: "createdOn", header: "Created On", render: (s) => new Date(s.createdAt).toLocaleDateString() },
                {
                  key: "number",
                  header: "Settlement ID",
                  render: (s) => (
                    <button onClick={() => setActiveId(s._id)} className="font-medium text-brand-red hover:underline">
                      {s.settlementNumber}
                    </button>
                  )
                },
                {
                  key: "partner",
                  header: "Partner",
                  render: (s) => (
                    <div className="flex flex-col gap-0.5">
                      <span>{s.partnerId?.legalEntity?.businessName || s.partnerId?.partnerCode || "—"}</span>
                      {s.partnerId?._id && (
                        <Link
                          to={`/admin/partners/${s.partnerId._id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
                        >
                          <FolderOpen size={12} /> View documents
                        </Link>
                      )}
                    </div>
                  )
                },
                {
                  key: "cycle",
                  header: "Cycle",
                  render: (s) => (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Clock3 size={12} className="text-slate-400" /> {CYCLE_LABEL[s.settlementType] || s.settlementType}
                    </span>
                  )
                },
                {
                  key: "bankAccount",
                  header: "Bank Account",
                  render: (s) => <span className="text-slate-600">{maskedAccount(s.bankAccount)}</span>
                },
                {
                  key: "utr",
                  header: (
                    <span className="inline-flex items-center gap-1">
                      UTR Number <Info size={12} className="text-slate-400" />
                    </span>
                  ),
                  render: (s) => s.payment?.transactionId || "—"
                },
                {
                  key: "net",
                  header: "Net Settlement",
                  render: (s) => (
                    <div>
                      <span className="font-semibold text-slate-900">{money(s.amount.net, s.amount.currency)}</span>
                      {s.amount.deductions > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {money(s.amount.gross, s.amount.currency)} − {money(s.amount.deductions, s.amount.currency)} fees/tax
                        </p>
                      )}
                    </div>
                  )
                },
                {
                  key: "bill",
                  header: "Bill",
                  render: (s) => s.bill ? (
                    <div className="flex flex-col gap-1 items-start">
                      <Badge status={s.bill.status} />
                      <BillDownloadButton settlementId={s._id} originalName={s.bill.file?.originalName} />
                    </div>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )
                },
                { key: "status", header: "Status", render: (s) => <Badge status={s.status} /> },
                {
                  key: "actions",
                  header: "",
                  render: (s) => (
                    <div className="flex gap-3">
                      {["draft", "pending_approval"].includes(s.status) && (
                        <button onClick={() => approve(s._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>
                      )}
                      {s.status === "approved" && (
                        <>
                          <button onClick={() => openMarkPaid(s._id)} className="text-xs font-semibold text-brand-red hover:underline">Mark Paid</button>
                          <button onClick={() => openReasonModal("fail", s._id)} className="text-xs font-semibold text-red-600 hover:underline">Mark Failed</button>
                        </>
                      )}
                      {s.status === "failed" && (
                        <button onClick={() => retrySettlement(s._id)} className="text-xs font-semibold text-amber-600 hover:underline">Retry</button>
                      )}
                      {HOLDABLE_STATUSES.includes(s.status) && (
                        <button onClick={() => openReasonModal("hold", s._id)} className="text-xs font-semibold text-slate-500 hover:underline">Hold</button>
                      )}
                      {s.status === "on_hold" && (
                        <button onClick={() => releaseSettlement(s._id)} className="text-xs font-semibold text-emerald-600 hover:underline">Release</button>
                      )}
                    </div>
                  )
                }
              ]}
            />
          )}
        </Card>
      </div>

      {activeId && (
        <SettlementDetailPanel
          settlement={detail}
          bill={bill}
          history={history}
          billActionError={billActionError}
          onVerifyBill={verifyBillAction}
          loading={detailLoading}
          onClose={() => setActiveId(null)}
        />
      )}

      {payModal && (
        <MarkPaidModal
          state={payModal}
          setState={setPayModal}
          onFetch={fetchRazorpayPayment}
          onConfirmRazorpay={confirmMarkPaid}
          onConfirmOffline={confirmMarkPaidOffline}
          onClose={() => setPayModal(null)}
        />
      )}

      {reasonModal && (
        <ReasonModal
          state={reasonModal}
          setState={setReasonModal}
          onConfirm={submitReasonModal}
          onClose={() => setReasonModal(null)}
        />
      )}
    </div>
  );
}

// Real modal instead of window.prompt() — native browser dialogs are
// increasingly blocked by browsers/extensions (silently return null, no
// visible failure), and the old code had no error handling either, so any
// backend rejection (wrong status, etc) failed completely invisibly too.
function ReasonModal({ state, setState, onConfirm, onClose }) {
  const isHold = state.mode === "hold";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-slate-900">{isHold ? "Hold settlement" : "Mark payout failed"}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
          <textarea
            autoFocus
            rows={3}
            value={state.reason}
            onChange={(e) => setState((m) => ({ ...m, reason: e.target.value }))}
            placeholder={isHold ? "Why is this settlement being held?" : "Why did the payout fail?"}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm resize-none"
          />
        </div>

        {state.error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{state.error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={onConfirm} loading={state.submitting}>
            {isHold ? "Put on Hold" : "Mark Failed"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OverviewItem({ icon: Icon, iconTone, label, primary, secondary }) {
  return (
    <div className="pb-4 lg:pb-0 lg:pr-6 lg:first:pr-6">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconTone}`}>
        <Icon size={16} />
      </div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {secondary && <p className="text-xs text-slate-400 mt-0.5">{secondary}</p>}
      <p className="text-xl font-bold text-slate-900 mt-2">{primary}</p>
    </div>
  );
}

function BillDownloadButton({ settlementId, originalName }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const res = await adminApi.get(`/admin/settlements/${settlementId}/bill/download`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = originalName || "bill";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Couldn't download this bill.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button onClick={handleDownload} disabled={downloading} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline disabled:opacity-50">
      <Download size={12} /> {downloading ? "Downloading..." : "Download bill"}
    </button>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm capitalize transition ${
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

const HISTORY_ACTION_LABEL = {
  created: "Settlement batch created",
  approved: "Approved",
  held: "Put on hold",
  released: "Hold released",
  paid_offline: "Marked paid (offline)",
  paid_razorpay: "Marked paid (Razorpay verified)",
  failed: "Marked failed",
  retried: "Moved back to approved for retry",
  bill_submitted: "Bill submitted",
  bill_verified: "Bill verified",
  bill_rejected: "Bill rejected"
};

function SettlementHistoryTimeline({ history }) {
  if (!history || history.length === 0) {
    return <p className="text-sm text-slate-400">No history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {[...history].reverse().map((h) => (
        <div key={h._id} className="flex gap-3 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{HISTORY_ACTION_LABEL[h.action] || h.action}</span>
              <span className="text-xs text-slate-400 shrink-0">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
            {h.reason && <p className="text-slate-500 text-xs mt-0.5">{h.reason}</p>}
            {h.amount?.total > 0 && (
              <p className="text-slate-500 text-xs mt-0.5">{money(h.amount.total, h.amount.currency)}</p>
            )}
            <p className="text-slate-400 text-xs mt-0.5 capitalize">{h.performedByType.replace(/_/g, " ")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettlementDetailPanel({ settlement, bill, history, billActionError, onVerifyBill, loading, onClose }) {
  const gstAmount = bill?.status === "verified" ? bill.amount.gstAmount : 0;
  const payable = settlement ? settlement.amount.net + gstAmount : 0;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      <div className="relative w-full max-w-md h-full bg-white shadow-xl overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <p className="text-base font-semibold text-slate-900">Settlement details</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {loading || !settlement ? (
          <p className="text-slate-400 text-sm p-6">Loading...</p>
        ) : (
          <div className="p-5 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Settlement ID</p>
                <p className="font-semibold text-slate-900">{settlement.settlementNumber}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Clock3 size={12} className="text-slate-400" /> {CYCLE_LABEL[settlement.settlementType] || settlement.settlementType}
                </span>
                <Badge status={settlement.status} />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-sm border border-slate-100 rounded-xl p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Landmark size={14} className="text-slate-400 shrink-0" />
                <span className="text-slate-600 truncate">{settlement.partnerId?.legalEntity?.businessName || settlement.partnerId?.partnerCode || "—"}</span>
              </div>
              {settlement.partnerId?._id && (
                <Link
                  to={`/admin/partners/${settlement.partnerId._id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline shrink-0"
                >
                  <FolderOpen size={12} /> View documents
                </Link>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Amount breakdown</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Gross Amount</span><span className="text-slate-900">{money(settlement.amount.gross, settlement.amount.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Fees &amp; Tax Deductions</span><span className="text-red-600">- {money(settlement.amount.deductions, settlement.amount.currency)}</span></div>
                {settlement.tax?.tdsRate > 0 && (
                  <div className="flex justify-between pl-4"><span className="text-slate-400">TDS ({settlement.tax.tdsRate}%)</span><span className="text-slate-400">- {money(settlement.tax.tdsAmount, settlement.amount.currency)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-900 font-medium">Net Commission</span><span className="text-slate-900">{money(settlement.amount.net, settlement.amount.currency)}</span></div>
                {gstAmount > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">+ GST ({bill.amount.gstRatePercent}%, per verified bill)</span><span className="text-emerald-600">+ {money(gstAmount, settlement.amount.currency)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-100 font-semibold"><span className="text-slate-900">Payable to Partner</span><span className="text-slate-900">{money(payable, settlement.amount.currency)}</span></div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">GST bill</p>
              {!bill ? (
                <p className="text-sm text-slate-400">No bill submitted yet.</p>
              ) : (
                <div className="border border-slate-100 rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600"><FileText size={14} className="text-slate-400" /> {bill.billNumber}</span>
                    <Badge status={bill.status} />
                  </div>
                  <div className="flex justify-between"><span className="text-slate-500">GSTIN</span><span className="text-slate-900">{bill.gstin}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Bill date</span><span className="text-slate-900">{new Date(bill.billDate).toLocaleDateString()}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total on bill</span><span className="text-slate-900">{money(bill.amount.totalBillAmount, settlement.amount.currency)}</span></div>
                  <BillDownloadButton settlementId={settlement._id} originalName={bill.file.originalName} />
                  {bill.status === "rejected" && bill.rejectionReason && (
                    <p className="text-xs text-red-600 pt-1">Rejected: {bill.rejectionReason}</p>
                  )}
                  {billActionError && <p className="text-xs text-red-600">{billActionError}</p>}
                  {bill.status === "submitted" && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => onVerifyBill("verified")} className="text-xs font-semibold text-emerald-600 hover:underline">Verify</button>
                      <button onClick={() => onVerifyBill("rejected")} className="text-xs font-semibold text-red-600 hover:underline">Reject</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Payout account</p>
              {settlement.bankAccount ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="text-slate-900">{settlement.bankAccount.bankName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Account</span><span className="text-slate-900">•••• {settlement.bankAccount.accountNumberLast4}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">IFSC</span><span className="text-slate-900">{settlement.bankAccount.ifscMasked || "—"}</span></div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No bank account on file for this partner.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">Payment info</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="text-slate-900 capitalize">{settlement.payment?.method?.replace(/_/g, " ") || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Reference / UTR</span><span className="text-slate-900">{settlement.payment?.transactionId || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Settled On</span><span className="text-slate-900">{settlement.payment?.paidAt ? new Date(settlement.payment.paidAt).toLocaleString() : "—"}</span></div>
              </div>
            </div>

            {settlement.status === "on_hold" && settlement.hold?.reason && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <span className="font-semibold">On hold:</span> {settlement.hold.reason}
              </div>
            )}

            {settlement.status === "failed" && settlement.failureReason && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {settlement.failureReason}
              </div>
            )}

            {settlement.commissionIds?.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 mb-3">
                  Included transactions ({settlement.commissionIds.length})
                </p>
                <div className="space-y-2">
                  {settlement.commissionIds.map((c) => (
                    <div key={c._id} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Landmark size={14} className="text-slate-400" />
                        {c.transaction?.invoiceNumber || "—"}
                      </div>
                      <span className="font-medium text-slate-900">{money(c.calculation?.netCommission, settlement.amount.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400 mb-3">History</p>
              <SettlementHistoryTimeline history={history} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PAY_TABS = [
  { key: "offline", label: "Offline" },
  { key: "razorpay", label: "Verify Razorpay" }
];

// Two ways to record a payout, sharing one modal:
// - Offline: admin already paid outside Razorpay (bank/UPI/cheque/cash) —
//   trusted on the admin's word, just a reference number.
// - Verify Razorpay: fetch-then-confirm — the payment ID is always
//   resolved against Razorpay first so the admin sees the real amount/
//   status/method before committing, nothing is marked paid on the
//   strength of a typed-in ID alone.
function MarkPaidModal({ state, setState, onFetch, onConfirmRazorpay, onConfirmOffline, onClose }) {
  const canConfirmRazorpay = state.payment?.status === "captured";
  const setTab = (tab) => setState((m) => ({ ...m, tab, error: "" }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-slate-900">Mark settlement paid</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {PAY_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${
                state.tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {state.error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{state.error}</div>}

        {state.tab === "offline" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Method</label>
              <select
                value={state.offlineMethod}
                onChange={(e) => setState((m) => ({ ...m, offlineMethod: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="other">Other (cheque / cash)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference number</label>
              <input
                autoFocus
                value={state.referenceNumber}
                onChange={(e) => setState((m) => ({ ...m, referenceNumber: e.target.value }))}
                placeholder="UTR / cheque no. / transaction ref"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Note (optional)</label>
              <input
                value={state.note}
                onChange={(e) => setState((m) => ({ ...m, note: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
              />
            </div>
            <p className="text-xs text-slate-400">No Razorpay verification — this is trusted on your word, same as any other admin-recorded action.</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="button" onClick={onConfirmOffline} loading={state.submitting}>Confirm &amp; Mark Paid</Button>
            </div>
          </div>
        )}

        {state.tab === "razorpay" && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Razorpay Payment ID</label>
              <div className="flex gap-2">
                <input
                  value={state.paymentId}
                  onChange={(e) => setState((m) => ({ ...m, paymentId: e.target.value, payment: null, error: "" }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onFetch(); } }}
                  placeholder="pay_xxxxxxxxxxxxxx"
                  className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition text-sm"
                />
                <Button type="button" onClick={onFetch} loading={state.fetching} className="shrink-0 !px-3 !py-2">Fetch</Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Fetched live from Razorpay — nothing is marked paid until you confirm below.</p>
            </div>

            {state.payment && (
              <div className="border border-slate-100 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex justify-between items-center"><span className="text-slate-500">Status</span><Badge status={state.payment.status} /></div>
                <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-semibold text-slate-900">{money(state.payment.amount, state.payment.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="text-slate-900 capitalize">{state.payment.method || "—"}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Paid On</span><span className="text-slate-900">{state.payment.createdAt ? new Date(state.payment.createdAt).toLocaleString() : "—"}</span></div>
                {!canConfirmRazorpay && (
                  <p className="text-xs text-amber-700 pt-1">Only a captured payment can be used to mark this settlement paid.</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="button" onClick={onConfirmRazorpay} loading={state.submitting} disabled={!canConfirmRazorpay}>
                Confirm &amp; Mark Paid
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
