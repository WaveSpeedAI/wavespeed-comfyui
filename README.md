# ComfyUI-WaveSpeedAI-API

This is a custom node for ComfyUI that allows you to use the WaveSpeed AI API directly in ComfyUI. WaveSpeed AI is a high-performance AI image and video generation service platform offering industry-leading generation speeds.

**NEW: Dynamic Node Approach [WIP]** - We've introduced a streamlined workflow using dynamic nodes that replace the previous extensive collection of individual model nodes. You can now select models and configure parameters dynamically using **WaveSpeedAI Task Create [WIP] ➜ WaveSpeedAI Task Submit [WIP]** workflow for a more flexible and maintainable experience.

For more information, see [WaveSpeed AI Documentation](https://wavespeed.ai/docs).

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

#### NEW: Dynamic Node Examples [WIP]

##### 1. Dynamic Nodes - Nano Banana
- Workflow Example: [dynamic-nodes-nano-banana.json](examples/dynamic-nodes-nano-banana.json)
- This example demonstrates the new dynamic node approach using nano banana model with WaveSpeedAI Task Create [WIP] ➜ WaveSpeedAI Task Submit [WIP] workflow.

##### 2. Dynamic Nodes - Seedream V4
- Workflow Example: [dynamic-nodes-seedreamv4.json](examples/dynamic-nodes-seedreamv4.json)
- This example shows how to use Seedream V4 model through the dynamic node system.

##### 3. Dynamic Nodes - Seedream V4 Sequential
- Workflow Example: [dynamic-nodes-seedreamv4-sequential.json](examples/dynamic-nodes-seedreamv4-sequential.json)
- This example demonstrates sequential processing with Seedream V4 using the dynamic node workflow.

##### 4. Dynamic Nodes - Qwen LoRA
- Workflow Example: [dynamic-nodes-qwen-lora.json](examples/dynamic-nodes-qwen-lora.json)
- This example demonstrates how to use the Qwen LoRA model with the dynamic node workflow.

##### 5. Dynamic Nodes - Mixed Usage (Advanced)
- Workflow Example: [dynamic-nodes-mixed-usage.json](examples/dynamic-nodes-mixed-usage.json)
- This is an advanced example demonstrating a complete workflow that combines image-to-image and image-to-video generation.

**Workflow Overview:**

This example showcases a complete mixed workflow with two main tasks:

**Task 1: Image to Image**
- Model: `kwaivgi/kling-image-o1`
- Purpose: Combine two reference images to generate a new image
- Key Techniques:
  - **Multi-Image Organization**: Use the `WaveSpeedAI Media Images To List` node to combine multiple image URLs into an array
  - Workflow Steps:
    1. Load local images using two `LoadImage` nodes
    2. Upload images and get URLs using two `WaveSpeedAI Upload Image` nodes
    3. Combine the two image URLs into a list using `WaveSpeedAI Media Images To List` node
    4. Pass the image list to the `images` parameter in `WaveSpeedAI Task Create` node
  - Prompt Example: `"The woman in Figure 2 is replaced with the robot from Figure 1, and the robot enters a berserk state"`

**Task 2: Image to Video**
- Model: `kwaivgi/kling-video-o1/image-to-video`
- Purpose: Generate video using first frame and last frame
- Key Techniques:
  - **First/Last Frame Passing**:
    - `image` parameter: Receives the first frame image URL (from the first uploaded image)
    - `last_image` parameter: Receives the last frame image URL (from Task 1's generated result)
  - Workflow Steps:
    1. First Frame: Use the output from the first `WaveSpeedAI Upload Image` node
    2. Last Frame: Use the `firstImageUrl` output from Task 1's `WaveSpeedAI Task Submit` node
    3. Configure in `WaveSpeedAI Task Create` node:
       - Connect `image` input to first frame URL
       - Connect `last_image` input to last frame URL
  - Prompt Example: `"The robot activates the temporal entry to the world of No. 1 Player and begins to transform"`

**Core Node Usage:**

1. **WaveSpeedAI Media Images To List**
   - Purpose: Organize multiple individual image URLs into an array format
   - Inputs: Up to 6 image URLs (`image_url_1` to `image_url_6`)
   - Outputs:
     - `firstImageUrl`: The URL of the first image
     - `imageUrls`: JSON array string containing all image URLs
   - Use Case: When a model needs to receive multiple reference images (e.g., image-to-image tasks)

2. **First/Last Frame Passing Technique**
   - Image-to-video models support passing both first and last frames simultaneously
   - First Frame (`image`): Required parameter, defines the starting frame of the video
   - Last Frame (`last_image`): Optional parameter, defines the ending frame of the video
   - You can use the output image from a previous task as an input frame for the current task

3. **Task Chaining**
   - Build complex generation pipelines by connecting outputs and inputs of different task nodes
   - This example demonstrates how to use the image-to-image result as the last frame input for image-to-video generation

**Parameter Configuration Examples:**
- Image-to-Image Task:
  - `aspect_ratio`: "4:3"
  - `resolution`: "1k"
  - `num_images`: 1
- Image-to-Video Task:
  - `aspect_ratio`: "16:9"
  - `duration`: 5 seconds

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


### New Recommended Approach: Dynamic Parameter Nodes [WIP]

We now recommend using our new dynamic node system for a cleaner and more flexible workflow:

#### Core Dynamic Nodes:
* **WaveSpeedAI Task Create [WIP]** - Select any available model and configure parameters dynamically
* **WaveSpeedAI Task Submit [WIP]** - Execute your configured task
* **WaveSpeedAI Client** - Client configuration (still required)

#### Workflow Benefits:
- **Dynamic Model Selection**: Choose from all available models within a single node interface
- **Dynamic Parameters**: Configure model-specific parameters without needing individual nodes
- **Simplified Setup**: Cleaner workflows with fewer node types
- **Future-Proof**: New models are automatically available without requiring new node releases

#### How to Use:
1. Add **WaveSpeedAI Task Create [WIP]** to your workflow
2. Select your desired model from the dropdown (Flux, Hunyuan, Wan2.1, etc.)
3. Configure the dynamic parameters based on your selected model
4. Connect to **WaveSpeedAI Task Submit [WIP]** to execute

#### Legacy Individual Model Nodes:
While we still support the individual model nodes listed below, we recommend migrating to the dynamic approach for new workflows. If you encounter any issues with the new dynamic nodes, please submit an issue.

<details>
<summary>Click to view legacy individual model nodes</summary>

### Legacy Nodes List (Still Supported):
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

</details>

---

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
