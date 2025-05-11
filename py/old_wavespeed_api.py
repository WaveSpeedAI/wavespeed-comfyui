import time
import requests


class WaveSpeedAPI:
    """
    WaveSpeed AI API Aggregation Class

    This class provides all API functionalities of WaveSpeed AI, including text-to-video, image-to-video, image generation, etc.
    """

    BASE_URL = "https://api.wavespeed.ai/api/v2"

    def __init__(self, api_key):
        """
        Initialize WaveSpeed AI API client

        Args:
            api_key (str): WaveSpeed AI API key
        """
        self.api_key = api_key
        self.once_timeout = 600  # Default timeout is 600 seconds (10 minutes)

        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def _check_lora_path(self, path):
        if path.startswith('http://') or path.startswith('https://'):
            return path
        elif '/' in path and not path.startswith('/'):
            # Ensure format is 'username/model-name'
            parts = path.split('/')
            if len(parts) == 2 and all(part.strip() for part in parts):
                return path
        raise ValueError("Invalid LoRA path format. It should be either a full URL or in the format 'username/model-name'.")

    def _normalization_loras(self, loras, scale_max, scale_default):
        _loras = []
        if not loras:
            return _loras
        for lora in loras:
            if "path" in lora:
                lora_path = lora["path"]
                if lora_path:
                    lora_path = lora_path.strip()
                if lora_path:
                    lora_scale = lora["scale"] if "scale" in lora else scale_default
                    if lora_scale < 0 or lora_scale > scale_max:
                        raise ValueError(f"Invalid {lora_path} LoRA scale. It should be between 0 and {scale_max}.")
                    _loras.append({"path": self._check_lora_path(lora_path), "scale": lora_scale})

        return _loras

    def post(self, endpoint, payload, timeout=30):
        """
        Send POST request to WaveSpeed AI API

        Args:
            endpoint (str): API endpoint
            payload (dict): Request payload
            timeout (float, optional): Request timeout in seconds

        Returns:
            dict: API response
        """
        url = f"{self.BASE_URL}/{endpoint}"
        response = requests.post(url, headers=self.headers, json=payload, timeout=timeout)

        if response.status_code != 200:
            error_message = f"Error: {response.status_code}"
            try:
                error_data = response.json()
                if "error" in error_data:
                    error_message = f"Error: {error_data['error']}"
            except:
                pass
            raise Exception(error_message)

        response_data = response.json()
        if isinstance(response_data, dict) and 'code' in response_data:
            if response_data['code'] != 200:
                raise Exception(f"API Error: {response_data.get('message', 'Unknown error')}")
            return response_data.get('data', {})
        return response_data

    def get(self, endpoint, params=None, timeout=30):
        """
        Send GET request to WaveSpeed AI API

        Args:
            endpoint (str): API endpoint
            params (dict, optional): Query parameters
            timeout (float, optional): Request timeout in seconds

        Returns:
            dict: API response
        """
        url = f"{self.BASE_URL}/{endpoint}"
        response = requests.get(url, headers=self.headers, params=params, timeout=timeout)

        if response.status_code != 200:
            error_message = f"Error: {response.status_code}"
            try:
                error_data = response.json()
                if "error" in error_data:
                    error_message = f"Error: {error_data['error']}"
            except:
                pass
            raise Exception(error_message)

        response_data = response.json()
        if isinstance(response_data, dict) and 'code' in response_data:
            if response_data['code'] != 200:
                raise Exception(f"API Error: {response_data.get('message', 'Unknown error')}")
            return response_data.get('data', {})
        return response_data

    def check_task_status(self, request_id):
        """
        Check the status of a task

        Args:
            request_id (str): Task ID

        Returns:
            dict: Task status information, including status, progress, output, etc.
        """

        if not request_id:
            raise Exception("No valid task ID provided")

        return self.get(f"predictions/{request_id}/result")

    def wait_for_task(self, request_id, polling_interval=5, timeout=None):
        """
        Wait for task completion and return the result

        Args:
            request_id (str, optional): Task ID. If not provided, uses the most recent task ID
            polling_interval (int): Polling interval in seconds
            timeout (int): Maximum time to wait for task completion in seconds

        Returns:
            dict: Task result

        Raises:
            Exception: If the task fails or times out
        """
        if not timeout:
            timeout = self.once_timeout

        if not request_id:
            raise Exception("No valid task ID provided")

        start_time = time.time()
        while time.time() - start_time < timeout:
            task_status = self.check_task_status(request_id)
            status = task_status.get("status")

            if status == "completed":
                return task_status
            elif status == "failed":
                error_message = task_status.get("error", "Task failed")
                raise Exception(f"Task failed: {error_message}")

            # Wait before polling again
            time.sleep(polling_interval)

        raise Exception("Task timed out")

    # ===== image to Video  API =====

    def minimax_image_to_video(self,
                               model="",
                               first_frame_image="",
                               prompt="",
                               prompt_optimizer=False,
                               subject_reference="",
                               wait_for_completion=True):
        """
        Image to Video generation

        Args:
            model (str, optional): Model name
            first_frame_image (str, optional): URL of the image to use as the first frame of the video
            prompt (str, required): Text description of the video content to generate
            prompt_optimizer (bool, optional): Whether to automatically optimize the prompt for better results. Default is False
            subject_reference (str, optional): URL of an image containing the subject to reference for consistent appearance
            wait_for_completion (bool, optional): Whether to wait for task completion

        Returns:
            dict: Result containing video URL and task ID
        """
        # Parameter validation
        if not prompt or not isinstance(prompt, str):
            raise ValueError("prompt must be a string")

        # Construct payload
        payload = {
            "first_frame_image": first_frame_image,
            "prompt": prompt,
            "prompt_optimizer": prompt_optimizer,
            "subject_reference": subject_reference,
        }

        if model == "minimax/video-01":
            endpoint = "minimax/video-01"
        else:
            raise ValueError(f"Invalid model: {model}")
        # Remove empty fields
        payload = {k: v for k, v in payload.items() if v is not None and (v != "" and v != {})}

        response = self.post(endpoint, payload)

        # Get request ID
        request_id = response.get("id")
        if not request_id:
            raise Exception("No request ID in response")

        if not wait_for_completion:
            return {
                "request_id": request_id,
                "status": "processing"
            }

        # Wait for task completion
        task_result = self.wait_for_task(request_id)

        # Extract video URL
        video_url = task_result.get("outputs", [])

        if not video_url or len(video_url) == 0:
            raise Exception("No video URL in result")

        return {
            "video_url": video_url[0],
            "request_id": request_id
        }

    # ===== image to Video  API =====
    def wan_image_to_video(self,
                           model="",
                           image="",
                           prompt="",
                           negative_prompt="",
                           loras=[],
                           size="",
                           num_inference_steps=30,
                           guidance_scale=5.0,
                           seed=-1,
                           enable_safety_checker=True,
                           wait_for_completion=True):
        """
        Text to Video generation

        Args:
            model (str, optional): Model name
            image (str, optional): Image URL
            prompt (str, optional): Prompt text to guide video generation
            negative_prompt (str, optional): Negative prompt to specify what to avoid in the video
            loras (list): List of LoRA models to apply (max 3 items)
                Each item should be a dict with 'path' (str) and 'scale' (float, optional)
            size (str, optional): Video dimensions in width*height format
            num_inference_steps (int, optional): Number of inference steps
            guidance_scale (float, optional): Guidance scale for generation
            seed (int, optional): Random seed for reproducible results. -1 for random seed
            enable_safety_checker (bool, optional): Enable safety checker for generated content
            wait_for_completion (bool, optional): Whether to wait for task completion

        Returns:
            dict: Result containing video URL and task ID
        """
        # Parameter validation
        if num_inference_steps < 1 or num_inference_steps > 40:
            raise ValueError("num_inference_steps must be between 1 and 40")
        if guidance_scale < 0.0 or guidance_scale > 10.0:
            raise ValueError("guidance_scale must be between 0.0 and 10.0")
        # Image validation
        if not image or not isinstance(image, str) or not image.startswith(('http://', 'https://')):
            raise ValueError("image must be a valid URL string")

        # Construct payload
        payload = {
            "image": image,
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "seed": seed if seed > 0 else -1,
            "enable_safety_checker": enable_safety_checker,
        }

        real_loras = self._normalization_loras(loras, 1.0, 0.8)
        if len(real_loras) > 3:
            raise ValueError("Maximum of 3 LoRA models can be applied")

        payload["loras"] = real_loras
        size_limit = []
        if model == "wan-2.1/i2v-720p":
            if size == "" or size == None:
                size = "1280*720"
            size_limit.append("1280*720")
            size_limit.append("720*1280")
            if len(real_loras) > 0:
                endpoint = "wavespeed-ai/wan-2.1/i2v-720p-lora"
            else:
                endpoint = "wavespeed-ai/wan-2.1/i2v-720p"
        elif model == "wan-2.1/i2v-480p":
            if size == "" or size == None:
                size = "832*480"
            size_limit.append("832*480")
            size_limit.append("480*832")
            if len(real_loras) > 0:
                endpoint = "wavespeed-ai/wan-2.1/i2v-480p-lora"
            else:
                endpoint = "wavespeed-ai/wan-2.1/i2v-480p"
        elif model == "wan-2.1/i2v-720p-ultra-fast":
            if size == "" or size == None:
                size = "1280*720"
            size_limit.append("1280*720")
            size_limit.append("720*1280")
            if len(real_loras) > 0:
                endpoint = "wavespeed-ai/wan-2.1/i2v-720p-lora-ultra-fast"
            else:
                endpoint = "wavespeed-ai/wan-2.1/i2v-720p-ultra-fast"
                raise ValueError(f"Invalid model: {model}, this model needs LoRA")
        elif model == "wan-2.1/i2v-480p-ultra-fast":
            if size == "" or size == None:
                size = "832*480"
            size_limit.append("832*480")
            size_limit.append("480*832")
            if len(real_loras) > 0:
                endpoint = "wavespeed-ai/wan-2.1/i2v-480p-lora-ultra-fast"
                raise ValueError(f"Invalid model: {model}, this model does not support LoRA ")
            else:
                endpoint = "wavespeed-ai/wan-2.1/i2v-480p-ultra-fast"
        else:
            raise ValueError(f"Invalid model: {model}")

        if size not in size_limit:
            raise ValueError(f"Invalid size: {size}. Allowed sizes for {model} are {', '.join(size_limit)}")

        payload["size"] = size
        # Remove empty fields
        payload = {k: v for k, v in payload.items() if v is not None and (v != "" and v != {})}

        response = self.post(endpoint, payload)

        # Get request ID
        request_id = response.get("id")
        if not request_id:
            raise Exception("No request ID in response")

        if not wait_for_completion:
            return {
                "request_id": request_id,
                "status": "processing"
            }

        # Wait for task completion
        task_result = self.wait_for_task(request_id)

        # Extract video URL
        video_url = task_result.get("outputs", [])

        if not video_url or len(video_url) == 0:
            raise Exception("No video URL in result")

        return {
            "video_url": video_url[0],
            "request_id": request_id
        }

    # ===== Text to Video API =====
    def wan_text_to_video(self,
                          model="",
                          prompt="",
                          negative_prompt="",
                          loras=[],
                          size="",
                          num_inference_steps=30,
                          guidance_scale=5.0,
                          seed=-1,
                          enable_safety_checker=True,
                          wait_for_completion=True):
        """
        Text to Video generation

        Args:
            model (str, optional): Model name
            prompt (str, optional): Prompt text to guide video generation
            negative_prompt (str, optional): Negative prompt to specify what to avoid in the video
            loras (list): List of LoRA models to apply (max 3 items)
                Each item should be a dict with 'path' (str) and 'scale' (float, optional)
            size (str, optional): Video dimensions in width*height format
            num_inference_steps (int, optional): Number of inference steps
            guidance_scale (float, optional): Guidance scale for generation
            seed (int, optional): Random seed for reproducible results. -1 for random seed
            enable_safety_checker (bool, optional): Enable safety checker for generated content
            wait_for_completion (bool, optional): Whether to wait for task completion

        Returns:
            dict: Result containing video URL and task ID
        """
        # Parameter validation
        if num_inference_steps < 1 or num_inference_steps > 40:
            raise ValueError("num_inference_steps must be between 1 and 40")
        if guidance_scale < 0.0 or guidance_scale > 10.0:
            raise ValueError("guidance_scale must be between 0.0 and 10.0")

        # Construct payload
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
            "seed": seed if seed > 0 else -1,
            "enable_safety_checker": enable_safety_checker,
        }

        real_loras = self._normalization_loras(loras, 1.0, 0.8)
        if len(real_loras) > 3:
            raise ValueError("Maximum of 3 LoRA models can be applied")

        payload["loras"] = real_loras
        size_limit = []
        if model == "wan-2.1/t2v-720p":
            if size == "" or size == None:
                size = "1280*720"
            size_limit.append("1280*720")
            size_limit.append("720*1280")
            if len(real_loras) > 0:
                endpoint = "wavespeed-ai/wan-2.1/t2v-720p-lora"
            else:
                endpoint = "wavespeed-ai/wan-2.1/t2v-720p"
        elif model == "wan-2.1/t2v-480p":
            if size == "" or size == None:
                size = "832*480"
            size_limit.append("832*480")
            size_limit.append("480*832")
            if len(real_loras) > 0:
                endpoint = "wavespeed-ai/wan-2.1/t2v-480p-lora"
            else:
                endpoint = "wavespeed-ai/wan-2.1/t2v-480p"
        elif model == "wan-2.1/t2v-720p-ultra-fast":
            if size == "" or size == None:
                size = "1280*720"
            size_limit.append("1280*720")
            size_limit.append("720*1280")
            if len(real_loras) > 0:
                endpoint = "wavespeed-ai/wan-2.1/t2v-720p-lora-ultra-fast"
            else:
                endpoint = "wavespeed-ai/wan-2.1/t2v-720p-ultra-fast"
            raise ValueError(f"Invalid model: {model}, this model does not support Ultra-fast mode")
        elif model == "wan-2.1/t2v-480p-ultra-fast":
            if size == "" or size == None:
                size = "832*480"
            size_limit.append("832*480")
            size_limit.append("480*832")
            if len(real_loras) > 0:
                endpoint = "wavespeed-ai/wan-2.1/t2v-480p-lora-ultra-fast"
                raise ValueError(f"Invalid model: {model}, this model does not support LoRA ")
            else:
                endpoint = "wavespeed-ai/wan-2.1/t2v-480p-ultra-fast"
        else:
            raise ValueError(f"Invalid model: {model}")

        if size not in size_limit:
            raise ValueError(f"Invalid size: {size}. Allowed sizes for {model} are {', '.join(size_limit)}")

        payload["size"] = size
        # Remove empty fields
        payload = {k: v for k, v in payload.items() if v is not None and (v != "" and v != {})}

        response = self.post(endpoint, payload)

        # Get request ID
        request_id = response.get("id")
        if not request_id:
            raise Exception("No request ID in response")

        if not wait_for_completion:
            return {
                "request_id": request_id,
                "status": "processing"
            }

        # Wait for task completion
        task_result = self.wait_for_task(request_id)

        # Extract video URL
        video_url = task_result.get("outputs", [])

        if not video_url or len(video_url) == 0:
            raise Exception("No video URL in result")

        return {
            "video_url": video_url[0],
            "request_id": request_id
        }

    # ===== Flux Image Generation API =====
    def flux_generate_image(self,
                            model="",
                            prompt="",
                            image="",
                            strength=0.6,
                            loras=[],
                            width=1024,
                            height=1024,
                            num_inference_steps=28,
                            seed=-1,
                            guidance_scale=5.0,
                            num_images=1,
                            enable_safety_checker=True,
                            wait_for_completion=True):
        """
        Generate images using Flux model

        Parameters:
            model (str, optional): Model name, choose from "flux-dev", "flux-schnell"
            prompt (str, optional): Text description of the image to generate
            image (str, optional): Base64 encoded image or image URL for image-to-image generation
            strength (float, optional): Strength of the image-to-image transformation (0.0 to 1.0)
            loras (list, optional): List of LoRA models to apply (max 5 items)
            width (int, optional): Image width (512 to 1536)
            height (int, optional): Image height (512 to 1536)
            num_inference_steps (int, optional): Number of inference steps for dev models (1 to 50)
            seed (int, optional): Random seed for reproducible results. -1 for random seed
            guidance_scale (float, optional): Guidance scale for generation (0.0 to 10.0)
            num_images (int, optional): Number of images to generate (1 to 4)
            enable_safety_checker (bool, optional): Enable safety checker for generated content
            wait_for_completion (bool, optional): Whether to wait for task completion

        Returns:
            dict: Result containing image URLs and task ID
        """
        # Parameter validation
        if image and (strength < 0.0 or strength > 1.0):
            raise ValueError("strength must be between 0.0 and 1.0")
        if width < 512 or width > 1536 or height < 512 or height > 1536:
            raise ValueError("Width and height must be between 512 and 1536")
        if model == "flux-dev":
            if num_inference_steps < 1 or num_inference_steps > 50:
                raise ValueError("num_inference_steps must be between 1 and 50")
        elif model == "flux-schnell":
            if num_inference_steps < 1 or num_inference_steps > 8:
                raise ValueError("num_inference_steps must be between 1 and 8")
        if guidance_scale < 0.0 or guidance_scale > 10.0:
            raise ValueError("guidance_scale must be between 0.0 and 10.0")
        if num_images < 1 or num_images > 4:
            raise ValueError("num_images must be between 1 and 4")
        # Populate payload
        payload = {
            "prompt": prompt,
            "image": image,
            "strength": strength,
            "size": f"{width}*{height}",
            "num_inference_steps": num_inference_steps,
            "seed": seed if seed > 0 else -1,
            "guidance_scale": guidance_scale,
            "num_images": num_images,
            "enable_safety_checker": enable_safety_checker,
            "enable_base64_output": False
        }

        real_loras = self._normalization_loras(loras, 4.0, 1.0)
        if len(real_loras) > 5:
            raise ValueError("Maximum of 5 LoRA models can be applied")

        payload["loras"] = real_loras

        # Remove empty fields
        payload = {k: v for k, v in payload.items() if v is not None and v != ""}

        # Submit image generation request
        if model == "flux-dev":
            endpoint = "wavespeed-ai/flux-dev-lora" if real_loras else "wavespeed-ai/flux-dev"
        elif model == "flux-schnell":
            endpoint = "wavespeed-ai/flux-schnell-lora" if real_loras else "wavespeed-ai/flux-schnell"
        else:
            raise ValueError(f"Invalid model: {model}")

        response = self.post(endpoint, payload)

        # Get request ID
        request_id = response.get("id")
        if not request_id:
            raise Exception("No request ID in response")

        if not wait_for_completion:
            return {
                "request_id": request_id,
                "status": "processing"
            }

        # Wait for task completion
        task_result = self.wait_for_task(request_id, polling_interval=1)

        # Extract image URLs
        image_urls = task_result.get("outputs", [])

        if not image_urls:
            raise Exception("No image URLs in result")

        return {
            "image_urls": image_urls,
            "request_id": request_id
        }
