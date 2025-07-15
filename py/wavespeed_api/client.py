import time
import requests
from .utils import BaseRequest
import PIL.Image
import io
import base64


class WaveSpeedClient:
    """
    WaveSpeed AI API Client

    This class handles the core communication with the WaveSpeed AI API.
    """

    BASE_URL = "https://api.wavespeed.ai"

    def __init__(self, api_key):
        """
        Initialize WaveSpeed AI API client

        Args:
            api_key (str): WaveSpeed AI API key
        """
        self.api_key = api_key
        self.once_timeout = 1800  # Default timeout is 1800 seconds (30 minutes)

        self.headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

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
        url = f"{self.BASE_URL}{endpoint}"
        response = requests.post(url, headers=self.headers, json=payload, timeout=timeout)

        if response.status_code == 401:
            raise Exception("Unauthorized: Invalid API key")

        if response.status_code != 200:
            error_message = f"Error: {response.status_code}"
            try:
                error_data = response.json()
                if "message" in error_data:
                    error_message = f"Error: {error_data['message']}"
            except:
                pass
            raise Exception(error_message)

        response_data = response.json()
        if isinstance(response_data, dict) and 'code' in response_data:
            if response_data['code'] == 401:
                raise Exception("Unauthorized: Invalid API key")
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
        url = f"{self.BASE_URL}{endpoint}"
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
        return self.get(f"/api/v2/predictions/{request_id}/result")

    def wait_for_task(self, request_id, polling_interval=5, timeout=None):
        """
        Wait for task completion and return the result

        Args:
            request_id (str, optional): Task ID.
            polling_interval (int): Polling interval in seconds.
            timeout (int): Maximum time to wait for task completion in seconds.

        Returns:
            dict: Task result.

        Raises:
            Exception: If the task fails or times out.
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

            time.sleep(polling_interval)

        raise Exception("Task timed out")

    def send_request(self, request: BaseRequest, wait_for_completion=True, polling_interval=5, timeout=None):
        """
        Sends an API request using a request object.

        Args:
            request (BaseRequest): The request object containing payload and endpoint logic.
            wait_for_completion (bool, optional): Whether to wait for task completion.
            polling_interval (int): Polling interval in seconds.
            timeout (int): Maximum time to wait for task completion in seconds.

        Returns:
            dict: API response or task result.
        """
        payload = request.build_payload()
        payload["enable_base64_output"] = False
        if "seed" in payload:
            payload["seed"] = payload["seed"] % 9999999999 if payload["seed"] != -1 else -1
        response = self.post(request.get_api_path(), payload)
        request_id = response.get("id")
        if not request_id:
            raise Exception("No request ID in response")

        if not wait_for_completion:
            return {"request_id": request_id, "status": "processing"}

        task_result = self.wait_for_task(request_id, polling_interval=polling_interval, timeout=timeout)
        return task_result

    def upload_file(self, image: PIL.Image.Image):
        """
        Upload a file to WaveSpeed AI API

        Args:
            image (PIL.Image.Image): Image to be uploaded

        Returns:
            dict: API response containing the uploaded file information
        """
        url = f"{self.BASE_URL}/api/v2/media/upload/binary"
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        buffered.seek(0)
        files = {'file': ('image.png', buffered, 'image/png')}
        response = requests.post(url, headers={'Authorization': f'Bearer {self.api_key}'}, files=files)

        if response.status_code != 200:
            raise Exception(f"Upload failed: {response.status_code}")

        response_data = response.json()
        if isinstance(response_data, dict) and 'code' in response_data:
            if response_data['code'] != 200:
                raise Exception(f"API Error: {response_data.get('message', 'Unknown error')}")
            return response_data.get('data', {})["download_url"]
        raise Exception("No download URL in response")
