from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.ltx_video_v097_i2v_720p import LtxVideoV097I2V720p

class LtxVideoV097I2V720pNode:
    """
    LTX Video v0.9.7 I2V 720p Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt to guide generation"}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative prompt for generation"}),
                "image_url": ("STRING", {"tooltip": "Image URL for Image-to-Video task", "forceInput": False}),
                "size": (["1280*720", "720*1280"], {"default": "1280*720", "tooltip": "The size of the output."}),
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
                negative_prompt="",
                size="1280*720",
                seed=-1,
                image_url=None):
       

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = LtxVideoV097I2V720p(
            prompt=prompt,
            negative_prompt=negative_prompt,
            size=size,
            seed=seed,
            image=image_url
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI LtxVideoV097I2V720pNode": LtxVideoV097I2V720pNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI LtxVideoV097I2V720pNode": "WaveSpeedAI LTX Video I2V 720p"
}