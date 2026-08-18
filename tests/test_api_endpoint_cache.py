import asyncio
import importlib
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_NAME = "wavespeed_test_plugin"

server = types.ModuleType("server")


class Routes:
    def get(self, _path):
        return lambda handler: handler

    def post(self, _path):
        return lambda handler: handler


server.PromptServer = types.SimpleNamespace(instance=types.SimpleNamespace(routes=Routes()))
sys.modules.setdefault("server", server)

package = types.ModuleType(PACKAGE_NAME)
package.__path__ = [str(PLUGIN_ROOT / "py")]
sys.modules.setdefault(PACKAGE_NAME, package)
endpoints = importlib.import_module(f"{PACKAGE_NAME}.wavespeed_api_endpoints")


class Request:
    async def json(self):
        return {"api_key": "replacement-key"}


class EndpointCacheTest(unittest.TestCase):
    def setUp(self):
        endpoints.clear_model_cache()

    def test_clear_model_cache_removes_all_derived_values(self):
        endpoints.set_cache("model_catalog", [{"model_id": "old"}])
        endpoints.set_cache("categories", [{"value": "old"}])
        endpoints.set_cache("models_old", [{"value": "old"}])
        endpoints.set_cache("detail_old", {"model_uuid": "old"})

        endpoints.clear_model_cache()

        self.assertIsNone(endpoints.get_cache("model_catalog", allow_stale=True))
        self.assertIsNone(endpoints.get_cache("categories", allow_stale=True))
        self.assertEqual({}, endpoints._cache["models"])
        self.assertEqual({}, endpoints._cache["model_details"])
        self.assertEqual({}, endpoints._cache["cache_time"])

    def test_catalog_error_is_not_returned_as_default_categories(self):
        error = endpoints.ModelCatalogError("invalid API key")
        with patch.object(endpoints, "fetch_model_categories_from_api", AsyncMock(side_effect=error)), \
             patch.object(endpoints.logging, "error"):
            response = asyncio.run(endpoints.get_model_categories(None))

        self.assertEqual({"success": False, "error": "invalid API key"}, json.loads(response.text))

    def test_saving_api_key_invalidates_server_catalog(self):
        endpoints.set_cache("model_catalog", [{"model_id": "old"}])
        with patch.object(endpoints, "save_api_key", return_value=True):
            response = asyncio.run(endpoints.save_config_endpoint(Request()))

        self.assertTrue(json.loads(response.text)["success"])
        self.assertIsNone(endpoints.get_cache("model_catalog", allow_stale=True))


if __name__ == "__main__":
    unittest.main()
