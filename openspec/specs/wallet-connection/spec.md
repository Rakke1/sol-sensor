## ADDED Requirements

### Requirement: Wallet connect displays SOL balance
After a successful wallet connection, the system SHALL fetch the connected wallet's SOL balance from the Solana RPC endpoint and display it in the page header next to the truncated wallet address.

#### Scenario: Successful connect with balance
- **WHEN** user clicks "Connect Wallet" and approves in the wallet extension
- **THEN** the header displays the truncated address (e.g. `4xK2…9f3A`) AND the SOL balance formatted to 2 decimal places (e.g. `1.25 SOL`)

#### Scenario: Wallet with zero balance
- **WHEN** user connects a wallet with 0 SOL
- **THEN** the header displays `0.00 SOL`

#### Scenario: RPC balance fetch fails
- **WHEN** the wallet connects successfully but `getBalance` RPC call fails
- **THEN** the balance area displays `— SOL` (dash) and logs the error to console. The wallet remains connected — balance failure MUST NOT break the connect flow.

### Requirement: Disconnect releases wallet connection
When the user clicks "Disconnect", the system SHALL call `window.solana.disconnect()` in addition to clearing the React wallet state.

#### Scenario: Normal disconnect
- **WHEN** user clicks "Disconnect"
- **THEN** `window.solana.disconnect()` is called, `walletAddress` is set to null, `solBalance` is set to null, and the header reverts to showing the "Connect Wallet" button

#### Scenario: Wallet provider doesn't support disconnect
- **WHEN** user clicks "Disconnect" and `window.solana.disconnect()` throws or is undefined
- **THEN** the error is caught silently, React state is still cleared, and the UI reverts to disconnected state

### Requirement: Missing wallet extension handling
The system SHALL detect when no Solana wallet extension is installed and provide a helpful message instead of failing silently.

#### Scenario: No wallet extension installed
- **WHEN** user clicks "Connect Wallet" and `window.solana` is undefined
- **THEN** the system displays an informational message directing the user to install Phantom or another Solana wallet. The message MUST NOT use `alert()`.

### Requirement: User rejects connect
The system SHALL handle the case where the user cancels the wallet connect prompt.

#### Scenario: User clicks cancel in wallet popup
- **WHEN** user clicks "Connect Wallet" and then rejects/closes the wallet approval popup
- **THEN** the UI remains in disconnected state with no error displayed to the user. The error is logged to console.

### Requirement: Network mismatch detection
The system SHALL detect when the connected RPC endpoint's network doesn't match the expected network and display a warning.

#### Scenario: Wallet on wrong network
- **WHEN** the app expects devnet but the RPC genesis hash does not match the known devnet hash
- **THEN** a visible warning is displayed indicating the network mismatch (e.g. "Connected to wrong network — expected devnet")

#### Scenario: Genesis hash check fails
- **WHEN** the `getGenesisHash` RPC call fails
- **THEN** no warning is shown — network detection is best-effort. The failure is logged to console.
