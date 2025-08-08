from typing import Optional, Union, List, Any
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras  # Ensure this path is correct for your project structure


class SkyReelsV1(BaseRequest):
    """
    SkyReels V1 is the first and most advanced open-source human-centric video foundation model. By fine-tuning HunyuanVideo on O(10M) high-quality film and television clips
    """
    aspect_ratio: Optional[str] = Field("16:9", description="Aspect ratio of the output video", enum=['16:9', '9:16'])
    guidance_scale: Optional[float] = Field(6, description="Guidance scale for generation (between 1.0 and 20.0)", ge=1, le=20)
    image: str = Field(..., description="URL of the image input.")
    negative_prompt: Optional[str] = Field(None, description="Negative prompt to guide generation away from certain attributes.")
    num_inference_steps: Optional[int] = Field(30, description="Number of denoising steps (between 1 and 50). Higher values give better quality but take longer.", ge=1, le=50)
    prompt: str = Field(..., description="The prompt to generate the video from.")
    seed: Optional[int] = Field(-1, description="Random seed for generation. If not provided, a random seed will be used.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "aspect_ratio": self.aspect_ratio,
            "guidance_scale": self.guidance_scale,
            "image": self.image,
            "negative_prompt": self.negative_prompt,
            "num_inference_steps": self.num_inference_steps,
            "prompt": self.prompt,
            "seed": self.seed,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/SkyReels-V1"

    def field_required(self):
        return ['prompt', 'image']

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ['prompt', 'image', 'seed', 'guidance_scale', 'num_inference_steps', 'negative_prompt', 'aspect_ratio']
