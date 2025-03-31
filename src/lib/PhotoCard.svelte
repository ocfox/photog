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
  let isLoading = true;

  // Subscribe to the cache store
  imageCacheStore.subscribe((cache) => {
    imageCache = cache;

    // If the element exists and the image is in cache, set it immediately
    if (imgElement && imageCache.has(key) && !isLoaded) {
      imgElement.src = imageCache.get(key) || "";
      isLoaded = true;
      isLoading = false;
    }
  });

  onMount(() => {
    // Check if image is already in cache
    if (imageCache.has(key)) {
      imgElement.src = imageCache.get(key) || "";
      isLoaded = true;
      isLoading = false;
    } else {
      lazyLoad(imgElement);
    }
  });

  function handleImageLoad() {
    isLoading = false;
  }

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
            isLoading = false;
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
              isLoading = false;
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
  {#if isLoading}
    <div class="loading-animation">
      <div class="shimmer"></div>
    </div>
  {/if}
  <img
    bind:this={imgElement}
    data-key={key}
    {alt}
    class:hidden={isLoading}
    on:load={handleImageLoad}
  />
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
    position: relative;
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

  .photo-card img.hidden {
    opacity: 0;
  }

  .loading-animation {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(200, 200, 200, 0.1);
    overflow: hidden;
  }

  .shimmer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    animation: shimmer 1.5s infinite;
    transform: skewX(-20deg);
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-150%) skewX(-20deg);
    }
    100% {
      transform: translateX(150%) skewX(-20deg);
    }
  }

  :global(html.dark) .loading-animation {
    background-color: rgba(30, 30, 30, 0.3);
  }

  :global(html.dark) .shimmer {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0) 100%
    );
  }
</style>
