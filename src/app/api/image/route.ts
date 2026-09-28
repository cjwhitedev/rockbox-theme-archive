import { NextRequest } from "next/server";

const rockboxOrigin = "https://themes.rockbox.org";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("src");

  if (!source) {
    return new Response("Missing image source", { status: 400 });
  }

  let imageUrl: URL;

  try {
    imageUrl = new URL(source);
  } catch {
    return new Response("Invalid image source", { status: 400 });
  }

  if (
    imageUrl.origin !== rockboxOrigin ||
    !imageUrl.pathname.startsWith("/themes/")
  ) {
    return new Response("Image source is not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: {
        Accept: "image/*",
        Referer: `${rockboxOrigin}/`,
      },
      next: { revalidate: 86400 },
    });

    if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/")) {
      return new Response("Preview unavailable", { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      },
    });
  } catch {
    return new Response("Preview unavailable", { status: 502 });
  }
}
