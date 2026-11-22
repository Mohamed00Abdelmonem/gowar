from django.contrib.gis.geos import Point
from django.db import migrations
from django.db.models import Q


def update_supported_areas(apps, schema_editor):
    Area = apps.get_model("locations", "Area")

    # 1. Add or activate Mansoura, Dakahlia as a primary supported city
    mansoura = Area.objects.filter(
        Q(name_en__iexact="Mansoura") | Q(name_ar="المنصورة")
    ).first()
    if mansoura:
        mansoura.name_ar = "المنصورة"
        mansoura.name_en = "Mansoura"
        mansoura.city_ar = "الدقهلية"
        mansoura.city_en = "Dakahlia"
        mansoura.delivery_hub_note = "حي الجامعة، المشاية السفلية، توريل، شارع الجمهورية"
        mansoura.center_location = Point(31.3785, 31.0409, srid=4326)
        mansoura.is_active = True
        mansoura.save()
    else:
        Area.objects.create(
            name_ar="المنصورة",
            name_en="Mansoura",
            city_ar="الدقهلية",
            city_en="Dakahlia",
            delivery_hub_note="حي الجامعة، المشاية السفلية، توريل، شارع الجمهورية",
            center_location=Point(31.3785, 31.0409, srid=4326),
            is_active=True,
        )

    # 2. Deactivate removed areas without deleting historical records
    removed_filter = (
        Q(name_en__iexact="New Cairo")
        | Q(name_en__iexact="Tagamoa")
        | Q(name_ar__icontains="التجمع")
        | Q(name_en__iexact="Sheikh Zayed")
        | Q(name_ar__icontains="الشيخ زايد")
        | Q(name_en__iexact="Smouha")
        | Q(name_ar__icontains="سموحة")
        | Q(name_en__iexact="Maadi")
        | Q(name_ar__icontains="المعادي")
    )
    Area.objects.filter(removed_filter).update(is_active=False)


def noop_reverse(apps, schema_editor):
    # Non-destructive reverse: do not delete historical or newly added areas
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("locations", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(update_supported_areas, reverse_code=noop_reverse),
    ]
