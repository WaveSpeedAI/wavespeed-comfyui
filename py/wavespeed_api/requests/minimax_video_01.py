from typing import Optional
from pydantic import Field
from ..utils import BaseRequest


class MinimaxVideo01(BaseRequest):
    """
    Generate 6s videos with prompts or images. (Also known as Hailuo). 
    Use a subject reference to make a video with a character and the S2V-01 model.
    """
    prompt: str = Field(
        ...,
        description=
        "Generate a description of the video.(Note: Maximum support 2000 characters). 1. Support inserting mirror operation instructions to realize mirror operation control: mirror operation instructions need to be inserted into the lens application position in prompt in the format of [ ]. The standard mirror operation instruction format is [C1,C2,C3], where C represents different types of mirror operation. In order to ensure the effect of mirror operation, it is recommended to combine no more than 3 mirror operation instructions. 2. Support natural language description to realize mirror operation control; using the command internal mirror name will improve the accuracy of mirror operation response. 3. mirror operation instructions and natural language descriptions can be effective at the same time.",
        maxLength=2000,
        title="Prompt")
    image: Optional[str] = Field(
        None,
        description=
        "The model generates video with the picture passed in as the first frame.Base64 encoded strings in data:image/jpeg; base64,{data} format for incoming images, or URLs accessible via the public network. The uploaded image needs to meet the following conditions: Format is JPG/JPEG/PNG; The aspect ratio is greater than 2:5 and less than 5:2; Short side pixels greater than 300px; The image file size cannot exceed 20MB.",
        title="First Frame Image")
    enable_prompt_expansion: Optional[bool] = Field(
        True,  # Default value from JSON
        description="The model automatically optimizes incoming prompts to improve build quality.",
        title="Use prompt optimizer")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
            "image": self.image,
            "enable_prompt_expansion": self.enable_prompt_expansion,
        }
        return self._remove_empty_fields(payload)

    def get_api_path(self):
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/minimax/video-01"

    def field_required(self):
        """Corresponds to required in the interface configuration json"""
        return ["prompt"]

    def field_order(self):
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt", "image", "enable_prompt_expansion"]
