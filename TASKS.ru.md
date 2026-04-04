# SolSensor — Список задач

> Дедлайн хакатона: 7 апреля 2026
> Каждый раздел = один вызов `openspec propose`.
> Выполнять сверху вниз — каждая группа зависит от предыдущих.

---

## Фаза 1 — Программа: довести до деплоя

### ~~1. `complete-initialize-pool`~~ ГОТОВО

Сделано в main. `initialize_pool` теперь:
- Создаёт Token-2022 минт с расширением `TransferHook` через Anchor `init` макрос
- Создаёт USDC vault ATA (`associated_token::mint = usdc_mint, authority = sensor_pool`)
- Инициализирует `ExtraAccountMetaList` с 3 extra accounts (sensor_pool, sender_contributor, receiver_contributor) через `spl_tlv_account_resolution`
- Добавлены `usdc_mint` и `rent` sysvar в структуру аккаунтов

---

### ~~2. `fix-refund-accumulator`~~ ГОТОВО

Сделано в main (реализован Вариант A):
- `QueryReceipt` теперь хранит `pool_share` (u64) и `total_supply_at_payment` (u64)
- `pay_for_query` записывает оба новых поля
- `refund_expired_receipt` вычисляет точный обратный инкремент и вычитает из `reward_per_token`
- Новый юнит-тест `refund_reverses_reward_increment` покрывает round-trip
- `QueryReceipt::LEN` обновлён до 114 байт

---

### 3. `program-build-deploy`

**Приоритет:** Гейт для всей интеграционной работы.

**Статус:** Частично готово — program ID задан, CI добавлен, конфиги обновлены. Билд/деплой не подтверждён.

**Что уже сделано:**
- Сгенерирован реальный program ID: `ETu1YLCnZyeeWBYYLSFXLNncJa4AgaHaZQ8JSUxTEosJ`
- `declare_id!` в `lib.rs` обновлён
- `Anchor.toml` обновлён с реальным program ID
- `constants.ts` (фронтенд) и `.env.example` (бэкенд) обновлены
- CI pipeline добавлен (`.github/workflows/programs-ci.yml` — запускает `anchor build && anchor test`)
- `mollusk-svm` и `litesvm` убраны из dev-deps (конфликт Solana 2.2.x / 2.1.x)

**Осталось:**
- Проверить что `anchor build` проходит локально (CI мог ещё не запускаться)
- Запустить `anchor test` — юнит-тесты должны пройти
- Задеплоить на devnet: `anchor deploy --provider.cluster devnet`
- Подтвердить что программа видна в devnet explorer

**Файлы:**
- `programs/` (билд + деплой)

---

## Фаза 2 — Devnet-окружение

### 4. `devnet-bootstrap-script`

**Приоритет:** Без этого не протестировать ничего end-to-end.

**Скоуп:**
- Создать TypeScript скрипт настройки (`scripts/bootstrap-devnet.ts` или аналог) который:
  1. Создаёт mock USDC SPL токен минт (6 decimals) на devnet, ИЛИ документирует как использовать Circle devnet USDC
  2. Вызывает `initialize_pool` на задеплоенной программе
  3. Регистрирует тестовый сенсор (model_id=3, Mock Dev Sensor)
  4. Генерирует co-signer keypair для бэкенда
  5. Генерирует sensor keypair для Ed25519 подписи
  6. Минтит тестовые USDC на кошелёк пейера для тестирования
  7. Выводит все адреса/keypairs нужные для `.env` файлов
- Добавить инструкции по настройке `.env` в README

**Файлы:**
- Новый: `scripts/bootstrap-devnet.ts`
- `backend/.env.example`
- `frontend/.env.example`
- `README.md` (секция Getting Started)

---

## Фаза 3 — Бэкенд: замкнуть платёжный цикл

### 5. `backend-payment-flow`

**Приоритет:** Основной продуктовый флоу — 402 → pay → verify → consume → data.

