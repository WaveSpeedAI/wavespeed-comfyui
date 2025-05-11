from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.kwaivgi_kling_v1_6_t2v_standard import KwaivgiKlingV1x6T2vStandard

class KwaivgiKlingV16T2VStandardNode:
    """
    Kwaivgi Kling V1.6 Text-to-Video Standard Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
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
                negative_prompt,
                duration,
                guidance_scale):
        
        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = KwaivgiKlingV1x6T2vStandard(
            prompt=prompt,
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
    "WaveSpeedAI KwaivgiKlingV16T2VStandardNode": KwaivgiKlingV16T2VStandardNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI KwaivgiKlingV16T2VStandardNode": "WaveSpeedAI Kling v1.6 T2V Standard"
}