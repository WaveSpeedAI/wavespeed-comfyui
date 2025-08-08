from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# link api json(wavespeed-ai/hunyuan-video/t2v.json)
class HunyuanVideoT2V(BaseRequest):
    """
    Hunyuan Video is an Open video generation model with high visual quality, motion diversity, text-video alignment, and generation stability. This endpoint generates videos from text descriptions.
    """
    prompt: str = Field(..., description="The prompt to generate the video from.")
    size: Optional[str] = Field("1280*720", description="The size of the output.", enum=['1280*720', '720*1280'])
    seed: Optional[int] = Field(-1, description="The seed to use for generating the video.")
    num_inference_steps: Optional[int] = Field(30, description="The number of inference steps to run. Lower gets faster results, higher gets better results.", ge=2, le=30)
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "size": self.size,
            "seed": self.seed,
            "num_inference_steps": self.num_inference_steps,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/hunyuan-video/t2v"

    def field_required(self):
        return ["prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "size", "seed", "num_inference_steps", "enable_safety_checker"]
