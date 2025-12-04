"""
WaveSpeed AI API endpoints for ComfyUI frontend

Provides model categories, models list, and model details through HTTP API
"""

from server import PromptServer
from aiohttp import web
import json
import aiohttp
import asyncio
import logging
import time

# Cache
_cache = {
    'categories': None,
    'models': {},
    'model_details': {},
    'cache_time': {},
    'ttl': 5 * 60  # 5 minutes
}

def is_cache_valid(key):
    """Check if the cache is valid"""
    if key not in _cache['cache_time']:
        return False
    return (time.time() - _cache['cache_time'][key]) < _cache['ttl']

def set_cache(key, value):
    """Set the cache"""
    _cache[key] = value
    _cache['cache_time'][key] = time.time()
    if key.startswith("models_"):
        _cache['models'][key] = value
    elif key.startswith("detail_"):
        _cache['model_details'][key] = value

def get_cache(key, allow_stale=False):
    """Get the cache"""
    if allow_stale:
        return _cache.get(key)
    if is_cache_valid(key):
        return _cache.get(key)
    return None

def cache_age_seconds(key):
    """Return cache age in seconds or None if no cache"""
    if key not in _cache['cache_time']:
        return None
    return time.time() - _cache['cache_time'][key]

_refreshing_keys = set()

async def refresh_cache_async(key, fetcher, *args, **kwargs):
    """Refresh cache in the background without blocking the response path"""
    if key in _refreshing_keys:
        return
    _refreshing_keys.add(key)
    try:
        data = await fetcher(*args, **kwargs)
        if data is not None:
            set_cache(key, data)
    except Exception as error:
        logging.error(f"Background refresh failed for {key}: {error}", exc_info=True)
    finally:
        _refreshing_keys.discard(key)

def schedule_cache_refresh(key, fetcher, *args, **kwargs):
    """Schedule a background refresh if one is not already running"""
    if key in _refreshing_keys:
        return
    loop = asyncio.get_event_loop()
    loop.create_task(refresh_cache_async(key, fetcher, *args, **kwargs))

