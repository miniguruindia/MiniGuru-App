import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

// Only initialize Razorpay if keys are provided
let razorpayInstance: Razorpay | null = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized');
} else {
    console.log('⚠️  Razorpay keys not configured - payment features disabled');
}

export default razorpayInstance;
