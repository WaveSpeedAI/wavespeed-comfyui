from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# API JSON: kwaivgi/kling-v1.6-t2v-standard.json
class KwaivgiKlingV1x6T2vStandard(BaseRequest):
    """
    Generate 5s videos in 720p resolution
    """
    prompt: str = Field(..., description="Text prompt for generation; Positive text prompt; Cannot exceed 2500 characters", max_length=2000)
    negative_prompt: Optional[str] = Field(None, description="Negative text prompt; Cannot exceed 2500 characters", max_length=2500)
    guidance_scale: Optional[float] = Field(0.5, description="Flexibility in video generation; The higher the value, the lower the model’s degree of flexibility, and the stronger the relevance to the user’s prompt.", ge=0, le=1)
    duration: Optional[int] = Field(default=5, description="Video Length, unit: s (seconds). ", ge=5, le=10)

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "guidance_scale": self.guidance_scale,
            "duration": self.duration,
        }

        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/kwaivgi/kling-v1.6-t2v-standard"

    def field_required(self):
        return ['prompt']

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ['prompt', 'negative_prompt', 'guidance_scale', 'duration']
