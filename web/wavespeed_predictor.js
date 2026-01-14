/**
 * WaveSpeed AI Predictor Node - Modular refactored version
 *
 * Uses modular function organization, maintaining simplicity of direct node operations
 * Removes MVC architecture complexity, provides better code organization and maintainability
 */

import { app } from "../../../scripts/app.js";
import { FuzzyModelSelector } from "./predictor/FuzzyModelSelector.js";
import { updateRequestJson } from "./predictor/widgets.js";
import { createSizeComponentWidget, createRatioButtonsWidget } from "./predictor/sizeComponentWidget.js";

// Register extension
app.registerExtension({
    name: "WaveSpeedAIPredictor",

    // Modify before node definition registration to prevent ComfyUI from auto-creating input slots
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "WaveSpeedAIPredictor") {
            return;
        }
        
        // Save original onNodeCreated
        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        
        nodeType.prototype.onNodeCreated = function() {
            // Call original method
            if (originalOnNodeCreated) {
                originalOnNodeCreated.apply(this, arguments);
            }

            // Check if restoring from workflow
            const isRestoring = !!this._wavespeed_savedData;

            // Only clear auto-created input slots in non-restore scenarios
            if (!isRestoring && this.inputs && this.inputs.length > 0) {
                this.inputs = [];
            }
        };

        // Intercept onGraphConfigured to restore input.widget after it executes
        // This ensures input slot positions are calculated correctly
        const originalOnGraphConfigured = nodeType.prototype.onGraphConfigured;
        nodeType.prototype.onGraphConfigured = function() {
            // Call original onGraphConfigured first
            if (originalOnGraphConfigured) {
                originalOnGraphConfigured.apply(this, arguments);
            }

            // After onGraphConfigured executes, restore input.widget references for position calculation
            if (this.inputs && this._isRestoring) {
                this.widgets ??= [];
                for (const input of this.inputs) {
                    if (input._wavespeed_dynamic && input._savedWidget) {
                        // Ensure saved widget is in widgets array (required by onGraphConfigured check)
                        const widgetExists = this.widgets.some(w => w === input._savedWidget);
                        if (!widgetExists) {
                            this.widgets.push(input._savedWidget);
                        }
                        
                        // Restore widget reference for position calculation
                        input.widget = input._savedWidget;
                        input._savedWidget.linkedInput = input;
                    }
                }
            }
        };
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "WaveSpeedAIPredictor") {
            return;
        }

        // Check if restoring from workflow (if _wavespeed_savedData exists, it's a restore scenario)
        const isRestoring = !!node._wavespeed_savedData;
        
        // Only clear input slots in non-restore scenarios
        // In restore scenario, input slots are already created in configure and need to be kept to restore connections
        if (!isRestoring && node.inputs && node.inputs.length > 0) {
            node.inputs = [];
        }

        // Override computeSize method
        node.computeSize = function() {
            const visibleInputs = this.inputs?.filter(inp => !inp.hidden) || [];
            const visibleOutputs = this.outputs?.filter(out => !out.hidden) || [];

            const inputHeight = visibleInputs.length * LiteGraph.NODE_SLOT_HEIGHT;
            const outputHeight = visibleOutputs.length * LiteGraph.NODE_SLOT_HEIGHT;
            
            // Skip hidden widgets and base widget when calculating widget height
            // Only count widgets that have associated inputs (for correct input slot positioning)
            const widgetHeight = this.widgets?.reduce((h, w) => {
                // Skip hidden widgets
                if (w.type === "hidden" || w._wavespeed_hidden) {
                    return h;
                }
                // Skip base widget (wavespeed_main) - it doesn't have an input slot
                if (w._wavespeed_base) {
                    return h;
                }
                const wh = w.computeSize ? w.computeSize()[1] : LiteGraph.NODE_WIDGET_HEIGHT;
                return h + wh;
            }, 0) || 0;

            // Add base widget height separately (it's displayed but doesn't affect input positions)
            const baseWidgetHeight = this.widgets?.find(w => w._wavespeed_base)?.computeSize?.()?.[1] || 0;

            const maxSlotHeight = Math.max(inputHeight, outputHeight);
            // Use sum of widgets height (excluding base) + base widget height + input slot height
            const totalHeight = widgetHeight + baseWidgetHeight + Math.max(maxSlotHeight, 0) + 30;

            const width = 800;
            const clampedHeight = Math.max(500, Math.min(totalHeight, 1200));

            return [width, clampedHeight];
        };

        // Override widget's getY method to ensure input slots align correctly
        // ComfyUI calculates input positions by iterating through widgets and summing heights
        // We need to ensure only widgets with inputs are counted in position calculation
        const originalGetY = node.getY;
        if (typeof originalGetY === 'function') {
            // Store original for potential use
            node._originalGetY = originalGetY;
        }
        
        // Override onDrawBackground to apply label offset for input slot positioning
        // For widgets with vertical layout (label above input), we offset the input slot
        // to align with the actual input element rather than the widget top
        const originalOnDrawBackground = node.onDrawBackground;
        node.onDrawBackground = function(ctx) {
            if (originalOnDrawBackground) {
                originalOnDrawBackground.call(this, ctx);
            }

            // Apply label offset to input slot positions
            if (this.inputs && this.widgets) {
                for (const input of this.inputs) {
                    if (input.widget && input._wavespeed_label_offset) {
                        // Get widget's current Y position (calculated by LiteGraph)
                        const widgetY = input.widget.y || 0;
                        const offsetY = widgetY + input._wavespeed_label_offset;

                        // Set input slot position
                        if (!input.pos || !Array.isArray(input.pos)) {
                            input.pos = [0, 0];
                        }
                        input.pos[1] = offsetY;
                    }
                }
            }
        };
        
        // Also override onDrawForeground to ensure position is applied
        const originalOnDrawForeground = node.onDrawForeground;
        node.onDrawForeground = function(ctx) {
            // Apply label offset BEFORE drawing foreground
            if (this.inputs && this.widgets) {
                for (const input of this.inputs) {
                    if (input.widget && input._wavespeed_label_offset) {
                        const widgetY = input.widget.y || 0;
                        const offsetY = widgetY + input._wavespeed_label_offset;
                        if (!input.pos || !Array.isArray(input.pos)) {
                            input.pos = [0, 0];
                        }
                        input.pos[1] = offsetY;
                    }
                }
            }
            
            if (originalOnDrawForeground) {
                originalOnDrawForeground.call(this, ctx);
            }
        };

        // Force initial size
        node.size = [800, 500];

        // Initialize node state
        node.wavespeedState = {
            modelId: "",
            apiPath: "",
            category: "",
            categoryList: [],
            modelList: [],
            parameters: [],
            parameterValues: {},
            isUpdatingCategory: false,
            isUpdatingModel: false,
            lastCategoryValue: "",
            lastModelValue: "",
            requestSequence: 0
        };

        // Array input management
        node._arrayInputCounts = {};

        initializePredictorWidgets(node);

        // Configure workflow save/restore support
        configureWorkflowSupport(node);
    }
});

// Initialize Predictor widgets
async function initializePredictorWidgets(node) {
    try {
        // Clear all existing widgets
        node.widgets = [];
        
        // Clear ComfyUI auto-created hidden parameter input slots
        const hiddenParamNames = ['model_id', 'request_json', 'param_map'];
        if (node.inputs) {
            for (let i = node.inputs.length - 1; i >= 0; i--) {
                const input = node.inputs[i];
                if (hiddenParamNames.includes(input.name)) {
                    node.removeInput(i);
                }
            }
        }

        // Handle input slots based on restoration state
        if (node.inputs && node.inputs.length > 0) {
            // Filter to keep only dynamic inputs (created in configure for workflow restore)
            const dynamicInputs = node.inputs.filter(inp => inp._wavespeed_dynamic);

            // In restore mode OR have dynamic inputs with saved data: keep them with link info
            if ((node._isRestoring || node._wavespeed_savedData) && dynamicInputs.length > 0) {
                node.inputs = dynamicInputs;
            } else {
                // Fresh load or no dynamic inputs: clear all
                node.inputs = [];
            }
        }

        // Dynamically import API module
        let apiModule;
        try {
            apiModule = await import('./predictor/api.js');
        } catch (e) {
            console.error('[WaveSpeed Predictor] Failed to import API module:', e);
            return;
        }

        // Dynamically import utils module
        let utilsModule;
        try {
            utilsModule = await import('./predictor/utils.js');
        } catch (e) {
            console.error('[WaveSpeed Predictor] Failed to import utils module:', e);
            return;
        }

        // Create basic UI
        await createBasicUI(node, apiModule, utilsModule);
        
    } catch (error) {
        console.error('[WaveSpeed Predictor] Error in initializePredictorWidgets:', error);
    }
}

