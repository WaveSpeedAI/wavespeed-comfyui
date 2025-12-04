"""
WaveSpeed Task Create Node - Dynamic Task Creation Node

This node is used to create and accumulate task parameters, supporting dynamic model selection and parameter configuration.
"""

import json

from comfy.comfy_types.node_typing import IO as IO_TYPE
from .wavespeed_api.utils import imageurl2tensor


def convert_parameter_value(value, param_type):
    """
    Convert parameter value based on its type specification.

    Args:
        value: The input value from ComfyUI node connection
        param_type: Type specification (string, number, array-str, array-int, lora-weight)

    Returns:
        Converted value appropriate for the API
    """
    print(f"[WaveSpeed] Converting value {value} (type: {type(value)}) to {param_type}")

    if param_type == "array-str":
        # Convert to string array
        if isinstance(value, list):
            result = [str(item) for item in value]
        elif isinstance(value, str):
            # Handle comma-separated string input
            result = [item.strip() for item in value.split(',') if item.strip()]
        else:
            result = [str(value)]
        print(f"[WaveSpeed] array-str conversion result: {result}")
        return result

    elif param_type == "array-int":
        # Convert to number array
        if isinstance(value, list):
            converted = []
            for item in value:
                try:
                    if isinstance(item, (int, float)):
                        converted.append(item)
                    else:
                        converted.append(float(item))
                except (ValueError, TypeError):
                    # If conversion fails, keep as string
                    converted.append(str(item))
            result = converted
        elif isinstance(value, str):
            # Handle comma-separated string input
            converted = []
            for item in value.split(','):
                item = item.strip()
                if item:
                    try:
                        converted.append(float(item))
                    except ValueError:
                        converted.append(item)
            result = converted
        else:
            try:
                result = [float(value)]
            except (ValueError, TypeError):
                result = [str(value)]
        print(f"[WaveSpeed] array-int conversion result: {result}")
        return result

    elif param_type == "lora-weight":
        # Convert LoraWeight type - supports WAVESPEED_LORAS input, JSON structures, and string formats

        # Case 1: Already structured data (from frontend JSON parsing or WAVESPEED_LORAS)
        if isinstance(value, dict):
            # Single LoraWeight object - validate it has required fields
            if 'path' in value and 'scale' in value:
                result = value
                print(f"[WaveSpeed] lora-weight (structured single object) conversion result: {result}")
                return result
            else:
                print(f"[WaveSpeed] Invalid LoRA object, missing required fields: {value}")
                result = {}
        elif isinstance(value, list):
            # Array of LoraWeight objects - validate each item
            valid_loras = []
            for item in value:
                if isinstance(item, dict) and 'path' in item and 'scale' in item:
                    valid_loras.append(item)
                else:
                    print(f"[WaveSpeed] Invalid LoRA item, skipping: {item}")
            result = valid_loras
            print(f"[WaveSpeed] lora-weight (structured array) conversion result: {result}")
            return result
        elif hasattr(value, '__iter__') and not isinstance(value, str):
            # Handle other iterable inputs (WAVESPEED_LORAS fallback)
            if len(value) > 0 and isinstance(value[0], dict) and 'path' in value[0] and 'scale' in value[0]:
                result = list(value)
                print(f"[WaveSpeed] lora-weight (WAVESPEED_LORAS) conversion result: {result}")
                return result
            result = list(value)
        elif isinstance(value, str):
            # Handle JSON string input (fallback for legacy or manual input)
            if value.strip().startswith('{') and value.strip().endswith('}'):
                # Single LoraWeight object
                try:
                    import json
                    parsed = json.loads(value)
                    if isinstance(parsed, dict):
                        # Validate single LoRA object has required fields
                        if 'path' not in parsed or 'scale' not in parsed:
                            raise ValueError("LoRA object must have 'path' and 'scale' fields")
                        result = parsed  # Return single object, not array
                        print(f"[WaveSpeed] lora-weight (single JSON string) conversion result: {result}")
                        return result
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"[WaveSpeed] Failed to parse single LoRA JSON: {e}")
                    result = {}
            elif value.strip().startswith('[') and value.strip().endswith(']'):
                # Array of LoraWeight objects
                try:
                    import json
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        # Validate each item has required fields
                        for item in parsed:
                            if not isinstance(item, dict) or 'path' not in item or 'scale' not in item:
                                raise ValueError("Each LoRA item must have 'path' and 'scale' fields")
                        result = parsed
                        print(f"[WaveSpeed] lora-weight (JSON array string) conversion result: {result}")
                        return result
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"[WaveSpeed] Failed to parse LoRA JSON array: {e}")
                    result = []
            else:
                # Handle comma-separated format: path1:scale1,path2:scale2
                loras = []
                if value.strip():
                    pairs = [pair.strip() for pair in value.split(',') if pair.strip()]
                    for pair in pairs:
                        if ':' in pair:
                            path, scale_str = pair.split(':', 1)
                            try:
                                scale = float(scale_str.strip())
                                loras.append({"path": path.strip(), "scale": scale})
                            except ValueError:
                                print(f"[WaveSpeed] Invalid scale value in LoRA pair: {pair}")
                        else:
                            # Default scale if not specified
                            loras.append({"path": pair.strip(), "scale": 1.0})
                result = loras
        else:
            result = {}  # Default to empty object for single LoRA, empty list for array
        print(f"[WaveSpeed] lora-weight conversion result: {result}")
        return result

    elif param_type == "number":
        # Convert to number
        try:
            if isinstance(value, (int, float)):
                result = value
            else:
                result = float(value)
        except (ValueError, TypeError):
            result = value  # Return as-is if conversion fails
        print(f"[WaveSpeed] number conversion result: {result}")
        return result

    else:
        # Default: treat as string
        result = str(value) if value is not None else ""
        print(f"[WaveSpeed] string conversion result: {result}")
        return result


