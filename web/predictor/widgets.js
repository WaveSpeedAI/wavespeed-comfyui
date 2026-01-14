/**
 * WaveSpeed Predictor - Widget creation and management module
 */

import { getMediaType, getOriginalApiType } from './parameters.js';
import { createFilePreview, createLoadingPreview, createErrorPreview, createUploadButton, uploadToWaveSpeed } from './media.js';
import { 
    showSizeToast,
    createComboDomWidget,
    createToggleDomWidget,
    createNumberDomWidget,
    createTextDomWidget
} from './dom_widgets.js';

// Helper: Create options for textarea-based DOM widgets (for ComfyUI auto-serialization)
function textareaOptions(getTextarea, onSet) {
    return {
        getValue: () => getTextarea().value,
        setValue: (v) => {
            const textarea = getTextarea();
            if (textarea) {
                textarea.value = v || '';
                if (onSet) onSet(v);
            }
        }
    };
}

// Universal restoreValue helper - creates a standardized restore function for widgets
// This ensures all DOM widgets use the same restoration mechanism
function createRestoreValueFn(node, param, customRestoreLogic) {
    return function(value) {
        if (value === undefined || value === null) return;

        // 1. Update parameterValues (state)
        node.wavespeedState.parameterValues[param.name] = value;

        // 2. Execute widget-specific restore logic (update UI)
        if (customRestoreLogic) {
            customRestoreLogic.call(this, value);
        }

        // 3. Update request JSON
        updateRequestJson(node);
    };
}

// Create label element (with required marker)
function createLabelWithRequired(text, isRequired, description) {
    const labelContainer = document.createElement('span');
    labelContainer.style.display = 'inline-flex';
    labelContainer.style.alignItems = 'center';
    labelContainer.style.gap = '2px';
    
    const labelText = document.createElement('span');
    labelText.textContent = text;
    labelContainer.appendChild(labelText);
    
    if (isRequired) {
        const requiredMark = document.createElement('span');
        requiredMark.textContent = '*';
        requiredMark.style.color = '#ff6b6b';
        requiredMark.style.fontSize = '14px';
        requiredMark.style.fontWeight = 'normal';
        requiredMark.style.marginLeft = '1px';
        requiredMark.style.lineHeight = '1';
        labelContainer.appendChild(requiredMark);
    }
    
    // Add description icon (tooltip)
    if (description) {
        const infoIcon = createInfoTooltip(description);
        labelContainer.appendChild(infoIcon);
    }
    
    return labelContainer;
}

// Create info icon (with tooltip)
function createInfoTooltip(description) {
    const iconContainer = document.createElement('span');
    iconContainer.style.position = 'relative';
    iconContainer.style.display = 'inline-flex';
    iconContainer.style.alignItems = 'center';
    iconContainer.style.marginLeft = '4px';
    iconContainer.style.cursor = 'help';
    
    const icon = document.createElement('span');
    icon.textContent = '?';
    icon.style.display = 'inline-flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.width = '14px';
    icon.style.height = '14px';
    icon.style.fontSize = '10px';
    icon.style.fontWeight = 'bold';
    icon.style.color = '#888';
    icon.style.backgroundColor = 'transparent';
    icon.style.border = '1px solid #666';
    icon.style.borderRadius = '50%';
    icon.style.opacity = '0.8';
    icon.style.transition = 'all 0.2s ease';
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'wavespeed-tooltip';
    tooltip.textContent = description;
    tooltip.style.position = 'fixed';
    tooltip.style.backgroundColor = '#2a2a2a';
    tooltip.style.color = '#e0e0e0';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '11px';
    tooltip.style.lineHeight = '1.4';
    tooltip.style.maxWidth = '280px';
    tooltip.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
    tooltip.style.border = '1px solid #444';
    tooltip.style.zIndex = '999999';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.15s ease';
    tooltip.style.whiteSpace = 'normal';
    tooltip.style.wordWrap = 'break-word';
    
    // Add to body
    document.body.appendChild(tooltip);
    
    // Show on mouse hover
    iconContainer.addEventListener('mouseenter', (e) => {
        icon.style.opacity = '1';
        icon.style.color = '#4a9eff';
        icon.style.borderColor = '#4a9eff';
        
        // Calculate position
        const rect = iconContainer.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;
        
        // Check if exceeds screen right edge
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
        }
        
        tooltip.style.opacity = '1';
    });
    
    // Hide on mouse leave
    iconContainer.addEventListener('mouseleave', () => {
        icon.style.opacity = '0.8';
        icon.style.color = '#888';
        icon.style.borderColor = '#666';
        tooltip.style.opacity = '0';
    });
    
    // Prevent event bubbling
    iconContainer.addEventListener('mousedown', (e) => e.stopPropagation());
    iconContainer.addEventListener('click', (e) => e.stopPropagation());
    
    iconContainer.appendChild(icon);
    
    // Save tooltip reference for cleanup
    iconContainer._tooltip = tooltip;
    
    return iconContainer;
}

// Create description element (deprecated, use tooltip instead)
function createDescriptionElement(description) {
    if (!description) return null;
    
    // Return null, no longer display description text
    // Description is now shown via tooltip on ? icon
    return null;
}

// Size ratio presets
const SIZE_RATIO_PRESETS = [
    { label: '1:1', icon: '□', width: 1024, height: 1024 },
    { label: '16:9', icon: '▭', width: 1344, height: 756 },
    { label: '9:16', icon: '▯', width: 756, height: 1344 },
    { label: '4:3', icon: '□', width: 1152, height: 864 },
    { label: '3:4', icon: '▯', width: 864, height: 1152 },
    { label: '3:2', icon: '▭', width: 1216, height: 832 },
    { label: '2:3', icon: '▯', width: 832, height: 1216 },
];

