import type { RequestHandler } from '@sveltejs/kit';
import { error as svelteKitError, json } from '@sveltejs/kit';

// Helper function for admin check (can be extracted to a shared lib later if needed)
const isAdminRequest = (request: Request, platform: App.Platform | undefined): boolean => {
    const ip = request.headers.get("cf-connecting-ip");
    const adminIpListEnv = platform?.env?.ADMIN_IP_LIST;
    const adminIpList = typeof adminIpListEnv === 'string' ? adminIpListEnv.split(",") : undefined;

    if (!ip || !adminIpList) {
        return false;
    }
    return adminIpList.map(adminIp => adminIp.trim()).includes(ip);
};

export const DELETE: RequestHandler = async ({ request, platform, params }) => {
    // --- Authorization Check ---
    if (!isAdminRequest(request, platform)) {
        throw svelteKitError(403, 'Forbidden: You are not authorized to delete files.');
    }

    // --- R2 Bucket Check ---
    const bucket = platform?.env?.PHOTOS;
    if (!bucket) {
        console.error("R2 bucket (PHOTOS) is not configured.");
        throw svelteKitError(500, 'File storage configuration error.');
    }

    // --- Get Key from URL ---
    const key = params.key; // SvelteKit automatically decodes the parameter
    if (!key) {
        throw svelteKitError(400, 'Missing photo key in URL.');
    }

    try {
        // --- Check if file exists before deleting (optional but good practice) ---
        // R2 delete doesn't error if the key doesn't exist, but a 'head' check confirms it was there.
        const object = await bucket.head(key);
        if (object === null) {
            throw svelteKitError(404, `File not found: ${key}`);
        }

        // --- Delete from R2 ---
        await bucket.delete(key);

        // --- Success Response ---
        // Use 200 with message or 204 No Content
        // return new Response(null, { status: 204 });
        return json({ message: `File ${key} deleted successfully.` }, { status: 200 });

    } catch (error: unknown) {
        // Handle specific SvelteKit errors thrown above
        if (error && typeof error === 'object' && 'status' in error) {
             throw error; // Re-throw SvelteKit errors
        }

        // Handle other errors
        console.error(`Error deleting file ${key}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during deletion.';
        // Avoid throwing a new svelteKitError if it was a 404 from head, let the initial one propagate
        throw svelteKitError(500, `Deletion failed: ${errorMessage}`);
    }
};
