from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.vidu_image_to_video_2_0 import ViduImageToVideo2x0

class ViduImageToVideo20Node:
    """
    Vidu Image to Video 2.0 Node

    This node uses WaveSpeed AI's Vidu model to generate videos from an image and prompt.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for video generation (max 1500 characters)"}),
                "image_url": ("STRING", {"tooltip": "An image URL to be used as the start frame of the generated video.", "forceInput": False}),
                "duration": ("INT", {
                    "default": 4,
                    "min": 4,
                    "max": 8,
                    "step": 4,
                    "display": "number",
                    "tooltip": "The number of seconds of duration for the output video (4 or 8)"
                }),
                "movement_amplitude": (["auto", "small", "medium", "large"], {
                    "default": "auto",
                    "tooltip": "The movement amplitude of objects in the frame."
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,  # Using a large max value similar to other nodes
                    "control_after_generate": True,
                    "tooltip": "The seed to use for generating the video. -1 for random seed."
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
                duration=4,
                movement_amplitude="auto",
                seed=-1,
                image_url=None):
        
        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = ViduImageToVideo2x0(
            image=image_url,
            prompt=prompt,
            duration=duration,
            movement_amplitude=movement_amplitude,
            seed=seed,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI ViduImageToVideo20Node": ViduImageToVideo20Node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI ViduImageToVideo20Node": "WaveSpeedAI Vidu Image to Video2.0"
}