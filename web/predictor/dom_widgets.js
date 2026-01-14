/**
 * WaveSpeed Predictor - DOM widgets module (non-media now, media later)
 * Naming convention:
 *   createNonMediaDom* for non-media inputs
 *   createMediaDom* for media inputs (reserved)
 */

function createLabel(text, isRequired, description) {
    const label = document.createElement('div');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '4px';
    label.style.color = '#cfd3da';
    label.style.fontSize = '12px';
    label.style.fontWeight = '500';

    const labelText = document.createElement('span');
    labelText.textContent = text || '';
    label.appendChild(labelText);

    if (isRequired) {
        const requiredMark = document.createElement('span');
        requiredMark.textContent = '*';
        requiredMark.style.color = '#ff6b6b';
        requiredMark.style.fontSize = '12px';
        requiredMark.style.fontWeight = 'normal';
        label.appendChild(requiredMark);
    }

    if (description) {
        const info = document.createElement('span');
        info.textContent = '?';
        info.title = description;
        info.style.display = 'inline-flex';
        info.style.alignItems = 'center';
        info.style.justifyContent = 'center';
        info.style.width = '14px';
        info.style.height = '14px';
        info.style.border = '1px solid #666';
        info.style.borderRadius = '50%';
        info.style.color = '#888';
        info.style.fontSize = '10px';
        info.style.cursor = 'help';
        label.appendChild(info);
    }

    return label;
}

function createRowContainer() {
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'minmax(120px, max-content) 1fr';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.padding = '6px 0';
    return row;
}

function createInputBase() {
    const input = document.createElement('input');
    input.type = 'text';
    input.style.width = '100%';
    input.style.padding = '6px 8px';
    input.style.borderRadius = '6px';
    input.style.border = '1px solid #3a3f47';
    input.style.background = '#1f2329';
    input.style.color = '#e6e6e6';
    input.style.fontSize = '12px';
    return input;
}

function createTextareaBase() {
    const textarea = document.createElement('textarea');
    textarea.rows = 4;
    textarea.style.width = '100%';
    textarea.style.padding = '6px 8px';
    textarea.style.borderRadius = '6px';
    textarea.style.border = '1px solid #3a3f47';
    textarea.style.background = '#1f2329';
    textarea.style.color = '#e6e6e6';
    textarea.style.fontSize = '12px';
    textarea.style.resize = 'vertical';
    return textarea;
}

function createSelectBase(options) {
    const select = document.createElement('select');
    select.style.width = '100%';
    select.style.padding = '6px 8px';
    select.style.borderRadius = '6px';
    select.style.border = '1px solid #3a3f47';
    select.style.background = '#1f2329';
    select.style.color = '#e6e6e6';
    select.style.fontSize = '12px';
    for (const opt of options || []) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    }
    return select;
}

function applyDisabled(el, disabled) {
    if (!el) return;
    el.disabled = !!disabled;
    el.style.opacity = disabled ? '0.6' : '1';
    el.style.pointerEvents = disabled ? 'none' : 'auto';
}

function createDomWidgetBase(node, param, inputEl, onChange) {
    const container = createRowContainer();
    const label = createLabel(param.displayName || param.name, param.required, param.description);
    container.appendChild(label);
    container.appendChild(inputEl);

    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });
    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;

    const setValue = (value) => {
        if (inputEl instanceof HTMLInputElement || inputEl instanceof HTMLTextAreaElement) {
            inputEl.value = value ?? '';
        } else if (inputEl instanceof HTMLSelectElement) {
            inputEl.value = value ?? '';
        }
    };

    const restoreValue = (value) => {
        setValue(value);
        if (onChange) onChange(value);
    };

    return { widget, container, inputEl, setValue, restoreValue };
}

export function createNonMediaDomText(node, param, config = {}) {
    const inputEl = config.multiline ? createTextareaBase() : createInputBase();
    inputEl.placeholder = config.placeholder || '';

    const onChange = (value) => {
        if (config.onChange) config.onChange(value);
    };

    inputEl.addEventListener('input', (e) => onChange(e.target.value));

    const result = createDomWidgetBase(node, param, inputEl, onChange);
    applyDisabled(inputEl, config.disabled);
    if (config.initialValue !== undefined) result.setValue(config.initialValue);
    return result;
}

