import os
import subprocess
import sys
import pytest


@pytest.mark.django_db
def test_health_endpoint_verifies_database_and_postgis(api_client):
    res = api_client.get("/health/")
    assert res.status_code == 200
    assert res.data["status"] == "ok"
    assert res.data["service"] == "gowar-backend"
    assert res.data["checks"]["database"] == "ok"
    assert res.data["checks"]["postgis"] == "ok"


def test_production_settings_rejects_missing_or_placeholder_secrets():
    env = os.environ.copy()
    env["DJANGO_SETTINGS_MODULE"] = "config.settings.prod"
    env["SECRET_KEY"] = "replace-with-a-long-random-secret-key"
    env["POSTGRES_DB"] = "gowar_db"
    env["POSTGRES_USER"] = "gowar_user"
    env["POSTGRES_PASSWORD"] = "StrongPass123!"
    env["POSTGRES_HOST"] = "gowar-db"
    env["ALLOWED_HOSTS"] = "example.com"
    env["CSRF_TRUSTED_ORIGINS"] = "https://example.com"
    env["CORS_ALLOWED_ORIGINS"] = "https://example.com"

    proc = subprocess.run(
        [sys.executable, "-c", "import django; django.setup()"],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode != 0
    assert "SECRET_KEY" in proc.stderr


def test_production_settings_loads_with_valid_env_and_enforces_security():
    env = os.environ.copy()
    env["DJANGO_SETTINGS_MODULE"] = "config.settings.prod"
    env["SECRET_KEY"] = "a-very-long-random-production-secret-key-for-testing-only-9876543210"
    env["POSTGRES_DB"] = "gowar_db"
    env["POSTGRES_USER"] = "gowar_user"
    env["POSTGRES_PASSWORD"] = "StrongTestPassword_2026!"
    env["POSTGRES_HOST"] = "gowar-db"
    env["ALLOWED_HOSTS"] = "example.com,www.example.com"
    env["CSRF_TRUSTED_ORIGINS"] = "https://example.com,https://www.example.com"
    env["CORS_ALLOWED_ORIGINS"] = "https://example.com"

    script = (
        "import django; django.setup(); from django.conf import settings; "
        "assert settings.DEBUG is False; "
        "assert settings.USE_X_FORWARDED_HOST is True; "
        "assert settings.SECURE_PROXY_SSL_HEADER == ('HTTP_X_FORWARDED_PROTO', 'https'); "
        "assert settings.SESSION_COOKIE_SECURE is True; "
        "assert settings.CSRF_COOKIE_SECURE is True; "
        "assert r'^health/$' in settings.SECURE_REDIRECT_EXEMPT; "
        "assert settings.GOWAR_ENABLE_API_DOCS is False; "
        "print('PROD_SETTINGS_OK')"
    )
    proc = subprocess.run(
        [sys.executable, "-c", script],
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, proc.stderr
    assert "PROD_SETTINGS_OK" in proc.stdout
