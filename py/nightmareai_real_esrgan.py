from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.nightmareai_real_esrgan import NightmareaiRealEsrgan
from .wavespeed_api.utils import imageurl2tensor

class NightmareAIRealESRGANNode:
    """
    ComfyUI Node for NightmareAI Real-ESRGAN API.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "image_url": ("STRING", {"tooltip": "Input image URL", "forceInput": False}),
                "guidance_scale": ("FLOAT", {
                    "default": 4,
                    "min": 0.0,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Factor to scale image by (0.0 to 10.0)"
                }),
            },
            "optional": {
                "face_enhance": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Run GFPGAN face enhancement"
                }),
            }
        }

    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("image", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                guidance_scale=4,
                image_url=None,
                face_enhance=False):

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = NightmareaiRealEsrgan(
            image=image_url,
            guidance_scale=guidance_scale,
            face_enhance=face_enhance
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 1)

        image_urls = response.get("outputs", [])
        if not image_urls:
            raise ValueError("No image URLs in the generated result")

        images = imageurl2tensor(image_urls)
        return (images,)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI NightmareAIRealESRGANNode": NightmareAIRealESRGANNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI NightmareAIRealESRGANNode": "WaveSpeedAI Real-ESRGAN"
}