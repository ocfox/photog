import type { RequestHandler } from "@sveltejs/kit";
import { error as svelteKitError, json } from '@sveltejs/kit'; // Import error helper and json response helper
// Buffer import is not needed for Web Crypto API (used by Cloudflare Workers)
// import { Buffer } from 'buffer';

// Helper function for admin check (mirroring /api/ip logic)
const isAdminRequest = (request: Request, platform: App.Platform | undefined): boolean => {
    const ip = request.headers.get("cf-connecting-ip");
    // Ensure ADMIN_IP_LIST is treated as potentially undefined
    const adminIpListEnv = platform?.env?.ADMIN_IP_LIST;
    const adminIpList = typeof adminIpListEnv === 'string' ? adminIpListEnv.split(",") : undefined;

    if (!ip || !adminIpList) {
        return false;
    }
    // Trim whitespace from IPs in the list for robustness
    return adminIpList.map(adminIp => adminIp.trim()).includes(ip);
};

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const POST: RequestHandler = async ({ request, platform }) => {
    // --- Authorization Check ---
    if (!isAdminRequest(request, platform)) {
        throw svelteKitError(403, 'Forbidden: You are not authorized to upload files.');
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null; // Allow null check

    if (!file) {
        throw svelteKitError(400, 'No file provided');
    }

    // --- File Size Check ---
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw svelteKitError(400, `File size exceeds the limit of ${MAX_FILE_SIZE_MB}MB.`);
    }

    // --- File Type Check ---
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
        throw svelteKitError(400, 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    }

    // --- R2 Bucket Check ---
    const bucket = platform?.env?.PHOTOS;
    if (!bucket) {
        console.error("R2 bucket (PHOTOS) is not configured in wrangler.toml or environment variables.");
        throw svelteKitError(500, 'File storage configuration error.');
    }

    try {
        // --- Generate Unique Filename ---
        // Use crypto.randomUUID() for a standard unique ID
        // Extract file extension
        const fileExtension = file.name.split('.').pop();
        // Ensure extension is valid before appending (basic check)
        const safeExtension = fileExtension && /^[a-zA-Z0-9]+$/.test(fileExtension) ? `.${fileExtension}` : '';
        const uniqueKey = `${crypto.randomUUID()}${safeExtension}`;

        // --- Upload to R2 ---
        await bucket.put(uniqueKey, file.stream(), {
            httpMetadata: {
                contentType: file.type,
                // Consider adding cache control headers if appropriate
                // cacheControl: 'public, max-age=31536000',
            },
            // Add custom metadata if needed
            // customMetadata: {
            //     originalFilename: file.name,
            //     uploadedBy: 'admin', // Or some user identifier if you implement user accounts
            // },
        });

        // --- Success Response ---
        // Return the unique key so the frontend knows the URL
        return json({ message: "File uploaded successfully", key: uniqueKey }, { status: 200 });

    } catch (error: unknown) {
        console.error("Error during file upload:", error); // Log the actual error server-side
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during upload.';
        throw svelteKitError(500, `Upload failed: ${errorMessage}`);
    }
};
