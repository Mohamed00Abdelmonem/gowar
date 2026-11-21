import pytest
from rest_framework import status

from tests.conftest import auth_client_for


@pytest.mark.django_db
def test_customer_registration_login_refresh_and_logout(api_client):
    reg_res = api_client.post(
        "/api/v1/auth/register/",
        {
            "email": "newcust@gowar.test",
            "password": "StrongPassword123!",
            "first_name": "ندى",
            "last_name": "طارق",
            "phone_number": "01055555555",
        },
        format="json",
    )
    assert reg_res.status_code == status.HTTP_201_CREATED
    assert "access" in reg_res.data
    assert reg_res.data["user"]["role"] == "customer"

    bad_login = api_client.post(
        "/api/v1/auth/customer/login/",
        {"email": "newcust@gowar.test", "password": "WrongPassword"},
        format="json",
    )
    assert bad_login.status_code == status.HTTP_400_BAD_REQUEST

    good_login = api_client.post(
        "/api/v1/auth/customer/login/",
        {"email": "newcust@gowar.test", "password": "StrongPassword123!"},
        format="json",
    )
    assert good_login.status_code == status.HTTP_200_OK
    refresh_token = good_login.data["refresh"]

    refresh_res = api_client.post(
        "/api/v1/auth/refresh/", {"refresh": refresh_token}, format="json"
    )
    assert refresh_res.status_code == status.HTTP_200_OK

    # Logout blacklists current refresh token
    client = auth_client_for_token(good_login.data["access"])
    logout_res = client.post(
        "/api/v1/auth/logout/", {"refresh": refresh_res.data["refresh"]}, format="json"
    )
    assert logout_res.status_code == status.HTTP_200_OK


def auth_client_for_token(access_token: str):
    from rest_framework.test import APIClient

    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    return c


@pytest.mark.django_db
def test_role_isolation_and_object_level_permissions(
    api_client,
    customer_user,
    other_customer_user,
    admin_user,
    merchants_and_stores,
    sample_catalog,
):
    m1_user = merchants_and_stores["m1"].user
    m2_user = merchants_and_stores["m2"].user

    # Customer cannot login at merchant login endpoint
    res = api_client.post(
        "/api/v1/auth/merchant/login/",
        {"email": customer_user.email, "password": "CustPassword123!"},
        format="json",
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST

    # Merchant cannot access Admin endpoints
    m1_client = auth_client_for(m1_user)
    admin_res = m1_client.get("/api/v1/admin/overview/")
    assert admin_res.status_code == status.HTTP_403_FORBIDDEN

    # Customer cannot access Admin endpoints
    cust_client = auth_client_for(customer_user)
    assert cust_client.get("/api/v1/admin/overview/").status_code == status.HTTP_403_FORBIDDEN

    # Admin CAN access Admin overview
    admin_client = auth_client_for(admin_user)
    assert admin_client.get("/api/v1/admin/overview/").status_code == status.HTTP_200_OK

    # Merchant 1 cannot modify Merchant 2's product
    m2_prod_id = sample_catalog["p2"].id
    patch_res = m1_client.patch(
        f"/api/v1/merchant/products/{m2_prod_id}/",
        {"price": "999.00"},
        format="json",
    )
    assert patch_res.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)
    assert auth_client_for(m2_user).get(f"/api/v1/merchant/products/{m2_prod_id}/").status_code == 200


@pytest.mark.django_db
def test_merchant_registration_pending_until_admin_approves(api_client, admin_user):
    reg_res = api_client.post(
        "/api/v1/auth/merchant/register/",
        {
            "email": "pendingstore@gowar.test",
            "password": "StrongMerchantPassword123!",
            "phone_number": "01099887766",
            "first_name": "Karim",
            "last_name": "Adel",
            "business_name": "سوبر ماركت الندى",
            "store_name": "سوبر ماركت الندى",
            "store_name_en": "El-Nada Market",
            "store_type": "supermarket",
            "address": "مدينة نصر، شارع مكرم عبيد",
            "latitude": 30.0615,
            "longitude": 31.3451,
            "delivery_radius_km": "4.00",
        },
        format="json",
    )
    assert reg_res.status_code == status.HTTP_201_CREATED
    assert reg_res.data["approval_status"] == "pending"
    assert "access" not in reg_res.data

    # Pending merchant cannot sign in until approved by admin
    blocked_login = api_client.post(
        "/api/v1/auth/merchant/login/",
        {"email": "pendingstore@gowar.test", "password": "StrongMerchantPassword123!"},
        format="json",
    )
    assert blocked_login.status_code == status.HTTP_400_BAD_REQUEST

    # Admin inspects merchants list, finds pending merchant profile, and approves it
    admin_client = auth_client_for(admin_user)
    merchants_res = admin_client.get("/api/v1/admin/merchants/?approval_status=pending")
    assert merchants_res.status_code == status.HTTP_200_OK
    pending_row = next(
        m for m in merchants_res.data["results"] if m["email"] == "pendingstore@gowar.test"
    )

    approve_res = admin_client.post(
        f"/api/v1/admin/merchants/{pending_row['id']}/status/",
        {"status": "approved"},
        format="json",
    )
    assert approve_res.status_code == status.HTTP_200_OK
    assert approve_res.data["approval_status"] == "approved"

    # Now the merchant can log in with the same credentials
    ok_login = api_client.post(
        "/api/v1/auth/merchant/login/",
        {"email": "pendingstore@gowar.test", "password": "StrongMerchantPassword123!"},
        format="json",
    )
    assert ok_login.status_code == status.HTTP_200_OK
    assert ok_login.data["user"]["role"] == "merchant"
    assert ok_login.data["user"]["merchant_approval_status"] == "approved"
