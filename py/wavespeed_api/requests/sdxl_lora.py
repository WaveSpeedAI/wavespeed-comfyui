from typing import Optional, Union, List, Dict, Any
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras



class LoraWeightItem(BaseModel):
    path: str = Field(..., description="Path to the LoRA model")
    scale: float = Field(..., description="Scale of the LoRA model (range: 0.0 ~ 4.0)", ge=0.0, le=4.0)

# link api json(sdxl-lora.json)
class SdxlLora(BaseRequest):
    """
    SDXL consists of an ensemble of experts pipeline for latent diffusion: In a first step, 
    the base model is used to generate (noisy) latents, which are then further processed 
    with a refinement model
    """
    prompt: str = Field(..., description="Input prompt for image generation")
    image: Optional[str] = Field(default="", description="The image for image-to-image generation.")  # Description added based on common usage
    mask_image: Optional[str] = Field(
        default=None, description="The mask image tells the model where to generate new pixels (white) and where to preserve the original image (black). It acts as a stencil or guide for targeted image editing.")
    strength: Optional[float] = Field(default=0.8, ge=0.01, le=1.0, step=0.01, description="Strength indicates extent to transform the reference image")
    loras: Optional[List[LoraWeightItem]] = Field(None, description="List of LoRAs to apply (max 3)", max_items=3)
    width: Optional[int] = Field(default=1024, description="Output image width", ge=512, le=1536)
    height: Optional[int] = Field(default=1024, description="Output image height", ge=512, le=1536)
    num_inference_steps: Optional[int] = Field(default=30, ge=1, le=50, description="Number of inference steps")
    guidance_scale: Optional[float] = Field(default=5.0, ge=0.0, le=10.0, step=0.1, description="Guidance scale for generation")
    num_images: Optional[int] = Field(default=1, ge=1, le=4, description="Number of images to generate")
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
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/sdxl-lora"

    def field_required(self):
        """Corresponds to required in the interface configuration json"""
        return ["prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "image", "mask_image", "strength", "loras", "size", "num_inference_steps", "guidance_scale", "num_images", "seed", "enable_base64_output", "enable_safety_checker"]
