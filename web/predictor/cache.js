export function createModelCache(storage, options = {}) {
    const cacheExpiry = options.cacheExpiry ?? 5 * 60 * 1000;
    const now = options.now ?? (() => Date.now());

    return {
        cacheExpiry,
        stats: { hits: 0, misses: 0, lastUpdate: now() },

        _read(key) {
            try {
                const cached = storage.getItem(key);
                if (cached) {
                    const data = JSON.parse(cached);
                    const isFresh = Number.isFinite(data.timestamp)
                        && now() - data.timestamp < this.cacheExpiry;
                    if (isFresh) {
                        this.stats.hits++;
                        return data.value;
                    }
                    storage.removeItem(key);
                }
            } catch (error) {
                try {
                    storage.removeItem(key);
                } catch (removeError) {}
            }
            this.stats.misses++;
            return null;
        },

        _write(key, value) {
            try {
                storage.setItem(key, JSON.stringify({ value, timestamp: now() }));
                this.stats.lastUpdate = now();
            } catch (error) {}
        },

        get categories() {
            return this._read("wavespeed_categories");
        },

        set categories(value) {
            this._write("wavespeed_categories", value);
        },

        getModelsByCategory(category) {
            return this._read(`wavespeed_models_${category}`);
        },

        setModelsByCategory(category, value) {
            this._write(`wavespeed_models_${category}`, value);
        },

        getModelDetail(modelId) {
            return this._read(`wavespeed_model_${modelId}`);
        },

        setModelDetail(modelId, value) {
            this._write(`wavespeed_model_${modelId}`, value);
        },

        clearAll() {
            try {
                const keys = [];
                for (let index = 0; index < storage.length; index++) {
                    keys.push(storage.key(index));
                }
                for (const key of keys) {
                    if (key?.startsWith("wavespeed_")) {
                        storage.removeItem(key);
                    }
                }
                this.stats = { hits: 0, misses: 0, lastUpdate: now() };
            } catch (error) {
                console.error("[WaveSpeed] Failed to clear cache:", error);
            }
        },

        getCacheStats() {
            const total = this.stats.hits + this.stats.misses;
            const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : 0;
            return {
                hits: this.stats.hits,
                misses: this.stats.misses,
                total,
                hitRate: `${hitRate}%`,
                lastUpdate: new Date(this.stats.lastUpdate).toLocaleString()
            };
        }
    };
}
