import pytest
from unittest.mock import AsyncMock, patch

import httpx


from app.integrations.dojah.client import DojahClient, MOCK_ENTITY, SANDBOX_BVN
from app.integrations.dojah.schemas import DojahError
from tests.conftest import TEST_BVN, make_dojah_entity, refresh_settings


class TestDojahClient:
    async def test_mock_mode_returns_entity(self):
        client = DojahClient()
        entity = await client.lookup_bvn_advanced(TEST_BVN)
        assert entity.first_name == MOCK_ENTITY.first_name
        assert entity.bvn == TEST_BVN
        assert entity.phone_number1

    async def test_mock_mode_sandbox_bvn(self):
        client = DojahClient()
        entity = await client.lookup_bvn_advanced(SANDBOX_BVN)
        assert entity.bvn == SANDBOX_BVN

    async def test_live_api_not_found(self, monkeypatch):
        monkeypatch.setenv("DOJAH_MOCK", "false")
        monkeypatch.setenv("DOJAH_APP_ID", "test-app")
        monkeypatch.setenv("DOJAH_SECRET_KEY", "test-secret")
        refresh_settings()

        mock_response = httpx.Response(404, json={"error": "not found"})
        mock_client = AsyncMock()
        mock_client.request.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client):
            client = DojahClient()
            # A 404 is Dojah's answer, not a transient fault: raised directly
            # (not wrapped in tenacity.RetryError) and never retried.
            with pytest.raises(DojahError) as exc:
                await client.lookup_bvn_advanced("11111111111")
            assert exc.value.status_code == 404
            assert mock_client.request.await_count == 1

    async def test_live_api_success(self, monkeypatch):
        monkeypatch.setenv("DOJAH_MOCK", "false")
        monkeypatch.setenv("DOJAH_APP_ID", "test-app")
        monkeypatch.setenv("DOJAH_SECRET_KEY", "test-secret")
        refresh_settings()

        entity = make_dojah_entity()
        mock_response = httpx.Response(200, json={"entity": entity.model_dump()})
        mock_client = AsyncMock()
        mock_client.request.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client):
            client = DojahClient()
            result = await client.lookup_bvn_advanced(TEST_BVN)
            assert result.first_name == "ADAEZE"
            assert result.email == "adaeze.okafor@email.com"

            mock_client.request.assert_called_once()
            call_kwargs = mock_client.request.call_args
            assert call_kwargs[0][0] == "GET"
            assert "bvn/advance" in call_kwargs[0][1]
            # Secret key sent as-is (no "Bearer"), with the AppId header.
            assert call_kwargs[1]["headers"] == {"AppId": "test-app", "Authorization": "test-secret"}
            assert call_kwargs[1]["params"]["bvn"] == TEST_BVN


class TestDojahTransientRetry:
    async def test_5xx_is_retried_then_raises_dojah_error(self, monkeypatch):
        from app.integrations.dojah.schemas import TransientDojahError

        monkeypatch.setenv("DOJAH_MOCK", "false")
        monkeypatch.setenv("DOJAH_APP_ID", "test-app")
        monkeypatch.setenv("DOJAH_SECRET_KEY", "test-secret")
        refresh_settings()

        mock_client = AsyncMock()
        mock_client.request.return_value = httpx.Response(503, json={})
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client), patch(
            "asyncio.sleep", new=AsyncMock()
        ):
            with pytest.raises(TransientDojahError):
                await DojahClient().lookup_bvn_advanced("11111111111")
        assert mock_client.request.await_count == 2

    async def test_network_error_is_retried(self, monkeypatch):
        from app.integrations.dojah.schemas import TransientDojahError

        monkeypatch.setenv("DOJAH_MOCK", "false")
        monkeypatch.setenv("DOJAH_APP_ID", "test-app")
        monkeypatch.setenv("DOJAH_SECRET_KEY", "test-secret")
        refresh_settings()

        mock_client = AsyncMock()
        mock_client.request.side_effect = httpx.ConnectError("boom")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client), patch(
            "asyncio.sleep", new=AsyncMock()
        ):
            with pytest.raises(TransientDojahError):
                await DojahClient().lookup_bvn_advanced("11111111111")
        assert mock_client.request.await_count == 2


def _live(monkeypatch):
    monkeypatch.setenv("DOJAH_MOCK", "false")
    monkeypatch.setenv("DOJAH_APP_ID", "test-app")
    monkeypatch.setenv("DOJAH_SECRET_KEY", "test-secret")
    refresh_settings()


def _client_returning(response: httpx.Response) -> AsyncMock:
    mock_client = AsyncMock()
    mock_client.request.return_value = response
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    return mock_client


class TestDojahStatusHandling:
    """Every status in Dojah's docs maps to something the app can act on."""

    @pytest.mark.parametrize(
        ("status", "body", "expected", "calls"),
        [
            (400, {"error": "BVN not found"}, 404, 1),  # Dojah's "unknown BVN" answer
            (404, {"error": "No record"}, 404, 1),
            (401, {"error": "Unauthorized"}, 503, 1),  # our keys: never the customer's fault
            (402, {"error": "Insufficient wallet balance"}, 503, 1),  # our Dojah wallet
            (424, {"error": "Upstream unavailable"}, 503, 2),  # retried
            (429, {"error": "Too many requests"}, 503, 2),  # retried
        ],
    )
    async def test_status_mapping(self, monkeypatch, status, body, expected, calls):
        _live(monkeypatch)
        mock_client = _client_returning(httpx.Response(status, json=body))
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client), patch(
            "asyncio.sleep", new=AsyncMock()
        ):
            with pytest.raises(DojahError) as exc:
                await DojahClient().lookup_bvn_advanced("11111111111")
        assert exc.value.status_code == expected
        assert mock_client.request.await_count == calls

    async def test_masked_bvn_in_response_is_replaced(self, monkeypatch):
        _live(monkeypatch)
        entity = make_dojah_entity(bvn="2*****234567").model_dump()
        mock_client = _client_returning(httpx.Response(200, json={"entity": entity}))
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client):
            result = await DojahClient().lookup_bvn_advanced(TEST_BVN)
        assert result.bvn == TEST_BVN

    async def test_record_without_phone_still_parses(self, monkeypatch):
        _live(monkeypatch)
        entity = make_dojah_entity().model_dump()
        entity.pop("phone_number1")
        mock_client = _client_returning(httpx.Response(200, json={"entity": entity}))
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client):
            result = await DojahClient().lookup_bvn_advanced(TEST_BVN)
        assert result.phone_number1 is None


class TestDojahSelfie:
    async def test_selfie_request_shape_and_result(self, monkeypatch):
        _live(monkeypatch)
        body = {"entity": {"first_name": "ADAEZE", "selfie_verification": {"confidence_value": 93.2, "match": True}}}
        mock_client = _client_returning(httpx.Response(200, json=body))
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client):
            result = await DojahClient().verify_bvn_selfie(TEST_BVN, "abc123", 90)
        assert result.match is True
        assert result.confidence_value == 93.2
        method, url = mock_client.request.call_args[0]
        assert (method, url.endswith("/api/v1/kyc/bvn/verify")) == ("POST", True)
        assert mock_client.request.call_args[1]["json"] == {"bvn": TEST_BVN, "selfie_image": "abc123", "threshold": 90}

    async def test_bad_image_is_a_400(self, monkeypatch):
        _live(monkeypatch)
        mock_client = _client_returning(httpx.Response(400, json={"error": "Invalid image"}))
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(DojahError) as exc:
                await DojahClient().verify_bvn_selfie(TEST_BVN, "abc123", 90)
        assert exc.value.status_code == 400
