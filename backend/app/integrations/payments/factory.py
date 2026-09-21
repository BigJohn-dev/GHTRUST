from app.core.config import settings
from app.integrations.monnify.client import MonnifyClient
from app.integrations.paystack.client import PaystackClient
from app.integrations.zest.client import ZestClient


def get_payment_client():
    """Return the configured payment rail client."""
    provider = settings.active_payment_provider
    if provider == "paystack":
        return PaystackClient()
    if provider == "zest":
        return ZestClient()
    return MonnifyClient()
