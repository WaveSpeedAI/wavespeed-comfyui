/**
 * WaveSpeed Dynamic Real Node - Dynamic parameter rendering on real ComfyUI nodes
 *
 * This replaces the virtual node approach with dynamic parameter discovery
 * applied directly to the real WaveSpeedTaskCreateDynamic node.
 */

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { ComfyWidgets } from "../../../scripts/widgets.js";

const DEBUG_MODE = true;

function logDebug(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

function logWarn(...args) {
    if (DEBUG_MODE) {
        console.warn(...args);
    }
}

logDebug("[WaveSpeed] Loading dynamic real node extension...");

// Global state for tracking graph configuration
const WAVESPEED_STATE = {
    graph_being_configured: 0,  // Counter for nested configure calls
    deferred_actions: []        // Actions to execute after graph configuration
};

// Global cache for model data - shared across all node instances
// Uses localStorage for persistence across page refreshes
const GLOBAL_CACHE = {
    cacheExpiry: 5 * 60 * 1000, // 5-minute cache expiration
    
    // Load from localStorage
    get categories() {
        try {
            const cached = localStorage.getItem('wavespeed_categories');
            if (cached) {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < this.cacheExpiry) {
                    return data.value;
                }
            }
        } catch (e) {
            logWarn('[WaveSpeed] Failed to load categories from cache:', e);
        }
        return null;
    },
    set categories(value) {
        try {
            localStorage.setItem('wavespeed_categories', JSON.stringify({
                value: value,
                timestamp: Date.now()
            }));
        } catch (e) {
            logWarn('[WaveSpeed] Failed to save categories to cache:', e);
        }
    },
    
    getModelsByCategory(category) {
        try {
            const cached = localStorage.getItem(`wavespeed_models_${category}`);
            if (cached) {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < this.cacheExpiry) {
                    return data.value;
                }
            }
        } catch (e) {
            logWarn(`[WaveSpeed] Failed to load models for ${category} from cache:`, e);
        }
        return null;
    },
    setModelsByCategory(category, value) {
        try {
            localStorage.setItem(`wavespeed_models_${category}`, JSON.stringify({
                value: value,
                timestamp: Date.now()
            }));
        } catch (e) {
            logWarn(`[WaveSpeed] Failed to save models for ${category} to cache:`, e);
        }
    },
    
    getModelDetail(modelId) {
        try {
            const cached = localStorage.getItem(`wavespeed_model_${modelId}`);
            if (cached) {
                const data = JSON.parse(cached);
                // Model details don't expire
                return data.value;
            }
        } catch (e) {
            logWarn(`[WaveSpeed] Failed to load model detail for ${modelId} from cache:`, e);
        }
        return null;
    },
    setModelDetail(modelId, value) {
        try {
            localStorage.setItem(`wavespeed_model_${modelId}`, JSON.stringify({
                value: value,
                timestamp: Date.now()
            }));
        } catch (e) {
            logWarn(`[WaveSpeed] Failed to save model detail for ${modelId} to cache:`, e);
        }
    },
    
    // Intelligent parameter caching system
    modelHistory: {
        maxHistory: 5,  // Keep last 5 model switches
        records: []     // Array of model parameter snapshots
        // Each record: {
        //     modelId: string,
        //     category: string,
        //     timestamp: number,
        //     parameters: { paramName: { value, link, type } },
        //     connections: { paramName: { originNode, originSlot, linkId, targetType } }
        // }
    }
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
    const cached = GLOBAL_CACHE.categories;
    if (cached) {
        logDebug("[WaveSpeed] ✅ Using cached categories");
        return cached;
    }
    
    logDebug("[WaveSpeed] Fetching fresh categories...");
    const categories = await getModelCategories();
    GLOBAL_CACHE.categories = categories;
    return categories;
}

async function getCachedModelsByCategory(category) {
    const cached = GLOBAL_CACHE.getModelsByCategory(category);
    if (cached) {
        logDebug(`[WaveSpeed] ✅ Using cached models for category: ${category}`);
        return cached;
    }
    
    logDebug(`[WaveSpeed] Fetching fresh models for category: ${category}`);
    const models = await getModelsByCategory(category);
    GLOBAL_CACHE.setModelsByCategory(category, models);
    return models;
}

async function getCachedModelDetail(modelId) {
    const cached = GLOBAL_CACHE.getModelDetail(modelId);
    if (cached) {
        logDebug(`[WaveSpeed] ✅ Using cached model detail: ${modelId}`);
        return cached;
    }
    
    logDebug(`[WaveSpeed] Fetching fresh model detail: ${modelId}`);
    const detail = await getModelDetail(modelId);
    if (detail) {
        GLOBAL_CACHE.setModelDetail(modelId, detail);
    }
    return detail;
}

// Check if a property is a LoraWeight type
function isLoraWeightType(prop) {
    if (!prop) return false;

    // Case 1: Direct LoraWeight reference
    if (prop['$ref'] === '#/components/schemas/LoraWeight') {
        return true;
    }

    // Case 2: Array of LoraWeight
    if (prop.type === 'array' && prop.items && prop.items['$ref'] === '#/components/schemas/LoraWeight') {
        return true;
    }

    return false;
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

        // Special handling for LoraWeight detection
        if (isLoraWeightType(prop)) {
            param.type = "LORA_WEIGHT";
            param.isLoraWeight = true;
            param.isLoraArray = prop.type === 'array';
            logDebug(`[WaveSpeed] Detected LoraWeight parameter: ${propName}`, {
                isArray: param.isLoraArray,
                originalType: prop.type,
                hasItems: !!prop.items,
                itemsRef: prop.items ? prop.items['$ref'] : null,
                directRef: prop['$ref'],
                schema: prop
            });
        }

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
        'array': 'STRING',  // Handle arrays as comma-separated strings in UI by default
        'object': 'DICT'
    };

    return typeMap[prop.type] || 'STRING';
}

