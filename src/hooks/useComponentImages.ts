import { useState, useEffect } from 'react';
import { SVG_CONFIGS } from '../models/componentGeometry';

const imageCache = new Map<string, HTMLImageElement>();
const imagePromises = new Map<string, Promise<HTMLImageElement>>();
const assetImageCache = new Map<string, HTMLImageElement>();
const assetImagePromises = new Map<string, Promise<HTMLImageElement>>();

function loadImage(type: string): Promise<HTMLImageElement> {
  if (imagePromises.has(type)) return imagePromises.get(type)!;

  const config = SVG_CONFIGS[type as keyof typeof SVG_CONFIGS];
  if (!config) return Promise.reject(new Error(`Unknown component type: ${type}`));

  const promise = new Promise<HTMLImageElement>((resolve) => {
    const cached = imageCache.get(type);
    if (cached) {
      resolve(cached);
      return;
    }

    const img = new window.Image();
    img.src = config.url;
    img.onload = () => {
      imageCache.set(type, img);
      resolve(img);
    };
  });

  imagePromises.set(type, promise);
  return promise;
}

Object.keys(SVG_CONFIGS).forEach(loadImage);

export { SVG_CONFIGS } from '../models/componentGeometry';

export function useComponentImage(type: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(imageCache.get(type) || null);

  useEffect(() => {
    if (imageCache.has(type)) {
      setImage(imageCache.get(type)!);
      return;
    }

    loadImage(type).then(setImage);
  }, [type]);

  return image;
}

function loadAssetImage(url: string): Promise<HTMLImageElement> {
  if (assetImagePromises.has(url)) return assetImagePromises.get(url)!;

  const promise = new Promise<HTMLImageElement>((resolve) => {
    const cached = assetImageCache.get(url);
    if (cached) {
      resolve(cached);
      return;
    }

    const img = new window.Image();
    img.src = url;
    img.onload = () => {
      assetImageCache.set(url, img);
      resolve(img);
    };
  });

  assetImagePromises.set(url, promise);
  return promise;
}

export function useAssetImage(url: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(assetImageCache.get(url) || null);

  useEffect(() => {
    if (assetImageCache.has(url)) {
      setImage(assetImageCache.get(url)!);
      return;
    }

    loadAssetImage(url).then(setImage);
  }, [url]);

  return image;
}
