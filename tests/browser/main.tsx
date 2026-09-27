import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PhotoPrivacySettings } from '../../src/components/PhotoPrivacySettings'
import { Avatar } from '../../src/components/Avatar'
import { selectFixtureActor } from '../browser-supabase'
import '../../src/index.css'
const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002']
export function Fixture() {
  const [actor, setActor] = useState(0)
  const [version, setVersion] = useState(0)
  function choose(next: number) {
    selectFixtureActor(next)
    setActor(next)
  }
  return (
    <main className="mx-auto p-4 text-fly-ink" style={{ width: 390, maxWidth: '100vw' }}>
      <h1 className="text-xl mb-3">Изолированная проверка Fly</h1>
      <p className="text-xs text-fly-gray mb-3">
        Тестовые участники только в памяти этого компьютера. Auth и Storage подменены; правила
        доступа исполняет PostgreSQL.
      </p>
      <nav className="flex gap-3 mb-4">
        <button onClick={() => choose(0)}>Владелец</button>
        <button onClick={() => choose(1)}>Собеседник</button>
        <button onClick={() => choose(-1)}>Выйти</button>
      </nav>
      <p className="mb-3">
        Сессия: {actor === 0 ? 'владелец' : actor === 1 ? 'собеседник' : 'выход'}
      </p>
      <Avatar
        key={`photo-${version}`}
        userId={ids[0]}
        gender="female"
        className="w-20 h-20 rounded-full mb-4"
      />
      {actor === 0 && (
        <div key={version}>
          <PhotoPrivacySettings />
          <PhotoPrivacySettings recipient={ids[1]} />
        </div>
      )}
      <button
        className="mt-4 p-2 bg-fly-fog rounded-fly-sm"
        onClick={() => {
          window.dispatchEvent(new Event('photo-access-changed'))
          setVersion((v) => v + 1)
        }}
      >
        Перепроверить фото
      </button>
    </main>
  )
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Fixture />
  </React.StrictMode>,
)
