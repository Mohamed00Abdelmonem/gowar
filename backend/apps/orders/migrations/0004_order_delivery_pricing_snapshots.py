from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0002_order_customer_store_status_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="billable_distance_km",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_distance_km",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=7, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_price_per_km_snapshot",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
    ]
