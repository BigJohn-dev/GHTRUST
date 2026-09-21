import asyncio

import structlog
from celery.utils.log import get_task_logger

from app.core.celery_app import celery_app
from app.modules.payments.worker_service import run_process_pending_withdrawals, run_reconcile_payments

logger = get_task_logger(__name__)


@celery_app.task(name="app.workers.tasks.accrue_savings_interest", bind=True)
def accrue_savings_interest(self):
    """Daily interest accrual for savings accounts — runs at 00:30 WAT."""
    structlog.get_logger().info("task_started", task="accrue_savings_interest")
    # TODO: iterate active savings accounts, post ledger entries
    return {"status": "ok", "accounts_processed": 0}


@celery_app.task(name="app.workers.tasks.send_loan_reminders", bind=True)
def send_loan_reminders(self):
    """SMS/push reminders for loans due in 3 days and overdue."""
    structlog.get_logger().info("task_started", task="send_loan_reminders")
    return {"status": "ok", "reminders_sent": 0}


@celery_app.task(name="app.workers.tasks.process_pending_withdrawals", bind=True)
def process_pending_withdrawals(self):
    """Process queued wallet withdrawals via Paystack transfer."""
    structlog.get_logger().info("task_started", task="process_pending_withdrawals")
    return asyncio.run(run_process_pending_withdrawals())


@celery_app.task(name="app.workers.tasks.reconcile_payments", bind=True)
def reconcile_payments(self):
    """Match gateway webhooks to internal transactions and requery DVAs."""
    structlog.get_logger().info("task_started", task="reconcile_payments")
    return asyncio.run(run_reconcile_payments())


@celery_app.task(name="app.workers.tasks.food_basket_fulfillment_check", bind=True)
def food_basket_fulfillment_check(self):
    """Check upcoming food basket deliveries and notify fulfillment partner."""
    structlog.get_logger().info("task_started", task="food_basket_fulfillment_check")
    return {"status": "ok", "deliveries_checked": 0}
