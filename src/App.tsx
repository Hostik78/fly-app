import { useState } from 'react'
import { FeedScreen } from './components/FeedScreen'
import { DevicePreview } from './components/DevicePreview'
import { ContentControls } from './components/ContentControls'
import { profiles as defaultProfiles } from './data/profiles'

// Корневой компонент приложения — то, с чего всё начинается.
//
// Сейчас FeedScreen обёрнут в DevicePreview — это временный инструмент для удобной
// разработки (рамка телефона + выбор модели + зум + панель экспериментов), НЕ часть
// самого приложения. Когда дойдём до публикации для настоящих пользователей, здесь
// останется просто <FeedScreen />.
//
// Состояние анкет живёт именно здесь (а не в DevicePreview), потому что и панель
// экспериментов, и сам экран ленты должны видеть одни и те же, актуальные данные.
function App() {
  const [profiles, setProfiles] = useState(defaultProfiles)

  return (
    <DevicePreview
      controlsSlot={
        <ContentControls
          profiles={profiles}
          onChange={setProfiles}
          onReset={() => setProfiles(defaultProfiles)}
        />
      }
    >
      <FeedScreen profiles={profiles} />
    </DevicePreview>
  )
}

export default App
