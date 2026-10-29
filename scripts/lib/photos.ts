// Maps photos come at ~411px wide; "=s1600" asks Google for up to 1600px so heroes aren't blurry.
// Street View thumbnails show the street outside, not the business's work, so they're dropped.
export function businessPhotos(p: { imageUrls?: string[]; imageUrl?: string | null }) {
  const urls = p.imageUrls?.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : [];
  return urls.filter((u) => !u.includes("streetviewpixels")).map(largePhoto);
}

export function largePhoto(url: string) {
  return url.includes("googleusercontent.com") ? url.replace(/=[^/=]*$/, "=s1600") : url;
}
