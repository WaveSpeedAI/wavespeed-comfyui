/**
 * WaveSpeed Predictor - Input slot management module
 */

import { getMediaType, getOriginalApiType, isSizeParameter } from './parameters.js';
import { createMediaWidgetUI } from './widgets.js';

// Configure connection change handlers for a node
export function configureConnectionHandlers(node) {
    // Save original onConnectionsChange method
    const originalOnConnectionsChange = node.onConnectionsChange;

    node.onConnectionsChange = function(type, slotIndex, isConnected, link, ioSlot) {
        // Call original method
        if (originalOnConnectionsChange) {
            originalOnConnectionsChange.apply(this, arguments);
        }

        // Handle input connection changes
        if (type === LiteGraph.INPUT) {
            const input = this.inputs?.[slotIndex];
            if (input && input._wavespeed_dynamic) {
                // Check if this is a size parameter component (width or height)
                if (input._wavespeed_size_component) {
                    // Update size widget editability
                    updateSizeWidgetEditability(this, input._wavespeed_param);
                } else {
                    // Find the widget for this input
                    const widget = this.widgets?.find(w => w._wavespeed_param === input.name);
                    if (widget) {
                        // Check widget type and call appropriate update function
                        if (widget.uploadBtn || widget.previewContainer) {
                            // Media widget
                            updateSingleMediaWidgetEditability(this, input.name);
                        } else if (widget._wavespeed_seed) {
                            // Seed widget (has multiple controls)
                            updateSeedWidgetEditability(this, input.name);
                        } else if (widget.inputEl) {
                            // General widget (COMBO, INT, FLOAT, BOOLEAN, TEXT, prompt)
                            updateGeneralWidgetEditability(this, input.name);
                        }
                    }
                }
            }

            // Update model selector and category tabs state based on connection status
            updateModelSelectorByConnectionState(this);
        }
    };

    // Save original onConnectInput to check if input can be connected
    const originalOnConnectInput = node.onConnectInput;

    node.onConnectInput = function(inputIndex, outputType, outputSlot, outputNode, outputIndex) {
        const input = this.inputs?.[inputIndex];

        console.log('[WaveSpeed] onConnectInput called:', {
            inputIndex,
            inputName: input?.name,
            outputType,
            hasInput: !!input,
            isDynamic: input?._wavespeed_dynamic
        });

        // ONLY check for media parameters with value (not general parameters like seed/prompt)
        // Media parameters should not be connected if they already have a file/URL value
        if (input && input._wavespeed_dynamic) {
            const widget = this.widgets?.find(w => w._wavespeed_param === input.name);
            // Check if this is a media widget (has uploadBtn or previewContainer)
            const isMediaWidget = widget && (widget.uploadBtn || widget.previewContainer);
            
            if (isMediaWidget && widget.inputEl) {
                const hasValue = widget.inputEl.value && widget.inputEl.value.trim() !== '';
                if (hasValue) {
                    // Prevent connection when media input has value
                    console.log('[WaveSpeed Predictor] Cannot connect media parameter: input has value');
                    return false;
                }
            }
        }

        // Call original method
        if (originalOnConnectInput) {
            return originalOnConnectInput.apply(this, arguments);
        }

        return true;
    };
}

// Get ComfyUI input type
function getComfyInputType(param) {
    const typeMap = {
        'STRING': 'STRING',
        'INT': 'INT',
        'FLOAT': 'FLOAT',
        'BOOLEAN': 'BOOLEAN',
        'LORA_WEIGHT': 'WAVESPEED_LORAS',
    };

    if (param.isArray) {
        return '*';
    }

    return typeMap[param.type] || '*';
}