// Create basic UI
async function createBasicUI(node, apiModule, utilsModule) {
    try {

        // Preload model data
        const preloadContainer = document.createElement('div');
        preloadContainer.textContent = '⏳ Loading models...';
        preloadContainer.style.padding = '10px';
        preloadContainer.style.color = '#4a9eff';
        preloadContainer.style.textAlign = 'center';

        // Add as DOM widget
        const preloadWidget = node.addDOMWidget('preload_indicator', 'div', preloadContainer, { serialize: false });

        try {
            const preloadData = await apiModule.preloadAllModels((progress) => {
                if (progress.step === 'categories') {
                    preloadContainer.textContent = `⏳ Loaded ${progress.current} categories...`;
                } else if (progress.step === 'models') {
                    preloadContainer.textContent = `⏳ Loaded ${progress.total} models...`;
                }
            });

            console.log('[WaveSpeed Predictor] Preload result:', preloadData);

            if (preloadData) {
                node.wavespeedState.categoryList = preloadData.categories;
                node.wavespeedState.allModels = preloadData.flatModels;
                node.wavespeedState.modelsByCategory = preloadData.modelsByCategory;
                
                console.log('[WaveSpeed Predictor] Categories loaded:', node.wavespeedState.categoryList?.length);
                console.log('[WaveSpeed Predictor] Models loaded:', node.wavespeedState.allModels?.length);
            } else {
                console.error('[WaveSpeed Predictor] Preload returned null');
            }
        } catch (error) {
            console.error('[WaveSpeed Predictor] Preload failed:', error);
            preloadContainer.textContent = '❌ Failed to load models';
        }

        // Remove loading indicator - compatible with both Canvas and Vue rendering modes
        // Strategy: Remove from widgets array first, then ensure DOM cleanup with multiple fallbacks
        if (node.widgets) {
            const tempIdx = node.widgets.findIndex(w => w.name === 'preload_indicator');
            if (tempIdx > -1) {
                const widget = node.widgets[tempIdx];
                node.widgets.splice(tempIdx, 1);
                
                // Force remove widget's DOM element
                if (widget.element && widget.element.parentNode) {
                    widget.element.parentNode.removeChild(widget.element);
                }
            }
        }
        
        // DOM cleanup with fallbacks for both rendering modes
        // Immediate removal (works if already mounted)
        if (preloadContainer.parentNode) {
            preloadContainer.parentNode.removeChild(preloadContainer);
        }
        
        // Delayed removal (handles async rendering in Canvas mode)
        setTimeout(() => {
            if (preloadContainer.parentNode) {
                preloadContainer.parentNode.removeChild(preloadContainer);
            }
            // Also search for any orphaned preload indicators in the DOM
            const orphans = document.querySelectorAll('.wavespeed-loading-overlay, [class*="preload"]');
            orphans.forEach(el => {
                if (el.textContent && el.textContent.includes('Loaded') && el.textContent.includes('models')) {
                    el.remove();
                }
            });
        }, 100);
        
        // Additional cleanup after next frame
        requestAnimationFrame(() => {
            if (preloadContainer.parentNode) {
                preloadContainer.parentNode.removeChild(preloadContainer);
            }
        });

        // Create main container - contains all UI elements
        const mainContainer = document.createElement('div');
        mainContainer.className = 'wavespeed-main-container';
        mainContainer.style.display = 'flex';
        mainContainer.style.flexDirection = 'column';
        mainContainer.style.gap = '6px';
        mainContainer.style.padding = '6px';
        mainContainer.style.minHeight = 'auto';  // Remove fixed minimum height
        mainContainer.style.backgroundColor = '#2a2a2a';  // Add background for visibility

        // 1. Header: title + refresh button
        const header = document.createElement('div');
        header.className = 'wavespeed-header';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.padding = '4px 6px';
        header.style.backgroundColor = '#1a1a1a';
        header.style.borderRadius = '4px';
        header.style.border = '1px solid #333';

        const title = document.createElement('span');
        title.className = 'wavespeed-title';
        title.textContent = 'WaveSpeed AI Models';
        title.style.color = '#4a9eff';
        title.style.fontSize = '12px';
        title.style.fontWeight = '600';

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'wavespeed-refresh-btn';
        refreshBtn.innerHTML = '🔄';
        refreshBtn.title = 'Refresh models';
        refreshBtn.style.padding = '0';
        refreshBtn.style.backgroundColor = 'transparent';
        refreshBtn.style.color = '#888';
        refreshBtn.style.border = 'none';
        refreshBtn.style.borderRadius = '3px';
        refreshBtn.style.cursor = 'pointer';
        refreshBtn.style.fontSize = '16px';
        refreshBtn.style.lineHeight = '1';
        refreshBtn.style.width = '18px';
        refreshBtn.style.height = '18px';
        refreshBtn.style.display = 'inline-flex';
        refreshBtn.style.alignItems = 'center';
        refreshBtn.style.justifyContent = 'center';

        refreshBtn.onclick = async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '⏳';
            
            try {
                const newData = await apiModule.refreshAllModels();
                if (newData) {
                    node.wavespeedState.categoryList = newData.categories;
                    node.wavespeedState.allModels = newData.flatModels;
                    node.wavespeedState.modelsByCategory = newData.modelsByCategory;
                    // Update category tabs
                    updateCategoryTabsUI(node, utilsModule);
                    // Update model list
                    await utilsModule.filterModels(node);
                }
                refreshBtn.innerHTML = '✓';
            } catch (error) {
                console.error('[WaveSpeed Predictor] Refresh failed:', error);
                refreshBtn.innerHTML = '❌';
            }

            setTimeout(() => {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '🔄';
            }, 2000);
        };

        header.appendChild(title);
        header.appendChild(refreshBtn);
        mainContainer.appendChild(header);

        // 2. Category tabs
        const categoryTabsContainer = document.createElement('div');
        categoryTabsContainer.className = 'wavespeed-tabs-container';
        categoryTabsContainer.style.margin = '4px 0';
        categoryTabsContainer.style.padding = '4px 0';

        const tabsWrapper = document.createElement('div');
        tabsWrapper.className = 'wavespeed-tabs-wrapper';
        tabsWrapper.style.display = 'flex';
        tabsWrapper.style.flexWrap = 'wrap';
        tabsWrapper.style.gap = '4px';
        tabsWrapper.style.justifyContent = 'flex-start';

        // Add "All" tab
        const allTab = createCategoryTabButton('All', 'all', true, node, utilsModule, tabsWrapper);
        tabsWrapper.appendChild(allTab);

        // Add category tabs
        console.log('[WaveSpeed Predictor] Creating category tabs, categoryList:', node.wavespeedState.categoryList);
        if (node.wavespeedState.categoryList && node.wavespeedState.categoryList.length > 0) {
            for (const category of node.wavespeedState.categoryList) {
                const tab = createCategoryTabButton(category.name, category.value, false, node, utilsModule, tabsWrapper);
                tabsWrapper.appendChild(tab);
            }
        } else {
            console.warn('[WaveSpeed Predictor] No categories to display');
        }

        categoryTabsContainer.appendChild(tabsWrapper);
        mainContainer.appendChild(categoryTabsContainer);
        
        console.log('[WaveSpeed Predictor] mainContainer children:', mainContainer.children.length);
        console.log('[WaveSpeed Predictor] tabsWrapper children:', tabsWrapper.children.length);
        
        // Save reference for later updates
        node._categoryTabsWrapper = tabsWrapper;

        // 3. Model selector - use FuzzyModelSelector
        const modelSelectorContainer = document.createElement('div');
        modelSelectorContainer.className = 'wavespeed-model-selector';
        modelSelectorContainer.style.margin = '2px 0';

        // Create FuzzyModelSelector instance
        const fuzzySelector = new FuzzyModelSelector(async (selectedModelDisplay) => {
            if (selectedModelDisplay && selectedModelDisplay !== "Select a model...") {
                // Show loading overlay
                utilsModule.showLoadingOverlay(node);

                try {
                    await loadModelParameters(node, selectedModelDisplay, apiModule);
                } finally {
                    // Hide loading overlay
                    utilsModule.hideLoadingOverlay(node);
                }
            }
        });

        const selectorElement = fuzzySelector.create();
        modelSelectorContainer.appendChild(selectorElement);
        mainContainer.appendChild(modelSelectorContainer);

        // Save FuzzyModelSelector reference
        node._fuzzyModelSelector = fuzzySelector;

        // Add main container as single DOM widget (serialize: false to prevent ComfyUI auto-serialization)
        const mainWidget = node.addDOMWidget('wavespeed_main', 'div', mainContainer, { serialize: false });

        console.log('[WaveSpeed Predictor] mainWidget created:', mainWidget);
        console.log('[WaveSpeed Predictor] mainWidget.element:', mainWidget.element);
        console.log('[WaveSpeed Predictor] mainContainer.parentNode (immediate):', mainContainer.parentNode);
        
        // Wait for DOM to be mounted in Canvas mode
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[WaveSpeed Predictor] mainContainer.parentNode (after 100ms):', mainContainer.parentNode);
        
        await new Promise(resolve => requestAnimationFrame(resolve));
        console.log('[WaveSpeed Predictor] mainContainer.parentNode (after RAF):', mainContainer.parentNode);

        // CRITICAL FIX: Set all flags explicitly
        mainWidget._wavespeed_base = true;
        mainWidget._wavespeed_no_input = true;  // Base widget has no input slot
        mainWidget._wavespeed_dynamic = false;  // Base widget is not dynamic
        mainWidget._wavespeed_hidden = false;   // Not hidden

        // DO NOT set type='hidden' - it causes display:none in Canvas mode
        // Instead, rely on _wavespeed_base flag in computeSize to exclude from height calculation

        node._mainContainer = mainContainer;

        // Custom computeSize method
        // Use fixed height: header(40) + tabs(3 rows ~100) + selector(45) + padding(15) = 200
        mainWidget.computeSize = function() {
            return [node.size[0] - 20, 200];
        };

        // Create hidden widgets (for backend communication)
        // Use same pattern as wavespeed_generate_node.js
        const modelIdWidget = node.addWidget("text", "model_id", "", () => {}, {});
        modelIdWidget.type = "hidden";
        modelIdWidget._wavespeed_hidden = true;
        modelIdWidget.computeSize = () => [0, 0];
        modelIdWidget.draw = () => {}; // Do not draw
        // Ensure widget type is correctly set
        const modelIdIdx = node.widgets.indexOf(modelIdWidget);
        if (modelIdIdx >= 0) {
            node.widgets[modelIdIdx].type = "hidden";
        }
        
        const requestJsonWidget = node.addWidget("text", "request_json", "{}", () => {}, {});
        requestJsonWidget.type = "hidden";
        requestJsonWidget._wavespeed_hidden = true;
        requestJsonWidget.computeSize = () => [0, 0];
        requestJsonWidget.draw = () => {}; // Do not draw
        const requestJsonIdx = node.widgets.indexOf(requestJsonWidget);
        if (requestJsonIdx >= 0) {
            node.widgets[requestJsonIdx].type = "hidden";
        }

        const paramMapWidget = node.addWidget("text", "param_map", "{}", () => {}, {});
        paramMapWidget.type = "hidden";
        paramMapWidget._wavespeed_hidden = true;
        paramMapWidget.computeSize = () => [0, 0];
        paramMapWidget.draw = () => {}; // Do not draw
        const paramMapIdx = node.widgets.indexOf(paramMapWidget);
        if (paramMapIdx >= 0) {
            node.widgets[paramMapIdx].type = "hidden";
        }
        
        // Store references
        node.modelIdWidget = modelIdWidget;
        node.requestJsonWidget = requestJsonWidget;
        node.paramMapWidget = paramMapWidget;
        
        // Override onExecute preprocessing to ensure hidden parameters are passed
        const originalOnExecute = node.onExecute;
        node.onExecute = function() {
            // Update seed widgets before execution (based on mode: fixed/increment/decrement/random)
            if (this._seedWidgets && this._seedWidgets.length > 0) {
                for (const seedWidget of this._seedWidgets) {
                    if (seedWidget.beforeExecute) {
                        seedWidget.beforeExecute();
                    }
                }
            }
            
            if (originalOnExecute) {
                return originalOnExecute.call(this);
            }
        };

        // Initial model filtering and update FuzzyModelSelector
        await utilsModule.filterModels(node);

        // Check if workflow data needs to be restored
        if (node._wavespeed_savedData) {
            await restoreWorkflowData(node, apiModule);
        }

        // Configure connection change handlers
        const inputsModule = await import('./predictor/inputs.js');
        inputsModule.configureConnectionHandlers(node);

    } catch (error) {
        console.error('[WaveSpeed Predictor] Error creating basic UI:', error);
    }
}

