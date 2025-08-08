from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


# link api json(mmaudio-v2.json)
class MmaudioV2(BaseRequest):
    """
    MMAudio generates synchronized audio given video and/or text inputs. It can be combined with video models to get videos with audio.
    """
    video: str = Field(..., description="The URL of the video to generate the audio for.")
    prompt: str = Field(..., description="The prompt to generate the audio for.")
    negative_prompt: Optional[str] = Field("", description="The negative prompt to generate the audio for.")
    seed: Optional[int] = Field(-1, description="The seed for the random number generator")
    num_inference_steps: Optional[int] = Field(25, description="The number of steps to generate the audio for.", ge=4, le=50)
    duration: Optional[int] = Field(8, description="The duration of the audio to generate.", ge=1, le=30, step=1)
    guidance_scale: Optional[float] = Field(4.5, description="The strength of Classifier Free Guidance.", ge=0, le=20)
    mask_away_clip: Optional[bool] = Field(False, description="Whether to mask away the clip.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "video": self.video,
            "prompt": self.prompt,
            "negative_prompt": self.negative_prompt,
            "seed": self.seed,
            "num_inference_steps": self.num_inference_steps,
            "duration": self.duration,
            "guidance_scale": self.guidance_scale,
            "mask_away_clip": self.mask_away_clip,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/mmaudio-v2"

    def field_required(self):
        return ['video', 'prompt']

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ['video', 'prompt', 'negative_prompt', 'seed', 'num_inference_steps', 'duration', 'guidance_scale', 'mask_away_clip']
