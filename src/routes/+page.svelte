<script lang="ts">
  import ThemeToggle from "$lib/ThemeToggle.svelte";
  import PhotoGrid from "$lib/PhotoGrid.svelte";

  const samplePhotos: string[] = ["OXC_1982.JPG"];
</script>

<svelte:head>
  <title>ocfox's photos</title>
</svelte:head>

<div class="theme-toggle-container">
  <ThemeToggle />
</div>

<h2>ocfox's photos</h2>
<PhotoGrid />

<style>
  .theme-toggle-container {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 10;
  }
</style>
