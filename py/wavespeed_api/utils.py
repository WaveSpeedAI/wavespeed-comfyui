import requests
import base64
import io
import os
import numpy
import PIL
import requests
import torch
from collections.abc import Iterable
from typing import List
from pydantic import BaseModel, Field
from comfy_api.input import ImageInput, AudioInput, VideoInput
import torchaudio
import av


def imageurl2tensor(image_urls: List[str]):
    images = []
    if not image_urls:
        return torch.zeros((1, 3, 1, 1))
    for url in image_urls:
        image_data = fetch_image(url)
        image = decode_image(image_data)
        images.append(image)
    return images2tensor(images)


def fetch_image(url, stream=True):
    return requests.get(url, stream=stream).content


def save_video(video: VideoInput, save_path: str):
    video.save_to(
        save_path,
        format="mp4",
        codec="h264",
    )

def save_audio(audio: AudioInput, save_path: str):
    quality = "128k"
    format = "mp3"
     # Use original sample rate initially
    sample_rate = audio["sample_rate"]
    # Opus supported sample rates
    OPUS_RATES = [8000, 12000, 16000, 24000, 48000]

    for (batch_number, waveform) in enumerate(audio["waveform"].cpu()):
        # Use original sample rate initially
        sample_rate = audio["sample_rate"]

        # Handle Opus sample rate requirements
        if format == "opus":
            if sample_rate > 48000:
                sample_rate = 48000
            elif sample_rate not in OPUS_RATES:
                # Find the next highest supported rate
                for rate in sorted(OPUS_RATES):
                    if rate > sample_rate:
                        sample_rate = rate
                        break
                if sample_rate not in OPUS_RATES:  # Fallback if still not supported
                    sample_rate = 48000

            # Resample if necessary
            if sample_rate != audio["sample_rate"]:
                waveform = torchaudio.functional.resample(waveform, audio["sample_rate"], sample_rate)

        # Create output with specified format
        output_buffer = io.BytesIO()
        output_container = av.open(output_buffer, mode='w', format=format)

        # Set up the output stream with appropriate properties
        if format == "opus":
            out_stream = output_container.add_stream("libopus", rate=sample_rate)
            if quality == "64k":
                out_stream.bit_rate = 64000
            elif quality == "96k":
                out_stream.bit_rate = 96000
            elif quality == "128k":
                out_stream.bit_rate = 128000
            elif quality == "192k":
                out_stream.bit_rate = 192000
            elif quality == "320k":
                out_stream.bit_rate = 320000
        elif format == "mp3":
            out_stream = output_container.add_stream("libmp3lame", rate=sample_rate)
            if quality == "V0":
                #TODO i would really love to support V3 and V5 but there doesn't seem to be a way to set the qscale level, the property below is a bool
                out_stream.codec_context.qscale = 1
            elif quality == "128k":
                out_stream.bit_rate = 128000
            elif quality == "320k":
                out_stream.bit_rate = 320000
        else: #format == "flac":
            out_stream = output_container.add_stream("flac", rate=sample_rate)

        frame = av.AudioFrame.from_ndarray(waveform.movedim(0, 1).reshape(1, -1).float().numpy(), format='flt', layout='mono' if waveform.shape[0] == 1 else 'stereo')
        frame.sample_rate = sample_rate
        frame.pts = 0
        output_container.mux(out_stream.encode(frame))

        # Flush encoder
        output_container.mux(out_stream.encode(None))

        # Close containers
        output_container.close()

        # Write the output to file
        output_buffer.seek(0)
        with open(save_path, 'wb') as f:
            f.write(output_buffer.getbuffer())
        break


def tensor2images(tensor):
    np_imgs = numpy.clip(tensor.cpu().numpy() * 255.0,
                         0.0, 255.0).astype(numpy.uint8)
    return [PIL.Image.fromarray(np_img) for np_img in np_imgs]


def images2tensor(images):
    if isinstance(images, Iterable):
        return torch.stack([torch.from_numpy(numpy.array(image)).float() / 255.0 for image in images])
    return torch.from_numpy(numpy.array(images)).unsqueeze(0).float() / 255.0


def decode_image(data_bytes, rtn_mask=False):
    with io.BytesIO(data_bytes) as bytes_io:
        img = PIL.Image.open(bytes_io)
        if not rtn_mask:
            img = img.convert('RGB')
        elif 'A' in img.getbands():
            img = img.getchannel('A')
        else:
            img = None
    return img


def encode_image(img, mask=None):
    if mask is not None:
        img = img.copy()
        img.putalpha(mask)
    with io.BytesIO() as bytes_io:
        if mask is not None:
            img.save(bytes_io, format='PNG')
        else:
            img.save(bytes_io, format='JPEG')
        data_bytes = bytes_io.getvalue()
    return data_bytes


def image_to_base64(image):
    if image is None:
        return None
    return base64.b64encode(encode_image(tensor2images(image)[0])).decode("utf-8")


def image_to_base64s(tensor):
    if tensor is None:
        return None
    images = tensor2images(tensor)
    return [base64.b64encode(encode_image(image)).decode("utf-8") for image in images]


def check_lora_path(path):
    """Checks if the LoRA path is valid."""
    if path.startswith('http://') or path.startswith('https://'):
        return path
    elif '/' in path and not path.startswith('/'):
        # Ensure format is 'username/model-name'
        parts = path.split('/')
        if len(parts) == 2 and all(part.strip() for part in parts):
            return path
    raise ValueError(
        "Invalid LoRA path format. It should be either a full URL or in the format 'username/model-name'.")


def normalization_loras(loras, scale_max, scale_default):
    """Normalizes and validates a list of LoRA dictionaries."""
    _loras = []
    if not loras:
        return _loras
    for lora in loras:
        if "path" in lora:
            lora_path = lora["path"]
            if lora_path:
                lora_path = lora_path.strip()
            if lora_path:
                lora_scale = lora.get("scale", scale_default)
                if lora_scale < 0 or lora_scale > scale_max:
                    raise ValueError(
                        f"Invalid {lora_path} LoRA scale. It should be between 0 and {scale_max}.")
                _loras.append({"path": check_lora_path(
                    lora_path), "scale": lora_scale})

    return _loras


class BaseRequest(BaseModel):
    """Base class for all API request objects."""

    def build_payload(self):
        """Builds the request payload dictionary."""
        raise NotImplementedError("Subclasses must implement build_payload")

    def get_api_path(self):
        """Gets the API path for the request."""
        raise NotImplementedError("Subclasses must implement path")

    def _remove_empty_fields(self, payload):
        """Removes None, empty string, and empty dict values from payload."""
        return {k: v for k, v in payload.items() if v is not None and (v != "" and v != {})}

    def field_order(self):
        """Get field order"""
        raise NotImplementedError("Subclasses must implement field order")