class WaveSpeedOutputProcessor:
    """
    Shared utility class for processing WaveSpeed API outputs
    """

    @staticmethod
    def process_outputs(task_id, outputs):
        """
        Process API outputs and categorize them into different types

        Args:
            task_id: Task ID
            outputs: List of outputs from API response

        Returns:
            tuple: (task_id, video_url, image, audio_url, text, first_image_url, image_urls)
        """
        video_url = ""
        images = []
        audio_url = ""
        text = ""
        first_image_url = ""
        image_urls = []

        if outputs and len(outputs) > 0:
            # Try to determine output types and separate them
            for output in outputs:
                if isinstance(output, str):
                    output_lower = output.lower()
                    if any(ext in output_lower for ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']):
                        if not video_url:  # Take the first video
                            video_url = output
                    elif any(ext in output_lower for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                        try:
                            images.append(output)
                        except Exception as e:
                            print(f"Failed to load image: {e}")
                    elif any(ext in output_lower for ext in ['.mp3', '.wav', '.m4a', '.flac']):
                        if not audio_url:  # Take the first audio
                            audio_url = output
                    else:
                        # For other outputs that are not media files, check if they are actually text content
                        # Only consider non-URL strings as text content
                        if not text and not output.startswith(('http://', 'https://', 'ftp://', 'data:')):
                            text = output

            # Don't auto-assign first output as text - text should only be actual generated text content
        image = imageurl2tensor(images)
        if images:
            first_image_url = images[0]
            image_urls = images
        return (task_id, video_url, image, audio_url, text, first_image_url, image_urls)

class DynamicRequest:
    """
    Dynamic request class that can handle any API endpoint and parameters
    """

    def __init__(self, model_uuid: str, request_json: dict):
        self.model_uuid = model_uuid
        self.request_json = request_json

    def build_payload(self) -> dict:
        """Build the request payload"""
        return self.request_json

    def get_api_path(self) -> str:
        """Get the API path for this model"""
        return f"/api/v3/{self.model_uuid}"


class WaveSpeedTaskCreateDynamic:
    """
    WaveSpeed AI Dynamic Task Creation Node

    This node provides a dynamic interface for model selection and parameter configuration.
    The frontend dynamically renders parameters, and the backend organizes all request-related content.
    """

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "param_1": (IO_TYPE.ANY,),
                "param_2": (IO_TYPE.ANY,),
                "param_3": (IO_TYPE.ANY,),
                "param_4": (IO_TYPE.ANY,),
                "param_5": (IO_TYPE.ANY,),
                "param_6": (IO_TYPE.ANY,),
                "param_7": (IO_TYPE.ANY,),
                "param_8": (IO_TYPE.ANY,),
                "param_9": (IO_TYPE.ANY,),
                "param_10": (IO_TYPE.ANY,),
                "param_11": (IO_TYPE.ANY,),
                "param_12": (IO_TYPE.ANY,),
                "param_13": (IO_TYPE.ANY,),
                "param_14": (IO_TYPE.ANY,),
                "param_15": (IO_TYPE.ANY,),
                "param_16": (IO_TYPE.ANY,),
                "param_17": (IO_TYPE.ANY,),
                "param_18": (IO_TYPE.ANY,),
                "param_19": (IO_TYPE.ANY,),
                "param_20": (IO_TYPE.ANY,),
            },
            "hidden": {
                "model_id": IO_TYPE.STRING,
                "request_json": IO_TYPE.STRING,
                "param_map": IO_TYPE.STRING,
            },
        }

    RETURN_TYPES = ("TASK_INFO",)
    RETURN_NAMES = ("task_info",)

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    # Mark as an output node, so it can be directly connected to the task submission node
    OUTPUT_NODE = False

    def execute(self, model_id, request_json="{}", param_map="{}", **kwargs):
        """
        Execute dynamic task creation, organizing all request-related content.

        Args:
            model_id: The model ID to use
            request_json: Base request JSON with widget values
            param_map: JSON string mapping parameter names to param_* placeholder info
                      Format: {
                          "param_name": {
                              "placeholder": "param_1",
                              "type": "array-str"  # or "array-int", "string", "number"
                          }
                      }
                      OR legacy format: {"param_name": "param_1"}
            **kwargs: Placeholder parameters (param_1 through param_20)

        Returns:
            task_info: Complete task information including modelUUID, requestJson, and binObjectMap.

        Example param_map formats:
            New format: {"images": {"placeholder": "param_2", "type": "array-str"}}
            Old format: {"images": "param_2"}
        """
        try:
            # Parse the request JSON (containing widget-based parameters)
            try:
                request_json_dict = json.loads(
                    request_json) if request_json else {}
            except json.JSONDecodeError:
                request_json_dict = {}

            # Parse the parameter mapping
            try:
                param_mapping = json.loads(param_map) if param_map else {}
            except json.JSONDecodeError:
                param_mapping = {}

            print(f"[WaveSpeed] Execute with model_id: {model_id}")
            print(f"[WaveSpeed] Base request_json: {request_json_dict}")
            print(f"[WaveSpeed] Param mapping: {param_mapping}")

            # Process param_* placeholders and map them to actual parameter names
            for param_name, param_info in param_mapping.items():
                # Handle both old format (string) and new format (object)
                if isinstance(param_info, str):
                    # Old format: param_info is just the placeholder name
                    placeholder_name = param_info
                    param_type = "string"  # Default type for backward compatibility
                else:
                    # New format: param_info is an object with placeholder and type info
                    placeholder_name = param_info.get("placeholder")
                    param_type = param_info.get("type", "string")

                if placeholder_name and placeholder_name in kwargs:
                    placeholder_value = kwargs[placeholder_name]

                    # Skip default placeholder values
                    if placeholder_value != placeholder_name:
                        # Convert the value based on the parameter type
                        converted_value = convert_parameter_value(placeholder_value, param_type)
                        request_json_dict[param_name] = converted_value
                        print(
                            f"[WaveSpeed] Mapped {param_name} = {converted_value} (from {placeholder_name}, type: {param_type})")

            # Initialize the return data structure
            task_info_result = {
                "modelUUID": model_id,
                "requestJson": request_json_dict.copy(),
            }

            print(f"[WaveSpeed] Final request JSON: {request_json_dict}")
            return (task_info_result,)

        except Exception as e:
            print(f"[WaveSpeed] Error in execute: {e}")
            raise e

    @classmethod
    def IS_CHANGED(cls, **_):
        # Dynamic nodes do not need caching
        return float("nan")


