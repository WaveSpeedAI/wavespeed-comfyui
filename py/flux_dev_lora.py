from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.flux_dev_lora import FluxDevLora


class FluxDevLoraNode:
    """
    Flux Image Generator Node (Dev)

    This node uses WaveSpeed AI's Flux model to generate high-quality images with LoRA support.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text description of the image to generate"}),
                "image_url": ("STRING", {"tooltip": "The image to generate an image from.", "forceInput": False}),
                "mask_image_url": ("STRING", {"tooltip": "The mask image to generate an image from.", "forceInput": False}),
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
                "strength": ("FLOAT", {
                    "default": 0.8,
                    "min": 0.01,
                    "max": 1.0,
                    "step": 0.01,
                    "display": "number",
                    "tooltip": "Strength of the image-to-image transformation (0.01 to 1.0)"
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible results. -1 for random seed"
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
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale for generation (0.0 to 10.0)"
                }),
            },
            "optional": {
                "loras": ("WAVESPEED_LORAS", {"tooltip": "List of LoRA models to apply (max 5 items)"}),
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Enable safety checker for generated content"
                }),
            }
        }

    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("image",)

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt,
                width=1024,
                height=1024,
                strength=0.8,
                seed=-1,
                num_images=1,
                num_inference_steps=28,
                guidance_scale=3.5,
                image_url=None,
                mask_image_url=None,
                loras=None,
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = FluxDevLora(
            prompt=prompt,
            image=image_url,
            mask_image=mask_image_url,
            strength=strength,
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
    "WaveSpeedAI FluxDevLoraNode": FluxDevLoraNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI FluxDevLoraNode": "WaveSpeedAI Flux Dev Lora"
}