export function createNonMediaDomNumber(node, param, config = {}) {
    const inputEl = createInputBase();
    inputEl.type = 'number';
    if (config.min !== undefined) inputEl.min = String(config.min);
    if (config.max !== undefined) inputEl.max = String(config.max);
    if (config.step !== undefined) inputEl.step = String(config.step);

    const onChange = (value) => {
        const parsed = value === '' ? '' : Number(value);
        if (config.onChange) config.onChange(parsed);
    };

    inputEl.addEventListener('input', (e) => onChange(e.target.value));

    const result = createDomWidgetBase(node, param, inputEl, onChange);
    applyDisabled(inputEl, config.disabled);
    if (config.initialValue !== undefined) result.setValue(config.initialValue);
    return result;
}

export function createNonMediaDomSelect(node, param, config = {}) {
    const inputEl = createSelectBase(config.options || []);

    const onChange = (value) => {
        if (config.onChange) config.onChange(value);
    };

    inputEl.addEventListener('change', (e) => onChange(e.target.value));

    const result = createDomWidgetBase(node, param, inputEl, onChange);
    applyDisabled(inputEl, config.disabled);
    if (config.initialValue !== undefined) result.setValue(config.initialValue);
    return result;
}

export function setNonMediaDomDisabled(domWidget, disabled) {
    if (!domWidget) return;
    applyDisabled(domWidget.inputEl, disabled);
}

export function createSizeTitleDom(param, rangeText) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '8px';
    container.style.padding = '8px 10px';
    container.style.backgroundColor = '#2a2a2a';
    container.style.border = '1px solid #444';
    container.style.borderRadius = '4px 4px 0 0';

    const titleLabel = createLabel(param.displayName || param.name, param.required, param.description);
    titleLabel.style.color = '#e0e0e0';
    titleLabel.style.fontSize = '12px';
    titleLabel.style.fontWeight = '500';

    const rangeInfo = document.createElement('span');
    rangeInfo.textContent = rangeText || '';
    rangeInfo.style.color = '#666';
    rangeInfo.style.marginLeft = 'auto';
    rangeInfo.style.fontSize = '11px';

    container.appendChild(titleLabel);
    container.appendChild(rangeInfo);

    return container;
}

// Helper function to initialize size values based on x-hidden and defaults
export function initializeSizeValues(param, parsedDefault, storedWidth, storedHeight) {
    let width = storedWidth;
    let height = storedHeight;

    if (param.xHidden === true) {
        // x-hidden: only use API default values, otherwise keep null (empty)
        if (width === null && parsedDefault) {
            width = parsedDefault.width;
        }
        if (height === null && parsedDefault) {
            height = parsedDefault.height;
        }
    } else {
        // non x-hidden: use default values or fallback to 1024
        if (width === null) {
            width = parsedDefault?.width || 1024;
        }
        if (height === null) {
            height = parsedDefault?.height || 1024;
        }
    }

    return { width, height };
}

export function createSizeRatioDom(presets, onSelect) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '4px';
    container.style.padding = '6px 10px';
    container.style.backgroundColor = '#2a2a2a';
    container.style.border = '1px solid #444';
    container.style.borderTop = 'none';

    const buttons = [];
    (presets || []).forEach((preset) => {
        const btn = document.createElement('button');
        btn.className = 'wavespeed-ratio-btn';
        btn.dataset.ratio = preset.label;
        btn.innerHTML = `<span class="ratio-icon" style="font-size:10px;opacity:0.7;">${preset.icon}</span><span class="ratio-label" style="font-weight:500;">${preset.label}</span>`;
        btn.title = `${preset.width} x ${preset.height}`;
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '4px';
        btn.style.padding = '4px 8px';
        btn.style.backgroundColor = '#2a2a2a';
        btn.style.color = '#e0e0e0';
        btn.style.border = '1px solid #444';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '11px';
        btn.style.transition = 'all 0.2s ease';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (onSelect) onSelect(preset);
        });

        buttons.push(btn);
        container.appendChild(btn);
    });

    return { container, buttons };
}

