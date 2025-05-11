from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.hidream_i1_full import HidreamI1Full


class HidreamI1FullNode:
    """
    ComfyUI Node for HiDream-I1 Full API.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text description of the image to full edit."}),
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
            width=1024,
            height=1024,
            seed=-1,
            enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = HidreamI1Full(
            prompt=prompt,
            width=width,
            height=height,
            seed=seed,
            enable_safety_checker=enable_safety_checker
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
    "WaveSpeedAI HidreamI1FullNode": HidreamI1FullNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI HidreamI1FullNode": "WaveSpeedAI Hidream I1 Full"
}
