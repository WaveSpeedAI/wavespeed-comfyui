"""
WaveSpeed AI Predictor Node - All-in-One Node

Combines Task Create and Task Submit functionality into a single node.
Users can:
1. Select a model
2. Configure parameters (dynamically generated)
3. Execute the generation task

All in one place!
"""

import cv2
import json
import io
import os
import re
import tempfile
import traceback
import torch
import numpy as np
import scipy.io.wavfile as wavfile
from PIL import Image
from comfy.comfy_types.node_typing import IO as IO_TYPE
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_config import get_api_key_from_config
from .wavespeed_upload import upload_bytes

def detect_tensor_type(tensor_data):
    """
    Detect the type of tensor data (image, video, or audio)
    
    Args:
        tensor_data: Torch tensor or numpy array
        
    Returns:
        str: 'image', 'video', or 'audio'
    """
    # Convert to numpy if needed for shape analysis
    if torch.is_tensor(tensor_data):
        shape = tensor_data.shape
    else:
        shape = tensor_data.shape
    
    ndim = len(shape)
    
    # Image tensor patterns:
    # - [B, H, W, C] - batch of images (ComfyUI format)
    # - [H, W, C] - single image
    # - [H, W] - grayscale image
    # - [B, C, H, W] - PyTorch format batch
    # - [C, H, W] - PyTorch format single
    
    # Video tensor patterns:
    # - [B, F, H, W, C] - batch of videos
    # - [F, H, W, C] - single video (frames)
    # - [B, F, C, H, W] - PyTorch format batch
    # - [F, C, H, W] - PyTorch format single
    
    # Audio tensor patterns:
    # - [B, C, T] - batch of audio (channels, time)
    # - [C, T] - single audio
    # - [T] - mono audio
    # - [B, T] - batch of mono audio
    
    if ndim == 2:
        # Could be grayscale image [H, W] or mono audio [C, T] or [B, T]
        # If one dimension is much larger than the other, likely audio
        if shape[0] < 10 and shape[1] > 1000:
            return 'audio'  # [C, T] where C is small (1-2 channels)
        elif shape[1] < 10 and shape[0] > 1000:
            return 'audio'  # [T, C] transposed
        else:
            return 'image'  # Grayscale image [H, W]
    
    elif ndim == 3:
        # Could be:
        # - Image [H, W, C] or [C, H, W] or [B, H, W]
        # - Audio [B, C, T] or [C, T, ?]
        
        # Check for typical image channel counts (1, 3, 4)
        if shape[-1] in [1, 3, 4] and shape[0] > 10 and shape[1] > 10:
            return 'image'  # [H, W, C]
        elif shape[0] in [1, 3, 4] and shape[1] > 10 and shape[2] > 10:
            return 'image'  # [C, H, W]
        elif shape[0] < 10 and shape[2] > 1000:
            return 'audio'  # [B, C, T] or similar
        else:
            return 'image'  # Default to image for 3D
    
    elif ndim == 4:
        # Could be:
        # - Image batch [B, H, W, C] or [B, C, H, W]
        # - Video [F, H, W, C] or [F, C, H, W]
        
        # Check if first dimension looks like frame count (video) or batch (image)
        # Videos typically have more frames than image batches
        if shape[0] > 10:
            # Likely video frames
            return 'video'
        else:
            # Likely image batch
            return 'image'
    
    elif ndim == 5:
        # Most likely video batch [B, F, H, W, C] or [B, F, C, H, W]
        return 'video'
    
    elif ndim == 1:
        # Mono audio [T]
        return 'audio'
    
    else:
        # Default to image for unknown shapes
        return 'image'


