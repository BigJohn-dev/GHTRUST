"use client";

import { CreditCard } from "lucide-react";
import { formatNaira } from "@/lib/utils";

interface VirtualCardProps {
  balance: number;
  cardNumber?: string;
  holderName?: string;
  expiry?: string;
}

export function VirtualCard({ balance, cardNumber = "4532 •••• •••• 7891", holderName = "ADAEZE OKAFOR", expiry = "09/28" }: VirtualCardProps) {
  return (
    <div className="relative w-full rounded-2xl gradient-navy p-6 text-white overflow-hidden shadow-card-hover" style={{ aspectRatio: "1.6/1" }}>
      <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan/10 rounded-full translate-y-1/2 -translate-x-1/4" />
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-white/60 tracking-wider uppercase">GH Trust Wallet</span>
            <p className="text-[10px] text-white/40 mt-0.5">Secure Today. Grow Tomorrow.</p>
          </div>
          <div className="p-2 bg-white/10 rounded-xl backdrop-blur">
            <CreditCard className="w-5 h-5 text-white/80" />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-white/50 uppercase tracking-wider">Available Balance</p>
          <p className="text-3xl font-bold tracking-tight mt-1">{formatNaira(balance)}</p>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-mono tracking-[0.15em] text-white/90">{cardNumber}</p>
            <p className="text-[10px] text-white/50 mt-1.5 uppercase">{holderName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/50">Valid Thru</p>
            <p className="text-sm font-medium">{expiry}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
