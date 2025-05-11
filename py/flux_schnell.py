from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.flux_schnell import FluxSchnell

class FluxSchnellNode:
    """
    Flux Image Generator Node (Schnell)

    This node uses WaveSpeed AI's Flux model (schnell) to generate high-quality images.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Input prompt for image generation."}),
                "image_url": ("STRING", {"tooltip": "Image for image variation", "forceInput": False}),
                "mask_image_url": ("STRING", {"tooltip": "Mask image for controlled generation", "forceInput": False}),
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
                    "step": 0.01,
                    "display": "number",
                    "tooltip": "Transform strength."
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed (-1=random)."
                }),
                "num_images": ("INT", {
                    "default": 1,
                    "min": 1,
                    "max": 4,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Images to generate."
                }),
                "num_inference_steps": ("INT", {
                    "default": 4,
                    "min": 1,
                    "max": 8,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Inference steps."
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 3.5,
                    "min": 0.0,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "CFG scale."
                }),
            },
            "optional": {
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Enable safety checker."
                }),
            }
        }

    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("image", )

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
            num_inference_steps=4,
            guidance_scale=3.5,
            image_url=None,
            mask_image_url=None,
            enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = FluxSchnell(
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
    "WaveSpeedAI FluxSchnellNode": FluxSchnellNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI FluxSchnellNode": "WaveSpeedAI Flux Schnell"
}