def upload_tensor_to_wavespeed(tensor_data, force_type=None):
    """
    Upload a tensor (image/video/audio) to WaveSpeed server and return URL
    Uses direct HTTP request to local ComfyUI endpoint

    Args:
        tensor_data: Torch tensor or numpy array
        force_type: Optional override type ("image", "video", "audio")

    Returns:
        str: Uploaded file URL
    """
    try:
        # Detect tensor type unless forced
        if force_type in ("image", "video", "audio"):
            tensor_type = force_type
        else:
            tensor_type = detect_tensor_type(tensor_data)
        print(f"[WaveSpeed] Detected tensor type: {tensor_type}")

        # Convert to numpy if needed
        if torch.is_tensor(tensor_data):
            data_array = tensor_data.cpu().numpy()
        else:
            data_array = tensor_data

        buffer = io.BytesIO()
        filename = 'tensor_upload'
        content_type = 'application/octet-stream'

        if tensor_type == 'image':
            # Handle image tensor
            # ComfyUI image tensors are in format [B, H, W, C] with values in [0, 1]
            if len(data_array.shape) == 4:
                # Batch of images, take first image
                img_array = data_array[0]
            else:
                img_array = data_array

            # Ensure 3D array [H, W, C]
            if len(img_array.shape) == 2:
                # Grayscale [H, W] -> [H, W, 1]
                img_array = np.expand_dims(img_array, axis=-1)

            # Convert from [0, 1] to [0, 255]
            if img_array.max() <= 1.0:
                img_array = (img_array * 255).astype(np.uint8)
            else:
                img_array = img_array.astype(np.uint8)

            # Convert to PIL Image
            img = Image.fromarray(img_array)
            img.save(buffer, format='PNG')
            filename = 'tensor_upload.png'
            content_type = 'image/png'

        elif tensor_type == 'video':
            # Handle video tensor
            # Video tensor format: [B, F, H, W, C] or [F, H, W, C]
            try:
                if len(data_array.shape) == 5:
                    # [B, F, H, W, C] - take first batch
                    frames = data_array[0]
                else:
                    # [F, H, W, C]
                    frames = data_array

                # Convert from [0, 1] to [0, 255]
                if frames.max() <= 1.0:
                    frames = (frames * 255).astype(np.uint8)
                else:
                    frames = frames.astype(np.uint8)

                # Create temporary video file
                with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_video:
                    temp_path = temp_video.name

                # Get video properties
                height, width = frames.shape[1:3]
                fps = 30  # default FPS

                # Create video writer
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                out = cv2.VideoWriter(temp_path, fourcc, fps, (width, height))

                # Write frames
                for frame in frames:
                    # Convert RGB to BGR for OpenCV
                    if frame.shape[-1] == 3:
                        frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                    else:
                        frame_bgr = frame
                    out.write(frame_bgr)

                out.release()

                # Read video file to buffer
                with open(temp_path, 'rb') as f:
                    buffer.write(f.read())

                # Clean up temp file
                os.unlink(temp_path)

                filename = 'tensor_upload.mp4'
                content_type = 'video/mp4'

            except ImportError:
                print("[WaveSpeed] OpenCV not available, treating video as image sequence")
                # Fallback: save first frame as image
                frame = frames[0] if len(frames) > 0 else frames
                if frame.max() <= 1.0:
                    frame = (frame * 255).astype(np.uint8)
                else:
                    frame = frame.astype(np.uint8)
                img = Image.fromarray(frame)
                img.save(buffer, format='PNG')
                filename = 'tensor_upload.png'
                content_type = 'image/png'

        elif tensor_type == 'audio':
            # Handle audio tensor
            # Audio tensor format: [B, C, T] or [C, T] or [T]
            try:
                if len(data_array.shape) == 3:
                    # [B, C, T] - take first batch
                    audio_data = data_array[0]
                elif len(data_array.shape) == 2:
                    # [C, T]
                    audio_data = data_array
                else:
                    # [T]
                    audio_data = data_array

                # Convert to mono if stereo/multi-channel
                if len(audio_data.shape) == 2:
                    # Average channels
                    audio_data = np.mean(audio_data, axis=0)

                # Normalize audio to [-1, 1] if needed
                if audio_data.max() <= 1.0 and audio_data.min() >= -1.0:
                    # Already normalized
                    pass
                else:
                    # Normalize
                    audio_data = audio_data / np.max(np.abs(audio_data))

                # Convert to 16-bit PCM
                audio_data = (audio_data * 32767).astype(np.int16)

                # Write to WAV file
                sample_rate = 44100  # default sample rate
                wavfile.write(buffer, sample_rate, audio_data)

                filename = 'tensor_uploGad.wav'
                content_type = 'audio/wav'

            except ImportError:
                print("[WaveSpeed] scipy not available for audio processing")
                raise ValueError("Audio tensor detected but scipy not available")

        buffer.seek(0)
        file_bytes = buffer.read()
        uploaded_url = upload_bytes_to_wavespeed(file_bytes, filename, content_type)
        print(f"[WaveSpeed] Successfully uploaded {tensor_type} tensor: {uploaded_url}")
        return uploaded_url

    except Exception as e:
        print(f"[WaveSpeed] Failed to upload tensor: {e}")
        raise


def is_tensor_or_image(value):
    """Check if value is a tensor or numpy array (image data)"""
    return torch.is_tensor(value) or isinstance(value, np.ndarray)

def is_video_from_file(value):
    """Check if value is a ComfyUI VideoFromFile object."""
    # VideoFromFile is from comfy_api.latest._input_impl.video_types
    return hasattr(value, '__class__') and value.__class__.__name__ == 'VideoFromFile'

def video_from_file_to_path(video_obj):
    """Extract file path from VideoFromFile object."""
    # VideoFromFile has a get_stream_source() method that returns the file path or BytesIO
    if hasattr(video_obj, 'get_stream_source'):
        source = video_obj.get_stream_source()
        # If it's a BytesIO object, we need to save it to a temp file
        if hasattr(source, 'read'):  # BytesIO-like object
            import tempfile
            import os
            # Create temp file with .mp4 extension
            fd, temp_path = tempfile.mkstemp(suffix='.mp4')
            try:
                with os.fdopen(fd, 'wb') as f:
                    source.seek(0)
                    f.write(source.read())
                return temp_path
            except Exception as e:
                os.close(fd)
                raise e
        else:
            # It's a file path string
            return source
    else:
        raise ValueError(f"VideoFromFile object does not have get_stream_source method")

def is_audio_dict(value):
    """Check if value looks like a ComfyUI AUDIO dict."""
    return isinstance(value, dict) and "waveform" in value and "sample_rate" in value