// Create Size selector widget
export function createSizeWidget(node, param) {
    const container = document.createElement('div');
    container.className = 'wavespeed-size-selector';
    container.setAttribute('data-widget-name', param.name); // For precise DOM matching

    let currentWidth = 1024;
    let currentHeight = 1024;
    let currentRatio = '1:1';
    // CRITICAL FIX: Use API's minimum/maximum constraints, not hardcoded defaults
    // Use !== undefined check instead of || to handle 0 values correctly
    const minSize = param.min !== undefined ? param.min : 256;
    const maxSize = param.max !== undefined ? param.max : 1536;

    // Parse default value or handle x-hidden
    if (param.xHidden === true) {
        // x-hidden: only use API default values, otherwise keep null (empty)
        if (param.default) {
            const match = param.default.match(/(\d+)\s*[*x×]\s*(\d+)/i);
            if (match) {
                currentWidth = parseInt(match[1]);
                currentHeight = parseInt(match[2]);
            } else {
                currentWidth = null;
                currentHeight = null;
            }
        } else {
            currentWidth = null;
            currentHeight = null;
        }
    } else {
        // non x-hidden: use default values or fallback to 1024
        if (param.default) {
            const match = param.default.match(/(\d+)\s*[*x×]\s*(\d+)/i);
            if (match) {
                currentWidth = parseInt(match[1]);
                currentHeight = parseInt(match[2]);
            }
        }
    }

    // Header with title and range (no collapse functionality)
    const header = document.createElement('div');
    header.className = 'wavespeed-size-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    header.style.padding = '8px 10px';
    header.style.backgroundColor = '#2a2a2a';
    header.style.border = '1px solid #444';
    header.style.borderRadius = '4px 4px 0 0';

    const titleLabel = createLabelWithRequired(param.displayName || 'Size', param.required, param.description);
    titleLabel.style.color = '#e0e0e0';
    titleLabel.style.fontSize = '12px';
    titleLabel.style.fontWeight = '500';

    const rangeInfo = document.createElement('span');
    rangeInfo.className = 'wavespeed-size-range';
    rangeInfo.textContent = `Range: ${minSize} - ${maxSize}`;
    rangeInfo.style.marginLeft = 'auto';
    rangeInfo.style.color = '#666';
    rangeInfo.style.fontSize = '11px';

    header.appendChild(titleLabel);
    header.appendChild(rangeInfo);

    // Content area (always expanded)
    const content = document.createElement('div');
    content.className = 'wavespeed-size-content';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '8px';
    content.style.padding = '10px';
    content.style.backgroundColor = '#2a2a2a';
    content.style.border = '1px solid #444';
    content.style.borderTop = 'none';
    content.style.borderRadius = '0 0 4px 4px';
    
    // Ratio buttons row
    const ratioRow = document.createElement('div');
    ratioRow.className = 'wavespeed-size-ratios';
    ratioRow.style.display = 'flex';
    ratioRow.style.flexWrap = 'wrap';
    ratioRow.style.gap = '4px';
    
    const ratioButtons = [];
    SIZE_RATIO_PRESETS.forEach(preset => {
        const btn = document.createElement('button');
        btn.className = 'wavespeed-ratio-btn';
        btn.dataset.ratio = preset.label;
        btn.innerHTML = `<span class="ratio-icon" style="font-size:10px;opacity:0.7;">${preset.icon}</span><span class="ratio-label" style="font-weight:500;">${preset.label}</span>`;
        btn.title = `${preset.width} × ${preset.height}`;
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '4px';
        btn.style.padding = '4px 8px';
        btn.style.backgroundColor = preset.label === currentRatio ? '#4a9eff' : '#2a2a2a';
        btn.style.color = preset.label === currentRatio ? 'white' : '#e0e0e0';
        btn.style.border = '1px solid ' + (preset.label === currentRatio ? '#4a9eff' : '#444');
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '11px';
        btn.style.transition = 'all 0.2s ease';
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectRatio(preset);
        });
        
        btn.addEventListener('mousedown', (e) => e.stopPropagation());
        
        ratioButtons.push(btn);
        ratioRow.appendChild(btn);
    });
    
    // Width row
    const widthRow = document.createElement('div');
    widthRow.className = 'wavespeed-size-width-row';
    widthRow.style.display = 'flex';
    widthRow.style.alignItems = 'center';
    widthRow.style.gap = '8px';
    widthRow.style.padding = '0 10px';

    const widthLabel = document.createElement('label');
    widthLabel.textContent = 'Width';
    widthLabel.style.color = '#888';
    widthLabel.style.fontSize = '11px';
    widthLabel.style.minWidth = '48px';

    const widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.className = 'wavespeed-size-input';
    widthInput.value = currentWidth;
    widthInput.min = minSize;
    widthInput.max = maxSize;
    widthInput.step = 8;
    widthInput.style.flex = '1';
    widthInput.style.padding = '6px 10px';
    widthInput.style.backgroundColor = '#2a2a2a';
    widthInput.style.color = '#e0e0e0';
    widthInput.style.border = '1px solid #444';
    widthInput.style.borderRadius = '4px';
    widthInput.style.fontSize = '13px';
    widthInput.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    widthInput.style.textAlign = 'center';
    widthInput.style.boxSizing = 'border-box';

    widthRow.appendChild(widthLabel);
    widthRow.appendChild(widthInput);

    // Height row
    const heightRow = document.createElement('div');
    heightRow.className = 'wavespeed-size-height-row';
    heightRow.style.display = 'flex';
    heightRow.style.alignItems = 'center';
    heightRow.style.gap = '8px';
    heightRow.style.padding = '0 10px';

    const heightLabel = document.createElement('label');
    heightLabel.textContent = 'Height';
    heightLabel.style.color = '#888';
    heightLabel.style.fontSize = '11px';
    heightLabel.style.minWidth = '48px';

    const heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.className = 'wavespeed-size-input';
    heightInput.value = currentHeight;
    heightInput.min = minSize;
    heightInput.max = maxSize;
    heightInput.step = 8;
    heightInput.style.flex = '1';
    heightInput.style.padding = '6px 10px';
    heightInput.style.backgroundColor = '#2a2a2a';
    heightInput.style.color = '#e0e0e0';
    heightInput.style.border = '1px solid #444';
    heightInput.style.borderRadius = '4px';
    heightInput.style.fontSize = '13px';
    heightInput.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    heightInput.style.textAlign = 'center';
    heightInput.style.boxSizing = 'border-box';

    heightRow.appendChild(heightLabel);
    heightRow.appendChild(heightInput);

    // Assemble content area (removed infoRow with sizeDisplay and rangeInfo)
    content.appendChild(ratioRow);
    content.appendChild(widthRow);
    content.appendChild(heightRow);

    // Assemble container
    container.appendChild(header);
    container.appendChild(content);

    // Event handler functions (removed toggleExpand function)
    function selectRatio(preset) {
        currentRatio = preset.label;
        currentWidth = preset.width;
        currentHeight = preset.height;

        widthInput.value = currentWidth;
        heightInput.value = currentHeight;

        // Update button state
        ratioButtons.forEach(btn => {
            const isActive = btn.dataset.ratio === preset.label;
            btn.style.backgroundColor = isActive ? '#4a9eff' : '#2a2a2a';
            btn.style.color = isActive ? 'white' : '#e0e0e0';
            btn.style.borderColor = isActive ? '#4a9eff' : '#444';
        });

        notifyChange();
    }

    function onInputChange() {
        currentWidth = parseInt(widthInput.value) || minSize;
        currentHeight = parseInt(heightInput.value) || minSize;

        updateRatioButtons();
    }

    function validateAndNotify() {
        // Validate range and show toast if out of range
        const originalWidth = currentWidth;
        const originalHeight = currentHeight;

        currentWidth = Math.max(minSize, Math.min(maxSize, currentWidth));
        currentHeight = Math.max(minSize, Math.min(maxSize, currentHeight));

        // Show toast if value was out of range
        if (originalWidth < minSize || originalWidth > maxSize) {
            showSizeToast(`Width must be between ${minSize} and ${maxSize}`, widthInput);
        }
        if (originalHeight < minSize || originalHeight > maxSize) {
            showSizeToast(`Height must be between ${minSize} and ${maxSize}`, heightInput);
        }

        // Align to multiples of 8
        currentWidth = Math.round(currentWidth / 8) * 8;
        currentHeight = Math.round(currentHeight / 8) * 8;

        widthInput.value = currentWidth;
        heightInput.value = currentHeight;

        updateRatioButtons();
        notifyChange();
    }

    function updateRatioButtons() {
        const ratio = currentWidth / currentHeight;
        let matchedRatio = null;

        for (const preset of SIZE_RATIO_PRESETS) {
            const presetRatio = preset.width / preset.height;
            if (Math.abs(ratio - presetRatio) < 0.01) {
                matchedRatio = preset.label;
                break;
            }
        }

        currentRatio = matchedRatio;
        ratioButtons.forEach(btn => {
            const isActive = btn.dataset.ratio === matchedRatio;
            btn.style.backgroundColor = isActive ? '#4a9eff' : '#2a2a2a';
            btn.style.color = isActive ? 'white' : '#e0e0e0';
            btn.style.borderColor = isActive ? '#4a9eff' : '#444';
        });
    }

    function notifyChange() {
        const value = currentWidth && currentHeight ? `${currentWidth}*${currentHeight}` : '';
        // Don't send empty size values to backend (for x-hidden support)
        if (value === '') {
            delete node.wavespeedState.parameterValues[param.name];
        } else {
            node.wavespeedState.parameterValues[param.name] = value;
        }
        updateRequestJson(node);
    }

    // Event listeners (removed header click for toggle)
    widthInput.addEventListener('input', onInputChange);
    heightInput.addEventListener('input', onInputChange);
    widthInput.addEventListener('blur', validateAndNotify);
    heightInput.addEventListener('blur', validateAndNotify);
    widthInput.addEventListener('click', (e) => e.stopPropagation());
    heightInput.addEventListener('click', (e) => e.stopPropagation());
    widthInput.addEventListener('mousedown', (e) => e.stopPropagation());
    heightInput.addEventListener('mousedown', (e) => e.stopPropagation());

    // Create widget (serialize: false to prevent ComfyUI auto-serialization)
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });

    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;
    widget._wavespeed_size = true; // Mark as size widget

    // Save UI element references for connection state handling
    widget._widthInput = widthInput;
    widget._heightInput = heightInput;
    widget._ratioButtons = ratioButtons;

    // Custom computeSize method (always expanded now)
    widget.computeSize = function() {
        // Always expanded: header + content height (~150px)
        const expandedHeight = 150;
        return [node.size[0] - 20, expandedHeight];
    };

    // Define value property
    const descriptor = Object.getOwnPropertyDescriptor(widget, 'value');
    if (!descriptor || descriptor.configurable) {
        try {
            Object.defineProperty(widget, 'value', {
                get() {
                    return currentWidth && currentHeight ? `${currentWidth}*${currentHeight}` : '';
                },
                set(val) {
                    if (!val) {
                        currentWidth = null;
                        currentHeight = null;
                        widthInput.value = '';
                        heightInput.value = '';
                        return;
                    }
                    const match = val.match(/(\d+)\s*[*x×]\s*(\d+)/i);
                    if (match) {
                        currentWidth = parseInt(match[1]);
                        currentHeight = parseInt(match[2]);
                        widthInput.value = currentWidth;
                        heightInput.value = currentHeight;
                        updateRatioButtons();
                    }
                },
                enumerable: true,
                configurable: true
            });
        } catch (e) {
            console.warn('[WaveSpeed] Could not define value property for size widget:', e.message);
            widget.value = `${currentWidth}*${currentHeight}`;
        }
    } else {
        // Use existing value property
        widget.value = `${currentWidth}*${currentHeight}`;
    }

    // Initialize parameter value
    // Don't initialize if x-hidden and no default (keep undefined)
    if (currentWidth && currentHeight) {
        node.wavespeedState.parameterValues[param.name] = `${currentWidth}*${currentHeight}`;
    }

    // Add restoreValue method for workflow restoration
    widget.restoreValue = createRestoreValueFn(node, param, function(val) {
        // Parse "256*1536" format
        const match = val.match(/(\d+)\s*[*x×]\s*(\d+)/i);
        if (match) {
            currentWidth = parseInt(match[1]);
            currentHeight = parseInt(match[2]);
            widthInput.value = currentWidth;
            heightInput.value = currentHeight;
            updateRatioButtons();
        }
    });

    return widget;
}

