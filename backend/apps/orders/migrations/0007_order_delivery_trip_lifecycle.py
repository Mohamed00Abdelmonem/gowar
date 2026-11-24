from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0006_rename_orders_orde_custome_9b3c41_idx_orders_orde_custome_dc4c5b_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="delivery_trip_status",
            field=models.CharField(
                choices=[
                    ("unassigned", "Unassigned"),
                    ("assigned", "Assigned"),
                    ("accepted", "Accepted"),
                    ("in_transit", "In Transit"),
                    ("arrived", "Arrived"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                ],
                db_index=True,
                default="unassigned",
                max_length=24,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_trip_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_trip_arrived_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_trip_cancelled_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_cancel_reason",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
