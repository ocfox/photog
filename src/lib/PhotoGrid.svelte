<script lang="ts">
  import { onMount } from "svelte";
  import PhotoCard from "./PhotoCard.svelte";

  export let photos: Image[] = [];
  export let batchSize = 12;
  export let threshold = 200;

  export let visiblePhotos: Image[] = [];
  let currentIndex = 0;
  let container: HTMLElement;
  let loading = false;
  let allLoaded = false;

  onMount(() => {
    loadMorePhotos();

    const handleScroll = () => {
      if (loading || allLoaded) return;

      const containerBottom = container.getBoundingClientRect().bottom;
      const viewportHeight = window.innerHeight;

      if (containerBottom - viewportHeight < threshold) {
        loadMorePhotos();
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  });

  function loadMorePhotos() {
    if (allLoaded) return;

    loading = true;

    const endIndex = Math.min(currentIndex + batchSize, photos.length);

    visiblePhotos = [...visiblePhotos, ...photos.slice(currentIndex, endIndex)];

    currentIndex = endIndex;

    if (currentIndex >= photos.length) {
      allLoaded = true;
    }

    loading = false;
  }

  interface Image {
    key: string;
    alt?: string;
  }

  async function fetchImages(): Promise<void> {
    try {
      const response = await fetch("/api/list");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      visiblePhotos = await response.json();
    } catch (error) {
      console.error("Error fetching image keys:", error);
    }
  }

  fetchImages();
</script>

<div class="photo-grid-container" bind:this={container}>
  <div class="photo-grid">
    {#each visiblePhotos as photo, i (i)}
      <div class="photo-item">
        <PhotoCard key={photo.key} />
      </div>
    {/each}
  </div>

  {#if loading}
    <div class="loading">Loading more photos...</div>
  {/if}

  {#if allLoaded && visiblePhotos.length > 0}
    <div class="end-message">All photos loaded</div>
  {/if}

  {#if photos.length === 0}
    <div class="no-photos">No photos available</div>
  {/if}
</div>

<style>
  .photo-grid-container {
    width: 100%;
    padding: 1rem 0;
  }

  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    width: 100%;
  }

  .photo-item {
    transition: transform 0.3s ease;
  }

  .photo-item:hover {
    transform: translateY(-5px);
  }

  .loading,
  .end-message,
  .no-photos {
    text-align: center;
    padding: 2rem;
    color: var(--text-color, #666);
    font-style: italic;
  }
</style>
