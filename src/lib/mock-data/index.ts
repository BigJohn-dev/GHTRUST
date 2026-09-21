import type {
  Customer,
  SavingsAccount,
  Loan,
  LoanApplication,
  Transaction,
  InvestmentPlan,
  CustomerInvestment,
  GroupThrift,
  GroupContribution,
  Notification,
  Staff,
  AuditLog,
  SavingsProduct,
  RepaymentSchedule,
} from "../types";

export const CURRENT_CUSTOMER_ID = "cust-001";

export const branches = ["Lagos Main", "Lagos Ikeja", "Akure Central", "Akure Oba Road"];

export const savingsProducts: SavingsProduct[] = [
  {
    id: "sp-1",
    name: "Yearly Thrift",
    interestRate: 12,
    minDeposit: 5000,
    description: "Lock in savings for 12 months with competitive returns.",
    features: ["12% p.a. interest", "Minimum ₦5,000", "Auto-renewal option"],
  },
  {
    id: "sp-2",
    name: "Regular Savings",
    interestRate: 8,
    minDeposit: 1000,
    description: "Flexible savings with easy access to your funds.",
    features: ["8% p.a. interest", "No lock-in period", "Free withdrawals"],
  },
  {
    id: "sp-3",
    name: "Fixed Savings",
    interestRate: 15,
    minDeposit: 50000,
    description: "Fixed deposit with premium interest rates.",
    features: ["15% p.a. interest", "6-24 month terms", "Guaranteed returns"],
  },
];

export const customers: Customer[] = [
  {
    id: "cust-001",
    name: "Adaeze Okafor",
    email: "adaeze.okafor@email.com",
    phone: "+234 803 456 7890",
    bvn: "22145678901",
    branch: "Lagos Main",
    accountNumber: "3012345678",
    joinedDate: "2023-03-15",
    status: "active",
    savingsBalance: 2450000,
    walletBalance: 185000,
    investmentBalance: 500000,
  },
  {
    id: "cust-002",
    name: "Chukwuma Eze",
    email: "chukwuma.eze@email.com",
    phone: "+234 805 123 4567",
    bvn: "22198765432",
    branch: "Akure Central",
    accountNumber: "3012345679",
    joinedDate: "2022-11-20",
    status: "active",
    savingsBalance: 890000,
    walletBalance: 45000,
    investmentBalance: 0,
  },
  {
    id: "cust-003",
    name: "Fatima Abdullahi",
    email: "fatima.abdullahi@email.com",
    phone: "+234 807 234 5678",
    bvn: "22134567890",
    branch: "Lagos Ikeja",
    accountNumber: "3012345680",
    joinedDate: "2024-01-08",
    status: "active",
    savingsBalance: 1250000,
    walletBalance: 92000,
    investmentBalance: 250000,
  },
  {
    id: "cust-004",
    name: "Emeka Nwosu",
    email: "emeka.nwosu@email.com",
    phone: "+234 809 345 6789",
    bvn: "22156789012",
    branch: "Akure Oba Road",
    accountNumber: "3012345681",
    joinedDate: "2023-07-22",
    status: "active",
    savingsBalance: 560000,
    walletBalance: 28000,
    investmentBalance: 100000,
  },
  {
    id: "cust-005",
    name: "Blessing Adeyemi",
    email: "blessing.adeyemi@email.com",
    phone: "+234 811 456 7890",
    bvn: "22167890123",
    branch: "Lagos Main",
    accountNumber: "3012345682",
    joinedDate: "2024-02-14",
    status: "inactive",
    savingsBalance: 320000,
    walletBalance: 15000,
    investmentBalance: 0,
  },
  {
    id: "cust-006",
    name: "Ibrahim Musa",
    email: "ibrahim.musa@email.com",
    phone: "+234 813 567 8901",
    bvn: "22178901234",
    branch: "Lagos Ikeja",
    accountNumber: "3012345683",
    joinedDate: "2023-09-30",
    status: "active",
    savingsBalance: 1780000,
    walletBalance: 210000,
    investmentBalance: 750000,
  },
];

