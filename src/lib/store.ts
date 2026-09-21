"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  LoanApplication,
  LoanDraft,
  Toast,
  Transaction,
  Notification,
  AuditLog,
  SavingsAccount,
  CustomerInvestment,
} from "./types";
import {
  loanApplications as initialApplications,
  transactions as initialTransactions,
  customerNotifications as initialCustomerNotifs,
  adminNotifications as initialAdminNotifs,
  auditLogs as initialAuditLogs,
  savingsAccounts as initialSavingsAccounts,
  customerInvestments as initialInvestments,
  defaultLoanDrafts,
  customers,
  CURRENT_CUSTOMER_ID,
} from "./mock-data";
import { generateId } from "./utils";

interface AppState {
  loanApplications: LoanApplication[];
  loanDrafts: LoanDraft[];
  transactions: Transaction[];
  customerNotifications: Notification[];
  adminNotifications: Notification[];
  auditLogs: AuditLog[];
  savingsAccounts: SavingsAccount[];
  investments: CustomerInvestment[];
  walletBalance: number;
  toasts: Toast[];

  approveApplication: (id: string) => void;
  rejectApplication: (id: string) => void;
  saveLoanDraft: (draft: LoanDraft, silent?: boolean) => void;
  deleteLoanDraft: (id: string) => void;
  submitLoanApplication: (app: Omit<LoanApplication, "id" | "status" | "submittedDate">) => void;
  fundWallet: (amount: number) => void;
  withdrawWallet: (amount: number) => void;
  openSavingsAccount: (product: string, amount: number) => void;
  makeInvestment: (planName: string, amount: number, returnRate: number, tenure: number) => void;
  markNotificationRead: (id: string, portal: "customer" | "admin") => void;
  addToast: (message: string, type: Toast["type"]) => void;
  removeToast: (id: string) => void;
}

