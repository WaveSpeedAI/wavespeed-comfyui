from typing import Optional, Any
from pydantic import Field
from ..utils import BaseRequest


# link api json(ghibli.json)
class Ghibli(BaseRequest):
    """
    Request model for the Ghibli API.

    Reimagine and transform your ordinary photos into enchanting Studio Ghibli style artwork
    """
    image: str = Field(..., description="The image to generate an image from.")
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "image": self.image,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/ghibli"

    def field_required(self) -> list[str]:
        """Corresponds to required fields in the interface configuration json"""
        return ["image"]

    def field_order(self) -> list[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "image", "strength", "size", "num_inference_steps", "seed", "guidance_scale", "num_images", "enable_base64_output", "enable_safety_checker"]
