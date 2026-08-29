export type VisualTheme = 'light' | 'dark'

interface Size {
  width: number
  height: number
}

interface UvScale {
  x: number
  y: number
}

// Ручной выбор человека всегда важнее темы телефона. Отсутствие атрибута
// означает режим «Системная», поэтому тогда ориентируемся на media query.
export function resolveVisualTheme(
  explicitTheme: string | undefined,
  systemIsDark: boolean,
): VisualTheme {
  if (explicitTheme === 'light' || explicitTheme === 'dark') return explicitTheme
  return systemIsDark ? 'dark' : 'light'
}

// Аналог object-fit: cover для шейдера. Возвращаем долю текстуры, которая
// помещается на экране: лишнее равномерно обрезается с двух сторон, а картинка
// никогда не растягивается и не меняет пропорции.
export function getCoverUvScale(viewport: Size, image: Size): UvScale {
  const viewportRatio = viewport.width / viewport.height
  const imageRatio = image.width / image.height

  if (viewportRatio < imageRatio) {
    return { x: viewportRatio / imageRatio, y: 1 }
  }

  return { x: 1, y: imageRatio / viewportRatio }
}

// Во время растворения движение не обрывается, а мягко теряет силу. Формула
// smoothstep даёт спокойное замедление без заметного перелома скорости.
export function getExitMotionStrength(
  leaving: boolean,
  elapsedMs: number,
  durationMs: number,
): number {
  if (!leaving) return 1
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs))
  const easedProgress = progress * progress * (3 - 2 * progress)
  return 1 - easedProgress
}
