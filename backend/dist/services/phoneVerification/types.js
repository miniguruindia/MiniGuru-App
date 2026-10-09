"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
