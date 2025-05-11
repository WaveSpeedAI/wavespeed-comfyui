from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.vidu_reference_to_video_2_0 import ViduReferenceToVideo20

class ViduReferenceToVideo20Node:
    """
    Vidu Reference To Video 2.0 Node

    This node uses WaveSpeed AI's Vidu model to generate videos based on reference images and a prompt.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "image_urls": ("STRING", {"tooltip": "Images to be used as a reference for the generated video. max 3 images"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for video generation (max 1500 characters)"}),
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

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                image_urls,
                prompt: str,
                aspect_ratio: str = "16:9",
                duration: int = 4,
                movement_amplitude: str = "auto",
                seed: int = 0):
        if image_urls is None:
            raise ValueError("image_urls must be provided")

        # Check if image_urls is a list
        if not isinstance(image_urls, list):
            image_urls = [image_urls]
        
        # Ensure we have at most 3 image URLs
        images_param = image_urls[:3]

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = ViduReferenceToVideo20(
            images=images_param,
            prompt=prompt,
            aspect_ratio=aspect_ratio,
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
    "WaveSpeedAI ViduReferenceToVideo20Node": ViduReferenceToVideo20Node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI ViduReferenceToVideo20Node": "WaveSpeedAI Vidu Reference To Video2.0"
}