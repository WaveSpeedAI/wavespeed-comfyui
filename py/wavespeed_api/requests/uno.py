from typing import Optional, List
from pydantic import Field
from ..utils import BaseRequest


# link api json(uno.json)
class Uno(BaseRequest):
    """
    An AI model that transforms input images into new ones based on text prompts, 
    blending reference visuals with your creative directions.
    """
    images: List[str] = Field(..., description="URL of images to use while generating the image.", max_items=3)
    prompt: str = Field(..., description="The prompt to generate an image from.")
    image_size: Optional[str] = Field("square_hd", description="The aspect ratio of the generated image.", enum=["square_hd", "square", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"])
    seed: Optional[int] = Field(-1, description="Random seed for reproducible generation. If set none, a random seed will be used.")
    num_images: Optional[int] = Field(1, ge=1, le=4, description="The number of images to generate.")
    num_inference_steps: Optional[int] = Field(28, ge=1, le=50, description="The number of inference steps to perform.")
    guidance_scale: Optional[float] = Field(
        3.5, ge=1.0, le=20.0, description="The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you.")
    output_format: Optional[str] = Field("jpeg", description="The format of the generated image.", enum=["jpeg", "png"])
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "images": self.images,
            "prompt": self.prompt,
            "image_size": self.image_size,
            "seed": self.seed,
            "num_images": self.num_images,
            "num_inference_steps": self.num_inference_steps,
            "guidance_scale": self.guidance_scale,
            "output_format": self.output_format,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/uno"

    def field_required(self):
        """Corresponds to required in the interface configuration json"""
        return ["images", "prompt"]

    def field_order(self):
        """Corresponds to x-fal-order-properties in the interface configuration json"""
        return ["images", "image_size", "prompt", "seed", "num_images", "num_inference_steps", "guidance_scale", "output_format", "enable_safety_checker"]