export function createSizeAxisDom(labelText, value, min, max, onInput, onBlur) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '8px';
    container.style.padding = '6px 10px';
    container.style.backgroundColor = '#2a2a2a';
    container.style.border = '1px solid #444';
    container.style.borderTop = 'none';

    const label = document.createElement('label');
    label.textContent = labelText || '';
    label.style.color = '#888';
    label.style.fontSize = '11px';
    label.style.minWidth = '48px';

    const input = document.createElement('input');
    input.type = 'number';
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
    input.step = '8';
    input.style.flex = '1';
    input.style.width = '100%';
    input.style.padding = '6px 10px';
    input.style.backgroundColor = '#2a2a2a';
    input.style.color = '#e0e0e0';
    input.style.border = '1px solid #444';
    input.style.borderRadius = '4px';
    input.style.fontSize = '13px';
    input.style.fontFamily = '-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif';
    input.style.textAlign = 'center';
    input.style.boxSizing = 'border-box';
    input.value = value ?? '';

    input.addEventListener('input', (e) => {
        if (onInput) onInput(e.target.value, input);
    });
    input.addEventListener('blur', (e) => {
        if (onBlur) onBlur(e.target.value, input, labelText || '');
    });

    container.appendChild(label);
    container.appendChild(input);

    return { container, input };
}

export function showSizeToast(message, anchorEl) {
    if (!anchorEl || !anchorEl.ownerDocument) return;
    const doc = anchorEl.ownerDocument;
    const rect = anchorEl.getBoundingClientRect();
    const toast = doc.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.left = `${Math.max(8, rect.left)}px`;
    toast.style.top = `${Math.max(8, rect.top - 28)}px`;
    toast.style.padding = '4px 8px';
    toast.style.background = '#1f1f1f';
    toast.style.color = '#f1f1f1';
    toast.style.border = '1px solid #b04a4a';
    toast.style.borderRadius = '4px';
    toast.style.fontSize = '11px';
    toast.style.zIndex = '9999';
    toast.style.pointerEvents = 'none';
    doc.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 1800);
}

// Create COMBO (dropdown) DOM widget
export function createComboDomWidget(node, param) {
    const options = param.options || [];
    const defaultValue = param.default || (options.length > 0 ? options[0] : '');
    
    // Create container with horizontal layout (single-row, matching other widgets)
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.width = '100%';
    container.style.gap = '8px';
    container.style.marginBottom = '4px';
    
    // Label (blue color matching media widgets)
    const label = createLabel(param.displayName || param.name, param.required, param.description);
    label.style.color = '#4a9eff';
    label.style.fontSize = '12px';
    label.style.fontWeight = '600';
    label.style.minWidth = 'max-content';
    label.style.flexShrink = '0';
    
    // Select element (fixed width on right side)
    const select = document.createElement('select');
    select.style.minWidth = '150px';
    select.style.maxWidth = '300px';
    select.style.padding = '5px 10px';
    select.style.backgroundColor = '#2a2a2a';
    select.style.color = '#e0e0e0';
    select.style.border = '1px solid #444';
    select.style.borderRadius = '4px';
    select.style.fontSize = '13px';
    select.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    select.style.cursor = 'pointer';
    select.style.boxSizing = 'border-box';
    
    for (const opt of options) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    }
    
    select.value = defaultValue;
    
    const onChange = (value) => {
        node.wavespeedState.parameterValues[param.name] = value;
        // Import and call updateRequestJson
        import('./widgets.js').then(module => {
            module.updateRequestJson(node);
        });
    };
    
    select.addEventListener('change', (e) => {
        onChange(e.target.value);
    });
    
    container.appendChild(label);
    container.appendChild(select);
    
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });
    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;
    
    // Initialize parameter value
    const existingValue = node.wavespeedState.parameterValues[param.name];
    if (existingValue !== undefined) {
        select.value = existingValue;
    } else {
        node.wavespeedState.parameterValues[param.name] = defaultValue;
    }
    
    // Add restoreValue method for workflow restoration
    widget.restoreValue = (value) => {
        select.value = value;
        onChange(value);
    };
    
    widget.inputEl = select;
    
    return widget;
}

