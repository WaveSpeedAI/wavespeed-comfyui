from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# API JSON: kwaivgi/kling-v2.1-t2v-master.json
class KwaivgiKlingV2x1T2vMaster(BaseRequest):
    """
    Request class for Kwaivgi Kling V2.1 Text-to-Video Master API
    """
    prompt: str = Field(..., description="Text prompt for generation; Cannot exceed 2500 characters", max_length=2500)
    negative_prompt: Optional[str] = Field(None, description="Negative text prompt; Cannot exceed 2500 characters", max_length=2500)
    aspect_ratio: Optional[str] = Field("16:9", description="Aspect ratio of the output video")
    duration: Optional[int] = Field(default=5, description="Video duration in seconds", ge=5, le=10)
    guidance_scale: Optional[float] = Field(0.5, description="Flexibility in video generation; The higher the value, the lower the model's degree of flexibility", ge=0, le=1)

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "aspect_ratio": self.aspect_ratio,
            "duration": self.duration,
            "guidance_scale": self.guidance_scale
        }

        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/kwaivgi/kling-v2.1-t2v-master"

    def field_required(self):
        return ['prompt']

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ['prompt', 'negative_prompt', 'aspect_ratio', 'duration', 'guidance_scale'] 