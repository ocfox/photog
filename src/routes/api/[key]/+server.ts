/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, platform }) => {
  if (!platform?.env?.PHOTOS) {
    const env = platform?.env;
    return new Response(JSON.stringify({ error: "R2 not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { key } = params;

  try {
    // Fetch the object from R2
    const object = await platform.env.PHOTOS.get(key);

    if (!object) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return the file as a response stream
    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type":
          object.httpMetadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
