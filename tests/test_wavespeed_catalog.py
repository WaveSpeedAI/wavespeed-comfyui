import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "py"))

from wavespeed_catalog import (
    ModelCatalogError,
    categories_from_catalog,
    model_detail_from_catalog,
    models_from_catalog,
    parse_catalog_response,
)


MODEL = {
    "model_id": "wavespeed-ai/example",
    "name": "Example",
    "description": "Example model",
    "type": "text-to-image",
    "api_schema": {
        "api_schemas": [
            {
                "type": "model_run",
                "method": "POST",
                "api_path": "/api/v3/wavespeed-ai/example",
                "request_schema": {"type": "object", "properties": {"prompt": {"type": "string"}}},
            }
        ]
    },
}


class CatalogTest(unittest.TestCase):
    def test_parse_and_project_catalog(self):
        catalog = parse_catalog_response({"code": 200, "data": [MODEL]})

        self.assertEqual(
            [{"name": "Text To Image", "value": "text-to-image", "count": 1}],
            categories_from_catalog(catalog, lambda value: value.replace("-", " ").title()),
        )
        self.assertEqual(
            [{
                "name": "Example",
                "value": "wavespeed-ai/example",
                "description": "Example model",
                "model_id": "wavespeed-ai/example",
                "cover_url": None,
            }],
            models_from_catalog(catalog, "text-to-image"),
        )
        self.assertEqual(
            {
                "id": "wavespeed-ai/example",
                "name": "Example",
                "description": "Example model",
                "category": "text-to-image",
                "model_uuid": "wavespeed-ai/example",
                "api_path": "/api/v3/wavespeed-ai/example",
                "input_schema": MODEL["api_schema"]["api_schemas"][0]["request_schema"],
                "api_schema": MODEL["api_schema"],
                "base_price": None,
                "cover_url": None,
            },
            model_detail_from_catalog(catalog, "wavespeed-ai/example"),
        )

    def test_rejects_invalid_or_missing_models(self):
        with self.assertRaises(ModelCatalogError):
            parse_catalog_response({"code": 200, "data": []})
        with self.assertRaises(ModelCatalogError):
            model_detail_from_catalog([MODEL], "wavespeed-ai/missing")


if __name__ == "__main__":
    unittest.main()
