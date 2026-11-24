from django.db import migrations, models

from apps.accounts.phone import try_normalize_phone_number


def normalize_existing_user_phones(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    seen_phones = set()
    for user in User.objects.all().order_by("date_joined", "id"):
        raw = (user.phone_number or "").strip()
        if not raw:
            user.phone_number = None
            user.save(update_fields=["phone_number"])
            continue

        normalized = try_normalize_phone_number(raw)
        candidate = normalized or raw
        if candidate in seen_phones:
            # Avoid crashing migration on legacy duplicates; require safe account completion
            user.phone_number = None
            user.save(update_fields=["phone_number"])
            continue

        seen_phones.add(candidate)
        if user.phone_number != candidate:
            user.phone_number = candidate
            user.save(update_fields=["phone_number"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_delivery_role"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                blank=True, db_index=True, max_length=254, null=True, unique=True
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="phone_number",
            field=models.CharField(blank=True, db_index=True, max_length=24, null=True),
        ),
        migrations.RunPython(normalize_existing_user_phones, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="phone_number",
            field=models.CharField(
                blank=True, db_index=True, max_length=24, null=True, unique=True
            ),
        ),
    ]
