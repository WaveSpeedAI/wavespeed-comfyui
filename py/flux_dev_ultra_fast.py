from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.flux_dev_ultra_fast import FluxDevUltraFast

class FluxDevUltraFastNode:
    """
    Flux Dev Ultra Fast Image Generator Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to generate an image from."}),
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
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Strength indicates extent to transform the reference image"
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
                    "tooltip": "The number of images to generate."
                }),
                "num_inference_steps": ("INT", {
                    "default": 28,
                    "min": 1,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The number of inference steps to perform."
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 3.5,
                    "min": 1.0,
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The CFG (Classifier Free Guidance) scale..."
                }),
            },
            "optional": {
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
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = FluxDevUltraFast(
            prompt=prompt,
            image=image_url,
            mask_image=mask_image_url,
            strength=strength,
            enable_safety_checker=enable_safety_checker,
            guidance_scale=guidance_scale,
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
    "WaveSpeedAI FluxDevUltraFastNode": FluxDevUltraFastNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI FluxDevUltraFastNode": "WaveSpeedAI Flux Dev Ultra Fast"
}