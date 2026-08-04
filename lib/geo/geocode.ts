import "server-only";

interface OpenCageResult {
  geometry: {
    lat: number;
    lng: number;
  };
}

interface OpenCageResponse {
  results: OpenCageResult[];
  status: {
    code: number;
    message: string;
  };
}

export async function geocodeZip(
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.OPENCAGE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[Event Atlas] Missing required environment variable: OPENCAGE_API_KEY"
    );
  }

  const url = new URL("https://api.opencagedata.com/geocode/v1/json");
  url.searchParams.set("q", zip);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("limit", "1");
  url.searchParams.set("no_annotations", "1");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as OpenCageResponse;

    if (
      !data.results ||
      data.results.length === 0 ||
      data.status.code !== 200
    ) {
      return null;
    }

    const { lat, lng } = data.results[0].geometry;
    return { lat, lng };
  } catch {
    return null;
  }
}
