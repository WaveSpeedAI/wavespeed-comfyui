from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.step1x_edit import Step1xEdit


class Step1xEditNode:
    """
    Step1X Edit Node

    This node uses WaveSpeed AI's Step1X Edit API to transform photos with simple instructions.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to guide the image edit."}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The negative prompt to use."}),
                "image_url": ("STRING", {"tooltip": "The image URL to be edited.", "forceInput": False}),
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
                    "tooltip": "Number of inference steps (1 to 50)"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 4.0,
                    "min": 0.0,
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The CFG scale (0.0 to 20.0)"
                }),
            },
            "optional": {
                "enable_safety_checker": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "If set to true, the safety checker will be enabled."
                }),
            }
        }

    RETURN_TYPES = ("IMAGE", )
    RETURN_NAMES = ("image", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                prompt,
                negative_prompt,
                seed=-1,
                num_inference_steps=30,
                guidance_scale=4.0,
                image_url=None,
                enable_safety_checker=True):

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        if image_url is None or image_url == "":
            raise ValueError("Image URL is required")

        request = Step1xEdit(
            prompt=prompt,
            image=image_url,
            negative_prompt=negative_prompt,
            enable_safety_checker=enable_safety_checker,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            seed=seed,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 1)

        image_urls = response.get("outputs", [])
        if not image_urls:
            raise ValueError("No image URLs in the generated result")

        images = imageurl2tensor(image_urls)
        return (images,)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI Step1xEditNode": Step1xEditNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI Step1xEditNode": "WaveSpeedAI Step1X Edit"
}