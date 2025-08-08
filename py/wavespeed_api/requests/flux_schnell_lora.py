from typing import Optional, Union, List, Any, Dict
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras



class LoraWeightItem(BaseModel):
    path: str = Field(..., description="Path to the LoRA model")
    scale: float = Field(..., description="Scale of the LoRA model (range: 0.0 ~ 4.0)", ge=0.0, le=4.0)

# link api json(api_doc/data/flux-schnell-lora.json)
class FluxSchnellLora(BaseRequest):
    """
    FLUX.1 [schnell] is a 12 billion parameter flow transformer that generates high-quality images from text in 1 to 4 steps, suitable for personal and commercial use.
    """
    prompt: str = Field(..., description="Input prompt for image generation")
    image: Optional[str] = Field('', description="")
    mask_image: Optional[str] = Field(
        None, description="The mask image tells the model where to generate new pixels (white) and where to preserve the original image (black). It acts as a stencil or guide for targeted image editing.")
    strength: Optional[float] = Field(0.8, description="Strength indicates extent to transform the reference image")
    loras: Optional[List[LoraWeightItem]] = Field(None, description="List of LoRAs to apply (max 3)", max_items=3)
    width: Optional[int] = Field(1024, description="Output image width", ge=512, le=1536)
    height: Optional[int] = Field(1024, description="Output image height", ge=512, le=1536)
    num_inference_steps: Optional[int] = Field(4, description="Number of inference steps")
    guidance_scale: Optional[float] = Field(3.5, description="The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you.")
    num_images: Optional[int] = Field(1, description="Number of images to generate")
    seed: Optional[int] = Field(-1, description="Random seed (-1 for random)")
    enable_safety_checker: Optional[bool] = Field(True, description="Enable safety checker")

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
        return "/api/v3/wavespeed-ai/flux-schnell-lora"

    def field_required(self):
        return ['prompt']

    def field_order(self):
        """Corresponds to x-order-properties in the JSON request_schema."""
        return ['prompt', 'image', 'mask_image', 'strength', 'loras', 'size', 'num_inference_steps', 'guidance_scale', 'num_images', 'seed', 'enable_base64_output', 'enable_safety_checker']
