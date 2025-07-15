from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.google_veo3 import GoogleVeo3

class GoogleVeo3Node:
    """
    Google Veo3 Text-to-Video Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for generation; Cannot exceed 2500 characters"}),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible results. -1 for random seed"
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
                seed=-1):
        
        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = GoogleVeo3(
            prompt=prompt,
            seed=seed
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI GoogleVeo3Node": GoogleVeo3Node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI GoogleVeo3Node": "WaveSpeedAI Google Veo3"
} 