// Update dynamic inputs
export function updateDynamicInputs(node, parameters) {
    console.log('[WaveSpeed DEBUG] updateDynamicInputs called with parameters:', parameters?.map(p => p.name));

    if (!parameters || parameters.length === 0) {
        console.log('[WaveSpeed DEBUG] updateDynamicInputs: No parameters, returning early');
        return;
    }

    // Remove all existing dynamic inputs (keep Client and array members)
    for (let i = node.inputs.length - 1; i >= 0; i--) {
        const input = node.inputs[i];
        if (input.name !== 'Client' && !input._wavespeed_array_member) {
            node.removeInput(i);
        }
    }

    // Create connectable input for each parameter
    for (let i = 0; i < parameters.length; i++) {
        const param = parameters[i];
        console.log('[WaveSpeed DEBUG] Processing parameter:', param.name, 'isSizeParameter:', isSizeParameter(param.name));

        // Special handling for size parameters: create width and height inputs instead
        if (isSizeParameter(param.name)) {
            console.log('[WaveSpeed] Detected size parameter:', param.name, '- creating width/height inputs');

            // Create width input
            const widthInput = node.addInput(`${param.name}_width`, 'INT');
            if (widthInput) {
                widthInput._wavespeed_dynamic = true;
                widthInput._wavespeed_param = param.name;
                widthInput._wavespeed_size_component = 'width';
                widthInput._wavespeed_parent_size = param.name;
                widthInput._wavespeed_size_index = 0;
                widthInput.label = 'Width';
            }

            // Create height input
            const heightInput = node.addInput(`${param.name}_height`, 'INT');
            if (heightInput) {
                heightInput._wavespeed_dynamic = true;
                heightInput._wavespeed_param = param.name;
                heightInput._wavespeed_size_component = 'height';
                heightInput._wavespeed_parent_size = param.name;
                heightInput._wavespeed_size_index = 1;
                heightInput.label = 'Height';
            }
        } else {
            // Normal parameter: create single input
            let inputType = getComfyInputType(param);

            const input = node.addInput(param.name, inputType);
            if (input) {
                input._wavespeed_dynamic = true;
                input._wavespeed_param = param.name;
            }
        }
    }

    clearLiteGraphCaches(node);
    forceNodeRefresh(node);
}

// Setup single media parameters
export function setupSingleMediaParameters(node, mediaParams) {
    console.log('[WaveSpeed DEBUG] Setting up single media parameters:', mediaParams);

    for (const param of mediaParams) {
        try {
            const paramName = param.name;
            const mediaType = getMediaType(paramName, getOriginalApiType(param));
            const displayName = param.displayName || paramName;

            console.log('[WaveSpeed DEBUG] Creating media param:', paramName, 'type:', mediaType);

            // 1. Create input slot
            const input = node.addInput(paramName, '*');
            if (input) {
                input._wavespeed_dynamic = true;
                input._wavespeed_param = paramName;
                input.label = displayName;
                // Set label offset for non-array media params (20px for title row)
                input._wavespeed_label_offset = 20;
            }

            // 2. Use common UI creation function
            const { widget, textarea } = createMediaWidgetUI(node, param, mediaType, displayName, paramName);

            // 3. Link input and widget
            if (input) {
                input.widget = widget;
                widget.linkedInput = input;
            }

            // 4. Confirm link
            const inputIndex = node.inputs?.findIndex(inp => inp.name === paramName);
            if (inputIndex !== -1 && inputIndex !== undefined) {
                const inputSlot = node.inputs[inputIndex];
                inputSlot.widget = widget;
                console.log('[WaveSpeed DEBUG] Second link confirmed for:', paramName, 'at index:', inputIndex);
            }

            // 5. Update editability
            requestAnimationFrame(() => {
                updateSingleMediaWidgetEditability(node, paramName);
            });

            // 6. Force node resize
            node.setSize(node.computeSize());
            if (node.graph) {
                node.graph.setDirtyCanvas(true, true);
            }

            console.log('[WaveSpeed DEBUG] Successfully created single media parameter:', paramName);
        } catch (error) {
            console.error('[WaveSpeed DEBUG] Error creating media parameter:', param.name, error);
        }
    }
}

// Update single media widget editability
export function updateSingleMediaWidgetEditability(node, paramName) {
    const widget = node.widgets?.find(w => w._wavespeed_param === paramName);
    if (!widget) return;

    const inputSlot = node.inputs?.find(inp => inp.name === paramName);
    const hasConnection = inputSlot && inputSlot.link != null;

    if (hasConnection) {
        // Has connection: disable editing
        if (widget.inputEl) {
            widget.inputEl.disabled = true;
            widget.inputEl.style.opacity = '0.5';
            widget.inputEl.style.cursor = 'not-allowed';
            widget.inputEl.placeholder = '[Connected]';
        }

        if (widget.uploadBtn) {
            widget.uploadBtn.disabled = true;
            widget.uploadBtn.style.opacity = '0.5';
            widget.uploadBtn.style.cursor = 'not-allowed';
        }

        if (widget.previewContainer) {
            const previews = widget.previewContainer.querySelectorAll('div');
            previews.forEach(preview => {
                if (preview.deleteBtn) {
                    preview.deleteBtn.style.display = 'none';
                }
                if (preview.onClickHandler) {
                    preview.onclick = null;
                }
                preview.style.cursor = 'default';
            });
        }
    } else {
        // No connection: enable editing
        if (widget.inputEl) {
            widget.inputEl.disabled = false;
            widget.inputEl.style.opacity = '1';
            widget.inputEl.style.cursor = 'text';
            widget.inputEl.placeholder = widget.inputEl.getAttribute('data-original-placeholder') || `Enter ${paramName.toLowerCase()}...`;
        }

        if (widget.uploadBtn) {
            widget.uploadBtn.disabled = false;
            widget.uploadBtn.style.opacity = '1';
            widget.uploadBtn.style.cursor = 'pointer';
        }

        if (widget.previewContainer) {
            const previews = widget.previewContainer.querySelectorAll('div');
            previews.forEach(preview => {
                if (preview.deleteBtn) {
                    preview.deleteBtn.style.display = '';
                }
                if (preview.onClickHandler) {
                    preview.onclick = preview.onClickHandler;
                }
                preview.style.cursor = 'pointer';
            });
        }
    }
}

