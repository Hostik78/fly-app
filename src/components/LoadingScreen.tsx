import { useEffect, useRef, useState } from 'react'
import darkWaves from '../assets/loading-waves-dark.png'
import lightWaves from '../assets/loading-waves-light.png'
import {
  getCoverUvScale,
  getExitMotionStrength,
  resolveVisualTheme,
  type VisualTheme,
} from '../lib/liveWaves'

const EXIT_DURATION_MS = 650
const IMAGE_SIZE = { width: 1717, height: 916 }

interface LoadingScreenProps {
  leaving: boolean
  onFinished: () => void
}

// Две маленькие программы ниже выполняются непосредственно видеочипом телефона.
// Первая рисует прямоугольник на весь экран, а вторая очень мягко смещает точки
// изображения несколькими независимыми волнами. Благодаря разной скорости волн
// движение не выглядит как короткий повторяющийся ролик.
const VERTEX_SHADER = `
  attribute vec2 aPosition;
  attribute vec2 aUv;
  varying vec2 vUv;

  void main() {
    vUv = aUv;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uUvScale;
  uniform float uTime;
  uniform float uMotion;

  void main() {
    vec2 center = vec2(0.5);
    vec2 uv = (vUv - center) * uUvScale + center;
    float time = uTime;

    // Несколько медленных волн создают течение без резких пульсаций.
    float broadFlow = sin(uv.y * 12.0 - time * 0.34) * 0.0042;
    float fineFlow = sin(uv.y * 25.0 + uv.x * 3.0 + time * 0.21) * 0.0017;
    float verticalDrift = sin(uv.x * 9.0 - time * 0.17) * 0.0015;
    uv += vec2(broadFlow + fineFlow, verticalDrift) * uMotion;

    // Не позволяем искажению выйти за край исходной картинки.
    vec2 halfVisible = uUvScale * 0.5;
    uv = clamp(uv, center - halfVisible, center + halfVisible);

    vec3 base = texture2D(uTexture, uv).rgb;
    vec2 shimmerOffset = vec2(0.0012 * sin(time * 0.27 + uv.y * 18.0), 0.0);
    vec3 shimmer = texture2D(uTexture, uv + shimmerOffset).rgb;

    // Едва заметное смешивание соседнего света даёт стеклянный перелив,
    // не превращая спокойную заставку в яркий рекламный эффект.
    gl_FragColor = vec4(mix(base, shimmer, 0.16 * uMotion), 1.0);
  }
`

