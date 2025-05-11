from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.wan_2_1_t2v_480p_lora_ultra_fast import Wan2x1T2V480pLoraUltraFast

class Wan2x1T2V480pLoraUltraFastNode:
    """
    Wan 2.1 Text-to-Video 480p Lora Ultra Fast Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Text prompt for video generation"}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "Negative text prompt for video generation"}),
                "size": (["832*480", "480*832"], {
                    "default": "832*480",
                    "tooltip": "The size of the output video."
                }),
                "duration": ("INT", {
                    "default": 5,
                    "min": 5,
                    "max": 10,
                    "step": 5,
                    "display": "number",
                    "tooltip": "Generate video duration length in seconds (5 or 10)"
                }),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "The seed to use for generating the video. -1 for random seed."
                }),
                "num_inference_steps": ("INT", {
                    "default": 30,
                    "min": 1,
                    "max": 40,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The number of inference steps (1 to 40)"
                }),
                "flow_shift": ("FLOAT", {
                    "default": 3.0,
                    "min": 1.0,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The shift value for the timestep schedule for flow matching (1.0 to 10.0)"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 5.0,
                    "min": 1.01,
                    "max": 10.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The guidance scale for generation (1.01 to 10.0)"
                }),
            },
            "optional": {
                "loras": ("WAVESPEED_LORAS", {"tooltip": "List of LoRA models to apply, max 3 items"}),
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Whether to enable the safety checker."
                }),
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
                duration: int = 5,
                seed: int = -1,
                num_inference_steps: int = 30,
                flow_shift: float = 3.0,
                guidance_scale: float = 5.0,
                loras=None,
                enable_safety_checker: bool = True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = Wan2x1T2V480pLoraUltraFast(
            prompt=prompt,
            negative_prompt=negative_prompt,
            loras=loras,
            size=size,
            num_inference_steps=num_inference_steps,
            duration=duration,
            guidance_scale=guidance_scale,
            flow_shift=flow_shift,
            seed=seed,
            enable_safety_checker=enable_safety_checker,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI Wan21T2V480pLoraUltraFastNode": Wan2x1T2V480pLoraUltraFastNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI Wan21T2V480pLoraUltraFastNode": "WaveSpeedAI Wan2.1 T2V 480p LoRA Ultra Fast"
}