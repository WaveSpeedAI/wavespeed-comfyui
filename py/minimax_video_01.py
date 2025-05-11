from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.minimax_video_01 import MinimaxVideo01

class MinimaxVideo01Node:
    """
    Minimax Video Generation Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Generate a description of the video."}),
                "image_url": ("STRING", { "tooltip": "Image for image-to-video generation (used as the first frame)", "forceInput": False}),
            },
            "optional": {
                "enable_prompt_expansion": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "The model automatically optimizes incoming prompts to improve build quality."
                }),
            }
        }

    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("video_url", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt: str,
                image_url=None,
                enable_prompt_expansion: bool = True):
      
        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = MinimaxVideo01(
            prompt=prompt,
            image=image_url,
            enable_prompt_expansion=enable_prompt_expansion,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI MinimaxVideo01Node": MinimaxVideo01Node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI MinimaxVideo01Node": "WaveSpeedAI Minimax Video 01"
}