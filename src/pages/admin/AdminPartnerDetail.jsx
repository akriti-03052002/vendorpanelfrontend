import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import adminApi from "../../services/adminApi";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Select, Input } from "../../components/ui/Input";
import DocumentPreviewModal from "../../components/admin/DocumentPreviewModal";
import BankAccountPreviewModal from "../../components/admin/BankAccountPreviewModal";
import { UploadCloud, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

const COMMISSION_TYPE_OPTIONS = [
  { value: "percentage", label: "Percentage of deal value" },
  { value: "recurring_percentage", label: "Recurring percentage" },
  { value: "fixed_per_deal", label: "Fixed amount per deal" },
  { value: "recurring_fixed", label: "Recurring fixed amount" },
  { value: "fixed_per_screen", label: "Fixed amount per screen" },
  { value: "hybrid", label: "Hybrid (% + fixed + per-screen)" }
];

const STATUS_OPTIONS = ["draft", "pending_verification", "under_review", "active", "suspended", "rejected", "inactive"];

// Bank Proof and Other are always optional (see partnerVerification.js —
// neither is ever in REQUIRED_DOCUMENTS_BY_PARTNER_TYPE), so once the
// partner is verified there's nothing left for the admin to chase here.
const OPTIONAL_AFTER_VERIFICATION = ["bank_proof", "other"];

// Exact same checklist the partner's own Documents.jsx shows — keeping the
// admin and partner views of the same data in sync.
const DOCUMENT_TYPES = [
  { value: "msme_udyam", label: "MSME / Udyam Certificate" },
  { value: "gst_certificate", label: "GST Certificate" },
  { value: "pan_card", label: "PAN Card" },
  { value: "cancelled_cheque", label: "Cancelled Cheque" },
  { value: "bank_proof", label: "Bank Proof" },
  { value: "partner_agreement", label: "Partner Agreement", systemGenerated: true },
  { value: "other", label: "Other" }
];

export default function AdminPartnerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewBank, setPreviewBank] = useState(false);
  const [pendingFiles, setPendingFiles] = useState({}); // { [documentType]: File }
  const [uploadingType, setUploadingType] = useState(null);
  const [uploadErrors, setUploadErrors] = useState({}); // { [documentType]: message }

  const [commission, setCommission] = useState(null); // { active, history }
  const [commissionForm, setCommissionForm] = useState({
    commissionType: "percentage", rate: "", fixedAmount: "", perScreenAmount: "", notes: ""
  });
  const [commissionBusy, setCommissionBusy] = useState(false);
  const [commissionError, setCommissionError] = useState("");
  const [commissionSuccess, setCommissionSuccess] = useState("");

  const load = () => {
    adminApi.get(`/admin/partners/${id}`).then((res) => {
      setData(res.data.data);
      setSelectedStatus(res.data.data.partner.status);
    });
  };

  const loadCommission = () => adminApi.get(`/admin/partners/${id}/commission-assignment`).then((res) => setCommission(res.data.data));

  useEffect(() => {
    load();
    loadCommission();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCommission = async () => {
    setCommissionError("");
    setCommissionSuccess("");

    const { commissionType, rate, fixedAmount, perScreenAmount, notes } = commissionForm;
    if (commissionType.includes("percentage") && !rate) {
      setCommissionError("Enter a percentage rate.");
      return;
    }
    if ((commissionType === "fixed_per_deal" || commissionType === "recurring_fixed") && !fixedAmount) {
      setCommissionError("Enter a fixed amount.");
      return;
    }
    if (commissionType === "fixed_per_screen" && !perScreenAmount) {
      setCommissionError("Enter a per-screen amount.");
      return;
    }

    setCommissionBusy(true);
    try {
      const res = await adminApi.post(`/admin/partners/${id}/commission-assignment`, {
        commissionType,
        rate: Number(rate) || 0,
        fixedAmount: Number(fixedAmount) || 0,
        perScreenAmount: Number(perScreenAmount) || 0,
        notes
      });
      setCommissionSuccess(`Agreement ${res.data.data.acceptance.agreementRef} issued and accepted.`);
      setCommissionForm((f) => ({ ...f, notes: "" }));
      loadCommission();
      load();
    } catch (err) {
      setCommissionError(err.response?.data?.message || "Something went wrong assigning commission.");
    } finally {
      setCommissionBusy(false);
    }
  };

  const applyStatus = async () => {
    let rejectionReason;

    if (selectedStatus === "rejected") {
      rejectionReason = window.prompt("Reason for rejecting this partner? This will be shown to them and sent as a notification.");
      if (rejectionReason === null) return;
      if (!rejectionReason.trim()) {
        window.alert("A reason is required to reject a partner.");
        return;
      }
    }

    setBusy(true);
    try {
      await adminApi.patch(`/admin/partners/${id}/status`, { status: selectedStatus, rejectionReason });
      load();
    } finally {
      setBusy(false);
    }
  };

  const verifyDocument = async (docId, status, rejectionReason) => {
    await adminApi.patch(`/admin/documents/${docId}/verify`, { status, rejectionReason });
    load();
  };

  const verifyBank = async (bankId, status, rejectionReason, overrideReason) => {
    await adminApi.patch(`/admin/bank/${bankId}/verify`, { status, rejectionReason, overrideReason });
    load();
  };

  const handleFileSelect = (type, file) => {
    setPendingFiles((prev) => ({ ...prev, [type]: file }));
    setUploadErrors((prev) => ({ ...prev, [type]: "" }));
  };

  const handleAdminUpload = async (type) => {
    const file = pendingFiles[type];

    if (!file) {
      setUploadErrors((prev) => ({ ...prev, [type]: "Choose a file first." }));
      return;
    }

    const formData = new FormData();
    formData.append("documentType", type);
    formData.append("file", file);

    try {
      setUploadingType(type);
      await adminApi.post(`/admin/partners/${id}/documents`, formData, { headers: { "Content-Type": undefined } });
      setPendingFiles((prev) => ({ ...prev, [type]: null }));
      load();
    } catch (err) {
      setUploadErrors((prev) => ({ ...prev, [type]: err.response?.data?.message || "Upload failed. Try again." }));
    } finally {
      setUploadingType(null);
    }
  };

  if (!data) return <p className="text-slate-400 text-sm">Loading...</p>;

  const { partner, documents, requiredDocumentTypes, bankAccount, team } = data;

  const latestByType = (type) =>
    documents
      .filter((d) => d.documentType === type)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {partner.legalEntity.businessName || <span className="text-slate-400 italic">Incomplete profile</span>}
          </h1>
          <p className="text-sm text-slate-400">{partner.partnerCode} · {partner.primaryContact.email}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="neutral">{partner.partnerType}</Badge>
          <Badge status={partner.status} />
          <Badge status={partner.verification.overallStatus} />
        </div>
      </div>

      {partner.status === "rejected" && partner.verification.rejectionReason && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{partner.verification.rejectionReason}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Partner Status</h2>
          <div className="flex gap-3">
            <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="flex-1">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </Select>
            <Button onClick={applyStatus} loading={busy}>Apply</Button>
          </div>
        </Card>

        {partner.partnerType === "vendor" && (
          <Card className="p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Commission</h2>

            {commission?.active && (
              <div className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-3">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                <span>
                  Active: {COMMISSION_TYPE_OPTIONS.find((o) => o.value === commission.active.commissionType)?.label || commission.active.commissionType}
                  {commission.active.rate ? ` · ${commission.active.rate}%` : ""}
                  {commission.active.fixedAmount ? ` · ₹${commission.active.fixedAmount}` : ""}
                  {commission.active.perScreenAmount ? ` · ₹${commission.active.perScreenAmount}/screen` : ""}
                  {" — agreement auto-accepted."}
                </span>
              </div>
            )}

            <div className="space-y-3">
              <Select
                label="Commission type"
                value={commissionForm.commissionType}
                onChange={(e) => setCommissionForm((f) => ({ ...f, commissionType: e.target.value }))}
              >
                {COMMISSION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>

              {commissionForm.commissionType.includes("percentage") && (
                <Input
                  label="Rate (%)"
                  type="number"
                  value={commissionForm.rate}
                  onChange={(e) => setCommissionForm((f) => ({ ...f, rate: e.target.value }))}
                  placeholder="e.g. 15"
                />
              )}
              {(commissionForm.commissionType === "fixed_per_deal" || commissionForm.commissionType === "recurring_fixed") && (
                <Input
                  label="Fixed amount per deal (₹)"
                  type="number"
                  value={commissionForm.fixedAmount}
                  onChange={(e) => setCommissionForm((f) => ({ ...f, fixedAmount: e.target.value }))}
                  placeholder="e.g. 10000"
                />
              )}
              {commissionForm.commissionType === "fixed_per_screen" && (
                <Input
                  label="Amount per screen (₹)"
                  type="number"
                  value={commissionForm.perScreenAmount}
                  onChange={(e) => setCommissionForm((f) => ({ ...f, perScreenAmount: e.target.value }))}
                  placeholder="e.g. 500"
                />
              )}
              {commissionForm.commissionType === "hybrid" && (
                <div className="grid grid-cols-3 gap-2">
                  <Input label="% rate" type="number" value={commissionForm.rate} onChange={(e) => setCommissionForm((f) => ({ ...f, rate: e.target.value }))} />
                  <Input label="Fixed ₹" type="number" value={commissionForm.fixedAmount} onChange={(e) => setCommissionForm((f) => ({ ...f, fixedAmount: e.target.value }))} />
                  <Input label="₹/screen" type="number" value={commissionForm.perScreenAmount} onChange={(e) => setCommissionForm((f) => ({ ...f, perScreenAmount: e.target.value }))} />
                </div>
              )}

              {commissionError && <p className="text-xs text-red-600">{commissionError}</p>}
              {commissionSuccess && <p className="text-xs text-emerald-600">{commissionSuccess}</p>}

              <Button onClick={applyCommission} loading={commissionBusy}>
                {commission?.active ? "Update commission & reissue agreement" : "Assign commission & issue agreement"}
              </Button>
              <p className="text-xs text-slate-400">
                Setting this generates the Partner Agreement immediately and marks it automatically accepted by the partner — no separate sign-off step.
              </p>
            </div>
          </Card>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-slate-900 mb-3">KYC Documents</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {DOCUMENT_TYPES.map((type) => {
            const doc = latestByType(type.value);
            const status = doc?.verification.status || "not_submitted";
            const isRequired = requiredDocumentTypes.includes(type.value);
            const hideUpload = partner.status === "active" && OPTIONAL_AFTER_VERIFICATION.includes(type.value);

            return (
              <Card key={type.value} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {type.label}
                      {isRequired && <span className="text-brand-red ml-1">*</span>}
                    </p>
                    {type.systemGenerated ? (
                      <p className="text-xs text-slate-400">Generated by SPOTX</p>
                    ) : !isRequired ? (
                      <p className="text-xs text-slate-400">Optional</p>
                    ) : null}
                  </div>
                  {(!type.systemGenerated || doc) && <Badge status={status} />}
                </div>

                {doc && (
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(doc)}
                    className="w-full flex items-center justify-between gap-3 mb-3 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{doc.file.originalName}</p>
                        <p className="text-xs text-slate-400">Uploaded {new Date(doc.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-brand-red shrink-0">Preview & Review</span>
                  </button>
                )}

                {status === "rejected" && doc?.verification.rejectionReason && (
                  <div className="flex items-start gap-2 mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{doc.verification.rejectionReason}</span>
                  </div>
                )}

                {type.systemGenerated ? (
                  !doc && (
                    <p className="text-xs text-slate-400">
                      {partner.partnerType === "vendor"
                        ? "Generated once a commission is assigned above — nothing to upload here."
                        : "Generated automatically once the partner is verified — nothing to upload here."}
                    </p>
                  )
                ) : hideUpload ? (
                  !doc && (
                    <p className="text-xs text-slate-400">
                      Partner is verified — this optional document is no longer needed.
                    </p>
                  )
                ) : status !== "verified" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileSelect(type.value, e.target.files[0])}
                      className="flex-1 min-w-0 text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                    />
                    <Button
                      type="button"
                      onClick={() => handleAdminUpload(type.value)}
                      loading={uploadingType === type.value}
                      className="shrink-0 !px-3 !py-2"
                    >
                      <span className="flex items-center gap-1.5"><UploadCloud size={14} /> {doc ? "Re-upload" : "Upload"}</span>
                    </Button>
                  </div>
                )}

                {uploadErrors[type.value] && <p className="text-xs text-red-600 mt-2">{uploadErrors[type.value]}</p>}
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Bank Account</h2>
        {!bankAccount ? (
          <p className="text-sm text-slate-400">No bank account on file.</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge status={bankAccount.verification.status} />
                <Badge status={bankAccount.commissionEligibility === "eligible" ? "verified" : "not_submitted"}>
                  Commission: {bankAccount.commissionEligibility === "eligible" ? "eligible" : "not eligible"}
                </Badge>
              </div>
              {bankAccount.verification.status !== "verified" && (
                <button type="button" onClick={() => setPreviewBank(true)} className="text-xs font-semibold text-brand-red hover:underline">
                  Preview & Review
                </button>
              )}
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Account Holder</dt><dd className="font-medium">{bankAccount.accountHolderName}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Bank</dt><dd className="font-medium">{bankAccount.bankName}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Account Number</dt><dd className="font-medium">•••• {bankAccount.accountNumberLast4}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">IFSC</dt><dd className="font-medium">{bankAccount.ifscMasked}</dd></div>
            </dl>
            {bankAccount.verification.status === "verified" && (
              <p className="text-xs text-slate-400 mt-3">Full details are no longer viewable once verified.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Team</h2>
        <div className="space-y-2">
          {team.map((t) => (
            <div key={t._id} className="flex items-center justify-between text-sm">
              <span>{t.name} · {t.email}</span>
              <Badge tone="neutral">{t.role}</Badge>
            </div>
          ))}
        </div>
      </Card>

      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onVerify={(docId) => verifyDocument(docId, "verified")}
          onReject={(docId, reason) => verifyDocument(docId, "rejected", reason)}
        />
      )}

      {previewBank && bankAccount && (
        <BankAccountPreviewModal
          account={bankAccount}
          onClose={() => setPreviewBank(false)}
          onVerify={(bankId, overrideReason) => verifyBank(bankId, "verified", undefined, overrideReason)}
          onReject={(bankId, reason) => verifyBank(bankId, "rejected", reason)}
        />
      )}
    </div>
  );
}