// Check if parameter is a size parameter (only match specific size param names, not resolution)
function isSizeParameter(paramName) {
    const lowerName = paramName.toLowerCase();
    // Only match explicit size parameters, not resolution
    return lowerName === 'size' || 
           lowerName === 'image_size' || 
           lowerName === 'output_size';
    // Removed 'resolution' and endsWith('_size') matching
}

// Check if parameter is a prompt parameter (needs multiline textarea)
function isPromptParameter(paramName) {
    const lowerName = paramName.toLowerCase();
    return lowerName === 'prompt' || 
           lowerName === 'negative_prompt' ||
           lowerName === 'text' ||
           lowerName === 'caption' ||
           lowerName === 'description' ||
           lowerName.includes('prompt') ||
           lowerName.includes('text');
}

// Check if parameter is a seed parameter
function isSeedParameter(paramName) {
    const lowerName = paramName.toLowerCase();
    return lowerName === 'seed' || 
           lowerName === 'random_seed' ||
           lowerName === 'noise_seed';
}

// Seed control modes
const SEED_MODES = {
    FIXED: 'fixed',
    INCREMENT: 'increment',
    DECREMENT: 'decrement',
    RANDOM: 'randomize'
};

// Generate random seed
function generateRandomSeed(max = 4294967295) {
    // Generate a random integer within the specified range (0 to max)
    // max defaults to 2^32-1 if not provided, but should be set based on model's maximum constraint
    return Math.floor(Math.random() * (max + 1));
}

// Create array title widget (only display title, no input slot)
export function createArrayTitleWidget(node, param) {
    const container = document.createElement('div');
    container.className = 'wavespeed-array-title-widget';
    container.setAttribute('data-widget-name', param.name); // For precise DOM matching
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '2px';
    container.style.marginBottom = '2px';
    container.style.paddingTop = '4px';
    
    const titleText = document.createElement('span');
    titleText.textContent = param.parentArrayName || param.displayName;
    titleText.style.color = '#4a9eff';
    titleText.style.fontSize = '12px';
    titleText.style.fontWeight = '600';
    titleText.style.textTransform = 'capitalize';
    container.appendChild(titleText);
    
    // Add required marker
    if (param.parentRequired) {
        const requiredMark = document.createElement('span');
        requiredMark.textContent = '*';
        requiredMark.style.color = '#ff6b6b';
        requiredMark.style.fontSize = '14px';
        requiredMark.style.fontWeight = 'normal';
        requiredMark.style.marginLeft = '1px';
        requiredMark.style.lineHeight = '1';
        container.appendChild(requiredMark);
    }
    
    // Add description tooltip
    if (param.parentDescription) {
        const infoIcon = createInfoTooltip(param.parentDescription);
        container.appendChild(infoIcon);
    }

    // Array title widget (serialize: false to prevent ComfyUI auto-serialization)
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });

    widget._wavespeed_dynamic = true;
    widget._wavespeed_array_title = true;
    widget._wavespeed_no_input = true; // Mark as widget without input

    // Title widget has fixed height
    // CRITICAL: For input slot positioning, this widget should not be counted
    // But for node size calculation, it should be counted
    widget.computeSize = function() {
        return [node.size[0] - 20, 26];
    };

    // Override computeSize for input position calculation only
    // When ComfyUI calculates input positions, it should skip this widget
    // We'll handle this in the node's position calculation logic

    return widget;
}

// Create size title widget (only display title, no input slot)
export function createSizeTitleWidget(node, param) {
    const container = document.createElement('div');
    container.className = 'wavespeed-size-title-widget';
    container.setAttribute('data-widget-name', param.name);
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '2px';
    container.style.marginBottom = '2px';
    container.style.paddingTop = '4px';

    const titleText = document.createElement('span');
    titleText.textContent = param.parentSizeName || param.displayName;
    titleText.style.color = '#4a9eff';
    titleText.style.fontSize = '12px';
    titleText.style.fontWeight = '600';
    titleText.style.textTransform = 'capitalize';
    container.appendChild(titleText);

    if (param.parentRequired) {
        const requiredMark = document.createElement('span');
        requiredMark.textContent = '*';
        requiredMark.style.color = '#ff6b6b';
        requiredMark.style.fontSize = '14px';
        requiredMark.style.fontWeight = 'normal';
        requiredMark.style.marginLeft = '1px';
        requiredMark.style.lineHeight = '1';
        container.appendChild(requiredMark);
    }

    if (param.parentDescription) {
        const infoIcon = createInfoTooltip(param.parentDescription);
        container.appendChild(infoIcon);
    }

    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });

    widget._wavespeed_dynamic = true;
    widget._wavespeed_size_title = true;
    widget._wavespeed_no_input = true;

    widget.computeSize = function() {
        return [node.size[0] - 20, 26];
    };

    return widget;
}

