import type { Orb } from "@/types/types";

/**
 * Loads orb images once per URL and keeps the ones that finished loading.
 * A broken or still loading image is never handed out, because `drawImage`
 * throws on a broken one.
 */
export class ImageCache {
  // Only images that finished loading.
  private readonly loaded = new Map<string, HTMLImageElement>();
  // Every URL ever requested, so a slow or broken one is fetched only once.
  private readonly requested = new Set<string>();
  // Images still loading, so dispose() can silence their callbacks.
  private readonly pending = new Set<HTMLImageElement>();

  /** `onLoaded` lets an idle chart draw once when an image arrives. */
  constructor(private readonly onLoaded: () => void = () => {}) {}

  /** The loaded image for `url`, or `undefined` while loading or broken. */
  get(url: string | undefined): HTMLImageElement | undefined {
    if (!url) return undefined;
    const img = this.loaded.get(url);
    if (!img) this.request(url);
    return img;
  }

  preload(orbs: Orb[]) {
    for (const orb of orbs) if (orb.imageUrl) this.request(orb.imageUrl);
  }

  /** Silences pending loads and forgets every image. */
  dispose() {
    for (const img of this.pending) {
      img.onload = null;
      img.onerror = null;
    }
    this.pending.clear();
    this.loaded.clear();
    this.requested.clear();
  }

  private request(url: string) {
    if (this.requested.has(url)) return;
    this.requested.add(url);

    const img = new Image();
    img.crossOrigin = "anonymous";
    this.pending.add(img);
    img.onload = () => {
      this.pending.delete(img);
      this.loaded.set(url, img);
      this.onLoaded();
    };
    img.onerror = () => {
      this.pending.delete(img);
      console.warn(`Failed to load: ${url}`);
    };
    img.src = url;
  }
}
