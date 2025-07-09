from typing import Optional, Union, List, Dict, Any
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras



class LoraWeightItem(BaseModel):
    path: str = Field(..., description="Path to the LoRA model")
    scale: float = Field(..., description="Scale of the LoRA model (range: 0.0 ~ 4.0)", ge=0.0, le=4.0)

# link api json(api_doc/data/flux-dev-fill.json)
class FluxDevFill(BaseRequest):
    """
    FLUX.1 [dev] Fill is a high-performance endpoint for the FLUX.1 [dev] model that enables rapid transformation of existing images, delivering high-quality style transfers and image modifications with the core FLUX capabilities.
    """
    image: str = Field(..., description="The URL of the image to generate an image from.")
    mask_image: Optional[str] = Field(default=None, description="The URL of the mask image to generate an image from.")
    prompt: Optional[str] = Field(default=None, description="The prompt to generate an image from.")
    num_inference_steps: Optional[int] = Field(default=28, description="The number of inference steps to perform.")
    seed: Optional[int] = Field(default=-1, description=" The same seed and the same prompt given to the same version of the model will output the same image every time. ")
    guidance_scale: Optional[float] = Field(default=30, description=" The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you. ")
    num_images: Optional[int] = Field(default=1, description="The number of images to generate.")
    loras: Optional[List[LoraWeightItem]] = Field(None, description="List of LoRAs to apply (max 3)", max_items=3)
    enable_safety_checker: Optional[bool] = Field(default=True, description="If set to true, the safety checker will be enabled.")
    width: Optional[int] = Field(default=864, description="The width of the generated image.", ge=512, le=1536)
    height: Optional[int] = Field(default=1536, description="The height of the generated image.", ge=512, le=1536)

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            
            "image": self.image,
            "mask_image": self.mask_image,
            "prompt": self.prompt,
            "size": f"{self.width}*{self.height}",
            "num_inference_steps": self.num_inference_steps,
            "seed": self.seed,
            "guidance_scale": self.guidance_scale,
            "num_images": self.num_images,
            "loras": [lora.model_dump() for lora in self.loras] if self.loras else [],
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
        return "/api/v2/wavespeed-ai/flux-dev-fill"

    def field_required(self):
        return ['image']

    def field_order(self):
        """Corresponds to x-order-properties in the JSON request_schema."""
        return ['image', 'mask_image', 'prompt', 'size', 'num_inference_steps', 'seed', 'guidance_scale', 'num_images', 'loras', 'enable_safety_checker']
