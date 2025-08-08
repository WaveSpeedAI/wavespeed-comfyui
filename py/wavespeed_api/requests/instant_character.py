from typing import Optional,Any,List
from pydantic import Field
from ..utils import BaseRequest


class InstantCharacter(BaseRequest):
    """
    InstantCharacter creates high-quality, consistent characters from text prompts, 
    supporting diverse poses, styles, and appearances with strong identity control.
    """
    prompt: str = Field(
        ...,
        description="The prompt to generate an image from.",
    )
    image: str = Field(..., description="The image URL to generate an image from. Needs to match the dimensions of the mask.")
    width: Optional[int] = Field(1024, description="The width of the generated image.", ge=512, le=1536)
    height: Optional[int] = Field(1024, description="The height of the generated image.", ge=512, le=1536)
    negative_prompt: Optional[str] = Field(
        None, description="The negative prompt to use. Use it to address details that you don't want in the image. This could be colors, objects, scenery and even the small details (e.g. moustache, blurry, low resolution).")
    seed: Optional[int] = Field(-1, description="The same seed and the same prompt given to the same version of the model will output the same image every time.")
    guidance_scale: Optional[float] = Field(
        3.5, ge=0, le=20, description="The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you.")
    num_inference_steps: Optional[int] = Field(28, ge=1, le=50, description="The number of inference steps to perform.")
    num_images: Optional[int] = Field(1, ge=1, le=4, description="The number of images to generate.")
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "size": f"{self.width}*{self.height}",
            "negative_prompt": self.negative_prompt,
            "seed": self.seed,
            "guidance_scale": self.guidance_scale,
            "num_inference_steps": self.num_inference_steps,
            "num_images": self.num_images,
            "enable_safety_checker": self.enable_safety_checker,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/instant-character"

    def field_required(self) -> List[str]:
        """Corresponds to required in the interface configuration json"""
        return ["prompt", "image"]

    def field_order(self) -> List[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "image", "size", "negative_prompt", "seed", "guidance_scale", "num_inference_steps", "num_images", "enable_safety_checker"]
