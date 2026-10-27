/**
 * @jest-environment jsdom
 */
import { ImageCache } from "@/renderer/canvas/ImageCache";

describe("ImageCache", () => {
  let images: HTMLImageElement[];

  beforeEach(() => {
    images = [];
    jest.spyOn(window, "Image").mockImplementation(() => {
      const img = document.createElement("img");
      images.push(img);
      return img;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  const orb = (imageUrl: string) => ({
    id: imageUrl,
    label: "",
    value: 1,
    radius: 10,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    imageUrl,
  });

  it("hands out an image only after it has loaded", () => {
    const cache = new ImageCache();
    cache.preload([orb("https://x.test/a.png")]);

    expect(cache.get("https://x.test/a.png")).toBeUndefined();
    images[0].onload?.(new Event("load"));
    expect(cache.get("https://x.test/a.png")).toBe(images[0]);
  });

  it("requests a URL once, even when it is broken", () => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const cache = new ImageCache();

    cache.get("https://x.test/a.png");
    images[0].onerror?.(new Event("error"));
    cache.get("https://x.test/a.png");
    cache.preload([orb("https://x.test/a.png")]);

    expect(images).toHaveLength(1);
    expect(cache.get("https://x.test/a.png")).toBeUndefined();
  });

  it("returns nothing for an orb without an image", () => {
    expect(new ImageCache().get(undefined)).toBeUndefined();
    expect(images).toHaveLength(0);
  });

  it("tells its owner when an image has loaded", () => {
    const onLoaded = jest.fn();
    const cache = new ImageCache(onLoaded);

    cache.preload([orb("https://x.test/a.png")]);
    expect(onLoaded).not.toHaveBeenCalled();
    images[0].onload?.(new Event("load"));

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("clears pending callbacks on dispose so a late load does nothing", () => {
    const warn = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const cache = new ImageCache();
    cache.preload([orb("https://x.test/a.png")]);

    cache.dispose();

    expect(images[0].onload).toBeNull();
    expect(images[0].onerror).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});
