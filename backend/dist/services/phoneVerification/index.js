"use strict";
// backend/src/services/phoneVerification/index.ts
//
// Picks the active provider (PHONE_VERIFICATION_PROVIDER, default 'firebase')
// and normalises phone numbers to E.164, the format every provider needs.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPhoneProvider = getPhoneProvider;
exports.normalizePhone = normalizePhone;
exports.maskPhone = maskPhone;
const firebasePhoneProvider_1 = require("./firebasePhoneProvider");
const msg91PhoneProvider_1 = require("./msg91PhoneProvider");
function getPhoneProvider() {
    const wanted = (process.env.PHONE_VERIFICATION_PROVIDER || 'firebase').trim().toLowerCase();
    return wanted === 'msg91' ? msg91PhoneProvider_1.msg91PhoneProvider : firebasePhoneProvider_1.firebasePhoneProvider;
}
/**
 * "98765 43210", "09876543210", "919876543210", "+91 98765-43210" → "+919876543210".
 * Numbers that already carry another country code (+44…) are kept as typed.
 * Returns null when it can't be a real number.
 */
function normalizePhone(raw) {
    if (!raw)
        return null;
    const s = raw.replace(/[\s\-().]/g, '');
    if (/^\+\d{8,15}$/.test(s))
        return s;
    if (/^00\d{8,15}$/.test(s))
        return '+' + s.slice(2);
    if (/^91[6-9]\d{9}$/.test(s))
        return '+' + s;
    if (/^0?[6-9]\d{9}$/.test(s))
        return '+91' + s.replace(/^0/, '');
    return null;
}
function maskPhone(e164) {
    return e164.length <= 6 ? e164 : e164.slice(0, 3) + '*'.repeat(e164.length - 6) + e164.slice(-3);
}
