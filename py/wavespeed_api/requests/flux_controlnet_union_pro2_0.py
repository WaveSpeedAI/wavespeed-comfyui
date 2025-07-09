# -*- coding: utf-8 -*-
from typing import Optional, List
from pydantic import BaseModel, Field
from ..utils import BaseRequest, normalization_loras

class LoraWeightItem(BaseModel):
    path: str = Field(..., description="Path to the LoRA model")
    scale: float = Field(..., description="Scale of the LoRA model (range: 0.0 ~ 4.0)", ge=0.0, le=4.0)

class FluxControlnetUnionPro2_0Request(BaseRequest):
    """
    FLUX ControlNet Union Pro 2.0 is a high-performance endpoint that uses a control image to transfer structure to the generated image.
    """
    prompt: str = Field(..., description="The prompt to generate an image from.")
    control_image: str = Field(..., description="The image to use for control. This is used to control the structure of the generated image.")
    controlnet_conditioning_scale: Optional[float] = Field(default=0.7, description="The scale of the controlnet conditioning.", ge=0.0, le=2.0,step=0.01)
    control_guidance_start: Optional[float] = Field(default=0.0, description="The start of the control guidance.", ge=0.0, le=1.0,step=0.01)
    control_guidance_end: Optional[float] = Field(default=0.8, description="The end of the control guidance.", ge=0.0, le=1.0,step=0.01)
    guidance_scale: Optional[float] = Field(
        default=3.5, description="The CFG (Classifier Free Guidance) scale.", ge=0.0, le=20.0,step=0.01)
    num_inference_steps: Optional[int] = Field(default=28, description="The number of inference steps to perform.", ge=1, le=50)
    seed: Optional[int] = Field(0, description="The seed for the generation.")
    num_images: Optional[int] = Field(default=1, description="The number of images to generate.", ge=1, le=4)
    size: Optional[str] = Field("1024*1024", description="The size of the generated image.")
    loras: Optional[List[LoraWeightItem]] = Field(None, description="List of LoRAs to apply (max 3)", max_items=3)
    enable_safety_checker: Optional[bool] = Field(default=True, description="If set to true, the safety checker will be enabled.")
    enable_base64_output: Optional[bool] = Field(default=False, description="Enable base64 output.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "control_image": self.control_image,
            "controlnet_conditioning_scale": self.controlnet_conditioning_scale,
            "control_guidance_start": self.control_guidance_start,
            "control_guidance_end": self.control_guidance_end,
            "guidance_scale": self.guidance_scale,
            "num_inference_steps": self.num_inference_steps,
            "seed": self.seed,
            "num_images": self.num_images,
            "size": self.size,
            "loras": [lora.model_dump() for lora in self.loras] if self.loras else [],
            "enable_safety_checker": self.enable_safety_checker,
            "enable_base64_output": self.enable_base64_output,
        }
        if "loras" in payload and hasattr(self, "loras") and self.loras:
            LORA_SCALE_MAX_FROM_JSON = 4.0
            LORA_SCALE_DEFAULT_FROM_JSON = 1.0
            loras_for_normalization = [lora.model_dump() for lora in self.loras]
            payload["loras"] = normalization_loras(loras_for_normalization, LORA_SCALE_MAX_FROM_JSON, LORA_SCALE_DEFAULT_FROM_JSON)
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request."""
        return "/api/v3/wavespeed-ai/flux-controlnet-union-pro-2.0"

    def field_required(self):
        return ["prompt", "control_image"]

    def field_order(self):
        """Defines the order of fields in the UI."""
        return [
            "prompt", "control_image", "loras", "controlnet_conditioning_scale",
            "control_guidance_start", "control_guidance_end", "seed", "num_images",
            "size", "num_inference_steps", "guidance_scale", "enable_safety_checker",
            "enable_base64_output"
        ]