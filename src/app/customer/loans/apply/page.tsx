"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import { customers, CURRENT_CUSTOMER_ID } from "@/lib/mock-data";
import { generateId } from "@/lib/utils";

const PRODUCTS = ["Business Loan", "Payday Loan"] as const;
type Product = typeof PRODUCTS[number];

const STEPS: Record<Product, string[]> = {
  "Business Loan": ["Loan Details", "Business Info", "Income & Documents", "Review", "Submit"],
  "Payday Loan": ["Loan Details", "Employment", "Review", "Submit"],
};

function ApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const saveLoanDraft = useAppStore((s) => s.saveLoanDraft);
  const deleteLoanDraft = useAppStore((s) => s.deleteLoanDraft);
  const submitLoanApplication = useAppStore((s) => s.submitLoanApplication);

  const draftId = searchParams.get("draft");
  const productParam = searchParams.get("product") as Product | null;

  const [product, setProduct] = useState<Product>(productParam || "Business Loan");
  const [step, setStep] = useState(1);
  const [draftKey, setDraftKey] = useState(draftId || `draft-${generateId()}`);
  const [form, setForm] = useState({
    amount: "",
    purpose: "",
    tenure: "",
    businessName: "",
    monthlyIncome: "",
    employer: "",
    jobTitle: "",
  });

  const customer = customers.find((c) => c.id === CURRENT_CUSTOMER_ID)!;
  const totalSteps = STEPS[product].length;

  const [loadedDraft, setLoadedDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId || loadedDraft === draftId) return;
    const draft = useAppStore.getState().loanDrafts.find((d) => d.id === draftId);
    if (draft) {
      setProduct(draft.product);
      setStep(draft.step);
      setDraftKey(draft.id);
      setForm({
        amount: String(draft.data.amount || ""),
        purpose: String(draft.data.purpose || ""),
        tenure: String(draft.data.tenure || ""),
        businessName: String(draft.data.businessName || ""),
        monthlyIncome: String(draft.data.monthlyIncome || ""),
        employer: String(draft.data.employer || ""),
        jobTitle: String(draft.data.jobTitle || ""),
      });
      setLoadedDraft(draftId);
    }
  }, [draftId, loadedDraft]);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const saveDraft = () => {
    saveLoanDraft({
      id: draftKey,
      product,
      step,
      totalSteps,
      data: { ...form, amount: parseInt(form.amount) || 0, tenure: parseInt(form.tenure) || 0, monthlyIncome: parseInt(form.monthlyIncome) || 0 },
      lastUpdated: new Date().toISOString(),
    });
  };

  const handleNext = () => {
    saveDraft();
    if (step < totalSteps) setStep(step + 1);
  };

  const handleSubmit = () => {
    submitLoanApplication({
      customerId: CURRENT_CUSTOMER_ID,
      customerName: customer.name,
      product,
      amount: parseInt(form.amount, 10),
      purpose: form.purpose,
      tenure: parseInt(form.tenure, 10),
      branch: customer.branch,
      monthlyIncome: parseInt(form.monthlyIncome, 10) || 250000,
    });
    deleteLoanDraft(draftKey);
    router.push("/customer/loans");
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-navy">Loan Product</label>
              <select value={product} onChange={(e) => { setProduct(e.target.value as Product); setStep(1); }} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30">
                {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-navy">Amount (₦)</label>
              <input type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" placeholder={product === "Payday Loan" ? "50000 - 500000" : "500000 - 5000000"} />
            </div>
            <div>
              <label className="text-sm font-medium text-navy">Purpose</label>
              <textarea value={form.purpose} onChange={(e) => update("purpose", e.target.value)} rows={3} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" placeholder="Describe how you'll use the loan" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy">Tenure (months)</label>
              <input type="number" value={form.tenure} onChange={(e) => update("tenure", e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
          </div>
        );
      case 2:
        return product === "Business Loan" ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-navy">Business Name</label>
              <input type="text" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy">Monthly Income (₦)</label>
              <input type="number" value={form.monthlyIncome} onChange={(e) => update("monthlyIncome", e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
            <div className="bg-bg-light rounded-xl p-4 text-sm text-gray-600">
              <p className="font-medium text-navy mb-2">Required Documents (upload mock)</p>
              <ul className="space-y-2">
                {["CAC Certificate", "Bank Statement (6 months)", "Valid ID"].map((doc) => (
                  <li key={doc} className="flex items-center justify-between">
                    <span>{doc}</span>
                    <Button size="sm" variant="outline" onClick={() => {}}>Upload</Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-navy">Employer</label>
              <input type="text" value={form.employer} onChange={(e) => update("employer", e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy">Job Title</label>
              <input type="text" value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy">Monthly Income (₦)</label>
              <input type="number" value={form.monthlyIncome} onChange={(e) => update("monthlyIncome", e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
          </div>
        );
      case 3:
        if (product === "Payday Loan") {
          return (
            <div className="space-y-3 text-sm">
              <h3 className="font-bold text-navy text-lg">Review Application</h3>
              {Object.entries({ Product: product, Amount: `₦${parseInt(form.amount || "0").toLocaleString()}`, Purpose: form.purpose, Tenure: `${form.tenure} months`, Employer: form.employer, Income: `₦${parseInt(form.monthlyIncome || "0").toLocaleString()}` }).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">{k}</span><span className="font-medium text-navy">{v}</span></div>
              ))}
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-navy">Monthly Income (₦)</label>
              <input type="number" value={form.monthlyIncome} onChange={(e) => update("monthlyIncome", e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
            <p className="text-sm text-gray-500">Documents marked as uploaded (demo mode).</p>
          </div>
        );
      case 4:
        return product === "Business Loan" ? (
          <div className="space-y-3 text-sm">
            <h3 className="font-bold text-navy text-lg">Review Application</h3>
            {Object.entries({ Product: product, Amount: `₦${parseInt(form.amount || "0").toLocaleString()}`, Purpose: form.purpose, Tenure: `${form.tenure} months`, Business: form.businessName, Income: `₦${parseInt(form.monthlyIncome || "0").toLocaleString()}` }).map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-gray-50"><span className="text-gray-500">{k}</span><span className="font-medium text-navy">{v}</span></div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h3 className="font-bold text-navy text-lg">Ready to Submit</h3>
            <p className="text-gray-500 mt-2">Your application will be reviewed within 2 business days.</p>
          </div>
        );
      case 5:
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h3 className="font-bold text-navy text-lg">Ready to Submit</h3>
            <p className="text-gray-500 mt-2">Your application will be reviewed within 2 business days.</p>
          </div>
        );
      default:
        return null;
    }
  };

  const isLastStep = step === totalSteps;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/customer/loans" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-navy">
        <ArrowLeft className="w-4 h-4" /> Back to Loans
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-navy">Apply for {product}</h1>
        <p className="text-gray-500 text-sm">Step {step} of {totalSteps}: {STEPS[product][step - 1]}</p>
      </div>

      <div className="flex gap-2">
        {STEPS[product].map((_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-full ${i < step ? "bg-cyan" : i === step - 1 ? "bg-navy" : "bg-gray-200"}`} />
        ))}
      </div>

      <Card>{renderStep()}</Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => { saveDraft(); }}>Save Draft</Button>
        <div className="flex gap-3">
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}><ArrowLeft className="w-4 h-4" /> Back</Button>}
          {isLastStep ? (
            <Button onClick={handleSubmit}>Submit Application</Button>
          ) : (
            <Button onClick={handleNext}>Continue <ArrowRight className="w-4 h-4" /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApplyLoanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading...</div>}>
      <ApplyForm />
    </Suspense>
  );
}
