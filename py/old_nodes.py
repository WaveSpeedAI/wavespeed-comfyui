from .old_wavespeed_api import WaveSpeedAPI
from .wavespeed_api.utils import imageurl2tensor, tensor2images, encode_image, fetch_image, decode_image, images2tensor
import base64
import io
import os
import re
import numpy
import PIL
import requests
import torch
from collections.abc import Iterable
import configparser
import folder_paths
import time
from typing import List, Dict, Any, Tuple, Optional, Union

# Deprecated
class FluxImage2Image:
    """
    Flux Image Generator Node

    This node uses WaveSpeed AI's Flux model to generate high-quality images.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "model": (["flux-dev", "flux-schnell"], {"tooltip": "Model name, choose from flux-dev or flux-schnell"}),
                "image_url": ("STRING", {"multiline": False, "default": "", "tooltip": "Image URL for image-to-image generation"}),
                "strength": ("FLOAT", {
                    "default": 0.6,
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Strength of the image-to-image transformation (0.0 to 1.0)"
                }),
            },
            "optional": {
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text description of the image to generate"}),
                "loras": ("WAVESPEED_LORAS", {"tooltip": "List of LoRA models to apply (max 5 items)"}),
                "width": ("INT", {
                    "default": 1024,
                    "min": 512,
                    "max": 1536,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Image width (512 to 1536)"
                }),
                "height": ("INT", {
                    "default": 1024,
                    "min": 512,
                    "max": 1536,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Image height (512 to 1536)"
                }),
                "num_inference_steps": ("INT", {
                    "default": 28,
                    "min": 1,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of inference steps for dev models (1 to 50)"
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible results. -1 for random seed"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 5.0,
                    "min": 0.0,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale for generation (0.0 to 10.0)"
                }),
                "num_images": ("INT", {
                    "default": 1,
                    "min": 1,
                    "max": 4,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of images to generate (1 to 4)"
                }),
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Enable safety checker for generated content"
                }),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image", )

    FUNCTION = "generate"

    CATEGORY = "WaveSpeedAI"

    def generate(self,
                 client,
                 model,
                 image_url,
                 strength,
                 prompt="",
                 loras=None,
                 width=1024,
                 height=1024,
                 num_inference_steps=28,
                 seed=-1,
                 guidance_scale=5.0,
                 num_images=1,
                 enable_safety_checker=True):
        """
        Generate images using the Flux model

        Args:
            client: WaveSpeed AI API client
            model: Model name
            image_url: Input image for image-to-image generation
            strength: Strength of image-to-image transformation (0.0 to 1.0)
            prompt: Text prompt
            loras: List of LoRA models (max 5)
            width: Image width (512 to 1536)
            height: Image height (512 to 1536)
            num_inference_steps: Number of inference steps (1 to 50)
            seed: Random seed, -1 for random seed
            guidance_scale: Generation guidance scale (0.0 to 10.0)
            num_images: Number of images to generate (1 to 4)
            enable_safety_checker: Whether to enable safety checker

        Returns:
            tuple: (Generated image)
        """
        try:
            real_client = WaveSpeedAPI(api_key=client["api_key"])
            response = real_client.flux_generate_image(
                model=model,
                prompt=prompt,
                image=image_url,
                strength=strength,
                loras=loras,
                width=width,
                height=height,
                num_inference_steps=num_inference_steps,
                seed=seed,
                guidance_scale=guidance_scale,
                num_images=num_images,
                enable_safety_checker=enable_safety_checker,
                wait_for_completion=True
            )
            # Download and process images
            image_urls = response.get("outputs", [])
            if not image_urls:
                raise ValueError("No image URLs in the generated result")

            images = []
            for url in image_urls:
                image_data = fetch_image(url)
                image = decode_image(image_data)
                images.append(image)

            # Convert to tensor
            tensor = images2tensor(images)
            return (tensor,)
        except Exception as e:
            raise e

# Deprecated
class FluxText2Image:
    """
    Flux Image Generator Node

    This node uses WaveSpeed AI's Flux model to generate high-quality images.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "model": (["flux-dev", "flux-schnell"], {"tooltip": "Model name, choose from flux-dev or flux-schnell"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text description of the image to generate"}),
            },
            "optional": {
                "loras": ("WAVESPEED_LORAS", {"tooltip": "List of LoRA models to apply (max 5 items)"}),
                "width": ("INT", {
                    "default": 1024,
                    "min": 512,
                    "max": 1536,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Image width (512 to 1536)"
                }),
                "height": ("INT", {
                    "default": 1024,
                    "min": 512,
                    "max": 1536,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Image height (512 to 1536)"
                }),
                "num_inference_steps": ("INT", {
                    "default": 28,
                    "min": 1,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of inference steps for dev models (1 to 50)"
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible results. -1 for random seed"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 5.0,
                    "min": 0.0,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale for generation (0.0 to 10.0)"
                }),
                "num_images": ("INT", {
                    "default": 1,
                    "min": 1,
                    "max": 4,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of images to generate (1 to 4)"
                }),
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Enable safety checker for generated content"
                }),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image", )

    FUNCTION = "generate"

    CATEGORY = "WaveSpeedAI"

    def generate(self,
                 client,
                 model,
                 prompt,
                 loras=None,
                 width=1024,
                 height=1024,
                 num_inference_steps=28,
                 seed=-1,
                 guidance_scale=5.0,
                 num_images=1,
                 enable_safety_checker=True):
        """
        Generate images using the Flux model

        Args:
            client: WaveSpeed AI API client
            model: Model name
            prompt: Text prompt
            loras: List of LoRA models (max 5)
            width: Image width (512 to 1536)
            height: Image height (512 to 1536)
            num_inference_steps: Number of inference steps (1 to 50)
            seed: Random seed, -1 for random seed
            guidance_scale: Generation guidance scale (0.0 to 10.0)
            num_images: Number of images to generate (1 to 4)
            enable_safety_checker: Whether to enable safety checker

        Returns:
            tuple: (Generated image,)
        """
        try:
            real_client = WaveSpeedAPI(api_key=client["api_key"])
            response = real_client.flux_generate_image(
                model=model,
                prompt=prompt,
                loras=loras,
                width=width,
                height=height,
                num_inference_steps=num_inference_steps,
                seed=seed,
                guidance_scale=guidance_scale,
                num_images=num_images,
                enable_safety_checker=enable_safety_checker,
                wait_for_completion=True
            )

            # Download and process images
            image_urls = response.get("outputs", [])
            if not image_urls:
                raise ValueError("No image URLs in the generated result")

            images = []
            for url in image_urls:
                image_data = fetch_image(url)
                image = decode_image(image_data)
                images.append(image)

            # Convert to tensor
            tensor = images2tensor(images)
            return (tensor,)
        except Exception as e:
            raise e