// Create BOOLEAN (toggle) DOM widget
export function createToggleDomWidget(node, param) {
    // Create container with horizontal layout (single row, button on right)
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.gap = '8px';
    container.style.width = '100%';
    container.style.marginBottom = '4px';
    
    // Label (blue color matching media widgets)
    const label = createLabel(param.displayName || param.name, param.required, param.description);
    label.style.color = '#4a9eff';
    label.style.fontSize = '12px';
    label.style.fontWeight = '600';
    label.style.minWidth = 'max-content';
    label.style.flexShrink = '0';
    
    // Toggle switch (no background box, just the switch)
    const toggleSwitch = document.createElement('label');
    toggleSwitch.style.position = 'relative';
    toggleSwitch.style.display = 'inline-block';
    toggleSwitch.style.width = '44px';
    toggleSwitch.style.height = '24px';
    toggleSwitch.style.cursor = 'pointer';
    toggleSwitch.style.flexShrink = '0';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = param.default || false;
    checkbox.style.opacity = '0';
    checkbox.style.width = '0';
    checkbox.style.height = '0';
    
    const slider = document.createElement('span');
    slider.style.position = 'absolute';
    slider.style.top = '0';
    slider.style.left = '0';
    slider.style.right = '0';
    slider.style.bottom = '0';
    slider.style.backgroundColor = checkbox.checked ? '#4a9eff' : '#3a3f47';
    slider.style.borderRadius = '24px';
    slider.style.transition = 'background-color 0.2s';
    
    const knob = document.createElement('span');
    knob.style.position = 'absolute';
    knob.style.content = '""';
    knob.style.height = '18px';
    knob.style.width = '18px';
    knob.style.left = checkbox.checked ? '23px' : '3px';
    knob.style.bottom = '3px';
    knob.style.backgroundColor = 'white';
    knob.style.borderRadius = '50%';
    knob.style.transition = 'left 0.2s';
    
    slider.appendChild(knob);
    toggleSwitch.appendChild(checkbox);
    toggleSwitch.appendChild(slider);
    
    const onChange = (value) => {
        node.wavespeedState.parameterValues[param.name] = value;
        slider.style.backgroundColor = value ? '#4a9eff' : '#3a3f47';
        knob.style.left = value ? '23px' : '3px';
        // Import and call updateRequestJson
        import('./widgets.js').then(module => {
            module.updateRequestJson(node);
        });
    };
    
    checkbox.addEventListener('change', (e) => {
        onChange(e.target.checked);
    });
    
    container.appendChild(label);
    container.appendChild(toggleSwitch);
    
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });
    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;
    
    // Initialize parameter value
    const existingValue = node.wavespeedState.parameterValues[param.name];
    if (existingValue !== undefined) {
        checkbox.checked = existingValue;
        onChange(existingValue);
    } else {
        node.wavespeedState.parameterValues[param.name] = checkbox.checked;
    }
    
    // Add restoreValue method for workflow restoration
    widget.restoreValue = (value) => {
        checkbox.checked = value;
        onChange(value);
    };
    
    // Store reference for external access
    widget.inputEl = checkbox;
    
    return widget;
}

