from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


class Hunyuan3DV2MultiView(BaseRequest):
    """
    Request model for the Hunyuan 3D V2 Multi View API.

    Hunyuan Video is an Open video generation model with high visual quality, motion diversity, text-video alignment, and generation stability. This endpoint generates videos from image and text descriptions.
    """
    back_image_url: str = Field(..., description="URL of the back image.")
    front_image_url: str = Field(..., description="URL of the front image.")
    left_image_url: str = Field(..., description="URL of the left image.")
    num_inference_steps: Optional[int] = Field(50, ge=1, le=50, description="Number of inference steps.")
    guidance_scale: Optional[float] = Field(7.5, ge=0.0, le=20.0, step=0.1, description="The guidance scale for generation.")
    octree_resolution: Optional[int] = Field(256, ge=64, le=512, description="Resolution of the octree.")
    textured_mesh: Optional[bool] = Field(False, description="Whether to generate a textured mesh.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "back_image_url": self.back_image_url,
            "front_image_url": self.front_image_url,
            "left_image_url": self.left_image_url,
            "guidance_scale": self.guidance_scale,
            "num_inference_steps": self.num_inference_steps,
            "octree_resolution": self.octree_resolution,
            "textured_mesh": self.textured_mesh,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/hunyuan3d-v2-multi-view"

    def field_required(self):
        return ["back_image_url", "front_image_url", "left_image_url"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["back_image_url", "front_image_url", "left_image_url", "guidance_scale", "num_inference_steps", "octree_resolution", "textured_mesh"]
