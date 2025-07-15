from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# API JSON: wavespeed-ai/veo2-i2v.json
class WavespeedAiVeo2I2v(BaseRequest):
    """
    Request class for WaveSpeed AI Veo2 Image-to-Video API
    """
    prompt: str = Field(..., description="Text prompt for generation")
    image: str = Field(..., description="URL of the input image")
    aspect_ratio: Optional[str] = Field("16:9", description="Aspect ratio of the output video")
    duration: Optional[str] = Field("5s", description="Video duration in seconds")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "aspect_ratio": self.aspect_ratio,
            "duration": self.duration,
        }

        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/veo2-i2v"

    def field_required(self):
        return ['prompt', 'image']

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ['prompt', 'image', 'aspect_ratio', 'duration', 'seed'] 