async def fetch_model_categories_from_api():
    """Fetch categories from WaveSpeed API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("https://wavespeed.ai/center/default/api/v1/model_product/type_statistics") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("code") == 200 and data.get("data"):
                        categories = []
                        for item in data["data"]:
                            if item.get("count", 0) > 0:
                                categories.append({
                                    "name": format_category_name(item["type"]),
                                    "value": item["type"],
                                    "count": item["count"]
                                })
                        return categories
    except Exception as e:
        logging.error(f"Error fetching categories: {e}", exc_info=True)
    return None

async def fetch_models_from_api(category):
    """Fetch models from WaveSpeed API for a category"""
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://wavespeed.ai/center/default/api/v1/model_product/search?page=1&page_size=100&types={category}"
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("code") == 200 and data.get("data", {}).get("items"):
                        models = []
                        for model in data["data"]["items"]:
                            models.append({
                                "name": model.get("model_name", ""),
                                "value": model.get("model_uuid", ""),
                            })
                        return models
    except Exception as e:
        logging.error(f"Error fetching models for category {category}: {e}", exc_info=True)
    return None

class ModelDetailError(Exception):
    """Expected errors while fetching model detail"""

async def fetch_model_detail_from_api(model_id):
    """Fetch model detail from WaveSpeed API and normalize"""
    async with aiohttp.ClientSession() as session:
        url = f"https://wavespeed.ai/center/default/api/v1/model_product/detail/{model_id}"
        headers = {
            'User-Agent': 'ComfyUI-WaveSpeedAI-API/1.0.0',
            'Accept': '*/*',
            'Host': 'wavespeed.ai',
            'Connection': 'keep-alive',
        }

        async with session.get(url, headers=headers, timeout=10) as resp:
            if resp.status == 404:
                raise ModelDetailError(f"Model '{model_id}' not found")

            if resp.status != 200:
                raise ModelDetailError(f"API request failed with status {resp.status}")

            try:
                data = await resp.json()
            except Exception as json_error:
                text_content = await resp.text()
                logging.error(f"JSON parse error for model {model_id}: {json_error}")
                logging.error(f"Response content: {text_content[:500]}")
                raise ModelDetailError(f"Invalid JSON response from API: {str(json_error)}")

            if data.get("code") != 200:
                message = data.get("message", "Unknown API error")
                raise ModelDetailError(f"API returned error code {data.get('code')}: {message}")

            if not data.get("data"):
                raise ModelDetailError(f"No model data found for '{model_id}'")

            model_detail = convert_api_model_to_model_info(data["data"])
            
            logging.info(f"--- Full Model Detail (raw) ---\n{json.dumps(model_detail, indent=2)}\n---------------------------------")
            
            if (model_detail and
                model_detail.get("api_schema", {}).get("api_schemas") and
                len(model_detail["api_schema"]["api_schemas"]) > 0 and
                model_detail["api_schema"]["api_schemas"][0].get("request_schema")):

                request_schema = model_detail["api_schema"]["api_schemas"][0]["request_schema"]
                simplified_model_detail = {
                    "id": model_detail["id"],
                    "name": model_detail["name"],
                    "description": model_detail["description"],
                    "category": model_detail["category"],
                    "model_uuid": model_detail["model_uuid"],
                    "input_schema": request_schema
                }
                
                logging.info(f"simplified_model_detail: {json.dumps(simplified_model_detail, indent=2)}")
                return simplified_model_detail

            raise ModelDetailError(f"No valid request schema found for model '{model_id}'")

@PromptServer.instance.routes.get("/wavespeed/api/categories")
async def get_model_categories(_):
    """Get the list of model categories"""
    try:
        cache_key = "categories"

        cached = get_cache(cache_key, allow_stale=True)
        age = cache_age_seconds(cache_key)

        if cached is not None and age is not None and age < _cache['ttl']:
            return web.json_response({"success": True, "data": cached})

        if cached is not None:
            schedule_cache_refresh(cache_key, fetch_model_categories_from_api)
            return web.json_response({"success": True, "data": cached})

        categories = await fetch_model_categories_from_api()
        if categories is not None:
            set_cache(cache_key, categories)
            return web.json_response({"success": True, "data": categories})

    except Exception as e:
        logging.error(f"Error fetching categories: {e}", exc_info=True)

    # Return default categories
    default_categories = [
        {"name": "Text to Image", "value": "text-to-image", "count": 0},
        {"name": "Image to Video", "value": "image-to-video", "count": 0},
        {"name": "Text to Video", "value": "text-to-video", "count": 0}
    ]
    return web.json_response({"success": True, "data": default_categories})

@PromptServer.instance.routes.get("/wavespeed/api/models/{category}")
async def get_models_by_category(request):
    """Get the list of models by category"""
    try:
        category = request.match_info['category']

        # Check cache
        cache_key = f"models_{category}"
        cached = get_cache(cache_key, allow_stale=True)
        age = cache_age_seconds(cache_key)

        if cached is not None and age is not None and age < _cache['ttl']:
            return web.json_response({"success": True, "data": cached})

        if cached is not None:
            schedule_cache_refresh(cache_key, fetch_models_from_api, category)
            return web.json_response({"success": True, "data": cached})

        models = await fetch_models_from_api(category)
        if models:
            set_cache(cache_key, models)
            return web.json_response({"success": True, "data": models})

    except Exception as e:
        logging.error(f"Error fetching models for category {category}: {e}", exc_info=True)

    return web.json_response({"success": False, "error": "Failed to fetch models"})

@PromptServer.instance.routes.get("/wavespeed/api/model")
async def get_model_detail(request):
    """Get model details (get model_id via query parameter, automatically handle cases with /)"""
    try:
        model_id = request.query.get('model_id')
        if not model_id:
            return web.json_response({"success": False, "error": "Missing model_id parameter"})

        # Handle slashes (/) that may be included in model_id. The frontend usually encodes it with encodeURIComponent, but we decode and clean it here.
        from urllib.parse import unquote
        model_id = unquote(model_id)
        # Remove leading/trailing slashes
        model_id = model_id.strip('/')

        # Check cache
        cache_key = f"detail_{model_id}"
        cached = get_cache(cache_key, allow_stale=True)
        age = cache_age_seconds(cache_key)

        if cached is not None and age is not None and age < _cache['ttl']:
            return web.json_response({"success": True, "data": cached})

        if cached is not None:
            schedule_cache_refresh(cache_key, fetch_model_detail_from_api, model_id)
            return web.json_response({"success": True, "data": cached})

        model_detail = await fetch_model_detail_from_api(model_id)
        set_cache(cache_key, model_detail)
        return web.json_response({"success": True, "data": model_detail})

    except asyncio.TimeoutError:
        return web.json_response({"success": False, "error": "Request timeout"})
    except aiohttp.ClientError as e:
        return web.json_response({"success": False, "error": f"Network error: {str(e)}"})
    except ModelDetailError as e:
        return web.json_response({"success": False, "error": str(e)})
    except Exception as e:
        logging.error(f"Error fetching model detail for {model_id}: {e}", exc_info=True)
        return web.json_response({"success": False, "error": f"Internal error: {str(e)}"})

def format_category_name(type_name):
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

def convert_api_model_to_model_info(api_model):
    """Convert the model data returned by the API to ModelInfo format, consistent with the n8n implementation"""
    if not api_model:
        logging.warning('convert_api_model_to_model_info: apiModel is null or undefined')
        return None

    # Validate required fields
    if not api_model.get("model_uuid") or not api_model.get("model_name"):
        logging.warning('convert_api_model_to_model_info: Missing required fields (model_uuid or model_name)')
        return None

    input_schema = None
    try:
        # The 'input' field can be a string or an object
        if isinstance(api_model.get("input"), str) and api_model["input"].strip():
            input_schema = json.loads(api_model["input"])
        elif isinstance(api_model.get("input"), dict) and api_model["input"]:
            input_schema = api_model["input"]
    except Exception as error:
        logging.error(f'Failed to parse input schema for model {api_model.get("model_uuid")}: {error}')

    # If there is no direct 'input' field, try to extract it from api_schema
    if not input_schema and api_model.get("api_schema", {}).get("api_schemas"):
        try:
            model_run_schema = None
            for schema in api_model["api_schema"]["api_schemas"]:
                if schema and schema.get("type") == "model_run":
                    model_run_schema = schema
                    break

            if model_run_schema and model_run_schema.get("request_schema"):
                input_schema = model_run_schema["request_schema"]
        except Exception as error:
            logging.error(f'Failed to extract schema from api_schema for model {api_model.get("model_uuid")}: {error}')

    try:
        # Parse parameters (corresponding to n8n WaveSpeedClient.parseInputSchemaToParameters)
        parameters = parse_input_schema_to_parameters(input_schema) if input_schema else []

        return {
            "id": api_model["model_uuid"],
            "name": api_model["model_name"],
            "description": api_model.get("description") or api_model.get("readme") or "",
            "category": api_model.get("type", "unknown"),
            "parameters": parameters,
            "model_uuid": api_model["model_uuid"],
            "model_id": api_model.get("model_id", ""),
            "base_price": api_model.get("base_price"),
            "cover_url": api_model.get("cover_url"),
            "poster": api_model.get("poster"),
            "api_schema": api_model.get("api_schema"),
            "input_schema": input_schema,
            "tags": api_model.get("tags", []),
            "categories": api_model.get("categories", []),
            "api_server_domain": api_model.get("api_server_domain"),
        }
    except Exception as error:
        logging.error(f'Failed to convert model data for {api_model.get("model_uuid")}: {error}')
        return None

def parse_input_schema_to_parameters(input_schema):
    """Parse the input schema into a parameter array, consistent with the n8n implementation"""
    if not input_schema or not input_schema.get("properties"):
        return []

    parameters = []
    properties = input_schema["properties"]
    required = input_schema.get("required", [])
    order_properties = input_schema.get("x-order-properties", list(properties.keys()))

    # Process properties in the specified order
    for prop_name in order_properties:
        if prop_name not in properties:
            continue

        prop = properties[prop_name]

        # Skip disabled or hidden parameters
        if should_disable_parameter(prop):
            continue

        parameter = {
            "name": prop_name,
            "displayName": format_display_name(prop_name),
            "type": map_json_schema_type_to_node_type(prop),
            "required": prop_name in required,
            "default": prop.get("default"),
            "description": prop.get("description", ""),
        }

        # Handle option types
        if prop.get("enum") and len(prop["enum"]) > 0:
            parameter["type"] = "options"
            parameter["options"] = [
                {
                    "name": str(value),
                    "value": value,
                    "description": str(value)
                }
                for value in prop["enum"]
            ]

            # If there is a default value, make sure it is in the options
            if parameter["default"] is not None:
                has_valid_default = parameter["default"] in prop["enum"]
                if not has_valid_default and len(prop["enum"]) > 0:
                    # If the default value is not in the enum, use the first option as the default
                    parameter["default"] = prop["enum"][0]

        # Handle the precision and range of numeric types
        if prop.get("type") in ["number", "integer"]:
            parameter["typeOptions"] = {
                "numberPrecision": 0 if prop["type"] == "integer" else 2
            }

            # Add min and max value constraints
            if prop.get("minimum") is not None:
                parameter["typeOptions"]["minValue"] = prop["minimum"]
            if prop.get("maximum") is not None:
                parameter["typeOptions"]["maxValue"] = prop["maximum"]

        # Handle extra constraints for string types
        if prop.get("type") == "string":
            if prop.get("minLength") or prop.get("maxLength"):
                parameter["typeOptions"] = parameter.get("typeOptions", {})
                if prop.get("minLength"):
                    parameter["typeOptions"]["minValue"] = prop["minLength"]
                if prop.get("maxLength"):
                    parameter["typeOptions"]["maxValue"] = prop["maxLength"]

        # Handle default value for boolean type
        if prop.get("type") == "boolean" and parameter["default"] is None:
            parameter["default"] = False  # Boolean types default to false

        parameters.append(parameter)

    return parameters

def format_display_name(prop_name):
    """Format display name"""
    return ' '.join(word.capitalize() for word in prop_name.split('_'))

def map_json_schema_type_to_node_type(prop):
    """Map JSON Schema types to n8n node types"""
    if prop.get("enum") and len(prop["enum"]) > 0:
        return "options"

    type_mapping = {
        "string": "string",
        "number": "number",
        "integer": "number",
        "boolean": "boolean",
        "array": "collection",
        "object": "collection"
    }

    return type_mapping.get(prop.get("type"), "string")

def should_disable_parameter(prop):
    """Check if the parameter should be disabled/hidden"""
    return prop.get("disabled") is True or prop.get("hidden") is True

logging.info("WaveSpeed AI API endpoints registered")
