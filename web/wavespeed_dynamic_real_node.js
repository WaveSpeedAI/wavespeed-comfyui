/**
 * WaveSpeed Dynamic Real Node - Dynamic parameter rendering on real ComfyUI nodes
 *
 * This replaces the virtual node approach with dynamic parameter discovery
 * applied directly to the real WaveSpeedTaskCreateDynamic node.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { ComfyWidgets } from "../../../scripts/widgets.js";

console.log("[WaveSpeed] Loading dynamic real node extension...");

// Global cache for model data - shared across all node instances
const GLOBAL_CACHE = {
    categories: null,
    modelsByCategory: {},
    modelDetails: {},
    lastCategoryUpdate: 0,
    lastModelUpdate: {},
    cacheExpiry: 5 * 60 * 1000 // 5-minute cache expiration
};

// Utility function: Make an API request
async function fetchWaveSpeedAPI(endpoint) {
    try {
        const response = await api.fetchApi(endpoint);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return { success: false, error: error.message };
    }
}

// Get model categories
async function getModelCategories() {
    const result = await fetchWaveSpeedAPI("/wavespeed/api/categories");
    return result.success ? result.data : [];
}

// Get models under a category
async function getModelsByCategory(category) {
    const result = await fetchWaveSpeedAPI(`/wavespeed/api/models/${category}`);
    return result.success ? result.data : [];
}

// Get model details
async function getModelDetail(modelId) {
    const result = await fetchWaveSpeedAPI(`/wavespeed/api/model?model_id=${encodeURIComponent(modelId)}`);
    return result.success ? result.data : null;
}

// Cache management functions
function isCacheExpired(timestamp) {
    return Date.now() - timestamp > GLOBAL_CACHE.cacheExpiry;
}

async function getCachedCategories() {
    if (!GLOBAL_CACHE.categories || isCacheExpired(GLOBAL_CACHE.lastCategoryUpdate)) {
        console.log("[WaveSpeed] Fetching fresh categories...");
        const categories = await getModelCategories();
        GLOBAL_CACHE.categories = categories;
        GLOBAL_CACHE.lastCategoryUpdate = Date.now();
    }
    return GLOBAL_CACHE.categories;
}

async function getCachedModelsByCategory(category) {
    if (!GLOBAL_CACHE.modelsByCategory[category] ||
        isCacheExpired(GLOBAL_CACHE.lastModelUpdate[category] || 0)) {
        console.log(`[WaveSpeed] Fetching fresh models for category: ${category}`);
        const models = await getModelsByCategory(category);
        GLOBAL_CACHE.modelsByCategory[category] = models;
        GLOBAL_CACHE.lastModelUpdate[category] = Date.now();
    }
    return GLOBAL_CACHE.modelsByCategory[category];
}

async function getCachedModelDetail(modelId) {
    if (!GLOBAL_CACHE.modelDetails[modelId]) {
        console.log(`[WaveSpeed] Fetching fresh model detail: ${modelId}`);
        const detail = await getModelDetail(modelId);
        if (detail) {
            GLOBAL_CACHE.modelDetails[modelId] = detail;
        }
    }
    return GLOBAL_CACHE.modelDetails[modelId];
}

// Parse model parameters (supports standard JSON Schema format)
function parseModelParameters(inputSchema) {
    if (!inputSchema?.properties) {
        return [];
    }

    const parameters = [];
    const properties = inputSchema.properties;
    const required = inputSchema.required || [];
    const order = inputSchema['x-order-properties'] || Object.keys(properties);

    for (const propName of order) {
        if (!properties[propName]) continue;

        const prop = properties[propName];
        if (prop.disabled || prop.hidden) continue;

        const param = {
            name: propName,
            displayName: formatDisplayName(propName),
            type: mapJsonSchemaType(prop, propName),
            required: required.includes(propName),
            default: cleanDefaultValue(prop.default, propName),
            description: prop.description || "",
            isArray: prop.type === 'array',
            arrayItems: prop.items,
        };

        // Handle enum types
        if (prop.enum && prop.enum.length > 0) {
            param.type = "COMBO";
            param.options = prop.enum;
        }

        // Handle range for numeric types
        if (prop.type === 'number' || prop.type === 'integer') {
            param.min = prop.minimum;
            param.max = prop.maximum;
            param.step = prop.type === 'integer' ? 1 : 0.01;
        }

        parameters.push(param);
    }

    return parameters;
}

// Clean up default values
function cleanDefaultValue(defaultValue, propName) {
    if (defaultValue === undefined || defaultValue === null) {
        return defaultValue;
    }

    const paramName = propName.toLowerCase();

    // Clean up default values for URL-like types
    if (paramName.includes('image') || paramName.includes('video') ||
        paramName.includes('audio') || paramName.includes('url')) {
        return '';
    }

    // Clean up default values for prompt-like types
    if (paramName.includes('prompt') || paramName.includes('text') ||
        paramName.includes('description')) {
        return '';
    }

    return defaultValue;
}

// Format display name
function formatDisplayName(propName) {
    return propName;
}

// Map JSON Schema types to ComfyUI types
function mapJsonSchemaType(prop, propName = '') {
    if (prop.enum) return "COMBO";

    const typeMap = {
        'string': 'STRING',
        'number': 'FLOAT',
        'integer': 'INT',
        'boolean': 'BOOLEAN',
        'array': 'STRING',  // Handle arrays as comma-separated strings in UI
        'object': 'DICT'
    };

    return typeMap[prop.type] || 'STRING';
}

// Determine if a parameter needs an input port
function shouldCreateInputPort(param) {
    const supportedInputTypes = ['STRING', 'INT', 'FLOAT', 'BOOLEAN'];
    return supportedInputTypes.includes(param.type);
}

// Determine priority for input port allocation (higher priority gets allocated first)
function getInputPortPriority(param) {
    const paramName = param.name.toLowerCase();

    // High priority - core generation parameters
    if (paramName.includes('prompt') || paramName.includes('text') || paramName.includes('description')) {
        return 100;
    }

    // Medium priority - common generation parameters
    if (paramName.includes('seed') || paramName.includes('width') || paramName.includes('height') ||
        paramName.includes('steps') || paramName.includes('cfg') || paramName.includes('scale') ||
        paramName.includes('strength') || paramName.includes('guidance')) {
        return 50;
    }

    // Low priority - other parameters
    return 10;
}

// Register extension to modify the real node
app.registerExtension({
    name: "wavespeed.DynamicRealNode",

    async nodeCreated(node) {
        // Only apply to our target node
        if (node.comfyClass !== "WaveSpeedAI Task Create") {
            return;
        }

        console.log("[WaveSpeed] Enhancing real node with dynamic capabilities:", node.id);

        // Debug: Log initial node state
        console.log("[WaveSpeed] Initial node state:", {
            id: node.id,
            inputCount: node.inputs ? node.inputs.length : 0,
            inputNames: node.inputs ? node.inputs.map(i => i.name) : [],
            widgetCount: node.widgets ? node.widgets.length : 0,
            comfyClass: node.comfyClass,
            hasPlaceholders: node.inputs ? node.inputs.filter(i => i.name && i.name.match(/^param_\d+$/)).length : 0
        });

        // Initialize dynamic state
        node.wavespeedState = {
            modelId: "",
            category: "",
            parameters: [],
            parameterValues: {},
            categoryList: null,
            isInitialized: false,
            paramMapping: {}, // Maps parameter names to param_* placeholder names
            usedPlaceholders: new Set(), // Track which placeholders are in use
            nextPlaceholderIndex: 1, // Next available param_* index
            hiddenWidgets: {} // Store hidden widgets separately from main widgets array
        };

        // Store original widgets for later cleanup
        node.originalWidgets = [...(node.widgets || [])];
        node.originalInputs = [...(node.inputs || [])];

        // CRITICAL FIX: Override computeSize to properly handle node sizing
        const originalComputeSize = node.computeSize;
        node.computeSize = function(out) {
            let size = originalComputeSize ? originalComputeSize.call(this, out) : [200, 100];
            console.log(`[WaveSpeed] Original computed size: [${size[0]}, ${size[1]}]`);

            // Calculate ONLY visible widgets (completely ignore hidden widgets)
            if (this.widgets && this.widgets.length > 0) {
                console.log(`[WaveSpeed] Widget positioning analysis for node ${this.id}:`);

                let currentY = 30; // Starting Y position (header height)
                let maxRequiredHeight = currentY;
                let multilineWidgetCount = 0;
                let arrayWidgetCount = 0;
                let visibleWidgetCount = 0;

                for (let i = 0; i < this.widgets.length; i++) {
                    const widget = this.widgets[i];

                    // CRITICAL FIX: Skip hidden widgets AND internal widgets completely
                    if (widget.hidden ||
                        (widget.name === 'model_id' || widget.name === 'request_json' || widget.name === 'param_map')) {
                        console.log(`[WaveSpeed]   Widget "${widget.name}": HIDDEN/INTERNAL, completely skipped`);
                        continue;
                    }

                    visibleWidgetCount++;
                    let widgetHeight = 30; // Default widget height
                    let widgetMargin = 8; // Increased margin between widgets

                    // Calculate actual widget height based on type
                    if (widget.type === "customtext") {
                        multilineWidgetCount++;
                        const lines = Math.max((widget.value || "").split('\n').length, 3);
                        widgetHeight = Math.max(80, lines * 22); // Increased minimum height and line height
                        widgetMargin = 12; // Extra margin for multiline widgets
                        console.log(`[WaveSpeed]   Widget "${widget.name}": multiline, ${lines} lines, height=${widgetHeight}px, y=${currentY}`);
                    } else if (widget.type === "combo") {
                        widgetHeight = 32; // Slightly taller for combo boxes
                        console.log(`[WaveSpeed]   Widget "${widget.name}": combo, height=${widgetHeight}px, y=${currentY}`);
                    } else if (widget.type === "number" || widget.type === "text") {
                        widgetHeight = 28; // Standard height for input fields
                        console.log(`[WaveSpeed]   Widget "${widget.name}": ${widget.type}, height=${widgetHeight}px, y=${currentY}`);
                    } else {
                        console.log(`[WaveSpeed]   Widget "${widget.name}": type=${widget.type}, height=${widgetHeight}px, y=${currentY}`);
                    }

                    if (widget._wavespeed_is_array) {
                        arrayWidgetCount++;
                        widgetMargin += 4; // Extra margin for array widgets
                    }

                    currentY += widgetHeight + widgetMargin;
                    maxRequiredHeight = currentY;
                }

                // Add bottom padding
                maxRequiredHeight += 15;

                console.log(`[WaveSpeed] Layout calculation: ${visibleWidgetCount} visible widgets, totalHeight=${maxRequiredHeight}px, multiline=${multilineWidgetCount}, arrays=${arrayWidgetCount}`);

                // OVERRIDE: Use our calculated height instead of the original
                size[1] = maxRequiredHeight;
                console.log(`[WaveSpeed] OVERRIDE: Setting height to calculated ${maxRequiredHeight}px`);
            }

            console.log(`[WaveSpeed] Final computed size: [${size[0]}, ${size[1]}]`);
            return size;
        };

        // Setup persistent input hiding and connection handling
        setupPersistentInputHiding(node);

        // Override connection behavior for dynamic inputs
        setupDynamicInputHandling(node);

        // CRITICAL: Initial cleanup of any unexpected inputs
        // Delay this to avoid interfering with setup
        setTimeout(() => {
            forceCleanInitialState(node);
        }, 50);

        // Delay the dynamic interface initialization to ensure ComfyUI is fully ready
        setTimeout(() => {
            console.log("[WaveSpeed] Delayed initialization starting...");
            console.log("[WaveSpeed] Node state before initialization:", {
                inputCount: node.inputs ? node.inputs.length : 0,
                inputNames: node.inputs ? node.inputs.map(i => i.name) : [],
                placeholderInputs: node.inputs ? node.inputs.filter(i => i.name && i.name.match(/^param_\d+$/)).map(i => ({ name: i.name, hidden: i.hidden })) : []
            });

            // Check for cached model information first (workflow restoration)
            restoreModelCacheIfAvailable(node);

            initializeDynamicInterface(node);
        }, 200); // Increased delay
    }
});

// Setup persistent input hiding that works continuously
function setupPersistentInputHiding(node) {
    console.log("[WaveSpeed] Setting up persistent input hiding for node:", node.id);

    // Store original inputs for restoration
    node._wavespeed_originalInputs = node.inputs ? [...node.inputs] : [];

    // Check for cached model information from workflow load
    const originalConfigure = node.configure;
    node.configure = function(data) {
        console.log("[WaveSpeed] Configuring node with data:", data);

        // Check for dynamic state (highest priority for execution)
        if (data._wavespeed_dynamic_state) {
            console.log("[WaveSpeed] Found dynamic state in workflow data");
            this._wavespeed_dynamic_state = data._wavespeed_dynamic_state;
        }

        // Check for cached model information (for UI restoration)
        if (data._wavespeed_model_cache) {
            console.log("[WaveSpeed] Found model cache in workflow data");
            this._wavespeed_model_cache = data._wavespeed_model_cache;
        }

        // Call original configure if it exists
        if (originalConfigure) {
            originalConfigure.call(this, data);
        }
    };

    // Function to create filtered inputs array that excludes placeholders
    const getVisibleInputs = () => {
        if (!node.inputs) return [];

        const visibleInputs = [];
        const hiddenInputs = [];

        for (const input of node.inputs) {
            if (input.name && input.name.startsWith("param_") && input.name.match(/^param_\d+$/)) {
                // Mark as placeholder and collect for hidden tracking
                input.hidden = true;
                input._wavespeed_placeholder = true;
                hiddenInputs.push(input);
            } else {
                visibleInputs.push(input);
            }
        }

        // Store hidden inputs for connection purposes
        node._wavespeed_hiddenInputs = hiddenInputs;

        console.log(`[WaveSpeed] Input filtering: ${visibleInputs.length} visible, ${hiddenInputs.length} hidden`);
        return visibleInputs;
    };

    // Override the inputs property getter to return filtered inputs for rendering
    let _actualInputs = node.inputs || [];

    Object.defineProperty(node, 'inputs', {
        get: function() {
            return _actualInputs;
        },
        set: function(newInputs) {
            _actualInputs = newInputs || [];
            // Immediately filter after setting
            this._updateVisibleInputs();
        },
        configurable: true,
        enumerable: true
    });

    // Method to update visible inputs
    node._updateVisibleInputs = function() {
        const allInputs = _actualInputs;
        const visibleInputs = [];
        const hiddenInputs = [];

        for (const input of allInputs) {
            if (input.name && input.name.startsWith("param_") && input.name.match(/^param_\d+$/)) {
                input.hidden = true;
                input._wavespeed_placeholder = true;
                hiddenInputs.push(input);
                console.log(`[WaveSpeed] Hiding placeholder input: ${input.name}`);
            } else {
                // This is a visible input (including dynamic parameter inputs)
                visibleInputs.push(input);
                console.log(`[WaveSpeed] Keeping visible input: ${input.name}`);
            }
        }

        // Store hidden inputs for connection mapping
        this._wavespeed_hiddenInputs = hiddenInputs;
        this._wavespeed_allInputs = allInputs;

        console.log(`[WaveSpeed] Updated visibility: ${visibleInputs.length} visible, ${hiddenInputs.length} hidden`);

        // Update the actual stored inputs to only include visible ones
        _actualInputs = visibleInputs;

        // Trigger size recalculation
        if (this.computeSize) {
            this.setSize(this.computeSize());
        }
    };

    // Override getInputData to check both visible and hidden inputs
    const originalGetInputData = node.getInputData;
    node.getInputData = function(slot) {
        // First check visible inputs
        const result = originalGetInputData ? originalGetInputData.call(this, slot) : undefined;
        if (result !== undefined) return result;

        // If not found in visible inputs, check hidden inputs
        if (this._wavespeed_hiddenInputs && this._wavespeed_hiddenInputs[slot - this.inputs.length]) {
            const hiddenInput = this._wavespeed_hiddenInputs[slot - this.inputs.length];
            if (hiddenInput.link) {
                const link = this.graph.links[hiddenInput.link];
                if (link) {
                    const originNode = this.graph.getNodeById(link.origin_id);
                    if (originNode) {
                        return originNode.getOutputData(link.origin_slot);
                    }
                }
            }
        }

        return undefined;
    };

    // Apply initial filtering - but delay it to ensure inputs are properly set up
    setTimeout(() => {
        if (node._updateVisibleInputs) {
            console.log("[WaveSpeed] Applying initial input filtering after setup");
            node._updateVisibleInputs();
        }
    }, 100);

    // Monitor for input changes
    const checkInterval = setInterval(() => {
        if (node.removed) {
            clearInterval(checkInterval);
            return;
        }

        // Check if inputs have been modified externally
        if (node._wavespeed_allInputs && _actualInputs.length !== node._wavespeed_allInputs.length - (node._wavespeed_hiddenInputs ? node._wavespeed_hiddenInputs.length : 0)) {
            console.log("[WaveSpeed] Inputs modified externally, reapplying hiding");
            node._updateVisibleInputs();
        }
    }, 1000);

    node._wavespeed_hideInterval = checkInterval;

    // Override onRemoved to clean up
    const originalOnRemoved = node.onRemoved;
    node.onRemoved = function() {
        if (this._wavespeed_hideInterval) {
            clearInterval(this._wavespeed_hideInterval);
        }
        if (originalOnRemoved) {
            originalOnRemoved.call(this);
        }
    };
}

// Setup dynamic input handling to sync connections with placeholders
function setupDynamicInputHandling(node) {
    // Override onConnectionsChange to handle dynamic input connections
    const originalOnConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function(type, slotIndex, isConnected, linkInfo, ioSlot) {
        console.log(`[WaveSpeed] Connection change: type=${type}, slot=${slotIndex}, connected=${isConnected}`, ioSlot);

        // Call original handler first
        if (originalOnConnectionsChange) {
            originalOnConnectionsChange.call(this, type, slotIndex, isConnected, linkInfo, ioSlot);
        }

        // Handle dynamic input connections
        if (type === LiteGraph.INPUT && ioSlot && ioSlot._wavespeed_dynamic) {
            const placeholderInput = ioSlot._wavespeed_placeholder_input;
            if (placeholderInput) {
                // Sync the connection to the placeholder input
                if (isConnected && linkInfo) {
                    placeholderInput.link = linkInfo.id;
                    console.log(`[WaveSpeed] Synced connection for ${ioSlot.name} -> ${placeholderInput.name} (link: ${linkInfo.id})`);
                } else {
                    placeholderInput.link = null;
                    console.log(`[WaveSpeed] Cleared connection for ${ioSlot.name} -> ${placeholderInput.name}`);
                }
            }
        }
    };

    // Override serialization to ensure correct transformation
    const originalSerialize = node.serialize;
    node.serialize = function() {
        const data = originalSerialize ? originalSerialize.call(this) : {};

        // We need to serialize all inputs, including hidden placeholders
        if (this._wavespeed_allInputs && this._wavespeed_allInputs.length > 0) {
            if (!data.inputs) data.inputs = [];

            // Make sure we capture all connections from both visible and hidden inputs
            for (let i = 0; i < this._wavespeed_allInputs.length; i++) {
                const input = this._wavespeed_allInputs[i];
                if (input.link) {
                    if (!data.inputs[i]) data.inputs[i] = {};
                    data.inputs[i].link = input.link;
                    console.log(`[WaveSpeed] Serializing connection for input ${input.name}: link ${input.link}`);
                }
            }
        }

        // CRITICAL: Store dynamic state for execution-time transformation
        if (this.wavespeedState && this.wavespeedState.modelId) {
            data._wavespeed_dynamic_state = {
                modelId: this.wavespeedState.modelId,
                category: this.wavespeedState.category,
                parameters: this.wavespeedState.parameters,
                parameterValues: this.wavespeedState.parameterValues,
                paramMapping: this.wavespeedState.paramMapping
            };
            console.log(`[WaveSpeed] Stored dynamic state for execution transformation`);
        }

        // CRITICAL: Cache model information in workflow for offline use
        if (this.wavespeedState && this.wavespeedState.modelId && this.wavespeedState.parameters.length > 0) {
            data._wavespeed_model_cache = {
                modelId: this.wavespeedState.modelId,
                category: this.wavespeedState.category,
                parameters: this.wavespeedState.parameters,
                parameterValues: this.wavespeedState.parameterValues,
                lastUpdated: Date.now()
            };
            console.log(`[WaveSpeed] Cached model information in workflow`);
        }

        return data;
    };

    // Override connectInput to handle connections to visible inputs that need to be redirected
    const originalConnectInput = node.connectInput;
    node.connectInput = function(slot, output) {
        const input = this.inputs[slot];

        if (input && input._wavespeed_dynamic && input._wavespeed_placeholder_input) {
            // This is a visible dynamic input that maps to a hidden placeholder
            console.log(`[WaveSpeed] Redirecting connection from visible input ${input.name} to placeholder ${input._wavespeed_placeholder_input.name}`);

            // Connect to the placeholder instead, but also maintain the connection on the visible input
            const result = originalConnectInput ? originalConnectInput.call(this, slot, output) : true;

            // Also establish the connection on the placeholder for backend processing
            if (input._wavespeed_placeholder_input && output) {
                input._wavespeed_placeholder_input.link = input.link;
            }

            return result;
        }

        return originalConnectInput ? originalConnectInput.call(this, slot, output) : true;
    };
}

// Restore model cache if available from workflow data
function restoreModelCacheIfAvailable(node) {
    // First check for dynamic state (execution data)
    if (node._wavespeed_dynamic_state) {
        console.log("[WaveSpeed] Found dynamic state, restoring...");

        const dynamicState = node._wavespeed_dynamic_state;

        // Restore state from dynamic state
        node.wavespeedState.modelId = dynamicState.modelId || "";
        node.wavespeedState.category = dynamicState.category || "";
        node.wavespeedState.parameters = dynamicState.parameters || [];
        node.wavespeedState.parameterValues = dynamicState.parameterValues || {};
        node.wavespeedState.paramMapping = dynamicState.paramMapping || {};

        console.log("[WaveSpeed] Dynamic state restoration completed");
        return true;
    }

    // Fallback to model cache (UI restoration data)
    if (node._wavespeed_model_cache) {
        console.log("[WaveSpeed] Found cached model information, restoring...");

        const cache = node._wavespeed_model_cache;

        // Restore state
        node.wavespeedState.modelId = cache.modelId || "";
        node.wavespeedState.category = cache.category || "";
        node.wavespeedState.parameters = cache.parameters || [];
        node.wavespeedState.parameterValues = cache.parameterValues || {};

        // Update global cache with model details
        if (cache.modelId && cache.parameters && cache.parameters.length > 0) {
            // Reconstruct model detail structure for cache
            const modelDetail = {
                input_schema: {
                    properties: {},
                    required: cache.parameters.filter(p => p.required).map(p => p.name)
                }
            };

            // Reconstruct the schema properties from cached parameters
            for (const param of cache.parameters) {
                modelDetail.input_schema.properties[param.name] = {
                    type: param.type.toLowerCase(),
                    description: param.description,
                    default: param.default,
                    required: param.required
                };

                if (param.options) {
                    modelDetail.input_schema.properties[param.name].enum = param.options;
                }
            }

            // Store in global cache
            GLOBAL_CACHE.modelDetails[cache.modelId] = modelDetail;
            console.log(`[WaveSpeed] Restored model ${cache.modelId} to global cache`);
        }

        console.log("[WaveSpeed] Model cache restoration completed");
        return true;
    }

    return false;
}

// Initialize the dynamic interface for a node
async function initializeDynamicInterface(node) {
    console.log("[WaveSpeed] Initializing dynamic interface for node:", node.id);

    // Check if we have cached model information to restore
    const hasCachedData = node.wavespeedState.modelId && node.wavespeedState.parameters.length > 0;

    if (hasCachedData) {
        console.log("[WaveSpeed] Using cached model data for initialization");

        // Initialize with cached data
        await initializeWithCachedData(node);
    } else {
        console.log("[WaveSpeed] No cached data, performing fresh initialization");

        // Clear existing dynamic widgets but keep original ones
        clearDynamicWidgets(node);

        // Add category selector
        await addCategorySelector(node);

        // Add model selector
        addModelSelector(node);
    }

    // CRITICAL: Force clear any existing dynamic inputs at initialization
    // This prevents leftover inputs from previous node states
    if (node.inputs) {
        const currentInputs = [...node.inputs];
        const dynamicInputs = currentInputs.filter(input =>
            input._wavespeed_dynamic && !input._wavespeed_placeholder &&
            !input.name.match(/^param_\d+$/)
        );

        if (dynamicInputs.length > 0) {
            console.log(`[WaveSpeed] Found ${dynamicInputs.length} leftover dynamic inputs during initialization, removing them`);

            // Remove dynamic inputs, keep only placeholders
            node.inputs = currentInputs.filter(input =>
                !input._wavespeed_dynamic || input._wavespeed_placeholder ||
                input.name.match(/^param_\d+$/)
            );

            // Update visible inputs to hide placeholders
            if (node._updateVisibleInputs) {
                node._updateVisibleInputs();
            }
        }
    }

    // Mark as initialized
    node.wavespeedState.isInitialized = true;

    // Debug: Check inputs after initialization
    console.log("[WaveSpeed] Inputs after initialization:", {
        inputCount: node.inputs ? node.inputs.length : 0,
        placeholderInputs: node.inputs ? node.inputs.filter(i => i.name && i.name.match(/^param_\d+$/)).map(i => ({ name: i.name, hidden: i.hidden, _wavespeed_placeholder: i._wavespeed_placeholder })) : []
    });

    console.log("[WaveSpeed] Dynamic interface initialized");

    // CRITICAL FIX: Force node size recalculation after initialization
    if (node.computeSize) {
        const newSize = node.computeSize();
        console.log(`[WaveSpeed] Setting node size after initialization to: [${newSize[0]}, ${newSize[1]}]`);
        node.setSize(newSize);

        // Verify the size was actually set
        setTimeout(() => {
            console.log(`[WaveSpeed] Node actual size after setSize: [${node.size[0]}, ${node.size[1]}]`);
        }, 10);
    }
}

// Initialize with cached data (for workflow restoration)
async function initializeWithCachedData(node) {
    console.log("[WaveSpeed] Initializing with cached data...");

    // Clear existing dynamic widgets but keep original ones
    clearDynamicWidgets(node);

    // Add category selector and wait for it to load
    await addCategorySelector(node);
    if (node.categoryWidget && node.wavespeedState.category) {
        node.categoryWidget.value = node.wavespeedState.category;
        console.log(`[WaveSpeed] Set category widget value to: ${node.wavespeedState.category}`);
    }

    // Add model selector and restore value
    addModelSelector(node);
    if (node.modelWidget && node.wavespeedState.modelId) {
        // We need to restore the display name, not the ID
        await restoreModelDisplayName(node);
    }

    // Restore parameters from cached data
    if (node.wavespeedState.parameters.length > 0) {
        await restoreParametersFromCache(node);
    }

    console.log("[WaveSpeed] Cached data initialization completed");
}

// Restore model display name from cached model ID
async function restoreModelDisplayName(node) {
    try {
        console.log(`[WaveSpeed] Restoring model display name for model: ${node.wavespeedState.modelId}`);
        console.log(`[WaveSpeed] Current category: ${node.wavespeedState.category}`);
        console.log(`[WaveSpeed] Category list available: ${!!node.wavespeedState.categoryList}`);

        if (!node.wavespeedState.category) {
            console.warn("[WaveSpeed] Cannot restore model display name without category");
            return;
        }

        const categoryValue = getCategoryValue(node);
        console.log(`[WaveSpeed] Category value resolved to: ${categoryValue}`);

        const models = await getCachedModelsByCategory(categoryValue);
        console.log(`[WaveSpeed] Found ${models.length} models for category ${categoryValue}`);

        if (models.length > 0) {
            console.log(`[WaveSpeed] Available models:`, models.map(m => `${m.name} (${m.value})`));
        }

        const model = models.find(m => m.value === node.wavespeedState.modelId);

        if (model && node.modelWidget) {
            node.modelWidget.value = model.name;
            const values = ["", ...models.map(m => m.name)];
            node.modelWidget.options.values = values;
            console.log(`[WaveSpeed] Restored model display name: ${model.name}`);
        } else {
            console.warn(`[WaveSpeed] Model not found or widget missing:`, {
                modelFound: !!model,
                widgetExists: !!node.modelWidget,
                targetModelId: node.wavespeedState.modelId
            });

            // Fallback: still populate the dropdown with available models
            if (node.modelWidget && models.length > 0) {
                const values = ["", ...models.map(m => m.name)];
                node.modelWidget.options.values = values;
                console.log(`[WaveSpeed] Populated model dropdown with ${models.length} models as fallback`);
            }
        }
    } catch (error) {
        console.warn("[WaveSpeed] Failed to restore model display name:", error);

        // Emergency fallback: trigger model selector update
        if (node.wavespeedState.category && node.modelWidget) {
            console.log("[WaveSpeed] Attempting emergency model selector update");
            try {
                await updateModelSelector(node);
            } catch (updateError) {
                console.error("[WaveSpeed] Emergency update also failed:", updateError);
            }
        }
    }
}

// Restore parameters from cached data
async function restoreParametersFromCache(node) {
    try {
        console.log(`[WaveSpeed] Restoring ${node.wavespeedState.parameters.length} cached parameters`);

        // Create dynamic parameter widgets and inputs from cached data
        const requiredParams = node.wavespeedState.parameters.filter(p => p.required);
        const optionalParams = node.wavespeedState.parameters.filter(p => !p.required);

        // Sort parameters by priority for input port allocation
        const allParams = [...requiredParams, ...optionalParams];

        // Separate parameters that need input ports from those that don't
        const paramsNeedingInputs = allParams.filter(p => shouldCreateInputPort(p));
        const paramsNotNeedingInputs = allParams.filter(p => !shouldCreateInputPort(p));

        // Sort parameters needing inputs by priority (high priority first)
        paramsNeedingInputs.sort((a, b) => {
            const priorityA = getInputPortPriority(a);
            const priorityB = getInputPortPriority(b);

            if (priorityA !== priorityB) {
                return priorityB - priorityA; // Higher priority first
            }

            // If same priority, required parameters first
            if (a.required !== b.required) {
                return a.required ? -1 : 1;
            }

            return 0;
        });

        // Create widgets for all parameters, but prioritize input ports
        const sortedParams = [...paramsNeedingInputs, ...paramsNotNeedingInputs];

        for (let i = 0; i < sortedParams.length; i++) {
            const param = sortedParams[i];
            const widget = createParameterWidget(node, param, i);

            // Restore parameter value if available
            if (widget && node.wavespeedState.parameterValues[param.name] !== undefined) {
                widget.value = node.wavespeedState.parameterValues[param.name];
            }
        }

        // Update request_json with parameter values
        updateRequestJsonWidget(node);

        console.log("[WaveSpeed] Parameter restoration completed");
    } catch (error) {
        console.warn("[WaveSpeed] Failed to restore parameters from cache:", error);
    }
}

// Add category selector widget
async function addCategorySelector(node) {
    const categoryWidget = node.addWidget(
        "combo",
        "Category",
        "",
        async (value) => {
            if (node.wavespeedState.category === value) return;

            console.log(`[WaveSpeed] Category changed from '${node.wavespeedState.category}' to '${value}'`);

            node.wavespeedState.category = value;
            clearModelAndParameters(node);

            if (value) {
                await updateModelSelector(node);
            }
        },
        { values: [""] }
    );

    // Mark as dynamic widget
    categoryWidget._wavespeed_dynamic = true;
    categoryWidget._wavespeed_base = true;
    node.categoryWidget = categoryWidget;

    // Load categories asynchronously and store the promise
    const categoriesPromise = getCachedCategories().then(categories => {
        node.wavespeedState.categoryList = categories;
        const values = ["", ...categories.map(cat => cat.name)];
        categoryWidget.options.values = values;
        console.log(`[WaveSpeed] Category selector populated with ${categories.length} categories`);
        return categories;
    });

    // Store the promise for waiting
    node._categoriesPromise = categoriesPromise;
    return categoriesPromise;
}

// Add model selector widget
function addModelSelector(node) {
    const modelWidget = node.addWidget(
        "combo",
        "Model",
        "",
        async (value) => {
            if (value === "Loading...") return;

            if (value && node.wavespeedState.category) {
                const models = await getCachedModelsByCategory(getCategoryValue(node));
                const selectedModel = models.find(m => m.name === value);
                if (selectedModel) {
                    const previousModelId = node.wavespeedState.modelId;
                    node.wavespeedState.modelId = selectedModel.value;

                    // Update the original model_id widget
                    updateOriginalModelIdWidget(node, selectedModel.value);

                    if (previousModelId !== node.wavespeedState.modelId) {
                        await updateModelParameters(node);
                    }
                }
            } else {
                if (node.wavespeedState.modelId !== "") {
                    node.wavespeedState.modelId = "";
                    updateOriginalModelIdWidget(node, "");
                    clearModelParameters(node);
                }
            }
        },
        { values: [""] }
    );

    // Mark as dynamic widget
    modelWidget._wavespeed_dynamic = true;
    modelWidget._wavespeed_base = true;
    node.modelWidget = modelWidget;
}

// Update the original model_id widget value (stored separately from visible widgets)
function updateOriginalModelIdWidget(node, modelId) {
    // Store in hidden widgets instead of main widgets array
    if (!node.wavespeedState.hiddenWidgets.model_id) {
        node.wavespeedState.hiddenWidgets.model_id = {
            name: "model_id",
            type: "text",
            value: modelId,
            hidden: true,
            serialize: true,
            callback: () => {}, // Prevent LiteGraph warnings
            options: {}
        };
        console.log(`[WaveSpeed] Created hidden model_id storage`);
    }

    node.wavespeedState.hiddenWidgets.model_id.value = modelId;
    console.log(`[WaveSpeed] Updated hidden model_id to: ${modelId}`);
}

// Get category value from category list
function getCategoryValue(node) {
    if (node.wavespeedState.categoryList) {
        const category = node.wavespeedState.categoryList.find(cat => cat.name === node.wavespeedState.category);
        return category ? category.value : node.wavespeedState.category;
    }
    return node.wavespeedState.category;
}

// Update model selector
async function updateModelSelector(node) {
    if (!node.wavespeedState.category || !node.modelWidget) return;

    try {
        node.modelWidget.value = "Loading...";
        node.modelWidget.options.values = ["Loading..."];

        const categoryValue = getCategoryValue(node);
        const models = await getCachedModelsByCategory(categoryValue);
        const values = ["", ...models.map(model => model.name)];

        node.modelWidget.options.values = values;

        // Automatically select the first model
        if (models.length > 0) {
            const firstModel = models[0];
            node.modelWidget.value = firstModel.name;
            node.wavespeedState.modelId = firstModel.value;
            updateOriginalModelIdWidget(node, firstModel.value);
            await updateModelParameters(node);
        } else {
            node.modelWidget.value = "";
            node.wavespeedState.modelId = "";
            updateOriginalModelIdWidget(node, "");
        }
    } catch (error) {
        console.warn("Failed to update model selector:", error);
        node.modelWidget.options.values = [""];
        node.modelWidget.value = "";
        node.wavespeedState.modelId = "";
        updateOriginalModelIdWidget(node, "");
    }
}

// Update model parameters
async function updateModelParameters(node) {
    if (!node.wavespeedState.modelId) {
        clearModelParameters(node);
        return;
    }

    try {
        const modelDetail = await getCachedModelDetail(node.wavespeedState.modelId);

        if (!modelDetail?.input_schema) {
            clearModelParameters(node);
            return;
        }

        const parameters = parseModelParameters(modelDetail.input_schema);

        if (parameters.length === 0) {
            clearModelParameters(node);
            return;
        }

        // Clear old dynamic parameters
        clearModelParameters(node);

        // Save parameter information
        node.wavespeedState.parameters = parameters;

        console.log(`[WaveSpeed] Model parameters: ${parameters.length} total`);

        // Create dynamic parameter widgets and inputs
        const requiredParams = parameters.filter(p => p.required);
        const optionalParams = parameters.filter(p => !p.required);

        // Sort parameters by priority for input port allocation
        const allParams = [...requiredParams, ...optionalParams];

        // Separate parameters that need input ports from those that don't
        const paramsNeedingInputs = allParams.filter(p => shouldCreateInputPort(p));
        const paramsNotNeedingInputs = allParams.filter(p => !shouldCreateInputPort(p));

        // Sort parameters needing inputs by priority (high priority first)
        paramsNeedingInputs.sort((a, b) => {
            const priorityA = getInputPortPriority(a);
            const priorityB = getInputPortPriority(b);

            if (priorityA !== priorityB) {
                return priorityB - priorityA; // Higher priority first
            }

            // If same priority, required parameters first
            if (a.required !== b.required) {
                return a.required ? -1 : 1;
            }

            return 0;
        });

        console.log(`[WaveSpeed] Parameter allocation order:`, {
            needingInputs: paramsNeedingInputs.map(p => ({ name: p.name, priority: getInputPortPriority(p), required: p.required })),
            totalNeedingInputs: paramsNeedingInputs.length,
            availableSlots: 20
        });

        // Create widgets for all parameters, but prioritize input ports
        const sortedParams = [...paramsNeedingInputs, ...paramsNotNeedingInputs];

        for (let i = 0; i < sortedParams.length; i++) {
            const param = sortedParams[i];
            createParameterWidget(node, param, i);
        }

        // Update request_json with parameter values
        updateRequestJsonWidget(node);

        // CRITICAL FIX: Force node size recalculation after adding all widgets
        if (node.computeSize) {
            const newSize = node.computeSize();
            console.log(`[WaveSpeed] Setting node size after adding ${sortedParams.length} widgets to: [${newSize[0]}, ${newSize[1]}]`);
            node.setSize(newSize);

            // IMMEDIATE: Force layout recalculation
            if (node.setDirtyCanvas) {
                node.setDirtyCanvas(true, true);
            }

            // Verify the size was actually set
            setTimeout(() => {
                console.log(`[WaveSpeed] Node actual size after widget addition: [${node.size[0]}, ${node.size[1]}]`);

                // Additional check: ensure widgets are positioned correctly
                if (node.widgets && node.widgets.length > 2) { // More than just Category and Model
                    console.log(`[WaveSpeed] Widget positioning verification:`);
                    for (let i = 0; i < node.widgets.length; i++) {
                        const widget = node.widgets[i];
                        const widgetY = widget.y || 0;
                        console.log(`[WaveSpeed]   Widget "${widget.name}": y=${widgetY}px`);
                    }
                }
            }, 10);
        }

        // ADDITIONAL FIX: Delayed size recalculation to handle layout settling
        setTimeout(() => {
            if (node.computeSize) {
                const delayedSize = node.computeSize();
                console.log(`[WaveSpeed] Setting delayed node size to: [${delayedSize[0]}, ${delayedSize[1]}]`);
                node.setSize(delayedSize);

                // CRITICAL: Force canvas redraw to apply changes
                if (app.graph) {
                    app.graph.setDirtyCanvas(true, true);
                }

                // Final verification
                setTimeout(() => {
                    console.log(`[WaveSpeed] Final node size after delayed recalculation: [${node.size[0]}, ${node.size[1]}]`);

                    // Check if all widgets are visible and positioned correctly
                    if (node.widgets) {
                        const visibleWidgets = node.widgets.filter(w => !w.hidden);
                        console.log(`[WaveSpeed] Final widget count: ${visibleWidgets.length} visible widgets`);
                    }
                }, 50);
            }
        }, 100);

        // Trigger UI update
        if (app.graph) {
            app.graph.setDirtyCanvas(true, true);
        }

    } catch (error) {
        console.warn("Failed to update model parameters:", error);
        clearModelParameters(node);
    }
}

// Create parameter widget
function createParameterWidget(node, param, paramIndex) {
    console.log(`[WaveSpeed] Creating widget for parameter: ${param.name} (${param.type})`);

    const paramName = param.name.toLowerCase();
    const description = param.description?.toLowerCase() || '';
    const displayName = `${param.required ? '* ' : ''}${param.displayName}`;
    let widget = null;

    try {
        // Special handling for the 'seed' parameter
        if (paramName === 'seed' || paramName.includes('seed')) {
            widget = createSeedWidget(node, param, displayName);
        }
        // Boolean type
        else if (param.type === "BOOLEAN") {
            widget = node.addWidget("toggle", displayName, param.default ?? false,
                (value) => {
                    node.wavespeedState.parameterValues[param.name] = value;
                    updateRequestJsonWidget(node);
                },
                { on: "true", off: "false" }
            );
        }
        // String type (including multiline text and arrays)
        else if (param.type === "STRING") {
            const isMultiline = (
                description.includes("prompt") ||
                description.includes("text") ||
                description.includes("description") ||
                paramName.includes("prompt") ||
                paramName.includes("description") ||
                paramName.includes("text") ||
                paramName.includes("instruction") ||
                paramName.includes("content") ||
                paramName.includes("image") ||  // Add images to multiline
                (param.default && typeof param.default === 'string' && param.default.length > 50)
            );

            const isArray = param.isArray;
            const arrayTooltip = isArray ? " (comma-separated)" : "";

            // CRITICAL FIX: Arrays should also be multiline if they contain complex data
            if (isMultiline || isArray) {
                // Use ComfyWidgets to create a multiline text input
                const comfyWidget = ComfyWidgets["STRING"](
                    node,
                    displayName + arrayTooltip,
                    ["STRING", { multiline: true, dynamicPrompts: true }],
                    app
                );
                widget = comfyWidget.widget;
                widget.value = param.default || "";
                widget.callback = (value) => {
                    node.wavespeedState.parameterValues[param.name] = value;
                    updateRequestJsonWidget(node);
                };

                // CRITICAL FIX: Force widget height adjustment for better sizing
                if (widget.inputEl) {
                    // Set a reasonable height for multiline inputs
                    widget.inputEl.style.minHeight = "60px";
                    widget.inputEl.style.maxHeight = "120px";
                    widget.inputEl.style.resize = "vertical";
                }
            } else {
                // Single-line text input
                const placeholder = param.default || "";
                widget = node.addWidget("text", displayName + arrayTooltip, placeholder,
                    (value) => {
                        node.wavespeedState.parameterValues[param.name] = value;
                        updateRequestJsonWidget(node);
                    }
                );
            }

            // Mark array widgets for special processing
            if (isArray) {
                widget._wavespeed_is_array = true;
                widget._wavespeed_array_item_type = param.arrayItems?.type || 'string';
                console.log(`[WaveSpeed] Array parameter ${param.name} with item type: ${widget._wavespeed_array_item_type}`);
            }
        }
        // COMBO type
        else if (param.type === "COMBO" && param.options) {
            widget = node.addWidget("combo", displayName, param.default || param.options[0] || "",
                (value) => {
                    node.wavespeedState.parameterValues[param.name] = value;
                    updateRequestJsonWidget(node);
                },
                { values: param.options }
            );
        }
        // Numeric types
        else if (param.type === "INT" || param.type === "FLOAT") {
            const isFloat = param.type === "FLOAT";
            const options = {
                precision: isFloat ? 2 : 0,
                step: param.step ?? (isFloat ? 0.01 : 1)
            };
            if (param.min !== undefined) options.min = param.min;
            if (param.max !== undefined) options.max = param.max;

            widget = node.addWidget("number", displayName, param.default ?? (isFloat ? 0.0 : 0),
                (value) => {
                    node.wavespeedState.parameterValues[param.name] = value;
                    updateRequestJsonWidget(node);
                },
                options
            );
        }
        // Default to string for other types
        else {
            console.warn(`[WaveSpeed] Unknown parameter type: ${param.type}, using text widget`);
            widget = node.addWidget("text", displayName, param.default || "",
                (value) => {
                    node.wavespeedState.parameterValues[param.name] = value;
                    updateRequestJsonWidget(node);
                }
            );
        }

        if (!widget) {
            console.warn(`Widget creation returned null for parameter: ${param.name}`);
            return null;
        }

        // Add tooltip description
        if (param.description && widget.inputEl) {
            widget.inputEl.title = param.description;
        }

        // Mark as a dynamic widget
        widget._wavespeed_dynamic = true;
        widget._wavespeed_param_name = param.name;
        widget._wavespeed_param_index = paramIndex;
        widget._wavespeed_required = param.required;

        // IMPORTANT: Trigger layout update immediately after widget creation
        setTimeout(() => {
            if (node.computeSize) {
                const updatedSize = node.computeSize();
                node.setSize(updatedSize);
                console.log(`[WaveSpeed] Updated node size after adding widget "${param.name}": [${updatedSize[0]}, ${updatedSize[1]}]`);
            }
        }, 10);

        // Create a corresponding input port for supported types
        if (shouldCreateInputPort(param)) {
            const inputPort = createWidgetInputPort(node, widget, param);
            if (!inputPort) {
                console.warn(`[WaveSpeed] Could not create input port for ${param.name} - likely due to placeholder limit (20 max). Parameter will only have widget input.`);
            }
        }

        console.log(`[WaveSpeed] Successfully created ${widget.type} widget for ${param.name}`);

    } catch (error) {
        console.warn(`Failed to create widget for parameter ${param.name}:`, error);
        return null;
    }

    return widget;
}

// Create a corresponding input port for a widget using placeholder system
function createWidgetInputPort(node, widget, param) {
    try {
        // Allocate a placeholder for this parameter
        const placeholderInfo = allocatePlaceholder(node, param);
        if (!placeholderInfo) {
            console.warn(`[WaveSpeed] No available placeholder for parameter: ${param.name}`);
            return null;
        }

        const placeholderName = placeholderInfo.placeholder;

        // Find the corresponding hidden placeholder input from the hidden inputs array
        let placeholderInput = null;

        // First, try to find in hidden inputs
        if (node._wavespeed_hiddenInputs) {
            placeholderInput = node._wavespeed_hiddenInputs.find(input => input.name === placeholderName);
        }

        // Fallback: check in all inputs if not found in hidden inputs
        if (!placeholderInput && node._wavespeed_allInputs) {
            placeholderInput = node._wavespeed_allInputs.find(input => input.name === placeholderName);
        }

        // Fallback: check in the original inputs array directly
        if (!placeholderInput && node._wavespeed_originalInputs) {
            placeholderInput = node._wavespeed_originalInputs.find(input => input.name === placeholderName);
        }

        // Final fallback: check in current node.inputs
        if (!placeholderInput && node.inputs) {
            placeholderInput = node.inputs.find(input => input.name === placeholderName);
        }

        if (!placeholderInput) {
            console.warn(`[WaveSpeed] Placeholder input not found: ${placeholderName}. Available inputs:`, {
                hiddenInputs: node._wavespeed_hiddenInputs ? node._wavespeed_hiddenInputs.map(i => i.name) : [],
                allInputs: node._wavespeed_allInputs ? node._wavespeed_allInputs.map(i => i.name) : [],
                originalInputs: node._wavespeed_originalInputs ? node._wavespeed_originalInputs.map(i => i.name) : [],
                currentInputs: node.inputs ? node.inputs.map(i => i.name) : []
            });
            return null;
        }

        // Create a new visible input with the parameter name that redirects to the placeholder
        const paramInput = {
            name: param.name,
            type: param.type === 'INT' || param.type === 'FLOAT' ? 'NUMBER' : param.type,
            link: null,
            _wavespeed_dynamic: true,
            _wavespeed_param_name: param.name,
            _wavespeed_widget_pair: widget,
            _wavespeed_placeholder: placeholderName,
            _wavespeed_placeholder_input: placeholderInput
        };

        console.log(`[WaveSpeed] Creating visible input for ${param.name} -> ${placeholderName}`);

        // Use the node's own method to add the input safely
        if (node.addInput) {
            // Try to use ComfyUI's addInput method first
            const addedInput = node.addInput(param.name, param.type === 'INT' || param.type === 'FLOAT' ? 'NUMBER' : param.type);
            if (addedInput) {
                // Copy our custom properties to the added input
                Object.assign(addedInput, {
                    _wavespeed_dynamic: true,
                    _wavespeed_param_name: param.name,
                    _wavespeed_widget_pair: widget,
                    _wavespeed_placeholder: placeholderName,
                    _wavespeed_placeholder_input: placeholderInput
                });

                // Record the paired input port on the widget
                widget._wavespeed_input_pair = addedInput;

                console.log(`[WaveSpeed] Successfully created input using addInput for: ${param.name} -> ${placeholderName}`);
                return addedInput;
            }
        }

        // Fallback: manually add to inputs array
        if (!node.inputs) node.inputs = [];
        node.inputs.push(paramInput);

        // Store it in the all inputs for tracking
        if (!node._wavespeed_allInputs) node._wavespeed_allInputs = [];
        node._wavespeed_allInputs.push(paramInput);

        // Record the paired input port on the widget
        widget._wavespeed_input_pair = paramInput;

        console.log(`[WaveSpeed] Successfully created input manually for: ${param.name} -> ${placeholderName}`);

        return paramInput;
    } catch (error) {
        console.warn(`Failed to create input port for widget ${param.name}:`, error);
    }

    return null;
}

// Allocate a placeholder for a parameter with type information
function allocatePlaceholder(node, param) {
    const paramName = param.name;

    // Check if this parameter already has a placeholder
    if (node.wavespeedState.paramMapping[paramName]) {
        return node.wavespeedState.paramMapping[paramName];
    }

    // Find the next available placeholder
    let placeholderName = null;
    for (let i = node.wavespeedState.nextPlaceholderIndex; i <= 20; i++) {
        const candidateName = `param_${i}`;
        if (!node.wavespeedState.usedPlaceholders.has(candidateName)) {
            placeholderName = candidateName;
            node.wavespeedState.nextPlaceholderIndex = i + 1;
            break;
        }
    }

    if (!placeholderName) {
        console.error(`[WaveSpeed] No more placeholder slots available! Cannot create input port for parameter: ${paramName}`);
        console.error(`[WaveSpeed] Current usage:`, {
            nextIndex: node.wavespeedState.nextPlaceholderIndex,
            usedSlots: Array.from(node.wavespeedState.usedPlaceholders),
            maxSlots: 20
        });
        return null;
    }

    // Determine parameter type
    let paramType = param.type?.toLowerCase() || 'string';

    // Special handling for array parameters
    if (param.isArray) {
        const itemType = param.arrayItems?.type?.toLowerCase() || 'string';
        if (itemType === 'number' || itemType === 'integer' || itemType === 'float') {
            paramType = 'array-int';
        } else {
            paramType = 'array-str';
        }
    }

    // Create placeholder info object
    const placeholderInfo = {
        placeholder: placeholderName,
        type: paramType,
        originalType: param.type,
        isArray: param.isArray || false,
        arrayItemType: param.arrayItems?.type
    };

    // Record the mapping
    node.wavespeedState.paramMapping[paramName] = placeholderInfo;
    node.wavespeedState.usedPlaceholders.add(placeholderName);

    // Update param_map widget
    updateParamMapWidget(node);

    console.log(`[WaveSpeed] Allocated placeholder: ${paramName} -> ${placeholderName} (${paramType})`);
    return placeholderInfo;
}

// Update the param_map widget with current mappings (stored separately from visible widgets)
function updateParamMapWidget(node) {
    // Store in hidden widgets instead of main widgets array
    if (!node.wavespeedState.hiddenWidgets.param_map) {
        node.wavespeedState.hiddenWidgets.param_map = {
            name: "param_map",
            type: "text",
            value: "{}",
            hidden: true,
            serialize: true,
            callback: () => {}, // Prevent LiteGraph warnings
            options: {}
        };
        console.log(`[WaveSpeed] Created hidden param_map storage`);
    }

    try {
        const mappingJson = JSON.stringify(node.wavespeedState.paramMapping);
        node.wavespeedState.hiddenWidgets.param_map.value = mappingJson;
        console.log(`[WaveSpeed] Updated hidden param_map: ${mappingJson}`);
    } catch (error) {
        console.warn("Failed to update param_map:", error);
        node.wavespeedState.hiddenWidgets.param_map.value = "{}";
    }
}

// Special handling for creating the seed widget
function createSeedWidget(node, param, displayName) {
    console.log(`[WaveSpeed] Creating special seed widget for: ${param.name}`);

    const widget = node.addWidget("number", displayName, param.default ?? -1,
        (value) => {
            node.wavespeedState.parameterValues[param.name] = value;
            updateRequestJsonWidget(node);
        },
        { precision: 0, step: 1, min: -3, max: 1125899906842624 }
    );

    // Add dedicated buttons for each seed parameter
    const randomButton = node.addWidget("button", "🎲 Random Seed", "", () => {
        const randomSeed = Math.floor(Math.random() * 1125899906842624);
        widget.value = randomSeed;
        node.wavespeedState.parameterValues[param.name] = randomSeed;
        updateRequestJsonWidget(node);
    }, { serialize: false });

    const autoRandomButton = node.addWidget("button", "🎲 Auto Random", "", () => {
        widget.value = -1;
        node.wavespeedState.parameterValues[param.name] = -1;
        updateRequestJsonWidget(node);
    }, { serialize: false });

    // Mark the buttons as dynamic and bind them to this seed parameter
    randomButton._wavespeed_dynamic = true;
    randomButton._wavespeed_seed_button = true;
    randomButton._wavespeed_param_name = param.name;

    autoRandomButton._wavespeed_dynamic = true;
    autoRandomButton._wavespeed_seed_button = true;
    autoRandomButton._wavespeed_param_name = param.name;

    return widget;
}

// Update the request_json widget with current parameter values (stored separately from visible widgets)
function updateRequestJsonWidget(node) {
    // Store in hidden widgets instead of main widgets array
    if (!node.wavespeedState.hiddenWidgets.request_json) {
        node.wavespeedState.hiddenWidgets.request_json = {
            name: "request_json",
            type: "text",
            value: "{}",
            hidden: true,
            serialize: true,
            callback: () => {}, // Prevent LiteGraph warnings
            options: {}
        };
        console.log(`[WaveSpeed] Created hidden request_json storage`);
    }

    const values = collectParameterValues(node);

    try {
        const jsonString = JSON.stringify(values, null, 2);
        node.wavespeedState.hiddenWidgets.request_json.value = jsonString;
        console.log(`[WaveSpeed] Updated hidden request_json:`, values);
    } catch (error) {
        console.warn("Failed to update request_json:", error);
        node.wavespeedState.hiddenWidgets.request_json.value = "{}";
    }
}

// Collect parameter values (updated for execution transformation)
function collectParameterValues(node) {
    const widgetValues = {};
    const connectedParams = {};

    // Collect values from widgets, identifying which have input connections
    for (const widget of node.widgets || []) {
        if (widget._wavespeed_param_name && !widget.hidden) {
            const paramName = widget._wavespeed_param_name;

            // Check for a paired input connection
            const pairedInput = widget._wavespeed_input_pair;
            const hasInputConnection = pairedInput && pairedInput.link;

            if (hasInputConnection) {
                // This parameter will be provided via input connection
                // Record the mapping for param_map
                const placeholderInfo = node.wavespeedState.paramMapping[paramName];
                if (placeholderInfo && placeholderInfo.placeholder) {
                    connectedParams[paramName] = placeholderInfo;
                    console.log(`[WaveSpeed] Parameter ${paramName} connected via ${placeholderInfo.placeholder} (${placeholderInfo.type})`);
                }
            } else {
                // No input connection, use the widget's value
                let value = widget.value;

                if (value !== undefined && value !== null) {
                    // Handle array type conversion
                    if (widget._wavespeed_is_array && typeof value === 'string' && value.trim() !== '') {
                        try {
                            const arrayValue = value.split(',').map(item => item.trim()).filter(item => item !== '');

                            // Convert array items based on their type
                            const itemType = widget._wavespeed_array_item_type || 'string';
                            if (itemType === 'number') {
                                value = arrayValue.map(item => {
                                    const num = parseFloat(item);
                                    return isNaN(num) ? item : num;
                                });
                            } else {
                                value = arrayValue; // Keep as strings
                            }

                            console.log(`[WaveSpeed] Converted array parameter ${paramName} (${itemType}):`, value);
                        } catch (error) {
                            console.warn(`[WaveSpeed] Failed to convert array parameter ${paramName}:`, error);
                        }
                    }

                    if (widget.type === "string" && typeof value === 'string' && value.trim() === '') {
                        if (widget._wavespeed_required) {
                            widgetValues[paramName] = value;
                        }
                    } else if (widget.type === "boolean" || value !== '') {
                        widgetValues[paramName] = value;
                    }
                } else if (widget._wavespeed_required) {
                    widgetValues[paramName] = value;
                }
            }
        }
    }

    // Store connected parameters in the parameter mapping for execution
    node.wavespeedState.connectedParams = connectedParams;

    return widgetValues;
}

// Collect parameter metadata (array types, etc.)
function collectParameterMetadata(node) {
    const metadata = {};

    for (const widget of node.widgets || []) {
        if (widget._wavespeed_param_name && !widget.hidden) {
            const paramName = widget._wavespeed_param_name;
            metadata[paramName] = {
                isArray: widget._wavespeed_is_array || false,
                arrayItemType: widget._wavespeed_array_item_type || 'string'
            };
        }
    }

    return metadata;
}

// Clear model and parameters
function clearModelAndParameters(node) {
    // Clear model selection
    if (node.modelWidget) {
        node.modelWidget.value = "";
        node.modelWidget.options.values = [""];
    }
    node.wavespeedState.modelId = "";
    updateOriginalModelIdWidget(node, "");

    // Clear dynamic parameters
    clearModelParameters(node);
}

// Clear model parameters
function clearModelParameters(node) {
    console.log("[WaveSpeed] === Starting clearModelParameters ===");

    // Force clear all parameter states
    node.wavespeedState.parameters = [];
    node.wavespeedState.parameterValues = {};

    // Clean up dynamic widgets (keep only base widgets and original widgets)
    if (node.widgets) {
        const baseWidgets = node.widgets.filter(widget =>
            widget._wavespeed_base ||
            (widget.name === "Category" || widget.name === "Model") ||
            (!widget._wavespeed_dynamic && !widget._wavespeed_param_name && !widget._wavespeed_seed_button)
        );
        const dynamicWidgets = node.widgets.filter(widget =>
            widget._wavespeed_dynamic && !widget._wavespeed_base
        );

        console.log(`[WaveSpeed] Widget cleanup: ${baseWidgets.length} base widgets, ${dynamicWidgets.length} dynamic widgets to remove`);

        for (const widget of dynamicWidgets) {
            if (widget.onRemove) {
                widget.onRemove();
            }
        }

        node.widgets = baseWidgets;
    }

    // For the new input filtering system, we need to reset the inputs differently
    if (node._updateVisibleInputs) {
        console.log("[WaveSpeed] Using new input filtering system");

        // CRITICAL FIX: Completely reset the input system
        // First, clear all inputs and reset the tracking arrays
        node.inputs = [];
        node._wavespeed_hiddenInputs = [];

        // Get only the original placeholder inputs from the initial setup
        if (node._wavespeed_originalInputs) {
            const placeholderInputs = node._wavespeed_originalInputs.filter(input =>
                input.name && input.name.match(/^param_\d+$/)
            );

            console.log(`[WaveSpeed] Restoring ${placeholderInputs.length} original placeholder inputs`);

            // Reset the internal inputs structure to only placeholders
            node._wavespeed_allInputs = [...placeholderInputs];

            // Mark all placeholders as hidden and clear their links
            for (const placeholderInput of placeholderInputs) {
                placeholderInput.link = null;
                placeholderInput.hidden = true;
                placeholderInput._wavespeed_placeholder = true;
            }

            // Store hidden inputs
            node._wavespeed_hiddenInputs = [...placeholderInputs];

            // Update visible inputs (should show none since all are placeholders)
            node._updateVisibleInputs();
        } else {
            console.warn("[WaveSpeed] No original inputs found, creating fresh placeholder set");
            // If no original inputs, we'll rely on the backend structure being recreated
            node._wavespeed_allInputs = [];
            node._wavespeed_hiddenInputs = [];
        }
    } else {
        // Fallback to old method if new system not available
        console.log("[WaveSpeed] Using fallback input cleanup");

        const baseInputs = node.originalInputs || [];
        const dynamicInputs = node.inputs ? node.inputs.filter(input =>
            input._wavespeed_dynamic && !input._wavespeed_placeholder
        ) : [];
        const placeholderInputs = node.inputs ? node.inputs.filter(input =>
            input._wavespeed_placeholder || (input.name && input.name.match(/^param_\d+$/))
        ) : [];

        console.log(`[WaveSpeed] Fallback cleanup: ${dynamicInputs.length} dynamic inputs, preserving ${placeholderInputs.length} placeholder inputs`);

        // Clean up pairing relationships for dynamic inputs
        for (const input of dynamicInputs) {
            if (input._wavespeed_widget_pair) {
                input._wavespeed_widget_pair._wavespeed_input_pair = null;
            }
        }

        // Clear links from placeholders and ensure they stay hidden
        for (const placeholderInput of placeholderInputs) {
            placeholderInput.link = null;
            placeholderInput.hidden = true;
            placeholderInput._wavespeed_placeholder = true;
        }

        // Reconstruct inputs: base inputs + hidden placeholder inputs (no duplicates)
        const uniquePlaceholderInputs = placeholderInputs.filter((input, index, self) =>
            self.findIndex(i => i.name === input.name) === index
        );

        node.inputs = [...baseInputs, ...uniquePlaceholderInputs];
        console.log(`[WaveSpeed] Reconstructed inputs: ${baseInputs.length} base + ${uniquePlaceholderInputs.length} unique placeholders`);
    }

    // Clear request_json
    updateRequestJsonWidget(node);

    // Clear param_map - this is crucial to avoid duplicate allocations
    clearParamMapping(node);

    console.log("[WaveSpeed] === clearModelParameters completed ===");

    // CRITICAL FIX: Force node size recalculation after clearing widgets
    if (node.computeSize) {
        const newSize = node.computeSize();
        console.log(`[WaveSpeed] Setting node size after clearing widgets to: [${newSize[0]}, ${newSize[1]}]`);
        node.setSize(newSize);

        // Verify the size was actually set
        setTimeout(() => {
            console.log(`[WaveSpeed] Node actual size after clearing: [${node.size[0]}, ${node.size[1]}]`);
        }, 10);
    }

    // ADDITIONAL FIX: Delayed size recalculation for cleanup
    setTimeout(() => {
        if (node.computeSize) {
            const delayedSize = node.computeSize();
            node.setSize(delayedSize);
            console.log(`[WaveSpeed] Node size updated after delayed cleanup recalculation:`, delayedSize);
        }
        if (app.graph) {
            app.graph.setDirtyCanvas(true, true);
        }
    }, 100);

    if (app.graph) {
        app.graph.setDirtyCanvas(true, true);
    }
}

// Clear parameter mapping completely (used when switching models)
function clearParamMapping(node) {
    node.wavespeedState.paramMapping = {};
    node.wavespeedState.usedPlaceholders.clear();
    node.wavespeedState.nextPlaceholderIndex = 1;
    updateParamMapWidget(node);
    console.log("[WaveSpeed] Cleared parameter mapping");
}

// Clear all dynamic widgets
function clearDynamicWidgets(node) {
    if (node.widgets) {
        const nonDynamicWidgets = node.widgets.filter(widget => !widget._wavespeed_dynamic);
        const dynamicWidgets = node.widgets.filter(widget => widget._wavespeed_dynamic);

        for (const widget of dynamicWidgets) {
            if (widget.onRemove) {
                widget.onRemove();
            }
        }

        node.widgets = nonDynamicWidgets;
    }
}

console.log("[WaveSpeed] Dynamic real node extension loaded");

// ========================================
// EXECUTION-TIME TRANSFORMATION (rgthree pattern)
// ========================================

// Override app.graphToPrompt to intercept and transform dynamic nodes for workflow saving
const originalGraphToPrompt = app.graphToPrompt;
app.graphToPrompt = async function() {
    console.log("[WaveSpeed] === GRAPH TO PROMPT INTERCEPTION (workflow save) ===");

    // Call original graphToPrompt first
    const result = await originalGraphToPrompt.apply(app, arguments);

    // Transform dynamic nodes in the result
    if (result && result.output) {
        console.log("[WaveSpeed] Transforming dynamic nodes in output...");
        result.output = transformDynamicNodesForExecution(result.output);
    }

    return result;
};

// Override api.queuePrompt to intercept and transform dynamic nodes for task execution
const originalQueuePrompt = api.queuePrompt;
api.queuePrompt = async function(number, prompt, ...args) {
    console.log("[WaveSpeed] === QUEUE PROMPT INTERCEPTION (task execution) ===");

    // Transform dynamic nodes in the prompt before sending to server
    if (prompt && prompt.output) {
        console.log("[WaveSpeed] Transforming dynamic nodes for execution...");
        prompt.output = transformDynamicNodesForExecution(prompt.output);
    }

    // Also transform workflow if present (for complete compatibility)
    if (prompt && prompt.workflow && prompt.workflow.nodes) {
        console.log("[WaveSpeed] Transforming dynamic nodes in workflow...");
        prompt.workflow = transformDynamicNodesInWorkflow(prompt.workflow);
    }

    // Call original queuePrompt
    return await originalQueuePrompt.apply(api, [number, prompt, ...args]);
};

// Transform dynamic nodes to real node format for execution
function transformDynamicNodesForExecution(promptOutput) {
    const transformedOutput = {};

    for (const nodeId in promptOutput) {
        const nodeData = promptOutput[nodeId];

        // Check if this is a WaveSpeed dynamic node that needs transformation
        if (nodeData && nodeData.class_type === "WaveSpeedAI Task Create") {
            // Look for dynamic state in the node data or try to collect from current graph
            let dynamicState = nodeData._wavespeed_dynamic_state;

            // If no dynamic state in serialized data, try to collect from current graph node
            if (!dynamicState) {
                dynamicState = collectDynamicStateFromGraphNode(nodeId);
            }

            if (dynamicState && dynamicState.modelId) {
                console.log(`[WaveSpeed] Transforming dynamic node ${nodeId} for execution`);
                const transformedNode = transformDynamicNodeForExecution(nodeData, dynamicState);
                transformedOutput[nodeId] = transformedNode;
                console.log(`[WaveSpeed] Node ${nodeId} transformed:`, transformedNode);
            } else {
                // Keep non-dynamic nodes as-is
                transformedOutput[nodeId] = nodeData;
            }
        } else {
            // Keep non-WaveSpeed nodes as-is
            transformedOutput[nodeId] = nodeData;
        }
    }

    return transformedOutput;
}

// Collect dynamic state from current graph node (for execution time)
function collectDynamicStateFromGraphNode(nodeId) {
    try {
        if (!app.graph || !app.graph.nodes) {
            return null;
        }

        // Find the graph node by ID
        const graphNode = app.graph.nodes.find(n => n.id == nodeId);
        if (!graphNode || !graphNode.wavespeedState) {
            return null;
        }

        const state = graphNode.wavespeedState;

        // Only return state if we have a valid model selected
        if (!state.modelId || !state.parameters || state.parameters.length === 0) {
            return null;
        }

        // Collect current parameter values from widgets
        const currentParamValues = collectParameterValues(graphNode);

        // Build comprehensive parameter mapping by combining stored mapping and current connections
        const finalParamMapping = { ...state.paramMapping };

        // Add any current connections that might not be in stored mapping
        if (state.connectedParams) {
            Object.assign(finalParamMapping, state.connectedParams);
        }

        console.log("[WaveSpeed] Collected dynamic state:", {
            modelId: state.modelId,
            parameterCount: state.parameters.length,
            paramValueCount: Object.keys(currentParamValues).length,
            paramMappingCount: Object.keys(finalParamMapping).length,
            finalParamMapping: Object.keys(finalParamMapping).map(key => ({
                param: key,
                placeholder: finalParamMapping[key].placeholder || finalParamMapping[key],
                type: finalParamMapping[key].type || 'unknown'
            }))
        });

        return {
            modelId: state.modelId,
            category: state.category,
            parameters: state.parameters,
            parameterValues: currentParamValues,
            paramMapping: finalParamMapping,
            // Also include widget metadata for proper array handling
            parameterMetadata: collectParameterMetadata(graphNode)
        };
    } catch (error) {
        console.warn(`[WaveSpeed] Failed to collect dynamic state from graph node ${nodeId}:`, error);
        return null;
    }
}

// Transform a single dynamic node to real node format
function transformDynamicNodeForExecution(nodeData, dynamicState) {
    console.log("[WaveSpeed] Transforming node with dynamic state:", dynamicState);

    // Build the request JSON from parameter values (only widget values, not connected ones)
    const requestJson = {};
    const parameterMetadata = dynamicState.parameterMetadata || {};

    for (const [paramName, value] of Object.entries(dynamicState.parameterValues || {})) {
        // Clean parameter name (remove '* ' prefix)
        const cleanParamName = paramName.startsWith('* ') ? paramName.substring(2) : paramName;

        // Get parameter metadata
        const metadata = parameterMetadata[paramName] || {};
        let processedValue = value;

        // Special handling for array parameters
        if (metadata.isArray && Array.isArray(value)) {
            // Convert array items to correct type
            if (metadata.arrayItemType === 'number') {
                processedValue = value.map(item => {
                    if (typeof item === 'string') {
                        const num = parseFloat(item);
                        return isNaN(num) ? item : num;
                    }
                    return item;
                });
            } else {
                // Ensure all items are strings
                processedValue = value.map(item => String(item));
            }
            console.log(`[WaveSpeed] Processed array parameter ${cleanParamName} (${metadata.arrayItemType}):`, processedValue);
        }

        requestJson[cleanParamName] = processedValue;
    }

    // Build param_map from parameter mapping (maps model params to placeholder inputs)
    const paramMap = dynamicState.paramMapping || {};

    // Create the transformed node data with the three required hidden inputs
    const transformedInputs = {
        model_id: dynamicState.modelId,
        request_json: JSON.stringify(requestJson),
        param_map: JSON.stringify(paramMap)
    };

    // CRITICAL: Map dynamic parameter connections to placeholder connections
    if (nodeData.inputs) {
        console.log("[WaveSpeed] Processing input connections:", Object.keys(nodeData.inputs));

        for (const inputName in nodeData.inputs) {
            const inputValue = nodeData.inputs[inputName];

            if (Array.isArray(inputValue)) {
                // This is a connection
                console.log(`[WaveSpeed] Found connection: ${inputName} = ${inputValue}`);

                // Check if this is a direct placeholder connection
                if (inputName.match(/^param_\d+$/)) {
                    transformedInputs[inputName] = inputValue;
                    console.log(`[WaveSpeed] Direct placeholder connection: ${inputName}`);
                } else {
                    // Check if this dynamic parameter should be mapped to a placeholder
                    const cleanInputName = inputName.startsWith('* ') ? inputName.substring(2) : inputName;

                    // Find the corresponding placeholder for this parameter
                    const placeholderInfo = paramMap[cleanInputName];
                    if (placeholderInfo && placeholderInfo.placeholder) {
                        transformedInputs[placeholderInfo.placeholder] = inputValue;
                        console.log(`[WaveSpeed] Mapped dynamic parameter '${inputName}' to placeholder '${placeholderInfo.placeholder}' (${placeholderInfo.type}): ${inputValue}`);
                    } else {
                        // No mapping found, this might be an older connection format
                        console.warn(`[WaveSpeed] No placeholder mapping found for connected parameter: ${inputName}`);
                    }
                }
            }
        }
    }

    const transformedNode = {
        inputs: transformedInputs,
        class_type: "WaveSpeedAI Task Create",
        _meta: nodeData._meta || { title: "WaveSpeedAI Task Create [WIP]" }
    };

    console.log("[WaveSpeed] Transformation result:", {
        modelId: dynamicState.modelId,
        requestJsonKeys: Object.keys(requestJson),
        paramMapSize: Object.keys(paramMap).length,
        placeholderConnections: Object.keys(transformedInputs).filter(k => k.match(/^param_\d+$/) && Array.isArray(transformedInputs[k])),
        totalInputs: Object.keys(transformedInputs).length,
        allConnections: Object.keys(transformedInputs).filter(k => Array.isArray(transformedInputs[k]))
    });

    return transformedNode;
}

// Transform dynamic nodes in workflow format (for workflow field)
function transformDynamicNodesInWorkflow(workflow) {
    if (!workflow || !workflow.nodes) {
        return workflow;
    }

    const transformedWorkflow = JSON.parse(JSON.stringify(workflow)); // Deep copy

    for (let i = 0; i < transformedWorkflow.nodes.length; i++) {
        const node = transformedWorkflow.nodes[i];

        // Check if this is a dynamic node that needs transformation
        if (node && node.type === "WaveSpeedAI Task Create") {
            // Look for dynamic state in the node data or try to collect from current graph
            let dynamicState = node._wavespeed_dynamic_state;

            // If no dynamic state in workflow data, try to collect from current graph node
            if (!dynamicState) {
                dynamicState = collectDynamicStateFromGraphNode(node.id);
            }

            if (dynamicState && dynamicState.modelId) {
                console.log(`[WaveSpeed] Transforming workflow node ${node.id} for execution`);
                const transformedNode = transformDynamicNodeInWorkflow(node, dynamicState);
                transformedWorkflow.nodes[i] = transformedNode;
                console.log(`[WaveSpeed] Workflow node ${node.id} transformed`);
            }
        }
    }

    return transformedWorkflow;
}

// Transform a single dynamic node in workflow format
function transformDynamicNodeInWorkflow(nodeData, dynamicState) {
    // Build the request JSON from parameter values (only widget values, not connected ones)
    const requestJson = {};
    for (const [paramName, value] of Object.entries(dynamicState.parameterValues || {})) {
        // Clean parameter name (remove '* ' prefix)
        const cleanParamName = paramName.startsWith('* ') ? paramName.substring(2) : paramName;
        requestJson[cleanParamName] = value;
    }

    // Build param_map from parameter mapping
    const paramMap = dynamicState.paramMapping || {};

    // Create transformed node with widget values for the three hidden inputs
    const transformedNode = {
        ...nodeData,
        type: "WaveSpeedAI Task Create",
        widgets_values: [
            dynamicState.modelId,                    // model_id
            JSON.stringify(requestJson),             // request_json
            JSON.stringify(paramMap)                 // param_map
        ]
    };

    // Remove dynamic state markers from the transformed node
    delete transformedNode._wavespeed_dynamic_state;
    delete transformedNode._wavespeed_model_cache;

    console.log("[WaveSpeed] Workflow transformation result:", {
        modelId: dynamicState.modelId,
        requestJsonKeys: Object.keys(requestJson),
        paramMapSize: Object.keys(paramMap).length,
        widgetValues: transformedNode.widgets_values
    });

    return transformedNode;
}

// Force clean initial state - removes any unexpected inputs on fresh nodes
function forceCleanInitialState(node) {
    console.log("[WaveSpeed] === Force cleaning initial state ===");

    // Only clean if there are obviously problematic inputs (like duplicate prompts)
    if (node.inputs) {
        console.log("[WaveSpeed] Initial inputs:", node.inputs.map(i => ({ name: i.name, hidden: i.hidden })));

        // Look for duplicate non-placeholder inputs (like multiple "prompt" inputs)
        const nonPlaceholderInputs = node.inputs.filter(input =>
            input.name && !input.name.match(/^param_\d+$/)
        );

        const inputNames = nonPlaceholderInputs.map(i => i.name);
        const duplicateNames = inputNames.filter((name, index) => inputNames.indexOf(name) !== index);

        if (duplicateNames.length > 0) {
            console.log(`[WaveSpeed] Found duplicate inputs:`, duplicateNames);

            // Remove only the duplicate instances, keep one of each
            const seenNames = new Set();
            node.inputs = node.inputs.filter(input => {
                if (!input.name || input.name.match(/^param_\d+$/)) {
                    return true; // Keep all placeholder inputs
                }

                if (seenNames.has(input.name)) {
                    console.log(`[WaveSpeed] Removing duplicate input: ${input.name}`);
                    return false; // Remove duplicate
                }

                seenNames.add(input.name);
                return true; // Keep first instance
            });

            console.log(`[WaveSpeed] After duplicate removal: ${node.inputs.length} inputs`);
        }
    }

    console.log("[WaveSpeed] === Initial state cleanup completed ===");
}