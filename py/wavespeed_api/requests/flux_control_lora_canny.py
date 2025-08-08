from typing import Optional, Union, List, Dict, Any
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras


class LoraWeightItem(BaseModel):
    path: str = Field(..., description="Path to the LoRA model")
    scale: float = Field(..., description="Scale of the LoRA model (range: 0.0 ~ 4.0)", ge=0.0, le=4.0)


# link api json(api_doc/data/flux-control-lora-canny.json)
class FluxControlLoraCanny(BaseRequest):
    """
    FLUX Control LoRA Canny is a high-performance endpoint that uses a control image to transfer structure to the generated image, using a Canny edge map.
    """
    control_image: Optional[str] = Field(..., description="The image to use for control lora. This is used to control the style of the generated image.")
    control_scale: Optional[float] = Field(1, description="The scale of the control image.", ge=0, le=2)
    enable_safety_checker: Optional[bool] = Field(True, description="If set to true, the safety checker will be enabled.")
    guidance_scale: Optional[float] = Field(
        3.5, description="The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt when looking for a related image to show you", ge=1, le=30)
    loras: Optional[List[LoraWeightItem]] = Field(None, description="List of LoRAs to apply (max 3)", max_items=3)
    num_images: Optional[int] = Field(1, description="The number of images to generate", ge=1, le=4)
    num_inference_steps: Optional[int] = Field(28, description="The number of inference steps to perform.", ge=1, le=50)
    prompt: str = Field(..., description="The prompt to generate an image from.")  # 'descrption' in JSON, using 'description'
    seed: Optional[int] = Field(-1, description="\n            The same seed and the same prompt given to the same version of the model\n            will output the same image every time.\n        ")
    width: Optional[int] = Field(864, description="The width of the generated image.", ge=512, le=1536)
    height: Optional[int] = Field(1536, description="The height of the generated image.", ge=512, le=1536)

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "control_image": self.control_image,
            "control_scale": self.control_scale,
            "enable_safety_checker": self.enable_safety_checker,
            "guidance_scale": self.guidance_scale,
            "loras": [lora.model_dump() for lora in self.loras] if self.loras else [],
            "num_images": self.num_images,
            "num_inference_steps": self.num_inference_steps,
            "seed": self.seed,
            "size": f"{self.width}*{self.height}",
        }
        if "loras" in payload and hasattr(self, "loras") and self.loras:
            LORA_SCALE_MAX_FROM_JSON = 4.0
            LORA_SCALE_DEFAULT_FROM_JSON = 1.0  

            loras_for_normalization = [lora.model_dump() for lora in self.loras]
            payload["loras"] = normalization_loras(loras_for_normalization, LORA_SCALE_MAX_FROM_JSON, LORA_SCALE_DEFAULT_FROM_JSON)
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/flux-control-lora-canny"

    def field_required(self):
        return ["prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "control_image", "loras", "size", "control_scale", "seed", "num_images", "num_inference_steps", "guidance_scale", "enable_safety_checker"]
