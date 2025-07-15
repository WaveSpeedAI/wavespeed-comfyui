from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.google_veo3_fast import GoogleVeo3Fast


class GoogleVeo3FastNode:
    """
    Google Veo3 Fast Text-to-Video Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for generation; Cannot exceed 2500 characters"}),
                "negative_prompt":  ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for generation; Cannot exceed 2500 characters"}),
                "aspect_ratio": (["16:9", "1:1", "9:16"], {
                    "default": "16:9",
                    "tooltip": "Aspect ratio of the output video"
                }),
                "duration": ("INT", {
                    "default": 8,
                    "min": 8,
                    "max": 8,
                    "step": 8,
                    "display": "number",
                    "tooltip": "Video duration in seconds"
                }),
                "enable_prompt_expansion": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Whether to enable prompt expansion"
                }),
                "generate_audio": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Whether to generate audio for the video"
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
                aspect_ratio,
                duration,
                enable_prompt_expansion,
                generate_audio,
                seed):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = GoogleVeo3Fast(
            prompt=prompt,
            negative_prompt=negative_prompt,
            aspect_ratio=aspect_ratio,
            duration=duration,
            enable_prompt_expansion=enable_prompt_expansion,
            generate_audio=generate_audio,
            seed=seed
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 5)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI GoogleVeo3FastNode": GoogleVeo3FastNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI GoogleVeo3FastNode": "WaveSpeedAI Google Veo3 Fast"
}
