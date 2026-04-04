export interface SensorPool {
  totalSupply: bigint;
  maxSupply: bigint;
  rewardPerToken: bigint;
  activeSensors: number;
  totalQueries: bigint;
  totalDistributed: bigint;
}

export interface ContributorState {
  rewardPerTokenPaid: bigint;
  rewardsOwed: bigint;
  tokenBalance: bigint;
}

export interface SensorData {
  sensorType: string;
  aqi: number;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  timestamp: number;
  location: { lat: number; lng: number };
}

export interface SensorProof {
  signature: string;
  sensorPubkey: string;
  message: string;
}

export interface SensorResponse {
  data: SensorData;
  proof: SensorProof;
}

export interface PaymentChallenge {
  status: 402;
  message: string;
  payment: {
    programId: string;
    instruction: string;
    price: { amount: number; currency: string; decimals: number };
    suggestedNonce: string;
    accounts: {
      globalState: string;
      sensorPool: string;
      poolVault: string;
      hardwareEntry: string;
      hardwareOwner: string;
      hardwareOwnerUsdc: string;
      usdcMint: string;
    };
  };
}

export type DemoStep =
  | 'idle'
  | 'requesting'
  | 'paying'
  | 'fetching'
  | 'verifying'
  | 'done'
  | 'error';

export interface DemoState {
  step: DemoStep;
  challenge: PaymentChallenge | null;
  txSignature: string | null;
  receiptPda: string | null;
  response: SensorResponse | null;
  signatureValid: boolean | null;
  error: string | null;
}
