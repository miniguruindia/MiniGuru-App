import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../../services/emailService';
import prisma from '../../utils/prismaClient';
import logger from '../../logger';


function toIdSegment(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

export async function generateId(req: Request, res: Response) {
  try {
    const { firstName, lastName } = req.body;
    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ error: 'First and last name are required' });
    }
    const base = `${toIdSegment(firstName)}.${toIdSegment(lastName)}`;
    let candidate = `${base}@miniguru.in`;
    let counter = 2;
    while (true) {
      const [inUsers, inPending] = await Promise.all([
        prisma.user.findUnique({ where: { email: candidate } }),
        prisma.pendingRegistration.findUnique({ where: { miniguruId: candidate } }),
      ]);
      if (!inUsers && !inPending) break;
      candidate = `${base}${counter}@miniguru.in`;
      counter++;
    }
    return res.json({ miniguruId: candidate, available: true });
  } catch (err) {
    logger.error({ err }, 'generate-id error');
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function sendOtp(req: Request, res: Response) {
  try {
    const { firstName, lastName, age, grade, guardianName, guardianEmail, guardianPhone, password, miniguruId } = req.body;
    if (!firstName?.trim() || !lastName?.trim() || !age || !guardianEmail?.trim() || !password || !miniguruId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())) {
      return res.status(400).json({ error: 'Please enter a valid guardian email' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 4 || ageNum > 18) {
      return res.status(400).json({ error: 'Age must be between 4 and 18' });
    }
    const taken = await prisma.user.findUnique({ where: { email: miniguruId } });
    if (taken) {
      return res.status(409).json({ error: 'This MiniGuru ID was just taken. Please go back and get a new one.' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.pendingRegistration.upsert({
      where: { miniguruId },
      create: {
        miniguruId,
        childName: `${firstName.trim()} ${lastName.trim()}`,
        age: ageNum,
        grade: grade?.trim() || null,
        guardianName: guardianName?.trim() || null,
        guardianEmail: guardianEmail.toLowerCase().trim(),
        guardianPhone: guardianPhone?.trim() || null,
        passwordHash,
        otpHash,
        otpExpiry,
      },
      update: { otpHash, otpExpiry, passwordHash },
    });
    await sendEmail({
      to: guardianEmail.trim(),
      subject: `${otp} — MiniGuru Verification Code for ${firstName.trim()}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#F5F7FF;border-radius:16px;">
        <div style="text-align:center"><div style="font-size:40px">🎓</div><h1 style="color:#5B6EF5">MiniGuru</h1></div>
        <h2 style="color:#1A1A2E">Welcome to MiniGuru! 🎉</h2>
        <p>Hi ${guardianName?.trim() || 'there'},</p>
        <p><strong>${firstName.trim()}</strong>'s MiniGuru login ID will be:</p>
        <div style="background:#E8EAF6;border-radius:10px;padding:12px 16px;margin:16px 0;font-size:16px;font-weight:bold;color:#5B6EF5">${miniguruId}</div>
        <p>Please save this ID — they will use it to log in every time.</p>
        <p>Verification code:</p>
        <div style="text-align:center;margin:24px 0"><span style="font-size:48px;font-weight:900;color:#5B6EF5;letter-spacing:12px">${otp}</span></div>
        <p style="color:#888;font-size:13px">⏱ Expires in 10 minutes.</p>
        <hr style="border:none;border-top:1px solid #E8EAF6;margin:24px 0"/>
        <p style="color:#aaa;font-size:12px;text-align:center">MiniGuru Innovation Pvt Ltd, Ujjain MP · connect@miniguru.in</p>
      </div>`,
    });
    logger.info({ miniguruId, guardianEmail }, 'OTP sent');
    return res.json({ success: true, message: 'Verification code sent to guardian email' });
  } catch (err: any) {
    logger.error({ err: err.message }, 'send-otp error');
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      return res.status(500).json({ error: 'Email service unavailable. Please try again.' });
    }
    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
}

export async function verifyOtp(req: Request, res: Response) {
  try {
    const { miniguruId, otp } = req.body;
    if (!miniguruId || !otp) {
      return res.status(400).json({ error: 'Missing miniguruId or OTP' });
    }
    const pending = await prisma.pendingRegistration.findUnique({ where: { miniguruId } });
    if (!pending) {
      return res.status(404).json({ error: 'Registration session not found. Please start again.' });
    }
    if (new Date() > pending.otpExpiry) {
      return res.status(400).json({ error: 'Code has expired. Please tap Resend to get a new one.' });
    }
    const valid = await bcrypt.compare(otp.toString().trim(), pending.otpHash);
    if (!valid) {
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }
    const user = await prisma.user.create({
      data: {
        email: pending.miniguruId,
        name: pending.childName,
        age: pending.age,
        grade: pending.grade,
        passwordHash: pending.passwordHash,
        phoneNumber: pending.guardianPhone,
        parentName: pending.guardianName,
        parentPhone: pending.guardianPhone,
        guardianEmail: pending.guardianEmail,
        emailVerified: true,
        score: 100,
        role: 'USER',
        wallet: { create: { balance: 0 } },
      },
    });
    await prisma.pendingRegistration.delete({ where: { miniguruId } });
    logger.info({ userId: user.id, miniguruId }, 'Child account created');
    return res.status(201).json({ success: true, message: 'Account created!', miniguruId: user.email, name: user.name });
  } catch (err: any) {
    logger.error({ err: err.message }, 'verify-otp error');
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'This MiniGuru ID was just taken. Please start again.' });
    }
    return res.status(500).json({ error: 'Account creation failed. Please try again.' });
  }
}
