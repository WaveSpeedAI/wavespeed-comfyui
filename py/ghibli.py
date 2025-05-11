from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.ghibli import Ghibli

class GhibliNode:
    """
    Ghibli Style Image Transformation Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "image_url": ("STRING", { "tooltip": "The image to transform into Ghibli style", "forceInput": False}),
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
                image_url=None,
                enable_safety_checker=True):

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = Ghibli(
            image=image_url,
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
    "WaveSpeedAI GhibliNode": GhibliNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI GhibliNode": "WaveSpeedAI Ghibli"
}