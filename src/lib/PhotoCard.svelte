<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { imageCacheStore } from "./stores";

  export let key: string;
  export let alt: string | undefined = undefined;
  export const metadata: Record<string, any> | undefined = undefined;

  let imgElement: HTMLImageElement;
  let isLoaded = false;
  let imageCache: Map<string, string>;

  // Subscribe to the cache store
  imageCacheStore.subscribe((cache) => {
    imageCache = cache;

    // If the element exists and the image is in cache, set it immediately
    if (imgElement && imageCache.has(key) && !isLoaded) {
      imgElement.src = imageCache.get(key) || "";
      isLoaded = true;
    }
  });

  onMount(() => {
    // Check if image is already in cache
    if (imageCache.has(key)) {
      imgElement.src = imageCache.get(key) || "";
      isLoaded = true;
    } else {
      lazyLoad(imgElement);
    }
  });

  function lazyLoad(imageElement: HTMLImageElement) {
    if (!imageElement) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isLoaded) {
          if (!imageElement.dataset.key) {
            return;
          }

          // Check cache again just in case
          if (imageCache.has(key)) {
            imageElement.src = imageCache.get(key) || "";
            isLoaded = true;
            observer.unobserve(imageElement);
            return;
          }

          fetch(`/api/${imageElement.dataset.key}`)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.blob();
            })
            .then((blob) => {
              const objectUrl = URL.createObjectURL(blob);

              // Update the cache store
              imageCache.set(key, objectUrl);
              imageCacheStore.set(imageCache);

              imageElement.src = objectUrl;
              isLoaded = true;
              observer.unobserve(imageElement);
            })
            .catch((error) => {
              console.error("Error fetching image:", error);
              imageElement.src = "/error-image.png";
              observer.unobserve(imageElement);
            });
        }
      });
    });

    observer.observe(imageElement);

    return {
      destroy() {
        observer.disconnect();
      },
    };
  }

  function handleClick() {
    const encodedSrc = encodeURIComponent(key);
    goto(`/photo/${encodedSrc}`);
  }
</script>

<button
  class="photo-card"
  on:click={handleClick}
  aria-label={`View large preview for ${alt}`}
>
  <img bind:this={imgElement} data-key={key} {alt} />
</button>

<style>
  .photo-card {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    border-radius: 0.25rem;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition:
      transform 0.2s ease-in-out,
      box-shadow 0.2s ease-in-out;
  }

  .photo-card:hover,
  .photo-card:focus {
    transform: scale(1.03);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    outline: none;
  }

  .photo-card:focus-visible {
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.6);
  }

  .photo-card img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
