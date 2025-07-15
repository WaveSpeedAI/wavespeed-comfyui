from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.wavespeed_ai_veo2_i2v import WavespeedAiVeo2I2v

class WavespeedAiVeo2I2vNode:
    """
    WaveSpeed AI Veo2 Image-to-Video Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "image": ("STRING", {"multiline": False, "default": "", "tooltip": "URL of the input image"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for generation; Cannot exceed 2500 characters"}),
                "aspect_ratio": (["16:9", "9:16"], {
                    "default": "16:9",
                    "tooltip": "Aspect ratio of the output video"
                }),
                "duration": (["5s","6s", "7s", "8s"], {
                    "default": "5s",
                    "tooltip": "Generate video duration length in seconds"
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
                aspect_ratio,
                duration):
        
        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")
            
        if image is None or image == "":
            raise ValueError("Image URL is required")

        request = WavespeedAiVeo2I2v(
            prompt=prompt,
            image=image,
            aspect_ratio=aspect_ratio,
            duration=duration,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 5)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI Veo2I2vNode": WavespeedAiVeo2I2vNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI Veo2I2vNode": "WaveSpeedAI Veo2 I2V"
} 