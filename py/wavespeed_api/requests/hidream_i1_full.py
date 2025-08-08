from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# link api json(hidream-i1-full.json)
class HidreamI1Full(BaseRequest):
    """
    HiDream-I1 is a new open-source image generative foundation model with 17B parameters 
    that achieves state-of-the-art image generation quality within seconds.
    """
    prompt: str = Field(..., description="The prompt to generate an image from.")
    width: Optional[int] = Field(1024, description="The width of the generated image.", ge=512, le=1536)
    height: Optional[int] = Field(1024, description="The height of the generated image.", ge=512, le=1536)
    seed: Optional[int] = Field(-1, description="The same seed and the same prompt given to the same version of the model will output the same image every time.")
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "size": f"{self.width}*{self.height}",
            "seed": self.seed,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/hidream-i1-full"

    def field_required(self) -> list[str]:
        """Corresponds to required in the interface configuration json"""
        return ["prompt"]

    def field_order(self) -> list[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "size", "seed", "enable_base64_output", "enable_safety_checker"]