// Update general widget editability (for non-media widgets like COMBO, INT, FLOAT, BOOLEAN, TEXT)
export function updateGeneralWidgetEditability(node, paramName) {
    const widget = node.widgets?.find(w => w._wavespeed_param === paramName);
    if (!widget) return;

    const inputSlot = node.inputs?.find(inp => inp.name === paramName);
    const hasConnection = inputSlot && inputSlot.link != null;

    // Get the input element (could be select, input, checkbox, etc.)
    const inputEl = widget.inputEl;
    if (!inputEl) return;

    if (hasConnection) {
        // Has connection: disable editing
        inputEl.disabled = true;
        inputEl.style.opacity = '0.5';
        inputEl.style.cursor = 'not-allowed';
        
        // Add visual indicator
        if (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') {
            inputEl.setAttribute('data-original-placeholder', inputEl.placeholder || '');
            inputEl.placeholder = '[Connected]';
        }
    } else {
        // No connection: enable editing
        inputEl.disabled = false;
        inputEl.style.opacity = '1';
        
        // Restore cursor based on element type
        if (inputEl.tagName === 'SELECT') {
            inputEl.style.cursor = 'pointer';
        } else if (inputEl.tagName === 'INPUT' && inputEl.type === 'checkbox') {
            inputEl.style.cursor = 'pointer';
        } else {
            inputEl.style.cursor = 'text';
        }
        
        // Restore placeholder
        if (inputEl.tagName === 'INPUT' || inputEl.tagName === 'TEXTAREA') {
            const originalPlaceholder = inputEl.getAttribute('data-original-placeholder');
            if (originalPlaceholder) {
                inputEl.placeholder = originalPlaceholder;
            }
        }
    }
}

// Update seed widget editability (seed has multiple controls: input, mode select, random button)
export function updateSeedWidgetEditability(node, paramName) {
    const widget = node.widgets?.find(w => w._wavespeed_param === paramName);
    if (!widget || !widget._wavespeed_seed) return;

    const inputSlot = node.inputs?.find(inp => inp.name === paramName);
    const hasConnection = inputSlot && inputSlot.link != null;

    // Get all seed controls
    const seedInput = widget.inputEl || widget._seedInput;
    const modeSelect = widget._modeSelect;
    
    // Find random button (it's a sibling of seedInput in the container)
    let randomBtn = null;
    if (seedInput && seedInput.parentElement) {
        randomBtn = Array.from(seedInput.parentElement.children).find(el => 
            el.tagName === 'BUTTON' && el.textContent.includes('🎲')
        );
    }

    if (hasConnection) {
        // Has connection: disable all controls
        if (seedInput) {
            seedInput.disabled = true;
            seedInput.style.opacity = '0.5';
            seedInput.style.cursor = 'not-allowed';
            seedInput.setAttribute('data-original-placeholder', seedInput.placeholder || '');
            seedInput.placeholder = '[Connected]';
        }
        if (modeSelect) {
            modeSelect.disabled = true;
            modeSelect.style.opacity = '0.5';
            modeSelect.style.cursor = 'not-allowed';
        }
        if (randomBtn) {
            randomBtn.disabled = true;
            randomBtn.style.opacity = '0.5';
            randomBtn.style.cursor = 'not-allowed';
        }
    } else {
        // No connection: enable all controls
        if (seedInput) {
            seedInput.disabled = false;
            seedInput.style.opacity = '1';
            seedInput.style.cursor = 'text';
            const originalPlaceholder = seedInput.getAttribute('data-original-placeholder');
            if (originalPlaceholder) {
                seedInput.placeholder = originalPlaceholder;
            }
        }
        if (modeSelect) {
            modeSelect.disabled = false;
            modeSelect.style.opacity = '1';
            modeSelect.style.cursor = 'pointer';
        }
        if (randomBtn) {
            randomBtn.disabled = false;
            randomBtn.style.opacity = '1';
            randomBtn.style.cursor = 'pointer';
        }
    }
}

