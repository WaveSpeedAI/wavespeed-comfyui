from typing import Optional, Union, List, Any, Dict
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras


class LoraWeightItem(BaseModel):
    path: str = Field(..., description="Path to the LoRA model")
    scale: float = Field(..., description="Scale of the LoRA model (range: 0.0 ~ 4.0)", ge=0.0, le=4.0)

class FluxDevLora(BaseRequest):
    """
    Rapid, high-quality image generation with FLUX.1 [dev] and LoRA support for personalized styles and brand-specific outputs
    """
    enable_safety_checker: Optional[bool] = Field(default=True, description="Enable safety checker", disabled=True)
    guidance_scale: Optional[float] = Field(default=3.5, description="Guidance scale for generation", maximum=10, minimum=0)
    image: Optional[str] = Field(default=None, description="Input image for image-to-image generation.")
    loras: Optional[List[LoraWeightItem]] = Field(None, description="List of LoRAs to apply (max 3)", max_items=3)
    mask_image: Optional[str] = Field(default=None, description="The mask image tells the model where to generate new pixels (white) and where to preserve the original image (black). It acts as a stencil or guide for targeted image editing.")
    num_images: Optional[int] = Field(default=1, description="Number of images to generate", maximum=4, minimum=1)
    num_inference_steps: Optional[int] = Field(default=28, description="Number of inference steps", maximum=50, minimum=1)
    prompt: str = Field(..., description="Input prompt for image generation")
    seed: Optional[int] = Field(default=-1, description="Random seed (-1 for random)")
    width: Optional[int] = Field(default=1024, description="The width of the generated image.", ge=512, le=1536)
    height: Optional[int] = Field(default=1024, description="The height of the generated image.", ge=512, le=1536)
    strength: Optional[float] = Field(default=0.8, description="Strength indicates extent to transform the reference image", maximum=1, minimum=0)

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "enable_safety_checker": self.enable_safety_checker,
            "guidance_scale": self.guidance_scale,
            "image": self.image,
            "loras": [lora.model_dump() for lora in self.loras] if self.loras else [],
            "mask_image": self.mask_image,
            "num_images": self.num_images,
            "num_inference_steps": self.num_inference_steps,
            "seed": self.seed,
            "size": f"{self.width}*{self.height}",
            "strength": self.strength,
        }
        if "loras" in payload and hasattr(self, "loras") and self.loras:
            
            LORA_SCALE_MAX_FROM_JSON = 4.0
            LORA_SCALE_DEFAULT_FROM_JSON = 1.0  

            
            loras_for_normalization = [lora.model_dump() for lora in self.loras]
            payload["loras"] = normalization_loras(loras_for_normalization, LORA_SCALE_MAX_FROM_JSON, LORA_SCALE_DEFAULT_FROM_JSON)
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path. Corresponds to api_path in the JSON."""
        return "/api/v3/wavespeed-ai/flux-dev-lora"

    def field_required(self):
        """Corresponds to required in the JSON request_schema."""
        return ["prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the JSON request_schema."""
        return ["prompt", "image", "mask_image", "strength", "loras", "size", "num_inference_steps", "guidance_scale", "num_images", "seed", "enable_base64_output", "enable_safety_checker"]
