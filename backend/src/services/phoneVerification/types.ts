// backend/src/services/phoneVerification/types.ts
//
// One interface every phone-verification provider implements, so the
// controller never knows (or cares) which SMS service is behind it.
//
// Two shapes exist because providers genuinely work differently:
//   mode 'client' — the BROWSER asks the provider to text the code and the
//     person types it back into the provider's own SDK, which hands the app a
//     signed proof. The backend only checks that proof.   (Firebase Phone Auth)
//   mode 'server' — OUR backend asks the provider to text the code and later
//     asks the provider whether the typed code is right.   (MSG91, later)

export interface PhoneVerificationProvider {
  readonly name: 'firebase' | 'msg91';
  readonly mode: 'client' | 'server';

  /** True only when every setting this provider needs is present. */
  isConfigured(): boolean;

  /** Public settings the browser needs (client mode); null for server mode. */
  clientConfig(): Record<string, string> | null;

  /** Server mode: send the SMS. Client mode providers throw. */
  sendOtp(phoneE164: string): Promise<void>;

  /** Server mode: is this code right for this number? Client mode throws. */
  verifyOtp(phoneE164: string, code: string): Promise<boolean>;

  /** Client mode: is this proof genuine AND for exactly this number? */
  verifyClientProof(phoneE164: string, proof: string): Promise<boolean>;
}