// Create object array item widget (e.g., bbox_condition with height/length/width in one row)
export function createObjectArrayItemWidget(node, param) {
    const container = document.createElement('div');
    container.className = 'wavespeed-object-array-item-widget';
    container.setAttribute('data-widget-name', param.name);
    container.style.display = 'flex';
    container.style.flexDirection = 'row'; // Change to row layout
    container.style.alignItems = 'center';
    container.style.gap = '8px';
    container.style.marginBottom = '0'; // No spacing between rows
    container.style.marginLeft = '12px';

    // Index label - on the same row as input fields
    const indexLabel = document.createElement('label');
    indexLabel.textContent = `[${param.arrayIndex}]`;
    indexLabel.className = 'wavespeed-array-item-label';
    indexLabel.style.color = '#888';
    indexLabel.style.fontSize = '11px';
    indexLabel.style.minWidth = '24px';
    indexLabel.style.fontFamily = 'monospace';
    indexLabel.style.flexShrink = '0';
    container.appendChild(indexLabel);

    // Input row: all fields in one horizontal row (same row as index)
    const inputRow = document.createElement('div');
    inputRow.style.display = 'flex';
    inputRow.style.alignItems = 'center';
    inputRow.style.gap = '8px';
    inputRow.style.flexWrap = 'wrap';
    inputRow.style.flex = '1';

    const fieldValues = {};
    const fieldInputs = {};

    // Create input field for each property (height, length, width, etc.)
    // No column headers - placeholder text in inputs is sufficient
    
    // Check if this is a loras object array (has path and scale properties)
    const isLorasArray = param.parentArrayName === 'loras' && 
                         param.objectProperties && 
                         param.objectProperties.includes('path') && 
                         param.objectProperties.includes('scale');
    
    if (param.objectProperties && param.objectProperties.length > 0) {
        for (const propName of param.objectProperties) {
            const fieldContainer = document.createElement('div');
            fieldContainer.style.display = 'flex';
            fieldContainer.style.flexDirection = 'column';
            fieldContainer.style.gap = '0';
            fieldContainer.style.flex = '1';
            fieldContainer.style.minWidth = '80px';
            fieldContainer.style.justifyContent = 'flex-start';

            // Special handling for scale property in loras arrays: use slider control
            if (isLorasArray && propName === 'scale') {
                const scaleControl = createLoraScaleControl(1.0, (scale) => {
                    fieldValues[propName] = scale;
                    updateObjectArrayValue(node, param);
                });
                // Set initial value if exists
                const existingValue = node.wavespeedState.parameterValues[param.name];
                if (existingValue && typeof existingValue === 'object' && existingValue[propName] !== undefined) {
                    const scaleValue = parseFloat(existingValue[propName]);
                    if (!isNaN(scaleValue)) {
                        scaleControl.querySelector('input[type="range"]').value = scaleValue;
                        scaleControl.querySelector('input[type="number"]').value = scaleValue.toFixed(1);
                        fieldValues[propName] = scaleValue;
                    }
                } else {
                    fieldValues[propName] = 1.0;
                }
                fieldContainer.appendChild(scaleControl);
                fieldInputs[propName] = scaleControl;
            } else {
                // Regular input field for other properties
                const fieldInput = document.createElement('input');
                if (propName === 'scale' && !isLorasArray) {
                    // For non-loras scale fields, use number input
                    fieldInput.type = 'number';
                    fieldInput.step = '0.1';
                    fieldInput.min = '0';
                    fieldInput.max = '2';
                } else {
                    // For text fields (like path) or other numeric fields
                    fieldInput.type = propName === 'path' ? 'text' : 'number';
                }
                fieldInput.value = '';
                fieldInput.placeholder = propName;
                fieldInput.style.padding = '6px 8px';
                fieldInput.style.backgroundColor = '#2a2a2a';
                fieldInput.style.color = '#e0e0e0';
                fieldInput.style.border = '1px solid #444';
                fieldInput.style.borderRadius = '4px';
                fieldInput.style.fontSize = '11px';
                fieldInput.style.height = '32px';
                fieldInput.style.minHeight = '32px';
                fieldInput.style.lineHeight = '20px';
                fieldInput.style.boxSizing = 'border-box';
                fieldInput.style.width = '100%';

                fieldInput.addEventListener('input', () => {
                    if (fieldInput.type === 'number') {
                        const value = parseFloat(fieldInput.value);
                        fieldValues[propName] = isNaN(value) ? '' : value;
                    } else {
                        fieldValues[propName] = fieldInput.value;
                    }
                    updateObjectArrayValue(node, param);
                });

                fieldContainer.appendChild(fieldInput);
                fieldInputs[propName] = fieldInput;
                fieldValues[propName] = '';
            }

            inputRow.appendChild(fieldContainer);
        }
    }

    container.appendChild(inputRow);

    // Create widget
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });
    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;
    widget._wavespeed_object_array_item = true;
    widget._fieldInputs = fieldInputs;
    widget._fieldValues = fieldValues;

    // Define value property (check if already exists to avoid redefinition error)
    // CRITICAL: DOMWidget may already have a value property that is not configurable
    // Solution: Always use getValue/setValue methods as fallback, and try to define value property if possible
    const existingDescriptor = Object.getOwnPropertyDescriptor(widget, 'value');
    
    // Always create getValue/setValue methods for reliable access
    widget.getValue = function() {
        // Build object value from field values (only include non-empty values)
        const objectValue = {};
        for (const propName of Object.keys(fieldValues)) {
            const value = fieldValues[propName];
            // For scale control, get value from the number input
            if (isLorasArray && propName === 'scale' && fieldInputs[propName]) {
                const scaleControl = fieldInputs[propName];
                const numberInput = scaleControl.querySelector('input[type="number"]');
                if (numberInput) {
                    const scaleValue = parseFloat(numberInput.value);
                    if (!isNaN(scaleValue)) {
                        objectValue[propName] = scaleValue;
                    }
                }
            } else if (value !== '' && value !== null && value !== undefined) {
                objectValue[propName] = value;
            }
        }
        return Object.keys(objectValue).length > 0 ? objectValue : '';
    };
    
    widget.setValue = function(val) {
        if (val && typeof val === 'object') {
            for (const propName of Object.keys(fieldValues)) {
                if (val[propName] !== undefined) {
                    fieldValues[propName] = val[propName];
                    if (fieldInputs[propName]) {
                        // Special handling for scale control in loras arrays
                        if (isLorasArray && propName === 'scale') {
                            const scaleControl = fieldInputs[propName];
                            const slider = scaleControl.querySelector('input[type="range"]');
                            const numberInput = scaleControl.querySelector('input[type="number"]');
                            if (slider && numberInput) {
                                const scaleValue = parseFloat(val[propName]);
                                if (!isNaN(scaleValue)) {
                                    slider.value = scaleValue;
                                    numberInput.value = scaleValue.toFixed(1);
                                }
                            }
                        } else {
                            // Regular input field
                            fieldInputs[propName].value = val[propName];
                        }
                    }
                }
            }
            // Update parameterValues
            updateObjectArrayValue(node, param);
        }
    };
    
    // Try to define value property if possible
    if (!existingDescriptor || existingDescriptor.configurable) {
        try {
            Object.defineProperty(widget, 'value', {
                get() {
                    return widget.getValue();
                },
                set(val) {
                    widget.setValue(val);
                },
                enumerable: true,
                configurable: true
            });
        } catch (error) {
            // If defineProperty fails, value access will use getValue/setValue methods
            console.warn('[WaveSpeed] Could not define value property, using getValue/setValue:', error.message);
        }
    }
    // Note: If value property is not configurable, value access will use getValue/setValue methods (no warning needed)

    // Initialize parameter value
    const existingValue = node.wavespeedState.parameterValues[param.name];
    if (existingValue && typeof existingValue === 'object') {
        // Use setValue method to restore value
        widget.setValue(existingValue);
    } else {
        // Initialize with empty values
        updateObjectArrayValue(node, param);
    }

    // Add restoreValue method for workflow restoration
    widget.restoreValue = createRestoreValueFn(node, param, function(val) {
        if (val && typeof val === 'object') {
            // Restore each field value
            for (const propName of Object.keys(fieldValues)) {
                if (val[propName] !== undefined) {
                    fieldValues[propName] = val[propName];
                    if (fieldInputs[propName]) {
                        // Special handling for scale control in loras arrays
                        if (isLorasArray && propName === 'scale') {
                            const scaleControl = fieldInputs[propName];
                            const slider = scaleControl.querySelector('input[type="range"]');
                            const numberInput = scaleControl.querySelector('input[type="number"]');
                            if (slider && numberInput) {
                                const scaleValue = parseFloat(val[propName]);
                                if (!isNaN(scaleValue)) {
                                    slider.value = scaleValue;
                                    numberInput.value = scaleValue.toFixed(1);
                                }
                            }
                        } else {
                            // Regular input field
                            fieldInputs[propName].value = val[propName];
                        }
                    }
                }
            }
        }
    });

    // Compute size - single row height for object array items (match images array item height)
    widget.computeSize = function() {
        // Height matches input field height (32px) with no margin
        return [node.size[0] - 20, 32];
    };

    return widget;
}

// Helper: Update parameter value for object array item
function updateObjectArrayValue(node, param) {
    const widget = node.widgets?.find(w => w.name === param.name);
    if (widget && widget._fieldValues && widget._fieldInputs) {
        // Build object value from field values
        const objectValue = {};
        const isLorasArray = param.parentArrayName === 'loras' && 
                             param.objectProperties && 
                             param.objectProperties.includes('path') && 
                             param.objectProperties.includes('scale');
        
        for (const propName of Object.keys(widget._fieldValues)) {
            let value = widget._fieldValues[propName];
            
            // For scale control in loras arrays, get value from the number input
            if (isLorasArray && propName === 'scale' && widget._fieldInputs[propName]) {
                const scaleControl = widget._fieldInputs[propName];
                const numberInput = scaleControl.querySelector('input[type="number"]');
                if (numberInput) {
                    const scaleValue = parseFloat(numberInput.value);
                    if (!isNaN(scaleValue)) {
                        value = scaleValue;
                    }
                }
            }
            
            if (value !== '' && value !== null && value !== undefined) {
                objectValue[propName] = value;
            }
        }
        
        // For loras array: only save if path exists and is non-empty (like images array behavior)
        // For other object arrays: save if any field is non-empty
        if (isLorasArray) {
            // Only save if path exists and is non-empty
            if (objectValue.path && objectValue.path.trim() !== '') {
                node.wavespeedState.parameterValues[param.name] = objectValue;
            } else {
                // If path is empty, don't save the object (even if scale has value)
                node.wavespeedState.parameterValues[param.name] = '';
            }
        } else {
            // For other object arrays, keep original behavior
            node.wavespeedState.parameterValues[param.name] = Object.keys(objectValue).length > 0 ? objectValue : '';
        }
        
        // Update request JSON
        updateRequestJson(node);
    }
}