export const savingsAccounts: SavingsAccount[] = [
  { id: "sa-1", customerId: "cust-001", product: "Yearly Thrift", balance: 1200000, interestRate: 12, openedDate: "2024-01-15", maturityDate: "2025-01-15", status: "active" },
  { id: "sa-2", customerId: "cust-001", product: "Regular Savings", balance: 750000, interestRate: 8, openedDate: "2023-06-10", status: "active" },
  { id: "sa-3", customerId: "cust-001", product: "Fixed Savings", balance: 500000, interestRate: 15, openedDate: "2024-03-01", maturityDate: "2025-03-01", status: "active" },
];

export const loans: Loan[] = [
  {
    id: "loan-001",
    customerId: "cust-001",
    customerName: "Adaeze Okafor",
    product: "Business Loan",
    amount: 2000000,
    disbursedAmount: 2000000,
    outstanding: 1450000,
    interestRate: 18,
    tenure: 12,
    monthlyPayment: 185000,
    status: "active",
    applicationDate: "2024-04-10",
    disbursementDate: "2024-04-20",
    nextDueDate: "2025-08-15",
    branch: "Lagos Main",
  },
  {
    id: "loan-002",
    customerId: "cust-002",
    customerName: "Chukwuma Eze",
    product: "Payday Loan",
    amount: 150000,
    disbursedAmount: 150000,
    outstanding: 45000,
    interestRate: 24,
    tenure: 3,
    monthlyPayment: 55000,
    status: "active",
    applicationDate: "2025-05-01",
    disbursementDate: "2025-05-03",
    nextDueDate: "2025-08-01",
    branch: "Akure Central",
  },
  {
    id: "loan-003",
    customerId: "cust-003",
    customerName: "Fatima Abdullahi",
    product: "Business Loan",
    amount: 3500000,
    disbursedAmount: 3500000,
    outstanding: 2800000,
    interestRate: 16,
    tenure: 18,
    monthlyPayment: 245000,
    status: "active",
    applicationDate: "2024-08-15",
    disbursementDate: "2024-08-25",
    nextDueDate: "2025-08-10",
    branch: "Lagos Ikeja",
  },
  {
    id: "loan-004",
    customerId: "cust-004",
    customerName: "Emeka Nwosu",
    product: "Payday Loan",
    amount: 80000,
    disbursedAmount: 80000,
    outstanding: 80000,
    interestRate: 24,
    tenure: 2,
    monthlyPayment: 45000,
    status: "overdue",
    applicationDate: "2025-06-01",
    disbursementDate: "2025-06-03",
    nextDueDate: "2025-07-01",
    branch: "Akure Oba Road",
  },
];

export const loanApplications: LoanApplication[] = [
  {
    id: "app-001",
    customerId: "cust-005",
    customerName: "Blessing Adeyemi",
    product: "Business Loan",
    amount: 500000,
    purpose: "Expand retail shop inventory",
    tenure: 6,
    status: "pending",
    submittedDate: "2025-07-05",
    branch: "Lagos Main",
    monthlyIncome: 180000,
  },
  {
    id: "app-002",
    customerId: "cust-006",
    customerName: "Ibrahim Musa",
    product: "Payday Loan",
    amount: 200000,
    purpose: "Emergency medical expenses",
    tenure: 3,
    status: "under_review",
    submittedDate: "2025-07-08",
    branch: "Lagos Ikeja",
    monthlyIncome: 350000,
  },
  {
    id: "app-003",
    customerId: "cust-002",
    customerName: "Chukwuma Eze",
    product: "Business Loan",
    amount: 1000000,
    purpose: "Purchase delivery motorcycle fleet",
    tenure: 12,
    status: "pending",
    submittedDate: "2025-07-09",
    branch: "Akure Central",
    monthlyIncome: 220000,
  },
  {
    id: "app-004",
    customerId: "cust-004",
    customerName: "Emeka Nwosu",
    product: "Payday Loan",
    amount: 50000,
    purpose: "School fees payment",
    tenure: 2,
    status: "pending",
    submittedDate: "2025-07-10",
    branch: "Akure Oba Road",
    monthlyIncome: 95000,
  },
];

