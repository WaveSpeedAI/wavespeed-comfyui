from pydantic import Field
from ..utils import BaseRequest


# link api json(api_doc/data/flux-pro-redux.json)
class FluxProRedux(BaseRequest):
    """
    FLUX.1 [pro] Redux is a high-performance endpoint for the FLUX.1 [pro] model that enables rapid transformation of existing images, delivering high-quality style transfers and image modifications with the core FLUX capabilities.
    """
    image: str = Field(..., description="The URL of the image to generate an image from.", title="Image")
    prompt: str = Field(default="", description="The prompt to generate an image from.", title="Prompt")
    width: int = Field(default=1024, description="The width of the generated image.", title="Image Width", ge=512, le=1536)
    height: int = Field(default=1024, description="The height of the generated image.", title="Image Height", ge=512, le=1536)
    seed: int = Field(default=0, description="The same seed and the same prompt given to the same version of the model will output the same image every time.", title="Seed")
    num_inference_steps: int = Field(default=28, description="The number of inference steps to perform.", title="Num Inference Steps")
    guidance_scale: float = Field(
        default=3.5,
        description="The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you.",
        title="Guidance scale (CFG)")
    num_images: int = Field(default=1, description="The number of images to generate.", title="Num Images")
    enable_safety_checker: bool = Field(default=True, description="If set to true, the safety checker will be enabled.", title="Enable Safety Checker")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "image": self.image,
            "prompt": self.prompt,
            "size": f"{self.width}*{self.height}",
            "seed": self.seed,
            "num_inference_steps": self.num_inference_steps,
            "guidance_scale": self.guidance_scale,
            "num_images": self.num_images,
            "enable_safety_checker": self.enable_safety_checker,
        }
        # No 'loras' field in this API schema, or not configured for special handling.
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path. Corresponds to api_path in the JSON."""
        return "/api/v3/wavespeed-ai/flux-pro-redux"

    def field_required(self):
        return ['image']

    def field_order(self):
        """Corresponds to x-order-properties in the JSON request_schema."""
        return ['image', 'prompt', 'size', 'seed', 'num_inference_steps', 'guidance_scale', 'num_images', 'enable_safety_checker']