// Create category tab button
function createCategoryTabButton(name, value, isActive, node, utilsModule, tabsWrapper) {
    const tab = document.createElement('button');
    tab.className = 'wavespeed-tab';
    tab.textContent = name;
    tab.dataset.value = value;
    tab.style.padding = '4px 8px';
    tab.style.borderRadius = '3px';
    tab.style.border = '1px solid #444';
    tab.style.cursor = 'pointer';
    tab.style.fontSize = '11px';
    tab.style.minHeight = '22px';
    tab.style.lineHeight = '1.2';
    tab.style.whiteSpace = 'nowrap';
    tab.style.transition = 'all 0.2s ease';

    if (isActive) {
        tab.classList.add('active');
        tab.style.backgroundColor = '#4a9eff';
        tab.style.color = 'white';
        tab.style.borderColor = '#4a9eff';
        node.wavespeedState.currentCategory = value;
    } else {
        tab.style.backgroundColor = '#2a2a2a';
        tab.style.color = '#e0e0e0';
    }

    tab.onclick = async () => {
        // Update all tab styles
        tabsWrapper.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('active');
            btn.style.backgroundColor = '#2a2a2a';
            btn.style.color = '#e0e0e0';
            btn.style.borderColor = '#444';
        });

        tab.classList.add('active');
        tab.style.backgroundColor = '#4a9eff';
        tab.style.color = 'white';
        tab.style.borderColor = '#4a9eff';

        node.wavespeedState.currentCategory = value;
        await utilsModule.filterModels(node);
    };

    return tab;
}

// Update category tabsUI
function updateCategoryTabsUI(node, utilsModule) {
    const tabsWrapper = node._categoryTabsWrapper;
    if (!tabsWrapper) return;

    // Clear existing tabs
    tabsWrapper.innerHTML = '';

    // Re-add "All" tab
    const allTab = createCategoryTabButton('All', 'all', node.wavespeedState.currentCategory === 'all', node, utilsModule, tabsWrapper);
    tabsWrapper.appendChild(allTab);

    // Add category tabs
    if (node.wavespeedState.categoryList && node.wavespeedState.categoryList.length > 0) {
        for (const category of node.wavespeedState.categoryList) {
            const isActive = node.wavespeedState.currentCategory === category.value;
            const tab = createCategoryTabButton(category.name, category.value, isActive, node, utilsModule, tabsWrapper);
            tabsWrapper.appendChild(tab);
        }
    }
}

