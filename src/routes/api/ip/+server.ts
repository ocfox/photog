/// <reference types="@cloudflare/workers-types" />
import type { RequestHandler } from "@sveltejs/kit";


export const GET: RequestHandler = async ({ request, platform }) => {
    const ip = request.headers.get("cf-connecting-ip");
    const adminIpList = platform?.env?.ADMIN_IP_LIST?.split(",");
    if (!ip || !adminIpList) {
        return new Response(JSON.stringify({ ip: "unknown", isAdmin: false }));
    }
    return new Response(JSON.stringify({ ip, isAdmin: adminIpList?.includes(ip) }));
};
