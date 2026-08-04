// Экран загрузки - показывается в самом начале, пока приложение проверяет,
// вошли ли вы в аккаунт (см. overallLoading в App.tsx) - одинаково и для тех,
// кто уже входил раньше, и для тех, кто открывает сайт впервые. Обычно длится
// меньше секунды, но ролик зациклен (loop) на случай, если проверка займёт
// чуть дольше своих исходных 8 секунд.
//
// autoPlay + muted + playsInline - стандартное для браузеров сочетание:
// видео без звука браузер разрешает запускать само, без нажатия пользователем
// (обычное <video autoPlay> со звуком телефон/браузер тихо заблокировал бы).
// playsInline - чтобы видео на iPhone проигрывалось прямо на месте, а не
// разворачивалось на весь экран поверх интерфейса, как обычно происходит с
// видео на телефоне.
import loadingVideo from '../assets/loading-screen.mp4'

export function LoadingScreen() {
  return (
    <div className="h-full w-full overflow-hidden bg-white">
      <video src={loadingVideo} autoPlay muted loop playsInline className="h-full w-full object-cover" />
    </div>
  )
}