// Load model parameters
async function loadModelParameters(node, modelValue, apiModule, isRestoring = false) {
    try {
        // Parse model ID
        let modelId = modelValue;
        if (modelValue.includes(' > ')) {
            modelId = modelValue.split(' > ')[1];
        }

        // Find model data from allModels
        const modelData = node.wavespeedState.allModels?.find(m => m.name === modelId || m.value === modelId);
        const actualModelId = modelData?.value || modelId;

        // Get model details
        const modelDetail = await apiModule.getCachedModelDetail(actualModelId);
        if (!modelDetail?.input_schema) {
            return;
        }

        // Dynamically import parameters module
        const parametersModule = await import('./predictor/parameters.js');
        const widgetsModule = await import('./predictor/widgets.js');
        const parameters = parametersModule.parseModelParameters(modelDetail.input_schema);

        // Save to node state
        node.wavespeedState.modelId = actualModelId;
        node.wavespeedState.parameters = parameters;

        // Only reset parameter values in non-restore mode
        if (!isRestoring) {
            node.wavespeedState.parameterValues = {};
        }

        // Update hidden widgets
        const apiPath = modelDetail.api_path || `/api/v3/${actualModelId}`;
        if (node.modelIdWidget) {
            node.modelIdWidget.value = apiPath;
        }

        // Clear old dynamic widgets (keep base widgets and hidden widgets)
        if (node.widgets) {
            // In restore mode, preserve widget values before deletion
            if (isRestoring) {
                for (const widget of node.widgets) {
                    if (widget._wavespeed_dynamic && widget._wavespeed_param) {
                        // Use getValue method if available (for object array items), otherwise use value property
                        const currentValue = widget.getValue ? widget.getValue() : widget.value;
                        if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
                            node.wavespeedState.parameterValues[widget._wavespeed_param] = currentValue;
                        }
                    }
                }
            }

            // Only clean up tooltips that are mounted to body (not managed by Vue)
            const bodyTooltips = document.querySelectorAll('.wavespeed-tooltip');
            bodyTooltips.forEach(t => t.remove());

            // CRITICAL FIX: In Canvas mode, clean up DOM elements of dynamic widgets
            // Canvas mode doesn't automatically remove DOM when widget is removed from array
            // In Vue mode, Vue manages the DOM, so we should NOT remove elements manually
            const isCanvasMode = !LiteGraph.vueNodesMode;
            console.log('[WaveSpeed] Cleaning widgets, isCanvasMode:', isCanvasMode);
            console.log('[WaveSpeed] Widgets before cleanup:', node.widgets?.length);
            
            if (isCanvasMode) {
                let removedCount = 0;
                for (const widget of node.widgets) {
                    if (widget._wavespeed_dynamic && widget.element) {
                        // Remove DOM element if it has a parent
                        if (widget.element.parentNode) {
                            console.log('[WaveSpeed] Removing DOM for widget:', widget.name);
                            widget.element.parentNode.removeChild(widget.element);
                            removedCount++;
                        }
                    }
                }
                console.log('[WaveSpeed] Removed', removedCount, 'DOM elements in Canvas mode');
            }

            // Filter widgets array to remove dynamic widgets
            node.widgets = node.widgets.filter(w =>
                w._wavespeed_base ||
                w._wavespeed_hidden ||
                w.type === "hidden" ||
                w.name === 'model_id' ||
                w.name === 'request_json' ||
                w.name === 'param_map'
            );
        }

        // In restore mode, keep existing input slots (they were created in configure)
        // In non-restore mode, clear old dynamic input slots
        if (!isRestoring && node.inputs) {
            const inputsToKeep = [];
            for (const input of node.inputs) {
                if (!input._wavespeed_dynamic) {
                    // Keep non-dynamic inputs (if any exist)
                    inputsToKeep.push(input);
                } else {
                    // CRITICAL FIX: Clear input.widget reference before removing input
                    // Issue: refreshNodeSlots uses input.widget.name to match widgets
                    //   - If old input.widget still points to deleted widget, slotMetadata will have wrong keys
                    //   - This causes wrong widgets to be disabled when connecting slots
                    // Solution: Clear input.widget and widget.linkedInput before removing input
                    if (input.widget) {
                        // Clear bidirectional reference
                        if (input.widget.linkedInput === input) {
                            delete input.widget.linkedInput;
                        }
                        delete input.widget;
                    }
                }
            }

            // Direct replacement - this clears LiteGraph's internal cache
            node.inputs = inputsToKeep;
        }
        
        // Clear seed widgets list
        node._seedWidgets = [];

        // Expand array parameters to independent parameters
        const expandedParams = [];
        const arrayParamGroups = {};
        const sizeParamGroups = {};

        for (const param of parameters) {
            const originalType = parametersModule.getOriginalApiType(param);
            const isArray = param.isArray || parametersModule.isArrayParameter(param.name, originalType);
            const isSize = parametersModule.isSizeParameter(param.name);

            if (isArray) {
                // Check if this is an object array (e.g., bbox_condition with height/length/width)
                if (param.isObjectArray && param.objectProperties) {
                    // Object array: create one widget per array item with multiple fields in a row
                    const maxItems = Math.min(param.maxItems || 5, 5);
                    const singularName = param.name.endsWith('s') ? param.name.slice(0, -1) : param.name;

                    arrayParamGroups[param.name] = {
                        originalParam: param,
                        expandedNames: [],
                        maxItems: maxItems,
                        isObjectArray: true,  // Mark as object array
                        objectProperties: param.objectProperties
                    };

                    // First add a title parameter (no input slot)
                    const titleParam = {
                        name: `${param.name}_title`,
                        displayName: param.name,
                        isArrayTitle: true,
                        parentArrayName: param.name,
                        parentRequired: param.required,
                        parentDescription: param.description,
                        type: 'ARRAY_TITLE'
                    };
                    expandedParams.push(titleParam);

                    // For object arrays, create one expanded param per array item (will contain multiple fields)
                    for (let i = 0; i < maxItems; i++) {
                        const expandedName = `${singularName}_${i}`;
                        const expandedParam = {
                            ...param,
                            name: expandedName,
                            displayName: `${param.displayName || param.name} [${i}]`,
                            isArray: false,
                            isExpandedArrayItem: true,
                            isObjectArrayItem: true,
                            parentArrayName: param.name,
                            parentRequired: param.required,
                            parentDescription: param.description,
                            arrayIndex: i,
                            objectProperties: param.objectProperties,
                            type: 'OBJECT_ARRAY_ITEM'
                        };
                        expandedParams.push(expandedParam);
                        arrayParamGroups[param.name].expandedNames.push(expandedName);
                    }
                } else {
                    // Regular array: expand to multiple independent parameters
                    const maxItems = Math.min(param.maxItems || 5, 5);
                    const singularName = param.name.endsWith('s') ? param.name.slice(0, -1) : param.name;
                    const mediaType = parametersModule.getMediaType(param.name, originalType);

                    arrayParamGroups[param.name] = {
                        originalParam: param,
                        expandedNames: [],
                        maxItems: maxItems,
                        mediaType: mediaType
                    };

                    // First add a title parameter (no input slot)
                    const titleParam = {
                        name: `${param.name}_title`,
                        displayName: param.name,
                        isArrayTitle: true,
                        parentArrayName: param.name,
                        parentRequired: param.required,
                        parentDescription: param.description,
                        type: 'ARRAY_TITLE'
                    };
                    expandedParams.push(titleParam);

                    for (let i = 0; i < maxItems; i++) {
                        const expandedName = `${singularName}_${i}`;
                        const expandedParam = {
                            ...param,
                            name: expandedName,
                            displayName: `${param.displayName || param.name} [${i}]`,
                            isArray: false,
                            isExpandedArrayItem: true,
                            parentArrayName: param.name,
                            parentRequired: param.required,  // Pass parent parameter required
                            parentDescription: param.description,  // Pass parent parameter description
                            arrayIndex: i,
                            mediaType: mediaType,
                            type: 'STRING',
                            default: ''
                        };
                        expandedParams.push(expandedParam);
                        arrayParamGroups[param.name].expandedNames.push(expandedName);
                    }
                }
            } else if (isSize) {
                // Size parameter: expand to ratio buttons + width + height
                console.log('[WaveSpeed Predictor] Expanding size parameter:', param.name);
                
                // Create shared state for width/height widgets (for ratio buttons)
                const sizeSharedState = {
                    widthWidget: null,
                    heightWidget: null,
                    widthInput: null,
                    heightInput: null,
                    ratioButtons: [],
                    ratioContainer: null
                };
                
                sizeParamGroups[param.name] = {
                    originalParam: param,
                    expandedNames: [`${param.name}_ratios`, `${param.name}_width`, `${param.name}_height`],
                    isSize: true,
                    sharedState: sizeSharedState
                };

                // Add title parameter (like array title)
                const titleParam = {
                    name: `${param.name}_title`,
                    displayName: param.name,
                    isSizeTitle: true,
                    parentSizeName: param.name,
                    parentRequired: param.required,
                    parentDescription: param.description,
                    type: 'SIZE_TITLE'
                };
                expandedParams.push(titleParam);
                console.log('[WaveSpeed Predictor] Added size title:', titleParam.name);

                // Add ratio buttons parameter (no input slot)
                const ratioParam = {
                    name: `${param.name}_ratios`,
                    displayName: 'Ratios',
                    isSizeRatios: true,
                    parentSizeName: param.name,
                    type: 'SIZE_RATIOS',
                    sharedState: sizeSharedState
                };
                expandedParams.push(ratioParam);
                console.log('[WaveSpeed Predictor] Added ratio buttons:', ratioParam.name);

                // Add width sub-parameter (with size component flag)
                // If x-hidden, default is empty; otherwise use 1024
                const widthParam = {
                    name: `${param.name}_width`,
                    displayName: 'Width',
                    type: 'INT',
                    min: param.min,
                    max: param.max,
                    default: param.xHidden ? '' : 1024,
                    required: param.required,
                    description: param.description,
                    isSizeComponent: true,
                    sizeComponent: 'width',
                    parentSizeName: param.name,
                    sizeIndex: 0,
                    sharedState: sizeSharedState,
                    xHidden: param.xHidden
                };
                expandedParams.push(widthParam);
                console.log('[WaveSpeed Predictor] Added width param:', widthParam.name, 'xHidden:', param.xHidden);

                // Add height sub-parameter (with size component flag)
                // If x-hidden, default is empty; otherwise use 1024
                const heightParam = {
                    name: `${param.name}_height`,
                    displayName: 'Height',
                    type: 'INT',
                    min: param.min,
                    max: param.max,
                    default: param.xHidden ? '' : 1024,
                    required: param.required,
                    description: param.description,
                    isSizeComponent: true,
                    sizeComponent: 'height',
                    parentSizeName: param.name,
                    sizeIndex: 1,
                    sharedState: sizeSharedState,
                    xHidden: param.xHidden
                };
                expandedParams.push(heightParam);
                console.log('[WaveSpeed Predictor] Added height param:', heightParam.name, 'xHidden:', param.xHidden);
            } else {
                expandedParams.push(param);
            }
        }

        // Save array parameter group info
        node._arrayParamGroups = arrayParamGroups;
        node._sizeParamGroups = sizeParamGroups;

        // Create input slot and widget for each expanded parameter
        // REFERENCE: Standard pattern from setupSingleMediaParameters (inputs.js:55-108)
        // Key: Create input FIRST, then widget, then associate immediately
        // This ensures inputs array is stable before ComfyUI calculates positions
        
        for (const param of expandedParams) {
            try {
                // Array title does not create input slot
                if (param.isArrayTitle || param.type === 'ARRAY_TITLE') {
                    // Only create widget, no input slot (similar to standard pattern but for title)
                    const widget = widgetsModule.createParameterWidget(node, param);
                    if (widget) {
                        // CRITICAL FIX: Set all flags explicitly for array title
                        widget._wavespeed_dynamic = true;
                        widget._wavespeed_no_input = true;  // Array title has no input slot
                        widget._wavespeed_base = false;
                        widget._wavespeed_hidden = false;
                    }
                    continue;
                }

                // Size title does not create input slot
                if (param.isSizeTitle || param.type === 'SIZE_TITLE') {
                    const widget = widgetsModule.createParameterWidget(node, param);
                    if (widget) {
                        widget._wavespeed_dynamic = true;
                        widget._wavespeed_no_input = true;
                        widget._wavespeed_base = false;
                        widget._wavespeed_hidden = false;
                    }
                    continue;
                }

                // Size ratio buttons do not create input slot
                if (param.isSizeRatios || param.type === 'SIZE_RATIOS') {
                    const widget = createRatioButtonsWidget(node, param, param.sharedState);
                    if (widget) {
                        widget._wavespeed_dynamic = true;
                        widget._wavespeed_no_input = true;
                        widget._wavespeed_base = false;
                        widget._wavespeed_hidden = false;
                    }
                    continue;
                }

                // Object array items do not create input slot (they are composite objects)
                if (param.isObjectArrayItem || param.type === 'OBJECT_ARRAY_ITEM') {
                    // Only create widget, no input slot
                    const widget = widgetsModule.createParameterWidget(node, param);
                    if (widget) {
                        widget._wavespeed_dynamic = true;
                        widget._wavespeed_no_input = true;  // Object array item has no input slot
                        widget._wavespeed_base = false;
                        widget._wavespeed_hidden = false;
                    }
                    continue;
                }
                
                // STEP 1: Create input slot FIRST (standard pattern: input before widget)
                let input = null;
                if (isRestoring) {
                    // In restore mode, check if input already exists
                    const existingIdx = node.inputs?.findIndex(inp => inp.name === param.name);
                    if (existingIdx >= 0) {
                        input = node.inputs[existingIdx];
                        // CRITICAL FIX: Clear old input.widget reference if it exists
                        // Issue: In restore mode, old input.widget may point to deleted widget
                        //   - This causes refreshNodeSlots to use wrong widget.name for matching
                        // Solution: Clear old reference before creating new widget
                        if (input.widget) {
                            if (input.widget.linkedInput === input) {
                                delete input.widget.linkedInput;
                            }
                            delete input.widget;
                        }
                    }
                }

                // Size component (width/height) - create input slot and custom size component widget
                // Similar to array item, each component gets its own widget and input slot
                if (param.isSizeComponent) {
                    console.log('[WaveSpeed Predictor] Processing size component:', param.name);
                    
                    // STEP 1: Create input slot FIRST
                    let input = null;
                    if (isRestoring) {
                        const existingIdx = node.inputs?.findIndex(inp => inp.name === param.name);
                        if (existingIdx >= 0) {
                            input = node.inputs[existingIdx];
                            console.log('[WaveSpeed Predictor] Reusing existing size component input:', param.name);
                            // Clear old widget reference
                            if (input.widget) {
                                if (input.widget.linkedInput === input) {
                                    delete input.widget.linkedInput;
                                }
                                delete input.widget;
                            }
                        }
                    }
                    
                    if (!input) {
                        const inputType = 'INT';
                        input = node.addInput(param.name, inputType);
                        console.log('[WaveSpeed Predictor] Created new size component input:', param.name);
                    }
                    
                    if (!input) {
                        console.warn('[WaveSpeed Predictor] Failed to create input for size component:', param.name);
                        continue;
                    }
                    
                    // Set input properties
                    input._wavespeed_dynamic = true;
                    input._wavespeed_param = param.name;
                    input._wavespeed_size_component = param.sizeComponent;
                    input._wavespeed_parent_size = param.parentSizeName;
                    input._wavespeed_size_index = param.sizeIndex;
                    
                    // STEP 2: Create custom size component widget (with ratio buttons for width)
                    const widget = createSizeComponentWidget(node, param, param.sharedState);
                    
                    if (!widget) {
                        console.warn('[WaveSpeed Predictor] Failed to create widget for size component:', param.name);
                        continue;
                    }
                    
                    // Set widget properties
                    widget._wavespeed_dynamic = true;
                    widget._wavespeed_param = param.name;
                    widget._wavespeed_size_component = param.sizeComponent;
                    widget._wavespeed_parent_size = param.parentSizeName;
                    widget._wavespeed_no_input = false;
                    widget._wavespeed_base = false;
                    widget._wavespeed_hidden = false;
                    
                    // STEP 3: Link input and widget
                    input.widget = widget;
                    widget.linkedInput = input;
                    
                    // Copy label offset from widget to input for correct slot positioning
                    if (widget._wavespeed_label_offset) {
                        input._wavespeed_label_offset = widget._wavespeed_label_offset;
                        console.log('[WaveSpeed] Copied label offset to input:', param.name, input._wavespeed_label_offset);
                        
                        // Try to set position immediately
                        // This might work better than waiting for onDrawBackground
                        setTimeout(() => {
                            if (input.widget && input.widget.y !== undefined) {
                                const widgetY = input.widget.y;
                                const offsetY = widgetY + input._wavespeed_label_offset;
                                if (!input.pos || !Array.isArray(input.pos)) {
                                    input.pos = [0, 0];
                                }
                                input.pos[1] = offsetY;
                                console.log('[WaveSpeed] Set input position immediately:', {
                                    name: input.name,
                                    widgetY: widgetY,
                                    offset: input._wavespeed_label_offset,
                                    finalY: offsetY
                                });
                                // Force node to redraw
                                node.setDirtyCanvas(true, true);
                            }
                        }, 100);
                    }
                    
                    console.log('[WaveSpeed Predictor] Created size component widget and linked:', param.name);
                    
                    // Initialize value (handle both value property and getValue/setValue methods)
                    const existingValue = node.wavespeedState.parameterValues[param.name];
                    if (existingValue !== undefined) {
                        if (widget.setValue) {
                            widget.setValue(existingValue);
                        } else {
                            widget.value = existingValue;
                        }
                    } else {
                        const currentValue = widget.getValue ? widget.getValue() : widget.value;
                        node.wavespeedState.parameterValues[param.name] = currentValue;
                    }
                    
                    continue;
                }
                // If not exists, create new input slot
                if (!input) {
                    const inputType = '*'; // Use wildcard type to accept any connection
                    input = node.addInput(param.name, inputType);
                }
                
                if (!input) {
                    console.warn('[WaveSpeed Predictor] Failed to create input for:', param.name);
                    continue;
                }
                
                // Set input properties
                input._wavespeed_dynamic = true;
                input._wavespeed_param = param.name;
                
                // Mark expanded array items
                if (param.isExpandedArrayItem) {
                    input._wavespeed_expanded_array_item = true;
                    input._wavespeed_parent_array = param.parentArrayName;
                    input._wavespeed_array_index = param.arrayIndex;
                }

                // STEP 2: Create widget (standard pattern: widget after input)
                const widget = widgetsModule.createParameterWidget(node, param);
                if (!widget) {
                    console.warn('[WaveSpeed Predictor] Failed to create widget for:', param.name);
                    continue;
                }
                
                // Set all widget flags explicitly to avoid undefined values
                widget._wavespeed_dynamic = true;
                widget._wavespeed_no_input = false;
                widget._wavespeed_base = false;
                widget._wavespeed_hidden = false;

                // STEP 3: Associate input and widget IMMEDIATELY (standard pattern)
                // Replace temporary widget with newly created widget
                if (input._savedWidget) {
                    // Save value from temporary widget before removing it
                    const tempWidgetValue = input._savedWidget.value;
                    if (tempWidgetValue !== undefined && tempWidgetValue !== null && tempWidgetValue !== '') {
                        // Restore value to new widget
                        if (widget.restoreValue && typeof widget.restoreValue === 'function') {
                            widget.restoreValue(tempWidgetValue);
                        } else {
                            widget.value = tempWidgetValue;
                        }
                        // Also update parameterValues to ensure it's saved
                        node.wavespeedState.parameterValues[param.name] = tempWidgetValue;
                    }
                    
                    // Remove temporary widget from widgets array if it exists
                    const tempWidgetIdx = node.widgets?.findIndex(w => w === input._savedWidget);
                    if (tempWidgetIdx >= 0) {
                        node.widgets.splice(tempWidgetIdx, 1);
                    }
                    delete input._savedWidget;
                }

                // Associate newly created widget
                input.widget = widget;
                widget.linkedInput = input;

                // Copy label offset from widget to input for correct slot positioning
                if (widget._wavespeed_label_offset) {
                    input._wavespeed_label_offset = widget._wavespeed_label_offset;
                }

            } catch (error) {
                console.error('[WaveSpeed Predictor] Error creating parameter:', param.name, error);
            }
        }

        // CRITICAL FIX: Save expandedParams separately for request building,
        // but keep original parameters for param_map / Python side (array detection).
        // - node.wavespeedState.parameters: original schema parameters (includes 'images', 'loras' as arrays)
        // - node.wavespeedState.expandedParams: UI-expanded parameters (image_0, lora_0, bbox_condition_0, etc.)
        node.wavespeedState.expandedParams = expandedParams;

        // Update request JSON
        widgetsModule.updateRequestJson(node);

        // CRITICAL FIX: Ensure inputs and widgets arrays are in consistent order
        // Issue: onNodeRemoved/onNodeAdded may cause Vue to re-extract data in wrong order
        // Solution: Reorder widgets array to match expandedParams order
        if (node.widgets && node.wavespeedState.expandedParams) {
            // Build a map of widget name to widget for quick lookup
            const widgetMap = new Map();
            for (const widget of node.widgets) {
                if (widget.name) {
                    widgetMap.set(widget.name, widget);
                }
            }
            
            // Build ordered widgets list based on expandedParams order
            const orderedWidgets = [];
            const processedWidgets = new Set();
            
            // Process expandedParams in order
            for (const param of node.wavespeedState.expandedParams) {
                const widget = widgetMap.get(param.name);
                if (widget && widget._wavespeed_dynamic && !processedWidgets.has(widget)) {
                    orderedWidgets.push(widget);
                    processedWidgets.add(widget);
                }
            }
            
            // Add any remaining dynamic widgets (shouldn't happen, but safety check)
            for (const widget of node.widgets) {
                if (widget._wavespeed_dynamic && !processedWidgets.has(widget)) {
                    orderedWidgets.push(widget);
                    processedWidgets.add(widget);
                }
            }
            
            // Build final array preserving non-dynamic widgets at original positions
            const reorderedWidgets = [];
            let orderedIndex = 0;
            
            for (const widget of node.widgets) {
                if (widget._wavespeed_dynamic) {
                    if (orderedIndex < orderedWidgets.length) {
                        reorderedWidgets.push(orderedWidgets[orderedIndex]);
                        orderedIndex++;
                    }
                } else {
                    // Keep non-dynamic widgets at their original positions
                    reorderedWidgets.push(widget);
                }
            }
            
            // Replace widgets array if order changed
            let orderChanged = false;
            if (reorderedWidgets.length === node.widgets.length) {
                for (let i = 0; i < reorderedWidgets.length; i++) {
                    if (reorderedWidgets[i] !== node.widgets[i]) {
                        orderChanged = true;
                        break;
                    }
                }
            }
            
            if (orderChanged) {
                console.log('[WaveSpeed DEBUG] Reordering widgets array to match expandedParams order');
                node.widgets.splice(0, node.widgets.length, ...reorderedWidgets);
            }
        }

        // CRITICAL FIX: Force Vue to re-extract nodeData after model switch
        // Root cause: refreshNodeSlots (useGraphNodeManager.ts:247-257) breaks reactivity
        //   - It replaces safeWidgets (reactiveComputed) with a plain array
        //   - After that, vueNodeData.widgets won't update when node.widgets changes
        //   - Vue doesn't know there are new widgets to render
        // Solution: Simulate node removal and re-addition to trigger extractVueNodeData
        // NOTE: Do NOT change the overall onNodeRemoved/onNodeAdded logic – only add small safety guards
        
        // CRITICAL: Install temporary error handler to catch and suppress PrimeVue transition errors
        // These errors occur when Vue transition hooks (onOverlayLeave) execute on destroyed components
        // after onNodeRemoved is called during an active PrimeVue dropdown interaction
        let transitionErrorHandler = null;
        const originalErrorHandler = window.onerror;
        const originalUnhandledRejectionHandler = window.onunhandledrejection;
        
        transitionErrorHandler = (event) => {
            // Check if this is the specific PrimeVue $el error we're trying to prevent
            if (event.error && event.error.message && 
                event.error.message.includes("Cannot read properties of null") && 
                event.error.message.includes("$el")) {
                // Suppress this specific error - it's harmless (component already destroyed)
                event.preventDefault();
                return true;
            }
            // Let other errors through
            if (originalErrorHandler) {
                return originalErrorHandler.apply(window, arguments);
            }
            return false;
        };
        
        window.onerror = transitionErrorHandler;
        
        window.addEventListener('unhandledrejection', (event) => {
            // Also catch promise rejections
            if (event.reason && event.reason.message && 
                event.reason.message.includes("Cannot read properties of null") && 
                event.reason.message.includes("$el")) {
                event.preventDefault();
                return;
            }
            if (originalUnhandledRejectionHandler) {
                originalUnhandledRejectionHandler.call(window, event);
            }
        });
        
        console.log('[WaveSpeed DEBUG] Forcing Vue to re-extract nodeData...');

        try {
            const graph = node.graph;
            if (graph && graph.onNodeRemoved && graph.onNodeAdded) {
                // CRITICAL FIX: Close any open PrimeVue overlays and wait for ALL async operations to complete
                // Root cause: PrimeVue's hide() uses setTimeout(() => _hide(), 0) and Vue transitions are async.
                // When user clicks an option, hide() is called, which triggers Vue transition leave.
                // If onNodeRemoved is called before transition completes, onOverlayLeave hook accesses destroyed $refs.
                // Solution: Blur active elements, force close overlays via DOM manipulation, then wait LONGER
                // for all setTimeout callbacks and Vue transition hooks (onLeave/onOverlayLeave) to complete.
                try {
                    // Step 1: Blur any active element to prevent further interaction
                    const activeEl = document.activeElement;
                    if (activeEl && activeEl instanceof HTMLElement) {
                        activeEl.blur();
                    }

                    // Step 2: Force close any open PrimeVue overlays by manipulating DOM directly
                    // This prevents Vue from starting new transitions while we wait
                    // CRITICAL: Remove overlay DOM elements entirely to prevent transition hooks from accessing destroyed refs
                    const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
                    if (nodeElement) {
                        // Find all PrimeVue overlay containers and their transition wrappers
                        // PrimeVue overlays are typically wrapped in Transition components
                        const overlayContainers = nodeElement.querySelectorAll('[data-pc-name="autocomplete"], [data-pc-section="root"], [class*="p-connected-overlay"]');
                        overlayContainers.forEach(container => {
                            // Find the transition wrapper (usually has 'p-connected-overlay' class or is inside a transition)
                            let overlayWrapper = container.closest('[class*="p-connected-overlay"], [class*="p-overlay"], [class*="p-autocomplete-panel"]');
                            if (!overlayWrapper) {
                                // Look for parent with position:absolute/fixed (typical overlay positioning)
                                overlayWrapper = container.closest('[style*="position: absolute"], [style*="position: fixed"]');
                            }
                            if (!overlayWrapper) {
                                overlayWrapper = container.parentElement;
                            }
                            
                            if (overlayWrapper && overlayWrapper.parentElement) {
                                // CRITICAL: Remove the entire overlay DOM element to prevent Vue transition hooks from running
                                // This ensures onOverlayLeave hook never executes on a destroyed component
                                try {
                                    overlayWrapper.parentElement.removeChild(overlayWrapper);
                                } catch (e) {
                                    // If removal fails, at least hide it
                                    if (overlayWrapper.style) {
                                        overlayWrapper.style.display = 'none';
                                        overlayWrapper.style.visibility = 'hidden';
                                        overlayWrapper.style.pointerEvents = 'none';
                                    }
                                }
                            }
                        });
                    }

                    // Step 3: Wait for ALL pending async operations to complete
                    // PrimeVue hide() uses setTimeout(() => _hide(), 0), so we need at least one setTimeout cycle
                    // Vue transitions use nextTick, which can take multiple requestAnimationFrame cycles
                    // Vue transition hooks (onLeave, onOverlayLeave) are also async
                    // We need to wait long enough for all of these to complete
                    await new Promise(resolve => {
                        // First, let all setTimeout(0) callbacks execute
                        setTimeout(() => {
                            // Then wait for Vue's nextTick cycle
                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    // Additional setTimeout to ensure Vue transition hooks complete
                                    // Vue transition hooks are scheduled via Promise.then (nextTick)
                                    // So we need another setTimeout to catch those
                                    setTimeout(() => {
                                        // One more requestAnimationFrame for any remaining DOM updates
                                        requestAnimationFrame(() => {
                                            // Final timeout to ensure all async operations are done
                                            // This gives enough time for onOverlayLeave to complete
                                            setTimeout(resolve, 100);
                                        });
                                    }, 50);
                                });
                            });
                        }, 0);
                    });
                } catch (e) {
                    console.warn('[WaveSpeed DEBUG] Failed to close overlays before node removal:', e);
                    // On error, wait longer to ensure safety
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                // Step 1: Trigger node removal (cleans up vueNodeData)
                console.log('[WaveSpeed DEBUG] Simulating node removal...');
                graph.onNodeRemoved(node);

                // Step 2: Trigger node addition (re-extracts nodeData with fresh safeWidgets)
                console.log('[WaveSpeed DEBUG] Simulating node addition...');
                graph.onNodeAdded(node);

                // Step 3: Re-verify and fix order after Vue re-extraction
                // Issue: extractVueNodeData may reorder widgets array
                // Solution: Ensure widgets order matches expandedParams order
                if (node.widgets && node.wavespeedState.expandedParams) {
                    // Build a map of widget name to widget for quick lookup
                    const widgetMap = new Map();
                    for (const widget of node.widgets) {
                        if (widget.name) {
                            widgetMap.set(widget.name, widget);
                        }
                    }
                    
                    // Build ordered widgets list based on expandedParams order
                    const orderedWidgets = [];
                    const processedWidgets = new Set();
                    
                    // Process expandedParams in order
                    for (const param of node.wavespeedState.expandedParams) {
                        const widget = widgetMap.get(param.name);
                        if (widget && widget._wavespeed_dynamic && !processedWidgets.has(widget)) {
                            orderedWidgets.push(widget);
                            processedWidgets.add(widget);
                        }
                    }
                    
                    // Add any remaining dynamic widgets (shouldn't happen, but safety check)
                    for (const widget of node.widgets) {
                        if (widget._wavespeed_dynamic && !processedWidgets.has(widget)) {
                            orderedWidgets.push(widget);
                            processedWidgets.add(widget);
                        }
                    }
                    
                    // Build final array preserving non-dynamic widgets at original positions
                    const reorderedWidgets = [];
                    let orderedIndex = 0;
                    
                    for (const widget of node.widgets) {
                        if (widget._wavespeed_dynamic) {
                            if (orderedIndex < orderedWidgets.length) {
                                reorderedWidgets.push(orderedWidgets[orderedIndex]);
                                orderedIndex++;
                            }
                        } else {
                            // Keep non-dynamic widgets at their original positions
                            reorderedWidgets.push(widget);
                        }
                    }
                    
                    // Replace if order changed
                    let orderChanged = false;
                    if (reorderedWidgets.length === node.widgets.length) {
                        for (let i = 0; i < reorderedWidgets.length; i++) {
                            if (reorderedWidgets[i] !== node.widgets[i]) {
                                orderChanged = true;
                                break;
                            }
                        }
                    }
                    
                    if (orderChanged) {
                        console.log('[WaveSpeed DEBUG] Reordering widgets after Vue re-extraction');
                        node.widgets.splice(0, node.widgets.length, ...reorderedWidgets);
                    }
                }

                console.log('[WaveSpeed DEBUG] Vue nodeData re-extraction complete');
            } else {
                console.warn('[WaveSpeed DEBUG] graph.onNodeRemoved/onNodeAdded not available');
            }
        } catch (error) {
            console.error('[WaveSpeed DEBUG] Failed to re-extract nodeData:', error);
        } finally {
            // Restore original error handlers
            if (transitionErrorHandler) {
                window.onerror = originalErrorHandler;
                // Note: unhandledrejection listener is global, but removing it is safe
                // as it only suppresses the specific $el error during node removal
            }
        }

        // Wait a bit for Vue to process the changes
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });

        // CRITICAL FIX: Mount new widget.element using precise data-widget-name matching
        // Issue: Previous className-based matching (widgetType) was ambiguous for array items
        //   - All image_0, image_1, image_2 have widgetType = "media"
        //   - First matching container would be replaced multiple times
        // Solution: Use data-widget-name attribute for precise matching
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
        console.log('[WaveSpeed DEBUG] nodeElement:', nodeElement);
        if (nodeElement && node.widgets) {
            // Only process widgets that have input/textarea (skip array-title, etc.)
            const inputWidgets = node.widgets.filter(w => {
                if (!w._wavespeed_dynamic || !w.element || w._wavespeed_array_title || w._wavespeed_size_title || w._wavespeed_no_input) {
                    console.log('[WaveSpeed DEBUG] Skipping widget:', w);
                    return false;
                }
                // Check if widget has input/textarea
                return w.element.querySelector('input, textarea') !== null;
            });
            
            for (const widget of inputWidgets) {
                // Skip if already in DOM
                if (widget.element.parentElement !== null) {
                    continue;
                }
                
                // Get widget name for precise matching
                const widgetName = widget.name;
                if (!widgetName) {
                    console.warn('[WaveSpeed DEBUG] Widget missing name:', widget);
                    continue;
                }
                
                // Find container by matching data-widget-name attribute
                const widgetContainers = nodeElement.querySelectorAll('.lg-node-widget');
                for (const container of widgetContainers) {
                    const widgetDOMDiv = container.querySelector('.col-span-2');
                    if (!widgetDOMDiv) continue;
                    
                    const domEl = widgetDOMDiv.firstElementChild;
                    if (!domEl || domEl === widget.element) continue;
                    
                    // Match by data-widget-name attribute (precise matching)
                    const domWidgetName = domEl.getAttribute('data-widget-name');
                    if (domWidgetName === widgetName) {
                        // Found exact match, replace old element with new one
                        console.log('[WaveSpeed DEBUG] Replacing DOM element for widget:', widgetName);
                        widgetDOMDiv.replaceChildren(widget.element);
                        break;
                    }
                }
            }
        }

        // Update model selector and category tabs state based on connection status
        const inputsModule = await import('./predictor/inputs.js');
        inputsModule.updateModelSelectorByConnectionState(node);

        // Force canvas redraw to ensure input slots are rendered
        if (node.graph) {
            node.graph.setDirtyCanvas(true, true);
        }

    } catch (error) {
        console.error('[WaveSpeed Predictor] Error loading model parameters:', error);
    }
}


