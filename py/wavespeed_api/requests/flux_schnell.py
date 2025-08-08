from typing import Optional
from pydantic import Field
from ..utils import BaseRequest

# link api json(flux-schnell.json)


class FluxSchnell(BaseRequest):
    """Request model for FLUX.1 [schnell] API (12B rectified flow transformer, fast local image generation)."""
    prompt: str = Field(default=None, description="Input prompt for image generation.")
    image: Optional[str] = Field(default=None, description="Source image for image-to-image.")
    mask_image: Optional[str] = Field(default=None, description="Mask image: white=generate, black=preserve.")
    strength: Optional[float] = Field(default=0.8, ge=0.0, le=1.0, step=0.01, description="Transform strength.")
    width: Optional[int] = Field(default=1024, description="Output image width.", ge=512, le=1536)
    height: Optional[int] = Field(default=1024, description="Output image height.", ge=512, le=1536)
    num_inference_steps: Optional[int] = Field(default=4, ge=1, le=8, description="Inference steps.")
    guidance_scale: Optional[float] = Field(default=3.5, ge=0.0, le=10.0, step=0.1, description="CFG scale.")
    num_images: Optional[int] = Field(default=1, ge=1, le=4, description="Images to generate.")
    seed: Optional[int] = Field(default=-1, description="Random seed (-1=random).")
    enable_safety_checker: Optional[bool] = Field(default=True, description="Enable safety checker.")

    def build_payload(self) -> dict:
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "mask_image": self.mask_image,
            "strength": self.strength,
            "size": f"{self.width}*{self.height}",
            "num_inference_steps": self.num_inference_steps,
            "guidance_scale": self.guidance_scale,
            "num_images": self.num_images,
            "seed": self.seed,
            "enable_safety_checker": self.enable_safety_checker
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        return "/api/v3/wavespeed-ai/flux-schnell"

    def field_required(self):
        return ["prompt"]

    def field_order(self):
        return ["prompt", "image", "mask_image", "strength", "size", "num_inference_steps", "guidance_scale", "num_images", "seed", "enable_base64_output", "enable_safety_checker"]