// Update size widget editability based on width/height connection state
export function updateSizeWidgetEditability(node, paramName) {
    // For size component widgets, we need to update BOTH width and height widgets
    // because they share the ratio buttons state
    
    // Extract parent size name from component name (e.g., "size_width" -> "size")
    const parentSizeName = paramName.replace(/_width$|_height$/, '');
    
    // Find both width and height widgets
    const widthWidget = node.widgets?.find(w => w.name === `${parentSizeName}_width`);
    const heightWidget = node.widgets?.find(w => w.name === `${parentSizeName}_height`);
    
    // Update both widgets if they have updateConnectionState method
    if (widthWidget && widthWidget.updateConnectionState) {
        widthWidget.updateConnectionState();
    }
    if (heightWidget && heightWidget.updateConnectionState) {
        heightWidget.updateConnectionState();
    }
    
    // If we updated the new widgets, we're done
    if ((widthWidget && widthWidget.updateConnectionState) || (heightWidget && heightWidget.updateConnectionState)) {
        return;
    }
    
    // Legacy: For old size widget (single widget with embedded inputs)
    const widget = node.widgets?.find(w => w._wavespeed_param === parentSizeName);
    if (!widget || !widget._wavespeed_size) return;

    // Find width and height input slots
    const widthInput = node.inputs?.find(inp => inp.name === `${parentSizeName}_width`);
    const heightInput = node.inputs?.find(inp => inp.name === `${parentSizeName}_height`);

    const widthConnected = widthInput && widthInput.link != null;
    const heightConnected = heightInput && heightInput.link != null;
    const anyConnected = widthConnected || heightConnected;

    // Get UI elements from widget
    const widthInputEl = widget._widthInput;
    const heightInputEl = widget._heightInput;
    const ratioButtons = widget._ratioButtons || [];

    // Disable ratio buttons if any connection exists
    ratioButtons.forEach(btn => {
        if (anyConnected) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });

    // Disable width input if width is connected
    if (widthInputEl) {
        if (widthConnected) {
            widthInputEl.disabled = true;
            widthInputEl.style.opacity = '0.5';
            widthInputEl.style.cursor = 'not-allowed';
            widthInputEl.placeholder = '[Connected]';
        } else {
            widthInputEl.disabled = false;
            widthInputEl.style.opacity = '1';
            widthInputEl.style.cursor = 'text';
            widthInputEl.placeholder = '';
        }
    }

    // Disable height input if height is connected
    if (heightInputEl) {
        if (heightConnected) {
            heightInputEl.disabled = true;
            heightInputEl.style.opacity = '0.5';
            heightInputEl.style.cursor = 'not-allowed';
            heightInputEl.placeholder = '[Connected]';
        } else {
            heightInputEl.disabled = false;
            heightInputEl.style.opacity = '1';
            heightInputEl.style.cursor = 'text';
            heightInputEl.placeholder = '';
        }
    }
}

// Check if there are dynamic connections
export function hasDynamicConnections(node) {
    if (!node.inputs) return false;

    for (let i = 0; i < node.inputs.length; i++) {
        const input = node.inputs[i];
        if (input._wavespeed_fixed) continue;
        if (input.link != null) {
            return true;
        }
    }
    return false;
}

// Get list of connected input names
export function getConnectedInputNames(node) {
    if (!node.inputs) return [];

    const connected = [];
    for (let i = 0; i < node.inputs.length; i++) {
        const input = node.inputs[i];
        if (input._wavespeed_fixed) continue;
        if (input.link != null) {
            connected.push(input.name);
        }
    }
    return connected;
}