// Determine if a parameter needs an input port
function shouldCreateInputPort(param) {
    const supportedInputTypes = ['STRING', 'INT', 'FLOAT', 'BOOLEAN', 'LORA_WEIGHT'];
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

// ============================================================================
// INTELLIGENT PARAMETER CACHING SYSTEM
// ============================================================================

/**
 * Save current model's parameters and connections to history
 * @param {Object} node - The node instance
 */
function saveModelToHistory(node) {
    if (!node.wavespeedState || !node.wavespeedState.modelId) {
        logDebug("[WaveSpeed] No model to save to history");
        return;
    }

    const modelId = node.wavespeedState.modelId;
    const category = node.wavespeedState.category;
    
    logDebug(`[WaveSpeed] Saving model "${modelId}" to history...`);

    // Collect parameter values
    const parameters = {};
    const connections = {};
    
    if (node.wavespeedState.parameters) {
        for (const param of node.wavespeedState.parameters) {
            const paramName = param.name;
            
            // Get parameter value from widgets
            const widget = node.widgets?.find(w => w.name === `* ${paramName}` || w.name === paramName);
            const value = widget ? widget.value : (node.wavespeedState.parameterValues?.[paramName] || param.default);
            
            // Get connection info from inputs
            let link = null;
            let connectionInfo = null;
            
            if (node.inputs) {
                const input = node.inputs.find(i => i.name === paramName && !i.name.match(/^param_\d+$/));
                logDebug(`[WaveSpeed] Checking input for "${paramName}":`, {
                    found: !!input,
                    hasLink: input?.link != null,
                    linkId: input?.link
                });
                
                if (input && input.link != null) {
                    link = input.link;
                    
                    // Try to get detailed connection info from the graph
                    if (node.graph && node.graph.links && node.graph.links[input.link]) {
                        const linkObj = node.graph.links[input.link];
                        connectionInfo = {
                            originNode: linkObj.origin_id,
                            originSlot: linkObj.origin_slot,
                            linkId: input.link,
                            targetType: input.type
                        };
                        logDebug(`[WaveSpeed] ✅ Saved connection info for "${paramName}":`, connectionInfo);
                    } else {
                        logWarn(`[WaveSpeed] ⚠️ Link ${input.link} found but linkObj not in graph.links`);
                    }
                }
            }
            
            parameters[paramName] = {
                value: value,
                link: link,
                type: param.type
            };
            
            if (connectionInfo) {
                connections[paramName] = connectionInfo;
            }
        }
    }

    // Create history record
    const record = {
        modelId: modelId,
        category: category,
        timestamp: Date.now(),
        parameters: parameters,
        connections: connections
    };

    // Add to history, maintaining max size
    const history = GLOBAL_CACHE.modelHistory.records;
    
    // Remove existing record for this model (if any)
    const existingIndex = history.findIndex(r => r.modelId === modelId);
    if (existingIndex >= 0) {
        history.splice(existingIndex, 1);
        logDebug(`[WaveSpeed] Removed old record for model "${modelId}"`);
    }
    
    // Add new record at the beginning (most recent)
    history.unshift(record);
    
    // Keep only maxHistory records
    if (history.length > GLOBAL_CACHE.modelHistory.maxHistory) {
        const removed = history.splice(GLOBAL_CACHE.modelHistory.maxHistory);
        logDebug(`[WaveSpeed] Removed ${removed.length} old history records`);
    }
    
    logDebug(`[WaveSpeed] Saved model to history. Total records: ${history.length}`);
    logDebug(`[WaveSpeed] Saved ${Object.keys(parameters).length} parameters, ${Object.keys(connections).length} connections`);
}

/**
 * Restore parameters and connections from history for a model
 * @param {Object} node - The node instance
 * @param {string} modelId - The model ID to restore
 * @returns {Object|null} - The restored record or null if not found
 */
function getModelFromHistory(modelId) {
    const history = GLOBAL_CACHE.modelHistory.records;
    const record = history.find(r => r.modelId === modelId);
    
    if (record) {
        logDebug(`[WaveSpeed] Found history record for model "${modelId}"`, {
            parameterCount: Object.keys(record.parameters).length,
            connectionCount: Object.keys(record.connections).length,
            age: Math.round((Date.now() - record.timestamp) / 1000) + 's ago'
        });
        return record;
    }
    
    logDebug(`[WaveSpeed] No history record found for model "${modelId}"`);
    return null;
}

/**
 * Find matching parameters from recent history
 * Searches for same parameter names in recent model switches
 * @param {Array} currentParameters - Current model's parameter definitions
 * @returns {Object} - Matched parameter values and connections
 */
function findMatchingParametersFromHistory(currentParameters) {
    const matches = {
        parameters: {},
        connections: {}
    };
    
    if (!currentParameters || currentParameters.length === 0) {
        return matches;
    }
    
    const currentParamNames = new Set(currentParameters.map(p => p.name));
    const history = GLOBAL_CACHE.modelHistory.records;
    
    logDebug(`[WaveSpeed] Searching for matching parameters in ${history.length} history records...`);
    
    // Go through history from most recent to oldest
    for (const record of history) {
        for (const [paramName, paramData] of Object.entries(record.parameters)) {
            // If this parameter name exists in current model and we haven't found it yet
            if (currentParamNames.has(paramName) && !matches.parameters[paramName]) {
                matches.parameters[paramName] = paramData;
                
                // Also check for connection
                if (record.connections[paramName]) {
                    matches.connections[paramName] = record.connections[paramName];
                }
                
                logDebug(`[WaveSpeed] Found match for "${paramName}" from model "${record.modelId}"`);
            }
        }
    }
    
    logDebug(`[WaveSpeed] Found ${Object.keys(matches.parameters).length} matching parameters from history`);
    return matches;
}

/**
 * Restore parameter values and connections from history after creating widgets
 * @param {Object} node - The node instance
 * @param {Array} parameters - The parameter definitions for current model
 */
function restoreParametersFromHistory(node, parameters) {
    if (!node.wavespeedState || !node.wavespeedState.modelId) {
        return;
    }

    const modelId = node.wavespeedState.modelId;
    logDebug(`[WaveSpeed] Attempting to restore parameters for model "${modelId}"...`);

    // Try to get exact match from history first
    let historyRecord = getModelFromHistory(modelId);
    let matches = null;

    if (!historyRecord) {
        // No exact match, try to find matching parameters from recent history
        matches = findMatchingParametersFromHistory(parameters);
        
        if (Object.keys(matches.parameters).length === 0) {
            logDebug("[WaveSpeed] No history data to restore");
            return;
        }
    }

    // Restore parameter values and connections
    const parametersToRestore = historyRecord ? historyRecord.parameters : matches.parameters;
    const connectionsToRestore = historyRecord ? historyRecord.connections : matches.connections;
    
    let restoredCount = 0;
    let connectionCount = 0;

    for (const param of parameters) {
        const paramName = param.name;
        const paramData = parametersToRestore[paramName];
        
        if (!paramData) {
            continue;
        }

        // Restore widget value
        const widget = node.widgets?.find(w => 
            w.name === `* ${paramName}` || w.name === paramName
        );
        
        if (widget) {
            widget.value = paramData.value;
            node.wavespeedState.parameterValues[paramName] = paramData.value;
            restoredCount++;
            logDebug(`[WaveSpeed] Restored value for "${paramName}":`, paramData.value);
        }

        // Restore connection (if exists)
        const connectionData = connectionsToRestore?.[paramName];
        logDebug(`[WaveSpeed] Checking connection for "${paramName}":`, {
            hasConnectionData: !!connectionData,
            connectionData: connectionData,
            hasInputs: !!node.inputs,
            hasGraph: !!node.graph,
            inputCount: node.inputs?.length
        });
        
        if (connectionData && node.inputs && node.graph) {
            const inputIndex = node.inputs.findIndex(i => 
                i.name === paramName && !i.name.match(/^param_\d+$/)
            );
            
            logDebug(`[WaveSpeed] Found input index for "${paramName}": ${inputIndex}`);
            
            if (inputIndex >= 0) {
                // Verify the source node and slot still exist
                const sourceNode = node.graph.getNodeById(connectionData.originNode);
                logDebug(`[WaveSpeed] Source node check:`, {
                    nodeId: connectionData.originNode,
                    nodeExists: !!sourceNode,
                    hasOutputs: !!sourceNode?.outputs,
                    outputSlot: connectionData.originSlot,
                    slotExists: !!sourceNode?.outputs?.[connectionData.originSlot]
                });
                
                if (sourceNode && sourceNode.outputs && sourceNode.outputs[connectionData.originSlot]) {
                    try {
                        // Use LiteGraph's connect method to create a NEW link
                        // This ensures proper link ID allocation and graph consistency
                        sourceNode.connect(connectionData.originSlot, node, inputIndex);
                        connectionCount++;
                        logDebug(`[WaveSpeed] ✅ Recreated connection for "${paramName}" from node ${connectionData.originNode} slot ${connectionData.originSlot}`);
                    } catch (error) {
                        logWarn(`[WaveSpeed] ❌ Failed to recreate connection for "${paramName}":`, error);
                    }
                } else {
                    logWarn(`[WaveSpeed] ❌ Cannot restore connection for "${paramName}": source node or slot not found`);
                }
            } else {
                logWarn(`[WaveSpeed] ❌ Cannot find input for "${paramName}" in node.inputs:`, node.inputs.map(i => i.name));
            }
        }
    }

    if (historyRecord) {
        logDebug(`[WaveSpeed] ✅ Restored from exact model history: ${restoredCount} values, ${connectionCount} connections`);
    } else {
        logDebug(`[WaveSpeed] ✅ Restored from matching parameters: ${restoredCount} values, ${connectionCount} connections`);
    }
}

// Register extension to modify the real node
app.registerExtension({
    name: "wavespeed.DynamicRealNode",
    
    // Hook into graph configuration lifecycle
    beforeConfigureGraph() {
        WAVESPEED_STATE.graph_being_configured++;
        logDebug(`[WaveSpeed] beforeConfigureGraph: graph_being_configured = ${WAVESPEED_STATE.graph_being_configured}`);
    },
    
    afterConfigureGraph() {
        WAVESPEED_STATE.graph_being_configured--;
        logDebug(`[WaveSpeed] afterConfigureGraph: graph_being_configured = ${WAVESPEED_STATE.graph_being_configured}`);
        
        // Execute any deferred actions
        while (WAVESPEED_STATE.deferred_actions.length > 0) {
            const action = WAVESPEED_STATE.deferred_actions.shift();
            try {
                action.fn(...action.args);
            } catch (e) {
                console.error(`[WaveSpeed] Error executing deferred action:`, e);
            }
        }
    },

    async nodeCreated(node) {
        // Only apply to our target node
        if (node.comfyClass !== "WaveSpeedAI Task Create") {
            return;
        }

        logDebug("[WaveSpeed] Enhancing real node with dynamic capabilities:", node.id);

        // Debug: Log initial node state
        logDebug("[WaveSpeed] Initial node state:", {
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
            hiddenWidgets: {}, // Store hidden widgets separately from main widgets array
            isRestoringFromCache: false // Flag to prevent duplicate parameter loading during cache restoration
        };

        // Store original widgets for later cleanup
        node.originalWidgets = [...(node.widgets || [])];
        node.originalInputs = [...(node.inputs || [])];

        // CRITICAL FIX: Override computeSize to properly handle node sizing
        const originalComputeSize = node.computeSize;
        node.computeSize = function(out) {
            let size = originalComputeSize ? originalComputeSize.call(this, out) : [200, 100];
            logDebug(`[WaveSpeed] Original computed size: [${size[0]}, ${size[1]}]`);

            // Calculate ONLY visible widgets (completely ignore hidden widgets)
            if (this.widgets && this.widgets.length > 0) {
                logDebug(`[WaveSpeed] Widget positioning analysis for node ${this.id}:`);

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
                        logDebug(`[WaveSpeed]   Widget "${widget.name}": HIDDEN/INTERNAL, completely skipped`);
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
                        logDebug(`[WaveSpeed]   Widget "${widget.name}": multiline, ${lines} lines, height=${widgetHeight}px, y=${currentY}`);
                    } else if (widget._wavespeed_is_lora_weight) {
                        // Special handling for LoRA weight widgets (multiline)
                        multilineWidgetCount++;
                        const lines = Math.max((widget.value || "").split('\n').length, 4); // Default to 4 lines for LoRA
                        widgetHeight = Math.max(100, lines * 22); // Minimum 100px for LoRA widgets
                        widgetMargin = 15; // Extra margin for LoRA widgets
                        logDebug(`[WaveSpeed]   Widget "${widget.name}": LoRA weight, ${lines} lines, height=${widgetHeight}px, y=${currentY}`);
                    } else if (widget.type === "combo") {
                        widgetHeight = 32; // Slightly taller for combo boxes
                        logDebug(`[WaveSpeed]   Widget "${widget.name}": combo, height=${widgetHeight}px, y=${currentY}`);
                    } else if (widget.type === "number" || widget.type === "text") {
                        widgetHeight = 28; // Standard height for input fields
                        logDebug(`[WaveSpeed]   Widget "${widget.name}": ${widget.type}, height=${widgetHeight}px, y=${currentY}`);
                    } else {
                        logDebug(`[WaveSpeed]   Widget "${widget.name}": type=${widget.type}, height=${widgetHeight}px, y=${currentY}`);
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

                logDebug(`[WaveSpeed] Layout calculation: ${visibleWidgetCount} visible widgets, totalHeight=${maxRequiredHeight}px, multiline=${multilineWidgetCount}, arrays=${arrayWidgetCount}`);

                // OVERRIDE: Use our calculated height instead of the original
                size[1] = maxRequiredHeight;
                logDebug(`[WaveSpeed] OVERRIDE: Setting height to calculated ${maxRequiredHeight}px`);
            }

            logDebug(`[WaveSpeed] Final computed size: [${size[0]}, ${size[1]}]`);
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
            logDebug("[WaveSpeed] Delayed initialization starting...");
            logDebug("[WaveSpeed] Node state before initialization:", {
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
    logDebug("[WaveSpeed] Setting up persistent input hiding for node:", node.id);

    // Store original inputs for restoration
    node._wavespeed_originalInputs = node.inputs ? [...node.inputs] : [];

    // Check for cached model information from workflow load
    const originalConfigure = node.configure;
    node.configure = function(data) {
        logDebug("[WaveSpeed] Configuring node with data:", data);

        // Check for dynamic state (highest priority for execution)
        if (data._wavespeed_dynamic_state) {
            logDebug("[WaveSpeed] Found dynamic state in workflow data");
            this._wavespeed_dynamic_state = data._wavespeed_dynamic_state;
        }

        // Check for cached model information (for UI restoration)
        if (data._wavespeed_model_cache) {
            logDebug("[WaveSpeed] Found model cache in workflow data");
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

        logDebug(`[WaveSpeed] Input filtering: ${visibleInputs.length} visible, ${hiddenInputs.length} hidden`);
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
                logDebug(`[WaveSpeed] Hiding placeholder input: ${input.name}`);
            } else {
                // This is a visible input (including dynamic parameter inputs)
                visibleInputs.push(input);
                logDebug(`[WaveSpeed] Keeping visible input: ${input.name}`);
            }
        }

        // Store hidden inputs for connection mapping
        this._wavespeed_hiddenInputs = hiddenInputs;
        this._wavespeed_allInputs = allInputs;

        logDebug(`[WaveSpeed] Updated visibility: ${visibleInputs.length} visible, ${hiddenInputs.length} hidden`);

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
            logDebug("[WaveSpeed] Applying initial input filtering after setup");
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
            logDebug("[WaveSpeed] Inputs modified externally, reapplying hiding");
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
        // CRITICAL: Skip during graph configuration to avoid interfering with ComfyUI's workflow loading
        if (WAVESPEED_STATE.graph_being_configured > 0) {
            logDebug(`[WaveSpeed] Skipping connection change during graph configuration`);
            if (originalOnConnectionsChange) {
                originalOnConnectionsChange.call(this, type, slotIndex, isConnected, linkInfo, ioSlot);
            }
            return;
        }
        
        logDebug(`[WaveSpeed] Connection change: type=${type}, slot=${slotIndex}, connected=${isConnected}`, ioSlot);

        // Call original handler first
        if (originalOnConnectionsChange) {
            originalOnConnectionsChange.call(this, type, slotIndex, isConnected, linkInfo, ioSlot);
        }

        // Handle dynamic input connections with improved sync
        if (type === LiteGraph.INPUT && ioSlot && ioSlot._wavespeed_dynamic) {
            const placeholderInput = ioSlot._wavespeed_placeholder_input;
            if (placeholderInput) {
                // Sync the connection to the placeholder input
                if (isConnected && linkInfo) {
                    placeholderInput.link = linkInfo.id;
                    logDebug(`[WaveSpeed] Synced connection for ${ioSlot.name} -> ${placeholderInput.name} (link: ${linkInfo.id})`);
                } else {
                    placeholderInput.link = null;
                    logDebug(`[WaveSpeed] Cleared connection for ${ioSlot.name} -> ${placeholderInput.name}`);
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

            // Serialize connections from all inputs (visible and hidden)
            for (let i = 0; i < this._wavespeed_allInputs.length; i++) {
                const input = this._wavespeed_allInputs[i];
                if (input.link) {
                    if (!data.inputs[i]) data.inputs[i] = {};
                    data.inputs[i].link = input.link;
                    logDebug(`[WaveSpeed] Serializing connection for input ${input.name}: link ${input.link}`);
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
            logDebug(`[WaveSpeed] Stored dynamic state for execution transformation`);
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
            logDebug(`[WaveSpeed] Cached model information in workflow`);
        }

        return data;
    };

    // Override connectInput to handle connections to visible inputs that need to be redirected
    const originalConnectInput = node.connectInput;
    node.connectInput = function(slot, output) {
        const input = this.inputs[slot];

        if (input && input._wavespeed_dynamic && input._wavespeed_placeholder_input) {
            // This is a visible dynamic input that maps to a hidden placeholder
            logDebug(`[WaveSpeed] Redirecting connection from visible input ${input.name} to placeholder ${input._wavespeed_placeholder_input.name}`);

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
        logDebug("[WaveSpeed] Found dynamic state, restoring...");

        const dynamicState = node._wavespeed_dynamic_state;

        // Restore state from dynamic state
        node.wavespeedState.modelId = dynamicState.modelId || "";
        node.wavespeedState.category = dynamicState.category || "";
        node.wavespeedState.parameters = dynamicState.parameters || [];
        node.wavespeedState.parameterValues = dynamicState.parameterValues || {};
        node.wavespeedState.paramMapping = dynamicState.paramMapping || {};

        logDebug("[WaveSpeed] Dynamic state restoration completed");
        return true;
    }

    // Fallback to model cache (UI restoration data)
    if (node._wavespeed_model_cache) {
        logDebug("[WaveSpeed] Found cached model information, restoring...");

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
            logDebug(`[WaveSpeed] Restored model ${cache.modelId} to global cache`);
        }

        logDebug("[WaveSpeed] Model cache restoration completed");
        return true;
    }

    return false;
}

// Initialize the dynamic interface for a node
async function initializeDynamicInterface(node) {
    logDebug("[WaveSpeed] Initializing dynamic interface for node:", node.id);

    // Check if we have cached model information to restore
    const hasCachedData = node.wavespeedState.modelId && node.wavespeedState.parameters.length > 0;

    if (hasCachedData) {
        logDebug("[WaveSpeed] ✅ Using cached model data for initialization:", {
            modelId: node.wavespeedState.modelId,
            category: node.wavespeedState.category,
            parameterCount: node.wavespeedState.parameters.length
        });

        // Initialize with cached data (non-blocking for model list)
        await initializeWithCachedData(node);
    } else {
        logDebug("[WaveSpeed] No cached data, performing fresh initialization");

        // Clear existing dynamic widgets but keep original ones
        clearDynamicWidgets(node);

        // CRITICAL FIX: Also clear any residual dynamic inputs from old workflows
        // This prevents inconsistent state where inputs exist but Category/Model are empty
        if (node.inputs) {
            const dynamicInputs = node.inputs.filter(input => 
                input._wavespeed_dynamic && !input._wavespeed_placeholder &&
                !input.name.match(/^param_\d+$/)
            );
            
            if (dynamicInputs.length > 0) {
                logDebug(`[WaveSpeed] Removing ${dynamicInputs.length} residual dynamic inputs from old workflow`);
                node.inputs = node.inputs.filter(input => 
                    !input._wavespeed_dynamic || input._wavespeed_placeholder ||
                    input.name.match(/^param_\d+$/)
                );
                
                // Update visible inputs if using new filtering system
                if (node._updateVisibleInputs) {
                    node._updateVisibleInputs();
                }
            }
        }

        // Add category selector
        await addCategorySelector(node);

        // Add model selector
        addModelSelector(node);
    }

    // Mark as initialized
    node.wavespeedState.isInitialized = true;

    // Debug: Check inputs after initialization
    logDebug("[WaveSpeed] Inputs after initialization:", {
        inputCount: node.inputs ? node.inputs.length : 0,
        placeholderInputs: node.inputs ? node.inputs.filter(i => i.name && i.name.match(/^param_\d+$/)).map(i => ({ name: i.name, hidden: i.hidden, _wavespeed_placeholder: i._wavespeed_placeholder })) : []
    });

    logDebug("[WaveSpeed] Dynamic interface initialized");

    // CRITICAL FIX: Force node size recalculation after initialization
    if (node.computeSize) {
        const newSize = node.computeSize();
        logDebug(`[WaveSpeed] Setting node size after initialization to: [${newSize[0]}, ${newSize[1]}]`);
        node.setSize(newSize);

        // Verify the size was actually set
        setTimeout(() => {
            logDebug(`[WaveSpeed] Node actual size after setSize: [${node.size[0]}, ${node.size[1]}]`);
        }, 10);
    }
}

// Initialize with cached data (for workflow restoration)
async function initializeWithCachedData(node) {
    logDebug("[WaveSpeed] Initializing with cached data...");

    // CRITICAL: Set flag to prevent duplicate parameter loading
    node.wavespeedState.isRestoringFromCache = true;
    
    // CRITICAL: Mark that we're in configuration mode
    WAVESPEED_STATE.graph_being_configured++;

    // CRITICAL FIX: Clear ALL dynamic content before restoring from cache
    // This prevents duplicate parameters when reloading workflows
    clearDynamicWidgets(node);
    
    // CRITICAL: Mark existing inputs for reuse instead of deleting them
    // This preserves connections that ComfyUI has already restored from workflow data
    // Deleting inputs would break the connection linkIds and cause validation warnings
    if (node.inputs && node.wavespeedState.parameters.length > 0) {
        const parameterNames = new Set(node.wavespeedState.parameters.map(p => p.name));
        
        // Mark existing parameter inputs so createWidgetInputPort can reuse them
        for (const input of node.inputs) {
            if (parameterNames.has(input.name) && !input.name.match(/^param_\d+$/)) {
                input._wavespeed_dynamic = true;
                input._wavespeed_reuse = true;  // Flag for reuse
                logDebug(`[WaveSpeed] Marked existing input "${input.name}" for reuse (preserving link: ${input.link})`);
            }
        }
    }
    
    // Reset parameter mapping to avoid conflicts
    if (node.wavespeedState) {
        node.wavespeedState.paramMapping = {};
        node.wavespeedState.usedPlaceholders = node.wavespeedState.usedPlaceholders || new Set();
        node.wavespeedState.usedPlaceholders.clear();
        node.wavespeedState.nextPlaceholderIndex = 1;
        logDebug("[WaveSpeed] Reset parameter mapping for cache restoration");
    }

    // Add category selector (don't wait for categories to load)
    const categoriesPromise = addCategorySelector(node);
    if (node.categoryWidget && node.wavespeedState.category) {
        node.categoryWidget.value = node.wavespeedState.category;
        logDebug(`[WaveSpeed] Set category widget value to: ${node.wavespeedState.category}`);
    }

    // Add model selector
    addModelSelector(node);
    
    // CRITICAL FIX: Restore parameters FIRST, don't wait for model list to load
    // This ensures the node renders immediately with cached parameters
    if (node.wavespeedState.parameters.length > 0) {
        logDebug(`[WaveSpeed] Restoring ${node.wavespeedState.parameters.length} cached parameters immediately`);
        logDebug(`[WaveSpeed] Before restoring parameters, current inputs:`, node.inputs ? node.inputs.map(i => ({ name: i.name, _wavespeed_dynamic: i._wavespeed_dynamic })) : []);
        await restoreParametersFromCache(node);
        logDebug(`[WaveSpeed] After restoring parameters, current inputs:`, node.inputs ? node.inputs.map(i => ({ name: i.name, _wavespeed_dynamic: i._wavespeed_dynamic })) : []);
    }

    // CRITICAL: Clear the restoration flag after parameter restoration
    node.wavespeedState.isRestoringFromCache = false;
    
    // CRITICAL: Exit configuration mode
    WAVESPEED_STATE.graph_being_configured--;
    
    logDebug("[WaveSpeed] Cached data initialization completed (parameters restored)");
    
    // OPTIMIZATION: Restore model display name asynchronously (non-blocking)
    // This allows the node to render immediately while model list loads in background
    if (node.modelWidget && node.wavespeedState.modelId) {
        logDebug("[WaveSpeed] Starting async model display name restoration...");
        // Wait for categories to load first, then restore model display name
        categoriesPromise.then(() => {
            return restoreModelDisplayName(node);
        }).then(() => {
            logDebug("[WaveSpeed] Model display name restoration completed");
        }).catch(error => {
            logWarn("[WaveSpeed] Failed to restore model display name:", error);
        });
    }
}

// Restore model display name from cached model ID
async function restoreModelDisplayName(node) {
    try {
        logDebug(`[WaveSpeed] Restoring model display name for model: ${node.wavespeedState.modelId}`);
        logDebug(`[WaveSpeed] Current category: ${node.wavespeedState.category}`);
        logDebug(`[WaveSpeed] Category list available: ${!!node.wavespeedState.categoryList}`);

        if (!node.wavespeedState.category) {
            logWarn("[WaveSpeed] Cannot restore model display name without category");
            // OPTIMIZATION: Use modelId as temporary display value
            if (node.modelWidget && node.wavespeedState.modelId) {
                node.modelWidget.value = node.wavespeedState.modelId;
                node.modelWidget.options.values = ["", node.wavespeedState.modelId];
                logDebug(`[WaveSpeed] Using modelId as temporary display value: ${node.wavespeedState.modelId}`);
            }
            return;
        }

        const categoryValue = getCategoryValue(node);
        logDebug(`[WaveSpeed] Category value resolved to: ${categoryValue}`);

        const models = await getCachedModelsByCategory(categoryValue);
        logDebug(`[WaveSpeed] Found ${models.length} models for category ${categoryValue}`);

        if (models.length > 0) {
            logDebug(`[WaveSpeed] Available models:`, models.map(m => `${m.name} (${m.value})`));
        }

        const model = models.find(m => m.value === node.wavespeedState.modelId);

        if (model && node.modelWidget) {
            node.modelWidget.value = model.name;
            const values = ["", ...models.map(m => m.name)];
            node.modelWidget.options.values = values;
            logDebug(`[WaveSpeed] ✅ Restored model display name: ${model.name}`);
        } else {
            logWarn(`[WaveSpeed] Model not found in list:`, {
                modelFound: !!model,
                widgetExists: !!node.modelWidget,
                targetModelId: node.wavespeedState.modelId,
                availableModels: models.length
            });

            // OPTIMIZATION: Use modelId as fallback display value
            if (node.modelWidget) {
                if (models.length > 0) {
                    // Populate dropdown with available models
                    const values = ["", ...models.map(m => m.name)];
                    node.modelWidget.options.values = values;
                    logDebug(`[WaveSpeed] Populated model dropdown with ${models.length} models`);
                } else {
                    // No models available, use modelId as temporary value
                    node.modelWidget.value = node.wavespeedState.modelId;
                    node.modelWidget.options.values = ["", node.wavespeedState.modelId];
                    logDebug(`[WaveSpeed] Using modelId as fallback display value: ${node.wavespeedState.modelId}`);
                }
            }
        }
    } catch (error) {
        logWarn("[WaveSpeed] Failed to restore model display name:", error);

        // OPTIMIZATION: Use modelId as emergency fallback
        if (node.modelWidget && node.wavespeedState.modelId) {
            node.modelWidget.value = node.wavespeedState.modelId;
            node.modelWidget.options.values = ["", node.wavespeedState.modelId];
            logDebug(`[WaveSpeed] Using modelId as emergency fallback: ${node.wavespeedState.modelId}`);
        }
    }
}

// Restore parameters from cached data
async function restoreParametersFromCache(node) {
    try {
        logDebug(`[WaveSpeed] Restoring ${node.wavespeedState.parameters.length} cached parameters`);

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

        logDebug("[WaveSpeed] Parameter restoration completed");
    } catch (error) {
        logWarn("[WaveSpeed] Failed to restore parameters from cache:", error);
    }
}

// Add category selector widget
async function addCategorySelector(node) {
    const categoryWidget = node.addWidget(
        "combo",
        "Category",
        "",
        async (value) => {
            // CRITICAL: Skip if restoring from cache to prevent duplicate loading
            if (node.wavespeedState.isRestoringFromCache) {
                logDebug(`[WaveSpeed] Category callback skipped during cache restoration: ${value}`);
                return;
            }
            
            if (node.wavespeedState.category === value) return;

            logDebug(`[WaveSpeed] Category changed from '${node.wavespeedState.category}' to '${value}'`);

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
        logDebug(`[WaveSpeed] Category selector populated with ${categories.length} categories`);
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
            // CRITICAL: Skip if restoring from cache to prevent duplicate loading
            if (node.wavespeedState.isRestoringFromCache) {
                logDebug(`[WaveSpeed] Model callback skipped during cache restoration: ${value}`);
                return;
            }
            
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
        logDebug(`[WaveSpeed] Created hidden model_id storage`);
    }

    node.wavespeedState.hiddenWidgets.model_id.value = modelId;
    logDebug(`[WaveSpeed] Updated hidden model_id to: ${modelId}`);
}

// Get category value from category list
function getCategoryValue(node) {
    if (node.wavespeedState.categoryList) {
        const category = node.wavespeedState.categoryList.find(cat => cat.name === node.wavespeedState.category);
        return category ? category.value : node.wavespeedState.category;
    }
    return node.wavespeedState.category;
}

// Compare two parameter arrays to check if they are equal
function areParametersEqual(params1, params2) {
    if (!params1 || !params2) return false;
    if (params1.length !== params2.length) return false;
    
    // Compare each parameter's key properties
    for (let i = 0; i < params1.length; i++) {
        const p1 = params1[i];
        const p2 = params2[i];
        
        // Compare essential properties
        if (p1.name !== p2.name) return false;
        if (p1.type !== p2.type) return false;
        if (p1.required !== p2.required) return false;
        
        // Compare options for COMBO types
        if (p1.type === 'COMBO' || p2.type === 'COMBO') {
            const opts1 = JSON.stringify(p1.options || []);
            const opts2 = JSON.stringify(p2.options || []);
            if (opts1 !== opts2) return false;
        }
        
        // Compare min/max for numeric types
        if ((p1.type === 'INT' || p1.type === 'FLOAT') && 
            (p2.type === 'INT' || p2.type === 'FLOAT')) {
            if (p1.min !== p2.min || p1.max !== p2.max) return false;
        }
    }
    
    return true;
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
            const previousModelId = node.wavespeedState.modelId;
            
            node.modelWidget.value = firstModel.name;
            node.wavespeedState.modelId = firstModel.value;
            updateOriginalModelIdWidget(node, firstModel.value);
            
            // OPTIMIZATION: Only update parameters if model actually changed
            if (previousModelId !== firstModel.value) {
                logDebug(`[WaveSpeed] Model changed from "${previousModelId}" to "${firstModel.value}", updating parameters`);
                await updateModelParameters(node);
            } else {
                logDebug(`[WaveSpeed] Model unchanged (${firstModel.value}), skipping parameter update`);
            }
        } else {
            node.modelWidget.value = "";
            node.wavespeedState.modelId = "";
            updateOriginalModelIdWidget(node, "");
        }
    } catch (error) {
        logWarn("Failed to update model selector:", error);
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

        // OPTIMIZATION: Check if parameters have changed
        // If model is already loaded with the same parameters, skip update
        if (node.wavespeedState.parameters && node.wavespeedState.parameters.length > 0) {
            const hasParametersChanged = !areParametersEqual(node.wavespeedState.parameters, parameters);
            
            if (!hasParametersChanged) {
                logDebug(`[WaveSpeed] ✅ Model parameters unchanged, skipping update for model: ${node.wavespeedState.modelId}`);
                return;
            }
            
            logDebug(`[WaveSpeed] Parameters changed, updating for model: ${node.wavespeedState.modelId}`);
        }

        // Clear old dynamic parameters
        clearModelParameters(node);

        // Save parameter information
        node.wavespeedState.parameters = parameters;

        logDebug(`[WaveSpeed] Model parameters: ${parameters.length} total`);

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

        logDebug(`[WaveSpeed] Parameter allocation order:`, {
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

        // INTELLIGENT CACHING: Restore parameter values and connections from history
        restoreParametersFromHistory(node, sortedParams);

        // Update request_json with parameter values
        updateRequestJsonWidget(node);

        // CRITICAL FIX: Force node size recalculation after adding all widgets
        if (node.computeSize) {
            const newSize = node.computeSize();
            logDebug(`[WaveSpeed] Setting node size after adding ${sortedParams.length} widgets to: [${newSize[0]}, ${newSize[1]}]`);
            node.setSize(newSize);

            // IMMEDIATE: Force layout recalculation
            if (node.setDirtyCanvas) {
                node.setDirtyCanvas(true, true);
            }

            // Verify the size was actually set
            setTimeout(() => {
                logDebug(`[WaveSpeed] Node actual size after widget addition: [${node.size[0]}, ${node.size[1]}]`);

                // Additional check: ensure widgets are positioned correctly
                if (node.widgets && node.widgets.length > 2) { // More than just Category and Model
                    logDebug(`[WaveSpeed] Widget positioning verification:`);
                    for (let i = 0; i < node.widgets.length; i++) {
                        const widget = node.widgets[i];
                        const widgetY = widget.y || 0;
                        logDebug(`[WaveSpeed]   Widget "${widget.name}": y=${widgetY}px`);
                    }
                }
            }, 10);
        }

        // ADDITIONAL FIX: Delayed size recalculation to handle layout settling
        setTimeout(() => {
            if (node.computeSize) {
                const delayedSize = node.computeSize();
                logDebug(`[WaveSpeed] Setting delayed node size to: [${delayedSize[0]}, ${delayedSize[1]}]`);
                node.setSize(delayedSize);

                // CRITICAL: Force canvas redraw to apply changes
                if (app.graph) {
                    app.graph.setDirtyCanvas(true, true);
                }

                // Final verification
                setTimeout(() => {
                    logDebug(`[WaveSpeed] Final node size after delayed recalculation: [${node.size[0]}, ${node.size[1]}]`);

                    // Check if all widgets are visible and positioned correctly
                    if (node.widgets) {
                        const visibleWidgets = node.widgets.filter(w => !w.hidden);
                        logDebug(`[WaveSpeed] Final widget count: ${visibleWidgets.length} visible widgets`);
                    }
                }, 50);
            }
        }, 100);

        // Trigger UI update
        if (app.graph) {
            app.graph.setDirtyCanvas(true, true);
        }

    } catch (error) {
        logWarn("Failed to update model parameters:", error);
        clearModelParameters(node);
    }
}

// Create parameter widget
function createParameterWidget(node, param, paramIndex) {
    logDebug(`[WaveSpeed] Creating widget for parameter: ${param.name} (${param.type})`);

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
                logDebug(`[WaveSpeed] Array parameter ${param.name} with item type: ${widget._wavespeed_array_item_type}`);
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
        // LORA_WEIGHT type - creates special input for LoRA parameters
        else if (param.type === "LORA_WEIGHT" || param.isLoraWeight) {
            let placeholder, label;
            if (param.isLoraArray) {
                // Array of LoraWeight
                placeholder = `[{"path": "lora1.safetensors", "scale": 1.0}, {"path": "lora2.safetensors", "scale": 0.8}]`;
                label = displayName + " (JSON array or WAVESPEED_LORAS)";
            } else {
                // Single LoraWeight
                placeholder = `{"path": "lora.safetensors", "scale": 1.0}`;
                label = displayName + " (JSON object or single LORA)";
            }

            const comfyWidget = ComfyWidgets["STRING"](
                node,
                label,
                ["STRING", { multiline: true, dynamicPrompts: true }],
                app
            );
            widget = comfyWidget.widget;
            widget.value = param.default || "";
            widget.callback = (value) => {
                node.wavespeedState.parameterValues[param.name] = value;
                updateRequestJsonWidget(node);
            };

            // Add helper text for LoRA input format
            if (widget.inputEl) {
                widget.inputEl.placeholder = placeholder;
                widget.inputEl.style.minHeight = "60px"; // Increased minimum height
                widget.inputEl.style.maxHeight = "120px"; // Increased maximum height
                widget.inputEl.style.resize = "vertical";

                const tooltipText = param.isLoraArray
                    ? "LoRA array format: JSON array with 'path' and 'scale' fields, or connect WAVESPEED_LORAS node"
                    : "LoRA object format: JSON object with 'path' and 'scale' fields, or connect single LoRA";
                widget.inputEl.title = tooltipText;
            }

            // Mark as LoRA weight widget for special processing
            widget._wavespeed_is_lora_weight = true;
            widget._wavespeed_is_lora_array = param.isLoraArray;

            // Force the widget type to be recognized as multiline for height calculation
            widget.type = "customtext"; // This ensures it's treated as multiline in size calculation
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
            logWarn(`[WaveSpeed] Unknown parameter type: ${param.type}, using text widget`);
            widget = node.addWidget("text", displayName, param.default || "",
                (value) => {
                    node.wavespeedState.parameterValues[param.name] = value;
                    updateRequestJsonWidget(node);
                }
            );
        }

        if (!widget) {
            logWarn(`Widget creation returned null for parameter: ${param.name}`);
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
                logDebug(`[WaveSpeed] Updated node size after adding widget "${param.name}": [${updatedSize[0]}, ${updatedSize[1]}]`);

                // Force canvas redraw for LoRA widgets to ensure proper positioning
                if (widget._wavespeed_is_lora_weight && app.graph) {
                    app.graph.setDirtyCanvas(true, true);
                }
            }
        }, 10);

        // Create a corresponding input port for supported types
        if (shouldCreateInputPort(param)) {
            const inputPort = createWidgetInputPort(node, widget, param);
            if (!inputPort) {
                logWarn(`[WaveSpeed] Could not create input port for ${param.name} - likely due to placeholder limit (20 max). Parameter will only have widget input.`);
            }
        }

        logDebug(`[WaveSpeed] Successfully created ${widget.type} widget for ${param.name}`);

    } catch (error) {
        logWarn(`Failed to create widget for parameter ${param.name}:`, error);
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
            logWarn(`[WaveSpeed] No available placeholder for parameter: ${param.name}`);
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
            logWarn(`[WaveSpeed] Placeholder input not found: ${placeholderName}. Available inputs:`, {
                hiddenInputs: node._wavespeed_hiddenInputs ? node._wavespeed_hiddenInputs.map(i => i.name) : [],
                allInputs: node._wavespeed_allInputs ? node._wavespeed_allInputs.map(i => i.name) : [],
                originalInputs: node._wavespeed_originalInputs ? node._wavespeed_originalInputs.map(i => i.name) : [],
                currentInputs: node.inputs ? node.inputs.map(i => i.name) : []
            });
            return null;
        }

        // Create a new visible input with the parameter name that redirects to the placeholder
        let inputType = param.type;
        if (param.type === 'LORA_WEIGHT') {
            // Use WAVESPEED_LORAS type to allow connections from LoRA nodes
            inputType = 'WAVESPEED_LORAS';
        } else if (param.type === 'INT' || param.type === 'FLOAT') {
            inputType = 'NUMBER';
        }

        const paramInput = {
            name: param.name,
            type: inputType,
            link: null,
            _wavespeed_dynamic: true,
            _wavespeed_param_name: param.name,
            _wavespeed_widget_pair: widget,
            _wavespeed_placeholder: placeholderName,
            _wavespeed_placeholder_input: placeholderInput
        };

        logDebug(`[WaveSpeed] Creating visible input for ${param.name} -> ${placeholderName}`);

        // CRITICAL FIX: Check if this input already exists to prevent duplicates
        if (node.inputs) {
            logDebug(`[WaveSpeed] Checking for existing input "${param.name}", current inputs:`, node.inputs.map(i => ({ name: i.name, _wavespeed_dynamic: i._wavespeed_dynamic, _wavespeed_reuse: i._wavespeed_reuse, link: i.link })));
            
            // First priority: Check for inputs marked for reuse (from workflow loading)
            // These inputs already have valid connections restored by ComfyUI
            let existingInput = node.inputs.find(input =>
                input.name === param.name &&
                input._wavespeed_reuse
            );
            
            // Second priority: Check for regular dynamic inputs
            if (!existingInput) {
                existingInput = node.inputs.find(input =>
                    input.name === param.name &&
                    input._wavespeed_dynamic &&
                    !input._wavespeed_placeholder
                );
            }

            if (existingInput) {
                const hasConnection = existingInput.link != null;
                logDebug(`[WaveSpeed] Reusing existing input "${param.name}" at index ${node.inputs.indexOf(existingInput)} (has connection: ${hasConnection}, link: ${existingInput.link})`);
                
                // Update the existing input's properties but preserve the connection
                Object.assign(existingInput, {
                    _wavespeed_dynamic: true,
                    _wavespeed_param_name: param.name,
                    _wavespeed_widget_pair: widget,
                    _wavespeed_placeholder: placeholderName,
                    _wavespeed_placeholder_input: placeholderInput
                });
                
                // Clear the reuse flag
                delete existingInput._wavespeed_reuse;
                
                widget._wavespeed_input_pair = existingInput;
                return existingInput;
            }
        }

        // Use the node's own method to add the input safely
        if (node.addInput) {
            // Determine the input type for LORA_WEIGHT parameters
            let inputType = param.type;
            if (param.type === 'LORA_WEIGHT') {
                // Use WAVESPEED_LORAS type to allow connections from LoRA nodes
                inputType = 'WAVESPEED_LORAS';
            } else if (param.type === 'INT' || param.type === 'FLOAT') {
                inputType = 'NUMBER';
            }

            // Try to use ComfyUI's addInput method first
            const addedInput = node.addInput(param.name, inputType);
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

                logDebug(`[WaveSpeed] Successfully created input using addInput for: ${param.name} -> ${placeholderName} (type: ${inputType})`);
                logDebug(`[WaveSpeed] Total inputs after adding "${param.name}":`, node.inputs.length, node.inputs.map(i => i.name));
                
                // NOTE: Connection restoration is handled by:
                // 1. ComfyUI's workflow loading mechanism (for page refresh)
                // 2. restoreParametersFromHistory() (for model switching)
                // We don't restore linkId here to avoid creating invalid ghost links
                
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

        logDebug(`[WaveSpeed] Successfully created input manually for: ${param.name} -> ${placeholderName}`);
        
        // NOTE: Connection restoration is handled by:
        // 1. ComfyUI's workflow loading mechanism (for page refresh)
        // 2. restoreParametersFromHistory() (for model switching)
        // We don't restore linkId here to avoid creating invalid ghost links

        return paramInput;
    } catch (error) {
        logWarn(`Failed to create input port for widget ${param.name}:`, error);
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

    // CRITICAL FIX: Check for LoRA weight parameters FIRST, before array processing
    // This is because LoRA weight can be both array and special type
    if (param.type === 'LORA_WEIGHT' || param.isLoraWeight) {
        paramType = 'lora-weight';
        logDebug(`[WaveSpeed] Detected LoRA weight parameter: ${paramName} -> ${paramType}`);
    }
    // Only check array handling if not already identified as LoRA weight
    else if (param.isArray) {
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

    logDebug(`[WaveSpeed] Allocated placeholder: ${paramName} -> ${placeholderName} (${paramType})`);
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
        logDebug(`[WaveSpeed] Created hidden param_map storage`);
    }

    try {
        const mappingJson = JSON.stringify(node.wavespeedState.paramMapping);
        node.wavespeedState.hiddenWidgets.param_map.value = mappingJson;
        logDebug(`[WaveSpeed] Updated hidden param_map: ${mappingJson}`);
    } catch (error) {
        logWarn("Failed to update param_map:", error);
        node.wavespeedState.hiddenWidgets.param_map.value = "{}";
    }
}

// Special handling for creating the seed widget
function createSeedWidget(node, param, displayName) {
    logDebug(`[WaveSpeed] Creating special seed widget for: ${param.name}`);

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
        logDebug(`[WaveSpeed] Created hidden request_json storage`);
    }

    const values = collectParameterValues(node);

    try {
        const jsonString = JSON.stringify(values, null, 2);
        node.wavespeedState.hiddenWidgets.request_json.value = jsonString;
        logDebug(`[WaveSpeed] Updated hidden request_json:`, values);
    } catch (error) {
        logWarn("Failed to update request_json:", error);
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
                    logDebug(`[WaveSpeed] Parameter ${paramName} connected via ${placeholderInfo.placeholder} (${placeholderInfo.type})`);

                    // For LoRA weight connections, we can also try to get the current value for preview
                    if (widget._wavespeed_is_lora_weight && pairedInput && pairedInput.link) {
                        try {
                            const inputData = node.getInputData(node.inputs.indexOf(pairedInput));
                            if (inputData) {
                                logDebug(`[WaveSpeed] LoRA connection data preview for ${paramName}:`, inputData);
                            }
                        } catch (error) {
                            logDebug(`[WaveSpeed] Could not preview LoRA connection data for ${paramName}:`, error);
                        }
                    }
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

                            logDebug(`[WaveSpeed] Converted array parameter ${paramName} (${itemType}):`, value);
                        } catch (error) {
                            logWarn(`[WaveSpeed] Failed to convert array parameter ${paramName}:`, error);
                        }
                    }
                    // Handle LoRA weight type conversion
                    else if (widget._wavespeed_is_lora_weight && typeof value === 'string' && value.trim() !== '') {
                        // Parse LoRA weight string into JSON structure for requestJson
                        try {
                            if (value.trim().startsWith('{') && value.trim().endsWith('}')) {
                                // Single LoraWeight object
                                const parsed = JSON.parse(value);
                                if (typeof parsed === 'object' && parsed.path && parsed.scale !== undefined) {
                                    value = parsed; // Use parsed object
                                    logDebug(`[WaveSpeed] Parsed single LoRA object for ${paramName}:`, value);
                                } else {
                                    logWarn(`[WaveSpeed] Invalid LoRA object format for ${paramName}:`, parsed);
                                }
                            } else if (value.trim().startsWith('[') && value.trim().endsWith(']')) {
                                // Array of LoraWeight objects
                                const parsed = JSON.parse(value);
                                if (Array.isArray(parsed)) {
                                    // Validate array items
                                    const validItems = parsed.filter(item =>
                                        typeof item === 'object' && item.path && item.scale !== undefined
                                    );
                                    if (validItems.length === parsed.length) {
                                        value = parsed; // Use parsed array
                                        logDebug(`[WaveSpeed] Parsed LoRA array for ${paramName}:`, value);
                                    } else {
                                        logWarn(`[WaveSpeed] Some LoRA items invalid for ${paramName}:`, parsed);
                                        value = validItems; // Use only valid items
                                    }
                                } else {
                                    logWarn(`[WaveSpeed] Invalid LoRA array format for ${paramName}:`, parsed);
                                }
                            } else {
                                // Handle comma-separated format: path1:scale1,path2:scale2
                                const loras = [];
                                const pairs = value.split(',').map(p => p.trim()).filter(p => p);
                                for (const pair of pairs) {
                                    if (pair.includes(':')) {
                                        const [path, scaleStr] = pair.split(':', 2);
                                        const scale = parseFloat(scaleStr.trim());
                                        if (!isNaN(scale)) {
                                            loras.push({
                                                path: path.trim(),
                                                scale: scale
                                            });
                                        }
                                    } else {
                                        // Default scale
                                        loras.push({
                                            path: pair.trim(),
                                            scale: 1.0
                                        });
                                    }
                                }
                                if (loras.length > 0) {
                                    value = widget._wavespeed_is_lora_array ? loras : loras[0];
                                    logDebug(`[WaveSpeed] Parsed comma-separated LoRA for ${paramName}:`, value);
                                }
                            }
                        } catch (error) {
                            logWarn(`[WaveSpeed] Failed to parse LoRA value for ${paramName}:`, error);
                            // Keep original string value as fallback
                        }
                        logDebug(`[WaveSpeed] Final LoRA value for ${paramName} (isArray: ${widget._wavespeed_is_lora_array}):`, value);
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
    logDebug("[WaveSpeed] === Starting clearModelParameters ===");

    // CRITICAL: Save current model to history before clearing
    saveModelToHistory(node);

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

        logDebug(`[WaveSpeed] Widget cleanup: ${baseWidgets.length} base widgets, ${dynamicWidgets.length} dynamic widgets to remove`);

        for (const widget of dynamicWidgets) {
            if (widget.onRemove) {
                widget.onRemove();
            }
        }

        node.widgets = baseWidgets;
    }

    // Clear param_map FIRST - this is crucial to avoid duplicate allocations
    clearParamMapping(node);

    // For the new input filtering system, we need to reset the inputs differently
    if (node._updateVisibleInputs) {
        logDebug("[WaveSpeed] Using new input filtering system");

        // CRITICAL FIX: Completely reset the input system
        // First, clear all inputs and reset the tracking arrays
        node.inputs = [];
        node._wavespeed_hiddenInputs = [];

        // Get only the original placeholder inputs from the initial setup
        if (node._wavespeed_originalInputs) {
            const placeholderInputs = node._wavespeed_originalInputs.filter(input =>
                input.name && input.name.match(/^param_\d+$/)
            );

            logDebug(`[WaveSpeed] Restoring ${placeholderInputs.length} original placeholder inputs`);

            // ENHANCED: Create fresh copies of placeholder inputs to avoid reference issues
            const freshPlaceholderInputs = placeholderInputs.map(input => ({
                name: input.name,
                type: input.type,
                link: null,  // Always clear links
                hidden: true,
                _wavespeed_placeholder: true
            }));

            // Reset the internal inputs structure to only fresh placeholders
            node._wavespeed_allInputs = freshPlaceholderInputs;

            // Store hidden inputs
            node._wavespeed_hiddenInputs = [...freshPlaceholderInputs];

            // Update visible inputs (should show none since all are placeholders)
            node._updateVisibleInputs();
        } else {
            logWarn("[WaveSpeed] No original inputs found, creating fresh placeholder set");
            // If no original inputs, we'll rely on the backend structure being recreated
            node._wavespeed_allInputs = [];
            node._wavespeed_hiddenInputs = [];
        }
    } else {
        // Fallback to old method if new system not available
        logDebug("[WaveSpeed] Using fallback input cleanup");

        const baseInputs = node.originalInputs || [];
        const dynamicInputs = node.inputs ? node.inputs.filter(input =>
            input._wavespeed_dynamic && !input._wavespeed_placeholder
        ) : [];
        const placeholderInputs = node.inputs ? node.inputs.filter(input =>
            input._wavespeed_placeholder || (input.name && input.name.match(/^param_\d+$/))
        ) : [];

        logDebug(`[WaveSpeed] Fallback cleanup: ${dynamicInputs.length} dynamic inputs, preserving ${placeholderInputs.length} placeholder inputs`);

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
        logDebug(`[WaveSpeed] Reconstructed inputs: ${baseInputs.length} base + ${uniquePlaceholderInputs.length} unique placeholders`);
    }

    // Clear request_json
    updateRequestJsonWidget(node);

    logDebug("[WaveSpeed] === clearModelParameters completed ===");

    // CRITICAL FIX: Force node size recalculation after clearing widgets
    if (node.computeSize) {
        const newSize = node.computeSize();
        logDebug(`[WaveSpeed] Setting node size after clearing widgets to: [${newSize[0]}, ${newSize[1]}]`);
        node.setSize(newSize);

        // Verify the size was actually set
        setTimeout(() => {
            logDebug(`[WaveSpeed] Node actual size after clearing: [${node.size[0]}, ${node.size[1]}]`);
        }, 10);
    }

    // ADDITIONAL FIX: Delayed size recalculation for cleanup
    setTimeout(() => {
        if (node.computeSize) {
            const delayedSize = node.computeSize();
            node.setSize(delayedSize);
            logDebug(`[WaveSpeed] Node size updated after delayed cleanup recalculation:`, delayedSize);
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
    logDebug("[WaveSpeed] Cleared parameter mapping");
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

logDebug("[WaveSpeed] Dynamic real node extension loaded");

// ========================================
// EXECUTION-TIME TRANSFORMATION (rgthree pattern)
// ========================================

// Override app.graphToPrompt to intercept and transform dynamic nodes for workflow saving
const originalGraphToPrompt = app.graphToPrompt;
app.graphToPrompt = async function() {
    logDebug("[WaveSpeed] === GRAPH TO PROMPT INTERCEPTION (workflow save) ===");

    // Call original graphToPrompt first
    const result = await originalGraphToPrompt.apply(app, arguments);

    // Transform dynamic nodes in the result
    if (result && result.output) {
        logDebug("[WaveSpeed] Transforming dynamic nodes in output...");
        result.output = transformDynamicNodesForExecution(result.output);
    }

    return result;
};

// Override api.queuePrompt to intercept and transform dynamic nodes for task execution
const originalQueuePrompt = api.queuePrompt;
api.queuePrompt = async function(number, prompt, ...args) {
    logDebug("[WaveSpeed] === QUEUE PROMPT INTERCEPTION (task execution) ===");

    // Transform dynamic nodes in the prompt before sending to server
    if (prompt && prompt.output) {
        logDebug("[WaveSpeed] Transforming dynamic nodes for execution...");
        prompt.output = transformDynamicNodesForExecution(prompt.output);
    }

    // Also transform workflow if present (for complete compatibility)
    if (prompt && prompt.workflow && prompt.workflow.nodes) {
        logDebug("[WaveSpeed] Transforming dynamic nodes in workflow...");
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
                logDebug(`[WaveSpeed] Transforming dynamic node ${nodeId} for execution`);
                const transformedNode = transformDynamicNodeForExecution(nodeData, dynamicState);
                transformedOutput[nodeId] = transformedNode;
                logDebug(`[WaveSpeed] Node ${nodeId} transformed:`, transformedNode);
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

        logDebug("[WaveSpeed] Collected dynamic state:", {
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
        logWarn(`[WaveSpeed] Failed to collect dynamic state from graph node ${nodeId}:`, error);
        return null;
    }
}

// Transform a single dynamic node to real node format
function transformDynamicNodeForExecution(nodeData, dynamicState) {
    logDebug("[WaveSpeed] Transforming node with dynamic state:", dynamicState);

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
            logDebug(`[WaveSpeed] Processed array parameter ${cleanParamName} (${metadata.arrayItemType}):`, processedValue);
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
        logDebug("[WaveSpeed] Processing input connections:", Object.keys(nodeData.inputs));

        for (const inputName in nodeData.inputs) {
            const inputValue = nodeData.inputs[inputName];

            if (Array.isArray(inputValue)) {
                // This is a connection
                logDebug(`[WaveSpeed] Found connection: ${inputName} = ${inputValue}`);

                // Check if this is a direct placeholder connection
                if (inputName.match(/^param_\d+$/)) {
                    transformedInputs[inputName] = inputValue;
                    logDebug(`[WaveSpeed] Direct placeholder connection: ${inputName}`);
                } else {
                    // Check if this dynamic parameter should be mapped to a placeholder
                    const cleanInputName = inputName.startsWith('* ') ? inputName.substring(2) : inputName;

                    // Find the corresponding placeholder for this parameter
                    const placeholderInfo = paramMap[cleanInputName];
                    if (placeholderInfo && placeholderInfo.placeholder) {
                        transformedInputs[placeholderInfo.placeholder] = inputValue;
                        logDebug(`[WaveSpeed] Mapped dynamic parameter '${inputName}' to placeholder '${placeholderInfo.placeholder}' (${placeholderInfo.type}): ${inputValue}`);
                    } else {
                        // No mapping found, this might be an older connection format
                        logWarn(`[WaveSpeed] No placeholder mapping found for connected parameter: ${inputName}`);
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

    logDebug("[WaveSpeed] Transformation result:", {
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
                logDebug(`[WaveSpeed] Transforming workflow node ${node.id} for execution`);
                const transformedNode = transformDynamicNodeInWorkflow(node, dynamicState);
                transformedWorkflow.nodes[i] = transformedNode;
                logDebug(`[WaveSpeed] Workflow node ${node.id} transformed`);
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

    logDebug("[WaveSpeed] Workflow transformation result:", {
        modelId: dynamicState.modelId,
        requestJsonKeys: Object.keys(requestJson),
        paramMapSize: Object.keys(paramMap).length,
        widgetValues: transformedNode.widgets_values
    });

    return transformedNode;
}

// Force clean initial state - removes any unexpected inputs on fresh nodes
function forceCleanInitialState(node) {
    logDebug("[WaveSpeed] === Force cleaning initial state ===");

    // Only clean if there are obviously problematic inputs (like duplicate prompts)
    if (node.inputs) {
        logDebug("[WaveSpeed] Initial inputs:", node.inputs.map(i => ({ name: i.name, hidden: i.hidden })));

        // Look for duplicate non-placeholder inputs (like multiple "prompt" inputs)
        const nonPlaceholderInputs = node.inputs.filter(input =>
            input.name && !input.name.match(/^param_\d+$/)
        );

        const inputNames = nonPlaceholderInputs.map(i => i.name);
        const duplicateNames = inputNames.filter((name, index) => inputNames.indexOf(name) !== index);

        if (duplicateNames.length > 0) {
            logDebug(`[WaveSpeed] Found duplicate inputs:`, duplicateNames);

            // Remove only the duplicate instances, keep one of each
            const seenNames = new Set();
            node.inputs = node.inputs.filter(input => {
                if (!input.name || input.name.match(/^param_\d+$/)) {
                    return true; // Keep all placeholder inputs
                }

                if (seenNames.has(input.name)) {
                    logDebug(`[WaveSpeed] Removing duplicate input: ${input.name}`);
                    return false; // Remove duplicate
                }

                seenNames.add(input.name);
                return true; // Keep first instance
            });

            logDebug(`[WaveSpeed] After duplicate removal: ${node.inputs.length} inputs`);
        }
    }

    logDebug("[WaveSpeed] === Initial state cleanup completed ===");
}