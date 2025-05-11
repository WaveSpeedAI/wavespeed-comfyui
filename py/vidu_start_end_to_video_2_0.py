from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.vidu_start_end_to_video_2_0 import ViduStartEndToVideo20


class ViduStartEndToVideo20Node:
    """
    ComfyUI Node for Vidu Start/End to Video 2.0 API.
    """
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for video generation (max 1500 characters)"}),
                "start_image_url": ("STRING", {"tooltip": "Start image URL to be used as a reference for the generated video.", "forceInput": False}),
                "end_image_url": ("STRING", {"tooltip": "End image URL to be used as a reference for the generated video.", "forceInput": False}),
                "aspect_ratio": (["16:9", "9:16", "1:1"], {
                    "default": "16:9",
                    "tooltip": "The aspect ratio of the output video. Defaults to 16:9, accepted: 16:9 9:16 1:1."
                }),
                "duration": ("INT", {
                    "default": 4,
                    "min": 4,
                    "max": 8,  # API doc says only 4 accepted for vidu2.0
                    "step": 4,
                    "display": "number",
                    "tooltip": "The number of seconds of duration for the output video (only 4 accepted for vidu2.0)"
                }),
                "movement_amplitude": (["auto", "small", "medium", "large"], {
                    "default": "auto",
                    "tooltip": "The movement amplitude of objects in the frame. Defaults to auto, accepted value: auto, small, medium, large."
                }),
                "seed": ("INT", {
                    "default": 0,
                    "min": 0,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "The seed to use for generating the video. 0 for random seed."
                }),
            },
            "optional": {
            }
        }

    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("video_url", )

    FUNCTION = "execute"
    CATEGORY = "WaveSpeedAI"

    def execute(self,
                client,
                prompt,
                aspect_ratio="16:9",
                duration=4,
                movement_amplitude="auto",
                seed=0,
                start_image_url=None,
                end_image_url=None):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if start_image_url is None or start_image_url == "":
            raise ValueError("Start image URL is required")

        if end_image_url is None or end_image_url == "":
            raise ValueError("End image URL is required")

        request = ViduStartEndToVideo20(
            images=[start_image_url, end_image_url],
            prompt=prompt,
            aspect_ratio=aspect_ratio,
            duration=duration,
            movement_amplitude=movement_amplitude,
            seed=seed
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI ViduStartEndToVideo20Node": ViduStartEndToVideo20Node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI ViduStartEndToVideo20Node": "WaveSpeedAI Vidu Start/End To Video2.0"
}