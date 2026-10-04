import { useEffect, useState } from "react";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Table from "../../components/ui/Table";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";

const TABS = ["Commission Rules", "Screen Pricing"];

const COMMISSION_TYPE_OPTIONS = ["percentage", "fixed_per_deal", "fixed_per_screen", "recurring_percentage", "recurring_fixed", "hybrid"];

// Mirrors computeGrossCommission in backend/services/commissionEngine.js —
// each commission type only ever reads one of these field groups, so only
// the matching field(s) should be editable for a given type.
const RATE_TYPES = ["percentage", "recurring_percentage"];
const FIXED_TYPES = ["fixed_per_deal", "recurring_fixed"];
const PER_SCREEN_TYPES = ["fixed_per_screen"];

const DEFAULT_RULE_FORM = {
  name: "", isAddOn: false,
  commissionType: "percentage", rate: 0, fixedAmount: 0, perScreenAmount: 0,
  hybridPercentageRate: 0, hybridFixedAmount: 0, hybridPerScreenAmount: 0,
  recurringEnabled: false, durationType: "months", duration: 6
};

function CommissionRulesTab() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(DEFAULT_RULE_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => adminApi.get("/admin/config/commission-rules").then((res) => setRules(res.data.data));
  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setForm(DEFAULT_RULE_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (rule) => {
    setForm({
      name: rule.name || "",
      isAddOn: rule.isAddOn || false,
      commissionType: rule.commissionType || "percentage",
      rate: rule.rate || 0,
      fixedAmount: rule.fixedAmount || 0,
      perScreenAmount: rule.perScreenAmount || 0,
      hybridPercentageRate: rule.hybrid?.percentageRate || 0,
      hybridFixedAmount: rule.hybrid?.fixedAmount || 0,
      hybridPerScreenAmount: rule.hybrid?.perScreenAmount || 0,
      recurringEnabled: rule.recurring?.enabled || false,
      durationType: rule.recurring?.durationType || "months",
      duration: rule.recurring?.duration || 6
    });
    setEditingId(rule._id);
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      isAddOn: form.isAddOn,
      commissionType: form.commissionType,
      rate: RATE_TYPES.includes(form.commissionType) ? Number(form.rate) : 0,
      fixedAmount: FIXED_TYPES.includes(form.commissionType) ? Number(form.fixedAmount) : 0,
      perScreenAmount: PER_SCREEN_TYPES.includes(form.commissionType) ? Number(form.perScreenAmount) : 0,
      hybrid: form.commissionType === "hybrid"
        ? {
            percentageRate: Number(form.hybridPercentageRate),
            fixedAmount: Number(form.hybridFixedAmount),
            perScreenAmount: Number(form.hybridPerScreenAmount)
          }
        : undefined,
      recurring: form.recurringEnabled
        ? { enabled: true, durationType: form.durationType, duration: Number(form.duration) }
        : { enabled: false, durationType: "none" }
    };
    try {
      if (editingId) {
        await adminApi.patch(`/admin/config/commission-rules/${editingId}`, payload);
      } else {
        await adminApi.post("/admin/config/commission-rules", payload);
      }
      setForm(DEFAULT_RULE_FORM);
      setEditingId(null);
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => (showForm ? setShowForm(false) : startCreate())}>{showForm ? "Cancel" : "New Rule"}</Button></div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Rule Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={form.isAddOn} onChange={(e) => setForm({ ...form, isAddOn: e.target.checked })} />
              This is an optional add-on rule (applied per-deal by an admin)
            </label>

            <Select label="Commission Type" value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
              {COMMISSION_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </Select>

            {/* Only the field(s) this commissionType actually reads (see
                computeGrossCommission in commissionEngine.js) are editable —
                showing all three regardless of type let you fill in a field
                the backend would just ignore. */}
            {RATE_TYPES.includes(form.commissionType) && (
              <Input label="Rate (%)" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            )}
            {FIXED_TYPES.includes(form.commissionType) && (
              <Input label="Fixed Amount (₹)" type="number" value={form.fixedAmount} onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })} />
            )}
            {PER_SCREEN_TYPES.includes(form.commissionType) && (
              <Input label="Per Screen Amount (₹)" type="number" value={form.perScreenAmount} onChange={(e) => setForm({ ...form, perScreenAmount: e.target.value })} />
            )}
            {form.commissionType === "hybrid" && (
              <>
                <Input label="Percentage Rate (%)" type="number" value={form.hybridPercentageRate} onChange={(e) => setForm({ ...form, hybridPercentageRate: e.target.value })} />
                <Input label="Fixed Amount (₹)" type="number" value={form.hybridFixedAmount} onChange={(e) => setForm({ ...form, hybridFixedAmount: e.target.value })} />
                <Input label="Per Screen Amount (₹)" type="number" value={form.hybridPerScreenAmount} onChange={(e) => setForm({ ...form, hybridPerScreenAmount: e.target.value })} />
              </>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={form.recurringEnabled} onChange={(e) => setForm({ ...form, recurringEnabled: e.target.checked })} />
              Recurring
            </label>

            {form.recurringEnabled && (
              <>
                <Select label="Duration Type" value={form.durationType} onChange={(e) => setForm({ ...form, durationType: e.target.value })}>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                  <option value="lifetime">Lifetime (while active)</option>
                </Select>
                {form.durationType !== "lifetime" && (
                  <Input label="Duration" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                )}
              </>
            )}

            <div className="md:col-span-2 flex justify-end gap-2">
              {editingId && <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>}
              <Button type="submit" loading={saving}>{editingId ? "Save Changes" : "Create"}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <Table
          empty="No commission rules yet."
          rows={rules}
          columns={[
            { key: "name", header: "Name" },
            { key: "addon", header: "Add-On?", render: (r) => (r.isAddOn ? <Badge tone="info">Add-on</Badge> : "—") },
            { key: "type", header: "Type", render: (r) => <Badge tone="neutral">{r.commissionType.replace(/_/g, " ")}</Badge> },
            {
              key: "rate",
              header: "Rate",
              render: (r) => {
                if (RATE_TYPES.includes(r.commissionType)) return `${r.rate || 0}%`;
                if (FIXED_TYPES.includes(r.commissionType)) return `₹${r.fixedAmount || 0}`;
                if (PER_SCREEN_TYPES.includes(r.commissionType)) return `₹${r.perScreenAmount || 0}/screen`;
                if (r.commissionType === "hybrid") return `${r.hybrid?.percentageRate || 0}% + ₹${r.hybrid?.fixedAmount || 0} + ₹${r.hybrid?.perScreenAmount || 0}/screen`;
                return "—";
              }
            },
            { key: "status", header: "Status", render: (r) => <Badge status={r.status} /> },
            { key: "actions", header: "", render: (r) => <button type="button" onClick={() => startEdit(r)} className="text-sm font-semibold text-brand-red hover:underline">Edit</button> }
          ]}
        />
      </Card>
    </div>
  );
}

