from typing import Optional, Union, List
from pydantic import BaseModel, Field
from ..utils import BaseRequest  # Ensure this path is correct


# link api json(vidu/start-end-to-video-2.0.json)
class ViduStartEndToVideo20(BaseRequest):
    """
    Create dynamic videos using just the first and last frame images, enhanced with text descriptions for seamless storytelling.
    """
    images: List[str] = Field(
        ...,
        description=
        "Supports input of two images, with the first uploaded image considered as the start frame and the second image as the end frame. The model will use these provided images to generate the video. For fields that accept images: Only accept 2 images; The pixel density of the start frame and end frame should be similar. The pixel of the start frame divided by the end frame should be between 0.8 and 1.25; Images Assets can be provided via URLs or Base64 encode; You must use one of the following codecs: PNG, JPEG, JPG, WebP; The aspect ratio of the images must be less than 1:4 or 4:1; All images are limited to 50MB; The length of the base64 decode must be under 50MB, and it must include an appropriate content type string.",
        min_items=2,
        max_items=2)
    prompt: str = Field(..., description="Text prompt: A textual description for video generation, with a maximum length of 1500 characters.")
    duration: Optional[int] = Field(4, description="The number of seconds of duration for the output video. Default to 4 accepted value: 4 8", enum=[4, 8], ge=4, le=8, multiple_of=4)
    movement_amplitude: Optional[str] = Field("auto", description="The movement amplitude of objects in the frame. Defaults to auto, accepted value: auto small medium large.", enum=['auto', 'small', 'medium', 'large'])
    seed: Optional[int] = Field(-1, description="Random seed: Defaults to a random seed number; Manually set values will override the default random seed.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "images": self.images,
            "prompt": self.prompt,
            "duration": self.duration,
            "movement_amplitude": self.movement_amplitude,
            "seed": self.seed,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/vidu/start-end-to-video-2.0"

    def field_required(self):
        return [
            "prompt",
            "images",
        ]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return [
            "images",
            "prompt",
            "duration",
            "movement_amplitude",
            "seed",
        ]
