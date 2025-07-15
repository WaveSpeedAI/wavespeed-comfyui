from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# API JSON: google/veo3-fast.json
class GoogleVeo3Fast(BaseRequest):
    """
    Request class for Google Veo3 Fast Text-to-Video API
    """
    prompt: str = Field(..., description="The prompt to generate a video from.")
    negative_prompt: Optional[str] = Field(None, description="The negative prompt to generate a video from.")
    aspect_ratio: str = Field("16:9", description="The aspect ratio of the output video.")
    duration: int = Field(8, description="The duration of the output video in seconds.")
    enable_prompt_expansion: bool = Field(True, description="Whether to enable prompt expansion.")
    generate_audio: bool = Field(False, description="Whether to generate audio for the video.")
    seed: Optional[int] = Field(default=-1, description=" The same seed and the same prompt given to the same version of the model will output the same image every time. ")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "aspect_ratio": self.aspect_ratio,
            "duration": self.duration,
            "enable_prompt_expansion": self.enable_prompt_expansion,
            "generate_audio": self.generate_audio,
            "seed": self.seed
        }

        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/google/veo3-fast"

    def field_required(self):
        return ['prompt']

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ['prompt', 'aspect_ratio', 'duration', 'enable_prompt_expansion', 'generate_audio'] 