function ScreenPricingTab() {
  const [basicPrice, setBasicPrice] = useState("");
  const [premiumPrice, setPremiumPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    adminApi.get("/admin/config/screen-pricing")
      .then((res) => {
        setBasicPrice(String(res.data.data.basicPricePerScreen));
        setPremiumPrice(String(res.data.data.premiumPricePerScreen));
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSavedMessage("");
    setSaving(true);
    try {
      await adminApi.put("/admin/config/screen-pricing", {
        basicPricePerScreen: Number(basicPrice),
        premiumPricePerScreen: Number(premiumPrice)
      });
      setSavedMessage("Saved.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm">Loading...</p>;

  return (
    <Card className="p-6 max-w-md">
      <p className="text-sm text-slate-500 mb-4">
        Global monthly price per screen for each plan, used to calculate the total on a customer's Subscription page.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Basic — price per screen / month (₹)" type="number" min={0} value={basicPrice} onChange={(e) => setBasicPrice(e.target.value)} required />
        <Input label="Premium — price per screen / month (₹)" type="number" min={0} value={premiumPrice} onChange={(e) => setPremiumPrice(e.target.value)} required />
        <Button type="submit" loading={saving}>Save</Button>
      </form>
      {savedMessage && <p className="text-xs text-emerald-600 mt-3">{savedMessage}</p>}
    </Card>
  );
}

export default function AdminConfig() {
  const [tab, setTab] = useState(TABS[0]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Commission Rules</h1>

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t ? "border-brand-red text-brand-red" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Commission Rules" && <CommissionRulesTab />}
      {tab === "Screen Pricing" && <ScreenPricingTab />}
    </div>
  );
}
