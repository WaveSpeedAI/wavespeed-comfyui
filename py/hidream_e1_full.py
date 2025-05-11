from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.hidream_e1_full import HidreamE1Full

class HidreamE1FullNode:
    """
    ComfyUI Node for HiDream-E1 Full API.
    """

    @classmethod
    def INPUT_TYPES(s):
        """
        Defines the input types for the node based on HidreamE1FullRequest.
        """
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Input prompt for image editing."}),
                "image_url": ("STRING", {"tooltip": "The image to edit.", "forceInput": False}),
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
                seed=-1,
                image_url=None,
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = HidreamE1Full(
            prompt=prompt,
            image=image_url,
            seed=seed,
            enable_safety_checker=enable_safety_checker,
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
    "WaveSpeedAI HidreamE1FullNode": HidreamE1FullNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI HidreamE1FullNode": "WaveSpeedAI Hidream E1 Full"
}