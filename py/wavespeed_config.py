"""
WaveSpeed Configuration Management

Provides API key retrieval from environment variable.
Primary key input is through the WaveSpeed Client node.
"""

import os
import logging


def get_api_key_from_config():
    """
    Get API key from environment variable.

    Returns:
        str: API key or None if not found
    """
    env_key = os.environ.get('WAVESPEED_API_KEY', '').strip()
    if env_key:
        logging.info("[WaveSpeed Config] Using API key from environment variable")
        return env_key

    return None
