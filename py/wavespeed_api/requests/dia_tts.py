from typing import Optional, Union, List
from pydantic import BaseModel, Field
from ..utils import BaseRequest  # Adjusted import path


# link api json(api_doc/data/dia-tts.json)
class DiaTts(BaseRequest):
    """
    Dia directly generates realistic dialogue from transcripts. Audio conditioning enables emotion control. Produces natural nonverbals like laughter and throat clearing. will cost $0.04 per 1000 character.
    """
    # --- Fields based on request_schema ---
    prompt: str = Field(
        ...,
        description="The text to be converted to speech.")

    def build_payload(self) -> dict:
        """Builds the request payload dictionary."""
        payload = {
            "prompt": self.prompt,
        }
        return payload

    def get_api_path(self) -> str:
        """Gets the API path for the request. Corresponds to api_path in the interface configuration json"""
        return "/api/v3/wavespeed-ai/dia-tts"

    def field_required(self) -> List[str]:
        """Corresponds to required in the interface configuration json"""
        return ["prompt"]

    def field_order(self) -> List[str]:
        """Corresponds to x-order-properties in the interface configuration json"""
        return ["prompt"]
