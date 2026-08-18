import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cacheSource = await readFile(new URL("../web/predictor/cache.js", import.meta.url), "utf8");
const cacheModuleUrl = `data:text/javascript;base64,${Buffer.from(cacheSource).toString("base64")}`;
const { createModelCache } = await import(cacheModuleUrl);

class MemoryStorage {
    constructor() {
        this.values = new Map();
    }

    get length() {
        return this.values.size;
    }

    key(index) {
        return [...this.values.keys()][index] ?? null;
    }

    getItem(key) {
        return this.values.get(key) ?? null;
    }

    setItem(key, value) {
        this.values.set(key, value);
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

const storage = new MemoryStorage();
let time = 1_000;
const cache = createModelCache(storage, { cacheExpiry: 300_000, now: () => time });

cache.categories = [{ value: "text-to-image" }];
assert.deepEqual(cache.categories, [{ value: "text-to-image" }]);
assert.equal(cache.stats.hits, 1);

time += 300_000;
assert.equal(cache.categories, null);
assert.equal(storage.getItem("wavespeed_categories"), null);
assert.equal(cache.stats.misses, 1);

cache.setModelsByCategory("text-to-image", [{ value: "wavespeed-ai/example" }]);
cache.setModelDetail("wavespeed-ai/example", { model_uuid: "wavespeed-ai/example" });
storage.setItem("unrelated", "keep");
cache.clearAll();
assert.equal(cache.getModelsByCategory("text-to-image"), null);
assert.equal(cache.getModelDetail("wavespeed-ai/example"), null);
assert.equal(storage.getItem("unrelated"), "keep");

console.log("Model cache TTL and invalidation passed");
