"""
WaveSpeed Client Node

Provides API key configuration through a dedicated node.
Users connect this node to the Predictor node to supply the API key.
"""

import os
from .wavespeed_api.client import WaveSpeedClient as APIClient
from .wavespeed_api_endpoints import set_global_api_key


class WaveSpeedClient:
    """
    WaveSpeed Client Node - API Key Provider

    Enter your WaveSpeed API key here and connect to the Predictor node.
    Supports fallback to WAVESPEED_API_KEY environment variable.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "api_key": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "tooltip": "Your WaveSpeed API key. Get one at https://wavespeed.ai. "
                               "Leave empty to use WAVESPEED_API_KEY environment variable."
                }),
            }
        }

    RETURN_TYPES = ("WAVESPEED_CLIENT",)
    RETURN_NAMES = ("client",)
    CATEGORY = "WaveSpeedAI"
    FUNCTION = "create_client"

    def create_client(self, api_key):
        api_key = api_key.strip()

        if not api_key:
            # Fallback to environment variable
            api_key = os.environ.get('WAVESPEED_API_KEY', '').strip()

        if not api_key:
            raise ValueError(
                "No API key provided. Please enter your WaveSpeed API key "
                "or set the WAVESPEED_API_KEY environment variable. "
                "Get a key at https://wavespeed.ai"
            )

        # Set global key so upload endpoint can use it immediately
        set_global_api_key(api_key)

        client = APIClient(api_key)
        return (client,)


NODE_CLASS_MAPPINGS = {
    "WaveSpeedClient": WaveSpeedClient,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedClient": "WaveSpeed Client ⚡",
}