// Disconnect all dynamic input connections
export function disconnectAllDynamicInputs(node) {
    if (!node.inputs) return 0;

    let disconnectedCount = 0;
    const disconnectedNames = [];

    node._skipConnectionUpdates = true;

    for (let i = node.inputs.length - 1; i >= 0; i--) {
        const input = node.inputs[i];
        if (input._wavespeed_fixed) continue;
        if (input.link != null) {
            disconnectedNames.push(input.name);
            node.disconnectInput(i);
            disconnectedCount++;
        }
    }

    node._skipConnectionUpdates = false;

    if (disconnectedCount > 0) {
        console.log(`[WaveSpeed] Auto-disconnected ${disconnectedCount} inputs for model switch:`, disconnectedNames.join(', '));
    }

    return disconnectedCount;
}

// Clear LiteGraph internal caches
export function clearLiteGraphCaches(node) {
    if (node._slot_positions_cache) {
        delete node._slot_positions_cache;
    }
    if (node._input_positions) {
        delete node._input_positions;
    }
    if (node._output_positions) {
        delete node._output_positions;
    }
    if (node._cached_size) {
        delete node._cached_size;
    }

    if (node.graph) {
        if (node.graph._nodes_order) {
            delete node.graph._nodes_order;
        }
    }
}

// Force complete node refresh
export function forceNodeRefresh(node) {
    if (node.computeSize) {
        const newSize = node.computeSize();
        node.setSize(newSize);
    }

    if (node.setDirtyCanvas) {
        node.setDirtyCanvas(true, true);
    }

    if (node.graph) {
        node.graph.setDirtyCanvas(true, true);

        if (node.graph.canvas) {
            node.graph.canvas.draw(true, true);
        }
    }

    requestAnimationFrame(() => {
        clearLiteGraphCaches(node);

        if (node.computeSize) {
            node.setSize(node.computeSize());
        }

        if (node.graph) {
            node.graph.setDirtyCanvas(true, true);
            if (node.graph.canvas) {
                node.graph.canvas.draw(true, true);
            }
        }
    });
}

// Update model selector and category tabs state based on connection status
export function updateModelSelectorByConnectionState(node) {
    const hasConnections = hasDynamicConnections(node);
    const connectedInputs = getConnectedInputNames(node);

    if (hasConnections) {
        // Disable fuzzy model selector
        if (node._fuzzyModelSelector && node._fuzzyModelSelector.input) {
            const shortList = connectedInputs.slice(0, 2).join(', ');
            const more = connectedInputs.length > 2 ? ` +${connectedInputs.length - 2}` : '';

            node._fuzzyModelSelector.input.disabled = true;
            node._fuzzyModelSelector.input.style.opacity = '0.6';
            node._fuzzyModelSelector.input.style.cursor = 'not-allowed';
            node._fuzzyModelSelector.input.title = `Cannot switch model - parameters connected:\n${connectedInputs.join(', ')}\n\nDisconnect them first to change model.`;

            // Update placeholder to show lock state
            const currentPlaceholder = node._fuzzyModelSelector.input.placeholder;
            if (!currentPlaceholder.includes('🔒')) {
                node._fuzzyModelSelector.input.setAttribute('data-original-placeholder', currentPlaceholder);
                node._fuzzyModelSelector.input.placeholder = `🔒 Locked (${shortList}${more})`;
            }
        }

        // Disable category tabs
        if (node._categoryTabsWrapper) {
            const tabs = node._categoryTabsWrapper.querySelectorAll('button');
            tabs.forEach(tab => {
                tab.disabled = true;
                tab.style.opacity = '0.6';
                tab.style.cursor = 'not-allowed';
                tab.title = `Cannot switch category - parameters connected:\n${connectedInputs.join(', ')}\n\nDisconnect them first to change category.`;
            });
        }
    } else {
        // Enable fuzzy model selector
        if (node._fuzzyModelSelector && node._fuzzyModelSelector.input) {
            node._fuzzyModelSelector.input.disabled = false;
            node._fuzzyModelSelector.input.style.opacity = '1';
            node._fuzzyModelSelector.input.style.cursor = 'pointer';
            node._fuzzyModelSelector.input.title = '';

            // Restore original placeholder
            const originalPlaceholder = node._fuzzyModelSelector.input.getAttribute('data-original-placeholder');
            if (originalPlaceholder) {
                node._fuzzyModelSelector.input.placeholder = originalPlaceholder;
                node._fuzzyModelSelector.input.removeAttribute('data-original-placeholder');
            }
        }

        // Enable category tabs
        if (node._categoryTabsWrapper) {
            const tabs = node._categoryTabsWrapper.querySelectorAll('button');
            tabs.forEach(tab => {
                tab.disabled = false;
                tab.style.opacity = '1';
                tab.style.cursor = 'pointer';
                tab.title = '';
            });
        }
    }
}
