from typing import Optional, Union, List
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras


# link api json(vidu-reference-to-video-2.0.json)
class ViduReferenceToVideo20(BaseRequest):
    """
    Request model for the Vidu Reference To Video 2.0 API.

    Create videos that align with reference subjects—like characters, objects, and environments—using the world’s first Multi-Entity Consistency feature.
    """
    images: List[str] = Field(
        ...,
        description=
        "The model will use the provided images as references to generate a video with consistent subjects. For fields that accept images: Accepts 1 to 3 images; Images Assets can be provided via URLs or Base64 encode; You must use one of the following codecs: PNG, JPEG, JPG, WebP; The dimensions of the images must be at least 128x128 pixels; The aspect ratio of the images must be less than 1:4 or 4:1; All images are limited to 50MB; The length of the base64 decode must be under 50MB, and it must include an appropriate content type string.",
        min_items=1,
        max_items=3)
    prompt: str = Field(..., description="Text prompt: A textual description for video generation, with a maximum length of 1500 characters")
    aspect_ratio: Optional[str] = Field("16:9", description="The aspect ratio of the output video. Defaults to 16:9, accepted: 16:9 9:16 1:1.", enum=["16:9", "9:16", "1:1"])
    duration: Optional[int] = Field(4, ge=4, le=8, step=4, description="The number of seconds of duration for the output video. Default to 4 accepted value: 4/8. But vidu2.0 only accepted 4.")
    movement_amplitude: Optional[str] = Field("auto", description="The movement amplitude of objects in the frame. Defaults to auto, accepted value: auto, small, medium, large.", enum=["auto", "small", "medium", "large"])
    seed: Optional[int] = Field(-1, description="The seed to use for generating the video. Random seed: Defaults to a random seed number; Manually set values will override the default random seed.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "images": self.images,
            "prompt": self.prompt,
            "aspect_ratio": self.aspect_ratio,
            "duration": self.duration,
            "movement_amplitude": self.movement_amplitude,
            "seed": self.seed,
        }
        # No loras in this API based on the provided JSON
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/vidu/reference-to-video-2.0"

    def field_required(self):
        return ["images", "prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["images", "prompt", "aspect_ratio", "duration", "movement_amplitude", "seed"]
