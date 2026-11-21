from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Enables the PostGIS extension on the PostgreSQL database if not already installed."

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            self.stdout.write("Skipping PostGIS check on non-PostgreSQL backend.")
            return
        with connection.cursor() as cursor:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        self.stdout.write(self.style.SUCCESS("PostGIS extension verified/enabled."))
