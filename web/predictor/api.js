/**
 * WaveSpeed Predictor - API calls and cache management module
 */

import { api } from "../../../../scripts/api.js";
import { createModelCache } from "./cache.js";

// Global cache management
const GLOBAL_CACHE = createModelCache(localStorage);

// API call functions
export async function fetchWaveSpeedAPI(endpoint) {
    try {
        const response = await api.fetchApi(endpoint);
        let data = null;
        try {
            data = await response.json();
        } catch (error) {}
        if (!response.ok) {
            throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        if (data === null) {
            throw new Error("WaveSpeed API returned invalid JSON");
        }
        return data;
    } catch (error) {
        console.error(`[WaveSpeed] Error fetching ${endpoint}:`, error);
        throw error;
    }
}

export async function getModelCategories() {
    const startTime = performance.now();
    try {
        console.log("[WaveSpeed API] Fetching categories...");
        const result = await fetchWaveSpeedAPI("/wavespeed/api/categories");
        const elapsed = performance.now() - startTime;
        console.log(`[WaveSpeed API] Categories fetched in ${elapsed.toFixed(0)}ms`);
        if (result?.success && Array.isArray(result.data) && result.data.length > 0) {
            return result.data;
        }
        throw new Error(result?.error || "Model catalog returned no categories");
    } catch (error) {
        const elapsed = performance.now() - startTime;
        console.error(`[WaveSpeed] Failed to get categories after ${elapsed.toFixed(0)}ms:`, error);
        throw error;
    }
}

export async function getModelsByCategory(category) {
    const startTime = performance.now();
    try {
        console.log(`[WaveSpeed API] Fetching models for category: ${category}...`);
        const result = await fetchWaveSpeedAPI(`/wavespeed/api/models/${category}`);
        const elapsed = performance.now() - startTime;
        console.log(`[WaveSpeed API] Models for ${category} fetched in ${elapsed.toFixed(0)}ms`);
        if (result?.success && Array.isArray(result.data) && result.data.length > 0) {
            return result.data;
        }
        throw new Error(result?.error || `Model catalog returned no models for ${category}`);
    } catch (error) {
        const elapsed = performance.now() - startTime;
        console.error(`[WaveSpeed] Failed to get models for ${category} after ${elapsed.toFixed(0)}ms:`, error);
        throw error;
    }
}

export async function getModelDetail(modelId) {
    try {
        const result = await fetchWaveSpeedAPI(`/wavespeed/api/model?model_id=${encodeURIComponent(modelId)}`);
        if (result && result.success && result.data) {
            return result.data;
        } else {
            console.error("[WaveSpeed] Invalid model detail response:", result);
            return null;
        }
    } catch (error) {
        console.error("[WaveSpeed] Failed to get model detail:", error);
        return null;
    }
}

// Cached version of API calls
export async function getCachedCategories() {
    const cached = GLOBAL_CACHE.categories;
    if (cached !== null && cached !== undefined) {
        return cached;
    }
    const categories = await getModelCategories();
    GLOBAL_CACHE.categories = categories;
    return categories;
}

export async function getCachedModelsByCategory(category) {
    const cached = GLOBAL_CACHE.getModelsByCategory(category);
    if (cached !== null && cached !== undefined) {
        return cached;
    }
    const models = await getModelsByCategory(category);
    GLOBAL_CACHE.setModelsByCategory(category, models);
    return models;
}

export async function getCachedModelDetail(modelId) {
    const cached = GLOBAL_CACHE.getModelDetail(modelId);
    if (cached !== null && cached !== undefined) {
        return cached;
    }
    const detail = await getModelDetail(modelId);
    if (detail) {
        GLOBAL_CACHE.setModelDetail(modelId, detail);
    }
    return detail;
}

// Shared preload Promise
let SHARED_PRELOAD_PROMISE = null;

export async function preloadAllModels(onProgress) {
    if (SHARED_PRELOAD_PROMISE) {
        return SHARED_PRELOAD_PROMISE;
    }

    SHARED_PRELOAD_PROMISE = (async () => {
        const startTime = performance.now();
        try {
            // 1. Load all categories
            console.log("[WaveSpeed Perf] Starting to load categories...");
            const catStart = performance.now();
            const categories = await getCachedCategories();
            const catTime = performance.now() - catStart;
            console.log(`[WaveSpeed Perf] Categories loaded in ${catTime.toFixed(0)}ms (${categories.length} categories)`);
            if (onProgress) onProgress({ step: 'categories', current: categories.length, total: categories.length });

            // 2. Load models for all categories with progress tracking
            console.log("[WaveSpeed Perf] Starting to load models for all categories...");
            const modelsStart = performance.now();
            let loadedCount = 0;
            const totalCategories = categories.length;
            
            // Create promises with progress tracking (parallel loading)
            const allModelsPromises = categories.map(async (cat) => {
                try {
                    const models = await getCachedModelsByCategory(cat.value);
                    loadedCount++;
                    
                    // Update progress after each category completes
                    const progress = Math.round((loadedCount / totalCategories) * 85) + 10; // 10% to 95%
                    if (onProgress) {
                        onProgress({ 
                            step: 'models', 
                            current: loadedCount, 
                            total: totalCategories,
                            percent: progress
                        });
                    }
                    
                    return models;
                } catch (error) {
                    console.error(`[WaveSpeed] Failed to load models for ${cat.value}:`, error);
                    loadedCount++;
                    
                    // Still update progress even on error
                    const progress = Math.round((loadedCount / totalCategories) * 85) + 10;
                    if (onProgress) {
                        onProgress({ 
                            step: 'models', 
                            current: loadedCount, 
                            total: totalCategories,
                            percent: progress
                        });
                    }
                    
                    return []; // Return empty array on error
                }
            });
            
            // Wait for all to complete (still parallel) with 5 minute timeout
            let timeoutId;
            const timeoutPromise = new Promise((resolve) => {
                timeoutId = setTimeout(() => {
                    console.error('[WaveSpeed] ⚠️ Loading timeout after 5 minutes, using partial data');
                    resolve('TIMEOUT');
                }, 5 * 60 * 1000);
            });
            
            const raceResult = await Promise.race([
                Promise.all(allModelsPromises),
                timeoutPromise
            ]);
            
            // Clear timeout if loading completed normally
            if (raceResult !== 'TIMEOUT') {
                clearTimeout(timeoutId);
            }
            
            // If timeout, collect whatever data is available
            let allModels;
            if (raceResult === 'TIMEOUT') {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 more second
                allModels = await Promise.allSettled(allModelsPromises).then(results => 
                    results.map(r => r.status === 'fulfilled' ? r.value : [])
                );
            } else {
                allModels = raceResult;
            }
            
            const modelsTime = performance.now() - modelsStart;

            const totalModels = allModels.reduce((sum, models) => sum + models.length, 0);
            console.log(`[WaveSpeed Perf] All models loaded in ${modelsTime.toFixed(0)}ms (${totalModels} models)`);
            if (onProgress) onProgress({ step: 'models', current: totalModels, total: totalModels });

            // 3. Build global model list
            const flatModels = [];
            categories.forEach((cat, idx) => {
                allModels[idx].forEach(model => {
                    flatModels.push({
                        ...model,
                        categoryName: cat.name,
                        categoryValue: cat.value
                    });
                });
            });

            const totalTime = performance.now() - startTime;
            console.log(`[WaveSpeed Perf] Total preload time: ${totalTime.toFixed(0)}ms (${(totalTime/1000).toFixed(1)}s)`);

            return {
                categories,
                modelsByCategory: allModels,
                flatModels
            };

        } catch (error) {
            console.error("[Preload] Failed to preload models:", error);
            SHARED_PRELOAD_PROMISE = null;
            throw error;
        }
    })();

    const result = await SHARED_PRELOAD_PROMISE;
    return result;
}

export async function refreshAllModels(onProgress) {
    clearModelCache();
    return await preloadAllModels(onProgress);
}

export function clearModelCache() {
    GLOBAL_CACHE.clearAll();
    SHARED_PRELOAD_PROMISE = null;
}

export { GLOBAL_CACHE };