const currentCustomer = customers.find((c) => c.id === CURRENT_CUSTOMER_ID)!;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      loanApplications: initialApplications,
      loanDrafts: defaultLoanDrafts,
      transactions: initialTransactions,
      customerNotifications: initialCustomerNotifs,
      adminNotifications: initialAdminNotifs,
      auditLogs: initialAuditLogs,
      savingsAccounts: initialSavingsAccounts,
      investments: initialInvestments,
      walletBalance: currentCustomer.walletBalance,
      toasts: [],

      approveApplication: (id) => {
        set((state) => ({
          loanApplications: state.loanApplications.map((app) =>
            app.id === id ? { ...app, status: "approved" as const } : app
          ),
          auditLogs: [
            {
              id: generateId(),
              action: "Loan Approved",
              user: "Tunde Bakare",
              role: "loan_officer",
              timestamp: new Date().toISOString(),
              details: `Approved loan application ${id}`,
              ip: "102.89.45.12",
            },
            ...state.auditLogs,
          ],
          adminNotifications: [
            {
              id: generateId(),
              title: "Application Approved",
              message: `Loan application ${id} has been approved.`,
              type: "success",
              date: new Date().toISOString().split("T")[0],
              read: false,
              portal: "admin",
            },
            ...state.adminNotifications,
          ],
        }));
        get().addToast("Loan application approved successfully", "success");
      },

      rejectApplication: (id) => {
        set((state) => ({
          loanApplications: state.loanApplications.map((app) =>
            app.id === id ? { ...app, status: "rejected" as const } : app
          ),
          auditLogs: [
            {
              id: generateId(),
              action: "Loan Rejected",
              user: "Tunde Bakare",
              role: "loan_officer",
              timestamp: new Date().toISOString(),
              details: `Rejected loan application ${id}`,
              ip: "102.89.45.12",
            },
            ...state.auditLogs,
          ],
        }));
        get().addToast("Loan application rejected", "info");
      },

      saveLoanDraft: (draft, silent = false) => {
        set((state) => {
          const existing = state.loanDrafts.findIndex((d) => d.id === draft.id);
          const drafts = [...state.loanDrafts];
          if (existing >= 0) {
            drafts[existing] = draft;
          } else {
            drafts.push(draft);
          }
          return { loanDrafts: drafts };
        });
        if (!silent) get().addToast("Draft saved successfully", "success");
      },

      deleteLoanDraft: (id) => {
        set((state) => ({
          loanDrafts: state.loanDrafts.filter((d) => d.id !== id),
        }));
      },

      submitLoanApplication: (app) => {
        const newApp: LoanApplication = {
          ...app,
          id: `app-${generateId()}`,
          status: "pending",
          submittedDate: new Date().toISOString().split("T")[0],
        };
        set((state) => ({
          loanApplications: [newApp, ...state.loanApplications],
          adminNotifications: [
            {
              id: generateId(),
              title: "New Loan Application",
              message: `${app.customerName} submitted a ${app.product} application for ₦${app.amount.toLocaleString()}.`,
              type: "info",
              date: new Date().toISOString().split("T")[0],
              read: false,
              portal: "admin",
            },
            ...state.adminNotifications,
          ],
        }));
        get().addToast("Loan application submitted successfully", "success");
      },

      fundWallet: (amount) => {
        set((state) => ({
          walletBalance: state.walletBalance + amount,
          transactions: [
            {
              id: generateId(),
              customerId: CURRENT_CUSTOMER_ID,
              customerName: currentCustomer.name,
              type: "credit",
              category: "Wallet Fund",
              amount,
              status: "completed",
              date: new Date().toISOString(),
              reference: `GHT${Date.now()}`,
              description: "Wallet top-up",
              channel: "Mobile App",
            },
            ...state.transactions,
          ],
        }));
        get().addToast(`Wallet funded with ₦${amount.toLocaleString()}`, "success");
      },

      withdrawWallet: (amount) => {
        const { walletBalance } = get();
        if (amount > walletBalance) {
          get().addToast("Insufficient wallet balance", "error");
          return;
        }
        set((state) => ({
          walletBalance: state.walletBalance - amount,
          transactions: [
            {
              id: generateId(),
              customerId: CURRENT_CUSTOMER_ID,
              customerName: currentCustomer.name,
              type: "debit",
              category: "Withdrawal",
              amount,
              status: "pending",
              date: new Date().toISOString(),
              reference: `GHT${Date.now()}`,
              description: "Wallet withdrawal to bank account",
              channel: "Mobile App",
            },
            ...state.transactions,
          ],
        }));
        get().addToast("Withdrawal request submitted", "success");
      },

      openSavingsAccount: (product, amount) => {
        set((state) => ({
          savingsAccounts: [
            ...state.savingsAccounts,
            {
              id: generateId(),
              customerId: CURRENT_CUSTOMER_ID,
              product: product as SavingsAccount["product"],
              balance: amount,
              interestRate: product === "Fixed Savings" ? 15 : product === "Yearly Thrift" ? 12 : 8,
              openedDate: new Date().toISOString().split("T")[0],
              status: "active" as const,
            },
          ],
          walletBalance: state.walletBalance - amount,
        }));
        get().addToast(`${product} account opened successfully`, "success");
      },

      makeInvestment: (planName, amount, returnRate, tenure) => {
        const maturity = new Date();
        maturity.setMonth(maturity.getMonth() + tenure);
        set((state) => ({
          investments: [
            ...state.investments,
            {
              id: generateId(),
              planId: generateId(),
              planName,
              amount,
              returnRate,
              startDate: new Date().toISOString().split("T")[0],
              maturityDate: maturity.toISOString().split("T")[0],
              projectedReturn: Math.round(amount * (returnRate / 100) * (tenure / 12)),
              status: "active" as const,
            },
          ],
          walletBalance: state.walletBalance - amount,
        }));
        get().addToast(`Invested ₦${amount.toLocaleString()} in ${planName}`, "success");
      },

      markNotificationRead: (id, portal) => {
        set((state) => {
          if (portal === "customer") {
            return {
              customerNotifications: state.customerNotifications.map((n) =>
                n.id === id ? { ...n, read: true } : n
              ),
            };
          }
          return {
            adminNotifications: state.adminNotifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          };
        });
      },

      addToast: (message, type) => {
        const id = generateId();
        set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 4000);
      },

      removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      },
    }),
    {
      name: "gh-trust-store",
      partialize: (state) => ({
        loanApplications: state.loanApplications,
        loanDrafts: state.loanDrafts,
        transactions: state.transactions,
        customerNotifications: state.customerNotifications,
        adminNotifications: state.adminNotifications,
        auditLogs: state.auditLogs,
        savingsAccounts: state.savingsAccounts,
        investments: state.investments,
        walletBalance: state.walletBalance,
      }),
    }
  )
);