def audio_dict_to_wav_bytes(audio_dict):
    """Convert ComfyUI AUDIO dict to WAV bytes."""
    waveform = audio_dict.get("waveform")
    sample_rate = audio_dict.get("sample_rate", 44100)
    if waveform is None:
        raise ValueError("Audio input missing waveform")

    if torch.is_tensor(waveform):
        data_array = waveform.cpu().numpy()
    else:
        data_array = np.array(waveform)

    # Expected shapes: [B, C, T] or [C, T] or [T]
    if data_array.ndim == 3:
        data_array = data_array[0]
    elif data_array.ndim > 3:
        raise ValueError(f"Unsupported audio waveform shape: {data_array.shape}")

    if data_array.ndim == 2:
        # Heuristic: treat small dimension as channel
        if data_array.shape[0] <= 8 and data_array.shape[1] > data_array.shape[0]:
            data_array = np.mean(data_array, axis=0)
        elif data_array.shape[1] <= 8 and data_array.shape[0] > data_array.shape[1]:
            data_array = np.mean(data_array.T, axis=0)
        else:
            data_array = np.mean(data_array, axis=0)

    if data_array.size == 0:
        raise ValueError("Audio waveform is empty")

    # Normalize to [-1, 1] if needed
    max_val = np.max(np.abs(data_array))
    if max_val > 1.0:
        data_array = data_array / max_val

    audio_data = (data_array * 32767).astype(np.int16)
    buffer = io.BytesIO()
    wavfile.write(buffer, int(sample_rate), audio_data)
    buffer.seek(0)
    return buffer.read()

def try_get_vhs_audio_bytes(value, param_name=None):
    """Attempt to extract WAV bytes from VHS_AUDIO callable."""
    if not callable(value):
        return None
    if isinstance(param_name, str) and "audio" not in param_name.lower():
        return None
    try:
        audio_bytes = value()
    except Exception:
        return None
    if isinstance(audio_bytes, (bytes, bytearray)):
        return bytes(audio_bytes)
    return None

def upload_bytes_to_wavespeed(file_bytes, filename, content_type):
    """Upload raw bytes to WaveSpeed media upload endpoint."""
    api_key = get_api_key_from_config()
    if not api_key:
        raise ValueError("No API key configured. Please configure your WaveSpeed API key.")

    print(f"[WaveSpeed] Uploading {filename} ({len(file_bytes)} bytes)")
    return upload_bytes(file_bytes, filename, content_type, api_key)

def should_force_image_upload(param_name):
    """Force image upload for image-like params (avoid video mp4 uploads)."""
    if not isinstance(param_name, str):
        return False
    lower = param_name.lower()
    if "video" in lower or "audio" in lower:
        return False
    if "image" in lower or "mask" in lower:
        return True
    return False


# AnyType class for universal input/output compatibility
class AnyType(str):
    """
    Universal type that can connect to any input/output.
    Returns False for all inequality checks, making it compatible with any type.
    """
    def __ne__(self, __value: object) -> bool:
        return False


# Create anytype instance
any_typ = AnyType("*")


