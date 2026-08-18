/**
 * Fuzzy search model selector - fzf-like experience
 * Fixed version: solve style and event issues in ComfyUI DOM widget
 */

/**
 * Create a loading progress indicator
 */
export function createLoadingProgress() {
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.textAlign = 'center';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // Title
    const title = document.createElement('div');
    title.textContent = '⏳ Loading WaveSpeed Models';
    title.style.fontSize = '14px';
    title.style.fontWeight = '600';
    title.style.color = '#4a9eff';
    title.style.marginBottom = '12px';
    container.appendChild(title);

    // Status text
    const statusText = document.createElement('div');
    statusText.textContent = 'Initializing...';
    statusText.style.fontSize = '12px';
    statusText.style.color = '#888';
    statusText.style.marginBottom = '8px';
    container.appendChild(statusText);

    // Progress bar container
    const progressBarBg = document.createElement('div');
    progressBarBg.style.width = '100%';
    progressBarBg.style.height = '6px';
    progressBarBg.style.backgroundColor = '#2a2a2a';
    progressBarBg.style.borderRadius = '3px';
    progressBarBg.style.overflow = 'hidden';
    progressBarBg.style.marginBottom = '8px';

    // Progress bar fill
    const progressBarFill = document.createElement('div');
    progressBarFill.style.width = '0%';
    progressBarFill.style.height = '100%';
    progressBarFill.style.backgroundColor = '#4a9eff';
    progressBarFill.style.transition = 'width 0.3s ease';
    progressBarBg.appendChild(progressBarFill);
    container.appendChild(progressBarBg);

    // Progress percentage
    const progressPercent = document.createElement('div');
    progressPercent.textContent = '0%';
    progressPercent.style.fontSize = '11px';
    progressPercent.style.color = '#666';
    container.appendChild(progressPercent);

    // Tip text
    const tipText = document.createElement('div');
    tipText.textContent = 'After configuring an API key, the first load usually takes 5-10 seconds. Subsequent loads use the cache.';
    tipText.style.fontSize = '11px';
    tipText.style.color = '#888';
    tipText.style.marginTop = '10px';
    tipText.style.fontStyle = 'italic';
    tipText.style.lineHeight = '1.4';
    container.appendChild(tipText);

    return {
        container,
        updateProgress: (progress) => {
            if (progress.step === 'categories') {
                statusText.textContent = `Loading categories (${progress.current})...`;
                progressBarFill.style.width = '10%';
                progressPercent.textContent = '10%';
            } else if (progress.step === 'models') {
                const percent = Math.min(95, progress.percent || 50);
                statusText.textContent = `Loading from ${progress.total} categories...`;
                progressBarFill.style.width = `${percent}%`;
                progressPercent.textContent = `${Math.round(percent)}%`;
            }
        },
        complete: () => {
            statusText.textContent = 'Loading complete!';
            progressBarFill.style.width = '100%';
            progressPercent.textContent = '100%';
        }
    };
}

export class FuzzyModelSelector {
    constructor(onModelSelect) {
        this.onModelSelect = onModelSelect;
        this.models = [];
        this.filteredModels = [];
        this.selectedIndex = 0;
        this.isOpen = false;
        this.searchQuery = '';
        
        // DOM elements
        this.container = null;
        this.input = null;
        this.dropdown = null;
        this.currentValue = 'Select a model...';
        
        // Bind methods
        this.boundDocumentClickHandler = this.handleDocumentClick.bind(this);
        this.boundKeydownHandler = this.handleKeydown.bind(this);
    }
    
