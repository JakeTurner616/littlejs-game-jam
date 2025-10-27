// src/util/portraitCache.js
'use strict';

const portraitCache = new Map();

export async function getPortrait(src) {
  if (portraitCache.has(src))
    return portraitCache.get(src);

  const img = new Image();
  img.src = src;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  portraitCache.set(src, img);
  return img;
}

export function preloadPortraits(urls) {
  for (const url of urls)
    getPortrait(url).catch(console.warn);
}
