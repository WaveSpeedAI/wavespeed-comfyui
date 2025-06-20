# ComfyUI-WaveSpeedAI-API

This is a custom node for ComfyUI that allows you to use the WaveSpeed AI API directly in ComfyUI. WaveSpeed AI is a high-performance AI image and video generation service platform offering industry-leading generation speeds. For more information, see [WaveSpeed AI Documentation](https://wavespeed.ai/docs).

## Requirements
Before using this node, you need to have a WaveSpeed AI API key. You can obtain your API key from the [WaveSpeed AI](https://wavespeed.ai).

## Installation

### Installing manually

1. Navigate to the `ComfyUI/custom_nodes` directory.

2. Clone this repository: `git clone https://github.com/WaveSpeedAI/wavespeed-comfyui.git`
  
3. Install the dependencies:
  - Windows (ComfyUI portable): `python -m pip install -r requirements.txt`
  - Linux or MacOS: `pip install -r requirements.txt`
4. If you don't want to expose your API key in the node, you can rename the `config.ini.tmp` file to `config.ini` and add your API key there.

5. Start ComfyUI and enjoy using the WaveSpeed AI API node!


## How to Use

The following are typical workflows and result demonstrations (each group includes a ComfyUI workflow screenshot).
The workflow images contain workflow information and can be directly dragged into ComfyUI for use.

---

#### Hot 
- We have launched very powerful video nodes called seedance, please enjoy them freely
- Workflow Example:

  ![Seedance Workflow](examples/bytedance_seedance_lite_i2v.png)

- Result Video:
  
https://github.com/user-attachments/assets/b9902503-f8b1-46b2-bc8e-48fcba84e5bc

---

#### 1. Dia TTS
- Workflow Example:

  ![Dia TTS Workflow](examples/dia_tts.png)

---

#### 2. Flux Control LoRA Canny
- Workflow Example:

  ![Flux Control LoRA Canny Workflow](examples/flux_control_lora_canny.png)

---

#### 3. Flux Dev Lora Ultra Fast 
- Workflow Example:

  ![Flux Dev Lora Ultra Fast Workflow](examples/flux_dev_lora_ultra_fast.png)

---

#### 4. Hunyuan Custom Ref2V 720p Workflow and Result
- Workflow Example:

  ![Hunyuan Custom Ref2V 720p Workflow](examples/hunyuan_custom_ref2v_720p.png)

- Result Video:
  
https://github.com/user-attachments/assets/46220376-4341-4ce3-a7f4-46f12ff7ccf6

---

#### 5. Wan2.1 I2V 720p Ultra Fast Workflow and Result
- Workflow Example:

  ![Wan2.1 I2V 720p Ultra Fast Workflow](examples/wan_2_1_i2v_720p_ultra_fast.png)

- Result Video:

https://github.com/user-attachments/assets/77fc1882-6d74-43b0-a4eb-6d8883febcdc

---


### Here are some popular models you can experience in ComfyUI:
1. Hunyuan Custom
2. Ghibli
3. Wan2.1

### Here are some nodes list
* "WaveSpeedAI Client"
* "WaveSpeedAI Dia TTS"
* "WaveSpeedAI Flux Control LoRA Canny"
* "WaveSpeedAI Flux Control LoRA Depth"
* "WaveSpeedAI Flux Dev"
* "WaveSpeedAI Flux Dev Fill"
* "WaveSpeedAI Flux Dev Lora"
* "WaveSpeedAI Flux Dev Lora Ultra Fast"
* "WaveSpeedAI Flux Dev Ultra Fast"
* "WaveSpeedAI Flux Pro Redux"
* "WaveSpeedAI Flux Redux Dev"
* "WaveSpeedAI Flux Schnell"
* "WaveSpeedAI Flux Schnell Lora"
* "WaveSpeedAI Flux and SDXL Loras"
* "WaveSpeedAI Framepack"
* "WaveSpeedAI Ghibli"
* "WaveSpeedAI Hidream E1 Full"
* "WaveSpeedAI Hidream I1 Dev"
* "WaveSpeedAI Hidream I1 Full"
* "WaveSpeedAI Hunyuan 3D V2 Multi View"
* "WaveSpeedAI Hunyuan Custom Ref2V 480p"
* "WaveSpeedAI Hunyuan Custom Ref2V 720p"
* "WaveSpeedAI Hunyuan Video I2V"
* "WaveSpeedAI Hunyuan Video T2V"
* "WaveSpeedAI Instant Character"
* "WaveSpeedAI Kling v1.6 I2V Pro"
* "WaveSpeedAI Kling v1.6 I2V Standard"
* "WaveSpeedAI Kling v1.6 T2V Standard"
* "WaveSpeedAI LTX Video I2V 480p"
* "WaveSpeedAI LTX Video I2V 720p"
* "WaveSpeedAI MMAudio V2"
* "WaveSpeedAI Magi 1.24b"
* "WaveSpeedAI Minimax Video 01"
* "WaveSpeedAI Preview Video"
* "WaveSpeedAI Real-ESRGAN"
* "WaveSpeedAI SDXL"
* "WaveSpeedAI SDXL Lora"
* "WaveSpeedAI Save Audio"
* "WaveSpeedAI SkyReels V1"
* "WaveSpeedAI Step1X Edit"
* "WaveSpeedAI Uno"
* "WaveSpeedAI Upload Image"
* "WaveSpeedAI Vidu Image to Video2.0"
* "WaveSpeedAI Vidu Reference To Video2.0"
* "WaveSpeedAI Vidu Start/End To Video2.0"
* "WaveSpeedAI Wan Loras"
* "WaveSpeedAI Wan2.1 I2V 480p"
* "WaveSpeedAI Wan2.1 I2V 480p LoRA Ultra Fast"
* "WaveSpeedAI Wan2.1 I2V 480p Lora"
* "WaveSpeedAI Wan2.1 I2V 480p Ultra Fast"
* "WaveSpeedAI Wan2.1 I2V 720p"
* "WaveSpeedAI Wan2.1 I2V 720p LoRA Ultra Fast"
* "WaveSpeedAI Wan2.1 I2V 720p Lora"
* "WaveSpeedAI Wan2.1 I2V 720p Ultra Fast"
* "WaveSpeedAI Wan2.1 T2V 480p LoRA"
* "WaveSpeedAI Wan2.1 T2V 480p LoRA Ultra Fast"
* "WaveSpeedAI Wan2.1 T2V 480p Ultra Fast"
* "WaveSpeedAI Wan2.1 T2V 720p"
* "WaveSpeedAI Wan2.1 T2V 720p LoRA"
* "WaveSpeedAI Wan2.1 T2V 720p LoRA Ultra Fast"
* "WaveSpeedAI Wan2.1 T2V 720p Ultra Fast"

### How to Apply Lora
1. As we provide services on WaveSpeedAI-API, you cannot use your local lora files. However, we support loading lora via URL.
2. You can use "WaveSpeedAi Wan Loras", "WaveSpeedAi Flux Loras", or "WaveSpeedAi Flux SDXL Loras" nodes.
3. Enter the lora URL in the lora_path field. For example: https://huggingface.co/WaveSpeedAi/WanLoras/resolve/main/wan_loras.safetensors
4. Enter the lora weight in the lora_weight field. For example: 0.5
5. If you have multiple loras, you can add additional lora_path and lora_weight pairs.
6. If your model is not on Hugging Face, that's fine. Any publicly accessible URL will work.

### How to Use image_url in Nodes
1. You can use the "WaveSpeedAi Upload Image" node to convert a local IMAGE into an image_url.
2. Connect the output to the corresponding node that requires it. You can find examples in the provided samples.
