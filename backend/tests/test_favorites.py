import uuid
import pytest

from apps.accounts.models import User, UserRole
from apps.stores.models import FavoriteStore


@pytest.mark.django_db
def test_favorite_stores_persistence_isolation_and_deduplication(
    api_client, customer_user, merchants_and_stores
):
    s1 = merchants_and_stores["s1"]
    s2 = merchants_and_stores["s2"]
    merchant_user = s1.merchant.user

    other_customer = User.objects.create_user(
        email="othercust@gowar.test",
        password="OtherCustPassword123!",
        first_name="نورا",
        last_name="علي",
        phone_number="01099998888",
        role=UserRole.CUSTOMER,
        is_verified=True,
    )

    # Unauthenticated cannot view or modify favorites
    assert api_client.get("/api/v1/stores/favorites/").status_code == 401
    assert api_client.post(f"/api/v1/stores/favorites/{s1.id}/").status_code == 401
    assert api_client.delete(f"/api/v1/stores/favorites/{s1.id}/").status_code == 401

    # Non-customer (merchant) cannot access customer favorites
    api_client.force_authenticate(user=merchant_user)
    assert api_client.get("/api/v1/stores/favorites/").status_code == 403
    assert api_client.post(f"/api/v1/stores/favorites/{s1.id}/").status_code == 403

    # Authenticated customer adds store to favorites
    api_client.force_authenticate(user=customer_user)
    add1 = api_client.post(f"/api/v1/stores/favorites/{s1.id}/")
    assert add1.status_code == 201
    assert add1.data["is_favorite"] is True

    # Adding same store again does not create duplicate records
    add_dup = api_client.post(f"/api/v1/stores/favorites/{s1.id}/")
    assert add_dup.status_code == 200
    assert FavoriteStore.objects.filter(customer=customer_user, store=s1).count() == 1

    # Adding second store & non-existent store returns 404
    assert api_client.post(f"/api/v1/stores/favorites/{s2.id}/").status_code == 201
    assert api_client.post(f"/api/v1/stores/favorites/{uuid.uuid4()}/").status_code == 404

    # Fetch persisted favorites (simulates page refresh)
    list_res = api_client.get("/api/v1/stores/favorites/")
    assert list_res.status_code == 200
    assert set(list_res.data["store_ids"]) == {str(s1.id), str(s2.id)}
    assert len(list_res.data["stores"]) == 2

    # Isolation: another customer sees empty favorites & cannot delete customer_user's favorite
    api_client.force_authenticate(user=other_customer)
    other_list = api_client.get("/api/v1/stores/favorites/")
    assert other_list.status_code == 200
    assert other_list.data["store_ids"] == []
    api_client.delete(f"/api/v1/stores/favorites/{s1.id}/")
    assert FavoriteStore.objects.filter(customer=customer_user, store=s1).exists()

    # Logout & login again restores saved favorites
    api_client.force_authenticate(user=None)
    login_res = api_client.post(
        "/api/v1/auth/customer/login/",
        {"phone_number": customer_user.phone_number, "password": "CustPassword123!"},
        format="json",
    )
    assert login_res.status_code == 200
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_res.data['access']}")
    after_login_list = api_client.get("/api/v1/stores/favorites/")
    assert after_login_list.status_code == 200
    assert set(after_login_list.data["store_ids"]) == {str(s1.id), str(s2.id)}

    # Removing a favorite persists immediately
    del_res = api_client.delete(f"/api/v1/stores/favorites/{s1.id}/")
    assert del_res.status_code == 200
    assert del_res.data["is_favorite"] is False
    final_list = api_client.get("/api/v1/stores/favorites/")
    assert final_list.data["store_ids"] == [str(s2.id)]
