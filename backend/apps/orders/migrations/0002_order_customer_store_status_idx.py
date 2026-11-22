from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0001_initial"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="order",
            index=models.Index(
                fields=["customer", "store", "order_status", "created_at"],
                name="orders_orde_custome_9b3c41_idx",
            ),
        ),
    ]
