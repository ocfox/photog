/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from "./$types";

interface R2Object {
  key: string;
}

interface R2ListResult {
  objects: R2Object[];
  truncated: boolean;
  delimitedPrefixes: string[];
}

export const GET: RequestHandler = async ({ platform }) => {
  if (!platform?.env?.PHOTOS) {
    return new Response(JSON.stringify({ error: "R2 not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Fetch the object from R2 and cast it to the correct type
    const listResult = (await platform.env.PHOTOS.list()) as R2ListResult;

    if (listResult && listResult.objects) {
      const keys = listResult.objects.map((object) => ({ key: object.key }));

      return new Response(JSON.stringify(keys), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