// Create Seed widget (with fixed/random control)
export function createSeedWidget(node, param) {
    const container = document.createElement('div');
    container.className = 'wavespeed-seed-widget';
    container.setAttribute('data-widget-name', param.name); // For precise DOM matching
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    container.style.marginBottom = '4px';
    
    // Current value and mode
    const min = param.min !== undefined ? param.min : 0;
    const max = param.max !== undefined ? param.max : 4294967295;
    
    // Ensure default value is within bounds
    let currentValue;
    if (param.default !== undefined) {
        currentValue = Math.max(min, Math.min(max, Math.round(param.default)));
    } else {
        currentValue = generateRandomSeed(max);
    }
    let currentMode = SEED_MODES.FIXED;
    
    // Label row
    const labelRow = document.createElement('div');
    labelRow.style.display = 'flex';
    labelRow.style.alignItems = 'center';
    labelRow.style.justifyContent = 'space-between';
    
    const label = createLabelWithRequired(param.displayName || 'Seed', param.required, param.description);
    label.style.color = '#4a9eff';
    label.style.fontSize = '12px';
    label.style.fontWeight = '600';
    
    labelRow.appendChild(label);
    
    // Input row
    const inputRow = document.createElement('div');
    inputRow.style.display = 'flex';
    inputRow.style.alignItems = 'center';
    inputRow.style.gap = '4px';
    
    // Seed input box
    const seedInput = document.createElement('input');
    seedInput.type = 'number';
    seedInput.value = currentValue;
    seedInput.min = min;
    seedInput.max = max;
    seedInput.step = 1;
    seedInput.style.flex = '1';
    seedInput.style.padding = '6px 10px';
    seedInput.style.backgroundColor = '#2a2a2a';
    seedInput.style.color = '#e0e0e0';
    seedInput.style.border = '1px solid #444';
    seedInput.style.borderRadius = '4px';
    seedInput.style.fontSize = '13px';
    seedInput.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    seedInput.style.boxSizing = 'border-box';
    
    // Prevent event bubbling
    seedInput.addEventListener('mousedown', (e) => e.stopPropagation());
    seedInput.addEventListener('click', (e) => e.stopPropagation());
    seedInput.addEventListener('wheel', (e) => e.stopPropagation());
    
    // Input event
    seedInput.addEventListener('input', () => {
        let value = parseInt(seedInput.value);
        if (isNaN(value)) value = 0;
        value = Math.max(min, Math.min(max, Math.round(value)));
        currentValue = value;
        node.wavespeedState.parameterValues[param.name] = value;
        updateRequestJson(node);
    });
    
    seedInput.addEventListener('blur', () => {
        seedInput.value = currentValue;
    });
    
    // Mode selection dropdown
    const modeSelect = document.createElement('select');
    modeSelect.style.padding = '6px 8px';
    modeSelect.style.backgroundColor = '#2a2a2a';
    modeSelect.style.color = '#e0e0e0';
    modeSelect.style.border = '1px solid #444';
    modeSelect.style.borderRadius = '4px';
    modeSelect.style.fontSize = '11px';
    modeSelect.style.cursor = 'pointer';
    modeSelect.style.minWidth = '90px';
    
    const modes = [
        { value: SEED_MODES.FIXED, label: '🔒 fixed' },
        { value: SEED_MODES.INCREMENT, label: '📈 increment' },
        { value: SEED_MODES.DECREMENT, label: '📉 decrement' },
        { value: SEED_MODES.RANDOM, label: '🎲 randomize' }
    ];
    
    modes.forEach(mode => {
        const option = document.createElement('option');
        option.value = mode.value;
        option.textContent = mode.label;
        modeSelect.appendChild(option);
    });
    
    modeSelect.value = currentMode;
    
    modeSelect.addEventListener('mousedown', (e) => e.stopPropagation());
    modeSelect.addEventListener('change', () => {
        currentMode = modeSelect.value;
        // If switching to random mode, immediately generate new random seed
        if (currentMode === SEED_MODES.RANDOM) {
            currentValue = generateRandomSeed(max);
            seedInput.value = currentValue;
            node.wavespeedState.parameterValues[param.name] = currentValue;
            updateRequestJson(node);
        }
    });
    
    // Random button
    const randomBtn = document.createElement('button');
    randomBtn.textContent = '🎲';
    randomBtn.title = 'Generate random seed';
    randomBtn.style.padding = '6px 10px';
    randomBtn.style.backgroundColor = '#4a9eff';
    randomBtn.style.color = 'white';
    randomBtn.style.border = 'none';
    randomBtn.style.borderRadius = '4px';
    randomBtn.style.cursor = 'pointer';
    randomBtn.style.fontSize = '14px';
    randomBtn.style.transition = 'background-color 0.2s ease';
    
    randomBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    randomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentValue = generateRandomSeed(max);
        seedInput.value = currentValue;
        node.wavespeedState.parameterValues[param.name] = currentValue;
        updateRequestJson(node);
    });
    
    randomBtn.addEventListener('mouseenter', () => {
        randomBtn.style.backgroundColor = '#3a8eef';
    });
    randomBtn.addEventListener('mouseleave', () => {
        randomBtn.style.backgroundColor = '#4a9eff';
    });
    
    inputRow.appendChild(seedInput);
    inputRow.appendChild(modeSelect);
    inputRow.appendChild(randomBtn);
    
    container.appendChild(labelRow);
    container.appendChild(inputRow);

    // Create widget (serialize: false to prevent ComfyUI auto-serialization)
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });

    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;
    widget._wavespeed_seed = true;
    widget._wavespeed_label_offset = 24; // Seed widget has label row

    // Save seed control state
    widget._seedMode = currentMode;
    widget._seedInput = seedInput;
    widget._modeSelect = modeSelect;
    
    // Custom computeSize
    widget.computeSize = function() {
        return [node.size[0] - 20, 60];
    };
    
    // Define value property
    const descriptor = Object.getOwnPropertyDescriptor(widget, 'value');
    if (!descriptor || descriptor.configurable) {
        try {
            Object.defineProperty(widget, 'value', {
                get() {
                    return currentValue;
                },
                set(val) {
                    if (val !== undefined && val !== null) {
                        currentValue = Math.round(val);
                        seedInput.value = currentValue;
                    }
                },
                enumerable: true,
                configurable: true
            });
        } catch (e) {
            console.warn('[WaveSpeed] Could not define value property for seed widget:', e.message);
            widget.value = currentValue;
        }
    } else {
        // Use existing value property
        widget.value = currentValue;
    }
    
    // Update seed based on mode before execution
    widget.beforeExecute = function() {
        const mode = modeSelect.value;
        switch (mode) {
            case SEED_MODES.INCREMENT:
                currentValue = Math.min(max, currentValue + 1);
                break;
            case SEED_MODES.DECREMENT:
                currentValue = Math.max(min, currentValue - 1);
                break;
            case SEED_MODES.RANDOM:
                currentValue = generateRandomSeed(max);
                break;
            case SEED_MODES.FIXED:
            default:
                // Keep unchanged
                break;
        }
        seedInput.value = currentValue;
        node.wavespeedState.parameterValues[param.name] = currentValue;
        updateRequestJson(node);
    };
    
    // Initialize parameter value
    node.wavespeedState.parameterValues[param.name] = currentValue;

    // Register to node's beforeExecute callback list
    if (!node._seedWidgets) {
        node._seedWidgets = [];
    }
    node._seedWidgets.push(widget);

    // Add restoreValue method for workflow restoration
    widget.restoreValue = createRestoreValueFn(node, param, function(val) {
        currentValue = Math.round(val);
        seedInput.value = currentValue;
    });

    return widget;
}