export const transactions: Transaction[] = [
  { id: "txn-001", customerId: "cust-001", customerName: "Adaeze Okafor", type: "credit", category: "Savings Deposit", amount: 50000, status: "completed", date: "2025-07-10T10:30:00", reference: "GHT20250710001", description: "Monthly savings contribution", channel: "Mobile App" },
  { id: "txn-002", customerId: "cust-001", customerName: "Adaeze Okafor", type: "debit", category: "Loan Repayment", amount: 185000, status: "completed", date: "2025-07-08T14:15:00", reference: "GHT20250708002", description: "Business Loan installment #5", channel: "Auto-debit" },
  { id: "txn-003", customerId: "cust-001", customerName: "Adaeze Okafor", type: "credit", category: "Wallet Fund", amount: 100000, status: "completed", date: "2025-07-05T09:00:00", reference: "GHT20250705003", description: "Wallet top-up via bank transfer", channel: "Bank Transfer" },
  { id: "txn-004", customerId: "cust-001", customerName: "Adaeze Okafor", type: "debit", category: "Transfer", amount: 25000, status: "completed", date: "2025-07-03T16:45:00", reference: "GHT20250703004", description: "Transfer to Chukwuma Eze", channel: "Mobile App" },
  { id: "txn-005", customerId: "cust-001", customerName: "Adaeze Okafor", type: "credit", category: "Interest", amount: 12500, status: "completed", date: "2025-07-01T00:00:00", reference: "GHT20250701005", description: "Yearly Thrift interest credit", channel: "System" },
  { id: "txn-006", customerId: "cust-002", customerName: "Chukwuma Eze", type: "credit", category: "Savings Deposit", amount: 20000, status: "completed", date: "2025-07-09T11:20:00", reference: "GHT20250709006", description: "Regular savings deposit", channel: "Branch" },
  { id: "txn-007", customerId: "cust-003", customerName: "Fatima Abdullahi", type: "debit", category: "Loan Repayment", amount: 245000, status: "completed", date: "2025-07-07T08:30:00", reference: "GHT20250707007", description: "Business Loan installment #10", channel: "Auto-debit" },
  { id: "txn-008", customerId: "cust-004", customerName: "Emeka Nwosu", type: "debit", category: "Loan Repayment", amount: 45000, status: "failed", date: "2025-07-01T12:00:00", reference: "GHT20250701008", description: "Payday Loan installment - insufficient funds", channel: "Auto-debit" },
  { id: "txn-009", customerId: "cust-006", customerName: "Ibrahim Musa", type: "credit", category: "Investment", amount: 250000, status: "completed", date: "2025-07-06T15:00:00", reference: "GHT20250706009", description: "Growth Fund investment", channel: "Mobile App" },
  { id: "txn-010", customerId: "cust-001", customerName: "Adaeze Okafor", type: "debit", category: "Withdrawal", amount: 30000, status: "pending", date: "2025-07-11T08:00:00", reference: "GHT20250711010", description: "Wallet withdrawal to GTBank", channel: "Mobile App" },
];

export const investmentPlans: InvestmentPlan[] = [
  { id: "inv-1", name: "Secure Growth Fund", minAmount: 50000, returnRate: 14, tenure: 12, risk: "low", description: "Conservative fund with steady returns backed by treasury instruments." },
  { id: "inv-2", name: "Balanced Portfolio", minAmount: 100000, returnRate: 18, tenure: 18, risk: "medium", description: "Mixed portfolio of bonds and commercial paper for balanced growth." },
  { id: "inv-3", name: "High Yield Fund", minAmount: 250000, returnRate: 24, tenure: 24, risk: "high", description: "Aggressive growth fund targeting SME lending returns." },
];

