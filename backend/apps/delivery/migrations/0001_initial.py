import uuid
import django.contrib.gis.db.models.fields
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("merchants", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DeliveryDriverProfile",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "vehicle_type",
                    models.CharField(
                        choices=[
                            ("motorcycle", "Motorcycle"),
                            ("bicycle", "Bicycle"),
                            ("car", "Car"),
                            ("on_foot", "On Foot"),
                        ],
                        default="motorcycle",
                        max_length=24,
                    ),
                ),
                ("vehicle_plate", models.CharField(blank=True, max_length=40)),
                ("notes", models.TextField(blank=True)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("is_archived", models.BooleanField(db_index=True, default=False)),
                ("deactivated_at", models.DateTimeField(blank=True, null=True)),
                (
                    "last_latitude",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=9, null=True
                    ),
                ),
                (
                    "last_longitude",
                    models.DecimalField(
                        blank=True, decimal_places=6, max_digits=9, null=True
                    ),
                ),
                (
                    "last_location",
                    django.contrib.gis.db.models.fields.PointField(
                        blank=True, geography=True, null=True, srid=4326
                    ),
                ),
                ("last_location_accuracy_m", models.FloatField(blank=True, null=True)),
                (
                    "last_location_at",
                    models.DateTimeField(blank=True, db_index=True, null=True),
                ),
                (
                    "last_seen_at",
                    models.DateTimeField(blank=True, db_index=True, null=True),
                ),
                ("is_location_sharing", models.BooleanField(default=False)),
                (
                    "merchant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="delivery_drivers",
                        to="merchants.merchantprofile",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="delivery_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["user__first_name", "user__last_name", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="DeliveryShift",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "started_at",
                    models.DateTimeField(
                        db_index=True, default=django.utils.timezone.now
                    ),
                ),
                (
                    "ended_at",
                    models.DateTimeField(blank=True, db_index=True, null=True),
                ),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "driver",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="shifts",
                        to="delivery.deliverydriverprofile",
                    ),
                ),
            ],
            options={
                "ordering": ["-started_at"],
            },
        ),
        migrations.AddIndex(
            model_name="deliverydriverprofile",
            index=models.Index(
                fields=["merchant", "is_active", "is_archived"],
                name="delivery_de_merchan_78ec9e_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="deliverydriverprofile",
            index=models.Index(
                fields=["merchant", "last_seen_at"],
                name="delivery_de_merchan_e7968d_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="deliveryshift",
            index=models.Index(
                fields=["driver", "started_at"],
                name="delivery_de_driver__9a4b72_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="deliveryshift",
            index=models.Index(
                fields=["driver", "is_active"],
                name="delivery_de_driver__a5c8b6_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="deliveryshift",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_active", True)),
                fields=("driver",),
                name="uniq_active_shift_per_driver",
            ),
        ),
    ]
