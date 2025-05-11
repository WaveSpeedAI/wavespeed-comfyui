from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.mmaudio_v2 import MmaudioV2

class MMAudioV2Node:
    """
    MMAudio V2 Node

    This node uses WaveSpeed AI's MMAudio V2 model to generate synchronized audio for video.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "video": ("STRING", {"multiline": False, "default": "", "tooltip": "The URL of the video to generate the audio for."}),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to generate the audio for."}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The negative prompt to generate the audio for."}),
                "duration": ("INT", {
                    "default": 8,
                    "min": 1,
                    "max": 30,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The duration of the audio to generate."
                }),
                "seed": ("INT", {
                    "default": 0,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible results. -1 for random seed"
                }),
                "num_inference_steps": ("INT", {
                    "default": 25,
                    "min": 4,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The number of steps to generate the audio for."
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 4.5,
                    "min": 0.0,
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The strength of Classifier Free Guidance."
                }),
            },
            "optional": {
                "mask_away_clip": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Whether to mask away the clip."
                }),
            }
        }

    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("video_url", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                video,
                prompt,
                negative_prompt="",
                duration=8,
                seed=0,
                num_inference_steps=25,
                guidance_scale=4.5,
                mask_away_clip=False):

        if video is None or video == "":
            raise ValueError("Video is required")

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = MmaudioV2(
            video=video,
            prompt=prompt,
            negative_prompt=negative_prompt,
            seed=seed,
            num_inference_steps=num_inference_steps,
            duration=duration,
            guidance_scale=guidance_scale,
            mask_away_clip=mask_away_clip,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI MMAudioV2Node": MMAudioV2Node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI MMAudioV2Node": "WaveSpeedAI MMAudio V2"
}