export type ProductType =
  | "Yearly Thrift"
  | "Regular Savings"
  | "Fixed Savings"
  | "Business Loan"
  | "Payday Loan"
  | "Group Thrift"
  | "Investments";

export type TransactionStatus = "completed" | "pending" | "failed" | "reversed";
export type LoanStatus = "active" | "overdue" | "completed" | "pending" | "approved" | "rejected" | "disbursed";
export type ApplicationStatus = "pending" | "approved" | "rejected" | "under_review";
export type StaffRole = "teller" | "loan_officer" | "branch_manager" | "admin";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  bvn: string;
  branch: string;
  accountNumber: string;
  joinedDate: string;
  status: "active" | "inactive" | "suspended";
  savingsBalance: number;
  walletBalance: number;
  investmentBalance: number;
}

export interface SavingsAccount {
  id: string;
  customerId: string;
  product: ProductType;
  balance: number;
  interestRate: number;
  openedDate: string;
  maturityDate?: string;
  status: "active" | "matured" | "closed";
}

export interface Loan {
  id: string;
  customerId: string;
  customerName: string;
  product: "Business Loan" | "Payday Loan";
  amount: number;
  disbursedAmount: number;
  outstanding: number;
  interestRate: number;
  tenure: number;
  monthlyPayment: number;
  status: LoanStatus;
  applicationDate: string;
  disbursementDate?: string;
  nextDueDate: string;
  branch: string;
}

export interface LoanApplication {
  id: string;
  customerId: string;
  customerName: string;
  product: "Business Loan" | "Payday Loan";
  amount: number;
  purpose: string;
  tenure: number;
  status: ApplicationStatus;
  submittedDate: string;
  branch: string;
  monthlyIncome: number;
}

export interface LoanDraft {
  id: string;
  product: "Business Loan" | "Payday Loan";
  step: number;
  totalSteps: number;
  data: Record<string, string | number | undefined>;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  customerName: string;
  type: "credit" | "debit";
  category: string;
  amount: number;
  status: TransactionStatus;
  date: string;
  reference: string;
  description: string;
  channel: string;
}

export interface InvestmentPlan {
  id: string;
  name: string;
  minAmount: number;
  returnRate: number;
  tenure: number;
  risk: "low" | "medium" | "high";
  description: string;
}

export interface CustomerInvestment {
  id: string;
  planId: string;
  planName: string;
  amount: number;
  returnRate: number;
  startDate: string;
  maturityDate: string;
  projectedReturn: number;
  status: "active" | "matured";
}

export interface GroupThrift {
  id: string;
  name: string;
  leader: string;
  members: number;
  targetAmount: number;
  collectedAmount: number;
  cycle: number;
  branch: string;
  nextMeeting: string;
  status: "active" | "completed";
}

export interface GroupContribution {
  id: string;
  groupId: string;
  memberName: string;
  amount: number;
  date: string;
  cycle: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  date: string;
  read: boolean;
  portal: "customer" | "admin";
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  branch: string;
  status: "active" | "inactive";
  lastLogin: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  role: StaffRole;
  timestamp: string;
  details: string;
  ip: string;
}

export interface SavingsProduct {
  id: string;
  name: ProductType;
  interestRate: number;
  minDeposit: number;
  description: string;
  features: string[];
}

export interface RepaymentSchedule {
  id: string;
  loanId: string;
  installment: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
  status: "paid" | "pending" | "overdue";
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}
