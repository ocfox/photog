<script lang="ts">
	import Upload from '$lib/Upload.svelte';
	import { onMount } from 'svelte';

	// --- Admin Status State ---
	let ip: string | null = null;
	let isAdmin: boolean | undefined = undefined;
	let adminCheckError: string | null = null;

	// --- Photo List State ---
	interface Photo {
		key: string;
	}
	let photoList: Photo[] = [];
	let listLoading = false;
	let listError: string | null = null;

	// --- Delete State ---
	let deletingKey: string | null = null; // Track which key is being deleted
	let deleteError: string | null = null;

	async function checkAdminStatus() {
		// Reset errors on re-check
		adminCheckError = null;
		listError = null;
		deleteError = null;
		try {
			const response = await fetch('/api/ip');
			if (!response.ok) {
				let errorMsg = `Failed to fetch admin status: ${response.status} ${response.statusText}`;
				try {
					// Safely parse potential JSON error
					const errData = await response.json() as { message?: string };
					if (errData && typeof errData === 'object' && errData.message) {
						errorMsg = errData.message;
					}
				} catch {
					// Ignore JSON parsing errors
				}
				throw new Error(errorMsg);
			}
			const data = await response.json() as { ip: string; isAdmin: boolean };
			ip = data.ip;
			isAdmin = data.isAdmin;
			if (isAdmin) {
				await fetchPhotoList(); // Fetch list immediately if admin
			}
		} catch (err: unknown) {
			console.error('Error fetching admin status:', err);
			adminCheckError = err instanceof Error ? err.message : 'An unknown error occurred.';
			isAdmin = false;
		}
	}

	async function fetchPhotoList() {
		listLoading = true;
		listError = null;
		deleteError = null; // Clear delete errors when refreshing list
		try {
			const response = await fetch('/api/list');
			if (!response.ok) {
				let errorMsg = `Failed to fetch photo list: ${response.status} ${response.statusText}`;
				try {
					// Safely parse potential JSON error (assuming { error: "..." })
					const errData = await response.json() as { error?: string };
					if (errData && typeof errData === 'object' && errData.error) {
						errorMsg = errData.error;
					}
				} catch {
					// Ignore JSON parsing errors
				}
				throw new Error(errorMsg);
			}
			const data = await response.json() as Photo[];
			photoList = data.sort((a, b) => a.key.localeCompare(b.key)); // Sort keys alphabetically
		} catch (err: unknown) {
			console.error('Error fetching photo list:', err);
			listError = err instanceof Error ? err.message : 'An unknown error occurred fetching the list.';
			photoList = [];
		} finally {
			listLoading = false;
		}
	}

	async function handleDelete(keyToDelete: string) {
		// Basic confirmation dialog
		if (!confirm(`Are you sure you want to delete ${keyToDelete}? This cannot be undone.`)) {
			return;
		}

		deletingKey = keyToDelete;
		deleteError = null;

		try {
			const response = await fetch(`/api/delete/${encodeURIComponent(keyToDelete)}`, {
				method: 'DELETE'
			});

			// Handle potential error response body
			let errorMsg = `Failed to delete ${keyToDelete}: ${response.status}`;
			if (!response.ok) {
				try {
					const errorData = await response.json() as { message?: string };
					if (errorData && typeof errorData === 'object' && errorData.message) {
						errorMsg = errorData.message;
					}
				} catch {} // Ignore parsing errors
                // Use the more specific error message parsed from JSON if available
				deleteError = errorMsg;
                console.error(`Deletion failed for ${keyToDelete}:`, response.status, errorMsg);
			} else {
                // Success case
				console.log(`Deletion successful: ${keyToDelete}`);
				// Remove the deleted item from the local list
				photoList = photoList.filter(photo => photo.key !== keyToDelete);
            }

		} catch (err: unknown) {
			console.error(`Fetch error during deletion of ${keyToDelete}:`, err);
			deleteError = err instanceof Error ? err.message : 'An unexpected network error occurred during deletion.';
		} finally {
			deletingKey = null; // Reset deleting state regardless of outcome
		}
	}

	// Function to handle successful upload from the child component
    function handleUploadSuccess() {
        // Refresh the photo list after a successful upload
        if (isAdmin) {
            fetchPhotoList();
        }
    }

