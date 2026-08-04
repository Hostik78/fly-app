import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import loadingVideo from './assets/loading-screen.mp4'

// Начинаем скачивать видео для экрана загрузки (см. LoadingScreen.tsx) прямо
// сейчас, до того как React вообще успеет что-либо отрисовать. Без этой
// строчки браузер узнавал бы про видео только когда сам компонент
// LoadingScreen отрисуется - а это уже ПОСЛЕ того, как весь код приложения
// скачался, разобрался и запустился. На мобильном интернете (не как на
// компьютере разработчика) это отнимало бы драгоценные доли секунды - видео
// вместо этого стоило бы в очереди позади всего остального и могло не успеть
// показать ни кадра. rel="preload" - стандартная браузерная подсказка "это
// понадобится очень скоро, начни грузить параллельно с остальным прямо сейчас".
const preloadLink = document.createElement('link')
preloadLink.rel = 'preload'
preloadLink.as = 'video'
preloadLink.href = loadingVideo
document.head.appendChild(preloadLink)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
