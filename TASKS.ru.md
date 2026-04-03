# SolSensor — Список задач

> Дедлайн хакатона: 7 апреля 2026
> Каждый раздел = один вызов `openspec propose`.
> Выполнять сверху вниз — каждая группа зависит от предыдущих.

---

## Фаза 1 — Программа: довести до деплоя

### 1. `complete-initialize-pool`

**Приоритет:** Критический блокер — всё остальное зависит от этого.

**Проблема:** Хендлер `initialize_pool` записывает только `GlobalState` и `SensorPool` PDA.
Он НЕ создаёт Token-2022 минт, USDC vault и ExtraAccountMetaList —
а без них ни одна другая инструкция не заработает.

**Скоуп:**
- Добавить CPI для создания Token-2022 минта с расширением `TransferHook`, mint authority = pool PDA
- Добавить CPI для создания USDC vault ATA (ассоциированный токен-аккаунт pool PDA для USDC минта)
- Добавить CPI для инициализации `ExtraAccountMetaList` PDA (seeds: `["extra-account-metas", mint]`)
  с extra accounts для `transfer_hook`: `sensor_pool`, `sender_contributor`, `receiver_contributor`
- Обновить структуру аккаунтов `InitializePool` — добавить `usdc_mint`, `rent` sysvar если нужно
- Добавить USDC mint аккаунт в инструкцию чтобы можно было вывести vault ATA

**Файлы:** `programs/sol-sensor/src/instructions/initialize_pool.rs`

---

### 2. `fix-refund-accumulator`

**Приоритет:** Экономический баг — vault может быть опустошён.

**Проблема:** `refund_expired_receipt` возвращает 80% USDC из vault пейеру и уменьшает
`total_distributed`, но НЕ откатывает инкремент `reward_per_token`, который
добавил `pay_for_query`. Контрибьюторы могут клеймить награды с зарефанженных
платежей, в итоге vault опустеет.

**Скоуп:**
- Вариант A (рекомендуется): Хранить `pool_share` и `total_supply_at_payment` в `QueryReceipt`.
  При рефанде вычислить точный обратный инкремент и вычесть из `reward_per_token`.
  Нужно добавить 2 поля в `QueryReceipt` (u64 + u64 = 16 байт) и обновить `LEN`.
- Вариант B: Принять как design decision — задокументировать что рефанды не откатывают
  аккумулятор, и что hw owners + контрибьюторы сохраняют заработок с зарефанженных запросов.
  Проще, но менее справедливо.
- Обновить `pay_for_query` чтобы записывал новые поля (если вариант A).
- Обновить юнит-тесты.

**Файлы:**
- `programs/sol-sensor/src/state/query_receipt.rs`
- `programs/sol-sensor/src/instructions/pay_for_query.rs`
- `programs/sol-sensor/src/instructions/refund_expired.rs`
- `programs/sol-sensor/tests/unit_tests.rs`

---

### 3. `program-build-deploy`

**Приоритет:** Гейт для всей интеграционной работы.

**Скоуп:**
- Сгенерировать реальный keypair программы (`solana-keygen grind` или `solana-keygen new`)
- Обновить `declare_id!` в `lib.rs` (сейчас стоит плейсхолдер `Fg6PaFpo...`)
- Обновить `Anchor.toml` с реальным program ID
- Запустить `anchor build` — пофиксить ошибки компиляции если будут
- Запустить `anchor test` (юнит-тесты) — убедиться что проходят
- Задеплоить на devnet: `anchor deploy --provider.cluster devnet`
- Зафиксировать задеплоенный program ID для конфигов бэкенда/фронта

**Файлы:**
- `programs/sol-sensor/src/lib.rs`
- `programs/Anchor.toml`
- `backend/.env.example` (обновить PROGRAM_ID)
- `frontend/src/lib/constants.ts` (обновить PROGRAM_ID)

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

**Проблема:** Бэкенд имеет HTTP 402 гейт и верификацию рецептов, но:
- 402 challenge использует плейсхолдерные адреса (не реальные PDA)
- `consume_receipt` никогда не вызывается после отдачи данных (co-signer загружен, но не используется)
- `sensor_id` рецепта не валидируется против запрошенного сенсора
- Нет проверки дискриминатора и длины при декодировании данных рецепта

**Скоуп:**
- Заменить `derivePoolAddress()` / `deriveVaultAddress()` на реальный PDA derivation
  через program ID + seeds (`["pool"]` и т.д.) через `@solana/kit`
- Подставить `hardwareOwner` из он-чейн `HardwareEntry` или конфига
- После возврата данных сенсора — собрать + подписать + отправить `consume_receipt` tx через co-signer
- В `receiptVerifier` — сравнивать `receipt.sensor_id` с pubkey запрошенного сенсора
- Добавить проверку 8-байтного дискриминатора и `data.length >= 98` в `decodeQueryReceipt`
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

**Скоуп:**
- Реализовать `flow_tests.rs` (сейчас 4 заглушки с `#[ignore]`):
  - `test_full_query_lifecycle`: init → register → pay → consume → claim
  - `test_receipt_expiry_refund`: pay → warp → refund
  - `test_transfer_hook_settles_rewards`: transfer триггерит hook
  - `test_supply_cap_enforcement`: register до капа → фейл
- Требуется собранный `.so` (зависит от задачи 3)
- Опционально: E2E smoke test скрипт (curl или TypeScript) который бьёт по реальному
  бэкенду на devnet

**Файлы:**
- `programs/sol-sensor/tests/flow_tests.rs`
- `programs/sol-sensor/tests/fixtures/accounts.rs`
- Опционально новый: `scripts/e2e-smoke.ts`

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

## Порядок выполнения (4 дня)

```
День 1:  complete-initialize-pool → fix-refund-accumulator → program-build-deploy
День 2:  devnet-bootstrap-script → backend-payment-flow
День 3:  frontend-wallet-verification → frontend-chain-integration
День 4:  integration-tests → ui-polish → буфер
```

## Краткая сводка

| # | Имя изменения                  | Компонент | Оценка      |
|---|-------------------------------|-----------|-------------|
| 1 | `complete-initialize-pool`    | program   | Большая     |
| 2 | `fix-refund-accumulator`      | program   | Средняя     |
| 3 | `program-build-deploy`        | program   | Средняя     |
| 4 | `devnet-bootstrap-script`     | scripts   | Средняя     |
| 5 | `backend-payment-flow`        | backend   | Большая     |
| 6 | `frontend-wallet-verification`| frontend  | Маленькая   |
| 7 | `frontend-chain-integration`  | frontend  | Большая     |
| 8 | `integration-tests`           | program   | Средняя     |
| 9 | `ui-polish`                   | все       | Маленькая   |
