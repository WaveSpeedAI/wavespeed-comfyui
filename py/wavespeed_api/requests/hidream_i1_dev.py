from pydantic import Field
from ..utils import BaseRequest


# link api json(hidream-i1-dev.json)
class HidreamI1Dev(BaseRequest):
    """
    HiDream-I1 is a new open-source image generative foundation model with 17B parameters that achieves state-of-the-art image generation quality within seconds.
    """
    enable_safety_checker: bool = Field(True, description="If set to true, the safety checker will be enabled.")
    prompt: str = Field(..., description="The prompt to generate an image from.")
    seed: int = Field(-1, description="\n            The same seed and the same prompt given to the same version of the model\n            will output the same image every time.\n        ")
    width: int = Field(1024, description="The width of the generated image.", ge=512, le=1536)
    height: int = Field(1024, description="The height of the generated image.", ge=512, le=1536)

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "enable_safety_checker": self.enable_safety_checker,
            "prompt": self.prompt,
            "seed": self.seed,
            "size": f"{self.width}*{self.height}",
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/hidream-i1-dev"

    def field_required(self):
        return ["prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "size", "seed", "enable_base64_output", "enable_safety_checker"]
