from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# API JSON: google/veo3.json
class GoogleVeo3(BaseRequest):
    """
    Request class for Google Veo3 Text-to-Video API
    """
    prompt: str = Field(..., description="Text prompt for generation")
    seed: Optional[int] = Field(default=-1, description=" The same seed and the same prompt given to the same version of the model will output the same image every time. ")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "seed": self.seed
        }

        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/google/veo3"

    def field_required(self):
        return ['prompt']

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ['prompt'] 