**Важно:** Лейаут `QueryReceipt` изменился (добавлены `pool_share` + `total_supply_at_payment`
после `amount`). Бэкенд `decodeQueryReceipt` должен быть обновлён под новый 114-байтный лейаут.

**Проблема:** Бэкенд имеет HTTP 402 гейт и верификацию рецептов, но:
- 402 challenge использует плейсхолдерные адреса (не реальные PDA)
- `consume_receipt` никогда не вызывается после отдачи данных (co-signer загружен, но не используется)
- `sensor_id` рецепта не валидируется против запрошенного сенсора
- Нет проверки дискриминатора и длины при декодировании данных рецепта
- Бинарный декодер рассчитан на старый 98-байтный лейаут — **устарел** после добавления 2 полей в `QueryReceipt`

**Скоуп:**
- **Обновить `decodeQueryReceipt`** под новый лейаут:
  `[0..8] disc, [8..40] sensor_id, [40..72] payer, [72..80] amount, [80..88] pool_share, [88..96] total_supply_at_payment, [96] consumed, [97..105] created_at, [105..113] expiry_slot, [113] bump`
- Заменить `derivePoolAddress()` / `deriveVaultAddress()` на реальный PDA derivation
  через program ID + seeds (`["pool"]` и т.д.) через `@solana/kit`
- Подставить `hardwareOwner` из он-чейн `HardwareEntry` или конфига
- После возврата данных сенсора — собрать + подписать + отправить `consume_receipt` tx через co-signer
- В `receiptVerifier` — сравнивать `receipt.sensor_id` с pubkey запрошенного сенсора
- Добавить проверку 8-байтного дискриминатора и `data.length >= 114` в `decodeQueryReceipt`
- Добавить корректные error response если consume фейлится (логировать, но не блокировать отдачу данных)

**Файлы:**
- `backend/src/middleware/http402.ts`
- `backend/src/middleware/receiptVerifier.ts`
- `backend/src/services/solana.ts`
- `backend/src/services/receiptService.ts`
- `backend/src/routes/sensors.ts` (добавить consume после ответа с данными)

---

## Фаза 4 — Фронтенд: реальные данные с чейна

### 6. `frontend-wallet-verification`

**Приоритет:** Запрос коллеги — "проверить что кошелёк подключается и показывает инфу с кошелька."

**Скоуп:**
- Проверить что connect flow работает end-to-end (Phantom на devnet)
- Добавить отображение реального SOL баланса после подключения (один `getBalance` RPC вызов)
  как доказательство связи с чейном
- Пофиксить `disconnect` — вызывать `window.solana.disconnect()` помимо очистки React state
- Показать подключённую сеть (devnet бейдж уже есть, проверить что он точный)
- Обработать edge cases: кошелёк не установлен, юзер отклоняет подключение, несовпадение сети

**Файлы:**
- `frontend/src/app/providers.tsx`
- `frontend/src/app/page.tsx` (область хедера — показать SOL баланс)
- Новый или существующий хук для SOL баланса

---

### 7. `frontend-chain-integration`

**Приоритет:** Заменить все моки реальными данными — главная фронтенд-задача.

**Проблема:** Все три хука возвращают захардкоженные данные. Instruction builders имеют
фейковые дискриминаторы. Реальные транзакции не отправляются.

**Скоуп:**
- **Instruction builders** (`lib/program.ts`): Либо сгенерировать через Codama из IDL, либо
  вручную собрать правильные Anchor дискриминаторы (первые 8 байт SHA256 от
  `"global:<instruction_name>"`), правильную сериализацию args и вернуть корректные
  `IInstruction` объекты совместимые с `@solana/kit`
- **`usePoolData`**: Заменить мок на `fetchEncodedAccount(rpc, poolPda)` +
  ручной decode `SensorPool` (или Codama codec)
- **`useContributor`**: Заменить мок на `fetchEncodedAccount(rpc, contribPda)` +
  decode `ContributorState`
- **`useTokenBalance`**: Получить реальный баланс Token-2022 ATA для подключённого кошелька
- **`ClientSimulator`**: Собрать реальную `pay_for_query` транзакцию, подписать кошельком,
  отправить, получить receipt PDA, передать бэкенду
