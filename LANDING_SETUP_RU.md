# Лендинг «Ясно»: публикация и установка

## Адреса после публикации GitHub Pages

- Лендинг: https://potienkon5.github.io/Yasno-Project/
- Android APK: https://github.com/potienkon5/Yasno-Project/releases/latest/download/yasno-release.apk
- iPhone PWA: https://potienkon5.github.io/Yasno-Project/app/
- Email-подтверждение (прежний адрес): https://potienkon5.github.io/Yasno-Project/auth/
- Политика конфиденциальности: https://potienkon5.github.io/Yasno-Project/app/privacy.html

## Публикация

1. GitHub → Settings → Pages → Build and deployment → Source = GitHub Actions.
2. Проверьте PR и объедините его с main.
3. В GitHub Actions проверьте успешность задания «3 - Publish Yasno site, iOS PWA and email confirmations». При необходимости запустите его вручную.
4. Проверьте главную страницу, Android-ссылку, iOS веб-приложение и страницу подтверждения почты.
5. На iPhone откройте веб-приложение в Safari → Поделиться → На экран «Домой» → Добавить.
6. Проверьте регистрацию/вход на iPhone и подтверждение почты. В Supabase должен быть разрешён redirect URL https://potienkon5.github.io/Yasno-Project/auth/.

## Что нужно заполнить перед коммерческим запуском

- Цена: стоимость использования и платные функции не были предоставлены. Лендинг не придумывает цену и не принимает оплату.
- Контакты: нет подтверждённого рабочего email/телефона, поэтому вымышленные контакты не публиковались.
- Юридические сведения: в capacitor/www/privacy.html остаются шаблоны [УКАЗАТЬ РЕГИОН], [УКАЗАТЬ EMAIL], [НАЗВАНИЕ/ФИО ОПЕРАТОРА], [ДАТА]. Заполнить и проверить до продвижения обязательно. Обрабатываются данные родителей и детей.
- Android APK: файл yasno-release.apk должен быть опубликован в последнем GitHub Release. В противном случае кнопка скачивания даст 404.
- iPhone: это PWA, а не приложение из App Store. В нём нельзя обещать Android-уведомления или гарантированную фоновую доставку.
- Публичность: GitHub Pages размещает фронтенд. Не публикуйте секреты или ключи service_role.

## Где вносить изменения

- landing/index.html — лендинг, продающие тексты, адаптивный дизайн, кнопки и демонстрационная модель экрана.
- capacitor/www/ — настоящее приложение, опубликованное по /app/ для iOS.
- .github/workflows/publish-auth-page.yml — единая публикация лендинга, приложения и auth-страницы.
- tests/site-pages.test.mjs — проверки ссылок, PWA и публикации.

Для раздела «Тарифы», оплаты, формы заявки и поддержки потребуется указанная владельцем коммерческая информация.