// Restore input connections after model parameters are fully loaded
function restoreInputConnections(node) {
    const savedInputs = node._wavespeed_savedData?.savedInputs;
    if (!savedInputs || !node.inputs) {
        return;
    }

    for (const saved of savedInputs) {
        if (saved.link == null) continue;

        const input = node.inputs.find(inp => inp.name === saved.name);
        if (!input) {
            continue;
        }
        
        const linkExists = node.graph?.links?.[saved.link];
        if (linkExists) {
            input.link = saved.link;
        }
    }
}

// Configure workflow save/restore support
function configureWorkflowSupport(node) {
    // Setup user save detection
    if (!window._wavespeedSaveListenerAdded) {
        window._wavespeedSaveListenerAdded = true;

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                const graph = app.graph;
                if (graph && graph._nodes) {
                    for (const n of graph._nodes) {
                        if (n.comfyClass === 'WaveSpeedAIPredictor') {
                            n._userSaving = true;
                        }
                    }
                }
            }
        }, true);
    }

    // Override configure method to restore state
    const originalConfigure = node.configure;
    node.configure = function(data) {
        // Call original configure first to let ComfyUI restore basic structure
        if (originalConfigure) {
            originalConfigure.call(this, data);
        }

        // Restore our custom metadata and link info
        if (data.wavespeed && data.wavespeed.savedInputs) {

            // Match saved input metadata with actual inputs created by ComfyUI
            for (const savedInput of data.wavespeed.savedInputs) {
                // Find the corresponding input by name
                const input = this.inputs?.find(inp => inp.name === savedInput.name);
                if (input) {
                    // Restore custom flags
                    input._wavespeed_dynamic = true;
                    input._wavespeed_param = savedInput.name;

                    // Restore link if it was saved
                    if (savedInput.link != null) {
                        input.link = savedInput.link;
                    }

                    // Restore array metadata
                    if (savedInput.isExpandedArrayItem) {
                        input._wavespeed_expanded_array_item = true;
                        input._wavespeed_parent_array = savedInput.parentArray;
                        input._wavespeed_array_index = savedInput.arrayIndex;
                    }
                }
            }

            // Mark as restoring to preserve inputs in initializePredictorWidgets
            this._isRestoring = true;

            // Temporarily remove input.widget to prevent onGraphConfigured from deleting inputs
            // Save widget references and remove them before onGraphConfigured executes
            if (this.inputs) {
                for (const input of this.inputs) {
                    if (input._wavespeed_dynamic && input.widget) {
                        // Save widget reference for later restoration
                        input._savedWidget = input.widget;
                        // Remove widget to prevent onGraphConfigured from deleting this input
                        delete input.widget;
                    }
                }
            }
        }

        // Store workflow data for restore
        if (data.wavespeed) {
            this._wavespeed_savedData = data.wavespeed;

            // Pre-initialize wavespeedState to prevent early serialize from saving empty data
            if (!this.wavespeedState) {
                this.wavespeedState = {
                    modelId: "",
                    apiPath: "",
                    category: "",
                    categoryList: [],
                    modelList: [],
                    parameters: [],
                    parameterValues: {},
                    isUpdatingCategory: false,
                    isUpdatingModel: false,
                    lastCategoryValue: "",
                    lastModelValue: "",
                    requestSequence: 0
                };
            }

            // Restore state from JSON to wavespeedState
            this.wavespeedState.modelId = data.wavespeed.modelId || "";
            this.wavespeedState.apiPath = data.wavespeed.apiPath || "";
            this.wavespeedState.category = data.wavespeed.category || "all";
            this.wavespeedState.currentCategory = data.wavespeed.category || "all";

            if (data.wavespeed.parameterValues && Object.keys(data.wavespeed.parameterValues).length > 0) {
                this.wavespeedState.parameterValues = { ...data.wavespeed.parameterValues };
            }
        }

        // Save snapshot of restored inputs for verification
        if (this._isRestoring && this.inputs) {
            this._restoredInputs = this.inputs.map(inp => ({
                name: inp.name,
                type: inp.type,
                link: inp.link,
                _wavespeed_dynamic: inp._wavespeed_dynamic,
                _wavespeed_param: inp._wavespeed_param,
                _wavespeed_expanded_array_item: inp._wavespeed_expanded_array_item,
                _wavespeed_parent_array: inp._wavespeed_parent_array,
                _wavespeed_array_index: inp._wavespeed_array_index
            }));
        }

    };


    // Override serialize method to save state
    const originalSerialize = node.serialize;
    node.serialize = function() {
        // Check if inputs were modified during restoration
        if (this._isRestoring && this._restoredInputs) {
            const currentInputs = this.inputs?.length || 0;
            const expectedInputs = this._restoredInputs.length;
            const currentLinked = this.inputs?.filter(i => i.link != null).length || 0;
            const expectedLinked = this._restoredInputs.filter(i => i.link != null).length;

            if (currentInputs !== expectedInputs || currentLinked !== expectedLinked) {
                // Try to restore from snapshot
                if (this.inputs) {
                    for (const savedInput of this._restoredInputs) {
                        const existing = this.inputs.find(i => i.name === savedInput.name);
                        if (existing) {
                            if (savedInput.link != null && existing.link == null) {
                                existing.link = savedInput.link;
                            }
                            existing._wavespeed_dynamic = savedInput._wavespeed_dynamic;
                            existing._wavespeed_param = savedInput._wavespeed_param;
                        }
                    }
                }
            }
        }

        // Clean up stale links ONLY when user explicitly saves (Ctrl+S)
        if (this._userSaving && this.graph && this.graph.links && this.inputs) {
            // Build set of valid link IDs from current inputs
            const validLinkIds = new Set();
            for (const input of this.inputs) {
                if (input.link != null) {
                    validLinkIds.add(input.link);
                }
            }

            // Find and remove stale links from graph.links
            const linksToRemove = [];
            for (const [linkId, link] of Object.entries(this.graph.links)) {
                if (link && link.target_id === this.id) {
                    if (!validLinkIds.has(parseInt(linkId))) {
                        linksToRemove.push(parseInt(linkId));
                    }
                }
            }

            // Remove stale links using LiteGraph API
            for (const linkId of linksToRemove) {
                if (this.graph.removeLink) {
                    this.graph.removeLink(linkId);
                }
            }

            // Reset flag after cleanup
            this._userSaving = false;
        }

        const data = originalSerialize ? originalSerialize.call(this) : {};

        // Sync data.inputs with actual UI connection state
        if (this.inputs && this.inputs.length > 0) {
            // Ensure data.inputs exists
            if (!data.inputs) {
                data.inputs = [];
            }

            // Sync each input slot's connection state
            for (let i = 0; i < this.inputs.length; i++) {
                const input = this.inputs[i];

                // Ensure data.inputs[i] exists
                if (!data.inputs[i]) {
                    data.inputs[i] = {
                        name: input.name,
                        type: input.type
                    };
                }

                // Sync link with actual UI state
                data.inputs[i].link = input.link != null ? input.link : null;

                // Sync widget association
                if (input.widget) {
                    data.inputs[i].widget = { name: input.widget.name };
                }
            }
        }

        // Save WaveSpeed state
        data.wavespeed = {
            modelId: this.wavespeedState?.modelId || "",
            apiPath: this.wavespeedState?.apiPath || "",
            category: this.wavespeedState?.currentCategory || "all",
            parameterValues: this.wavespeedState?.parameterValues || {},
            requestJsonValue: this.requestJsonWidget?.value || "{}"
        };

        // Save input slot info for connection restore (including link info)
        // If restoring and savedInputs exist, preserve original data
        if (this._isRestoring && this._wavespeed_savedData?.savedInputs) {
            // Use original savedInputs during restoration to avoid saving incomplete data
            data.wavespeed.savedInputs = this._wavespeed_savedData.savedInputs;
        } else if (this.inputs && this.inputs.length > 0) {
            // Normal case: generate savedInputs from current inputs
            data.wavespeed.savedInputs = this.inputs
                .filter(inp => inp._wavespeed_dynamic)
                .map(inp => ({
                    name: inp.name,
                    type: inp.type,
                    link: inp.link != null ? inp.link : null,
                    isExpandedArrayItem: inp._wavespeed_expanded_array_item,
                    parentArray: inp._wavespeed_parent_array,
                    arrayIndex: inp._wavespeed_array_index
                }));
        }

        return data;
    };
    
}

