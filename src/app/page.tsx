import Link from "next/link";
import { ArrowRight, Shield, TrendingUp, Users, Building2 } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="gradient-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <nav className="flex items-center justify-between mb-16">
            <Logo light size="lg" showTagline />
            <div className="flex gap-3">
              <Link href="/customer">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  Customer Portal
                </Button>
              </Link>
              <Link href="/admin">
                <Button className="bg-cyan hover:bg-cyan/90 text-white border-0">
                  Admin Portal
                </Button>
              </Link>
            </div>
          </nav>

          <div className="grid lg:grid-cols-2 gap-12 items-center pb-20">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
                Banking that builds<br />
                <span className="text-cyan">Nigerian dreams</span>
              </h1>
              <p className="text-white/70 text-lg mb-8 max-w-lg">
                GH Trust International Ltd empowers individuals and SMEs across Lagos and Akure
                with accessible savings, loans, and investment products.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/customer">
                  <Button size="lg" className="bg-white text-navy hover:bg-white/90">
                    Open Customer Dashboard <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/admin">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                    Admin Access
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden lg:grid grid-cols-2 gap-4">
              {[
                { icon: PiggyBankIcon, label: "Savings", desc: "Up to 15% p.a." },
                { icon: HandCoinsIcon, label: "Loans", desc: "Quick disbursement" },
                { icon: TrendingUp, label: "Investments", desc: "24% returns" },
                { icon: Users, label: "Group Thrift", desc: "Community savings" },
              ].map((item) => (
                <div key={item.label} className="bg-white/10 backdrop-blur rounded-2xl p-6">
                  <item.icon className="w-8 h-8 text-cyan mb-3" />
                  <h3 className="font-bold text-lg">{item.label}</h3>
                  <p className="text-white/60 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-navy text-center mb-4">Our Products</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Comprehensive financial solutions designed for Nigerian households and businesses.
          </p>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[
              { name: "Yearly Thrift", rate: "12% p.a.", desc: "12-month locked savings" },
              { name: "Regular Savings", rate: "8% p.a.", desc: "Flexible access savings" },
              { name: "Fixed Savings", rate: "15% p.a.", desc: "Premium fixed deposits" },
              { name: "Business Loan", rate: "From 16%", desc: "SME growth financing" },
              { name: "Payday Loan", rate: "From 24%", desc: "Quick salary advances" },
              { name: "Group Thrift", rate: "Collective", desc: "Community savings groups" },
              { name: "Investments", rate: "Up to 24%", desc: "Managed growth funds" },
            ].map((product) => (
              <div key={product.name} className="bg-bg-light rounded-2xl p-6 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-navy mb-1">{product.name}</h3>
                <p className="text-cyan font-semibold text-sm mb-2">{product.rate}</p>
                <p className="text-gray-500 text-sm">{product.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Branches */}
      <section className="py-16 bg-bg-light">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <Building2 className="w-10 h-10 text-cyan mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-navy mb-6">Our Branches</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {["Lagos Main", "Lagos Ikeja", "Akure Central", "Akure Oba Road"].map((branch) => (
              <span key={branch} className="bg-white px-6 py-3 rounded-xl text-navy font-medium card-shadow">
                {branch}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white/60 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo light size="sm" />
          <p className="text-sm">&copy; 2025 GH Trust International Ltd. Licensed MFB.</p>
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4" />
            <span>NDIC Insured</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PiggyBankIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2" />
      <path d="M2 9v1c0 1.1.9 2 2 2h1" />
      <path d="M16 11h0" />
    </svg>
  );
}

function HandCoinsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
      <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
      <path d="m2 16 6 6" />
      <circle cx="16" cy="9" r="2.9" />
      <circle cx="6" cy="5" r="3" />
    </svg>
  );
}
