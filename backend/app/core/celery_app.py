from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "ghtrust_mfb",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Lagos",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_prefetch_multiplier=1,
    task_always_eager=settings.celery_task_always_eager,
    task_routes={
        "app.workers.tasks.accrue_savings_interest": {"queue": "scheduled"},
        "app.workers.tasks.send_loan_reminders": {"queue": "notifications"},
        "app.workers.tasks.process_pending_withdrawals": {"queue": "transactions"},
        "app.workers.tasks.reconcile_payments": {"queue": "reconciliation"},
        "app.workers.tasks.food_basket_fulfillment_check": {"queue": "scheduled"},
    },
    beat_schedule={
        "accrue-savings-interest-daily": {
            "task": "app.workers.tasks.accrue_savings_interest",
            "schedule": crontab(hour=0, minute=30),
        },
        "loan-payment-reminders": {
            "task": "app.workers.tasks.send_loan_reminders",
            "schedule": crontab(hour=8, minute=0),
        },
        "process-pending-withdrawals": {
            "task": "app.workers.tasks.process_pending_withdrawals",
            "schedule": crontab(minute="*/15"),
        },
        "payment-reconciliation": {
            "task": "app.workers.tasks.reconcile_payments",
            "schedule": crontab(hour="*/2", minute=0),
        },
        "food-basket-fulfillment-check": {
            "task": "app.workers.tasks.food_basket_fulfillment_check",
            "schedule": crontab(hour=9, minute=0),
        },
    },
)