// Restore workflow data
async function restoreWorkflowData(node, apiModule) {
    const saved = node._wavespeed_savedData;
    if (!saved || !saved.modelId) {
        return;
    }
    
    try {
        const utilsModule = await import('./predictor/utils.js');

        // 1. Restore category selection
        if (saved.category && node._categoryTabsWrapper) {
            node.wavespeedState.currentCategory = saved.category;
            
            // Update category tabs visual state
            const tabs = node._categoryTabsWrapper.querySelectorAll('button');
            tabs.forEach(tab => {
                const isActive = tab.dataset.value === saved.category;
                tab.classList.toggle('active', isActive);
                tab.style.backgroundColor = isActive ? '#4a9eff' : '#2a2a2a';
                tab.style.color = isActive ? 'white' : '#e0e0e0';
                tab.style.borderColor = isActive ? '#4a9eff' : '#444';
            });
        }

        // Ensure model list matches the restored category
        await utilsModule.filterModels(node);
        
        // 2. Find and set model selector value
        let displayValue = saved.modelId;
        if (node._fuzzyModelSelector && node.wavespeedState.allModels) {
            const modelData = node.wavespeedState.allModels.find(m =>
                m.value === saved.modelId || m.name === saved.modelId
            );

            if (modelData) {
                displayValue = saved.category === 'all'
                    ? `${modelData.categoryName} > ${modelData.name}`
                    : modelData.name;

                // Set selector display value (without triggering callback)
                node._fuzzyModelSelector.setValueWithoutCallback(displayValue);
            }
        }

        // 3. Restore parameterValues BEFORE loadModelParameters
        if (saved.parameterValues && Object.keys(saved.parameterValues).length > 0) {
            node.wavespeedState.parameterValues = { ...saved.parameterValues };
        }

        // 4. Load model parameters (use display value, loadModelParameters will parse actual modelId)
        // Pass isRestoring=true to keep existing input slots and preserve parameterValues
        await loadModelParameters(node, displayValue, apiModule, true);

        // 5. Update widgets with restored values (in case some weren't created with correct values)
        if (saved.parameterValues && Object.keys(saved.parameterValues).length > 0) {
            // Wait a short time to ensure widgets are created
            await new Promise(resolve => setTimeout(resolve, 100));

            for (const [paramName, paramValue] of Object.entries(saved.parameterValues)) {
                // Find and update widget
                const widget = node.widgets?.find(w => w._wavespeed_param === paramName);
                if (widget) {
                    // Get current value (use getValue if available for object array items)
                    const currentValue = widget.getValue ? widget.getValue() : widget.value;
                    if (currentValue !== paramValue) {
                        // Only update if value is different
                        if (widget.restoreValue && typeof widget.restoreValue === 'function') {
                            widget.restoreValue(paramValue);
                        } else if (widget.setValue && typeof widget.setValue === 'function') {
                            widget.setValue(paramValue);
                        } else {
                            try {
                                widget.value = paramValue;
                            } catch (e) {
                                console.warn(`[WaveSpeed Predictor] Could not set value for widget ${paramName}:`, e);
                            }
                        }
                    }
                }
            }

            // Update request JSON
            updateRequestJson(node);
        }

        // 5.1. Restore input connections after all parameters and widgets are restored
        restoreInputConnections(node);

        // 5.2. Update model selector state after restoring connections
        const inputsModule = await import('./predictor/inputs.js');
        inputsModule.updateModelSelectorByConnectionState(node);

        // 5.3. Update widget editability based on connection state
        // This ensures that widgets are properly disabled/enabled after workflow restore
        if (node.inputs) {
            for (const input of node.inputs) {
                if (input._wavespeed_dynamic) {
                    inputsModule.updateSingleMediaWidgetEditability(node, input.name);
                }
            }
        }

        // 6. Update node size
        node.setSize(node.computeSize());
        if (node.graph) {
            node.graph.setDirtyCanvas(true, true);
        }

    } catch (error) {
        console.error('[WaveSpeed Predictor] Error restoring workflow data:', error);
    } finally {
        // Clear restoration flags and saved data
        delete node._wavespeed_savedData;
        delete node._isRestoring;
        delete node._restoredInputs;
    }
}
