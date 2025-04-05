<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment'; // Import browser check
	import { onMount } from 'svelte';
	// Removed duplicate imports for browser, page, goto
	import ExifDisplay from '$lib/ExifDisplay.svelte';

	// --- State ---
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
	let isAdmin: boolean | undefined = undefined; // Admin status
	let deleteError: string | null = null; // Error message for delete operation
	let isDeleting = false; // Track delete operation state

	// --- Initialization ---
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

	async function checkAdminStatus() {
		// console.log('checkAdminStatus entered'); // Removed debug log
		if (!browser) {
			// console.log('checkAdminStatus: Not in browser, exiting.'); // Removed debug log
			return; // Only run in browser
		}
		try {
			// console.log('checkAdminStatus: Running in browser, fetching /api/ip...'); // Removed debug log
			const response = await fetch('/api/ip');
			// console.log('Fetch response received:', response); // Removed debug log
			if (!response.ok) throw new Error(`Failed to check admin status: ${response.status}`); // Include status
			const data = await response.json() as { isAdmin: boolean };
			// console.log('Admin check API response JSON:', data); // Removed debug log
			isAdmin = data.isAdmin;
			// console.log('isAdmin state set to:', isAdmin); // Removed debug log
		} catch (err) {
			console.error('Error checking admin status:', err);
			isAdmin = false; // Assume not admin on error
			// console.log('isAdmin state set to false due to error.'); // Removed debug log
		}
	}

	async function handleDelete() {
		if (!browser || !isAdmin || !photoKey) return;

		if (!confirm(`Are you sure you want to delete photo "${photoKey}"? This cannot be undone.`)) {
			return;
		}

		isDeleting = true;
		deleteError = null;

		try {
			const response = await fetch(`/api/delete/${encodeURIComponent(photoKey)}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				let errorMsg = `Failed to delete: ${response.status}`;
				try {
					const errorData = await response.json() as { message?: string };
					if (errorData?.message) {
						errorMsg = errorData.message;
					}
				} catch {} // Ignore parsing errors
				throw new Error(errorMsg);
			}

			console.log(`Photo ${photoKey} deleted successfully.`);
			goto('/'); // Navigate back to home page on successful delete

		} catch (err: unknown) {
			console.error(`Error deleting photo ${photoKey}:`, err);
			deleteError = err instanceof Error ? err.message : 'An unknown error occurred during deletion.';
		} finally {
			isDeleting = false;
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
		// console.log('onMount called'); // Removed debug log
		// Explicitly check for browser environment before adding listeners
		// console.log(`onMount: browser variable is: ${browser}`); // Removed debug log
		if (browser) {
			// console.log('onMount: Running inside browser block'); // Removed debug log
			window.addEventListener('keydown', handleKeydown);
			window.addEventListener('mouseup', handleMouseUp);
			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('touchend', handleTouchEnd);
			window.addEventListener('touchmove', handleTouchMove, { passive: false });
			document.body.classList.add('overflow-hidden');
			document.body.classList.add('photo-preview-mode');

			// Check admin status when component mounts in the browser (moved inside if(browser))
			// console.log('onMount: Calling checkAdminStatus()'); // Removed debug log
			checkAdminStatus(); // Moved here

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
		} else {
			// console.log('onMount: Not running inside browser block'); // Removed debug log
		}
		// Removed checkAdminStatus() call from here as it's now inside the if(browser) block
	});

	// console.log('--- Script execution finished before template ---'); // Removed debug log
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

				<!-- Removed DEBUG: Display Admin Status -->

				<!-- EXIF Display -->
				<ExifDisplay src={photoSrc} />

				<!-- Admin Delete Button -->
				{#if isAdmin}
				<div class="admin-actions">
					{#if deleteError}
						<p class="delete-error">{deleteError}</p>
					{/if}
					<button
						class="delete-button"
						on:click|stopPropagation={handleDelete}
						disabled={isDeleting}
						aria-label="Delete this photo"
					>
						{#if isDeleting}Deleting...{:else}Delete Photo{/if}
					</button>
				</div>
				{/if}
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

	/* Admin Actions */
	.admin-actions {
		position: absolute;
		bottom: 1rem; /* Adjust positioning as needed */
		left: 1rem;  /* Position near bottom-left */
		z-index: 2; /* Ensure it's above other elements if necessary */
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.delete-button {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		background-color: var(--error-dark, #dc3545);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.delete-button:hover:not(:disabled) {
		background-color: #c82333; /* Darker red */
	}
	.delete-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.delete-error {
		background-color: var(--error-light, #f8d7da);
		color: var(--error-dark, #721c24);
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.9em;
		border: 1px solid var(--error-border, #f5c6cb);
	}

</style>
