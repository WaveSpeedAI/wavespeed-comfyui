from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.kwaivgi_kling_v2_1_i2v_standard import KwaivgiKlingV2x1I2vStandard

class KwaivgiKlingV21I2vStandardNode:
    """
    Kwaivgi Kling V2.1 Image-to-Video Standard Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "image": ("STRING", {"multiline": False, "default": "", "tooltip": "URL of the input image"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for generation; Positive text prompt; Cannot exceed 2500 characters"}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative text prompt; Cannot exceed 2500 characters"}),
                "duration": ("INT", {
                    "default": 5,
                    "min": 5,
                    "max": 10,
                    "step": 5,
                    "display": "number",
                    "tooltip": "Generate video duration length seconds."
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 0.5,
                    "min": 0.0,
                    "max": 1,
                    "step": 0.01,
                    "display": "number",
                    "tooltip": "Guidance scale for generation (0.0 to 1.0)"
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
                image,
                prompt,
                negative_prompt,
                duration,
                guidance_scale):
        
        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")
            
        if image is None or image == "":
            raise ValueError("Image URL is required")

        request = KwaivgiKlingV2x1I2vStandard(
            prompt=prompt,
            image=image,
            negative_prompt=negative_prompt,
            duration=duration,
            guidance_scale=guidance_scale,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI KwaivgiKlingV21I2vStandardNode": KwaivgiKlingV21I2vStandardNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI KwaivgiKlingV21I2vStandardNode": "WaveSpeedAI Kling v2.1 I2V Standard"
} 