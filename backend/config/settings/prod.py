import os
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401, F403

DEBUG = False

_FORBIDDEN_PLACEHOLDERS = (
    "dev-insecure-",
    "replace-with-",
    "changeme",
    "your-domain",
    "your_domain",
)


def _require_env(name: str, min_length: int = 1) -> str:
    value = os.environ.get(name, "").strip()
    if not value or len(value) < min_length:
        raise ImproperlyConfigured(
            f"Missing or invalid required production environment variable: {name}"
        )
    lowered = value.lower()
    if any(token in lowered for token in _FORBIDDEN_PLACEHOLDERS):
        raise ImproperlyConfigured(
            f"Production environment variable {name} still contains a placeholder value."
        )
    return value


def _require_list_env(name: str) -> list[str]:
    raw = _require_env(name)
    items = [item.strip() for item in raw.split(",") if item.strip()]
    if not items:
        raise ImproperlyConfigured(
            f"Production environment variable {name} must contain at least one value."
        )
    return items


# Strict production environment validation
SECRET_KEY = _require_env("SECRET_KEY", min_length=32)
ALLOWED_HOSTS = _require_list_env("ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = _require_list_env("CSRF_TRUSTED_ORIGINS")
CORS_ALLOWED_ORIGINS = _require_list_env("CORS_ALLOWED_ORIGINS")

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": _require_env("POSTGRES_DB"),
        "USER": _require_env("POSTGRES_USER"),
        "PASSWORD": _require_env("POSTGRES_PASSWORD"),
        "HOST": _require_env("POSTGRES_HOST"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432").strip(),
        "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
        "CONN_HEALTH_CHECKS": True,
    }
}

# Reverse proxy & HTTPS security settings (behind Nginx)
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "True").lower() == "true"
# Exempt internal Docker healthcheck endpoint from HTTP->HTTPS redirect
SECURE_REDIRECT_EXEMPT = [r"^health/$"]

SESSION_COOKIE_SECURE = (
    os.environ.get("SESSION_COOKIE_SECURE", "True").lower() == "true"
)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = (
    os.environ.get("CSRF_COOKIE_SECURE", "True").lower() == "true"
)
CSRF_COOKIE_SAMESITE = "Lax"

SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    os.environ.get("SECURE_HSTS_INCLUDE_SUBDOMAINS", "True").lower() == "true"
)
SECURE_HSTS_PRELOAD = os.environ.get("SECURE_HSTS_PRELOAD", "True").lower() == "true"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

# Upload limits (match Nginx client_max_body_size)
DATA_UPLOAD_MAX_MEMORY_SIZE = int(
    os.environ.get("DATA_UPLOAD_MAX_MEMORY_SIZE", str(20 * 1024 * 1024))
)
FILE_UPLOAD_MAX_MEMORY_SIZE = int(
    os.environ.get("FILE_UPLOAD_MAX_MEMORY_SIZE", str(10 * 1024 * 1024))
)

# API documentation disabled by default in production unless explicitly enabled
GOWAR_ENABLE_API_DOCS = os.environ.get("GOWAR_ENABLE_API_DOCS", "False").lower() == "true"

# Disable browsable DRF HTML renderer in production
REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}

# Static & media storage
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Email configuration (SMTP when EMAIL_HOST is configured)
EMAIL_HOST = os.environ.get("EMAIL_HOST", "").strip()
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True").lower() == "true"
    EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "False").lower() == "true"
    EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "no-reply@gowar.local")
SERVER_EMAIL = os.environ.get("SERVER_EMAIL", DEFAULT_FROM_EMAIL)

# Structured stdout/stderr logging for Docker
LOG_LEVEL = os.environ.get("DJANGO_LOG_LEVEL", "INFO").upper()
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "[%(asctime)s] %(levelname)s %(name)s %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}

# Optional Sentry error monitoring
SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
    )
