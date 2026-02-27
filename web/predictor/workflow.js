/**
 * WaveSpeed Predictor - Workflow save and restore module
 * 
 * This module handles workflow save/restore functionality for the WaveSpeed Predictor node.
 * It manages serialization of node state and restoration of connections and parameter values.
 */

/**
 * Restore input connections after model parameters are fully loaded
 * 
 * This function restores the link connections between nodes that were saved in the workflow.
 * It matches saved input metadata with actual inputs and restores the link IDs.
 * 
 * @param {Object} node - The LiteGraph node instance
 */
export function restoreInputConnections(node) {
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


/**
 * Configure node to support workflow save/restore
 * 
 * This function sets up the node's configure() and serialize() methods to handle
 * workflow save/restore operations. It manages:
 * - User save detection (Ctrl+S)
 * - Input connection restoration
 * - Parameter value restoration
 * - State serialization
 * 
 * @param {Object} node - The LiteGraph node instance
 * @param {Object} app - The ComfyUI app instance
 */
export function configureWorkflowSupport(node, app) {
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

            // Restore fixed input connections (e.g., client)
            if (data.wavespeed.fixedInputs) {
                for (const savedFixed of data.wavespeed.fixedInputs) {
                    const input = this.inputs?.find(inp => inp.name === savedFixed.name);
                    if (input) {
                        input._wavespeed_fixed = true;
                        if (savedFixed.link != null) {
                            input.link = savedFixed.link;
                        }
                    }
                }
            }

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

        // Save fixed input connections (e.g., client)
        if (this.inputs && this.inputs.length > 0) {
            data.wavespeed.fixedInputs = this.inputs
                .filter(inp => inp._wavespeed_fixed)
                .map(inp => ({
                    name: inp.name,
                    type: inp.type,
                    link: inp.link != null ? inp.link : null
                }));
        }

        return data;
    };
}
