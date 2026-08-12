import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import loadingVideo from './assets/loading-screen.mp4'
import { applyTheme, getStoredTheme } from './lib/theme'

// Применяем выбранную тему (см. lib/theme.ts) максимально рано, до того как
// React вообще начнёт что-либо рисовать - если ждать, пока сам компонент
// экрана Аккаунта или App.tsx это сделает, при вручную выбранной тёмной теме
// на телефоне со светлой системной настройкой на долю секунды мелькнул бы
// неправильный (светлый) вариант, прежде чем применился бы нужный.
applyTheme(getStoredTheme())

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

// Автообновление приложения без ручной перезагрузки. Раньше выход новой
// версии сайта подхватывался только при СЛЕДУЮЩЕМ заходе в приложение (закрыть
// и открыть заново) - service worker (см. sw.ts) обновляется в фоне сам
// (registerType: 'autoUpdate' в vite.config.ts + skipWaiting/clientsClaim в
// самом sw.ts), но уже открытая страница со старым кодом сама по себе не
// узнавала, что за кулисами появилась новая версия. 'controllerchange' -
// стандартное браузерное событие, которое приходит именно в момент, когда
// новый service worker реально взял управление страницей.
//
// Перезагрузка ОТКЛАДЫВАЕТСЯ до момента, пока вкладка не свёрнута/не в фокусе
// (document.visibilityState === 'hidden') - раньше reload() срабатывал сразу,
// в любой момент, пока человек мог как раз печатать сообщение в чате или
// заметку анкеты (это только состояние в памяти страницы, ничего не
// сохраняется черновиком) - мгновенная перезагрузка стёрла бы набранный текст
// без предупреждения. Если вкладка УЖЕ свёрнута в момент события - реагируем
// сразу (терять нечего, человек всё равно сейчас не смотрит на экран); если
// нет - ждём следующего сворачивания (переключился на другое приложение,
// заблокировал телефон) и обновляем тогда - к его возвращению уже готова
// свежая версия, ровно как он и просил ("просто открыться, без лишнего").
if ('serviceWorker' in navigator) {
  let reloaded = false
  function reloadOnce() {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (document.visibilityState === 'hidden') {
      reloadOnce()
      return
    }
    document.addEventListener('visibilitychange', function onVisibilityChange() {
      if (document.visibilityState !== 'hidden') return
      document.removeEventListener('visibilitychange', onVisibilityChange)
      reloadOnce()
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
