from .wavespeed_api.client import WaveSpeedClient
from .wavespeed_api.requests.dia_tts import DiaTts


class DiaTTSNode:
    """
    WaveSpeed AI Dia TTS Node

    This node uses WaveSpeed AI's Dia model to generate dialogue from text.
    """

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "client": ("WAVESPEED_AI_API_CLIENT",),
                "prompt": ("STRING", {"multiline": True, "default": "", "tooltip": "The text to be converted to speech."}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("audio_url",)

    CATEGORY = "WaveSpeedAI"
    FUNCTION = "execute"
    
    def execute(self,
                client,
                prompt):
        """
        Generate audio from text using the Dia TTS model.

        Args:
            client: WaveSpeed AI API client
            prompt: The text to be converted to speech.

        Returns:
            tuple: (audio_url,)
        """
        if prompt is None or prompt == "":
            raise ValueError("Prompt is required")

        request = DiaTts(prompt=prompt)
        waveSpeedClient = WaveSpeedClient(client["api_key"])
        response = waveSpeedClient.send_request(request, True, 1)

        audio_url = response.get("outputs", [])
        if not audio_url:
            raise ValueError("No audio URL in the generated result")
        return (audio_url[0],)


NODE_CLASS_MAPPINGS = {
    "WaveSpeedAI DiaTTSNode": DiaTTSNode
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "WaveSpeedAI DiaTTSNode": "WaveSpeedAI Dia TTS"
}
#'