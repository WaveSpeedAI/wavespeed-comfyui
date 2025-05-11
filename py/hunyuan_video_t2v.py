from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.hunyuan_video_t2v import HunyuanVideoT2V


class HunyuanVideoT2VNode:
    """
    Hunyuan Video Text-to-Video Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to generate the video from."}),
                "size": (['1280*720', '720*1280'], {"default": "1280*720", "tooltip": "The size of the output."}),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "The seed to use for generating the video. -1 for random seed"
                }),
                "num_inference_steps": ("INT", {
                    "default": 30,
                    "min": 2,
                    "max": 30,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The number of inference steps to run. Lower gets faster results, higher gets better results."
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
                size="1280*720",
                seed=-1,
                num_inference_steps=30,
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = HunyuanVideoT2V(
            prompt=prompt,
            size=size,
            seed=seed,
            num_inference_steps=num_inference_steps,
            enable_safety_checker=enable_safety_checker,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        video_url = response.get("outputs", [])
        if not video_url or len(video_url) == 0:
            raise ValueError("No video URL in the generated result")

        return (video_url[0],)


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI HunyuanVideoT2VNode": HunyuanVideoT2VNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI HunyuanVideoT2VNode": "WaveSpeedAI Hunyuan Video T2V"
}
