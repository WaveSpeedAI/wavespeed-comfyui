from .wavespeed_api.utils import imageurl2tensor
from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.uno import Uno

class UnoNode:
    """
    Uno Image Transformation Node

    This node uses WaveSpeed AI's Uno model to transform input images based on text prompts.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "image_urls": ("STRING", {"tooltip": "Input images to transform (up to 5)"}),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The prompt to guide the image transformation."}),
                "image_size": (["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"], {"default": "square_hd", "tooltip": "The aspect ratio of the generated image."}),
                "seed": ("INT", {
                    "default": -1,
                    "min": -1,
                    "max": 0xffffffffffffffff,
                    "control_after_generate": True,
                    "tooltip": "Random seed for reproducible generation. -1 for random seed."
                }),
                "num_images": ("INT", {
                    "default": 1,
                    "min": 1,
                    "max": 4,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The number of images to generate (1 to 4)."
                }),
                "num_inference_steps": ("INT", {
                    "default": 28,
                    "min": 1,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The number of inference steps to perform (1 to 50)."
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 3.5,
                    "min": 1.0,
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The CFG scale (1.0 to 20.0)."
                }),
                "output_format": (["jpeg", "png"], {"default": "jpeg", "tooltip": "The format of the generated image."}),
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
                image_urls,
                prompt,
                image_size="square_hd",
                seed=-1,
                num_images=1,
                num_inference_steps=28,
                guidance_scale=3.5,
                output_format="jpeg",
                enable_safety_checker=True):
        if image_urls is None:
            raise ValueError("image_urls must be provided")

        # Check if image_urls is a list
        if not isinstance(image_urls, list):
            image_urls = [image_urls]
        
        # Ensure we have at most 5 image URLs
        images_param = image_urls[:5]

        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = Uno(
            prompt=prompt,
            images=images_param,
            image_size=image_size,
            seed=seed,
            num_images=num_images,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            output_format=output_format,
            enable_safety_checker=enable_safety_checker,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 1)

        image_urls = response.get("outputs", [])
        if not image_urls:
            raise ValueError("No image URLs in the generated result")

        images = imageurl2tensor(image_urls)
        return (images,)

NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI UnoNode": UnoNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI UnoNode": "WaveSpeedAI Uno"
}