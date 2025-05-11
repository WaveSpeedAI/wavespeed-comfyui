from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.flux_dev_fill import FluxDevFill


class FluxDevFillNode:
    """
    Flux Dev Fill Node

    This node uses WaveSpeed AI's Flux Dev Fill model to modify existing images.
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
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "The same seed and the same prompt given to the same version of the model will output the same image every time. -1 for random seed"
                }),
                "num_images": ("INT", {
                    "default": 1,
                    "min": 1,
                    "max": 4,  # Assuming max 4 images based on other nodes
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
                    "default": 30.0,
                    "min": 0.0,
                    "max": 100.0,  # Assuming a reasonable max based on typical scales, adjust if needed
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you."
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
    RETURN_NAMES = ("image", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt,
                width=1024,
                height=1024,
                seed=-1,
                num_images=1,
                num_inference_steps=28,
                guidance_scale=30.0,
                image_url=None,
                mask_image_url=None,
                loras=None,
                enable_safety_checker=True):
        request = FluxDevFill(
            prompt=prompt,
            image=image_url,
            mask_image=mask_image_url,
            enable_safety_checker=enable_safety_checker,
            guidance_scale=guidance_scale,
            loras=loras,
            num_images=num_images,
            num_inference_steps=num_inference_steps,
            seed=seed,
            width=width,
            height=height,
        )

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 1)

        image_urls = response.get("outputs", [])
        if not image_urls:
            raise ValueError("No image URLs in the generated result")

        images = imageurl2tensor(image_urls)
        return (images,)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI FluxDevFillNode": FluxDevFillNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI FluxDevFillNode": "WaveSpeedAI Flux Dev Fill"
}
