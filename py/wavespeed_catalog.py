"""Helpers for consuming the authenticated WaveSpeed model catalog."""

from collections import Counter


MODEL_CATALOG_URL = "https://api.wavespeed.ai/api/v3/models"


class ModelCatalogError(ValueError):
    """The official model catalog response is unavailable or malformed."""


def parse_catalog_response(payload):
    """Validate the API envelope and return its model list."""
    if not isinstance(payload, dict) or payload.get("code") != 200:
        message = payload.get("message", "Unknown API error") if isinstance(payload, dict) else "Invalid JSON payload"
        raise ModelCatalogError(f"Model catalog API failed: {message}")

    items = payload.get("data")
    if not isinstance(items, list) or not items:
        raise ModelCatalogError("Model catalog API returned no models")

    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("model_id"), str):
            raise ModelCatalogError("Model catalog API returned an invalid model entry")
    return items


def categories_from_catalog(catalog, format_name):
    counts = Counter(item.get("type") for item in catalog if item.get("type"))
    return [
        {"name": format_name(model_type), "value": model_type, "count": count}
        for model_type, count in sorted(counts.items())
    ]


def models_from_catalog(catalog, category):
    return [
        {
            "name": item.get("name") or item["model_id"],
            "value": item["model_id"],
            "description": item.get("description") or "",
            "model_id": item["model_id"],
            "cover_url": None,
        }
        for item in catalog
        if item.get("type") == category
    ]


def model_detail_from_catalog(catalog, model_id):
    item = next((entry for entry in catalog if entry.get("model_id") == model_id), None)
    if item is None:
        raise ModelCatalogError(f"Model '{model_id}' not found")

    api_schema = item.get("api_schema")
    endpoints = api_schema.get("api_schemas") if isinstance(api_schema, dict) else None
    if not isinstance(endpoints, list):
        raise ModelCatalogError(f"Model '{model_id}' has no API schema")

    model_run = next(
        (
            endpoint
            for endpoint in endpoints
            if isinstance(endpoint, dict)
            and endpoint.get("type") == "model_run"
            and isinstance(endpoint.get("request_schema"), dict)
        ),
        None,
    )
    if model_run is None:
        raise ModelCatalogError(f"Model '{model_id}' has no request schema")

    return {
        "id": model_id,
        "name": item.get("name") or model_id,
        "description": item.get("description") or "",
        "category": item.get("type", "unknown"),
        "model_uuid": model_id,
        "api_path": model_run.get("api_path") or f"/api/v3/{model_id}",
        "input_schema": model_run["request_schema"],
        "api_schema": api_schema,
        "base_price": item.get("base_price"),
        "cover_url": None,
    }