- **`ContributorDashboard`**: Реальная `claim_rewards` транзакция
- **`InitContributor`**: Реальная `init_contributor` транзакция
- Добавить хелперы для PDA derivation (seeds + program ID → адрес)

**Файлы:**
- `frontend/src/lib/program.ts`
- `frontend/src/hooks/usePoolData.ts`
- `frontend/src/hooks/useContributor.ts`
- `frontend/src/hooks/useTokenBalance.ts`
- `frontend/src/components/ClientSimulator.tsx`
- `frontend/src/components/ContributorDashboard.tsx`
- `frontend/src/components/InitContributor.tsx`
- Новый: `frontend/src/lib/pda.ts` (хелперы PDA derivation)

---

## Фаза 5 — Тестирование и полировка

### 8. `integration-tests`

**Приоритет:** Уверенность перед демо.

**Блокер:** `litesvm >= 0.5` требует Solana 2.2.x, что конфликтует с
`anchor-lang 0.32.x` (Solana 2.1.x). LiteSVM и mollusk-svm убраны из
dev-зависимостей. Flow-тесты остаются заглушками.

**Пересмотренный скоуп:**
- ~~Реализовать `flow_tests.rs` через litesvm~~ Отложено — конфликт версий
- **Альтернатива A:** Написать TypeScript E2E smoke test который бьёт по реальной программе
  на devnet (через `@solana/kit` — отправка реальных tx, проверка стейта)
- **Альтернатива B:** Дождаться совместимости Anchor 0.33.x / Solana 2.2.x и вернуть litesvm
- **Альтернатива C:** Использовать `solana-program-test` (BanksClient) если совместим с 2.1.x
- Минимум: убедиться что `anchor test` (юнит-тесты) проходит в CI

**Файлы:**
- Новый: `scripts/e2e-smoke.ts` (предпочтительная альтернатива)
- `programs/sol-sensor/tests/flow_tests.rs` (сохранён как документация намерений)

---

### 9. `ui-polish`

**Приоритет:** Nice-to-have для качества демо.

**Скоуп:**
- Пофиксить `formatUsdc` / `formatTokens` — `Number(bigint)` теряет точность на больших числах.
  Использовать BigInt деление или `Intl.NumberFormat`
- Добавить глобальный Express error middleware в `backend/src/index.ts`
- Заменить захардкоженную reward history реальными данными (парсинг логов транзакций или недавние клеймы)
- Обновить README с задеплоенным program ID, devnet ссылками, актуальными инструкциями по настройке
- Пофиксить целочисленное деление `supplyPct` (33.3% → 33%)

**Файлы:**
- `frontend/src/components/ContributorDashboard.tsx`
- `backend/src/index.ts`
- `README.md`

---

## Порядок выполнения (3 оставшихся дня)

```
День 2 (сегодня): program-build-deploy → devnet-bootstrap-script → backend-payment-flow
День 3:           frontend-wallet-verification → frontend-chain-integration
День 4:           integration-tests → ui-polish → буфер
```

## Краткая сводка

| # | Имя изменения                  | Компонент | Статус      | Оценка      |
|---|-------------------------------|-----------|-------------|-------------|
| 1 | `complete-initialize-pool`    | program   | ГОТОВО      | ~~Большая~~ |
| 2 | `fix-refund-accumulator`      | program   | ГОТОВО      | ~~Средняя~~ |
| 3 | `program-build-deploy`        | program   | Частично    | Маленькая   |
| 4 | `devnet-bootstrap-script`     | scripts   | TODO        | Средняя     |
| 5 | `backend-payment-flow`        | backend   | TODO        | Большая     |
| 6 | `frontend-wallet-verification`| frontend  | TODO        | Маленькая   |
| 7 | `frontend-chain-integration`  | frontend  | TODO        | Большая     |
| 8 | `integration-tests`           | program   | Заблокирован| Средняя     |
| 9 | `ui-polish`                   | все       | TODO        | Маленькая   |
