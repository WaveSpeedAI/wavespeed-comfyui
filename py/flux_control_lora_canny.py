from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.flux_control_lora_canny import FluxControlLoraCanny


class FluxControlLoraCannyNode:
    """
    Flux Control LoRA Canny Image Generator Node

    This node uses WaveSpeed AI's Flux model with Control LoRA (Canny) to generate images.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to generate an image from."}),
                "width": ("INT", {
                    "default": 864,
                    "min": 512,
                    "max": 1536,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Image width (512 to 1536)"
                }),
                "height": ("INT", {
                    "default": 1536,
                    "min": 512,
                    "max": 1536,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Image height (512 to 1536)"
                }),
                "control_image_url": ("STRING", {"tooltip": "The URL to use for control lora (Canny edge map).", "forceInput": False}),
                "control_scale": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.0,
                    "max": 2.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The scale of the control image (0.0 to 2.0)"
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
                    "min": 1.0,
                    "max": 30.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale (1.0 to 30.0)"
                }),
            },
            "optional": {
                "loras": ("WAVESPEED_LORAS", {"tooltip": "List of LoRA models to apply (max 5 items)"}),
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Enable safety checker"
                }),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt,
                width=864,
                height=1536,
                control_scale=1.0,
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

        request = FluxControlLoraCanny(
            prompt=prompt,
            control_image=control_image_url,
            control_scale=control_scale,
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

        # Download and process images
        image_urls = response.get("outputs", [])
        if not image_urls:
            raise ValueError("No image URLs in the generated result")

        images = imageurl2tensor(image_urls)
        return (images,)


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI FluxControlLoraCannyNode": FluxControlLoraCannyNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI FluxControlLoraCannyNode": "WaveSpeedAI Flux Control LoRA Canny"
}
