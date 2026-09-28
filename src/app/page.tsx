import Link from "next/link";
import {
  ArrowRight, Briefcase, Building2, CalendarCheck, ChevronDown, HandCoins, Lock, MapPin, PiggyBank, Shield,
  TrendingUp, Users, Wallet,
} from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

/*
 * One section per screen. Sizes scale with the SMALLER of viewport width and
 * height (min(vw, vh) inside clamp), so each screen's content fills it on a
 * 13" laptop, a 27" monitor or a phone — and never spills past it on short
 * windows. Sections still grow if content can't fit (tiny phones).
 */

const HIGHLIGHTS = [
  { icon: PiggyBank, label: "Savings", desc: "Up to 15% p.a." },
  { icon: HandCoins, label: "Loans", desc: "Quick disbursement" },
  { icon: TrendingUp, label: "Investments", desc: "24% returns" },
  { icon: Users, label: "Group Thrift", desc: "Community savings" },
];

const PRODUCTS = [
  { icon: CalendarCheck, name: "Yearly Thrift", rate: "12% p.a.", desc: "12-month locked savings" },
  { icon: PiggyBank, name: "Regular Savings", rate: "8% p.a.", desc: "Flexible access savings" },
  { icon: Lock, name: "Fixed Savings", rate: "15% p.a.", desc: "Premium fixed deposits" },
  { icon: Briefcase, name: "Business Loan", rate: "From 16%", desc: "SME growth financing" },
  { icon: Wallet, name: "Payday Loan", rate: "From 24%", desc: "Quick salary advances" },
  { icon: Users, name: "Group Thrift", rate: "Collective", desc: "Community savings groups" },
  { icon: TrendingUp, name: "Investments", rate: "Up to 24%", desc: "Managed growth funds" },
];

const CITIES = [
  { city: "Lagos", branches: ["Lagos Main", "Lagos Ikeja"] },
  { city: "Akure", branches: ["Akure Central", "Akure Oba Road"] },
];

// Fluid scales (smallest → preferred → largest).
const fs = {
  eyebrow: "text-[clamp(0.625rem,min(0.9vw,1.4vh),0.8rem)]",
  h1: "text-[clamp(2.25rem,min(5.4vw,8.2vh),5rem)]",
  h2: "text-[clamp(1.75rem,min(3.2vw,5vh),3rem)]",
  lead: "text-[clamp(1rem,min(1.4vw,2.2vh),1.3rem)]",
  body: "text-[clamp(0.875rem,min(1vw,1.6vh),1rem)]",
};

