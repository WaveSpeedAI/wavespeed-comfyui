from typing import Optional, Union, List, Dict, Any
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras




class LoraWeightItem(BaseModel):
    path: str = Field(..., description="Path to the LoRA model")
    scale: float = Field(..., description="Scale of the LoRA model (range: 0.0 ~ 4.0)", ge=0.0, le=4.0)


class Wan2x1T2V480pLoraUltraFast(BaseRequest):
    """
    Turbo-charged inference for Wan 2.1 14B. Unleashing high-res 480p text-to-video prowess 
    with cutting-edge suite of video foundation models, LoRA effect added
    """
    prompt: str = Field(..., description="The prompt for generating the output.")
    negative_prompt: Optional[str] = Field("", description="The negative prompt for generating the output.")
    loras: Optional[List[LoraWeightItem]] = Field(None, description="The LoRA weights for generating the output.", max_items=3)
    size: Optional[str] = Field("832*480", description="The size of the output.", enum=['832*480', '480*832'])
    num_inference_steps: Optional[int] = Field(30, description="The number of inference steps.", ge=1, le=40)
    duration: Optional[int] = Field(5, description="Generate video duration length seconds.", ge=5, le=10)  # JSON step:5 not directly used by Pydantic Field
    guidance_scale: Optional[float] = Field(5.0, description="The guidance scale for generation.", ge=1.01, le=10.0)
    flow_shift: Optional[float] = Field(3.0, description="The shift value for the timestep schedule for flow matching.", ge=1.0, le=10.0)
    seed: Optional[int] = Field(-1, description="The seed for random number generation.")
    enable_safety_checker: Optional[bool] = Field(True, description="Whether to enable the safety checker.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "loras": [lora.model_dump() for lora in self.loras] if self.loras else [],
            "size": self.size,
            "num_inference_steps": self.num_inference_steps,
            "duration": self.duration,
            "guidance_scale": self.guidance_scale,
            "flow_shift": self.flow_shift,
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
        return "/api/v3/wavespeed-ai/wan-2.1/t2v-480p-lora-ultra-fast"

    def field_required(self):
        return ["prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "negative_prompt", "loras", "size", "num_inference_steps", "duration", "guidance_scale", "flow_shift", "seed", "enable_safety_checker"]
