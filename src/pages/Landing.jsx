import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, Wallet, ShieldCheck, ArrowRight,
  Monitor, MapPin, Activity, Radio, Check, Users2, X
} from "lucide-react";
import Logo from "../components/ui/Logo";

// What the Partner Panel gives every Vendor partner.
const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "One Dashboard for Your Partnership",
    description: "Everything about how you work with SPOTX — customers, commissions, and settlements — lives in one panel."
  },
  {
    icon: Users2,
    title: "A Relationship That Fits Your Business",
    description: "Refer customers and install and manage screens yourself — track it all in one place."
  },
  {
    icon: Wallet,
    title: "Transparent Money, Every Time",
    description: "Track every commission payout from pending to paid, with no surprises."
  },
  {
    icon: ShieldCheck,
    title: "Verified & Secure",
    description: "KYC and bank details are encrypted and reviewed by SPOTX before any money moves in either direction."
  }
];

const STATS = [
  { icon: Monitor, value: "1,521+", label: "Screens managed" },
  { icon: MapPin, value: "70+", label: "Business locations" },
  { icon: Activity, value: "99.9%", label: "Platform uptime" },
  { icon: Radio, value: "24/7", label: "Network monitoring" }
];

const PARTNER_TYPES = [
  {
    name: "Vendor",
    icon: Monitor,
    direction: "SPOTX pays you",
    blurb: "Install and manage screens for your own customers.",
    details: [
      "You install and manage SPOTX screens for your own end customers.",
      "SPOTX pays you a recurring commission every month, for as long as each screen stays active.",
      "You track every commission from pending to paid, and every settlement, right in your dashboard."
    ]
  }
];

export default function Landing() {
  const [activeType, setActiveType] = useState(null);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <Link to="/partner/login" className="text-sm font-semibold text-slate-700 hover:text-brand-black transition">
            Partner Sign In
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-red/10 text-brand-red text-xs font-semibold tracking-wide uppercase mb-6">
          SPOTX Partner Panel
        </span>

        <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-brand-black tracking-tight leading-tight">
          One panel to manage <br className="hidden sm:block" />
          your partnership with SPOTX
        </h1>

        <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto">
          SPOTX is an enterprise-grade digital signage platform — businesses use it to manage
          content, monitor screens, and run campaigns across every location from one dashboard.
          The Partner Panel is where <strong className="text-slate-700 font-semibold">you</strong> manage your side of that
          relationship: refer customers, resell licenses, run campaigns, or install and manage
          screens yourself. Pick the partner type below that matches how you work — the panel
          adapts to it automatically.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          <Link
            to="/partner/register"
            className="inline-flex items-center justify-center gap-2 bg-brand-black text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-charcoal transition"
          >
            Become a Partner
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/partner/login"
            className="inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-slate-50 transition"
          >
            Sign In
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-brand-black">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon size={20} className="mx-auto mb-2 text-brand-yellow" />
              <div className="font-heading text-2xl font-extrabold text-white">{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-xl mx-auto mb-12">
          <h2 className="font-heading text-2xl font-bold text-brand-black mb-2">Which kind of partner are you?</h2>
          <p className="text-sm text-slate-500">
            The Partner Panel isn't one-size-fits-all — it gives each relationship type its own dashboard,
            actions, and money flow. Find yours below.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-md mx-auto lg:max-w-none">
          {PARTNER_TYPES.map((type) => (
            <button
              key={type.name}
              type="button"
              onClick={() => setActiveType(type)}
              className="text-left bg-white rounded-2xl border border-slate-200 p-5 flex flex-col hover:border-brand-red hover:shadow-md transition cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center mb-3">
                <type.icon size={18} />
              </div>
              <h3 className="font-heading font-bold text-brand-black text-sm mb-1">{type.name}</h3>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{type.direction}</span>
              <p className="text-xs text-slate-500 leading-relaxed">{type.blurb}</p>
              <span className="text-xs font-semibold text-brand-red mt-3">See how it works →</span>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Not sure which fits? Click a card above to see how it works, or choose your type when you register — an admin can help you switch later if needed.
        </p>
      </section>

      {activeType && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setActiveType(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center shrink-0">
                  <activeType.icon size={18} />
                </div>
                <div>
                  <p className="font-heading font-bold text-brand-black">{activeType.name}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{activeType.direction}</span>
                </div>
              </div>
              <button type="button" onClick={() => setActiveType(null)} className="text-slate-400 hover:text-brand-black shrink-0" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-6">
              <ul className="space-y-3">
                {activeType.details.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check size={15} className="text-brand-red mt-0.5 shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 shrink-0">
              <Link
                to="/partner/register"
                className="inline-flex items-center justify-center gap-2 w-full bg-brand-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-charcoal transition"
              >
                Register as a {activeType.name}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      <section className="bg-light-grey border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="w-11 h-11 rounded-xl bg-brand-red/10 text-brand-red flex items-center justify-center mb-4">
                <f.icon size={20} />
              </div>
              <h3 className="font-heading font-bold text-brand-black mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center">
        <p className="text-sm font-medium text-brand-black mb-1">Join a growing digital signage ecosystem.</p>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} SPOTX. Partner Panel.</p>
      </footer>
    </div>
  );
}
