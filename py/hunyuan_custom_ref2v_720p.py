from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.hunyuan_custom_ref2v_720p import HunyuanCustomRef2V720p


class HunyuanCustomRef2V720pNode:
    """
    Hunyuan Custom Ref2V 720p Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to generate the video from."}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative prompt for image-to-video generation"}),
                "image_url": ("STRING", {"tooltip": "Image for image-to-video generation"}),
                "size": (["1280*720", "720*1280"], {
                    "default": "1280*720",
                    "tooltip": "The size of the output."
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "The seed to use for generating the video. -1 for random seed"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 7.5,
                    "min": 1.01,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The guidance scale for generation (1.01 to 10.0)"
                }),
                "flow_shift": ("FLOAT", {
                    "default": 13.0,
                    "min": 1.0,
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The shift value for the timestep schedule for flow matching (1.0 to 20.0)"
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
                prompt: str = "",
                negative_prompt: str = "",
                size: str = "1280*720",
                seed: int = -1,
                guidance_scale: float = 7.5,
                flow_shift: float = 13.0,
                image_url=None,
                enable_safety_checker: bool = True,
                ):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = HunyuanCustomRef2V720p(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=image_url,
            size=size,
            seed=seed,
            guidance_scale=guidance_scale,
            flow_shift=flow_shift,
            enable_safety_checker=enable_safety_checker,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI HunyuanCustomRef2V720pNode": HunyuanCustomRef2V720pNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI HunyuanCustomRef2V720pNode": "WaveSpeedAI Hunyuan Custom Ref2V 720p"
}
