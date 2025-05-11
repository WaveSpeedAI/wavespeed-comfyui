from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.instant_character import InstantCharacter as InstantCharacterRequest

class InstantCharacterNode:
    """
    ComfyUI node for the InstantCharacter API.
    """
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text description of the image to generate"}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative text description of the image to generate"}),
                "image_url": ("STRING", {"tooltip": "The image URL to generate an image from. Needs to match the dimensions of the mask.", "forceInput": False}),
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
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale for generation (0.0 to 10.0)"
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
    RETURN_NAMES = ("image", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt,
                negative_prompt,
                width=1024,
                height=1024,
                seed=-1,
                num_images=1,
                num_inference_steps=28,
                guidance_scale=3.5,
                image_url=None,
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = InstantCharacterRequest(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=image_url,
            width=width,
            height=height,
            enable_safety_checker=enable_safety_checker,
            guidance_scale=guidance_scale,
            num_images=num_images,
            num_inference_steps=num_inference_steps,
            seed=seed,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 1)

        image_urls = response.get("outputs", [])
        if not image_urls:
            raise ValueError("No image URLs in the generated result")

        images = imageurl2tensor(image_urls)
        return (images,)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI InstantCharacterNode": InstantCharacterNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI InstantCharacterNode": "WaveSpeedAI Instant Character"
}
