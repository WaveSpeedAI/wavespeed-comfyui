from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.sky_reels_v1 import SkyReelsV1

class SkyReelsV1Node:
    """
    SkyReels V1 Video Generator Node

    This node uses WaveSpeed AI's SkyReels V1 model to generate videos from an image and prompt.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to generate the video from."}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative prompt to guide generation away from certain attributes."}),
                "image_url": ("STRING", {"tooltip": "Image URL for image-to-video generation", "forceInput": False}),
                "aspect_ratio": (["16:9", "9:16"], {"default": "16:9", "tooltip": "Aspect ratio of the output video"}),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible results. -1 for random seed"
                }),
                "num_inference_steps": ("INT", {
                    "default": 30,
                    "min": 1,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of denoising steps (between 1 and 50). Higher values give better quality but take longer."
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 6.0,
                    "min": 1.0,
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale for generation (between 1.0 and 20.0)"
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
                negative_prompt="",
                aspect_ratio="16:9",
                seed=-1,
                num_inference_steps=30,
                guidance_scale=6.0,
                image_url=None):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

      
        request = SkyReelsV1(
            prompt=prompt,
            image=image_url,
            negative_prompt=negative_prompt,
            aspect_ratio=aspect_ratio,
            seed=seed,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI SkyReelsV1Node": SkyReelsV1Node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI SkyReelsV1Node": "WaveSpeedAI SkyReels V1"
}