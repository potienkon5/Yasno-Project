# Android (проект-заготовка Capacitor)

В папке есть исходники приложения, но **нет готовой папки android/ и APK**: их генерирует Capacitor после установки зависимостей на вашем ПК.

1. Установить Node.js LTS, Android Studio и Android SDK.
2. В файле `www/supabase-config.js` указать настройки проекта Supabase, а также выполнить `schema.sql` из корня архива.
3. Открыть терминал в этой папке и выполнить:
   ```bash
   npm install
   npm run android:add
   npm run android:sync
   npm run android:open
   ```
4. В Android Studio дождаться Gradle Sync → Build → Build APK(s); для релизного APK потребуется подпись.
5. На Android **Web Push через Service Worker может не работать в WebView**. Для гарантированных фоновых уведомлений в отдельном APK требуется нативный push-плагин, собственный канал доставки или иной поддерживаемый Android-механизм. Текущие Web Push инструкции ориентированы на установленную через Chrome PWA.
6. Проверить email-confirmation deep-link: для APK лучше использовать HTTPS с Universal/App Links или собственную схему с обработчиком, настроенным в Supabase Authentication. Без deep-link подтверждение открывает PWA/сайт; после этого можно войти в APK.

Не размещайте service_role и VAPID private key в проекте Android.
