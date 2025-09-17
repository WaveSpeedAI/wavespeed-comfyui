"""
WaveSpeed API utilities for ComfyUI
"""
import requests
import json
import time
import threading
import os

class WaveSpeedAPIUtils:
    """General WaveSpeed API utility class"""

    BASE_URL = "https://api.wavespeed.ai"
    CENTER_BASE_URL = "https://wavespeed.ai"

    def __init__(self, api_key):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # Model cache for performance
        self._model_cache = {}
        self._cache_lock = threading.Lock()
        self._cache_ttl = 300  # 5 minutes cache

    def get_model_categories(self):
        """Get the list of model categories"""
        try:
            url = f"{self.CENTER_BASE_URL}/center/default/api/v1/model_product/type_statistics"
            response = requests.get(url, timeout=10)

            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 200 and data.get("data"):
                    categories = []
                    for item in data["data"]:
                        if item.get("count", 0) > 0:
                            categories.append({
                                "name": self._format_category_name(item["type"]),
                                "value": item["type"],
                                "count": item["count"]
                            })
                    return categories

            # Fallback to default categories
            return self._get_default_categories()

        except Exception as e:
            print(f"Error getting model categories: {e}")
            return self._get_default_categories()

    def _format_category_name(self, type_name):
        """Format category name"""
        name_map = {
            'text-to-video': 'Text to Video',
            'text-to-image': 'Text to Image',
            'image-to-video': 'Image to Video',
            'image-to-image': 'Image to Image',
            'image-to-3d': 'Image to 3D',
            'video-to-video': 'Video to Video',
            'text-to-audio': 'Text to Audio',
            'audio-to-video': 'Audio to Video',
            'image-to-text': 'Image to Text',
            'text-to-text': 'Text to Text',
            'training': 'Training',
            'image-effects': 'Image Effects',
            'video-effects': 'Video Effects',
            'scenario-marketing': 'Scenario Marketing',
            'image-tools': 'Image Tools',
        }
        return name_map.get(type_name, type_name.replace('-', ' ').title())

    def _get_default_categories(self):
        """Default category list"""
        return [
            {"name": "Text to Video", "value": "text-to-video", "count": 0},
            {"name": "Text to Image", "value": "text-to-image", "count": 0},
            {"name": "Image to Video", "value": "image-to-video", "count": 0},
            {"name": "Image to Image", "value": "image-to-image", "count": 0},
            {"name": "Video Effects", "value": "video-effects", "count": 0},
            {"name": "Image Effects", "value": "image-effects", "count": 0},
        ]

    def get_models_by_category(self, category):
        """Get the list of models by category"""
        cache_key = f"models_{category}"

        with self._cache_lock:
            cached = self._model_cache.get(cache_key)
            if cached and time.time() - cached["timestamp"] < self._cache_ttl:
                return cached["data"]

        try:
            url = f"{self.CENTER_BASE_URL}/center/default/api/v1/model_product/search"
            params = {
                "page": 1,
                "page_size": 100,
                "types": category
            }
            response = requests.get(url, params=params, timeout=10)

            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 200 and data.get("data", {}).get("items"):
                    models = []
                    for model in data["data"]["items"]:
                        models.append({
                            "name": model.get("model_name", ""),
                            "value": model.get("model_uuid", ""),
                            "description": model.get("description", ""),
                            "model_id": model.get("model_id"),
                            "cover_url": model.get("cover_url"),
                        })

                    # Cache the result
                    with self._cache_lock:
                        self._model_cache[cache_key] = {
                            "data": models,
                            "timestamp": time.time()
                        }

                    return models

            return []

        except Exception as e:
            print(f"Error getting models for category {category}: {e}")
            return []

    def get_model_detail(self, model_id):
        """Get model details"""
        cache_key = f"model_detail_{model_id}"

        with self._cache_lock:
            cached = self._model_cache.get(cache_key)
            if cached and time.time() - cached["timestamp"] < self._cache_ttl:
                return cached["data"]

        try:
            url = f"{self.CENTER_BASE_URL}/center/default/api/v1/model_product/detail/{model_id}"
            response = requests.get(url, timeout=10)

            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 200 and data.get("data"):
                    model_detail = self._convert_model_detail(data["data"])

                    # Cache the result
                    with self._cache_lock:
                        self._model_cache[cache_key] = {
                            "data": model_detail,
                            "timestamp": time.time()
                        }

                    return model_detail

            return None

        except Exception as e:
            print(f"Error getting model detail for {model_id}: {e}")
            return None

    def _convert_model_detail(self, api_model):
        """Convert the model information returned by the API to the internal format"""
        if not api_model:
            return None

        # Parse input schema
        input_schema = None
        try:
            if isinstance(api_model.get("input"), str):
                input_schema = json.loads(api_model["input"])
            elif isinstance(api_model.get("input"), dict):
                input_schema = api_model["input"]
        except:
            pass

        # If there is no direct 'input' field, try to extract it from api_schema
        if not input_schema and api_model.get("api_schema", {}).get("api_schemas"):
            for schema in api_model["api_schema"]["api_schemas"]:
                if schema.get("type") == "model_run":
                    input_schema = schema.get("request_schema")
                    break

        return {
            "id": api_model.get("model_uuid"),
            "name": api_model.get("model_name", ""),
            "description": api_model.get("description", ""),
            "category": api_model.get("type", "unknown"),
            "input_schema": input_schema,
            "api_schema": api_model.get("api_schema"),
            "cover_url": api_model.get("cover_url"),
            "base_price": api_model.get("base_price"),
        }

    def parse_model_parameters(self, input_schema):
        """Parse model parameter schema"""
        if not input_schema or not input_schema.get("properties"):
            return []

        parameters = []
        properties = input_schema["properties"]
        required = input_schema.get("required", [])
        order = input_schema.get("x-order-properties", list(properties.keys()))

        for prop_name in order:
            if prop_name not in properties:
                continue

            prop = properties[prop_name]

            # Skip disabled or hidden parameters
            if prop.get("disabled") or prop.get("hidden"):
                continue

            param = {
                "name": prop_name,
                "displayName": self._format_display_name(prop_name),
                "type": self._map_type(prop),
                "required": prop_name in required,
                "default": prop.get("default"),
                "description": prop.get("description", ""),
            }

            # Handle option types
            if prop.get("enum"):
                param["type"] = "options"
                param["options"] = [{"name": str(v), "value": v} for v in prop["enum"]]

            # Handle the range of numeric types
            if prop.get("type") in ["number", "integer"]:
                param["minimum"] = prop.get("minimum")
                param["maximum"] = prop.get("maximum")

            parameters.append(param)

        return parameters

    def _format_display_name(self, prop_name):
        """Format display name"""
        return prop_name.replace("_", " ").title()

    def _map_type(self, prop):
        """Map JSON Schema types to ComfyUI types"""
        if prop.get("enum"):
            return "options"

        prop_type = prop.get("type", "string")
        type_map = {
            "string": "STRING",
            "number": "FLOAT",
            "integer": "INT",
            "boolean": "BOOLEAN",
            "array": "LIST",
            "object": "DICT",
        }
        return type_map.get(prop_type, "STRING")

    def submit_task(self, model_id, parameters):
        """Submit a task to the WaveSpeed API"""
        try:
            url = f"{self.BASE_URL}/api/v3/{model_id}"
            response = requests.post(url, headers=self.headers, json=parameters, timeout=30)

            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}: {response.text}")

            data = response.json()
            if data.get("code") != 200:
                raise Exception(f"API Error: {data.get('message', 'Unknown error')}")

            return data.get("data")

        except Exception as e:
            print(f"Error submitting task: {e}")
            raise

    def get_task_status(self, task_id):
        """Get task status"""
        try:
            url = f"{self.BASE_URL}/api/v3/predictions/{task_id}/result"
            response = requests.get(url, headers=self.headers, timeout=10)

            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}: {response.text}")

            return response.json()

        except Exception as e:
            print(f"Error getting task status: {e}")
            raise

    def wait_for_completion(self, task_id, max_wait_time=300, poll_interval=5):
        """Wait for the task to complete"""
        start_time = time.time()

        while time.time() - start_time < max_wait_time:
            status_data = self.get_task_status(task_id)

            # Handle different response formats
            if status_data.get("data", {}).get("status"):
                status = status_data["data"]["status"]
                task_data = status_data["data"]
            elif status_data.get("status"):
                status = status_data["status"]
                task_data = status_data
            else:
                status = "unknown"
                task_data = status_data

            if status == "completed":
                return task_data
            elif status == "failed":
                error_msg = task_data.get("error", "Task failed")
                raise Exception(f"Task failed: {error_msg}")

            time.sleep(poll_interval)

        raise Exception(f"Task timeout after {max_wait_time} seconds")