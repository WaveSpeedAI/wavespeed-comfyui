from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# link api json(ltx-video-v097-i2v-480p.json)
class LtxVideoV097I2V480p(BaseRequest):
    """
    Generate videos from prompts and images using LTX Video-0.9.7 
    """
    image: str = Field(..., description="Image URL for Image-to-Video task")
    prompt: str = Field(..., description="Text prompt to guide generation")
    negative_prompt: Optional[str] = Field(None, description="Negative prompt for generation")
    size: Optional[str] = Field(default="832*480", description="The size of the output.", enum=['832*480', '480*832'])
    seed: Optional[int] = Field(default=-1, description="Random seed for generation")

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
        return "/api/v3/wavespeed-ai/ltx-video-v097/i2v-480p"

    def field_required(self):
        """Corresponds to required in the interface configuration json"""
        return ['prompt', 'image']

    def field_order(self):
        """Corresponds to x-fal-order-properties or x-order-properties in the interface configuration json"""
        return ['image', 'prompt', 'negative_prompt', 'size', 'seed']
