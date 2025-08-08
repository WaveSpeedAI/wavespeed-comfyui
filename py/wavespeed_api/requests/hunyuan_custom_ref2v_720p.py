from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


class HunyuanCustomRef2V720p(BaseRequest):
    """
    Request model for the Hunyuan Custom Ref2V 720p API.

    Hunyuan Video is an Open video generation model with high visual quality, motion diversity, text-video alignment, and generation stability. This endpoint generates videos from image and text descriptions.
    """
    prompt: Optional[str] = Field(
        None,
        description="The prompt to generate the video from.")
    negative_prompt: Optional[str] = Field(
        None,
        description="The negative prompt to generate the video from.")
    image: str = Field(..., description="The image to generate the video from.")
    guidance_scale: Optional[float] = Field(7.5, ge=1.01, le=10.0, step=0.1, description="The guidance scale for generation.")
    flow_shift: Optional[float] = Field(13.0, ge=1.0, le=20.0, step=0.1, description="The shift value for the timestep schedule for flow matching.")
    seed: Optional[int] = Field(-1, description="The seed to use for generating the video.")
    size: Optional[str] = Field("1280*720", description="The size of the output.", enum=["1280*720", "720*1280"])
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "negative_prompt": self.negative_prompt,
            "guidance_scale": self.guidance_scale,
            "flow_shift": self.flow_shift,
            "seed": self.seed,
            "size": self.size,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/hunyuan-custom-ref2v-720p"

    def field_required(self):
        return ["image"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "image", "negative_prompt", "guidance_scale", "flow_shift", "seed", "size", "enable_safety_checker"]
