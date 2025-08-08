from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


class Framepack(BaseRequest):
    """
    Request model for the Framepack API.

    Framepack is an efficient Image-to-video model that autoregressively generates videos.
    """
    image: str = Field(..., description="The URL of the video to generate the audio for.")
    prompt: str = Field(
        ...,
        description="Prompt for generating video")
    negative_prompt: Optional[str] = Field("", description="The negative prompt to generate the audio for.")
    aspect_ratio: Optional[str] = Field("16:9", description="The aspect ratio of the video to generate.", enum=["16:9", "9:16"])
    resolution: Optional[str] = Field("720p", description="The resolution of the video to generate. 720p generations cost 1.5x more than 480p generations.", enum=["720p", "480p"])
    seed: Optional[int] = Field(-1, description="The seed for the random number generator")
    num_inference_steps: Optional[int] = Field(25, description="The number of steps to generate the audio for.", ge=4, le=50)
    num_frames: Optional[int] = Field(180, description="The duration of the audio to generate.", ge=30, le=1800, step=10)  # type: ignore
    guidance_scale: Optional[float] = Field(10.0, description="Guidance scale for the generation.", ge=0.0, le=32.0)
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "image": self.image,
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "aspect_ratio": self.aspect_ratio,
            "resolution": self.resolution,
            "seed": self.seed,
            "num_inference_steps": self.num_inference_steps,
            "num_frames": self.num_frames,
            "guidance_scale": self.guidance_scale,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/framepack"

    def field_required(self):
        """Corresponds to required in the interface configuration json"""
        return ["image", "prompt"]

    def field_order(self):
        """Corresponds to x-fal-order-properties in the interface configuration json"""
        return ["image", "prompt", "negative_prompt", "aspect_ratio", "resolution", "seed", "num_inference_steps", "num_frames", "guidance_scale", "enable_safety_checker"]
