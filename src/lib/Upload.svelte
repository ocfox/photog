<script lang="ts">
	import { fade } from 'svelte/transition';
	import { onDestroy, createEventDispatcher } from 'svelte'; // Import createEventDispatcher

	const dispatch = createEventDispatcher(); // Create dispatcher instance

	let selectedFile: File | null = null;
	let previewUrl: string | null = null; // State for image preview URL
	let isDragging = false;
	let isLoading = false;
	let uploadError: string | null = null;
	let uploadedKey: string | null = null; // Store the key returned by the API

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

	function resetState() {
		uploadError = null;
		uploadedKey = null;
		isLoading = false;

		// Revoke previous URL if exists
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
			previewUrl = null;
		}
	}

	function updateSelectedFile(file: File | null) {
		// Clear previous state first
		resetState();

		if (file && !validImageTypes.includes(file.type)) {
			selectedFile = null; // Clear selection
			uploadError = 'Invalid file type. Please select a JPEG, PNG, or WebP image.';
			return; // Don't proceed to create preview
		}

		selectedFile = file;

		// Create preview URL if a valid file is selected
		if (file) {
			console.log('Selected file:', file.name, file.type);
			previewUrl = URL.createObjectURL(file);
		} else {
			// This case handles deselection via file input, resetState already cleared previewUrl
		}
	}

	const handleFileSelect = (event: Event) => {
		const target = event.target as HTMLInputElement;
		updateSelectedFile(target.files && target.files.length > 0 ? target.files[0] : null);
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
			updateSelectedFile(event.dataTransfer.files[0]);
		}
	};

	const handleFileUpload = async () => {
		if (!selectedFile) {
			uploadError = 'No file selected.';
			return;
		}

		isLoading = true;
		uploadError = null; // Clear error explicitly before new upload
		uploadedKey = null; // Clear previous success key

		const formData = new FormData();
		formData.append('file', selectedFile);

		try {
			const response = await fetch('/api/upload', {
				method: 'POST',
				body: formData
			});

			const data: unknown = await response.json();

			if (response.ok) {
				console.log('Upload successful:', data);
				const successData = data as UploadSuccessResponse;
				uploadedKey = successData.key;
				selectedFile = null; // Clear selection after successful upload
				if (previewUrl) { // Also clear preview
					URL.revokeObjectURL(previewUrl);
					previewUrl = null;
				}
                // Dispatch success event
                dispatch('uploadSuccess', { key: uploadedKey });

			} else {
				console.error('Upload failed:', data);
				const errorData = data as UploadErrorResponse;
				uploadError = errorData.message || 'File upload failed with status: ' + response.status;
                // Keep selected file and preview on failed upload for retry
			}
		} catch (error: unknown) {
			console.error('Fetch error during upload:', error);
			uploadError = error instanceof Error ? error.message : 'An unexpected error occurred.';
            // Keep selected file and preview on failed upload for retry
		} finally {
			isLoading = false;
		}
	};

	// Cleanup object URL on component destroy
	onDestroy(() => {
		if (previewUrl) {
			URL.revokeObjectURL(previewUrl);
		}
	});
</script>

<div
	class="drop-area"
	class:dragging={isDragging}
	on:dragenter={handleDragEnter}
	on:dragleave={handleDragLeave}
	on:dragover={handleDragOver}
	on:drop={handleDrop}
>
	<p>{isDragging ? 'Drop the file here!' : 'Drag and drop an image file here or click to select'}</p>

	{#if previewUrl}
		<div class="preview-container">
			<img src={previewUrl} alt="Image preview" class="preview-image" />
		</div>
	{/if}

	{#if selectedFile}
		<p class="selected-file">
			{previewUrl ? 'Previewing:' : 'Selected:'} {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
		</p>
	{/if}

	<label class="file-input-label" class:disabled={isLoading}>
		{#if !selectedFile}
			Select File
		{:else}
			Change File
		{/if}
		<input
			type="file"
			accept={acceptedFileTypes}
			on:change={handleFileSelect}
			disabled={isLoading}
			aria-hidden="true"
			style="display: none;"
		/>
	</label>

	{#if selectedFile}
		<button class="upload-button" on:click={handleFileUpload} disabled={isLoading || !selectedFile}>
			{#if isLoading}
				Uploading...
			{:else}
				Upload File
			{/if}
		</button>
	{/if}

	{#if uploadError}
		<p class="status error" transition:fade>{uploadError}</p>
	{/if}

	{#if uploadedKey && !isLoading} <!-- Show success message only after loading finishes -->
		<p class="status success" transition:fade>
			File uploaded successfully! Link:
			<a href={`/photo/${uploadedKey}`} target="_blank" rel="noopener noreferrer">
				/photo/{uploadedKey}
			</a>
		</p>
	{/if}
</div>

<style>
	.drop-area {
		border: 2px dashed var(--text-color, #ccc);
		border-radius: 10px;
		padding: 30px;
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

	.selected-file {
		font-style: italic;
		color: var(--text-color, #333);
		margin-bottom: 15px;
	}

	.preview-container {
		margin-bottom: 15px;
		max-height: 200px; /* Limit preview height */
		display: flex;
		justify-content: center;
	}

	.preview-image {
		max-width: 100%;
		max-height: 200px; /* Match container height */
		object-fit: contain;
		border-radius: 5px;
		border: 1px solid var(--border-color, #ddd);
	}

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
</style>
