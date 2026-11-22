import hashlib
import logging
import os
from abc import ABC, abstractmethod
from urllib.parse import quote_plus

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

DEFAULT_OFF_USER_AGENT = "GowarMarketplace/1.0 (https://gowar.com; tech@gowar.com)"
DEFAULT_TIMEOUT_SECONDS = 6


def _get_off_user_agent() -> str:
    return (
        os.environ.get("OPENFOODFACTS_USER_AGENT", DEFAULT_OFF_USER_AGENT).strip()
        or DEFAULT_OFF_USER_AGENT
    )


def _get_image_provider_name() -> str:
    return os.environ.get("PRODUCT_IMAGE_SEARCH_PROVIDER", "").strip().lower()


def _get_image_provider_key() -> str:
    return os.environ.get("PRODUCT_IMAGE_SEARCH_API_KEY", "").strip()


class ExternalImageSearchProvider(ABC):
    provider_name: str = "base"

    @abstractmethod
    def search(self, query: str, page: int = 1, per_page: int = 12) -> dict:
        raise NotImplementedError


class PexelsImageProvider(ExternalImageSearchProvider):
    provider_name = "pexels"

    def __init__(self, api_key: str, timeout: int = DEFAULT_TIMEOUT_SECONDS):
        self.api_key = api_key
        self.timeout = timeout

    def search(self, query: str, page: int = 1, per_page: int = 12) -> dict:
        resp = requests.get(
            "https://api.pexels.com/v1/search",
            headers={"Authorization": self.api_key},
            params={"query": query, "page": page, "per_page": per_page},
            timeout=self.timeout,
        )
        if resp.status_code == 429:
            return {"status": "rate_limited", "results": []}
        resp.raise_for_status()
        data = resp.json()
        results = [
            {
                "id": str(photo.get("id", "")),
                "thumbnail_url": photo.get("src", {}).get("medium")
                or photo.get("src", {}).get("small", ""),
                "source_url": photo.get("url", ""),
                "source_website": "Pexels",
                "title": photo.get("alt") or query,
                "attribution": f"Photo by {photo.get('photographer', 'Contributor')} on Pexels",
                "license": "Pexels License",
            }
            for photo in data.get("photos", [])
            if photo.get("src", {}).get("medium") or photo.get("src", {}).get("small")
        ]
        return {"status": "ok", "results": results}


class UnsplashImageProvider(ExternalImageSearchProvider):
    provider_name = "unsplash"

    def __init__(self, api_key: str, timeout: int = DEFAULT_TIMEOUT_SECONDS):
        self.api_key = api_key
        self.timeout = timeout

    def search(self, query: str, page: int = 1, per_page: int = 12) -> dict:
        resp = requests.get(
            "https://api.unsplash.com/search/photos",
            headers={"Authorization": f"Client-ID {self.api_key}"},
            params={"query": query, "page": page, "per_page": per_page},
            timeout=self.timeout,
        )
        if resp.status_code == 429 or resp.status_code == 403:
            return {"status": "rate_limited", "results": []}
        resp.raise_for_status()
        data = resp.json()
        results = [
            {
                "id": str(photo.get("id", "")),
                "thumbnail_url": photo.get("urls", {}).get("small")
                or photo.get("urls", {}).get("thumb", ""),
                "source_url": photo.get("links", {}).get("html", ""),
                "source_website": "Unsplash",
                "title": photo.get("alt_description") or photo.get("description") or query,
                "attribution": f"Photo by {photo.get('user', {}).get('name', 'Contributor')} on Unsplash",
                "license": "Unsplash License",
            }
            for photo in data.get("results", [])
            if photo.get("urls", {}).get("small") or photo.get("urls", {}).get("thumb")
        ]
        return {"status": "ok", "results": results}


def get_configured_image_provider() -> ExternalImageSearchProvider | None:
    name = _get_image_provider_name()
    key = _get_image_provider_key()
    timeout = int(os.environ.get("PRODUCT_IMAGE_SEARCH_TIMEOUT", str(DEFAULT_TIMEOUT_SECONDS)))
    if not name or name == "none" or not key:
        return None
    if name == "pexels":
        return PexelsImageProvider(api_key=key, timeout=timeout)
    if name == "unsplash":
        return UnsplashImageProvider(api_key=key, timeout=timeout)
    return None


def search_external_product_images(query: str, page: int = 1) -> dict:
    clean_query = (query or "").strip()
    google_fallback = (
        f"https://www.google.com/search?tbm=isch&q={quote_plus(clean_query)}"
        if clean_query
        else "https://www.google.com/imghp"
    )
    provider = get_configured_image_provider()
    if provider is None:
        return {
            "configured": False,
            "provider": None,
            "status": "unconfigured",
            "results": [],
            "google_images_fallback_url": google_fallback,
        }

    if not clean_query:
        return {
            "configured": True,
            "provider": provider.provider_name,
            "status": "ok",
            "results": [],
            "google_images_fallback_url": google_fallback,
        }

    cache_key = (
        f"ext_img:{provider.provider_name}:{page}:"
        f"{hashlib.sha256(clean_query.lower().encode()).hexdigest()[:16]}"
    )
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        res = provider.search(clean_query, page=page, per_page=12)
        payload = {
            "configured": True,
            "provider": provider.provider_name,
            "status": res["status"],
            "results": res["results"],
            "google_images_fallback_url": google_fallback,
        }
        if res["status"] == "ok":
            cache.set(cache_key, payload, timeout=600)
        return payload
    except requests.Timeout:
        logger.warning("External image search timed out for provider=%s", provider.provider_name)
        return {
            "configured": True,
            "provider": provider.provider_name,
            "status": "timeout",
            "results": [],
            "google_images_fallback_url": google_fallback,
        }
    except requests.RequestException as exc:
        logger.warning("External image search failed for provider=%s: %s", provider.provider_name, exc)
        return {
            "configured": True,
            "provider": provider.provider_name,
            "status": "unavailable",
            "results": [],
            "google_images_fallback_url": google_fallback,
        }


