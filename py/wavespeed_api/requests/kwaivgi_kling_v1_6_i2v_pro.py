from typing import Optional, Any,List
from pydantic import Field
from ..utils import BaseRequest


# link api json(kwaivgi-kling-v1.6-i2v-pro.json)
class KwaivgiKlingV1x6I2VPro(BaseRequest):
    """
    Request model for the kwaivgi/kling-v1.6-i2v-pro API.

    Generate 5s videos in 1080p resolution from image
    """
    image: str = Field(
        ...,
        description=
        "First frame of the video; Supported image formats include.jpg/.jpeg/.png; The image file size cannot exceed 10MB, and the image resolution should not be less than 300*300px, and the aspect ratio of the image should be between 1:2.5 ~ 2.5:1"
    )
    end_image: Optional[str] = Field(None, description="Tail frame of the video; Supported image formats include.jpg/.jpeg/.png; The image file size cannot exceed 10MB, and the image resolution should not be less than 300*300px.")
    prompt: Optional[str] = Field(
        None,
        description="Text prompt for generation; Positive text prompt; Cannot exceed 2500 characters",
        maxLength=2000)
    negative_prompt: Optional[str] = Field(None, description="Negative text prompt; Cannot exceed 2500 characters", maxLength=2500)
    guidance_scale: Optional[float] = Field(
        0.5, ge=0.0, le=1.0, description="Flexibility in video generation; The higher the value, the lower the model’s degree of flexibility, and the stronger the relevance to the user’s prompt.")
    duration: Optional[int] = Field(default=5, description="Video Length, unit: s (seconds). ", ge=5, le=10)


    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "image": self.image,
            "end_image": self.end_image,
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "guidance_scale": self.guidance_scale,
            "duration": self.duration,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/kwaivgi/kling-v1.6-i2v-pro"

    def field_required(self) -> List[str]:
        """Corresponds to required in the interface configuration json"""
        return ["image"]

    def field_order(self) -> List[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["image", "end_image", "prompt", "negative_prompt", "guidance_scale", "duration"]