function getCurrentTheme(systemQuery: MediaQueryList): VisualTheme {
  return resolveVisualTheme(document.documentElement.dataset.theme, systemQuery.matches)
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Не удалось создать WebGL-шейдер')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Неизвестная ошибка WebGL'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

export function LoadingScreen({ leaving, onFinished }: LoadingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const leavingRef = useRef(leaving)
  const exitStartedAtRef = useRef<number | null>(null)
  const [theme, setTheme] = useState<VisualTheme>(() => {
    const systemQuery = window.matchMedia('(prefers-color-scheme: dark)')
    return getCurrentTheme(systemQuery)
  })
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [webglReady, setWebglReady] = useState(false)
  const imageUrl = theme === 'dark' ? darkWaves : lightWaves

  // Реагируем и на ручной выбор в Аккаунте (атрибут data-theme), и на смену
  // системной темы телефона, когда выбран режим «Системная».
  useEffect(() => {
    const systemQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => setTheme(getCurrentTheme(systemQuery))
    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    systemQuery.addEventListener('change', updateTheme)
    return () => {
      observer.disconnect()
      systemQuery.removeEventListener('change', updateTheme)
    }
  }, [])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReduceMotion(motionQuery.matches)
    motionQuery.addEventListener('change', updateMotion)
    return () => motionQuery.removeEventListener('change', updateMotion)
  }, [])

  // После растворения сообщаем App, что тяжёлый графический слой уже можно
  // полностью убрать. Сам готовый экран всё это время находится под ним.
  useEffect(() => {
    leavingRef.current = leaving
    exitStartedAtRef.current = leaving ? performance.now() : null
    if (!leaving) return
    const timer = window.setTimeout(onFinished, EXIT_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [leaving, onFinished])

  useEffect(() => {
    const canvas = canvasRef.current
    // При смене темы сначала сразу показываем уже переключившуюся статичную
    // картинку, а новый canvas проявляем только после первого готового кадра.
    setWebglReady(false)
    if (!canvas || reduceMotion) {
      return
    }

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'high-performance',
    })
    if (!gl) {
      setWebglReady(false)
      return
    }

    let frameId = 0
    let disposed = false
    let vertexShader: WebGLShader | null = null
    let fragmentShader: WebGLShader | null = null
    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let texture: WebGLTexture | null = null
    let resizeObserver: ResizeObserver | null = null
    const image = new Image()

    function fallBackToStatic() {
      if (disposed) return
      cancelAnimationFrame(frameId)
      setWebglReady(false)
    }

    // Потеря WebGL-контекста может произойти, когда ОС забирает видеопамять у
    // свёрнутого приложения. В таком случае просто открываем картинку под canvas:
    // заставка остаётся красивой и загрузка приложения не блокируется.
    function handleContextLost() {
      fallBackToStatic()
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)

    try {
      vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
      fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
      program = gl.createProgram()
      if (!program) throw new Error('Не удалось создать WebGL-программу')
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'Не удалось связать WebGL-программу')
      }

      // Два треугольника образуют единый прямоугольник. В каждой вершине идут
      // координаты экрана (первые два числа) и картинки (следующие два).
      const vertices = new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1,  1, 1, 1,
      ])
      buffer = gl.createBuffer()
      if (!buffer) throw new Error('Не удалось создать WebGL-буфер')
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

      const positionLocation = gl.getAttribLocation(program, 'aPosition')
      const uvLocation = gl.getAttribLocation(program, 'aUv')
      gl.enableVertexAttribArray(positionLocation)
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0)
      gl.enableVertexAttribArray(uvLocation)
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8)

      texture = gl.createTexture()
      if (!texture) throw new Error('Не удалось создать WebGL-текстуру')
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)

      image.onload = () => {
        try {
          if (disposed || !program || !texture) return
          gl.useProgram(program)
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

          const timeLocation = gl.getUniformLocation(program, 'uTime')
          const uvScaleLocation = gl.getUniformLocation(program, 'uUvScale')
          const motionLocation = gl.getUniformLocation(program, 'uMotion')
          const startedAt = performance.now()
          // TypeScript не переносит проверку на null через два вложенных обратных
          // вызова. Эти неизменяемые ссылки фиксируют уже проверенные canvas и gl.
          const activeCanvas = canvas
          const activeGl = gl
          let firstFrameDrawn = false
          let uvScale = { x: 1, y: 1 }

          function updateCanvasSize() {
            const bounds = activeCanvas.getBoundingClientRect()
            // 2× достаточно для чёткого изображения даже на Retina. Более высокое
            // значение почти не видно глазом, но заметно нагревает телефон.
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
            const width = Math.max(1, Math.round(bounds.width * pixelRatio))
            const height = Math.max(1, Math.round(bounds.height * pixelRatio))
            if (activeCanvas.width === width && activeCanvas.height === height) return
            activeCanvas.width = width
            activeCanvas.height = height
            activeGl.viewport(0, 0, width, height)
            uvScale = getCoverUvScale({ width, height }, IMAGE_SIZE)
          }

          updateCanvasSize()
          resizeObserver = new ResizeObserver(updateCanvasSize)
          resizeObserver.observe(activeCanvas)

          function draw(now: number) {
            try {
              if (disposed || !program) return
              const exitStartedAt = exitStartedAtRef.current
              const exitElapsed = exitStartedAt === null ? 0 : now - exitStartedAt
              const motionStrength = getExitMotionStrength(
                leavingRef.current,
                exitElapsed,
                EXIT_DURATION_MS,
              )
              activeGl.uniform2f(uvScaleLocation, uvScale.x, uvScale.y)
              activeGl.uniform1f(timeLocation, (now - startedAt) / 1000)
              activeGl.uniform1f(motionLocation, motionStrength)
              activeGl.drawArrays(activeGl.TRIANGLE_STRIP, 0, 4)
              if (!firstFrameDrawn) {
                firstFrameDrawn = true
                setWebglReady(true)
              }
              frameId = requestAnimationFrame(draw)
            } catch {
              fallBackToStatic()
            }
          }

          frameId = requestAnimationFrame(draw)
        } catch {
          fallBackToStatic()
        }
      }
      image.onerror = () => setWebglReady(false)
      image.src = imageUrl
    } catch {
      fallBackToStatic()
    }

    return () => {
      disposed = true
      image.onload = null
      image.onerror = null
      cancelAnimationFrame(frameId)
      resizeObserver?.disconnect()
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      if (texture) gl.deleteTexture(texture)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
      if (vertexShader) gl.deleteShader(vertexShader)
      if (fragmentShader) gl.deleteShader(fragmentShader)
    }
  }, [imageUrl, reduceMotion])

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-50 overflow-hidden"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${EXIT_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* Картинка находится под canvas и поэтому одновременно служит мгновенным
          первым кадром и надёжным запасным вариантом без WebGL. */}
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full transition-opacity duration-500"
        style={{ opacity: webglReady ? 1 : 0 }}
      />
    </div>
  )
}
