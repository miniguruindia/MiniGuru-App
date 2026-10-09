// backend/src/services/phoneVerification/msg91PhoneProvider.ts
//
// PLACEHOLDER for MSG91. Not wired to MSG91 yet — it exists so the provider
// interface has its second shape (mode 'server') in place and the switch is
// one environment variable (PHONE_VERIFICATION_PROVIDER=msg91) plus filling
// in the two methods below once MSG91 DLT registration is done.
//
// While not implemented, isConfigured() is always false, so selecting it by
// mistake just shows "being set up" in the app — it can never pretend to send.
//
// To finish later (MSG91 OTP API, India):
//   sendOtp:   POST https://control.msg91.com/api/v5/otp  (authkey, template_id, mobile)
//   verifyOtp: GET  https://control.msg91.com/api/v5/otp/verify?mobile=..&otp=..
// Settings it will need: MSG91_AUTH_KEY, MSG91_TEMPLATE_ID.

import type { PhoneVerificationProvider } from './types';

export const msg91PhoneProvider: PhoneVerificationProvider = {
  name: 'msg91',
  mode: 'server',

  isConfigured() {
    return false; // flip to a real check (auth key + template id) when implemented
  },

  clientConfig() {
    return null;
  },

  async sendOtp() {
    throw new Error('MSG91 is not implemented yet.');
  },

  async verifyOtp() {
    throw new Error('MSG91 is not implemented yet.');
  },

  async verifyClientProof() {
    throw new Error('MSG91 verifies on the server — use verifyOtp.');
  },
};