export const customerInvestments: CustomerInvestment[] = [
  { id: "ci-1", planId: "inv-1", planName: "Secure Growth Fund", amount: 300000, returnRate: 14, startDate: "2024-06-01", maturityDate: "2025-06-01", projectedReturn: 42000, status: "matured" },
  { id: "ci-2", planId: "inv-2", planName: "Balanced Portfolio", amount: 200000, returnRate: 18, startDate: "2025-01-15", maturityDate: "2026-07-15", projectedReturn: 36000, status: "active" },
];

export const groupThrifts: GroupThrift[] = [
  { id: "gt-1", name: "Lagos Market Women Association", leader: "Adaeze Okafor", members: 25, targetAmount: 5000000, collectedAmount: 3750000, cycle: 3, branch: "Lagos Main", nextMeeting: "2025-07-20", status: "active" },
  { id: "gt-2", name: "Akure Traders Cooperative", leader: "Chukwuma Eze", members: 18, targetAmount: 2700000, collectedAmount: 2700000, cycle: 2, branch: "Akure Central", nextMeeting: "2025-07-25", status: "completed" },
  { id: "gt-3", name: "Ikeja SME Alliance", leader: "Fatima Abdullahi", members: 12, targetAmount: 3600000, collectedAmount: 1800000, cycle: 1, branch: "Lagos Ikeja", nextMeeting: "2025-07-18", status: "active" },
];

export const groupContributions: GroupContribution[] = [
  { id: "gc-1", groupId: "gt-1", memberName: "Adaeze Okafor", amount: 50000, date: "2025-07-01", cycle: 3 },
  { id: "gc-2", groupId: "gt-1", memberName: "Blessing Adeyemi", amount: 50000, date: "2025-07-01", cycle: 3 },
  { id: "gc-3", groupId: "gt-1", memberName: "Ibrahim Musa", amount: 50000, date: "2025-07-02", cycle: 3 },
  { id: "gc-4", groupId: "gt-1", memberName: "Adaeze Okafor", amount: 50000, date: "2025-06-01", cycle: 3 },
  { id: "gc-5", groupId: "gt-3", memberName: "Fatima Abdullahi", amount: 75000, date: "2025-07-05", cycle: 1 },
];

export const customerNotifications: Notification[] = [
  { id: "cn-1", title: "Loan Payment Due", message: "Your Business Loan installment of ₦185,000 is due on Aug 15, 2025.", type: "warning", date: "2025-07-10", read: false, portal: "customer" },
  { id: "cn-2", title: "Interest Credited", message: "₦12,500 interest has been credited to your Yearly Thrift account.", type: "success", date: "2025-07-01", read: true, portal: "customer" },
  { id: "cn-3", title: "Group Meeting Reminder", message: "Lagos Market Women Association meeting on July 20 at Lagos Main branch.", type: "info", date: "2025-07-08", read: false, portal: "customer" },
  { id: "cn-4", title: "Withdrawal Processing", message: "Your wallet withdrawal of ₦30,000 is being processed.", type: "info", date: "2025-07-11", read: false, portal: "customer" },
  { id: "cn-5", title: "Investment Maturity", message: "Your Secure Growth Fund matured. ₦342,000 is available for reinvestment.", type: "success", date: "2025-06-01", read: true, portal: "customer" },
];

export const adminNotifications: Notification[] = [
  { id: "an-1", title: "New Loan Application", message: "Emeka Nwosu submitted a Payday Loan application for ₦50,000.", type: "info", date: "2025-07-10", read: false, portal: "admin" },
  { id: "an-2", title: "Overdue Loan Alert", message: "Emeka Nwosu's Payday Loan (₦80,000) is 10 days overdue.", type: "error", date: "2025-07-11", read: false, portal: "admin" },
  { id: "an-3", title: "High Deposit Volume", message: "Total deposits today exceeded ₦15M across all branches.", type: "success", date: "2025-07-10", read: true, portal: "admin" },
  { id: "an-4", title: "Pending Approvals", message: "4 loan applications awaiting review.", type: "warning", date: "2025-07-09", read: false, portal: "admin" },
];

