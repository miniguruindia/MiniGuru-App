// backend/src/middleware/resolveSubject.ts
//
// WHAT THIS DOES:
//   Reads the optional X-Child-Profile-Id header sent by Flutter when a mentor
//   has started a child session (SessionState.isChildSession === true).
//
//   If the header is present → verify the child belongs to the requesting
//   mentor, then attach req.subject = child's data (name, score, id etc.)
//
//   If the header is absent  → req.subject = req.user (normal mentor/user flow)
//
// USAGE:
//   Mount AFTER authenticateToken on any route that needs child-aware data.
//   Controllers then read req.subject instead of req.user for profile, score,
//   analytics, badges, and notifications.
//
// DOES NOT AFFECT:
//   - Wallet (wallet.balance is always the MENTOR's real money)
//   - Orders  (always placed by the guardian)
//   - Auth    (JWT always belongs to the mentor/user)

import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';

// ---------------------------------------------------------------------------
// Type augmentation — extend Express Request so TypeScript is happy everywhere
// ---------------------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      /**
       * The "active subject" for this request.
       *
       * • When no child session:  identical to req.user (mentor/child account)
       * • When child session active: the ChildProfile row the mentor is viewing as
       *
       * Controllers should read req.subject for:
       *   name, score (Goins), id (subjectId), avatar, age, grade, isChild
       *
       * Controllers should read req.user for:
       *   authentication, wallet, orders — always the real JWT holder
       */
      subject?: SubjectPayload;
    }
  }
}

export interface SubjectPayload {
  /** The ID used in DB queries — either User.id or ChildProfile.id */
  subjectId: string;
  name: string;
  score: number;
  age: number;
  grade?: string | null;
  avatar?: string | null;
  /** true when resolved from a ChildProfile; false when resolved from User */
  isChild: boolean;
  /** guardianId — only set when isChild is true */
  guardianId?: string;
  /**
   * Only set when isChild is true. Every child gets an independent
   * User login (ChildProfile.linkedUserId) — routes that need to own/attribute
   * a real database record to "whoever is active" (e.g. creating a Project)
   * MUST use this User.id, never subjectId, since foreign keys like
   * Project.userId point at User, not ChildProfile. subjectId is only safe
   * for ChildProfile-scoped reads/writes (e.g. this middleware's own score
   * lookup above).
   */
  linkedUserId?: string | null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function resolveSubject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // ── 1. Must have been authenticated first ──────────────────────────────
  if (!req.user?.userId) {
    res.status(401).json({ error: 'Unauthorized — resolveSubject requires authenticateToken first' });
    return;
  }

  const childProfileId = req.headers['x-child-profile-id'] as string | undefined;

  // ── 2. No child session — subject is the logged-in user ───────────────
  if (!childProfileId || childProfileId.trim() === '') {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, name: true, score: true, age: true, profilePhoto: true },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      req.subject = {
        subjectId: user.id,
        name: user.name,
        score: user.score,
        age: user.age,
        avatar: user.profilePhoto ?? null,
        isChild: false,
      };

      next();
      return;
    } catch (err) {
      console.error('[resolveSubject] DB error (user lookup):', err);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }
  }

  // ── 3. Child session — validate and resolve ────────────────────────────
  try {
    const child = await prisma.childProfile.findUnique({
      where: { id: childProfileId },
      select: {
        id: true,
        guardianId: true,
        name: true,
        score: true,
        age: true,
        grade: true,
        avatar: true,
        linkedUserId: true,
      },
    });

    // 3a. Child must exist
    if (!child) {
      res.status(404).json({ error: 'Child profile not found' });
      return;
    }

    // 3b. Child must belong to the requesting mentor — SECURITY CHECK
    if (child.guardianId !== req.user.userId) {
      res.status(403).json({
        error: 'Forbidden — this child profile does not belong to the authenticated user',
      });
      return;
    }

    // 3c. All good — attach child as the active subject
    req.subject = {
      subjectId: child.id,
      name: child.name,
      score: child.score,
      age: child.age,
      grade: child.grade ?? null,
      avatar: child.avatar ?? null,
      isChild: true,
      guardianId: child.guardianId,
      linkedUserId: child.linkedUserId ?? null,
    };

    next();
  } catch (err) {
    console.error('[resolveSubject] DB error (child lookup):', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// resolveOwnerUserId — shared helper for any write endpoint that needs to
// attribute an action (like, comment, rating, etc.) to the real acting
// person, not whoever's JWT is on the request.
//
// Mount `resolveSubject` on the route BEFORE calling this in the controller.
//
// Returns:
//   - the correct User.id string to write into the DB, OR
//   - null, having already sent an error response — caller should
//     `if (!ownerUserId) return;` immediately after calling this.
//
// This is the exact same logic already used inline in
// projectController.ts's createProject — pulled out here so new call sites
// (likes, comments, peer ratings) don't have to duplicate it.
// ---------------------------------------------------------------------------
export function resolveOwnerUserId(req: Request, res: Response): string | null {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (req.subject?.isChild) {
    if (!req.subject.linkedUserId) {
      res.status(400).json({
        error:
          "This child profile doesn't have an independent login set up yet, " +
          'so this action can\'t be attributed correctly. Ask an admin to ' +
          "complete the child's account setup (linkedUserId) first.",
      });
      return null;
    }
    return req.subject.linkedUserId;
  }

  return userId;
}