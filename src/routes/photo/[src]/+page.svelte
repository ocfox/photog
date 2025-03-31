<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onDestroy, onMount } from "svelte";
  import ExifDisplay from "$lib/ExifDisplay.svelte";

  const encodedSrc = $page.params.src;
  let photoSrc: string = "";
  let error: string | null = null;
  let zoomLevel = 1;
  let isZoomed = false;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let translateX = 0;
  let translateY = 0;
  let imgElement: HTMLImageElement;

  try {
    photoSrc = "/api/" + decodeURIComponent(encodedSrc);
    console.log("Decoded photo source:", photoSrc);

    const isHttpUrl =
      photoSrc.startsWith("http://") || photoSrc.startsWith("https://");
    const isRootRelativePath = photoSrc.startsWith("/");

    if (!isHttpUrl && !isRootRelativePath) {
      throw new Error("Invalid photo source.");
    }
  } catch (e: any) {
    console.error("Error decoding or validating photo source:", e);

    error =
      e instanceof Error
        ? e.message
        : "Could not load the photo. Invalid source.";
  }

  function goBack() {
    history.back();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (isZoomed) {
        resetZoom();
      } else {
        goBack();
      }
    } else if (event.key === "+" || event.key === "=") {
      zoomIn();
    } else if (event.key === "-") {
      zoomOut();
    } else if (event.key === "0") {
      resetZoom();
    }
  }

  function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.25, 3);
    isZoomed = zoomLevel > 1;
    if (!isZoomed) {
      translateX = 0;
      translateY = 0;
    }
  }

  function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.25, 0.5);
    isZoomed = zoomLevel > 1;
    if (!isZoomed) {
      translateX = 0;
      translateY = 0;
    }
  }

  function resetZoom() {
    zoomLevel = 1;
    isZoomed = false;
    translateX = 0;
    translateY = 0;
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    if (event.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (!isZoomed) return;

    isDragging = true;
    startX = event.clientX - translateX;
    startY = event.clientY - translateY;
    event.preventDefault();
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging) return;

    translateX = event.clientX - startX;
    translateY = event.clientY - startY;
    event.preventDefault();
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleTouchStart(event: TouchEvent) {
    if (!isZoomed || event.touches.length !== 1) return;

    isDragging = true;
    startX = event.touches[0].clientX - translateX;
    startY = event.touches[0].clientY - translateY;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isDragging || event.touches.length !== 1) return;

    translateX = event.touches[0].clientX - startX;
    translateY = event.touches[0].clientY - startY;
    event.preventDefault();
  }

  function handleTouchEnd() {
    isDragging = false;
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.body.classList.add("overflow-hidden");
    document.body.classList.add("photo-preview-mode");
  });

  onDestroy(() => {
    window.removeEventListener("keydown", handleKeydown);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("touchend", handleTouchEnd);
    window.removeEventListener("touchmove", handleTouchMove);
    document.body.classList.remove("overflow-hidden");
    document.body.classList.remove("photo-preview-mode");
  });
</script>

<svelte:head>
  <title>{photoSrc}</title>
  <meta name="description" content="Large preview of a selected photo" />
</svelte:head>

<div class="photo-preview-page">
  {#if error}
    <div class="error-message">
      <p>{error}</p>
      <button on:click={goBack}>Go Back</button>
    </div>
  {:else if photoSrc}
    <div
      class="preview-overlay"
      on:click={isZoomed ? resetZoom : goBack}
      on:keydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          if (isZoomed) {
            resetZoom();
          } else {
            goBack();
          }
        }
      }}
      role="button"
      tabindex="0"
      title="press Esc to go back"
    >
      <div
        class="content-wrapper"
        on:click|stopPropagation
        on:wheel={handleWheel}
        role="presentation"
      >
        <img
          bind:this={imgElement}
          class="preview-image"
          class:draggable={isZoomed}
          src={photoSrc}
          alt="Large preview"
          style="transform: scale({zoomLevel}) translate({translateX}px, {translateY}px);"
          on:mousedown={handleMouseDown}
          on:touchstart={handleTouchStart}
        />

        {#if isZoomed}
          <div class="zoom-indicator">
            {Math.round(zoomLevel * 100)}%
          </div>
        {/if}

        <ExifDisplay src={photoSrc} />
      </div>
    </div>
  {:else}
    <p>Loading photo...</p>
  {/if}
</div>

<style>
  :global(body.photo-preview-mode) {
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden;
  }

  :global(body.overflow-hidden) {
    overflow: hidden;
  }

  .photo-preview-page {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .preview-overlay {
    position: fixed;
    inset: 0;

    background-color: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
    box-sizing: border-box;
    cursor: pointer;
    z-index: 1000;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    max-width: 95%;
    max-height: 95%;
    cursor: default;
    position: relative;
  }

  .preview-image {
    display: block;
    max-height: 100%;
    max-width: 100%;
    object-fit: contain;
    transition: transform 0.2s ease-out;
  }

  .preview-image.draggable {
    cursor: grab;
    transition: none;
  }

  .zoom-indicator {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .error-message {
    padding: 2rem;
    text-align: center;
    color: #ff3e3e;
  }
  .error-message button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
  }

  :global(html.dark) .error-message {
    color: #ffa0a0;
  }

  .preview-overlay:focus {
    outline: 2px solid Highlight;
    outline: 2px solid -webkit-focus-ring-color;
    outline-offset: 2px;
  }
</style>
