from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# link api json(kwaivgi-kling-v1.6-i2v-standard.json)
class KwaivgiKlingV16I2vStandard(BaseRequest):
    """
    Generate 5s videos in 720p resolution from image
    """
    duration: Optional[int] = Field(default=5, description="Video Length, unit: s (seconds). ", ge=5, le=10)
    guidance_scale: Optional[float] = Field(
        0.5, description="Flexibility in video generation; The higher the value, the lower the model’s degree of flexibility, and the stronger the relevance to the user’s prompt.", ge=0, le=1, step=0.01)
    image: str = Field(..., description="First frame of the video; Supported image formats include.jpg/.jpeg/.png; The image file size cannot exceed 10MB, and the image resolution should not be less than 300*300px")
    negative_prompt: Optional[str] = Field(None, description="Negative text prompt; Cannot exceed 2500 characters", max_length=2500)
    prompt: Optional[str] = Field(
        None,
        description="Text prompt for generation; Positive text prompt; Cannot exceed 2500 characters",
        max_length=2000)

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "duration": self.duration,
            "guidance_scale": self.guidance_scale,
            "image": self.image,
            "negative_prompt": self.negative_prompt,
            "prompt": self.prompt,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/kwaivgi/kling-v1.6-i2v-standard"

    def field_required(self):
        return ['image']

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ['prompt', 'negative_prompt', 'image', 'guidance_scale', 'duration']