def _normalize_off_product(raw: dict) -> dict | None:
    if not isinstance(raw, dict):
        return None
    name_ar = (raw.get("product_name_ar") or "").strip()
    name_en = (
        raw.get("product_name_en")
        or raw.get("product_name")
        or raw.get("generic_name")
        or ""
    ).strip()
    name = name_ar or name_en
    if not name:
        return None

    categories_tags = raw.get("categories_tags") or []
    category_hint = ""
    if isinstance(categories_tags, list) and categories_tags:
        category_hint = str(categories_tags[-1]).replace("en:", "").replace("-", " ").title()

    return {
        "source": "open_food_facts",
        "barcode": str(raw.get("code") or "").strip(),
        "name": name,
        "name_ar": name_ar or name,
        "name_en": name_en or name,
        "brand": str(raw.get("brands") or "").split(",")[0].strip(),
        "package_size": str(raw.get("quantity") or "").strip(),
        "category_hint": category_hint,
        "image_url": (
            raw.get("image_front_small_url")
            or raw.get("image_front_url")
            or raw.get("image_url")
            or ""
        ),
        "attribution": "Data from Open Food Facts (ODbL)",
    }


def lookup_open_food_facts_barcode(barcode: str) -> dict:
    clean_code = (barcode or "").strip()
    if not clean_code or not clean_code.isdigit() or len(clean_code) < 4 or len(clean_code) > 32:
        return {"status": "invalid", "product": None}

    cache_key = f"off_barcode:{clean_code}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    url = f"https://world.openfoodfacts.org/api/v2/product/{clean_code}.json"
    params = {
        "fields": "code,product_name,product_name_ar,product_name_en,generic_name,brands,quantity,categories_tags,image_front_small_url,image_front_url,image_url"
    }
    try:
        resp = requests.get(
            url,
            params=params,
            headers={"User-Agent": _get_off_user_agent()},
            timeout=DEFAULT_TIMEOUT_SECONDS,
        )
        if resp.status_code == 404:
            result = {"status": "not_found", "product": None}
            cache.set(cache_key, result, timeout=300)
            return result
        if resp.status_code == 429:
            return {"status": "rate_limited", "product": None}
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") != 1:
            result = {"status": "not_found", "product": None}
            cache.set(cache_key, result, timeout=300)
            return result

        normalized = _normalize_off_product(data.get("product") or {})
        if not normalized:
            result = {"status": "not_found", "product": None}
        else:
            result = {"status": "found", "product": normalized}
        cache.set(cache_key, result, timeout=900)
        return result
    except requests.Timeout:
        logger.warning("Open Food Facts barcode lookup timed out: %s", clean_code)
        return {"status": "timeout", "product": None}
    except requests.RequestException as exc:
        logger.warning("Open Food Facts barcode lookup error: %s", exc)
        return {"status": "unavailable", "product": None}


def search_open_food_facts_products(query: str, page: int = 1, page_size: int = 10) -> dict:
    clean_query = (query or "").strip()
    if len(clean_query) < 2:
        return {"status": "ok", "results": []}

    cache_key = (
        f"off_search:{page}:{page_size}:"
        f"{hashlib.sha256(clean_query.lower().encode()).hexdigest()[:16]}"
    )
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        resp = requests.get(
            "https://world.openfoodfacts.org/cgi/search.pl",
            params={
                "search_terms": clean_query,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page": page,
                "page_size": page_size,
                "fields": "code,product_name,product_name_ar,product_name_en,generic_name,brands,quantity,categories_tags,image_front_small_url,image_front_url,image_url",
            },
            headers={"User-Agent": _get_off_user_agent()},
            timeout=DEFAULT_TIMEOUT_SECONDS,
        )
        if resp.status_code == 429:
            return {"status": "rate_limited", "results": []}
        resp.raise_for_status()
        data = resp.json()
        items = []
        for raw in data.get("products", []):
            norm = _normalize_off_product(raw)
            if norm:
                items.append(norm)
        result = {"status": "ok", "results": items}
        cache.set(cache_key, result, timeout=900)
        return result
    except requests.Timeout:
        logger.warning("Open Food Facts search timed out for query=%s", clean_query)
        return {"status": "timeout", "results": []}
    except requests.RequestException as exc:
        logger.warning("Open Food Facts search error: %s", exc)
        return {"status": "unavailable", "results": []}
