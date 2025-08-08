from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


class HunyuanVideoI2V(BaseRequest):
    """
    Request model for the Hunyuan Video I2V API.

    Hunyuan Video is an Open video generation model with high visual quality, motion diversity, text-video alignment, and generation stability. This endpoint generates videos from image and text descriptions.
    """
    prompt: Optional[str] = Field(
        None,
        description="The prompt to generate the video from.")
    image: str = Field(..., description="The image to generate the video from.")
    num_inference_steps: Optional[int] = Field(30, ge=2, le=30, description="The number of inference steps to run. Lower gets faster results, higher gets better results.")
    duration: Optional[int] = Field(5, ge=5, le=10, step=5, description="Generate video duration length seconds.")
    seed: Optional[int] = Field(-1, description="The seed to use for generating the video.")
    size: Optional[str] = Field("1280*720", description="The size of the output.", enum=["1280*720", "720*1280"])
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "num_inference_steps": self.num_inference_steps,
            "duration": self.duration,
            "seed": self.seed,
            "size": self.size,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/hunyuan-video/i2v"

    def field_required(self):
        return ["image"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "image", "num_inference_steps", "duration", "seed", "size", "enable_safety_checker"]
