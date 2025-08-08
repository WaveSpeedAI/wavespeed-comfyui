from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# link api json(api_doc/data/flux-redux-dev.json)
class FluxReduxDev(BaseRequest):
    """
    Open-weight image variation model. Create new versions while preserving key elements of your original.
    """
    enable_safety_checker: Optional[bool] = Field(default=True, description="If set to true, the safety checker will be enabled.")
    guidance_scale: Optional[float] = Field(
        default=3.5,
        description="\n            The CFG (Classifier Free Guidance) scale is a measure of how close you want\n            the model to stick to your prompt when looking for a related image to show you.\n        ",
        maximum=20,
        minimum=1)
    image: str = Field(..., description="The URL of the image to generate an image from.")
    num_images: Optional[int] = Field(default=1, description="The number of images to generate.", maximum=4, minimum=1)
    num_inference_steps: Optional[int] = Field(default=28, description="The number of inference steps to perform.", maximum=50, minimum=1)
    seed: Optional[int] = Field(default=-1, description="\n            The same seed and the same prompt given to the same version of the model\n            will output the same image every time.\n        ")
    width: Optional[int] = Field(default=1024, description="The width of the generated image.", ge=512, le=1536)
    height: Optional[int] = Field(default=1024, description="The height of the generated image.", ge=512, le=1536)

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "enable_safety_checker": self.enable_safety_checker,
            "guidance_scale": self.guidance_scale,
            "image": self.image,
            "num_images": self.num_images,
            "num_inference_steps": self.num_inference_steps,
            "seed": self.seed,
            "size": f"{self.width}*{self.height}",
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path. Corresponds to api_path in the JSON."""
        return "/api/v3/wavespeed-ai/flux-redux-dev"

    def field_required(self):
        return ["image"]

    def field_order(self):
        return ["image", "size", "num_inference_steps", "seed", "guidance_scale", "num_images", "enable_safety_checker"]
