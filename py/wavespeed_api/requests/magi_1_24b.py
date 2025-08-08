from typing import Optional,List
from pydantic import Field
from ..utils import BaseRequest


# link api json(magi-1-24b.json)
class Magi124b(BaseRequest):
    """
    MAGI-1 is a video generation model with exceptional understanding of physical interactions and cinematic prompts
    """
    prompt: str = Field(..., description="The text prompt to guide video generation.")
    image: Optional[str] = Field(
        None,
        description="URL of an input image to represent the first frame of the video. If the input image does not match the chosen aspect ratio, it is resized and center cropped.")
    num_frames: Optional[int] = Field(
        96, ge=96, le=192, description="Number of frames to generate. Must be between 81 to 100 (inclusive). If the number of frames is greater than 81, the video will be generated with 1.25x more billing units.")
    frames_per_second: Optional[int] = Field(24, ge=5, le=30, description="Frames per second of the generated video. Must be between 5 to 30.")
    seed: Optional[int] = Field(-1, description="Random seed for reproducibility. If None, a random seed is chosen.")
    resolution: Optional[str] = Field("720p", description="Resolution of the generated video (480p or 720p). 480p is 0.5 billing units, and 720p is 1 billing unit.", enum=["480p", "720p"])
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")
    aspect_ratio: Optional[str] = Field("auto", description="Aspect ratio of the generated video. If 'auto', the aspect ratio will be determined automatically based on the input image.", enum=["auto", "16:9", "9:16", "1:1"])

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "num_frames": self.num_frames,
            "frames_per_second": self.frames_per_second,
            "seed": self.seed,
            "resolution": self.resolution,
            "enable_safety_checker": self.enable_safety_checker,
            "aspect_ratio": self.aspect_ratio,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/magi-1-24b"

    def field_required(self) -> List[str]:
        """Corresponds to required in the interface configuration json"""
        return ["prompt"]

    def field_order(self) -> List[str]:
        """Corresponds to x-fal-order-properties in the interface configuration json"""
        return ["prompt", "image", "num_frames", "frames_per_second", "seed", "resolution", "enable_safety_checker", "aspect_ratio"]