</script>

<svelte:head>
    <title>Admin - Photo Management</title>
</svelte:head>

{#await checkAdminStatus()}
	<p>Checking authorization...</p>
{:then}
	{#if isAdmin}
		<Upload on:uploadSuccess={handleUploadSuccess} />

        <hr class="separator" />

        <h2>Uploaded Photos</h2>

        {#if deleteError}
            <p class="error-message">Delete error: {deleteError}</p>
        {/if}

        {#if listLoading}
            <p>Loading photo list...</p>
        {:else if listError}
            <p class="error-message">Error loading photo list: {listError}</p>
        {:else if photoList.length > 0}
            <ul class="photo-list">
                {#each photoList as photo (photo.key)}
                    <li class="photo-list-item">
                        <a href={`/photo/${photo.key}`} target="_blank" rel="noopener noreferrer">{photo.key}</a>
                        <button
                            class="delete-button"
                            on:click={() => handleDelete(photo.key)}
                            disabled={deletingKey === photo.key}
                            aria-label={`Delete photo ${photo.key}`}
                        >
                            {#if deletingKey === photo.key}Deleting...{:else}Delete{/if}
                        </button>
                    </li>
                {/each}
            </ul>
             <button on:click={fetchPhotoList} disabled={listLoading} class="refresh-button">
                {#if listLoading}Refreshing...{:else}Refresh List{/if}
            </button>
        {:else}
            <p>No photos uploaded yet.</p>
        {/if}

	{:else if adminCheckError}
		<h2>Authorization Error</h2>
		<p class="error-message">Error checking authorization: {adminCheckError}</p>
		<p>You may not be authorized to access this page. Please ensure you are accessing from an approved IP address.</p>
	{:else}
		<h2>Access Denied</h2>
		<p>You are not authorized to access this page.</p>
		{#if ip}
			<p>(Your detected IP: {ip})</p>
		{/if}
	{/if}
{:catch err}
    <h2>Authorization Check Failed</h2>
	<p class="error-message">An unexpected error occurred during the authorization check: {err instanceof Error ? err.message : 'Unknown error'}</p>
{/await}

<style>
    h2 {
        margin-bottom: 1rem;
        color: var(--heading-color, inherit);
    }
	.error-message {
		color: var(--error-dark, #721c24);
		background-color: var(--error-light, #f8d7da);
		border: 1px solid var(--error-border, #f5c6cb);
		padding: 10px;
		border-radius: 5px;
        margin-top: 1rem;
        margin-bottom: 1rem;
	}
    .separator {
        border: none;
        border-top: 1px solid var(--border-color, #eee);
        margin: 2rem 0;
    }
    .photo-list {
        list-style: none;
        padding: 0;
        margin-bottom: 1rem; /* Space before refresh button */
    }
    .photo-list-item {
        margin-bottom: 0.5rem;
        padding: 0.5rem;
        background-color: var(--background-alt, #f9f9f9);
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .photo-list-item a {
        color: var(--primary-color, #007bff);
        text-decoration: none;
        word-break: break-all; /* Prevent long keys from overflowing */
        margin-right: 1rem;
    }
    .photo-list-item a:hover {
        text-decoration: underline;
    }
    .delete-button {
        padding: 0.3rem 0.6rem;
        font-size: 0.85rem;
        background-color: var(--error-dark, #dc3545);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
        white-space: nowrap; /* Prevent button text wrapping */
    }
    .delete-button:hover:not(:disabled) {
        background-color: #c82333; /* Darker red */
    }
    .delete-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .refresh-button {
        padding: 0.5rem 1rem;
        background-color: var(--secondary-color, #6c757d);
		color: white;
		border: none;
		border-radius: 5px;
		cursor: pointer;
        transition: background-color 0.2s;
        display: block; /* Make it block to take full width or adjust as needed */
        margin-top: 1rem; /* Space above refresh button */
    }
    .refresh-button:hover:not(:disabled) {
        background-color: var(--secondary-dark, #5a6268);
    }
    .refresh-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
