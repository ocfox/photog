<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from '$app/environment'; // Added
  import { goto } from '$app/navigation'; // Added
  import ExifReader from "exifreader";

  export let src: string;
  export let photoKey: string; // Added

  export let showExampleOnError: boolean = true;

  interface ExifTag {
    value: any;
    description: string;
  }

  let cameraInfo: string | null = null;
  let dateInfo: string | null = null;
  let exposureInfo: string | null = null;
  let lensInfo: string | null = null;

  let isLoading = true;
  let error: string | null = null;
  let hasData = false;

  const desiredTags = [
    "Make",
    "Model",
    "DateTimeOriginal",
    "FNumber",
    "ExposureTime",
    "ISOSpeedRatings",
    "FocalLength",
    "LensModel",
    "Software",
  ];

  const exampleExifBase: Record<string, string> = {
    Camera: "ExampleCam Corp. SuperShot 1000",
    "Date Taken": "2023:10:27 10:30:00",
    "F-Number": "f/2.8",
    "Exposure Time": "1/125",
    ISO: "100",
    "Focal Length": "50 mm",
    Software: "ExampleEdit Pro",
  };

  let isVisible = false;

  // --- Admin State ---
  let isAdmin: boolean | undefined = undefined; // Admin status
  let deleteError: string | null = null; // Error message for delete operation
  let isDeleting = false; // Track delete operation state

  // --- Functions ---
  function toggleVisibility() {
    isVisible = !isVisible;
  }

  async function checkAdminStatus() {
		if (!browser) return;
		try {
			const response = await fetch('/api/ip');
			if (!response.ok) throw new Error(`Failed to check admin status: ${response.status}`);
			const data = await response.json() as { isAdmin: boolean };
			isAdmin = data.isAdmin;
		} catch (err) {
			console.error('Error checking admin status:', err);
			isAdmin = false; // Assume not admin on error
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

  // --- Lifecycle ---
  onMount(async () => {
    isLoading = true;
    error = null;
    let fetchOrParseFailed = false;

    if (!src) {
      error = "No image source provided.";
      isLoading = false;
      fetchOrParseFailed = true;
    }

    if (!fetchOrParseFailed) {
      try {
        const response = await fetch(src);
        if (!response.ok) {
          if (response.type === "opaque") {
            throw new Error("Cannot fetch image data due to CORS policy.");
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const imageBuffer = await response.arrayBuffer();

        const tags: Record<string, ExifTag> = ExifReader.load(imageBuffer);

        if (!tags || Object.keys(tags).length === 0) {
          error = "No EXIF data found in the image.";
          fetchOrParseFailed = true;
        } else {
          const make = tags["Make"]?.description?.trim() || "";
          const model = tags["Model"]?.description?.trim() || "";

          if (make || model) {
            if (model.toUpperCase().includes(make.toUpperCase())) {
              cameraInfo = model;
            } else {
              cameraInfo = make && model ? `${make} ${model}` : make || model;
            }
          }

          if (cameraInfo?.includes("NIKON CORPORATION ")) {
            cameraInfo = cameraInfo.replace("NIKON CORPORATION ", "").trim();
          }

          const dateOriginal = tags["DateTimeOriginal"]?.description || "";
          if (dateOriginal) {
            const dateParts = dateOriginal.split(" ")[0].split(":");
            if (dateParts.length >= 3) {
              dateInfo = `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;
            } else {
              dateInfo = dateOriginal.split(" ")[0].replace(/:/g, "/");
            }
          }

          const focalLength = tags["FocalLength"]?.description || "";
          const fNumber = tags["FNumber"]?.description || "";

          const formattedFNumber = fNumber
            ? fNumber.replace(/^f\//i, "ƒ/")
            : "";
          const iso = tags["ISOSpeedRatings"]?.description || "";
          const exposureTime = tags["ExposureTime"]?.description || "";

          const exposureParts = [];
          if (focalLength) exposureParts.push(focalLength);
          if (formattedFNumber) exposureParts.push(formattedFNumber);
          if (iso) exposureParts.push(`ISO${iso}`);
          if (exposureTime) exposureParts.push(exposureTime + "s");

          if (exposureParts.length > 0) {
            exposureInfo = exposureParts.join(" ");
          }

          const rawLensInfo = tags["LensModel"]?.description || null;
          if (rawLensInfo) {
            lensInfo = rawLensInfo.replace(/f\//gi, "ƒ/");
          }

          hasData = !!(cameraInfo || dateInfo || exposureInfo || lensInfo);

          if (!hasData) {
            error = "No relevant EXIF data found.";
            fetchOrParseFailed = true;
          }
        }
      } catch (e: any) {
        console.error(
          "Error fetching or parsing EXIF data with ExifReader:",
          e,
        );
        fetchOrParseFailed = true;

        if (e.message?.includes("CORS")) {
          error = "Could not load EXIF data due to server restrictions (CORS).";
        } else if (e.message?.includes("Invalid image format")) {
          error = "Could not load EXIF data. Invalid image format or file.";
        } else {
          error = `Failed to load EXIF data: ${e.message || "Unknown error"}`;
        }
      }
    }

    if (fetchOrParseFailed && showExampleOnError) {
      const exampleToShow = { ...exampleExifBase };

      if (!hasData) {
        delete (exampleToShow as any).Camera;
      }

      cameraInfo = exampleToShow.Camera;
      dateInfo = exampleToShow["Date Taken"];
      exposureInfo = exampleToShow["Exposure Time"];
      lensInfo = exampleToShow["Focal Length"];
      hasData = true;

      if (error) {
        error += " (Showing example data)";
      } else {
        error = "Showing example data.";
      }
    }

    isLoading = false;

    // Check admin status only on browser mount
    if (browser) {
      checkAdminStatus();
    }
  });
</script>

<button
  class="exif-toggle"
  on:click|stopPropagation={toggleVisibility}
  aria-label={isVisible ? "Hide photo details" : "Show photo details"}
  title={isVisible ? "Hide photo details" : "Show photo details"}
>
  {isVisible ? "×" : "i"}
</button>

<div class="exif-container" class:visible={isVisible}>
  {#if isLoading}
    <p>Loading EXIF data...</p>
  {:else if error && !hasData}
    <p class="error">{error}</p>
  {:else if hasData}
    {#if error && error.includes("example")}
      <p class="info-note">(Real EXIF data could not be loaded)</p>
    {/if}
    <div class="exif-content">
      {#if cameraInfo}<div class="camera">{cameraInfo}</div>{/if}
      {#if exposureInfo}<div class="exposure">{exposureInfo}</div>{/if}
      {#if lensInfo}<div class="lens">{lensInfo}</div>{/if}
      {#if dateInfo}<div class="date">{dateInfo}</div>{/if}
    </div>
  {:else}
    <p>No EXIF data available.</p>
  {/if}

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

<style>
  .exif-toggle {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    font-size: 1rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1002;
    transition: background-color 0.2s;
  }

  .exif-toggle:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  .exif-container {
    position: absolute;
    top: 1rem;
    right: 3.5rem;
    z-index: 1001;

    opacity: 0;
    visibility: hidden;
    transform: translateX(10px);
    transition:
      opacity 0.3s,
      visibility 0.3s,
      transform 0.3s;

    font-size: 0.8rem;
    padding: 0.75rem;
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 0;
    border: none;
    max-width: 280px;
    color: #e5e7eb;
    max-height: calc(100vh - 6rem);
    overflow-y: auto;
  }

  .exif-container.visible {
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
  }

  :global(html.dark) .exif-container {
    background-color: rgba(31, 41, 55, 0.7);
    color: #d1d5db;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .error {
    color: #fca5a5;
    font-weight: 500;
  }
  :global(html.dark) .error {
    color: #f87171;
  }

  .info-note {
    font-size: 0.7rem;
    font-style: italic;
    opacity: 0.7;
    margin-bottom: 0.5rem;
    color: #9ca3af;
  }
  :global(html.dark) .info-note {
    color: #6b7280;
  }

  .exif-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .camera {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .date,
  .exposure,
  .lens {
    opacity: 0.9;
  }

  /* Admin Actions */
  .admin-actions {
    margin-top: 1rem; /* Add some space above */
    border-top: 1px solid rgba(255, 255, 255, 0.1); /* Separator line */
    padding-top: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  :global(html.dark) .admin-actions {
    border-top-color: rgba(255, 255, 255, 0.15);
  }

  .delete-button {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
    background-color: var(--error-dark, #dc3545);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
    width: 100%; /* Make button full width within container */
    text-align: center;
  }
  .delete-button:hover:not(:disabled) {
    background-color: #c82333; /* Darker red */
  }
  .delete-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .delete-error {
    background-color: rgba(220, 53, 69, 0.2); /* Semi-transparent red */
    color: #fca5a5; /* Light red text */
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.8em;
    border: 1px solid #dc3545; /* Red border */
    width: 100%; /* Full width */
    box-sizing: border-box;
  }
  :global(html.dark) .delete-error {
    color: #f87171;
    background-color: rgba(220, 53, 69, 0.25);
    border-color: #c82333;
  }

</style>