# ContainsAnyDict class for dynamic inputs
class ContainsAnyDict(dict):
    """
    Special dictionary that accepts any key.
    Used for optional inputs to allow dynamically created inputs from JavaScript.

    Implements both __contains__ (for 'in' checks) and __getitem__ (for dict[key] access)
    to handle ComfyUI's dynamic input system.
    """
    def __contains__(self, key):
        return True

    def __getitem__(self, key):
        # Return a default input specification for any key
        # This allows ComfyUI to accept any parameter name dynamically
        return (any_typ, {})


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
        if isinstance(value, list):
            result = [str(item) for item in value]
        elif isinstance(value, str):
            result = [item.strip() for item in value.split(',') if item.strip()]
        else:
            result = [str(value)]
        print(f"[WaveSpeed] array-str conversion result: {result}")
        return result

    elif param_type == "array-int":
        if isinstance(value, list):
            converted = []
            for item in value:
                try:
                    if isinstance(item, (int, float)):
                        converted.append(item)
                    else:
                        converted.append(float(item))
                except (ValueError, TypeError):
                    converted.append(str(item))
            result = converted
        elif isinstance(value, str):
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
        if isinstance(value, dict):
            if 'path' in value and 'scale' in value:
                result = value
                print(f"[WaveSpeed] lora-weight (structured single object) conversion result: {result}")
                return result
            else:
                print(f"[WaveSpeed] Invalid LoRA object, missing required fields: {value}")
                result = {}
        elif isinstance(value, list):
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
            if len(value) > 0 and isinstance(value[0], dict) and 'path' in value[0] and 'scale' in value[0]:
                result = list(value)
                print(f"[WaveSpeed] lora-weight (WAVESPEED_LORAS) conversion result: {result}")
                return result
            result = list(value)
        elif isinstance(value, str):
            if value.strip().startswith('{') and value.strip().endswith('}'):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, dict):
                        if 'path' not in parsed or 'scale' not in parsed:
                            raise ValueError("LoRA object must have 'path' and 'scale' fields")
                        result = parsed
                        print(f"[WaveSpeed] lora-weight (single JSON string) conversion result: {result}")
                        return result
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"[WaveSpeed] Failed to parse single LoRA JSON: {e}")
                    result = {}
            elif value.strip().startswith('[') and value.strip().endswith(']'):
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
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
                loras = []
                if value.strip():
                    pairs = [pair.strip() for pair in value.split(',') if pair.strip()]
                    for pair in pairs:
                        # Use rsplit to handle URLs containing ':' (e.g., https://example.com/model.safetensors:1.0)
                        # rsplit(':', 1) splits from the right, so the URL stays intact
                        if ':' in pair:
                            path, scale_str = pair.rsplit(':', 1)
                            try:
                                scale = float(scale_str.strip())
                                loras.append({"path": path.strip(), "scale": scale})
                            except ValueError:
                                # scale part is not a number, treat entire string as path
                                loras.append({"path": pair.strip(), "scale": 1.0})
                        else:
                            loras.append({"path": pair.strip(), "scale": 1.0})
                # Return single object (not wrapped in list) to avoid double-nesting
                # when the caller appends the result into an array
                if len(loras) == 1:
                    result = loras[0]
                else:
                    result = loras
        else:
            result = {}
        print(f"[WaveSpeed] lora-weight conversion result: {result}")
        return result

    elif param_type == "number":
        try:
            if isinstance(value, (int, float)):
                result = value
            else:
                result = float(value)
        except (ValueError, TypeError):
            result = value
        print(f"[WaveSpeed] number conversion result: {result}")
        return result

    else:
        # Fallback: Auto-detect LoRA format (URL:scale) for generic string inputs
        # This handles cases where external nodes pass LoRA values but param_type is "string"
        if isinstance(value, str) and value.strip():
            # Try to detect "URL:scale" pattern — use rsplit to preserve URL's own colons
            stripped = value.strip()
            if '://' in stripped:
                # Looks like a URL, check if it ends with :number (scale)
                path, _, maybe_scale = stripped.rpartition(':')
                if path and maybe_scale:
                    try:
                        scale = float(maybe_scale)
                        result = {"path": path, "scale": scale}
                        print(f"[WaveSpeed] Auto-detected LoRA format in fallback. Result: {result}")
                        return result
                    except ValueError:
                        pass

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
            tuple: (task_id, video_url, image, audio_url, text, first_image_url, image_urls, model_3d_url)
        """
        video_url = ""
        images = []
        audio_url = ""
        text = ""
        first_image_url = ""
        image_urls = []
        model_3d_url = ""

        if outputs and len(outputs) > 0:
            for output in outputs:
                if isinstance(output, str):
                    # Handle string outputs (URLs or plain text)
                    output_lower = output.lower()
                    if any(ext in output_lower for ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']):
                        if not video_url:
                            video_url = output
                    elif any(ext in output_lower for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                        try:
                            images.append(output)
                        except Exception as e:
                            print(f"Failed to load image: {e}")
                    elif any(ext in output_lower for ext in ['.mp3', '.wav', '.m4a', '.flac']):
                        if not audio_url:
                            audio_url = output
                    elif any(ext in output_lower for ext in ['.glb', '.gltf', '.obj', '.ply', '.fbx', '.stl']):
                        if not model_3d_url:
                            model_3d_url = output
                    else:
                        if not text and not output.startswith(('http://', 'https://', 'ftp://', 'data:')):
                            text = output
                elif isinstance(output, (dict, list)):
                    # Handle structured data (JSON objects/arrays)
                    # Convert to formatted JSON string for text output
                    if not text:
                        text = json.dumps(output, indent=2, ensure_ascii=False)
                        print(f"[WaveSpeed] Structured output converted to JSON text")
                else:
                    # Handle other types (numbers, booleans, etc.)
                    if not text:
                        text = str(output)

        # CRITICAL FIX: 3D model tasks should NOT convert images to tensor
        # If model_3d_url exists, this is a 3D model task. Even if it returns preview images,
        # we should NOT convert them to tensor (they may have different sizes causing stack errors).
        # Images from 3D model tasks should only be used for UI preview, not tensor conversion.
        # Only image/video model tasks should convert images to tensor.
        has_3d_model = bool(model_3d_url)
        
        if has_3d_model:
            print(f"[WaveSpeed OutputProcessor] 3D model detected: {model_3d_url}")
            print(f"[WaveSpeed OutputProcessor] Skipping image tensor conversion for 3D model task")
            print(f"[WaveSpeed OutputProcessor] Image URLs (for UI preview only): {images}")
            # For 3D model tasks: return image URLs but NO tensor conversion
            image = None
        else:
            # For image/video tasks: convert images to tensor as before
            image = imageurl2tensor(images) if images else None
            
        if images:
            first_image_url = images[0]
            image_urls = images
            
        return (task_id, video_url, image, audio_url, text, first_image_url, image_urls, model_3d_url)


class DynamicRequest:
    """
    Dynamic request class that can handle any API endpoint and parameters
    """

    def __init__(self, api_path: str, request_json: dict):
        self.api_path = api_path
        self.request_json = request_json

    def build_payload(self) -> dict:
        """Build the request payload"""
        return self.request_json

    def get_api_path(self) -> str:
        """Get the API path for this model"""
        return self.api_path


class WaveSpeedAIPredictor:
    """
    WaveSpeed AI Predictor Node - All-in-One Solution

    This node combines model selection, parameter configuration, and task execution
    into a single, user-friendly interface. It provides:

    1. Dynamic model selection (category -> model)
    2. Auto-generated parameters based on model schema
    3. Real-time task execution with progress feedback
    4. Multi-format output (image, video, audio, text)
    5. Smart parameter mapping for node-to-node data passing

    User workflow:
    - Select a model
    - Fill in parameters
    - Wait for results
    """

    def __init__(self):
        pass

    @staticmethod
    def _normalize_media_input(input_data, media_type="generic"):
        """
        Normalize various input formats to a list of URLs

        Supports:
        - Single URL string: "https://..."
        - URL list: ["url1", "url2", "url3"]
        - Comma-separated string: "url1, url2, url3"
        - Mixed formats from multiple nodes
        """
        if not input_data:
            return []

        result = []

        if isinstance(input_data, str):
            # Single URL or comma-separated URLs
            if ',' in input_data:
                # Comma-separated
                result = [url.strip() for url in input_data.split(',') if url.strip()]
            else:
                # Single URL
                if input_data.strip():
                    result = [input_data.strip()]
        elif isinstance(input_data, (list, tuple)):
            # List of URLs
            for item in input_data:
                if isinstance(item, str) and item.strip():
                    result.append(item.strip())
                elif isinstance(item, (list, tuple)):
                    # Nested list
                    result.extend(WaveSpeedAIPredictor._normalize_media_input(item, media_type))
        else:
            # Try to convert to string
            str_val = str(input_data).strip()
            if str_val:
                result = [str_val]

        print(f"[WaveSpeed] Normalized {media_type} input: {len(result)} items")
        return result

    @staticmethod
    def _merge_with_existing(existing, new_list):
        """
        Merge existing parameter value with new input

        Strategy:
        - If existing is empty, use new_list
        - If existing is single value, convert to list and append
        - If existing is list, append to it
        """
        if not existing:
            return new_list[0] if len(new_list) == 1 else new_list

        if isinstance(existing, list):
            return existing + new_list
        else:
            return [existing] + new_list

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": ContainsAnyDict(),  # Allow dynamic inputs from JavaScript
            "hidden": {
                "model_id": ("STRING", {"default": ""}),
                "request_json": ("STRING", {"default": "{}"}),
                "param_map": ("STRING", {"default": "{}"}),
            }
        }

    RETURN_TYPES = (any_typ,)
    RETURN_NAMES = ("output_url",)

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "generate"

    OUTPUT_NODE = False

    def generate(self, model_id="", request_json="{}", param_map="{}", **kwargs):
        """
        All-in-One generation function: create task and execute

        Args:
            model_id: The API path for the model (required, passed via widgets_values)
            request_json: Base request JSON with widget default values
            param_map: Parameter metadata (types, requirements)
            **kwargs: Dynamic parameters from connectable inputs (e.g., prompt="...", seed=123)

        Returns:
            tuple: (output,) - Single anytype output
        """
        print("=" * 80)
        print("[WaveSpeed Predictor] DEBUG: Function called with parameters:")
        print(f"  Connected inputs (kwargs): {list(kwargs.keys())}")
        for key, value in kwargs.items():
            print(f"    {key}: {type(value).__name__} = {str(value)[:100]}")
        print("=" * 80)

        try:
            # Get API key from config
            api_key = get_api_key_from_config()
            if not api_key:
                raise ValueError(
                    "No API key configured. Please go to Settings → WaveSpeed and enter your API key. "
                    "You can get an API key at https://wavespeed.ai"
                )
            # model_id actually contains the api_path from frontend
            api_path = model_id

            # Validate that model_id is provided
            if not api_path or api_path == "":
                print(f"[WaveSpeed Predictor] ERROR: No model selected!")
                raise ValueError("Please select a model first.")

            # Step 1: Parse and build request parameters
            print(f"[WaveSpeed Predictor] Step 1: Parsing parameters for API path {api_path}")

            try:
                request_json_dict = json.loads(request_json) if request_json else {}
            except json.JSONDecodeError:
                request_json_dict = {}

            try:
                param_metadata = json.loads(param_map) if param_map else {}
            except json.JSONDecodeError:
                param_metadata = {}

            print(f"[WaveSpeed Predictor] Connected inputs: {list(kwargs.keys())}")

            # Initialize WaveSpeed client (needed for file uploads in Step 1.5)
            wavespeed_client = WaveSpeedClient(api_key)

            # Step 1.5: Process tensor inputs - upload connected tensors to get URLs
            # Directly check each kwarg for tensor data (covers image/video/audio)
            print(f"[WaveSpeed Predictor] Step 1.5: Checking for tensor inputs...")

            for param_name, param_value in list(kwargs.items()):
                # Check for VideoFromFile objects (ComfyUI video input)
                if is_video_from_file(param_value):
                    print(f"[WaveSpeed Predictor] ✓ Found VideoFromFile for '{param_name}'")
                    try:
                        video_path = video_from_file_to_path(param_value)
                        print(f"[WaveSpeed Predictor] ✓ Extracted video path: {video_path}")
                        
                        # Upload video file to WaveSpeed
                        uploaded_url = wavespeed_client.upload_file_with_type(video_path, "video")
                        kwargs[param_name] = uploaded_url
                        request_json_dict[param_name] = uploaded_url
                        print(f"[WaveSpeed Predictor] ✓ Video uploaded successfully: {uploaded_url}")
                    except Exception as e:
                        print(f"[WaveSpeed Predictor] ✗ Failed to upload video for '{param_name}': {e}")
                        traceback.print_exc()
                        raise ValueError(f"Failed to upload video for '{param_name}': {e}")
                    continue

                # Check for ComfyUI AUDIO dicts
                if is_audio_dict(param_value):
                    print(f"[WaveSpeed Predictor] ✓ Found AUDIO dict for '{param_name}'")
                    try:
                        audio_bytes = audio_dict_to_wav_bytes(param_value)
                        uploaded_url = upload_bytes_to_wavespeed(audio_bytes, "audio_upload.wav", "audio/wav")
                        kwargs[param_name] = uploaded_url
                        request_json_dict[param_name] = uploaded_url
                        print(f"[WaveSpeed Predictor] ✓ AUDIO uploaded successfully: {uploaded_url}")
                    except Exception as e:
                        print(f"[WaveSpeed Predictor] ✗ Failed to upload AUDIO for '{param_name}': {e}")
                        traceback.print_exc()
                        raise ValueError(f"Failed to upload AUDIO for '{param_name}': {e}")
                    continue

                # Check for VHS_AUDIO callable
                vhs_audio_bytes = try_get_vhs_audio_bytes(param_value, param_name)
                if vhs_audio_bytes is not None:
                    print(f"[WaveSpeed Predictor] ✓ Found VHS_AUDIO for '{param_name}'")
                    try:
                        uploaded_url = upload_bytes_to_wavespeed(vhs_audio_bytes, "vhs_audio_upload.wav", "audio/wav")
                        kwargs[param_name] = uploaded_url
                        request_json_dict[param_name] = uploaded_url
                        print(f"[WaveSpeed Predictor] ✓ VHS_AUDIO uploaded successfully: {uploaded_url}")
                    except Exception as e:
                        print(f"[WaveSpeed Predictor] ✗ Failed to upload VHS_AUDIO for '{param_name}': {e}")
                        traceback.print_exc()
                        raise ValueError(f"Failed to upload VHS_AUDIO for '{param_name}': {e}")
                    continue

                # Check if this value is a tensor (works for image/video/audio tensors)
                if is_tensor_or_image(param_value):
                    print(f"[WaveSpeed Predictor] ✓ Found tensor for parameter '{param_name}'")
                    print(f"  - tensor type: {type(param_value).__name__}")
                    print(f"  - tensor shape: {param_value.shape if hasattr(param_value, 'shape') else 'N/A'}")

                    try:
                        print(f"[WaveSpeed Predictor] ✓ Uploading tensor for '{param_name}'...")
                        force_type = "image" if should_force_image_upload(param_name) else None
                        uploaded_url = upload_tensor_to_wavespeed(param_value, force_type=force_type)
                        # Update both kwargs and request_json_dict with uploaded URL
                        kwargs[param_name] = uploaded_url
                        request_json_dict[param_name] = uploaded_url
                        print(f"[WaveSpeed Predictor] ✓ Tensor uploaded successfully: {uploaded_url}")
                    except Exception as e:
                        print(f"[WaveSpeed Predictor] ✗ Failed to upload tensor for '{param_name}': {e}")
                        traceback.print_exc()
                        raise ValueError(f"Failed to upload tensor for '{param_name}': {e}")

            print(f"[WaveSpeed Predictor] Step 1.5 completed.")

            # Step 2a: Identify and merge array parameters
            # Array parameters are split into multiple inputs (image_0, image_1, image_2...)
            # We need to merge them back into arrays (images: ["url0", "url1", "url2"])
            array_params = {}
            for param_name, param_info in param_metadata.items():
                if isinstance(param_info, dict) and param_info.get('isArray'):
                    array_params[param_name] = param_info

            print(f"[WaveSpeed Predictor] Detected array parameters: {list(array_params.keys())}")

            # Merge array member inputs
            for array_param_name, array_info in array_params.items():
                # Determine singular form: images -> image
                if array_param_name.endswith('s'):
                    singular_prefix = array_param_name[:-1]
                else:
                    singular_prefix = array_param_name

                # Find all matching array member inputs
                # Support both formats: image0, image1 (no underscore) and image_0, image_1 (with underscore)
                array_members = []
                
                # Pattern matches: image0, image1, image_0, image_1, etc.
                pattern = re.compile(f'^{re.escape(singular_prefix)}_?(\\d+)$')

                # Search both kwargs (connected inputs) and request_json_dict (widget values)
                # Widget-uploaded values (no connection) are stored in request_json_dict as image_0, image_1, etc.
                combined_sources = {}
                combined_sources.update(request_json_dict)  # Widget values first (lower priority)
                combined_sources.update(kwargs)  # Connected inputs override (higher priority)

                matched_keys = []  # Track matched keys for cleanup

                for key, value in combined_sources.items():
                    match = pattern.match(key)
                    if match:
                        try:
                            # Extract index from key
                            index = int(match.group(1))

                            # Skip empty values
                            if value is None or value == '':
                                print(f"[WaveSpeed Predictor] Skipping empty value for {key}")
                                continue

                            array_members.append((index, value))
                            matched_keys.append(key)
                            print(f"[WaveSpeed Predictor] Found array member {key} = {value}")

                        except (ValueError, IndexError) as e:
                            print(f"[WaveSpeed Predictor] Failed to parse array member key {key}: {e}")
                            pass

                # Remove individual array member keys from request_json_dict
                # to avoid sending both "images" and "image_0" in the request
                for key in matched_keys:
                    request_json_dict.pop(key, None)

                # Sort by index
                array_members.sort(key=lambda x: x[0])

                # Extract values and convert types
                array_values = []
                for index, value in array_members:
                    if is_audio_dict(value):
                        print(f"[WaveSpeed Predictor] Detected AUDIO input for {singular_prefix}{index}, uploading...")
                        try:
                            audio_bytes = audio_dict_to_wav_bytes(value)
                            uploaded_url = upload_bytes_to_wavespeed(audio_bytes, "audio_upload.wav", "audio/wav")
                            array_values.append(uploaded_url)
                            print(f"[WaveSpeed Predictor] AUDIO uploaded successfully: {uploaded_url}")
                        except Exception as e:
                            print(f"[WaveSpeed Predictor] Failed to upload AUDIO for {singular_prefix}{index}: {e}")
                        continue

                    vhs_audio_bytes = try_get_vhs_audio_bytes(value, f"{singular_prefix}{index}")
                    if vhs_audio_bytes is not None:
                        print(f"[WaveSpeed Predictor] Detected VHS_AUDIO input for {singular_prefix}{index}, uploading...")
                        try:
                            uploaded_url = upload_bytes_to_wavespeed(vhs_audio_bytes, "vhs_audio_upload.wav", "audio/wav")
                            array_values.append(uploaded_url)
                            print(f"[WaveSpeed Predictor] VHS_AUDIO uploaded successfully: {uploaded_url}")
                        except Exception as e:
                            print(f"[WaveSpeed Predictor] Failed to upload VHS_AUDIO for {singular_prefix}{index}: {e}")
                        continue

                    # Check if value is a tensor (needs upload)
                    if is_tensor_or_image(value):
                        print(f"[WaveSpeed Predictor] Detected tensor input for {singular_prefix}{index}, uploading...")
                        try:
                            param_name = f"{singular_prefix}{index}"
                            force_type = "image" if should_force_image_upload(param_name) else None
                            uploaded_url = upload_tensor_to_wavespeed(value, force_type=force_type)
                            array_values.append(uploaded_url)
                            print(f"[WaveSpeed Predictor] Tensor uploaded successfully: {uploaded_url}")
                        except Exception as e:
                            print(f"[WaveSpeed Predictor] Failed to upload tensor for {singular_prefix}{index}: {e}")
                            # Continue with next item instead of failing the whole request
                            continue
                    else:
                        # Type conversion for non-tensor values
                        # Auto-detect LoRA parameters by name and force lora-weight type
                        item_type = array_info.get('itemType', 'string')
                        if item_type == 'string' and array_param_name.lower().replace('_', '').replace('-', '').find('lora') >= 0:
                            item_type = 'lora-weight'
                            print(f"[WaveSpeed Predictor] Auto-detected LoRA parameter '{array_param_name}', using lora-weight type")
                        converted = convert_parameter_value(value, item_type)
                        if converted:
                            array_values.append(converted)
                            print(f"[WaveSpeed Predictor] Converted {singular_prefix}{index}: {converted}")

                # Merge into request parameters
                if array_values:
                    request_json_dict[array_param_name] = array_values
                    print(f"[WaveSpeed Predictor] Merged array parameter '{array_param_name}': {len(array_values)} items")
                    print(f"  Final values: {array_values}")
                else:
                    # No values provided, check if there's a default value
                    if array_param_name in request_json_dict:
                        print(f"[WaveSpeed Predictor] Using default value for '{array_param_name}': {request_json_dict[array_param_name]}")
                    else:
                        print(f"[WaveSpeed Predictor] No values provided for '{array_param_name}'")

            # Step 2b: Merge connected inputs (kwargs) with UI widget values
            # Priority: kwargs (connected inputs) > request_json_dict (UI widgets)
            print(f"[WaveSpeed Predictor] Step 2b: Merging connected inputs with UI values")

            # Start with UI widget values
            merged_params = dict(request_json_dict)

            # Add/override with connected inputs from kwargs
            for param_name, param_value in kwargs.items():
                # Skip if already processed as array parameter
                if any(param_name.startswith(arr_name.rstrip('s') + '_') for arr_name in array_params.keys()):
                    continue

                # Add non-empty values from kwargs
                if param_value is not None and param_value != '':
                    merged_params[param_name] = param_value
                    print(f"[WaveSpeed Predictor] Added from input: {param_name} = {param_value}")

            # Filter out empty values to avoid API validation errors
            print(f"[WaveSpeed Predictor] Final request parameters ready")
            filtered_params = {}
            for key, value in merged_params.items():
                # Skip empty strings, empty lists, None (but keep 0 and False)
                if value == '' or value == [] or value is None:
                    continue
                filtered_params[key] = value

            print(f"[WaveSpeed Predictor] Filtered parameters: {filtered_params}")

            # Handle size parameters: if size_width or size_height exists in kwargs (from connections),
            # use them to override the corresponding component in the size parameter
            size_params = {}
            for key in list(filtered_params.keys()):
                if key.endswith('_width') or key.endswith('_height'):
                    size_name = key.rsplit('_', 1)[0]
                    if size_name not in size_params:
                        size_params[size_name] = {}
                    component = key.rsplit('_', 1)[1]
                    size_params[size_name][component] = filtered_params[key]
            
            # Process each size parameter
            for size_name, components in size_params.items():
                has_width = 'width' in components
                has_height = 'height' in components
                
                # Get the base size parameter from UI (should be in format "width*height")
                base_size = filtered_params.get(size_name, '')
                
                if base_size:
                    # Parse base size to get UI values
                    try:
                        ui_width, ui_height = base_size.split('*')
                        ui_width = int(ui_width.strip())
                        ui_height = int(ui_height.strip())
                    except:
                        # If parsing fails, use connected values or raise error
                        if has_width and has_height:
                            ui_width = components['width']
                            ui_height = components['height']
                        else:
                            raise ValueError(f"Size parameter '{size_name}': Cannot parse UI size value '{base_size}'")
                    
                    # Override with connected values if available
                    final_width = components.get('width', ui_width)
                    final_height = components.get('height', ui_height)
                    
                    # Update size parameter with final values
                    filtered_params[size_name] = f"{final_width}*{final_height}"
                    
                    # Remove component parameters (they were only for overriding)
                    filtered_params.pop(f'{size_name}_width', None)
                    filtered_params.pop(f'{size_name}_height', None)
                    
                    print(f"[WaveSpeed Predictor] Size parameter '{size_name}': width={final_width} (from {'connection' if has_width else 'UI'}), height={final_height} (from {'connection' if has_height else 'UI'})")
                else:
                    # No base size from UI, must have both components from connections
                    if has_width and has_height:
                        final_width = components['width']
                        final_height = components['height']
                        filtered_params[size_name] = f"{final_width}*{final_height}"
                        filtered_params.pop(f'{size_name}_width', None)
                        filtered_params.pop(f'{size_name}_height', None)
                        print(f"[WaveSpeed Predictor] Size parameter '{size_name}': {final_width}*{final_height} (both from connections)")
                    else:
                        raise ValueError(f"Size parameter '{size_name}': No UI size value and incomplete connection values")

            # Step 2: Submit task to API
            print(f"[WaveSpeed Predictor] Step 2: Submitting task to API")

            dynamic_request = DynamicRequest(api_path, filtered_params)

            print(f"[WaveSpeed Predictor] Submitting to API path: {api_path}")

            # Step 3: Wait for task completion
            print(f"[WaveSpeed Predictor] Step 3: Waiting for task completion...")

            response = wavespeed_client.send_request(
                dynamic_request,
                wait_for_completion=True,
                polling_interval=5,
                timeout=1800  # 30 minutes timeout for long-running tasks (video generation, etc.)
            )

            if not response:
                raise ValueError("No response from API")

            # Step 4: Process outputs - Smart single output
            print(f"[WaveSpeed Predictor] Step 4: Processing outputs")

            task_id = response.get("id", "")
            status = response.get("status", "completed")
            raw_outputs = response.get("outputs", [])

            print(f"[WaveSpeed Predictor] Task {task_id} completed with status: {status}")
            print(f"[WaveSpeed Predictor] Raw outputs: {raw_outputs}")

            # Smart output selection
            output = self._select_smart_output(raw_outputs)

            print(f"[WaveSpeed Predictor] Smart output selected: {type(output).__name__} = {output if not isinstance(output, (list, dict)) else f'{type(output).__name__}[{len(output)}]'}")
            print(f"[WaveSpeed Predictor] Generation completed successfully!")

            return (output,)

        except Exception as e:
            error_message = str(e)
            print(f"[WaveSpeed Predictor] Error: {error_message}")
            raise Exception(f"WaveSpeedAIPredictor failed: {error_message}")

    def _select_smart_output(self, raw_outputs):
        """
        Smart output selection based on content type.

        CRITICAL: For 3D model tasks (outputs contain .obj/.glb/etc.):
        - Return FULL list (images + 3D models) for Preview node to detect
        - Preview node will show both image preview + 3D preview (cumulative)
        - Preview node will NOT convert images to tensor for 3D tasks

        Priority for non-3D tasks: Video > Images > Audio > Text

        Args:
            raw_outputs: List of outputs from API

        Returns:
            Single output (anytype): URL string, list of URLs, or text
        """
        if not raw_outputs:
            return None

        # Single output: return directly as URL (do NOT convert to tensor)
        if len(raw_outputs) == 1:
            output = raw_outputs[0]
            print(f"[WaveSpeed] Output: {output}")
            return output

        # CRITICAL CHECK: If outputs contain 3D model, return FULL list
        # This allows Preview node to detect it's a 3D task and skip tensor conversion
        has_3d_model = any(isinstance(o, str) and self._is_3d_model_url(o) for o in raw_outputs)

        if has_3d_model:
            # 3D model task: return full list (images + 3D models)
            print(f"[WaveSpeed] Output: 3D model task - returning full list ({len(raw_outputs)} items)")
            print(f"[WaveSpeed] Items: {raw_outputs}")
            return raw_outputs

        # Non-3D tasks: prioritize by type
        # Priority 1: Video
        for output in raw_outputs:
            if isinstance(output, str) and self._is_video_url(output):
                return output

        # Priority 2: Images (return as URL string or list of URLs, do NOT convert to tensor)
        image_urls = [o for o in raw_outputs
                      if isinstance(o, str) and self._is_image_url(o)]
        if image_urls:
            result = image_urls[0] if len(image_urls) == 1 else image_urls
            print(f"[WaveSpeed] Output: Image URL(s) - {len(image_urls)} image(s)")
            return result

        # Priority 3: Audio
        for output in raw_outputs:
            if isinstance(output, str) and self._is_audio_url(output):
                return output

        # Priority 4: Text or other types
        # Return first non-URL output or first output
        for output in raw_outputs:
            if not isinstance(output, str) or not output.startswith(('http://', 'https://')):
                return output

        # Fallback: return first output
        return raw_outputs[0]

    @staticmethod
    def _is_video_url(url):
        """Check if URL is a video"""
        if not isinstance(url, str):
            return False
        url_lower = url.lower()
        return any(ext in url_lower for ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm'])

    @staticmethod
    def _is_image_url(url):
        """Check if URL is an image"""
        if not isinstance(url, str):
            return False
        url_lower = url.lower()
        return any(ext in url_lower for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'])

    @staticmethod
    def _is_audio_url(url):
        """Check if URL is audio"""
        if not isinstance(url, str):
            return False
        url_lower = url.lower()
        return any(ext in url_lower for ext in ['.mp3', '.wav', '.m4a', '.flac'])

    @staticmethod
    def _is_3d_model_url(url):
        """Check if URL is a 3D model"""
        if not isinstance(url, str):
            return False
        url_lower = url.lower()
        return any(ext in url_lower for ext in ['.glb', '.gltf', '.obj', '.ply', '.fbx', '.stl', '.usdz', '.dae', '.3ds'])


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAIPredictor": WaveSpeedAIPredictor,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAIPredictor": "WaveSpeedAI Predictor⚡",
}