function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${light ? "bg-white text-navy" : "bg-navy text-white"}`}
      >
        GH
      </span>
      <span className="leading-tight">
        <span className={`block font-semibold ${light ? "text-white" : "text-ink"}`}>GH Trust International</span>
        <span className={`block text-xs ${light ? "text-white/65" : "text-ink-3"}`}>Secure Today. Grow Tomorrow.</span>
      </span>
    </span>
  );
}

function ScrollCue({ href, label, light = false }: { href: string; label: string; light?: boolean }) {
  return (
    <a
      href={href}
      className={`mx-auto flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        light ? "text-white/60 hover:text-white" : "text-ink-3 hover:text-ink"
      }`}
    >
      {label}
      <ChevronDown className="h-5 w-5 animate-bounce" aria-hidden />
    </a>
  );
}

export default function LandingPage() {
  return (
    <div className="h-dvh snap-y snap-proximity overflow-y-auto overflow-x-hidden scroll-smooth bg-canvas">
      {/* ── Screen 1 — hero ─────────────────────────────────────────────── */}
      <section className="relative flex min-h-dvh snap-start flex-col overflow-hidden gradient-navy text-white">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[60vmin] w-[60vmin] animate-drift rounded-full bg-cyan-bright/25 blur-3xl" aria-hidden />
        <div
          className="pointer-events-none absolute -bottom-40 right-[-10%] h-[70vmin] w-[70vmin] animate-drift rounded-full bg-[#3B5BDB]/30 blur-3xl [animation-delay:-9s]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
          aria-hidden
        />

        <div className="relative mx-auto flex w-full max-w-[min(88rem,92vw)] flex-1 flex-col px-1 pt-[clamp(1rem,3vh,2rem)] sm:px-4">
          <nav className="flex animate-fade-in items-center justify-between gap-3">
            <Brand light />
            <div className="flex items-center gap-2">
              <Link href="/customer" className={buttonClass("ghost", "md", "hidden text-white/85 hover:bg-white/10 hover:text-white sm:inline-flex")}>
                Customer portal
              </Link>
              <Link href="/admin" className={buttonClass("primary", "md", "bg-white text-navy hover:bg-white/90")}>
                Staff sign in
              </Link>
            </div>
          </nav>

          <div className="grid flex-1 content-center items-center gap-[clamp(1.5rem,6vmin,5rem)] py-[clamp(1.25rem,5vh,4rem)] lg:grid-cols-[1.1fr_1fr]">
            <div className="stagger">
              <p className={`${fs.eyebrow} font-semibold uppercase tracking-[0.2em] text-cyan-bright`}>Licensed microfinance bank</p>
              <h1 className={`${fs.h1} mt-[clamp(0.75rem,2vh,1.5rem)] font-semibold leading-[1.05] tracking-tight`}>
                Banking that builds
                <br />
                <span className="bg-gradient-to-r from-cyan-bright to-[#9BD8F2] bg-clip-text text-transparent">Nigerian dreams</span>
              </h1>
              <p className={`${fs.lead} mt-[clamp(1rem,3vh,2rem)] max-w-[34ch] text-white/75 lg:max-w-[40ch]`}>
                GH Trust International Ltd empowers individuals and SMEs across Lagos and Akure with accessible savings, loans,
                and investment products.
              </p>
              <div className="mt-[clamp(1.25rem,4.5vh,3rem)] grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <Link href="/admin" className={buttonClass("primary", "lg", "bg-white px-3 text-navy hover:bg-white/90 sm:px-5")}>
                  Open staff portal <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/customer"
                  className={buttonClass("outline", "lg", "border-white/30 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white sm:px-5")}
                >
                  <span className="sm:hidden">Customer demo</span>
                  <span className="hidden sm:inline">Customer dashboard demo</span>
                </Link>
              </div>
            </div>

            <div className="stagger grid grid-cols-2 gap-[clamp(0.75rem,2vmin,1.5rem)] [@media(max-width:639px)_and_(max-height:780px)]:hidden">
              {HIGHLIGHTS.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.07] p-[clamp(0.875rem,3vmin,2.25rem)] backdrop-blur-md transition-[transform,background-color] duration-300 hover:-translate-y-1 hover:bg-white/[0.11]"
                >
                  <item.icon className="mb-[clamp(0.5rem,2.4vmin,1.5rem)] h-[clamp(1.25rem,3.6vmin,2.5rem)] w-[clamp(1.25rem,3.6vmin,2.5rem)] text-cyan-bright" />
                  <h2 className="text-[clamp(1rem,min(1.5vw,2.4vh),1.4rem)] font-semibold">{item.label}</h2>
                  <p className={`${fs.body} text-white/65`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pb-[clamp(0.5rem,2vh,1.5rem)]">
            <ScrollCue href="#products" label="Explore" light />
          </div>
        </div>
      </section>

      {/* ── Screen 2 — products ─────────────────────────────────────────── */}
      <section id="products" className="relative flex min-h-dvh snap-start flex-col">
        <div className="mx-auto flex w-full max-w-[min(88rem,92vw)] flex-1 flex-col justify-center py-[clamp(1rem,6vh,5rem)] sm:px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className={`${fs.eyebrow} font-semibold uppercase tracking-[0.2em] text-cyan [@media(max-width:639px)_and_(max-height:780px)]:hidden`}>What we offer</p>
            <h2 className={`${fs.h2} mt-3 font-semibold tracking-tight text-ink`}>Our products</h2>
            <p className={`${fs.lead} mt-3 text-ink-3 [@media(max-width:639px)_and_(max-height:780px)]:hidden`}>Comprehensive financial solutions designed for Nigerian households and businesses.</p>
          </div>

          {/* 4 + 3, centred: seven cards with no empty slot. */}
          {/* Phones: compact rows. sm: 2 up. md: 3 up (3+3+1). lg: 4+3. Wide-but-short screens: one row of 7. */}
          <Reveal className="mt-[clamp(1rem,4.5vh,3.5rem)] flex flex-wrap justify-center gap-[var(--gap)] [--gap:clamp(0.5rem,2vmin,1.5rem)]">
            {PRODUCTS.map((product) => (
              <div
                key={product.name}
                className={[
                  "group flex w-full items-center gap-4 rounded-2xl border border-line bg-white px-[clamp(0.875rem,3vmin,2.25rem)] py-[clamp(0.625rem,3vmin,2.25rem)] shadow-card",
                  "transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-cyan/30 hover:shadow-card-hover",
                  "sm:block sm:w-[calc((100%-var(--gap))/2)] md:w-[calc((100%-2*var(--gap))/3)] lg:w-[calc((100%-3*var(--gap))/4)]",
                  "[@media(min-width:1280px)_and_(max-height:780px)]:w-[calc((100%-6*var(--gap))/7)]",
                ].join(" ")}
              >
                <span className="flex h-[clamp(2.5rem,5.5vmin,3.5rem)] w-[clamp(2.5rem,5.5vmin,3.5rem)] shrink-0 items-center justify-center rounded-xl bg-cyan-soft text-cyan transition-colors duration-300 group-hover:bg-navy group-hover:text-white">
                  <product.icon className="h-[45%] w-[45%]" />
                </span>
                <div className="min-w-0 flex-1 sm:mt-[clamp(0.75rem,2.4vh,1.5rem)]">
                  <div className="flex items-baseline justify-between gap-3 sm:block">
                    <h3 className="text-[clamp(0.95rem,min(1.3vw,2.2vh),1.25rem)] font-semibold text-ink">{product.name}</h3>
                    <p className="num shrink-0 text-[clamp(1rem,min(1.9vw,3.2vh),1.75rem)] font-semibold tracking-tight text-navy sm:mt-1">{product.rate}</p>
                  </div>
                  <p className={`${fs.body} mt-0.5 text-ink-3 sm:mt-1 [@media(max-width:639px)_and_(max-height:780px)]:hidden`}>{product.desc}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-[clamp(0.25rem,1.5vh,1rem)] hidden justify-center sm:flex [&>a]:pointer-events-auto">
          <ScrollCue href="#branches" label="Find us" />
        </div>
      </section>

      {/* ── Screen 3 — branches, footer pinned to the bottom ────────────── */}
      <section id="branches" className="flex min-h-dvh snap-start flex-col bg-white">
        <div className="mx-auto grid w-full max-w-[min(88rem,92vw)] flex-1 content-center items-center gap-[clamp(1.5rem,6vmin,5rem)] py-[clamp(1.5rem,7vh,5rem)] sm:px-4 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <span className="flex h-[clamp(2.75rem,6vmin,3.75rem)] w-[clamp(2.75rem,6vmin,3.75rem)] items-center justify-center rounded-2xl bg-cyan-soft text-cyan">
              <Building2 className="h-1/2 w-1/2" />
            </span>
            <p className={`${fs.eyebrow} mt-[clamp(1rem,3vh,1.5rem)] font-semibold uppercase tracking-[0.2em] text-cyan`}>Visit us</p>
            <h2 className={`${fs.h2} mt-3 font-semibold tracking-tight text-ink`}>Our branches</h2>
            <p className={`${fs.lead} mt-4 max-w-[38ch] text-ink-3 [@media(max-width:639px)_and_(max-height:780px)]:hidden`}>
              Four branches across Lagos and Akure, serving individuals and SMEs in person.
            </p>
            <div className="mt-[clamp(1.25rem,4vh,2.5rem)] grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <Link href="/admin" className={buttonClass("primary", "lg", "px-3 sm:px-5")}>
                Staff sign in <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/customer" className={buttonClass("outline", "lg", "px-3 sm:px-5")}>
                <span className="sm:hidden">Customer demo</span>
                <span className="hidden sm:inline">Customer dashboard demo</span>
              </Link>
            </div>
          </div>

          <Reveal className="grid grid-cols-2 gap-[clamp(0.625rem,2vmin,1.5rem)]">
            {CITIES.flatMap(({ city, branches }) =>
              branches.map((branch) => (
                <div
                  key={branch}
                  className="rounded-2xl border border-line bg-canvas p-[clamp(0.875rem,3vmin,2rem)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <MapPin className="h-[clamp(1.25rem,3vmin,1.75rem)] w-[clamp(1.25rem,3vmin,1.75rem)] text-cyan" />
                  <p className="mt-[clamp(0.625rem,3vh,2rem)] text-[clamp(0.95rem,min(1.4vw,2.4vh),1.4rem)] font-semibold text-ink">{branch}</p>
                  <p className={`${fs.body} text-ink-3`}>{city}</p>
                </div>
              )),
            )}
          </Reveal>
        </div>

        <footer className="bg-navy-900 py-[clamp(1.25rem,3vh,2rem)] text-white/65">
          <div className="mx-auto flex w-full max-w-[min(88rem,92vw)] flex-wrap items-center justify-between gap-x-6 gap-y-2 sm:px-4">
            <span className="hidden md:block">
              <Brand light />
            </span>
            <p className="text-xs sm:text-sm">&copy; {new Date().getFullYear()} GH Trust International Ltd. Licensed MFB.</p>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Shield className="h-4 w-4" />
              <span>NDIC Insured</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
