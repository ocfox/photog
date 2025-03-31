import { writable } from "svelte/store";

// Store for photo list
export const photoStore = writable<{
  photos: Array<{ key: string; alt?: string }>;
  loaded: boolean;
}>({
  photos: [],
  loaded: false,
});

// Store for image cache
export const imageCacheStore = writable<Map<string, string>>(new Map());
