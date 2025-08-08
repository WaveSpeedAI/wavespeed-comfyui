from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# link api json(hidream-e1-full.json)
class HidreamE1Full(BaseRequest):
    """
    HiDream-E1 is an image editing model built on HiDream-I1.
    """
    prompt: str = Field(..., description="The prompt to generate an image from.")
    image: str = Field(..., description="The image to edit.")
    seed: Optional[int] = Field(default=-1, description="\n            The same seed and the same prompt given to the same version of the model\n            will output the same image every time.\n        ")
    enable_safety_checker: Optional[bool] = Field(default=True, description="If set to true, the safety checker will be enabled.")  # In JSON, this field has "disabled": true

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "seed": self.seed,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/hidream-e1-full"

    def field_required(self) -> list[str]:
        """Corresponds to required in the interface configuration json"""
        return ["prompt", "image"]

    def field_order(self) -> list[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "image", "seed", "enable_base64_output", "enable_safety_checker"]
