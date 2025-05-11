from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.hunyuan3d_v2_multi_view import Hunyuan3DV2MultiView


class Hunyuan3DV2MultiViewNode:
    """
    Hunyuan 3D V2 Multi View Node
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "back_image_url": ("STRING", {"tooltip": "Back image URL for 3D V2 Multi View generation"}),
                "front_image_url": ("STRING", {"tooltip": "Front image URL for 3D V2 Multi View generation"}),
                "left_image_url": ("STRING", {"tooltip": "Left image URL for 3D V2 Multi View generation"}),
                "num_inference_steps": ("INT", {
                    "default": 50,
                    "min": 1,
                    "max": 50,
                    "step": 1,
                    "display": "number",
                    "tooltip": "Number of inference steps (1 to 50)"
                }),
                "guidance_scale": ("FLOAT", {
                    "default": 7.5,
                    "min": 0.0,
                    "max": 20.0,
                    "step": 0.1,
                    "display": "number",
                    "tooltip": "The guidance scale for generation (0.0 to 20.0)"
                }),
                "octree_resolution": ("INT", {
                    "default": 256,
                    "min": 64,
                    "max": 512,
                    "step": 1,
                    "display": "number",
                    "tooltip": "The resolution of the octree."
                }),
            },
            "optional": {
                "textured_mesh": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Whether to generate a textured mesh."
                }),
            }
        }

    RETURN_TYPES = ("STRING", )
    RETURN_NAMES = ("glb_url", )

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"

    def execute(self,
                client,
                back_image_url: str = "",
                front_image_url: str = "",
                left_image_url: str = "",
                num_inference_steps: int = 50,
                guidance_scale: float = 7.5,
                octree_resolution: int = 256,
                textured_mesh: bool = False,
                ):

        if back_image_url is None or back_image_url == "":
            raise ValueError("Back image URL is required")

        if front_image_url is None or front_image_url == "":
            raise ValueError("Front image URL is required")

        if left_image_url is None or left_image_url == "":
            raise ValueError("Left image URL is required")

        request = Hunyuan3DV2MultiView(
            back_image_url=back_image_url,
            front_image_url=front_image_url,
            left_image_url=left_image_url,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            octree_resolution=octree_resolution,
            textured_mesh=textured_mesh,
        )

        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 3)

        glb_url = response.get("outputs", [])
        if not glb_url or len(glb_url) == 0:
            raise ValueError("No glb URL in the generated result")

        return (glb_url[0],)


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI Hunyuan3DV2MultiViewNode": Hunyuan3DV2MultiViewNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI Hunyuan3DV2MultiViewNode": "WaveSpeedAI Hunyuan 3D V2 Multi View"
}
