from typing import Optional, Union, List, Any
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras  # Assuming utils.py and normalization_loras exist


class ViduImageToVideo2x0(BaseRequest):
    """
    Bring your images to life by turning them into dynamic videos that capture your vision and action.
    """
    image: str = Field(
        ...,
        description=
        "An image to be used as the start frame of the generated video. For fields that accept images: Only accepts 1 image; Images Assets can be provided via URLs or Base64 encode; You must use one of the following codecs: PNG, JPEG, JPG, WebP; The aspect ratio of the images must be less than 1:4 or 4:1; All images are limited to 50MB; The length of the base64 decode must be under 50MB, and it must include an appropriate content type string. "
    )
    prompt: str = Field(..., description="Text prompt: A textual description for video generation, with a maximum length of 1500 characters")
    duration: Optional[int] = Field(4, description="The number of seconds of duration for the output video\nDefault to 4 accepted value: 4, 8", ge=4, le=8)
    movement_amplitude: Optional[str] = Field("auto", description="The movement amplitude of objects in the frame. Defaults to auto, accepted value: auto small medium large", enum=["auto", "small", "medium", "large"])
    seed: Optional[int] = Field(-1, description="The seed to use for generating the video. Random seed: Defaults to a random seed number; Manually set values will override the default random seed.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "image": self.image,
            "prompt": self.prompt,
            "duration": self.duration,
            "movement_amplitude": self.movement_amplitude,
            "seed": self.seed,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/vidu/image-to-video-2.0"

    def field_required(self) -> List[str]:
        """Corresponds to required in the interface configuration json"""
        return ["prompt", "image"]

    def field_order(self) -> List[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["image", "prompt", "duration", "movement_amplitude", "seed"]
