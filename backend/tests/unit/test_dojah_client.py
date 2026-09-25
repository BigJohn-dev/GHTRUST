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
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client):
            client = DojahClient()
            # A 404 is Dojah's answer, not a transient fault: raised directly
            # (not wrapped in tenacity.RetryError) and never retried.
            with pytest.raises(DojahError) as exc:
                await client.lookup_bvn_advanced("11111111111")
            assert exc.value.status_code == 404
            assert mock_client.get.await_count == 1

    async def test_live_api_success(self, monkeypatch):
        monkeypatch.setenv("DOJAH_MOCK", "false")
        monkeypatch.setenv("DOJAH_APP_ID", "test-app")
        monkeypatch.setenv("DOJAH_SECRET_KEY", "test-secret")
        refresh_settings()

        entity = make_dojah_entity()
        mock_response = httpx.Response(200, json={"entity": entity.model_dump()})
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client):
            client = DojahClient()
            result = await client.lookup_bvn_advanced(TEST_BVN)
            assert result.first_name == "ADAEZE"
            assert result.email == "adaeze.okafor@email.com"

            mock_client.get.assert_called_once()
            call_kwargs = mock_client.get.call_args
            assert "bvn/advance" in call_kwargs[0][0]
            assert call_kwargs[1]["params"]["bvn"] == TEST_BVN


class TestDojahTransientRetry:
    async def test_5xx_is_retried_then_raises_dojah_error(self, monkeypatch):
        from app.integrations.dojah.schemas import TransientDojahError

        monkeypatch.setenv("DOJAH_MOCK", "false")
        monkeypatch.setenv("DOJAH_APP_ID", "test-app")
        monkeypatch.setenv("DOJAH_SECRET_KEY", "test-secret")
        refresh_settings()

        mock_client = AsyncMock()
        mock_client.get.return_value = httpx.Response(503, json={})
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client), patch(
            "asyncio.sleep", new=AsyncMock()
        ):
            with pytest.raises(TransientDojahError):
                await DojahClient().lookup_bvn_advanced("11111111111")
        assert mock_client.get.await_count == 2

    async def test_network_error_is_retried(self, monkeypatch):
        from app.integrations.dojah.schemas import TransientDojahError

        monkeypatch.setenv("DOJAH_MOCK", "false")
        monkeypatch.setenv("DOJAH_APP_ID", "test-app")
        monkeypatch.setenv("DOJAH_SECRET_KEY", "test-secret")
        refresh_settings()

        mock_client = AsyncMock()
        mock_client.get.side_effect = httpx.ConnectError("boom")
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        with patch("app.integrations.dojah.client.httpx.AsyncClient", return_value=mock_client), patch(
            "asyncio.sleep", new=AsyncMock()
        ):
            with pytest.raises(TransientDojahError):
                await DojahClient().lookup_bvn_advanced("11111111111")
        assert mock_client.get.await_count == 2
