<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment'; // Import browser check
	import { onMount } from 'svelte'; // onDestroy is implicitly handled by onMount's return
	import ExifDisplay from '$lib/ExifDisplay.svelte';

	// Use the already decoded parameter directly
	const photoKey = $page.params.src;
	let photoSrc: string = '';
	let error: string | null = null;
	let zoomLevel = 1;
	let isZoomed = false;
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let translateX = 0;
	let translateY = 0;
	let imgElement: HTMLImageElement;

	// --- Initialization (Runs on Server and Client) ---
	try {
		// Construct the API URL using the raw key directly
		photoSrc = '/api/' + photoKey;
		// Basic validation: ensure it starts with /api/
		const isRootRelativeApiPath = photoSrc.startsWith('/api/');
		if (!isRootRelativeApiPath) {
			throw new Error('Invalid photo source path generated.');
		}
	} catch (e: any) {
		console.error('Error constructing photo source URL:', e);
		error = e instanceof Error ? e.message : 'Could not construct the photo source URL.';
	}
	// Log only on browser to avoid server logs unless needed
	if (browser) {
		console.log('Photo source URL:', photoSrc);
	}

	// --- Browser-Only Functions ---
	function goBack() {
		if (browser) {
			goto('/');
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (isZoomed) {
				resetZoom();
			} else {
				goBack();
			}
		} else if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			zoomIn();
		} else if (event.key === '-') {
			event.preventDefault();
			zoomOut();
		} else if (event.key === '0') {
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
		if ((event.target as HTMLElement)?.closest('.zoom-indicator, .exif-display')) return;

		isDragging = true;
		imgElement.classList.add('dragging');
		startX = event.clientX - translateX;
		startY = event.clientY - translateY;
		event.preventDefault();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		translateX = event.clientX - startX;
		translateY = event.clientY - startY;
	}

	function handleMouseUp() {
		if (isDragging) {
			imgElement?.classList.remove('dragging');
			isDragging = false;
		}
	}

	function handleMouseLeave() {
		if (isDragging) {
			handleMouseUp();
		}
	}

	function handleTouchStart(event: TouchEvent) {
		if (!isZoomed || event.touches.length !== 1) return;
		if ((event.target as HTMLElement)?.closest('.zoom-indicator, .exif-display')) return;

		isDragging = true;
		startX = event.touches[0].clientX - translateX;
		startY = event.touches[0].clientY - translateY;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!isDragging || event.touches.length !== 1) return;
		translateX = event.touches[0].clientX - startX;
		translateY = event.touches[0].clientY - startY;
		event.preventDefault(); // Prevent scroll/zoom
	}

	function handleTouchEnd() {
		isDragging = false;
	}

	// --- Lifecycle (Explicit Browser Check) ---
	onMount(() => {
		// Explicitly check for browser environment before adding listeners
		if (browser) {
			window.addEventListener('keydown', handleKeydown);
			window.addEventListener('mouseup', handleMouseUp);
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('touchend', handleTouchEnd);
			window.addEventListener('touchmove', handleTouchMove, { passive: false });
			document.body.classList.add('overflow-hidden');
			document.body.classList.add('photo-preview-mode');

			// Return cleanup function
			return () => {
				window.removeEventListener('keydown', handleKeydown);
				window.removeEventListener('mouseup', handleMouseUp);
				window.removeEventListener('mousemove', handleMouseMove);
				window.removeEventListener('touchend', handleTouchEnd);
				window.removeEventListener('touchmove', handleTouchMove);
				document.body?.classList.remove('overflow-hidden');
				document.body?.classList.remove('photo-preview-mode');
			};
		}
	});
</script>

<svelte:head>
	<title>Photo: {photoKey}</title>
	<meta name="description" content="Large preview of photo {photoKey}" />
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
			on:click={isZoomed ? null : goBack}
			on:keydown={(event) => {
				if (event.key === 'Escape') {
					if (isZoomed) resetZoom();
					else goBack();
				} else if (event.key === 'Enter' || event.key === ' ') {
					if (isZoomed) resetZoom();
					else goBack();
					event.preventDefault();
				}
			}}
			role="button"
			aria-label="Photo preview overlay"
			tabindex="0"
			title="Press Esc to go back or reset zoom"
		>
			<div
				class="content-wrapper"
				on:click|stopPropagation
				on:wheel={handleWheel}
				on:mousedown={handleMouseDown}
				on:mouseleave={handleMouseLeave}
				on:touchstart|passive={handleTouchStart}
				on:touchmove|nonpassive={handleTouchMove}
				role="presentation"
			>
				<img
					bind:this={imgElement}
					class="preview-image"
					class:dragging={isDragging}
					src={photoSrc}
					alt="Large preview of {photoKey}"
					style="transform: scale({zoomLevel}) translate({translateX}px, {translateY}px); touch-action: none;"
				/>

				{#if isZoomed}
					<div class="zoom-indicator">{Math.round(zoomLevel * 100)}%</div>
				{/if}

				<!-- Correctly pass photoSrc to the ExifDisplay component -->
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
		overflow: hidden;
	}

	.preview-image {
		display: block;
		max-height: 100%;
		max-width: 100%;
		object-fit: contain;
		transition: transform 0.2s ease-out;
		will-change: transform;
		touch-action: none;
		cursor: zoom-in;
	}

	.preview-image:not([style*='scale(1)']) {
		cursor: grab;
	}

	.preview-image.dragging {
		cursor: grabbing;
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
		z-index: 1;
		pointer-events: none;
	}

	.error-message {
		padding: 2rem;
		text-align: center;
		color: var(--error-dark, #721c24);
		background-color: var(--error-light, #f8d7da);
		border: 1px solid var(--error-border, #f5c6cb);
		border-radius: 5px;
		margin: 2rem;
	}
	.error-message button {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		cursor: pointer;
		border: 1px solid currentColor;
		background: none;
		color: inherit;
		border-radius: 4px;
	}

	.preview-overlay:focus-visible {
		outline: 2px solid Highlight;
		outline: 2px solid -webkit-focus-ring-color;
		outline-offset: 2px;
	}
	.preview-overlay:focus {
		outline: none;
	}
</style>
