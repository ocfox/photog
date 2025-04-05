<script lang="ts">
	import { fade } from 'svelte/transition';
	import { onDestroy, createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// --- State for Multiple Files ---
	let selectedFiles: File[] = [];
	interface Preview {
		name: string;
		url: string;
	}
	let previewUrls: Preview[] = []; // Array to hold previews
	let isDragging = false;
	let isLoading = false;
	let uploadErrors: { [fileName: string]: string } = {}; // Track errors per file
	let uploadSuccesses: { [fileName: string]: string } = {}; // Track success keys per file
	let overallUploadMessage: string | null = null; // General status message

	// Interfaces for API response shapes
	interface UploadSuccessResponse {
		message: string;
		key: string;
	}
	interface UploadErrorResponse {
		message: string; // SvelteKit errors provide a message property
	}

	const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
	const acceptedFileTypes = validImageTypes.join(','); // For the input accept attribute

	function clearPreviews() {
		// Revoke previous URLs
		previewUrls.forEach(p => URL.revokeObjectURL(p.url));
		previewUrls = [];
	}

	function resetUploadStatus() {
		uploadErrors = {};
		uploadSuccesses = {};
		overallUploadMessage = null;
		isLoading = false;
	}

	// Renamed from updateSelectedFile to handle multiple files
	function updateSelectedFiles(files: FileList | null) {
		// Clear previous previews and status
		clearPreviews();
		resetUploadStatus();

		if (!files || files.length === 0) {
			selectedFiles = [];
			return;
		}

		const validFiles: File[] = [];
		const newPreviews: Preview[] = [];
		let invalidTypeFound = false;

		for (const file of Array.from(files)) {
			if (validImageTypes.includes(file.type)) {
				validFiles.push(file);
				newPreviews.push({ name: file.name, url: URL.createObjectURL(file) });
				console.log('Selected file:', file.name, file.type);
			} else {
				invalidTypeFound = true;
				console.warn(`Invalid file type skipped: ${file.name} (${file.type})`);
			}
		}

		selectedFiles = validFiles;
		previewUrls = newPreviews;

		if (invalidTypeFound) {
			// Use overall message for general errors like invalid types
			overallUploadMessage = 'Some files were skipped due to invalid type (only JPEG, PNG, WebP allowed).';
		}
	}

	const handleFileSelect = (event: Event) => {
		const target = event.target as HTMLInputElement;
		updateSelectedFiles(target.files);
		// Reset file input value to allow selecting the same file(s) again
		target.value = '';
	};

	// Drag and Drop Handlers
	const handleDragEnter = (event: DragEvent) => {
		event.preventDefault();
		isDragging = true;
	};

	const handleDragLeave = (event: DragEvent) => {
		event.preventDefault();
		const dropArea = event.currentTarget as HTMLElement;
		// Check if the leave target is outside the drop area boundary
		if (!dropArea.contains(event.relatedTarget as Node)) {
			isDragging = false;
		}
	};

	const handleDragOver = (event: DragEvent) => {
		event.preventDefault(); // Necessary to allow drop
		isDragging = true; // Keep dragging state active while over
	};

	const handleDrop = (event: DragEvent) => {
		event.preventDefault();
		isDragging = false;
		if (event.dataTransfer && event.dataTransfer.files.length > 0) {
			updateSelectedFiles(event.dataTransfer.files);
		}
	};

	// Function to remove a specific file by index
	function removeFile(indexToRemove: number) {
		if (indexToRemove < 0 || indexToRemove >= selectedFiles.length) {
			console.error('Invalid index for file removal:', indexToRemove);
			return;
		}

		const fileToRemove = selectedFiles[indexToRemove];
		const previewToRemove = previewUrls[indexToRemove];

		console.log(`Removing file: ${fileToRemove.name}`);

		// Revoke the object URL to free memory
		URL.revokeObjectURL(previewToRemove.url);

		// Remove the file and its preview
		selectedFiles = selectedFiles.filter((_, index) => index !== indexToRemove);
		previewUrls = previewUrls.filter((_, index) => index !== indexToRemove);

		// Optionally reset overall message if all files are removed
		if (selectedFiles.length === 0) {
			resetUploadStatus();
			// Keep the drop area message, but clear upload status
			overallUploadMessage = null;
		} else {
			// Update count in existing messages if needed, or just let the next upload handle it
			// For simplicity, we might just let the count update naturally or when upload is attempted
		}
	}

	// Modified to handle multiple file uploads sequentially
	const handleFileUpload = async () => {
		if (selectedFiles.length === 0) {
			overallUploadMessage = 'No valid files selected.';
			return;
		}

		isLoading = true;
		resetUploadStatus(); // Clear previous statuses before starting new batch
		overallUploadMessage = `Uploading ${selectedFiles.length} file(s)...`;

		let successCount = 0;
		let errorCount = 0;
		const currentErrors: { [fileName: string]: string } = {};
		const currentSuccesses: { [fileName: string]: string } = {};


		for (const file of selectedFiles) {
			const formData = new FormData();
			formData.append('file', file);

			try {
				const response = await fetch('/api/upload', {
					method: 'POST',
					body: formData
				});

				const data: unknown = await response.json();

				if (response.ok) {
					const successData = data as UploadSuccessResponse;
					console.log(`Upload successful: ${file.name}`, successData);
					currentSuccesses[file.name] = successData.key;
					successCount++;
					// Dispatch success event *for each* successful upload
					dispatch('uploadSuccess', { key: successData.key, filename: file.name });
				} else {
					const errorData = data as UploadErrorResponse;
					console.error(`Upload failed for ${file.name}:`, data);
					currentErrors[file.name] = errorData.message || `Upload failed with status: ${response.status}`;
					errorCount++;
				}
			} catch (error: unknown) {
				console.error(`Fetch error during upload for ${file.name}:`, error);
				currentErrors[file.name] = error instanceof Error ? error.message : 'An unexpected network error occurred.';
				errorCount++;
			}
		}

		// Update reactive states after loop finishes
		uploadErrors = currentErrors;
		uploadSuccesses = currentSuccesses;
		isLoading = false;

		// Set final status message
		if (errorCount === 0) {
			overallUploadMessage = `Successfully uploaded ${successCount} file(s).`;
			selectedFiles = []; // Clear selection on full success
			clearPreviews();
		} else if (successCount === 0) {
			overallUploadMessage = `Failed to upload ${errorCount} file(s). See details below.`;
			// Keep selection for retry on full failure
		} else {
			overallUploadMessage = `Uploaded ${successCount} file(s) successfully, ${errorCount} failed. See details below.`;
			// Partially clear selection? Or keep all for retry? Let's keep all for now.
			// Consider filtering selectedFiles based on errors if needed
		}
	};

	// Cleanup object URLs on component destroy
	onDestroy(() => {
		clearPreviews();
	});
</script>

<div
	class="drop-area"
	class:dragging={isDragging}
	on:dragenter={handleDragEnter}
	on:dragleave={handleDragLeave}
	on:dragover={handleDragOver}
	on:drop={handleDrop}
	role="region"
	aria-label="File Upload Drop Zone"
>
	<p>{isDragging ? 'Drop files here!' : 'Drag and drop image files here or click to select'}</p>

	<!-- Multiple Previews -->
	{#if previewUrls.length > 0}
	<div class="previews-grid">
			{#each previewUrls as preview, index (preview.url)}
				<div class="preview-item" transition:fade>
					<div
						class="preview-content-wrapper"
						on:click={() => removeFile(index)}
						role="button"
						tabindex="0"
						aria-label={`Remove ${preview.name}`}
						title="Click to remove"
						on:keypress={(e) => { if (e.key === 'Enter' || e.key === ' ') removeFile(index); }}
					>
						<img src={preview.url} alt={`Preview of ${preview.name}`} class="preview-image" />
						<span class="preview-name">{preview.name}</span>
						<!-- Removed the explicit button -->
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if selectedFiles.length > 0}
		<p class="selected-file-count">Selected {selectedFiles.length} file(s).</p>
		<!-- Optionally list selected file names -->
		<!--
        <ul class="selected-file-list">
            {#each selectedFiles as file (file.name)}
                <li>{file.name} ({Math.round(file.size / 1024)} KB)</li>
            {/each}
        </ul>
        -->
	{/if}

	<label class="file-input-label" class:disabled={isLoading}>
		{#if selectedFiles.length === 0}
			Select Files
		{:else}
			Change Files
		{/if}
		<input
			type="file"
			accept={acceptedFileTypes}
			on:change={handleFileSelect}
			disabled={isLoading}
			aria-hidden="true"
			style="display: none;"
			multiple
		/>
	</label>

	{#if selectedFiles.length > 0}
		<button class="upload-button" on:click={handleFileUpload} disabled={isLoading || selectedFiles.length === 0}>
			{#if isLoading}
				Uploading {selectedFiles.length} file(s)...
			{:else}
				Upload {selectedFiles.length} File{#if selectedFiles.length > 1}s{/if}
			{/if}
		</button>
	{/if}

	<!-- Overall Status Message -->
	{#if overallUploadMessage && !isLoading}
 		<p class="status info">{overallUploadMessage}</p>
 	{/if}

	<!-- Detailed Error Messages -->
	{#if Object.keys(uploadErrors).length > 0 && !isLoading}
		<div class="status error details">
				{#each Object.entries(uploadErrors) as [filename, errorMsg] (filename)}
					<li><strong>{filename}:</strong> {errorMsg}</li>
				{/each}
		</div>
	{/if}

	<!-- Detailed Success Messages (Optional) -->
    {#if Object.keys(uploadSuccesses).length > 0 && !isLoading}
        <div class="status success details">
            <h4>Successful Uploads:</h4>
            <ul>
                {#each Object.entries(uploadSuccesses) as [filename, key] (filename)}
                    <li>
                        <strong>{filename}</strong>: Link
                        <a href={`/photo/${key}`} target="_blank" rel="noopener noreferrer">
                            /photo/{key}
                        </a>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</div>

<style>
	/* Add styles for grid and individual items */
	.previews-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* Responsive grid */
		gap: 10px;
		margin-bottom: 15px;
		max-height: 300px; /* Limit overall preview area height */
		overflow-y: auto; /* Add scroll if needed */
		padding: 10px; /* Slightly more padding */
		border: 1px solid var(--border-color, #ddd);
		border-radius: 5px;
	}

	.preview-item {
		/* Removed direct flex styles from preview-item */
		position: relative; /* Needed for absolute positioning of children */
	}

	/* New wrapper for content inside preview-item */
	.preview-content-wrapper {
		position: relative; /* Context for the remove button and overlay */
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		width: 100%; /* Ensure wrapper takes full width of grid cell */
		overflow: hidden; /* Contain overlay */
		border-radius: 4px; /* Match image border radius */
		cursor: default; /* Default cursor */
		transition: transform 0.1s ease-out; /* Add slight scale effect */
	}

	/* Overlay effect on hover */
	.preview-content-wrapper::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5); /* Dark overlay */
		opacity: 0;
		transition: opacity 0.2s ease-in-out;
		z-index: 1; /* Below the button, above the image */
		pointer-events: none; /* Allow clicks through to image/button */
	}

	.preview-content-wrapper:hover::after {
		opacity: 1;
	}

	/* Apply hover effects directly to the wrapper */
	.preview-content-wrapper:hover {
		cursor: pointer; /* Indicate clickability */
		transform: scale(0.98); /* Slightly shrink on hover/focus */
	}
	.preview-content-wrapper:active {
		transform: scale(0.95); /* Slightly smaller when clicked */
	}
	/* Add focus style for accessibility */
	.preview-content-wrapper:focus-visible {
		outline: 2px solid var(--primary-color, #007bff);
		outline-offset: 2px;
		transform: scale(0.98);
	}
	.preview-content-wrapper:focus-visible::after {
		opacity: 1; /* Show overlay on focus too */
	}


	/* Removed .remove-button styles */


	.preview-image {
		display: block; /* Prevents extra space below */
		max-width: 100%;
		max-height: 80px; /* Smaller height for grid items */
		object-fit: contain;
		border-radius: 4px;
		margin-bottom: 5px; /* Space between image and name */
	}

	.preview-name {
		font-size: 0.8em;
		color: var(--text-muted, #666);
		word-break: break-all; /* Prevent long names breaking layout */
		line-height: 1.2;
	}

	.drop-area {
		border: 2px dashed var(--text-color, #ccc);
		border-radius: 10px;
		padding: 20px; /* Slightly reduced padding */
		text-align: center;
		cursor: pointer;
		transition: background-color 0.3s, border-color 0.3s;
		margin-bottom: 15px;
		background-color: var(--background-alt, #f9f9f9);
	}

	.drop-area.dragging {
		background-color: var(--primary-light, #e0e0ff);
		border-color: var(--primary-color, #007bff);
	}

	.drop-area p {
		margin-top: 0;
		margin-bottom: 15px;
		color: var(--text-muted, #666);
	}

	.selected-file-count {
		font-style: italic;
		color: var(--text-color, #333);
		margin-bottom: 15px;
	}

	/* Remove single preview container styles if no longer needed */
	/* .preview-container { ... } */
	/* .preview-image { ... } */


	.file-input-label {
		display: inline-block;
		padding: 10px 20px;
		background-color: var(--secondary-color, #6c757d);
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		transition: background-color 0.2s;
		margin-right: 10px; /* Space between select and upload buttons */
	}

	.file-input-label:hover:not(.disabled) {
		background-color: var(--secondary-dark, #5a6268);
	}

	.file-input-label.disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.upload-button {
		padding: 10px 20px;
		background-color: var(--primary-color, #007bff);
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.upload-button:hover:not(:disabled) {
		background-color: var(--primary-dark, #0056b3);
	}

	.upload-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.status {
		margin-top: 15px;
		padding: 10px;
		border-radius: 5px;
		font-weight: bold;
	}

	.status.success {
		background-color: var(--success-light, #d4edda);
		color: var(--success-dark, #155724);
		border: 1px solid var(--success-border, #c3e6cb);
	}

	.status.success a {
		color: var(--success-dark, #155724);
		text-decoration: underline;
	}

	.status.error {
		background-color: var(--error-light, #f8d7da);
		color: var(--error-dark, #721c24);
		border: 1px solid var(--error-border, #f5c6cb);
	}

    /* Style for info message */
    .status.info {
		background-color: var(--info-light, #d1ecf1);
		color: var(--info-dark, #0c5460);
		border: 1px solid var(--info-border, #bee5eb);
	}

    /* Style for detailed lists */
    .details {
        text-align: left;
        margin-top: 10px;
    }
    .details h4 {
        margin-top: 0;
        margin-bottom: 5px;
        font-size: 1em;
    }
    .details ul {
        list-style: disc;
        padding-left: 20px;
        margin: 0;
    }
    .details li {
        margin-bottom: 3px;
        font-size: 0.9em;
    }
    .details a {
        color: inherit; /* Inherit color from parent status */
    }
</style>
