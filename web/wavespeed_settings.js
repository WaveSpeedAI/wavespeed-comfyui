/**
 * WaveSpeed Settings UI
 *
 * Adds API key configuration to ComfyUI settings panel
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { clearModelCache } from "./predictor/api.js";

// Register settings extension
app.registerExtension({
    name: "WaveSpeed.Settings",

    async setup() {
        // Add WaveSpeed settings section
        app.ui.settings.addSetting({
            id: "WaveSpeed.ApiKey",
            name: "WaveSpeed API Key",
            type: "text",
            defaultValue: "",
            tooltip: "Enter your WaveSpeed API key. Get one at https://wavespeed.ai",
            attrs: {
                placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                style: "width: 400px; font-family: monospace;"
            },
            async onChange(value) {
                try {
                    // Trim whitespace
                    const apiKey = (value || "").trim();

                    if (!apiKey) {
                        // Delete API key if empty
                        const response = await api.fetchApi("/wavespeed/api/delete_config", {
                            method: "POST"
                        });

                        const result = await response.json();
                        if (result.success) {
                            clearModelCache();
                            console.log("[WaveSpeed Settings] API key deleted");
                        } else {
                            console.error("[WaveSpeed Settings] Failed to delete API key:", result.error);
                            app.ui.dialog.show(`Failed to delete API key: ${result.error}`);
                        }
                        return;
                    }

                    // Save API key
                    const response = await api.fetchApi("/wavespeed/api/save_config", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ api_key: apiKey })
                    });

                    const result = await response.json();

                    if (result.success) {
                        clearModelCache();
                        console.log("[WaveSpeed Settings] API key saved successfully");
                    } else {
                        console.error("[WaveSpeed Settings] Failed to save API key:", result.error);
                        app.ui.dialog.show(`Failed to save API key: ${result.error}`);
                    }
                } catch (error) {
                    console.error("[WaveSpeed Settings] Error saving API key:", error);
                    app.ui.dialog.show(`Error: ${error.message}`);
                }
            }
        });

        // Check if API key is already configured on startup
        try {
            const response = await api.fetchApi("/wavespeed/api/get_config");
            const result = await response.json();

            if (result.success && result.data.has_api_key) {
                console.log("[WaveSpeed Settings] API key is configured");

                // Set a placeholder to indicate key is configured (without showing actual key)
                const setting = app.ui.settings.settingsValues["WaveSpeed.ApiKey"];
                if (setting !== undefined) {
                    // Show masked placeholder
                    const input = document.querySelector('input[data-id="WaveSpeed.ApiKey"]');
                    if (input) {
                        input.placeholder = "••••••••••••••••••••••••••••••••";
                    }
                }
            }
        } catch (error) {
            console.error("[WaveSpeed Settings] Error checking API key status:", error);
        }
    }
});

console.log("[WaveSpeed Settings] Settings extension registered");
