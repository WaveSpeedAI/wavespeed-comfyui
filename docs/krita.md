# Using WaveSpeed models from Krita (AI Diffusion plugin)

This guide shows how to drive WaveSpeed-hosted models from inside Krita, using the
[Krita AI Diffusion](https://github.com/Acly/krita-ai-diffusion) plugin's **Graph**
(custom workflow) workspace together with the nodes in this repository.

Nothing in the plugin has to be patched. The plugin can connect to any ComfyUI server
("Custom Server" mode), and it can run any ComfyUI graph that contains a `Krita Output`
node. The nodes in this repo are ordinary ComfyUI nodes, so they work there as-is.

Two ready-made workflows are included:

| File | What it does |
| --- | --- |
| [`examples/krita/wavespeed-image-edit.json`](../examples/krita/wavespeed-image-edit.json) | Sends the current Krita canvas plus a prompt to an image-edit model, returns the result |
| [`examples/krita/wavespeed-text-to-image.json`](../examples/krita/wavespeed-text-to-image.json) | Text-to-image, fitted to the current canvas resolution |

Both default to `google/nano-banana-pro`; swapping the model is a small edit, see
[Using a different model](#using-a-different-model).

## What this is not

This is **not** a one-click cloud setup. The Krita plugin talks to ComfyUI, so a ComfyUI
instance has to exist somewhere you can reach it: on your own machine, on another machine on
your LAN, or on a rented host. What you avoid is running a diffusion model locally — the
WaveSpeed node only performs an HTTP call, so the ComfyUI machine needs no GPU for these
particular workflows.

The plugin's own **Online Service** mode is a separate, unrelated service run by the plugin's
author. This guide neither touches nor replaces it.

## Prerequisites

1. **Krita 5.2+** with the AI Diffusion plugin **1.26.0 or newer** (custom graphs were
   introduced in 1.26).
2. **A ComfyUI instance reachable over HTTP** from the machine running Krita.
3. **[comfyui-tooling-nodes](https://github.com/Acly/comfyui-tooling-nodes)** installed in
   that ComfyUI. This is the plugin's own node pack and it is mandatory — it provides
   `Krita Canvas`, `Krita Output` and `Parameter`, which are how images and settings cross
   between Krita and the graph.
4. **This repository installed** in the same ComfyUI (see the [README](../README.md)), with
   your WaveSpeed API key configured under `Settings → WaveSpeed` in the ComfyUI web UI (or
   in `config.json`). The key lives on the ComfyUI machine, never in Krita.

### About the plugin's connection checks

When connecting to a custom server, the plugin verifies that four node packs are installed
(ControlNet Preprocessors, IP-Adapter, External Tooling Nodes, Inpaint Nodes) and that at
least one usable diffusion checkpoint is present. On a ComfyUI that only has the WaveSpeed
nodes, that check fails and the connection is refused.

If your ComfyUI is a full local install used with the plugin already, there is nothing to do.
If you are setting one up purely as a relay for WaveSpeed, you can relax the check: close
Krita, open `settings.json` in the plugin's user data folder — typically
`%APPDATA%\krita\ai_diffusion\` (Windows), `~/.local/share/krita/ai_diffusion/` (Linux),
`~/Library/Application Support/krita/ai_diffusion/` (macOS) — and set:

```json
"check_server_resources": false
```

One caveat we could not work around: the plugin still fails with *"No diffusion model
checkpoints found"* if the server reports an empty checkpoint list. ComfyUI needs at least
one file visible in `models/checkpoints` for the connection to complete. These workflows
never load it.

Note that the plugin's other workspaces (Generate, Upscale, Live, …) keep using local models.
Only the **Graph** workspace runs the workflows below.

## 1. Point Krita at your ComfyUI

Enable the docker (`Settings ▸ Dockers ▸ AI Image Generation`), open the plugin's Connection
settings, choose **Custom Server**, enter the server URL (for example
`http://127.0.0.1:8188`) and connect.

### If your ComfyUI sits behind an auth proxy

The plugin supports a bearer token, but there is no widget for it — it is written into
`settings.json` (same file as above):

```json
"server_authorization": "your-token-here"
```

The plugin sends it as `Authorization: Bearer your-token-here` on both the HTTP requests and
the websocket connection, which is what most reverse proxies expect. Restart Krita after
editing the file.

Do **not** put your WaveSpeed API key here. This token authenticates Krita to *your ComfyUI*;
the WaveSpeed key is configured inside ComfyUI.

## 2. Import a workflow

1. Download [`wavespeed-image-edit.json`](../examples/krita/wavespeed-image-edit.json) or
   [`wavespeed-text-to-image.json`](../examples/krita/wavespeed-text-to-image.json).
2. In Krita, switch to the **Graph** workspace in the plugin docker.
3. Click **Import File** and select the JSON.

The workflow is copied into the `workflows` folder of the plugin's user data directory, so it
remains available in later sessions.

The files are in ComfyUI's **API format**, on purpose. The WaveSpeed node builds its widgets
dynamically in the browser, and a UI-format export does not survive the plugin's UI→API
conversion (that conversion maps widget values positionally against the node's declared
inputs, and this node declares none). If you author your own WaveSpeed workflow in the
ComfyUI web UI, use **Export (API)**, not plain Export.

## 3. Generate

After import you get a small parameter panel, generated from the `Parameter` nodes in the
graph:

* **1. Prompt** — the edit instruction, or the description for text-to-image.
* **2. Aspect ratio** — one of `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`,
  `16:9`, `21:9`. Pick the one closest to your canvas.
* **3. Resolution** — `1k`, `2k` or `4k`.

Press *Generate*. Under the hood:

1. Krita sends the visible canvas to ComfyUI (edit workflow only).
2. The WaveSpeed node uploads that image, calls the model endpoint and waits for the result
   URL. Expect a few seconds to a minute — it is a remote API call, and the plugin's progress
   bar cannot show fine-grained steps for it.
3. The result is downloaded, scaled to the canvas size and handed back to Krita, where it
   appears as a result you can apply as a new layer.

Because the models' aspect-ratio choices are coarse, the returned image is resized to the
exact canvas dimensions by an `ImageScale` node at the end of the graph. Choosing an aspect
ratio close to your canvas avoids visible squashing.

### Cost and rate

Every generation is a billed API call against your WaveSpeed key. Keep the Graph workspace in
regular mode rather than **Live** — Live re-runs the graph on canvas changes, which for a
hosted API means a request (and a charge) each time.

## Using a different model

The model choice lives in three inputs of the `WaveSpeedAIPredictor` node:

* `model_id` — the API path, e.g. `/api/v3/google/nano-banana-pro/edit`
* `request_json` — default values for that model's parameters
* `param_map` — parameter types, including which ones are arrays (this is what folds
  `image_0`, `image_1`, … into an `images` array)

The reliable way to switch models is to build the graph once in the ComfyUI web UI:

1. Open ComfyUI and drag in `wavespeed-image-edit.json`.
2. On the WaveSpeed node, pick another model. Its widgets update automatically.
3. Reconnect the `Krita Canvas` image output and the prompt `Parameter` to the new model's
   inputs if the names changed.
4. **Export (API)**, then import the file in Krita.

Editing `model_id` / `request_json` / `param_map` by hand also works, as long as the parameter
names match the model's schema.

## Structure of the included graphs

```
Krita Canvas ──image──► WaveSpeedAIPredictor ──output_url──► WaveSpeedAI Preview
     │                        ▲                                      │ image
     │        prompt / aspect ratio / resolution                      ▼
     │                   Parameter nodes                         ImageScale ──► Krita Output
     └──── width / height ─────────────────────────────────────────► ▲
```

* `Krita Canvas` supplies the canvas image plus its width and height.
* `Parameter` nodes become the input fields in Krita.
* `WaveSpeedAI Preview` turns the returned URL back into an image tensor.
* `ImageScale` fits the result to the canvas.
* `Krita Output` is what makes the graph importable at all — the plugin requires at least one.

## Known limitations

* **Selections / inpainting are not wired up.** These graphs replace the whole canvas. A
  `Krita Selection` node can be added for masked editing, but the models used here take a full
  image plus a prompt rather than a mask.
* **Animation mode is not supported** by these graphs.
* **No sharing with the plugin's styles.** The model runs on WaveSpeed, so the plugin's Style
  settings, samplers and local LoRAs have no effect here.
* **Progress is coarse** — the job simply shows as running until the API call returns.

## Feedback

Problems with these nodes or workflows: please open an issue in this repository. Problems with
Krita or the plugin itself belong in the
[plugin's repository](https://github.com/Acly/krita-ai-diffusion). This integration is
maintained by WaveSpeed and is not affiliated with, or endorsed by, the plugin's authors.
