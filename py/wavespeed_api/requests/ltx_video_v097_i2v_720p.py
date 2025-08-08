from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# API JSON Path: api_doc/data/ltx-video-v097-i2v-720p.json
class LtxVideoV097I2V720p(BaseRequest):
    """
    Request model for the LTX Video v0.9.7 I2V 720p API.

    Generate videos from prompts and images using LTX Video-0.9.7
    """
    image: str = Field(..., description="Image URL for Image-to-Video task")
    prompt: str = Field(..., description="Text prompt to guide generation")
    negative_prompt: Optional[str] = Field(None, description="Negative prompt for generation")
    size: Optional[str] = Field("1280*720", description="The size of the output.", enum=["720*1280", "1280*720"])
    seed: Optional[int] = Field(-1, description="Random seed for generation")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "image": self.image,
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "size": self.size,
            "seed": self.seed,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/ltx-video-v097/i2v-720p"

    def field_required(self):
        """Corresponds to required in the interface configuration json"""
        return ["prompt", "image"]

    def field_order(self):
        """Corresponds to x-fal-order-properties in the interface configuration json"""
        return ["image", "prompt", "negative_prompt", "size", "seed"]
