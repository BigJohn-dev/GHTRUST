"""
Help centre questions, served to the app so they can be edited without a release.
Keep answers short, and true to how the app works today.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Faq:
    id: str
    topic: str
    question: str
    answer: str


TOPICS = ("Getting started", "Loans", "Repayments", "Wallet", "Security")

FAQS: tuple[Faq, ...] = (
    Faq(
        "open-account",
        "Getting started",
        "What do I need to open an account?",
        "Your BVN, the phone number registered to it (we send a code there), and a quick live face check. "
        "It takes a few minutes and there's no paperwork.",
    ),
    Faq(
        "bvn-phone",
        "Getting started",
        "My BVN phone number is old. What can I do?",
        "The code goes to the number on your BVN, so update it with your bank first. Once your bank has "
        "updated it, try again.",
    ),
    Faq(
        "face-check",
        "Getting started",
        "The face check keeps failing.",
        "Face a light source, remove glasses or a face covering, hold the phone at eye level and follow the "
        "prompts. After a few tries there's a short wait before you can try again.",
    ),
    Faq(
        "apply",
        "Loans",
        "How do I apply for a loan?",
        "Tap Apply for a loan on Home, choose a loan type and fill in each step. You can save and come back "
        "later. Upload the documents listed, then review and submit.",
    ),
    Faq(
        "decision-time",
        "Loans",
        "How long does a decision take?",
        "It depends on the loan type and whether your documents are complete. You can follow every step in "
        "Loans, and we'll notify you as soon as there's a decision or if we need anything.",
    ),
    Faq(
        "offer",
        "Loans",
        "My loan is approved. What happens next?",
        "Open the application and tap Review offer. You'll see the amount, interest, fees, total to repay "
        "and every payment date. If you're happy, accept with your transaction PIN and we'll pay it into your "
        "bank account.",
    ),
    Faq(
        "documents",
        "Loans",
        "A document was rejected.",
        "Open the application to see why, then upload a clearer or correct copy. We'll review it again.",
    ),
    Faq(
        "how-to-repay",
        "Repayments",
        "How do I repay?",
        "Add money to your wallet by bank transfer, then open your loan and tap Repay. Choose the next "
        "payment, the full balance or another amount, and confirm with your transaction PIN.",
    ),
    Faq(
        "early",
        "Repayments",
        "Can I pay early?",
        "Yes, any time. Payments go to your oldest unpaid instalment first, interest before principal.",
    ),
    Faq(
        "late",
        "Repayments",
        "What if I can't pay on time?",
        "Contact us before the due date so we can talk about options. Late payments can attract the charges "
        "shown in your loan offer and may be reported to credit bureaus.",
    ),
    Faq(
        "add-money",
        "Wallet",
        "How do I add money?",
        "Tap Add money and transfer to the account number shown from any bank app. Your wallet is credited "
        "automatically, usually within minutes.",
    ),
    Faq(
        "transfer-missing",
        "Wallet",
        "I sent money but my wallet hasn't updated.",
        "Most transfers arrive within minutes. If it's been over an hour, report a problem with the amount, "
        "the time and the bank you sent from, and we'll trace it.",
    ),
    Faq(
        "withdraw",
        "Wallet",
        "How do I withdraw?",
        "Tap Withdraw, add a bank account in your own name the first time, enter the amount and confirm with "
        "your transaction PIN. If a withdrawal fails, the money comes back to your wallet.",
    ),
    Faq(
        "forgot-pin",
        "Security",
        "I forgot my PIN.",
        "On the sign-in screen tap Forgot PIN? and confirm with your BVN. For the transaction PIN, go to "
        "Profile → Security → Forgot transaction PIN.",
    ),
    Faq(
        "new-phone",
        "Security",
        "I got a new phone.",
        "Sign in on the new phone and approve it from your old one. If you don't have the old phone any more, "
        "confirm with your BVN and PIN; withdrawals are then paused for 24 hours to protect you.",
    ),
    Faq(
        "scam",
        "Security",
        "Someone called asking for my PIN or code.",
        "Hang up. GH Trust will never ask for your PINs or one-time codes. If you shared them, use Sign out of "
        "all devices in Profile, change your PINs and contact us straight away.",
    ),
)
