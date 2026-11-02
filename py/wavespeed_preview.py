"""
WaveSpeed AI Universal Preview Node

Automatically detects input type (image/video/audio/3D/text) and displays appropriate preview.
Supports URL detection via Content-Type when extension is missing.
Outputs tensor for compatibility with ComfyUI native nodes.
"""

import re
import io
import requests
import torch
import numpy as np
from PIL import Image
import tempfile
import os
import cv2
from fractions import Fraction
from comfy_api.latest._input_impl.video_types import VideoFromComponents
from comfy_api.latest._util import VideoComponents
from .wavespeed_api.utils import imageurl2tensor, safe_request


class WaveSpeedAIPreview:
    """
    WaveSpeed AI Universal Preview Node

    Automatically detects and previews any media type from WaveSpeed AI Generate node.
    Supports: Image, Video, Audio, 3D Model, Text
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "input_url": ("*", {
                    "forceInput": True,
                    "tooltip": "Connect output from WaveSpeed AI Generate node"
                }),
            }
        }

    OUTPUT_NODE = True
    RETURN_TYPES = ("IMAGE", "VIDEO")
    RETURN_NAMES = ("image", "video")

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "preview_universal"

    def preview_universal(self, input_url):
        """
        Universal preview function that auto-detects media type

        Args:
            input_url: Can be URL string, list of URLs, or text content

        Returns:
            UI message with media data for frontend display + tensor output
        """
        result = {
            "ui": {},
            "result": (None, None)  # Default: no image/video output
        }

        # Handle None or empty input
        if input_url is None or input_url == '':
            print("[WaveSpeed Preview] No input provided")
            return result

        print(f"[WaveSpeed Preview] Input type: {type(input_url).__name__}")
        print(f"[WaveSpeed Preview] Input value: {input_url if not isinstance(input_url, (list, dict)) else f'{type(input_url).__name__}[{len(input_url)}]'}")

        output_image = None  # Will hold IMAGE tensor output
        output_video = None  # Will hold VIDEO output

        # Case 1: List of URLs (multiple images)
        if isinstance(input_url, list):
            # Filter out non-string items
            url_list = [item for item in input_url if isinstance(item, str) and item.strip()]

            if not url_list:
                print("[WaveSpeed Preview] Empty list provided")
                return result

            # CRITICAL FIX: Check if list contains 3D model URLs
            # If 3D model URLs exist, this is a 3D model task output.
            # 3D model tasks should NOT convert images to tensor, even if they return preview images.
            # Images from 3D model tasks should only be used for UI preview, not tensor conversion.
            has_3d_model = any(self._is_3d_model_url(url) for url in url_list)
            image_urls = [url for url in url_list if self._is_image_url(url)]
            model_3d_urls = [url for url in url_list if self._is_3d_model_url(url)]

            if has_3d_model:
                # 3D model task: Separate images and 3D model, do NOT convert images to tensor
                print(f"[WaveSpeed Preview] 3D model task detected: {len(model_3d_urls)} 3D model(s), {len(image_urls)} preview image(s)")
                
                # Prepare UI data for both images and 3D models (they are cumulative)
                media_data_items = []
                
                # Add image previews (if any)
                if image_urls:
                    if len(image_urls) > 1:
                        media_data_items.append({
                            "type": "image_gallery",
                            "urls": image_urls
                        })
                        print(f"[WaveSpeed Preview] Added image gallery with {len(image_urls)} images (no tensor conversion)")
                    else:
                        media_data_items.append({
                            "type": "image",
                            "url": image_urls[0]
                        })
                        print(f"[WaveSpeed Preview] Added single image preview: {image_urls[0]} (no tensor conversion)")
                
                # Add 3D model previews (if any)
                for model_url in model_3d_urls:
                    media_data_items.append({
                        "type": "3d",
                        "url": model_url
                    })
                    print(f"[WaveSpeed Preview] Added 3D model preview: {model_url}")
                
                result["ui"]["media_data"] = media_data_items
                # DO NOT convert images to tensor for 3D model tasks
                output_image = None
            else:
                # Regular image/video task: use existing logic
                # Check if all items are image URLs
                all_images = all(self._is_image_url(url) for url in url_list)

                if all_images and len(url_list) > 1:
                    # Multiple images - show gallery
                    print(f"[WaveSpeed Preview] Detected image gallery: {len(url_list)} images")
                    result["ui"]["media_data"] = [{
                        "type": "image_gallery",
                        "urls": url_list
                    }]
                    # Convert to tensor (only for non-3D tasks)
                    output_image = imageurl2tensor(url_list)
                else:
                    # Single item or mixed types - use first item
                    input_url = url_list[0]
                    print(f"[WaveSpeed Preview] Using first item from list: {input_url}")
                    # Continue to URL detection below

        # Case 2: String (URL or text)
        if isinstance(input_url, str):
            input_url = input_url.strip()

            # Check if it's a URL
            if input_url.startswith(('http://', 'https://')):
                # Detect media type from URL
                media_type = self._detect_media_type_from_url(input_url)

                print(f"[WaveSpeed Preview] Detected media type: {media_type}")
                print(f"[WaveSpeed Preview] URL: {input_url}")

                result["ui"]["media_data"] = [{
                    "type": media_type,
                    "url": input_url
                }]

                # Convert to tensor based on media type
                # CRITICAL: 3D model URLs should NOT trigger tensor conversion
                if media_type == "3d":
                    # 3D model: return URL only, no tensor conversion
                    output_image = None
                    print(f"[WaveSpeed Preview] 3D model URL detected, skipping tensor conversion")
                elif media_type == "image":
                    # Regular image: convert to tensor (only for non-3D tasks)
                    output_image = imageurl2tensor([input_url])
                elif media_type == "video":
                    output_video = self._videourl2video(input_url)
                else:
                    # Other types (audio, text, etc.): no tensor
                    output_image = None
            else:
                # Plain text content
                print(f"[WaveSpeed Preview] Detected text content: {len(input_url)} characters")
                result["ui"]["media_data"] = [{
                    "type": "text",
                    "content": input_url
                }]

        # Case 3: Other types (convert to text)
        elif not isinstance(input_url, list):
            text_content = str(input_url)
            print(f"[WaveSpeed Preview] Converting to text: {type(input_url).__name__}")
            result["ui"]["media_data"] = [{
                "type": "text",
                "content": text_content
            }]

        # Set output tensor
        result["result"] = (output_image, output_video)

        return result

    def _detect_media_type_from_url(self, url):
        """
        Detect media type from URL
        Priority: Extension check → Content-Type check → Fallback to text

        Args:
            url: Media URL

        Returns:
            Media type: 'image', 'video', 'audio', '3d', or 'text'
        """
        url_lower = url.lower()

        # Check by file extension first (fast)
        if self._is_video_url(url):
            return 'video'
        elif self._is_image_url(url):
            return 'image'
        elif self._is_audio_url(url):
            return 'audio'
        elif self._is_3d_model_url(url):
            return '3d'

        # No extension found - try Content-Type detection
        print(f"[WaveSpeed Preview] No extension detected, checking Content-Type...")
        content_type = self._get_content_type(url)

        if content_type:
            print(f"[WaveSpeed Preview] Content-Type: {content_type}")

            if content_type.startswith('video/'):
                return 'video'
            elif content_type.startswith('image/'):
                return 'image'
            elif content_type.startswith('audio/'):
                return 'audio'
            elif content_type.startswith('model/') or 'gltf' in content_type or 'glb' in content_type:
                return '3d'
            elif content_type.startswith('text/'):
                return 'text'

        # Fallback: treat as text/unknown
        print(f"[WaveSpeed Preview] Could not detect type, treating as text")
        return 'text'

    def _get_content_type(self, url):
        """
        Get Content-Type from URL via HTTP HEAD request

        Args:
            url: Media URL

        Returns:
            Content-Type string or None
        """
        try:
            response = safe_request("HEAD", url, timeout=5)
            content_type = response.headers.get('Content-Type', '').lower()
            return content_type
        except Exception as e:
            print(f"[WaveSpeed Preview] Failed to get Content-Type: {e}")
            return None

    @staticmethod
    def _is_video_url(url):
        """Check if URL is a video"""
        if not isinstance(url, str):
            return False
        url_lower = url.lower()
        return any(ext in url_lower for ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'])

    @staticmethod
    def _is_image_url(url):
        """Check if URL is an image"""
        if not isinstance(url, str):
            return False
        url_lower = url.lower()
        return any(ext in url_lower for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'])

    @staticmethod
    def _is_audio_url(url):
        """Check if URL is audio"""
        if not isinstance(url, str):
            return False
        url_lower = url.lower()
        return any(ext in url_lower for ext in ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.aac'])

    @staticmethod
    def _is_3d_model_url(url):
        """Check if URL is a 3D model"""
        if not isinstance(url, str):
            return False
        url_lower = url.lower()
        return any(ext in url_lower for ext in ['.glb', '.gltf', '.obj', '.ply', '.fbx', '.stl', '.usdz', '.dae', '.3ds'])

    def _videourl2video(self, video_url):
        """
        Convert video URL to ComfyUI VideoInput

        Args:
            video_url: Video URL string

        Returns:
            VideoFromComponents: ComfyUI video input
        """
        try:
            # Download video to temporary file
            print(f"[WaveSpeed Preview] Downloading video from {video_url}")
            response = safe_request("GET", video_url, stream=True, timeout=30)
            response.raise_for_status()

            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
                temp_path = temp_file.name
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)

            # Read video with cv2
            cap = cv2.VideoCapture(temp_path)
            frames = []

            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(frame_rgb)

            cap.release()

            # Clean up temporary file
            try:
                os.unlink(temp_path)
            except:
                pass

            if not frames:
                print("[WaveSpeed Preview] No frames extracted from video")
                return None

            print(f"[WaveSpeed Preview] Extracted {len(frames)} frames from video")

            # Convert to tensor: (frames, height, width, channels)
            frames_array = np.array(frames, dtype=np.float32) / 255.0
            print(f"[WaveSpeed Preview] frames_array shape: {frames_array.shape}")
            print(f"[WaveSpeed Preview] frames_array dtype: {frames_array.dtype}")
            
            frames_tensor = torch.from_numpy(frames_array)
            print(f"[WaveSpeed Preview] frames_tensor shape: {frames_tensor.shape}")
            print(f"[WaveSpeed Preview] frames_tensor dtype: {frames_tensor.dtype}")
            
            components = VideoComponents(
                images=frames_tensor,
                audio=None,
                frame_rate=Fraction(30)
            )
            return VideoFromComponents(components)

        except Exception as e:
            print(f"[WaveSpeed Preview] Failed to convert video URL to video input: {e}")
            return None


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI Preview": WaveSpeedAIPreview,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI Preview": "WaveSpeedAI Preview ⚡",
}
