from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.framepack import Framepack

class FramepackNode:
    """
    Framepack Video Generator Node

    This node uses WaveSpeed AI's Framepack model to generate videos from an image.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Prompt for generating video"}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The negative prompt for video generation."}),
                "image_url": ("STRING", {"tooltip": "Image for image-to-image generation", "forceInput": False}),
                "aspect_ratio": (["16:9", "9:16"], {"default": "16:9", "tooltip": "The aspect ratio of the video to generate."}),
                "resolution": (["720p", "480p"], {"default": "720p", "tooltip": "The resolution of the video to generate."}),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "The seed for the random number generator"
                }),
                "num_frames": ("INT", {
                    "default": 180,
                    "min": 30,
                    "max": 1800,
                    "step": 10,
                    "display": "number",
                    "tooltip": "The number of frames in the video"
                }),
                "num_inference_steps": ("INT", {
                    "default": 25,
                    "min": 4,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The number of inference steps"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 10.0,
                    "min": 0.0,
                    "max": 32.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "Guidance scale for the generation."
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
                negative_prompt="",
                aspect_ratio="16:9",
                resolution="720p",
                seed=-1,
                num_frames=180,
                num_inference_steps=25,
                guidance_scale=10.0,
                image_url=None,
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = Framepack(
            prompt=prompt,
            image=image_url,
            negative_prompt=negative_prompt,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            seed=seed,
            num_inference_steps=num_inference_steps,
            num_frames=num_frames,
            guidance_scale=guidance_scale,
            enable_safety_checker=enable_safety_checker,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request,True,3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI FramepackNode": FramepackNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI FramepackNode": "WaveSpeedAI Framepack"
}