# Deprecated
class WanText2VideoNode:
    """
    Wan Text to Video Node

    This node uses WaveSpeed AI's Wan T2V model to generate videos from text prompts.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "model": (["wan-2.1/t2v-720p", "wan-2.1/t2v-480p", "wan-2.1/t2v-720p-ultra-fast", "wan-2.1/t2v-480p-ultra-fast"],),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt to guide video generation"}),
            },
            "optional": {
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative prompt to specify what to avoid in the video"}),
                "size": (["None", "720*1280", "1280*720", "480*832", "832*480"], {"tooltip": "Video dimensions in width x height format. 480p: 832*480 or 480*832, 720p: 1280*720 or 720*1280"}),
                "loras": ("WAVESPEED_LORAS", {"tooltip": "List of LoRA models to apply (maximum 3)"}),
                "num_inference_steps": ("INT", {
                    "default": 30,
                    "min": 1,
                    "max": 40,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of inference steps"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 5.0,
                    "min": 0.0,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale for generation"
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible results. -1 for random seed"
                }),
                "enable_safety_checker": ("BOOLEAN", {"default": True, "tooltip": "Enable safety checker for generated content"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("url",)

    FUNCTION = "generate"

    CATEGORY = "WaveSpeedAI"

    def generate(self,
                 client,
                 model,
                 prompt,
                 negative_prompt="",
                 size="",
                 loras=None,
                 num_inference_steps=30,
                 guidance_scale=5.0,
                 seed=-1,
                 enable_safety_checker=True):
        """
        Generate video from text prompt

        Args:
            client: WaveSpeed AI API client
            model: Model name
            prompt: Text prompt to guide video generation
            negative_prompt: Negative prompt to specify what to avoid in the video
            size: Video dimensions in width*height format
            loras: List of LoRA models to apply (max 3)
            num_inference_steps: Number of inference steps
            guidance_scale: Guidance scale for generation
            seed: Random seed for reproducible results. -1 for random seed
            enable_safety_checker: Enable safety checker for generated content

        Returns:
            tuple: (video_url,)
        """
        if size == "None":
            size = None
        try:
            real_client = WaveSpeedAPI(api_key=client["api_key"])
            response = real_client.wan_text_to_video(
                model=model,
                prompt=prompt,
                negative_prompt=negative_prompt,
                loras=loras,
                size=size,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                seed=seed,
                enable_safety_checker=enable_safety_checker,
                wait_for_completion=True
            )

            video_url = response.get("video_url", "")

            return (video_url,)
        except Exception as e:
            raise e

# Deprecated
class WanImage2VideoNode:
    """
    Wan Image to Video Node

    This node uses WaveSpeed AI's Wan I2V model to generate videos from image.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "model": (["wan-2.1/i2v-720p", "wan-2.1/i2v-480p", "wan-2.1/i2v-720p-ultra-fast", "wan-2.1/i2v-480p-ultra-fast"],),
                "image_url": ("STRING", {"multiline": False, "default": "", "tooltip": "Image URL for video generation"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt to guide video generation"}),
            },
            "optional": {
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative prompt to specify what to avoid in the video"}),
                "size": (["None", "720*1280", "1280*720", "480*832", "832*480"], {"tooltip": "Video dimensions in width x height format. 480p: 832*480 or 480*832, 720p: 1280*720 or 720*1280"}),
                "loras": ("WAVESPEED_LORAS", {"tooltip": "List of LoRA models to apply (maximum 3)"}),
                "num_inference_steps": ("INT", {
                    "default": 30,
                    "min": 1,
                    "max": 40,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of inference steps"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 5.0,
                    "min": 0.0,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale for generation"
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible results. -1 for random seed"
                }),
                "enable_safety_checker": ("BOOLEAN", {"default": True, "tooltip": "Enable safety checker for generated content"}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("url",)

    FUNCTION = "generate"

    CATEGORY = "WaveSpeedAI"

    def generate(self,
                 client,
                 model,
                 image_url,
                 prompt,
                 negative_prompt="",
                 size="",
                 loras=None,
                 num_inference_steps=30,
                 guidance_scale=5.0,
                 seed=-1,
                 enable_safety_checker=True):
        """
        Generate video from image and text prompt

        Args:
            client: WaveSpeed AI API client
            model: Model name
            image_url: Input image
            prompt: Text prompt to guide video generation
            negative_prompt: Negative prompt to specify what to avoid in the video
            size: Video dimensions in width*height format
            loras: List of LoRA models to apply (max 3)
            num_inference_steps: Number of inference steps
            guidance_scale: Guidance scale for generation
            seed: Random seed for reproducible results. -1 for random seed
            enable_safety_checker: Enable safety checker for generated content

        Returns:
            tuple: (video_url,)
        """
        try:
            if size == "None":
                size = None
            real_client = WaveSpeedAPI(api_key=client["api_key"])
            response = real_client.wan_image_to_video(
                model=model,
                image=image_url,
                prompt=prompt,
                negative_prompt=negative_prompt,
                loras=loras,
                size=size,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                seed=seed,
                enable_safety_checker=enable_safety_checker,
                wait_for_completion=True
            )

            video_url = response.get("video_url", "")

            return (video_url,)
        except Exception as e:
            print(f"Generation failed: {str(e)}")
            raise e

# Deprecated
class MinimaxImage2VideoNode:
    """
    Minimax Image to Video Node

    This node uses Minimax AI's Image to Video model to generate videos from images.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "model": (["minimax/video-01"],),
                "first_frame_image": ("STRING", {"multiline": False, "default": "", "tooltip": "URL of the image to use as the first frame of the video"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text description of the video content to generate"}),
            },
            "optional": {
                "prompt_optimizer": ("BOOLEAN", {"default": False, "tooltip": "Whether to automatically optimize the prompt for better results"}),
                "subject_reference": ("STRING", {"multiline": False, "default": "", "tooltip": "URL of an image containing the subject to reference for consistent appearance"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("video_url", "task_id")

    FUNCTION = "generate"

    CATEGORY = "MinimaxAI"

    def generate(self,
                 client,
                 model,
                 first_frame_image,
                 prompt,
                 prompt_optimizer=False,
                 subject_reference=""):
        """
        Generate video from image and text prompt

        Args:
            client: Minimax AI API client
            model: Model name
            first_frame_image: URL of the image to use as the first frame of the video
            prompt: Text description of the video content to generate
            prompt_optimizer: Whether to automatically optimize the prompt for better results
            subject_reference: URL of an image containing the subject to reference for consistent appearance

        Returns:
            tuple: (video_url, task_id)
        """
        try:
            real_client = WaveSpeedAPI(api_key=client["api_key"])
            response = real_client.minimax_image_to_video(
                model=model,
                first_frame_image=first_frame_image,
                prompt=prompt,
                prompt_optimizer=prompt_optimizer,
                subject_reference=subject_reference,
                wait_for_completion=True
            )

            video_url = response.get("video_url", "")

            return (video_url,)
        except Exception as e:
            print(f"Generation failed: {str(e)}")
            raise e


NODE_CLASS_MAPPINGS = {
    'WaveSpeedAI Wan Text2Video': WanText2VideoNode,
    'WaveSpeedAI Wan Image2Video': WanImage2VideoNode,
    'WaveSpeedAI Flux Text2Image': FluxText2Image,
    'WaveSpeedAI Flux Image2Image': FluxImage2Image,
    'WaveSpeedAI Minimax Image2Video': MinimaxImage2VideoNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    'WaveSpeedAI Wan Text2Video': 'WaveSpeedAI Wan Text2Video OldVersion@Deprecated',
    'WaveSpeedAI Wan Image2Video': 'WaveSpeedAI Wan Image2Video OldVersion@Deprecated',
    'WaveSpeedAI Flux Text2Image': 'WaveSpeedAI Flux Text2Image OldVersion@Deprecated',
    'WaveSpeedAI Flux Image2Image': 'WaveSpeedAI Flux Image2Image OldVersion@Deprecated',
    'WaveSpeedAI Minimax Image2Video': 'WaveSpeedAI Minimax Image2Video OldVersion@Deprecated',
}
