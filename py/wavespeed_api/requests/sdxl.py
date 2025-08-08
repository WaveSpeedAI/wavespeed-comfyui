from typing import Optional, List, Any
from pydantic import Field
from ..utils import BaseRequest


# link api json(sdxl.json)
class Sdxl(BaseRequest):
    """
    Request model for the wavespeed-ai/sdxl API.

    SDXL consists of an ensemble of experts pipeline for latent diffusion: In a first step, 
    the base model is used to generate (noisy) latents, which are then further processed 
    with a refinement model
    """
    prompt: str = Field(..., description="Input prompt for image generation.")
    image: Optional[str] = Field(
        default="",
        description="Input image for image-to-image generation."  # Added a generic description as it's not in JSON
    )
    mask_image: Optional[str] = Field(
        default=None,  # Assuming None if not provided, as "" might be a valid empty mask
        description="The mask image tells the model where to generate new pixels (white) and where to preserve the original image (black). It acts as a stencil or guide for targeted image editing.")
    strength: Optional[float] = Field(
        default=0.8,
        ge=0.01,
        le=1.0,
        # step=0.01, pydantic Field does not have 'step', will be handled by UI if needed
        description="Strength indicates extent to transform the reference image")
    width: Optional[int] = Field(default=1024, description="Output image width", ge=512, le=1536)
    height: Optional[int] = Field(default=1024, description="Output image height", ge=512, le=1536)
    num_inference_steps: Optional[int] = Field(default=30, ge=1, le=50, description="Number of inference steps")
    guidance_scale: Optional[float] = Field(
        default=5.0,
        ge=0.0,
        le=10.0,
        # step=0.1,
        description="Guidance scale for generation")
    num_images: Optional[int] = Field(default=1, ge=1, le=4, description="Number of images to generate")
    seed: Optional[int] = Field(default=-1, description="Random seed (-1 for random)")
    enable_safety_checker: Optional[bool] = Field(default=True, description="Enable safety checker")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
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
            "enable_safety_checker": self.enable_safety_checker,
        }
        # No loras parameter found in sdxl.json request_schema
        return self._remove_empty_fields(payload)

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/sdxl"

    def field_required(self) -> List[str]:
        """Corresponds to required in the interface configuration json"""
        return ["prompt"]

    def field_order(self) -> List[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "image", "mask_image", "strength", "size", "num_inference_steps", "guidance_scale", "num_images", "seed", "enable_base64_output", "enable_safety_checker"]