export const staff: Staff[] = [
  { id: "st-1", name: "Ngozi Okonkwo", email: "ngozi.okonkwo@ghtrust.ng", role: "branch_manager", branch: "Lagos Main", status: "active", lastLogin: "2025-07-11T08:30:00" },
  { id: "st-2", name: "Tunde Bakare", email: "tunde.bakare@ghtrust.ng", role: "loan_officer", branch: "Lagos Main", status: "active", lastLogin: "2025-07-11T07:45:00" },
  { id: "st-3", name: "Amina Hassan", email: "amina.hassan@ghtrust.ng", role: "teller", branch: "Lagos Ikeja", status: "active", lastLogin: "2025-07-10T16:00:00" },
  { id: "st-4", name: "Segun Adebayo", email: "segun.adebayo@ghtrust.ng", role: "loan_officer", branch: "Akure Central", status: "active", lastLogin: "2025-07-11T09:00:00" },
  { id: "st-5", name: "Grace Etim", email: "grace.etim@ghtrust.ng", role: "teller", branch: "Akure Oba Road", status: "active", lastLogin: "2025-07-10T14:30:00" },
  { id: "st-6", name: "Kunle Ojo", email: "kunle.ojo@ghtrust.ng", role: "admin", branch: "Head Office", status: "active", lastLogin: "2025-07-11T08:00:00" },
];

export const auditLogs: AuditLog[] = [
  { id: "al-1", action: "Loan Approved", user: "Tunde Bakare", role: "loan_officer", timestamp: "2025-07-08T10:30:00", details: "Approved Business Loan for Ibrahim Musa - ₦2,000,000", ip: "102.89.45.12" },
  { id: "al-2", action: "Customer Created", user: "Amina Hassan", role: "teller", timestamp: "2025-07-07T14:15:00", details: "New customer registration: Blessing Adeyemi", ip: "102.89.45.18" },
  { id: "al-3", action: "Disbursement", user: "Ngozi Okonkwo", role: "branch_manager", timestamp: "2025-07-06T11:00:00", details: "Disbursed ₦150,000 Payday Loan to Chukwuma Eze", ip: "102.89.45.12" },
  { id: "al-4", action: "Loan Rejected", user: "Segun Adebayo", role: "loan_officer", timestamp: "2025-07-05T16:45:00", details: "Rejected Payday Loan for unknown applicant - insufficient income", ip: "102.89.32.07" },
  { id: "al-5", action: "Product Updated", user: "Kunle Ojo", role: "admin", timestamp: "2025-07-04T09:30:00", details: "Updated Fixed Savings interest rate to 15% p.a.", ip: "102.89.10.01" },
  { id: "al-6", action: "Login", user: "Ngozi Okonkwo", role: "branch_manager", timestamp: "2025-07-11T08:30:00", details: "Successful login from Lagos Main branch", ip: "102.89.45.12" },
];

export const repaymentSchedules: RepaymentSchedule[] = [
  { id: "rs-1", loanId: "loan-001", installment: 1, dueDate: "2024-05-15", amount: 185000, principal: 155000, interest: 30000, status: "paid" },
  { id: "rs-2", loanId: "loan-001", installment: 2, dueDate: "2024-06-15", amount: 185000, principal: 157325, interest: 27675, status: "paid" },
  { id: "rs-3", loanId: "loan-001", installment: 3, dueDate: "2024-07-15", amount: 185000, principal: 159685, interest: 25315, status: "paid" },
  { id: "rs-4", loanId: "loan-001", installment: 4, dueDate: "2024-08-15", amount: 185000, principal: 162080, interest: 22920, status: "paid" },
  { id: "rs-5", loanId: "loan-001", installment: 5, dueDate: "2025-07-08", amount: 185000, principal: 164510, interest: 20490, status: "paid" },
  { id: "rs-6", loanId: "loan-001", installment: 6, dueDate: "2025-08-15", amount: 185000, principal: 166977, interest: 18023, status: "pending" },
  { id: "rs-7", loanId: "loan-001", installment: 7, dueDate: "2025-09-15", amount: 185000, principal: 169481, interest: 15519, status: "pending" },
];