    // Create component
    create() {
        this.container = document.createElement('div');
        this.container.className = 'fuzzy-model-selector';
        this.container.style.position = 'relative';
        this.container.style.width = '100%';
        this.container.style.zIndex = '10';
        
        // Input wrapper
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'fuzzy-model-input-wrapper';
        inputWrapper.style.position = 'relative';
        inputWrapper.style.display = 'flex';
        inputWrapper.style.alignItems = 'center';
        
        // Search icon
        const searchIcon = document.createElement('span');
        searchIcon.className = 'fuzzy-search-icon';
        searchIcon.textContent = '🔍';
        searchIcon.style.position = 'absolute';
        searchIcon.style.left = '10px';
        searchIcon.style.top = '50%';
        searchIcon.style.transform = 'translateY(-50%)';
        searchIcon.style.fontSize = '12px';
        searchIcon.style.opacity = '0.6';
        searchIcon.style.pointerEvents = 'none';
        searchIcon.style.zIndex = '11';
        
        // Input box
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'fuzzy-model-input';
        this.input.placeholder = 'Search models...';
        this.input.value = this.currentValue;
        this.input.readOnly = true;
        this.input.style.width = '100%';
        this.input.style.padding = '8px 12px 8px 32px';
        this.input.style.backgroundColor = '#2a2a2a';
        this.input.style.color = '#e0e0e0';
        this.input.style.border = '1px solid #444';
        this.input.style.borderRadius = '4px';
        this.input.style.fontSize = '13px';
        this.input.style.cursor = 'pointer';
        this.input.style.boxSizing = 'border-box';
        
        inputWrapper.appendChild(searchIcon);
        inputWrapper.appendChild(this.input);
        
        // Dropdown list - will be mounted to document.body
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'fuzzy-model-dropdown';
        this.dropdown.style.display = 'none';
        this.dropdown.style.position = 'fixed'; // Use fixed positioning
        this.dropdown.style.backgroundColor = '#2a2a2a';
        this.dropdown.style.border = '1px solid #4a9eff';
        this.dropdown.style.borderTop = 'none';
        this.dropdown.style.borderRadius = '0 0 4px 4px';
        this.dropdown.style.maxHeight = '250px';
        this.dropdown.style.overflowY = 'auto';
        this.dropdown.style.zIndex = '999999'; // Very high z-index
        this.dropdown.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
        
        // Setup event listeners
        this.setupEventListeners();
        
        this.container.appendChild(inputWrapper);
        // Dropdown mounted to body, not inside container
        document.body.appendChild(this.dropdown);
        
        return this.container;
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Click input box
        this.input.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });
        
        // Prevent input box mousedown bubbling (prevent node dragging)
        this.input.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        // Input search
        this.input.addEventListener('input', (e) => {
            if (!this.isOpen) return;
            this.searchQuery = e.target.value;
            this.filterModels();
            this.selectedIndex = 0;
            this.renderDropdown();
            this.scrollToSelected();
        });
        
        // Prevent dropdown event bubbling
        this.dropdown.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        this.dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Scroll event prevent bubbling
        this.dropdown.addEventListener('wheel', (e) => {
            e.stopPropagation();
        });
    }
    
    // Handle document click (close dropdown)
    handleDocumentClick(e) {
        if (this.isOpen && this.container && !this.container.contains(e.target)) {
            this.close();
        }
    }
    
    // Handle keyboard events
    handleKeydown(e) {
        if (!this.isOpen) return;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                e.stopPropagation();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredModels.length - 1);
                this.renderDropdown();
                this.scrollToSelected();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                e.stopPropagation();
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.renderDropdown();
                this.scrollToSelected();
                break;
                
            case 'Enter':
                e.preventDefault();
                e.stopPropagation();
                if (this.filteredModels[this.selectedIndex]) {
                    this.selectModel(this.filteredModels[this.selectedIndex]);
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                e.stopPropagation();
                this.close();
                break;
        }
    }
    
    // Scroll to selected item
    scrollToSelected() {
        const selectedItem = this.dropdown.querySelector('.fuzzy-model-item.selected');
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    // Fuzzy search algorithm
    fuzzyMatch(query, text) {
        if (!query || !text) return { score: 0, matches: [] };
        
        query = query.toLowerCase();
        text = text.toLowerCase();
        
        let queryIndex = 0;
        let textIndex = 0;
        let score = 0;
        let matches = [];
        let consecutiveMatches = 0;
        
        while (queryIndex < query.length && textIndex < text.length) {
            if (query[queryIndex] === text[textIndex]) {
                matches.push(textIndex);
                
                if (queryIndex > 0 && matches[queryIndex - 1] === textIndex - 1) {
                    consecutiveMatches++;
                    score += 2 + consecutiveMatches;
                } else {
                    consecutiveMatches = 0;
                    score += 1;
                }
                
                if (textIndex === 0 || text[textIndex - 1] === ' ' || text[textIndex - 1] === '-' || text[textIndex - 1] === '/') {
                    score += 3;
                }
                
                queryIndex++;
            }
            textIndex++;
        }
        
        if (queryIndex < query.length) {
            return { score: 0, matches: [] };
        }
        
        score = score * 100 / text.length;
        return { score, matches };
    }
    
    // Filter models
    filterModels() {
        if (!this.searchQuery.trim()) {
            this.filteredModels = [...this.models];
            return;
        }
        
        const results = this.models.map(model => {
            const displayMatch = this.fuzzyMatch(this.searchQuery, model.displayName || '');
            const idMatch = this.fuzzyMatch(this.searchQuery, model.modelId || '');
            const categoryMatch = this.fuzzyMatch(this.searchQuery, model.categoryName || '');
            
            const bestScore = Math.max(displayMatch.score, idMatch.score, categoryMatch.score);
            
            return {
                model,
                score: bestScore,
                matches: displayMatch.score >= idMatch.score ? displayMatch.matches : idMatch.matches
            };
        }).filter(result => result.score > 0);
        
        results.sort((a, b) => b.score - a.score);
        this.filteredModels = results.map(result => result.model);
    }
    
    // Highlight matching text
    highlightMatches(text, query) {
        if (!query || !text) return text || '';
        
        const match = this.fuzzyMatch(query, text);
        if (match.matches.length === 0) return text;
        
        let result = '';
        let lastIndex = 0;
        
        match.matches.forEach(matchIndex => {
            result += this.escapeHtml(text.slice(lastIndex, matchIndex));
            result += `<span style="background-color:#ffeb3b;color:#000;font-weight:bold;padding:0 1px;border-radius:2px;">${this.escapeHtml(text[matchIndex])}</span>`;
            lastIndex = matchIndex + 1;
        });
        
        result += this.escapeHtml(text.slice(lastIndex));
        return result;
    }
    
    // HTML escape
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Update item styles without re-rendering
    updateItemStyles() {
        const items = this.dropdown.querySelectorAll('.fuzzy-model-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.style.backgroundColor = '#4a9eff';
                item.style.color = 'white';
                const modelIdEl = item.querySelector('div:last-child');
                if (modelIdEl) {
                    modelIdEl.style.color = 'rgba(255,255,255,0.8)';
                }
            } else {
                item.classList.remove('selected');
                item.style.backgroundColor = 'transparent';
                item.style.color = '#e0e0e0';
                const modelIdEl = item.querySelector('div:last-child');
                if (modelIdEl) {
                    modelIdEl.style.color = '#888';
                }
            }
        });
    }
    
    // Render dropdown
    renderDropdown() {
        this.dropdown.innerHTML = '';
        
        if (this.filteredModels.length === 0) {
            const noResults = document.createElement('div');
            noResults.style.padding = '12px';
            noResults.style.color = '#888';
            noResults.style.textAlign = 'center';
            noResults.style.fontStyle = 'italic';
            noResults.textContent = this.searchQuery.trim() ? 'No models found' : 'Type to search...';
            this.dropdown.appendChild(noResults);
            return;
        }
        
        // Limit display count for performance
        const displayModels = this.filteredModels.slice(0, 50);
        
        displayModels.forEach((model, index) => {
            const item = document.createElement('div');
            item.className = 'fuzzy-model-item';
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.borderBottom = '1px solid #333';
            item.style.transition = 'background-color 0.1s ease';
            item.style.pointerEvents = 'auto'; // Ensure pointer events work
            
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.style.backgroundColor = '#4a9eff';
                item.style.color = 'white';
            } else {
                item.style.backgroundColor = 'transparent';
                item.style.color = '#e0e0e0';
            }
            
            // Model name
            const displayName = document.createElement('div');
            displayName.style.fontWeight = '500';
            displayName.style.fontSize = '13px';
            displayName.style.marginBottom = '2px';
            displayName.style.lineHeight = '1.3';
            displayName.style.pointerEvents = 'none'; // Let parent handle clicks
            displayName.innerHTML = this.highlightMatches(model.displayName || '', this.searchQuery);
            
            // Model ID
            const modelId = document.createElement('div');
            modelId.style.fontSize = '11px';
            modelId.style.color = index === this.selectedIndex ? 'rgba(255,255,255,0.8)' : '#888';
            modelId.style.fontFamily = 'monospace';
            modelId.style.pointerEvents = 'none'; // Let parent handle clicks
            modelId.innerHTML = this.highlightMatches(model.modelId || '', this.searchQuery);
            
            item.appendChild(displayName);
            item.appendChild(modelId);
            
            // Click to select
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectModel(model);
            });
            
            // Also try click event as backup
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectModel(model);
            });
            
            // Mouse hover highlight
            item.addEventListener('mouseenter', () => {
                const oldIndex = this.selectedIndex;
                this.selectedIndex = index;
                // Don't re-render, just update styles
                if (oldIndex !== index) {
                    this.updateItemStyles();
                }
            });
            
            this.dropdown.appendChild(item);
        });
        
        // If more results, show hint
        if (this.filteredModels.length > 50) {
            const moreInfo = document.createElement('div');
            moreInfo.style.padding = '8px 12px';
            moreInfo.style.color = '#4a9eff';
            moreInfo.style.fontSize = '11px';
            moreInfo.style.textAlign = 'center';
            moreInfo.style.borderTop = '1px solid #444';
            moreInfo.textContent = `... and ${this.filteredModels.length - 50} more. Type to filter.`;
            this.dropdown.appendChild(moreInfo);
        }
    }
    
    // Select model
    selectModel(model) {
        if (!model) return;
        
        this.currentValue = model.displayName || 'Unknown Model';
        this.input.value = this.currentValue;
        this.close();
        
        if (this.onModelSelect) {
            try {
                this.onModelSelect(this.currentValue);
            } catch (error) {
                console.error('[FuzzyModelSelector] Error in onModelSelect:', error);
            }
        }
    }
    
    // Open dropdown
    open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.input.readOnly = false;
        this.input.value = this.searchQuery;
        this.input.style.borderColor = '#4a9eff';
        this.input.style.borderBottomLeftRadius = '0';
        this.input.style.borderBottomRightRadius = '0';
        this.input.focus();
        this.input.select();
        
        // Elevate container z-index to ensure dropdown is on top
        this.container.style.zIndex = '99999';
        
        // Use fixed positioning to ensure dropdown is above all elements
        const inputRect = this.input.getBoundingClientRect();
        this.dropdown.style.position = 'fixed';
        this.dropdown.style.top = `${inputRect.bottom}px`;
        this.dropdown.style.left = `${inputRect.left}px`;
        this.dropdown.style.width = `${inputRect.width}px`;
        this.dropdown.style.zIndex = '999999';
        
        this.filterModels();
        this.renderDropdown();
        this.dropdown.style.display = 'block';
        
        this.container.classList.add('open');
        
        // Add global event listeners
        setTimeout(() => {
            document.addEventListener('click', this.boundDocumentClickHandler, true);
            document.addEventListener('keydown', this.boundKeydownHandler, true);
        }, 0);
    }
    
    // Close dropdown
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.input.readOnly = true;
        this.input.value = this.currentValue;
        this.input.style.borderColor = '#444';
        this.input.style.borderRadius = '4px';
        this.searchQuery = '';
        this.dropdown.style.display = 'none';
        this.selectedIndex = 0;
        
        // Restore dropdown to relative positioning
        this.dropdown.style.position = 'absolute';
        this.dropdown.style.top = '100%';
        this.dropdown.style.left = '0';
        this.dropdown.style.right = '0';
        this.dropdown.style.width = 'auto';
        
        // Restore container z-index
        this.container.style.zIndex = '10';
        
        this.container.classList.remove('open');
        
        // Remove global event listeners
        document.removeEventListener('click', this.boundDocumentClickHandler, true);
        document.removeEventListener('keydown', this.boundKeydownHandler, true);
    }
    
    // Toggle state
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    // Update model list
    updateModels(models) {
        this.models = (models || []).map(model => ({
            modelId: model.modelId || '',
            displayName: model.displayName || 'Unknown Model',
            categoryName: model.categoryName || '',
            name: model.name || '',
            originalModel: model.originalModel || model
        }));
        this.filteredModels = [...this.models];
        
        if (this.isOpen) {
            this.filterModels();
            this.renderDropdown();
        }
    }
    
    // Set current value
    setValue(value) {
        this.currentValue = value;
        if (!this.isOpen && this.input) {
            this.input.value = value;
        }
    }
    
    // Set current value (without triggering callback, used for workflow restore)
    setValueWithoutCallback(value) {
        this.currentValue = value;
        if (this.input) {
            this.input.value = value;
        }
    }
    
    // Get current value
    getValue() {
        return this.currentValue;
    }
    
    // Destroy component
    destroy() {
        this.close();
        document.removeEventListener('click', this.boundDocumentClickHandler, true);
        document.removeEventListener('keydown', this.boundKeydownHandler, true);
        // Remove dropdown from body
        if (this.dropdown && this.dropdown.parentNode) {
            this.dropdown.parentNode.removeChild(this.dropdown);
        }
    }
}
