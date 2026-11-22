from decimal import Decimal
import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("stores", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="store",
            name="delivery_price_per_km",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("10.00"),
                max_digits=8,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
    ]
