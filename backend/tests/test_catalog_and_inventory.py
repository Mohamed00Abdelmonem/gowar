import pytest
from rest_framework import status

from apps.inventory.models import InventoryMovement
from tests.conftest import auth_client_for


@pytest.mark.django_db
def test_merchant_product_crud_and_inventory_adjustments(merchants_and_stores, sample_catalog):
    m1_user = merchants_and_stores["m1"].user
    client = auth_client_for(m1_user)
    cat_id = str(sample_catalog["category"].id)

    create_res = client.post(
        "/api/v1/merchant/products/",
        {
            "category": cat_id,
            "name": "جبنة رومي قديمة",
            "name_en": "Aged Roumy Cheese",
            "sku": "BRK-ROM-01",
            "price": "120.00",
            "stock_quantity": 12,
            "unit": "٥٠٠ جم",
        },
        format="json",
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    prod_id = create_res.data["id"]

    # Adjust stock via inventory service endpoint
    adj_res = client.post(
        f"/api/v1/merchant/inventory/{prod_id}/adjust/",
        {"stock_quantity": 3, "note": "Shelf restock count"},
        format="json",
    )
    assert adj_res.status_code == status.HTTP_200_OK
    assert adj_res.data["product"]["stock_quantity"] == 3
    assert InventoryMovement.objects.filter(product_id=prod_id).exists()

    # Reject negative stock adjustment
    bad_adj = client.post(
        f"/api/v1/merchant/inventory/{prod_id}/adjust/",
        {"stock_quantity": -5},
        format="json",
    )
    assert bad_adj.status_code == status.HTTP_400_BAD_REQUEST

    # Verify low-stock filter picks up product with stock=3
    low_res = client.get("/api/v1/merchant/inventory/?stock_filter=low")
    assert low_res.status_code == status.HTTP_200_OK
    low_ids = [item["id"] for item in low_res.data["results"]]
    assert prod_id in low_ids