// Create multiline textarea widget
export function createPromptWidget(node, param) {
    const container = document.createElement('div');
    container.className = 'wavespeed-prompt-widget';
    container.setAttribute('data-widget-name', param.name); // For precise DOM matching
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';
    container.style.marginBottom = '4px';
    
    // Label (with required marker and description tooltip)
    const label = createLabelWithRequired(param.displayName || param.name, param.required, param.description);
    label.style.color = '#4a9eff';
    label.style.fontSize = '12px';
    label.style.fontWeight = '600';
    
    // Multiline textarea
    const textarea = document.createElement('textarea');
    const uniqueId = `${param.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    textarea.id = uniqueId;
    textarea.value = param.default || '';
    textarea.setAttribute('autocomplete', 'off');

    textarea.placeholder = `Enter ${param.displayName || param.name}...`;
    textarea.style.width = '100%';
    textarea.style.minHeight = '80px';
    textarea.style.padding = '8px 10px';
    textarea.style.backgroundColor = '#2a2a2a';
    textarea.style.color = '#e0e0e0';
    textarea.style.border = '1px solid #444';
    textarea.style.borderRadius = '4px';
    textarea.style.resize = 'vertical';
    textarea.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    textarea.style.fontSize = '13px';
    textarea.style.lineHeight = '1.4';
    textarea.style.boxSizing = 'border-box';
    
    // Prevent event bubbling
    textarea.addEventListener('mousedown', (e) => e.stopPropagation());
    textarea.addEventListener('click', (e) => e.stopPropagation());
    textarea.addEventListener('wheel', (e) => e.stopPropagation());
    
    // Input event
    textarea.addEventListener('input', () => {
        node.wavespeedState.parameterValues[param.name] = textarea.value;
        updateRequestJson(node);
    });
    
    container.appendChild(label);
    container.appendChild(textarea);

    // Create widget (serialize: false to prevent ComfyUI auto-serialization)
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });


    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;
    widget._wavespeed_label_offset = 20; // Prompt widget has label row
    // Note: Removed widget.inputEl to unify restoration via restoreValue method

    // Custom computeSize
    widget.computeSize = function() {
        const height = textarea.offsetHeight + 30; // label + padding
        return [node.size[0] - 20, Math.max(height, 110)];
    };

    // Define value property
    const descriptor = Object.getOwnPropertyDescriptor(widget, 'value');
    if (!descriptor || descriptor.configurable) {
        // Can redefine, use defineProperty
        try {
            Object.defineProperty(widget, 'value', {
                get() {
                    return textarea.value;
                },
                set(val) {
                    // console.log('[🔍 Prompt Setter]', param.name, '→', val, '| stack:', new Error().stack.split('\n')[2].trim());
                    textarea.value = val || '';
                },
                enumerable: true,
                configurable: true
            });
        } catch (e) {
            console.warn('[WaveSpeed] Could not define value property for prompt widget:', e.message);
            // Fallback: use direct proxy methods
            widget.getValue = () => textarea.value;
            widget.setValue = (val) => { textarea.value = val || ''; };
        }
    } else {
        // Not configurable, use existing value property from ComfyUI
        widget.value = textarea.value || param.default || '';
    }

    // Initialize parameter value
    node.wavespeedState.parameterValues[param.name] = textarea.value || param.default || '';

    // Add restoreValue method for workflow restoration
    widget.restoreValue = createRestoreValueFn(node, param, function(val) {
        textarea.value = val || '';
        textarea.dispatchEvent(new Event('input'));
    });

    return widget;
}

// Create LoRA scale control
export function createLoraScaleControl(initialScale = 1.0, onChange) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '4px'; // Reduced gap to match images array items
    container.style.flex = '1';
    container.style.height = '32px'; // Match input field height

    const label = document.createElement('span');
    label.textContent = 'Scale:';
    label.style.color = '#e0e0e0';
    label.style.fontSize = '11px';
    label.style.whiteSpace = 'nowrap';
    label.style.minWidth = '38px';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '2';
    slider.step = '0.1';
    slider.value = initialScale.toFixed(1);
    slider.style.flex = '1';
    slider.style.minWidth = '80px';
    slider.style.cursor = 'pointer';

    slider.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    slider.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    });

    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.min = '0';
    valueInput.max = '2';
    valueInput.step = '0.1';
    valueInput.value = initialScale.toFixed(1);
    valueInput.style.width = '45px';
    valueInput.style.height = '32px';
    valueInput.style.minHeight = '32px';
    valueInput.style.padding = '6px 4px';
    valueInput.style.backgroundColor = '#2a2a2a';
    valueInput.style.color = '#e0e0e0';
    valueInput.style.border = '1px solid #444';
    valueInput.style.borderRadius = '4px';
    valueInput.style.fontSize = '11px';
    valueInput.style.textAlign = 'right';
    valueInput.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    valueInput.style.boxSizing = 'border-box';

    valueInput.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    valueInput.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    });

    const updateValue = (value) => {
        value = parseFloat(value);
        if (isNaN(value)) value = 1.0;
        if (value < 0) value = 0;
        if (value > 2) value = 2;
        value = Math.round(value * 10) / 10;
        slider.value = value;
        valueInput.value = value.toFixed(1);
        if (onChange) onChange(value);
    };

    slider.addEventListener('input', () => {
        updateValue(slider.value);
    });

    valueInput.addEventListener('input', () => {
        let value = parseFloat(valueInput.value);
        if (isNaN(value)) return;
        if (value < 0) {
            valueInput.value = 0;
            value = 0;
        }
        if (value > 2) {
            valueInput.value = 2;
            value = 2;
        }
        slider.value = value;
        if (onChange) onChange(value);
    });

    valueInput.addEventListener('blur', () => {
        updateValue(valueInput.value);
    });

    container.appendChild(label);
    container.appendChild(slider);
    container.appendChild(valueInput);

    return container;
}

// Intercept slider input to prevent node dragging
export function interceptSliderInput(widget, min, max, type, defaultValue) {
    const inputEl = widget.inputEl || widget.element;
    if (!inputEl) return;

    inputEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    inputEl.addEventListener('touchstart', (e) => {
        e.stopPropagation();
    });

    const numberInput = inputEl.parentElement?.querySelector('input[type="number"]');
    if (!numberInput) return;

    numberInput.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    numberInput.addEventListener('input', () => {
        let value = parseFloat(numberInput.value);
        if (isNaN(value)) return;

        if (type === 'INT') {
            value = Math.round(value);
        } else if (type === 'FLOAT') {
            value = Math.round(value * 10) / 10;
        }

        // Only enforce min/max if they are valid numbers (not Infinity)
        if (min !== -Infinity && value < min) {
            numberInput.value = min;
            value = min;
        }
        if (max !== Infinity && value > max) {
            numberInput.value = max;
            value = max;
        }

        widget.value = value;
        if (widget.callback) widget.callback(value);
    });

    numberInput.addEventListener('blur', () => {
        let value = parseFloat(numberInput.value);
        if (isNaN(value)) value = defaultValue;

        if (type === 'INT') {
            value = Math.round(value);
        } else if (type === 'FLOAT') {
            value = Math.round(value * 10) / 10;
        }

        // Only enforce min/max if they are valid numbers (not Infinity)
        if (min !== -Infinity && value < min) value = min;
        if (max !== Infinity && value > max) value = max;

        numberInput.value = type === 'INT' ? value : value.toFixed(1);
        widget.value = value;
        if (widget.callback) widget.callback(value);
    });
}

// Create media widget UI
export function createMediaWidgetUI(node, param, mediaType, displayName, widgetName) {
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'wavespeed-media-widget';
    widgetContainer.setAttribute('data-widget-name', param.name); // For precise DOM matching
    widgetContainer.style.display = 'flex';
    widgetContainer.style.flexDirection = 'column'; // Use column layout to support title
    widgetContainer.style.width = '100%';
    widgetContainer.style.gap = '2px';
    widgetContainer.style.marginBottom = '4px';
    widgetContainer.style.position = 'relative';
    widgetContainer.style.overflow = 'visible';
    widgetContainer.style.padding = '0';
    
    // If expanded array item, add sub-item styles
    if (param.isExpandedArrayItem) {
        widgetContainer.classList.add('wavespeed-expanded-array-item');
        widgetContainer.style.marginLeft = '12px';
        widgetContainer.style.paddingLeft = '0';
        widgetContainer.style.marginBottom = '2px';
        widgetContainer.style.paddingTop = '0';
        widgetContainer.style.paddingBottom = '0';
    }

    const inputRow = document.createElement('div');
    inputRow.className = 'wavespeed-media-input-row';
    inputRow.style.display = 'flex';
    inputRow.style.alignItems = 'center';
    inputRow.style.gap = '4px';
    inputRow.style.flex = '1';
    inputRow.style.width = '100%';
    inputRow.style.padding = '0';

    // For non-array media parameters, add title row (with required marker and description tooltip)
    if (!param.isExpandedArrayItem) {
        const titleRow = document.createElement('div');
        titleRow.className = 'wavespeed-media-title-row';
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.style.marginBottom = '2px';
        
        const titleLabel = createLabelWithRequired(displayName, param.required, param.description);
        titleLabel.style.color = '#4a9eff';
        titleLabel.style.fontSize = '12px';
        titleLabel.style.fontWeight = '600';
        
        titleRow.appendChild(titleLabel);
        widgetContainer.appendChild(titleRow);
    }

    const widgetLabel = document.createElement('label');
    // For array items, show index instead of full name
    if (param.isExpandedArrayItem) {
        widgetLabel.textContent = `[${param.arrayIndex}]`;
        widgetLabel.className = 'wavespeed-array-item-label';
        widgetLabel.style.color = '#888';
        widgetLabel.style.fontSize = '11px';
        widgetLabel.style.minWidth = '24px';
        widgetLabel.style.fontFamily = 'monospace';
    }
    widgetLabel.style.whiteSpace = 'nowrap';

    const textarea = document.createElement('textarea');
    textarea.value = param.default || '';
    // console.log('[🔍 Media Create]', param.name, '→ textarea.value:', textarea.value, '| param.default:', param.default);
    textarea.placeholder = param.isExpandedArrayItem ? `Enter ${mediaType}...` : `Enter ${displayName.toLowerCase()}...`;
    textarea.style.flex = '1';
    textarea.style.width = '100%';
    textarea.style.minWidth = '0';
    textarea.style.minHeight = '28px';
    textarea.style.height = '28px';
    textarea.style.maxHeight = '28px';
    textarea.style.padding = '5px 10px 3px 10px';
    textarea.style.backgroundColor = '#2a2a2a';
    textarea.style.color = '#e0e0e0';
    textarea.style.border = '1px solid #444';
    textarea.style.borderRadius = '4px';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.whiteSpace = 'nowrap';
    textarea.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    textarea.style.fontSize = '13px';
    textarea.style.lineHeight = '1.2';
    textarea.style.boxSizing = 'border-box';
    textarea.rows = 1;

    // Preview container - placed next to input box
    const previewContainer = document.createElement('div');
    previewContainer.className = 'wavespeed-preview-container';
    previewContainer.style.display = 'flex';
    previewContainer.style.alignItems = 'center';
    previewContainer.style.gap = '2px';
    previewContainer.style.minWidth = '0';
    previewContainer.style.flexShrink = '0';

    let currentPreview = null;

    // clearPreview will be updated after widget is created to use widget.previewContainer
    let clearPreview = () => {
        if (currentPreview) {
            currentPreview.remove();
            currentPreview = null;
        }
        previewContainer.innerHTML = '';
        // Keep both textarea and upload button enabled
        textarea.disabled = false;
        textarea.style.opacity = '1';
        textarea.style.cursor = 'text';
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
        }
    };

    const lockTextarea = () => {
        textarea.disabled = true;
        textarea.style.opacity = '0.5';
        textarea.style.cursor = 'not-allowed';
    };

    const lockUploadBtn = () => {
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.style.opacity = '0.5';
            uploadBtn.style.cursor = 'not-allowed';
        }
    };

    let uploadBtn = null;
    // uploadBtn callback will be updated after widget is created to use widget.previewContainer
    let uploadBtnCallback = async (file) => {
        const loadingPreview = createLoadingPreview(file.name);
        previewContainer.innerHTML = '';
        previewContainer.appendChild(loadingPreview);

        try {
            const result = await uploadToWaveSpeed(file, 'local_file', file.name);
            loadingPreview.remove();

            if (result.success) {
                // Simply update textarea value - don't lock anything
                textarea.value = result.url;

                node.wavespeedState.parameterValues[param.name] = result.url;
                updateRequestJson(node);

                const preview = createFilePreview(result.url, mediaType, () => {
                    textarea.value = '';
                    node.wavespeedState.parameterValues[param.name] = '';
                    updateRequestJson(node);
                    clearPreview();
                });
                previewContainer.innerHTML = '';
                previewContainer.appendChild(preview);
                currentPreview = preview;
            } else {
                const errorPreview = createErrorPreview(result.error);
                previewContainer.innerHTML = '';
                previewContainer.appendChild(errorPreview);
                setTimeout(() => {
                    errorPreview.remove();
                    clearPreview();
                }, 3000);
            }
        } catch (error) {
            loadingPreview.remove();
            const errorPreview = createErrorPreview(error.message);
            previewContainer.innerHTML = '';
            previewContainer.appendChild(errorPreview);
            setTimeout(() => {
                errorPreview.remove();
                clearPreview();
            }, 3000);
        }
    };
    
    if (mediaType !== 'lora') {
        uploadBtn = createUploadButton(uploadBtnCallback, mediaType);
    } else {
        const scaleControl = createLoraScaleControl(1.0, (scale) => {
            textarea.dataset.loraScale = scale;
        });
        inputRow.appendChild(widgetLabel);
        inputRow.appendChild(textarea);
        inputRow.appendChild(scaleControl);
    }

    if (mediaType !== 'lora') {
        // Only add label to inputRow for array items
        if (param.isExpandedArrayItem) {
            inputRow.appendChild(widgetLabel);
        }
        inputRow.appendChild(textarea);
        inputRow.appendChild(previewContainer); // Preview placed next to input box
        if (uploadBtn) {
            inputRow.appendChild(uploadBtn);
        }
    }

    widgetContainer.appendChild(inputRow);

    // Create widget (serialize: false to prevent ComfyUI auto-serialization)
    const existingWidget = node.widgets?.find(w => w.name === widgetName);
    // console.log('[🔍 Media Before addDOMWidget]', widgetName, '→ existing:', !!existingWidget);
    const widget = node.addDOMWidget(widgetName, 'div', widgetContainer, { serialize: false });
    // console.log('[🔍 Media After addDOMWidget]', widgetName, '→ created');

    widget.inputEl = textarea;
    widget.uploadBtn = uploadBtn;
    widget.previewContainer = previewContainer; // May be undefined for lora type
    widget._currentPreview = currentPreview; // Store currentPreview reference

    // Helper: Get current previewContainer from widget (handles DOM replacement)
    const getCurrentPreviewContainer = () => {
        // For lora type, no preview container
        if (mediaType === 'lora') {
            return null;
        }
        
        let container = widget.previewContainer;
        if (!container || container.parentElement === null) {
            // PreviewContainer was removed, re-query from widget.element
            container = widget.element?.querySelector('.wavespeed-preview-container');
            if (container) {
                widget.previewContainer = container;
            }
        }
        return container;
    };

    // Update clearPreview to use widget.previewContainer
    clearPreview = () => {
        if (widget._currentPreview) {
            widget._currentPreview.remove();
            widget._currentPreview = null;
        }
        const container = getCurrentPreviewContainer();
        if (container) {
            container.innerHTML = '';
        }
        // Keep both textarea and upload button enabled
        textarea.disabled = false;
        textarea.style.opacity = '1';
        textarea.style.cursor = 'text';
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
        }
    };

    // Update uploadBtnCallback to use widget.previewContainer
    if (uploadBtn && mediaType !== 'lora') {
        // Re-bind fileInput.onchange to use widget.previewContainer
        const fileInput = uploadBtn.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const container = getCurrentPreviewContainer();
                    if (!container) {
                        console.warn('[WaveSpeed] PreviewContainer not found for upload');
                        fileInput.value = '';
                        return;
                    }

                    const loadingPreview = createLoadingPreview(file.name);
                    container.innerHTML = '';
                    if (loadingPreview && loadingPreview instanceof Node) {
                        container.appendChild(loadingPreview);
                    }

                    try {
                        const result = await uploadToWaveSpeed(file, 'local_file', file.name);
                        if (loadingPreview && loadingPreview instanceof Node) {
                            loadingPreview.remove();
                        }

                        if (result.success) {
                            textarea.value = result.url;
                            node.wavespeedState.parameterValues[param.name] = result.url;
                            updateRequestJson(node);

                            const preview = createFilePreview(result.url, mediaType, () => {
                                textarea.value = '';
                                node.wavespeedState.parameterValues[param.name] = '';
                                updateRequestJson(node);
                                clearPreview();
                            });
                            
                            if (preview && preview instanceof Node) {
                                container.innerHTML = '';
                                container.appendChild(preview);
                                widget._currentPreview = preview;
                            }
                        } else {
                            const errorPreview = createErrorPreview(result.error);
                            if (errorPreview && errorPreview instanceof Node) {
                                container.innerHTML = '';
                                container.appendChild(errorPreview);
                                setTimeout(() => {
                                    errorPreview.remove();
                                    clearPreview();
                                }, 3000);
                            }
                        }
                    } catch (error) {
                        if (loadingPreview && loadingPreview instanceof Node) {
                            loadingPreview.remove();
                        }
                        const errorPreview = createErrorPreview(error.message);
                        if (errorPreview && errorPreview instanceof Node) {
                            container.innerHTML = '';
                            container.appendChild(errorPreview);
                            setTimeout(() => {
                                errorPreview.remove();
                                clearPreview();
                            }, 3000);
                        }
                    }
                }
                fileInput.value = '';
            };
        }
    }

    const handleUrlInput = () => {
        const urlValue = textarea.value.trim();

        // For lora type, no preview container, just update value
        if (mediaType === 'lora') {
            node.wavespeedState.parameterValues[param.name] = urlValue;
            updateRequestJson(node);
            return;
        }
        
        // CRITICAL FIX: Re-query previewContainer from widget to handle DOM replacement
        // Issue: After replaceChildren, old previewContainer may be removed from DOM
        // Solution: Always get current previewContainer from widget.element
        const currentPreviewContainer = getCurrentPreviewContainer();
        if (!currentPreviewContainer) {
            console.warn('[WaveSpeed] PreviewContainer not found for widget:', param.name);
            // Still update value even if preview container is missing
            node.wavespeedState.parameterValues[param.name] = urlValue;
            updateRequestJson(node);
            return;
        }
        
        if (widget._currentPreview) {
            widget._currentPreview.remove();
            widget._currentPreview = null;
        }

        if (!urlValue) {
            currentPreviewContainer.innerHTML = '';
            node.wavespeedState.parameterValues[param.name] = '';
            updateRequestJson(node);
            return;
        }

        // Update parameter value and show preview - don't lock anything
        node.wavespeedState.parameterValues[param.name] = urlValue;
        updateRequestJson(node);

        const preview = createFilePreview(urlValue, mediaType, () => {
            textarea.value = '';
            node.wavespeedState.parameterValues[param.name] = '';
            updateRequestJson(node);
            // Re-query previewContainer for clearPreview callback
            const container = getCurrentPreviewContainer();
            if (container) {
                container.innerHTML = '';
                widget._currentPreview = null;
            }
        });
        
        // Validate preview is a valid DOM node before appending
        if (preview && preview instanceof Node) {
            currentPreviewContainer.innerHTML = '';
            currentPreviewContainer.appendChild(preview);
            widget._currentPreview = preview;
        } else {
            console.error('[WaveSpeed] createFilePreview returned invalid element for:', urlValue, 'mediaType:', mediaType);
        }
    };

    textarea.addEventListener('input', handleUrlInput);
    widget._wavespeed_param = param.name;
    widget._wavespeed_dynamic = true;

    // Set computeSize - height needs to match actual DOM height for correct slot positioning
    widget.computeSize = function() {
        let height;
        if (param.isExpandedArrayItem) {
            // Array items uniform height to avoid slot position confusion
            height = 44;
        } else {
            // Non-array media parameters
            height = 64;
        }
        return [node.size[0] - 20, height];
    };

    // Set label offset for input slot positioning
    // For non-array media params with title row, offset by title height (20px)
    // For array items, no offset needed as they don't have title row
    if (!param.isExpandedArrayItem) {
        widget._wavespeed_label_offset = 20;
    }

    // Define value property
    const descriptor = Object.getOwnPropertyDescriptor(widget, 'value');
    if (!descriptor || descriptor.configurable) {
        try {
            Object.defineProperty(widget, 'value', {
                get() {
                    return textarea.value;
                },
                set(val) {
                    // console.log('[🔍 Media Setter]', param.name, '→', val, '| stack:', new Error().stack.split('\n')[2].trim());
                    textarea.value = val || '';
                    textarea.dispatchEvent(new Event('input'));
                },
                enumerable: true,
                configurable: true
            });
        } catch (e) {
            console.warn('[WaveSpeed] Could not define value property, using direct assignment:', e.message);
            widget.value = param.default || '';
        }
    } else {
        // Use existing value property
        widget.value = textarea.value || param.default || '';
    }

    node.wavespeedState.parameterValues[param.name] = textarea.value || param.default || '';
    // console.log('[🔍 Media Init]', param.name, '→ parameterValues:', node.wavespeedState.parameterValues[param.name]);

    // Add restoreValue method for workflow restoration (unified approach)
    widget.restoreValue = createRestoreValueFn(node, param, function(val) {
        if (typeof val === 'string') {
            // Simply restore textarea value and trigger input event
            textarea.value = val;
            textarea.dispatchEvent(new Event('input'));
        }
    });

    return { widget, textarea };
}

// Create parameter widget
export function createParameterWidget(node, param) {
    const paramName = param.name;
    
    // Check if array title (no input slot, only display title)
    if (param.type === 'ARRAY_TITLE' || param.isArrayTitle) {
        return createArrayTitleWidget(node, param);
    }

    // Check if size title (no input slot, only display title)
    if (param.type === 'SIZE_TITLE' || param.isSizeTitle) {
        return createSizeTitleWidget(node, param);
    }

    // Check if object array item (e.g., bbox_condition with height/length/width)
    if (param.type === 'OBJECT_ARRAY_ITEM' || param.isObjectArrayItem) {
        return createObjectArrayItemWidget(node, param);
    }

    // PRIORITY FIX: Check COMBO type first (including size with enum)
    // CRITICAL FIX: Use DOM widget to avoid Vue caching issues
    // Issue: In Vue mode, when switching models with same parameter names,
    //   Vue caches widget components, causing getComponent() to use stale widget.type
    // Solution: Always use DOM widgets (works in both Canvas and Vue modes)
    if (param.type === "COMBO" && param.options && param.options.length > 0) {
        return createComboDomWidget(node, param);
    }

    // Check if size parameter (only for range-type size, not COMBO)
    if (isSizeParameter(paramName)) {
        return createSizeWidget(node, param);
    }

    // Check if parameter is a prompt parameter (needs multiline textarea)
    if (isPromptParameter(paramName) && param.type === "STRING") {
        return createPromptWidget(node, param);
    }
    
    // Prioritize mediaType already set in parameter object (for expanded array items)
    // Otherwise determine by parameter name
    const mediaType = param.mediaType || getMediaType(paramName, getOriginalApiType(param));
    const isMediaParam = mediaType !== 'file';

    let widget = null;
    const widgetName = paramName;

    // Check if parameter is a seed parameter
    const isSeedParam = isSeedParameter(paramName);

    if (isMediaParam) {
        // Media parameters use DOM widget
        const { widget: mediaWidget } = createMediaWidgetUI(node, param, mediaType, param.displayName, widgetName);
        widget = mediaWidget;
    } else if (isSeedParam && param.type === "INT") {
        // Seed parameters use special seed widget with fixed/random control
        widget = createSeedWidget(node, param);
    } else if (param.type === "INT") {
        // Use DOM widget (works in both Canvas and Vue modes, avoids Vue caching issues)
        widget = createNumberDomWidget(node, param, false);
    } else if (param.type === "FLOAT") {
        // Use DOM widget (works in both Canvas and Vue modes, avoids Vue caching issues)
        widget = createNumberDomWidget(node, param, true);
    } else if (param.type === "BOOLEAN") {
        // Use DOM widget (works in both Canvas and Vue modes, avoids Vue caching issues)
        widget = createToggleDomWidget(node, param);
    } else {
        // Use DOM widget (works in both Canvas and Vue modes, avoids Vue caching issues)
        widget = createTextDomWidget(node, param);
    }

    if (widget) {
        widget._wavespeed_dynamic = true;
        widget._wavespeed_param = param.name;

        // Initialize parameter value
        const existingValue = node.wavespeedState.parameterValues[param.name];
        if (existingValue !== undefined) {
            // Restore mode: use existing value from parameterValues
            widget.value = existingValue;
        } else {
            // New widget: initialize parameterValues with widget's default value
            node.wavespeedState.parameterValues[param.name] = widget.value !== undefined ? widget.value : (param.default || "");
        }
    }

    return widget;
}

// Update hidden widget value
export function updateHiddenWidget(node, name, value) {
    if (name === 'model_id' && node.modelIdWidget) {
        node.modelIdWidget.value = value;
    } else if (name === 'request_json' && node.requestJsonWidget) {
        node.requestJsonWidget.value = value;
    } else if (name === 'param_map' && node.paramMapWidget) {
        node.paramMapWidget.value = value;
    }
}

// Update request JSON
export function updateRequestJson(node) {
    const values = {};
    // Use expanded parameters for value collection (includes array items),
    // but keep original parameters (node.wavespeedState.parameters) for param_map / Python side.
    const parameters = node.wavespeedState.expandedParams || node.wavespeedState.parameters || [];
    const objectArrayGroups = {}; // Track object array items by parent array name

    for (const param of parameters) {
        const paramName = param.name;
        
        // Skip array parameters (they will be built from expanded items)
        if (param.isArray) {
            continue;
        }

        // Check if this is an object array item (e.g., bbox_condition_0)
        if (param.isObjectArrayItem && param.parentArrayName) {
            const parentArrayName = param.parentArrayName;
            if (!objectArrayGroups[parentArrayName]) {
                objectArrayGroups[parentArrayName] = [];
            }
            const itemValue = node.wavespeedState.parameterValues[paramName];
            if (itemValue && typeof itemValue === 'object' && Object.keys(itemValue).length > 0) {
                // For loras array: only include items with non-empty path (like images array behavior)
                // For other object arrays (e.g., bbox_condition): include if any field is non-empty
                if (parentArrayName === 'loras') {
                    // Only include if path exists and is non-empty
                    if (itemValue.path && itemValue.path.trim() !== '') {
                        const arrayIndex = param.arrayIndex !== undefined ? param.arrayIndex : objectArrayGroups[parentArrayName].length;
                        objectArrayGroups[parentArrayName][arrayIndex] = itemValue;
                    }
                } else {
                    // For other object arrays, keep original behavior (any field non-empty)
                    const arrayIndex = param.arrayIndex !== undefined ? param.arrayIndex : objectArrayGroups[parentArrayName].length;
                    objectArrayGroups[parentArrayName][arrayIndex] = itemValue;
                }
            }
            continue;
        }

        // Check if there is a connection
        const inputSlot = node.inputs?.find(inp => inp.name === paramName);
        const hasConnection = inputSlot && inputSlot.link != null;
        const mediaType = getMediaType(paramName, getOriginalApiType(param));
        const isMediaParam = mediaType !== 'file';

        if (hasConnection && isMediaParam) {
            continue;
        } else {
            if (node.wavespeedState.parameterValues[paramName] !== undefined) {
                values[paramName] = node.wavespeedState.parameterValues[paramName];
            }
        }
    }

    // Merge object array items into parent array parameters
    for (const parentArrayName in objectArrayGroups) {
        const arrayItems = objectArrayGroups[parentArrayName];
        // Filter out undefined entries and maintain order
        const validItems = arrayItems.filter(item => item !== undefined && item !== null);
        if (validItems.length > 0) {
            values[parentArrayName] = validItems;
        }
    }

    // Handle size parameters: merge size_width and size_height into size
    // If both width and height are empty/undefined, don't include size parameter
    const sizeParams = {};
    for (const paramName in values) {
        const match = paramName.match(/^(.+)_(width|height)$/);
        if (match) {
            const sizeName = match[1];
            const component = match[2];
            if (!sizeParams[sizeName]) {
                sizeParams[sizeName] = {};
            }
            sizeParams[sizeName][component] = values[paramName];
        }
    }
    
    // Build size parameters and remove component parameters
    for (const sizeName in sizeParams) {
        const width = sizeParams[sizeName].width;
        const height = sizeParams[sizeName].height;
        
        // Remove component parameters from values
        delete values[`${sizeName}_width`];
        delete values[`${sizeName}_height`];
        
        // Only add size parameter if both width and height have values
        if (width !== undefined && width !== null && width !== '' &&
            height !== undefined && height !== null && height !== '') {
            values[sizeName] = `${width}*${height}`;
        }
        // If either is empty, don't include size parameter at all
    }

    // Type conversion
    for (const paramName in values) {
        let value = values[paramName];
        const param = node.wavespeedState.parameters.find(p => p.name === paramName);
        if (param) {
            if (param.type === "INT" || param.type === "FLOAT") {
                value = typeof value === 'string' ? parseFloat(value) : value;
                if (isNaN(value)) {
                    if (param.default !== undefined && param.default !== null && param.default !== '') {
                        value = typeof param.default === 'string' ? parseFloat(param.default) : param.default;
                    } else if (param.min !== undefined && param.min !== null) {
                        value = param.min;
                    } else {
                        value = 0;
                    }
                }
                if (param.min !== undefined && param.min !== null) value = Math.max(param.min, value);
                if (param.max !== undefined && param.max !== null) value = Math.min(param.max, value);
                if (param.type === "INT") value = Math.round(value);
            } else if (param.type === "BOOLEAN") {
                value = Boolean(value);
            }
            values[paramName] = value;
        }
    }

    const jsonString = JSON.stringify(values);
    updateHiddenWidget(node, 'request_json', jsonString);

    // Update parameter mapping (use original schema parameters for Python side)
    const paramTypeMap = {};
    const paramTypeSource = node.wavespeedState.parameters || parameters;
    for (const param of paramTypeSource) {
        let backendType = "string";
        if (param.type === "INT" || param.type === "FLOAT") {
            backendType = "number";
        } else if (param.type === "BOOLEAN") {
            backendType = "boolean";
        } else if (param.type === "COMBO") {
            backendType = "string";
        }

        const paramInfo = { type: backendType };

        if (param.type === "COMBO" && param.options && Array.isArray(param.options)) {
            paramInfo.options = param.options;
        }

        if (param.isArray) {
            paramInfo.isArray = true;
            paramInfo.itemType = backendType;
        }

        paramTypeMap[param.name] = paramInfo;
    }
    
    const paramMapString = JSON.stringify(paramTypeMap);
    updateHiddenWidget(node, 'param_map', paramMapString);
}
