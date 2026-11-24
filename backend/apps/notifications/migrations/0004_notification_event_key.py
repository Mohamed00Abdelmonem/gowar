from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0003_rename_notificatio_user_id_b26f8d_idx_notificatio_user_id_1159a5_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="event_key",
            field=models.CharField(blank=True, db_index=True, max_length=160),
        ),
    ]
