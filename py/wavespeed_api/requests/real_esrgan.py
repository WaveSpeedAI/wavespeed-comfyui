from typing import Optional, Any
from pydantic import Field
from ..utils import BaseRequest


class RealEsrgan(BaseRequest):
    """
    Real-ESRGAN with optional face correction and adjustable upscale
    """
    image: str = Field(..., description="Input image")
    guidance_scale: Optional[float] = Field(4, ge=0, le=10, description="Factor to scale image by")
    face_enhance: Optional[bool] = Field(False, description="Run GFPGAN face enhancement along with upscaling")

    def __init__(self, image: str, guidance_scale: Optional[float] = 4, face_enhance: Optional[bool] = False, **kwargs: Any):
        super().__init__(**kwargs)
        self.image = image
        self.guidance_scale = guidance_scale
        self.face_enhance = face_enhance

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "image": self.image,
            "guidance_scale": self.guidance_scale,
            "face_enhance": self.face_enhance,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v2/wavespeed-ai/real-esrgan"

    def field_required(self) -> list[str]:
        """Corresponds to required in the interface configuration json"""
        return ["image"]

    def field_order(self) -> list[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["image", "guidance_scale", "face_enhance"]
