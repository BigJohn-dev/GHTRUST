"""Customers can update their email and home address; identity fields stay locked."""


def _auth(registered_customer: dict) -> dict:
    return {"Authorization": f"Bearer {registered_customer['access_token']}"}


async def test_update_email_and_address(api_client, registered_customer):
    headers = _auth(registered_customer)
    res = await api_client.patch(
        "/api/v1/auth/me",
        json={"email": "New.Address@Example.com", "residential_address": "  12  Allen   Avenue, Ikeja  "},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email"] == "new.address@example.com"
    assert body["residential_address"] == "12 Allen Avenue, Ikeja"

    # Persisted, not just echoed back.
    me = (await api_client.get("/api/v1/auth/me", headers=headers)).json()
    assert me["email"] == "new.address@example.com"
    assert me["residential_address"] == "12 Allen Avenue, Ikeja"


async def test_only_the_fields_sent_change(api_client, registered_customer):
    headers = _auth(registered_customer)
    before = (await api_client.get("/api/v1/auth/me", headers=headers)).json()
    res = await api_client.patch("/api/v1/auth/me", json={"residential_address": "7 Marina Road, Lagos"}, headers=headers)
    assert res.status_code == 200, res.text
    assert res.json()["email"] == before["email"]


async def test_invalid_or_empty_updates_are_rejected(api_client, registered_customer):
    headers = _auth(registered_customer)
    for payload in ({"email": "not-an-email"}, {"residential_address": "abc"}, {}):
        res = await api_client.patch("/api/v1/auth/me", json=payload, headers=headers)
        assert res.status_code == 422, payload


async def test_identity_fields_cannot_be_changed(api_client, registered_customer):
    headers = _auth(registered_customer)
    before = (await api_client.get("/api/v1/auth/me", headers=headers)).json()
    await api_client.patch(
        "/api/v1/auth/me",
        json={"email": "a@example.com", "first_name": "Hacker", "bvn_masked": "000", "phone": "08000000000"},
        headers=headers,
    )
    after = (await api_client.get("/api/v1/auth/me", headers=headers)).json()
    assert (after["first_name"], after["phone"], after["bvn_masked"]) == (
        before["first_name"],
        before["phone"],
        before["bvn_masked"],
    )


async def test_requires_sign_in(api_client):
    res = await api_client.patch("/api/v1/auth/me", json={"email": "a@example.com"})
    assert res.status_code == 401
