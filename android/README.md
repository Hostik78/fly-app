# Android-приложение (APK)

Настоящее Android-приложение, собранное официальным инструментом Google
([Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)) вокруг уже
опубликованного сайта (Trusted Web Activity - тонкая Android-обёртка вокруг
того же самого веб-приложения, не отдельный код). Обновлять сам APK заново
нужно, только если меняется что-то в самой "обёртке" (иконка на экране Android,
цвет заставки при запуске и т.п.) - обычные правки сайта подхватываются сами,
пересборка не нужна.

## Файлы здесь

- `twa-manifest.json` - настройки обёртки (в git, безопасно - секретов не содержит).
- `android.keystore` - ключ подписи приложения (НЕ в git, см. `.gitignore`).
  Нужен для КАЖДОЙ пересборки - без него новый APK не сможет обновить уже
  установленный на телефонах (Android посчитает его другим приложением).
  **Берегите этот файл** - если потеряется, обновить уже установленные копии
  будет невозможно, только новая установка с нуля.
- `.keystore-credentials` - пароль от ключа (НЕ в git). Сохраните ещё и в
  менеджере паролей на всякий случай.

## Что нужно один раз установить на машине для сборки

```bash
brew install openjdk@17
brew install --cask android-commandlinetools

# Принять лицензии и поставить нужные пакеты
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
yes | sdkmanager --licenses --sdk_root="$ANDROID_HOME"
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-36" "build-tools;36.1.0"

# Bubblewrap ищет tools/ или bin/ прямо в корне SDK (старый формат) - у Homebrew
# инструменты лежат на уровень глубже (cmdline-tools/latest/bin) - симлинк чинит это
ln -sfn "$ANDROID_HOME/cmdline-tools/latest/bin" "$ANDROID_HOME/bin"

npm install -g @bubblewrap/cli

# Говорим Bubblewrap использовать именно эту Java/SDK, а не пытаться скачивать
# свои (его собственный автозагрузчик JDK в этом окружении не работал - качал
# исходный код JDK вместо готовой программы)
mkdir -p ~/.bubblewrap
cat > ~/.bubblewrap/config.json << 'JSON'
{"jdkPath":"/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk","androidSdkPath":"/opt/homebrew/share/android-commandlinetools"}
JSON
```

## Пересборка APK

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export BUBBLEWRAP_KEYSTORE_PASSWORD="FlyApp2026Signing"
export BUBBLEWRAP_KEY_PASSWORD="FlyApp2026Signing"

cd android
bubblewrap build --skipPwaValidation < /dev/null
```

Результат - `android/app-release-signed.apk` (и `app-release-bundle.aab` для
Google Play, если он вообще понадобится). Интерактивный мастер самого
Bubblewrap плохо работает без настоящего терминала (падает на первом же
вопросе) - `< /dev/null` и переменные `BUBBLEWRAP_*_PASSWORD` обходят это.

Если меняются настройки самой обёртки (см. `twa-manifest.json` - имя, цвета,
иконки), сначала пересобрать сам файл настроек по актуальному
`manifest.webmanifest` сайта:

```bash
node -e "
const { TwaManifest } = require('/opt/homebrew/lib/node_modules/@bubblewrap/cli/node_modules/@bubblewrap/core');
TwaManifest.fromWebManifest('https://fly-app-eight.vercel.app/manifest.webmanifest').then(async (m) => {
  m.packageId = 'app.fly.twa';
  m.signingKey = { path: './android.keystore', alias: 'fly' };
  await m.saveToFile('./twa-manifest.json');
});
"
```

## Известные грабли (см. также LESSONS.md в корне проекта)

- `sdkmanager`/`bubblewrap` - и то, и другое требует `JAVA_HOME` установленным
  именно в текущем вызове команды (переменные окружения не сохраняются между
  отдельными командами в этой среде разработки).
- `BUILD_TOOLS_VERSION` внутри самого Bubblewrap может требовать более новую
  версию build-tools, чем последняя стабильная в момент установки - если
  сборка ругается на "androidSdk isn't correct" или на версию build-tools,
  проверить, какая версия реально нужна, командой `grep BUILD_TOOLS_VERSION
  node_modules/@bubblewrap/core/dist/lib/androidSdk/AndroidSdkTools.js` и
  доустановить её через `sdkmanager`.
- Родная заставка Android (SPLASH_IMAGE_DRAWABLE/SPLASH_SCREEN_BACKGROUND_COLOR/
  SPLASH_SCREEN_FADE_OUT_DURATION в AndroidManifest.xml) намеренно убрана
  (2026-08-05) - у сайта уже есть своя заставка с анимацией волн
  (см. src/components/LoadingScreen.tsx), и обе подряд выглядели как два
  разных экрана. **Если запускать `bubblewrap build` после пересборки
  `twa-manifest.json` из webmanifest** (см. команду выше) - Bubblewrap
  регенерирует AndroidManifest.xml с нуля и молча вернёт эти три строки
  обратно. После такой пересборки нужно снова вручную убрать их из
  AndroidManifest.xml (внутри тега `<activity>` с `android:name=".LauncherActivity"`).