export const dashboardChartData = {
  monthlyIncome: [
    { month: "Jan", income: 320000, expense: 185000 },
    { month: "Feb", income: 280000, expense: 210000 },
    { month: "Mar", income: 350000, expense: 195000 },
    { month: "Apr", income: 310000, expense: 220000 },
    { month: "May", income: 400000, expense: 185000 },
    { month: "Jun", income: 380000, expense: 200000 },
    { month: "Jul", income: 420000, expense: 215000 },
  ],
  spendingBreakdown: [
    { name: "Loan Repayment", value: 45, color: "#1B2F6B" },
    { name: "Savings", value: 25, color: "#2FA4D7" },
    { name: "Transfers", value: 15, color: "#00A86B" },
    { name: "Investments", value: 10, color: "#E5AF59" },
    { name: "Other", value: 5, color: "#CF2E2E" },
  ],
  savingsPlans: [
    { name: "Yearly Thrift", current: 1200000, target: 2000000, color: "#1B2F6B" },
    { name: "Regular Savings", current: 750000, target: 1000000, color: "#2FA4D7" },
    { name: "Fixed Savings", current: 500000, target: 500000, color: "#00A86B" },
  ],
  adminKPIs: {
    totalDisbursed: 5730000,
    totalDisbursedTrend: 12.5,
    pendingApprovals: 4,
    pendingApprovalsTrend: -8,
    totalDeposits: 45800000,
    totalDepositsTrend: 18.3,
    overdueLoans: 1,
    overdueLoansTrend: 0,
    newCustomers: 23,
    newCustomersTrend: 15.2,
  },
  adminMonthlyData: [
    { month: "Jan", disbursed: 1200000, deposits: 5200000, repayments: 980000 },
    { month: "Feb", disbursed: 800000, deposits: 4800000, repayments: 1100000 },
    { month: "Mar", disbursed: 1500000, deposits: 6100000, repayments: 1050000 },
    { month: "Apr", disbursed: 900000, deposits: 5500000, repayments: 1200000 },
    { month: "May", disbursed: 1100000, deposits: 6800000, repayments: 1150000 },
    { month: "Jun", disbursed: 1300000, deposits: 7200000, repayments: 1300000 },
    { month: "Jul", disbursed: 730000, deposits: 7500000, repayments: 1250000 },
  ],
  adminLoanDistribution: [
    { name: "Business Loan", value: 65, color: "#1B2F6B" },
    { name: "Payday Loan", value: 35, color: "#2FA4D7" },
  ],
};

export const activityTimeline = [
  { id: "at-1", action: "Savings deposit", amount: 50000, date: "2025-07-10T10:30:00", type: "credit" as const },
  { id: "at-2", action: "Loan repayment", amount: 185000, date: "2025-07-08T14:15:00", type: "debit" as const },
  { id: "at-3", action: "Wallet funded", amount: 100000, date: "2025-07-05T09:00:00", type: "credit" as const },
  { id: "at-4", action: "Transfer sent", amount: 25000, date: "2025-07-03T16:45:00", type: "debit" as const },
  { id: "at-5", action: "Interest received", amount: 12500, date: "2025-07-01T00:00:00", type: "credit" as const },
];

export const defaultLoanDrafts = [
  {
    id: "draft-1",
    product: "Business Loan" as const,
    step: 3,
    totalSteps: 5,
    data: { amount: 1500000, purpose: "Restaurant expansion", tenure: 12, businessName: "Adaeze's Kitchen", monthlyIncome: 450000 },
    lastUpdated: "2025-07-09T15:30:00",
  },
  {
    id: "draft-2",
    product: "Payday Loan" as const,
    step: 2,
    totalSteps: 4,
    data: { amount: 75000, purpose: "Utility bills", tenure: 2 },
    lastUpdated: "2025-07-10T09:15:00",
  },
];