// Create INT/FLOAT number DOM widget
export function createNumberDomWidget(node, param, isFloat = false) {
    const min = param.min !== undefined ? param.min : null;
    const max = param.max !== undefined ? param.max : null;
    const step = isFloat ? (param.step !== undefined ? param.step : 0.1) : 1;
    
    let defaultValue;
    if (param.default !== undefined && param.default !== null && param.default !== '') {
        defaultValue = isFloat ? param.default : Math.round(param.default);
    } else if (min !== null) {
        defaultValue = isFloat ? min : Math.round(min);
    } else {
        defaultValue = isFloat ? 0.0 : 0;
    }
    
    if (min !== null) defaultValue = Math.max(min, defaultValue);
    if (max !== null) defaultValue = Math.min(max, defaultValue);
    if (!isFloat) defaultValue = Math.round(defaultValue);
    
    // Create container with horizontal layout (single row, input on right)
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.gap = '8px';
    container.style.width = '100%';
    container.style.marginBottom = '4px';
    
    // Label (blue color matching media widgets)
    const label = createLabel(param.displayName || param.name, param.required, param.description);
    label.style.color = '#4a9eff';
    label.style.fontSize = '12px';
    label.style.fontWeight = '600';
    label.style.minWidth = 'max-content';
    label.style.flexShrink = '0';
    
    // Input element (fixed width on right side)
    const input = document.createElement('input');
    input.type = 'number';
    if (min !== null) input.min = String(min);
    if (max !== null) input.max = String(max);
    input.step = String(step);
    input.value = String(defaultValue);
    input.style.minWidth = '100px';
    input.style.maxWidth = '200px';
    input.style.padding = '5px 10px';
    input.style.backgroundColor = '#2a2a2a';
    input.style.color = '#e0e0e0';
    input.style.border = '1px solid #444';
    input.style.borderRadius = '4px';
    input.style.fontSize = '13px';
    input.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    input.style.boxSizing = 'border-box';
    
    const onChange = (value) => {
        let parsed = value === '' ? defaultValue : (isFloat ? parseFloat(value) : parseInt(value));
        if (isNaN(parsed)) parsed = defaultValue;
        if (min !== null) parsed = Math.max(min, parsed);
        if (max !== null) parsed = Math.min(max, parsed);
        if (!isFloat) parsed = Math.round(parsed);
        
        node.wavespeedState.parameterValues[param.name] = parsed;
        // Import and call updateRequestJson
        import('./widgets.js').then(module => {
            module.updateRequestJson(node);
        });
    };
    
    input.addEventListener('input', (e) => {
        onChange(e.target.value);
    });
    
    container.appendChild(label);
    container.appendChild(input);
    
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });
    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;
    
    // Initialize parameter value
    const existingValue = node.wavespeedState.parameterValues[param.name];
    if (existingValue !== undefined) {
        input.value = String(existingValue);
    } else {
        node.wavespeedState.parameterValues[param.name] = defaultValue;
    }
    
    // Add restoreValue method for workflow restoration
    widget.restoreValue = (value) => {
        input.value = String(value);
        onChange(value);
    };
    
    widget.inputEl = input;
    
    return widget;
}

// Create TEXT/STRING DOM widget
export function createTextDomWidget(node, param) {
    const defaultValue = param.default || '';
    
    // Create container with horizontal layout (single row, input on right)
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'space-between';
    container.style.gap = '8px';
    container.style.width = '100%';
    container.style.marginBottom = '4px';
    
    // Label (blue color matching media widgets)
    const label = createLabel(param.displayName || param.name, param.required, param.description);
    label.style.color = '#4a9eff';
    label.style.fontSize = '12px';
    label.style.fontWeight = '600';
    label.style.minWidth = 'max-content';
    label.style.flexShrink = '0';
    
    // Input element (fixed width on right side)
    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue;
    input.placeholder = `Enter ${(param.displayName || param.name).toLowerCase()}...`;
    input.style.minWidth = '150px';
    input.style.maxWidth = '300px';
    input.style.padding = '5px 10px';
    input.style.backgroundColor = '#2a2a2a';
    input.style.color = '#e0e0e0';
    input.style.border = '1px solid #444';
    input.style.borderRadius = '4px';
    input.style.fontSize = '13px';
    input.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    input.style.boxSizing = 'border-box';
    
    const onChange = (value) => {
        node.wavespeedState.parameterValues[param.name] = value;
        // Import and call updateRequestJson
        import('./widgets.js').then(module => {
            module.updateRequestJson(node);
        });
    };
    
    input.addEventListener('input', (e) => {
        onChange(e.target.value);
    });
    
    container.appendChild(label);
    container.appendChild(input);
    
    const widget = node.addDOMWidget(param.name, 'div', container, { serialize: false });
    widget._wavespeed_dynamic = true;
    widget._wavespeed_param = param.name;
    
    // Initialize parameter value
    const existingValue = node.wavespeedState.parameterValues[param.name];
    if (existingValue !== undefined) {
        input.value = existingValue;
    } else {
        node.wavespeedState.parameterValues[param.name] = defaultValue;
    }
    
    // Add restoreValue method for workflow restoration
    widget.restoreValue = (value) => {
        input.value = value;
        onChange(value);
    };
    
    widget.inputEl = input;
    
    return widget;
}
