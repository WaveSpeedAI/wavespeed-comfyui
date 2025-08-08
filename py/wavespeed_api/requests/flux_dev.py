from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# link api json(api_doc/data/flux-dev.json)
class FluxDev(BaseRequest):
    """
    Flux-dev text to image model, 12 billion parameter rectified flow transformer
    """
    enable_safety_checker: Optional[bool] = Field(default=True, description="If set to true, the safety checker will be enabled.")
    guidance_scale: Optional[float] = Field(default=3.5, description="The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you.")
    image: Optional[str] = Field(default=None, description="The image to generate an image from.")
    mask_image: Optional[str] = Field(
        default=None, description="The mask image tells the model where to generate new pixels (white) and where to preserve the original image (black). It acts as a stencil or guide for targeted image editing.")
    num_images: Optional[int] = Field(default=1, description="The number of images to generate.")
    num_inference_steps: Optional[int] = Field(default=28, description="The number of inference steps to perform.")
    prompt: str = Field(..., description="The prompt to generate an image from.")
    seed: Optional[int] = Field(default=-1, description="\n            The same seed and the same prompt given to the same version of the model\n            will output the same image every time.\n        ")
    width: Optional[int] = Field(default=1024, description="The width of the generated image." , ge=512, le=1536)
    height: Optional[int] = Field(default=1024, description="The height of the generated image." , ge=512, le=1536)
    strength: Optional[float] = Field(default=0.8, description="Strength indicates extent to transform the reference image", ge=0, le=1)


    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            
            "prompt": self.prompt,
            "enable_safety_checker": self.enable_safety_checker,
            "guidance_scale": self.guidance_scale,
            "image": self.image,
            "mask_image": self.mask_image,
            "num_images": self.num_images,
            "num_inference_steps": self.num_inference_steps,
            "seed": self.seed,
            "size": f"{self.width}*{self.height}",
            "strength": self.strength,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path. Corresponds to api_path in the JSON."""
        return "/api/v3/wavespeed-ai/flux-dev"

    def field_required(self):
        return ["prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the JSON request_schema."""
        return ["prompt", "image", "mask_image", "strength", "size", "num_inference_steps", "seed", "guidance_scale", "num_images", "enable_base64_output", "enable_safety_checker"]
