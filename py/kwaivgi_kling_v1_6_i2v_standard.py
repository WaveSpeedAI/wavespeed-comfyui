from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.kwaivgi_kling_v1_6_i2v_standard import KwaivgiKlingV16I2vStandard

class KwaivgiKlingV16I2vStandardNode:
    """
    Kwaivgi Kling V1.6 Image to Video Standard Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for generation; Positive text prompt; Cannot exceed 2500 characters"}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative text prompt; Cannot exceed 2500 characters"}),
                "image_url": ("STRING", {"tooltip": "First frame of the video; Supported image formats include.jpg/.jpeg/.png; The image file size cannot exceed 10MB, and the image resolution should not be less than 300*300px, and the aspect ratio of the image should be between 1:2.5 ~ 2.5:1", "forceInput": False}),
                "duration": ("INT", {
                    "default": 5,
                    "min": 5,
                    "max": 10,
                    "step": 5,
                    "display": "number",
                    "tooltip": "Generate video duration length seconds."
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
            }
        }

    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("video_url", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt,
                negative_prompt="",
                duration=5,
                guidance_scale=3.5,
                image_url=None):
        
        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = KwaivgiKlingV16I2vStandard(
            prompt=prompt,
            negative_prompt=negative_prompt,
            duration=duration,
            guidance_scale=guidance_scale,
            image=image_url
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI KwaivgiKlingV16I2VStandardNode": KwaivgiKlingV16I2vStandardNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI KwaivgiKlingV16I2VStandardNode": "WaveSpeedAI Kling v1.6 I2V Standard"
}