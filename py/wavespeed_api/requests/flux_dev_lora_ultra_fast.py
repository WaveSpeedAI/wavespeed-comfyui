from typing import Optional, Union, List, Any, Dict
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras

# Based on api_doc/data/flux-dev-lora-ultra-fast.json




class LoraWeightItem(BaseModel):
    path: str = Field(..., description="Path to the LoRA model")
    scale: float = Field(..., description="Scale of the LoRA model (range: 0.0 ~ 4.0)", ge=0.0, le=4.0)


class FluxDevLoraUltraFast(BaseRequest):
    """
    Rapid, high-quality image generation with FLUX.1 [dev] and LoRA support for personalized styles and brand-specific outputs, ultra fast !
    Corresponds to API JSON: api_doc/data/flux-dev-lora-ultra-fast.json
    """
    # --- Fields based on request_schema.properties ---
    # Order from x-order-properties in JSON
    prompt: str = Field(..., description="Input prompt for image generation")
    image: Optional[str] = Field(default=None, description="Input image for image-to-image generation. Publicly accessible URL.")
    mask_image: Optional[str] = Field(default=None, description="The mask image tells the model where to generate new pixels (white) and where to preserve the original image (black). Publicly accessible URL.")
    strength: Optional[float] = Field(default=0.8, description="Strength indicates extent to transform the reference image (for image-to-image)", ge=0.01, le=1.0)
    loras: Optional[List[LoraWeightItem]] = Field(None, description="List of LoRAs to apply (max 3)", max_items=3)
    width: Optional[int] = Field(default=1024, description="The width of the generated image.", ge=512, le=1536)
    height: Optional[int] = Field(default=1024, description="The height of the generated image.", ge=512, le=1536)
    num_inference_steps: Optional[int] = Field(default=28, description="Number of inference steps", ge=1, le=50)
    guidance_scale: Optional[float] = Field(default=3.5, description="Guidance scale for generation", ge=0.0, le=10.0)
    num_images: Optional[int] = Field(default=1, description="Number of images to generate", ge=1, le=4)
    seed: Optional[int] = Field(default=-1, description="Random seed (-1 for random)") 
    enable_safety_checker: Optional[bool] = Field(default=True, description="Enable safety checker") 

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "mask_image": self.mask_image,
            "strength": self.strength,
            "loras": [lora.model_dump() for lora in self.loras] if self.loras else [],
            "size": f"{self.width}*{self.height}",
            "num_inference_steps": self.num_inference_steps,
            "guidance_scale": self.guidance_scale,
            "num_images": self.num_images,
            "seed": self.seed,
            "enable_safety_checker": self.enable_safety_checker,
        }
        if "loras" in payload and hasattr(self, "loras") and self.loras:
            
            LORA_SCALE_MAX_FROM_JSON = 4.0
            LORA_SCALE_DEFAULT_FROM_JSON = 1.0  

            
            loras_for_normalization = [lora.model_dump() for lora in self.loras]
            payload["loras"] = normalization_loras(loras_for_normalization, LORA_SCALE_MAX_FROM_JSON, LORA_SCALE_DEFAULT_FROM_JSON)
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path. Corresponds to api_path in the JSON."""
        return "/api/v3/wavespeed-ai/flux-dev-lora-ultra-fast"  # From api_schema.api_schemas[0].api_path

    def field_required(self):
        """Corresponds to request_schema.required in the JSON."""
        return ["prompt"]  # From request_schema.required

    def field_order(self):
        """Corresponds to x-order-properties in the JSON request_schema."""
        return [
            "prompt", "image", "mask_image", "strength", "loras", "size", "num_inference_steps", "guidance_scale", "num_images", "seed", "enable_base64_output", "enable_safety_checker"
        ]  # From request_schema.x-order-properties
