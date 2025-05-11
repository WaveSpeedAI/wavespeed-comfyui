from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.magi_1_24b import Magi124b


class Magi124bNode:
    """
    MAGI-1 Video Generator Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The text prompt to guide video generation."}),
                "image_url": ("STRING", {"tooltip": "URL of an input image to represent the first frame of the video. If the input image does not match the chosen aspect ratio, it is resized and center cropped.", "forceInput": False}),
                "resolution": (["480p", "720p"], {
                    "default": "720p",
                    "tooltip": "Resolution of the generated video (480p or 720p). 480p is 0.5 billing units, and 720p is 1 billing unit."
                }),
                "aspect_ratio": (["auto", "16:9", "9:16", "1:1"], {
                    "default": "auto",
                    "tooltip": "Aspect ratio of the generated video. If 'auto', the aspect ratio will be determined automatically based on the input image."
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducibility. -1 for random seed"
                }),
                "num_frames": ("INT", {
                    "default": 96,
                    "min": 96,
                    "max": 192,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of frames to generate. Must be between 96 to 192 (inclusive)."
                }),
                "frames_per_second": ("INT", {
                    "default": 24,
                    "min": 5,
                    "max": 30,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Frames per second of the generated video. Must be between 5 to 30."
                }),

            },
            "optional": {
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "If set to true, the safety checker will be enabled."
                }),

            }
        }

    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("video_url", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt,
                image_url=None,
                resolution="720p",
                aspect_ratio="auto",
                seed=-1,
                num_frames=96,
                frames_per_second=24,
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = Magi124b(
            prompt=prompt,
            image=image_url,
            num_frames=num_frames,
            frames_per_second=frames_per_second,
            seed=seed,
            resolution=resolution,
            enable_safety_checker=enable_safety_checker,
            aspect_ratio=aspect_ratio,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI Magi124bNode": Magi124bNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI Magi124bNode": "WaveSpeedAI Magi 1.24b"
}
