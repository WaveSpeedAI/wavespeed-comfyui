from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.ltx_video_v097_i2v_480p import LtxVideoV097I2V480p

class LtxVideoV097I2V480pNode:
    """
    LTX Video I2V 480p Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt to guide generation"}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative prompt for generation"}),
                "image_url": ("STRING", {"tooltip": "Image URL for Image-to-Video task", "forceInput": False}),
                "size": (["832*480", "480*832"], {"default": "832*480", "tooltip": "The size of the output."}),
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
                prompt: str,
                negative_prompt: str = "",
                size: str = "832*480",
                seed: int = -1,
                image_url=None):
   
        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = LtxVideoV097I2V480p(
            image=image_url,
            prompt=prompt,
            negative_prompt=negative_prompt,
            size=size,
            seed=seed,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI LtxVideoV097I2V480pNode": LtxVideoV097I2V480pNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI LtxVideoV097I2V480pNode": "WaveSpeedAI LTX Video I2V 480p"
}