class WaveSpeedTaskSubmit:
    """
    WaveSpeed AI Task Submission Node (Submit from task_info)

    Receives task_info generated by WaveSpeedTaskCreateDynamic and submits the task to WaveSpeed AI.
    """

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "task_info": ("TASK_INFO", {"tooltip": "Task info from WaveSpeedTaskCreateDynamic"}),
                "wait_for_completion": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Whether to wait for task completion"
                }),
            },
            "optional": {
                "max_wait_time": ("INT", {
                    "default": 300,
                    "min": 30,
                    "max": 1800,
                    "tooltip": "Maximum wait time in seconds"
                }),
                "poll_interval": ("INT", {
                    "default": 5,
                    "min": 1,
                    "max": 30,
                    "tooltip": "Polling interval in seconds"
                }),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "IMAGE", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("task_id", "video_url", "image", "audio_url", "text", "firstImageUrl", "imageUrls")

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "submit_task"

    def submit_task(self, client, task_info, wait_for_completion=True,
                    max_wait_time=300, poll_interval=5):
        """
        Submit task from task_info using dynamic request handling

        Args:
            client: WaveSpeed API client
            task_info: Task information from WaveSpeedTaskCreateDynamic
            wait_for_completion: Whether to wait for completion
            max_wait_time: Maximum wait time
            poll_interval: Polling interval

        Returns:
            tuple: (task_id, video_url, image, audio_url, text, firstImageUrl, imageUrls)
        """

        if not task_info:
            raise ValueError("Invalid task_info")

        model_uuid = task_info.get("modelUUID")
        if not model_uuid:
            raise ValueError("Missing modelUUID in task_info")

        try:
            # Import required modules
            from .wavespeed_api.client import WaveSpeedClient

            # Initialize the client
            wavespeed_client = WaveSpeedClient(client["api_key"])

            # Get request parameters directly
            request_json = task_info.get("requestJson", {}).copy()

            # Create dynamic request
            dynamic_request = DynamicRequest(model_uuid, request_json)

            print(f"Submitting task to model {model_uuid} with parameters: {request_json}")

            # Use WaveSpeedClient to send request like in the reference
            response = wavespeed_client.send_request(
                dynamic_request,
                wait_for_completion=wait_for_completion,
                polling_interval=poll_interval,
                timeout=max_wait_time
            )

            if not response:
                raise ValueError("No response from API")

            # Extract task information
            task_id = response.get("id", "")
            status = response.get("status", "completed")
            outputs = response.get("outputs", [])

            # Use shared output processor
            return WaveSpeedOutputProcessor.process_outputs(task_id, outputs)

        except Exception as e:
            error_message = str(e)
            print(f"Error in WaveSpeedTaskSubmit: {error_message}")
            raise Exception(f"WaveSpeedTaskSubmit failed: {error_message}")


class WaveSpeedTaskStatus:
    """
    WaveSpeed AI Task Status Node

    This node checks the status of a task by task_id and returns the results
    """

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "task_id": ("STRING", {"tooltip": "Task ID to check status"}),
            },
            "optional": {
                "max_wait_time": ("INT", {
                    "default": 300,
                    "min": 30,
                    "max": 1800,
                    "tooltip": "Maximum wait time in seconds"
                }),
                "poll_interval": ("INT", {
                    "default": 5,
                    "min": 1,
                    "max": 30,
                    "tooltip": "Polling interval in seconds"
                }),
                "wait_for_completion": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Whether to wait for task completion"
                }),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "IMAGE", "STRING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("task_id", "video_url", "image", "audio_url", "text", "firstImageUrl", "imageUrls")

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "check_status"

    def check_status(self, client, task_id, max_wait_time=300, poll_interval=5, wait_for_completion=True):
        """
        Check task status and return results

        Args:
            client: WaveSpeed API client
            task_id: Task ID to check
            max_wait_time: Maximum wait time
            poll_interval: Polling interval
            wait_for_completion: Whether to wait for completion

        Returns:
            tuple: (task_id, video_url, image, audio_url, text, firstImageUrl, imageUrls)
        """

        if not task_id or task_id.strip() == "":
            raise ValueError("No task ID provided")

        try:
            # Import required modules
            from .wavespeed_api.client import WaveSpeedClient

            # Initialize the client
            wavespeed_client = WaveSpeedClient(client["api_key"])

            print(f"Checking status for task {task_id}")

            if wait_for_completion:
                # Wait for task completion
                response = wavespeed_client.wait_for_task(
                    task_id, poll_interval, max_wait_time
                )
            else:
                # Just check current status
                response = wavespeed_client.check_task_status(task_id)

            if not response:
                raise ValueError("No response from API")

            status = response.get("status", "unknown")
            outputs = response.get("outputs", [])

            if status == "failed":
                error_message = response.get("error", "Task failed")
                raise Exception(f"Task failed: {error_message}")

            if status != "completed":
                # If task is still in progress, return empty outputs but don't throw error
                # This allows users to check the progress
                progress_states = ["created", "processing", "pending", "running", "queued"]
                if status.lower() in progress_states:
                    # Return empty outputs for in-progress tasks
                    return (task_id, "", None, "", "", "", [])
                else:
                    # Unknown status, throw error
                    raise Exception(f"Unknown task status: {status}")

            # Process outputs for different types
            # Use shared output processor
            return WaveSpeedOutputProcessor.process_outputs(task_id, outputs)

        except Exception as e:
            error_message = str(e)
            print(f"Error in WaveSpeedTaskStatus: {error_message}")
            raise Exception(f"WaveSpeedTaskStatus failed: {error_message}")
