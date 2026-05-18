'use client'
/**
 * UpdateProductForm.tsx
 * ProductForm already handles both add AND edit:
 *   - When product prop is passed → skips source picker
 *   - Detects sourceType (AMAZON/OWN) → goes straight to correct step pre-filled
 * So we simply re-export it here.
 */
export { ProductForm as UpdateProductForm } from './ProductForm'
