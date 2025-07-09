# -*- coding: utf-8 -*-
from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.flux_controlnet_union_pro2_0 import FluxControlnetUnionPro2_0Request, LoraWeightItem

class FluxControlnetUnionPro2_0Node:
    """
    WaveSpeed AI Flux ControlNet Union Pro 2.0 Node

    This node uses WaveSpeed AI's Flux ControlNet Union Pro 2.0 model.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to generate an image from."}),
                "width": ("INT", {
                    "default": 864,
                    "min": 256,
                    "max": 1536,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Image width (256 to 1536)"
                }),
                "height": ("INT", {
                    "default": 1536,
                    "min": 256,
                    "max": 1536,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Image height (256 to 1536)"
                }),
                "control_image_url": ("STRING", {"tooltip": "The URL to use for control lora (depth map).", "forceInput": False}),
                "controlnet_conditioning_scale": ("FLOAT", {
                    "default": 0.7,
                    "min": 0.0,
                    "max": 2.0,
                    "step": 0.01,
                    "display": "number",
                    "tooltip": "The scale of the controlnet conditioning (0.0 to 2.0)."
                }),
                "control_guidance_start": ("FLOAT", {
                    "default": 0.0,
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.01,
                    "display": "number",
                    "tooltip": "The start of the control guidance (0.0 to 1.0)."
                }),
                "control_guidance_end": ("FLOAT", {
                    "default": 0.8,
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.01,
                    "display": "number",
                    "tooltip": "The end of the control guidance (0.0 to 1.0)."
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "The same seed and the same prompt given to the same version of the model will output the same image every time. -1 for random seed."
                }),
                "num_images": ("INT", {
                    "default": 1,
                    "min": 1,
                    "max": 4,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of images to generate (1 to 4)"
                }),
                "num_inference_steps": ("INT", {
                    "default": 28,
                    "min": 1,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of inference steps (1 to 50)"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 3.5,
                    "min": 0.0,
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The CFG scale (0.0 to 20.0)."
                }),
            },
            "optional": {
                "loras": ("WAVESPEED_LORAS", {"tooltip": "List of LoRAs to apply (max 5)"}),
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "If set to true, the safety checker will be enabled."
                }),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt,
                width=864,
                height=1536,
                controlnet_conditioning_scale=0.7,
                control_guidance_start=0.0,
                control_guidance_end=0.8,
                seed=-1,
                num_images=1,
                num_inference_steps=28,
                guidance_scale=3.5,
                control_image_url=None,
                loras=None,
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if control_image_url is None or control_image_url == "":
            raise ValueError("Control image URL is required")

        request = FluxControlnetUnionPro2_0Request(
            prompt=prompt,
            control_image=control_image_url,
            controlnet_conditioning_scale=controlnet_conditioning_scale,
            control_guidance_start=control_guidance_start,
            control_guidance_end=control_guidance_end,
            enable_safety_checker=enable_safety_checker,
            guidance_scale=guidance_scale,
            loras=loras,
            num_images=num_images,
            num_inference_steps=num_inference_steps,
            seed=seed,
            width=width,
            height=height,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 1)

        image_urls = response.get("outputs", [])
        if not image_urls:
            raise ValueError("No image URLs in the generated result")

        images = imageurl2tensor(image_urls)
        return (images,)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI FluxControlnetUnionPro2_0Node": FluxControlnetUnionPro2_0Node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI FluxControlnetUnionPro2_0Node": "WaveSpeedAI Flux ControlNet Union Pro 2.0"
}