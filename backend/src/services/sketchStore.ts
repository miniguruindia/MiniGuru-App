// Sketch storage (Nov 2026). Planning-sheet sketches and pictures used to be saved as base64 text inside the
// database (Atlas, 512 MB). They now go to Firebase Storage (5 GB) as PRIVATE files, and the database keeps
// only the file path. The file name is the hash of the picture, so the same sketch shared as an idea and
// used on the finished project is ONE file. The app is unchanged: the server still hands out the picture
// as base64 when asked (only to logged-in users, through the same endpoints as before).
// If anything goes wrong while saving, the caller keeps the old behaviour (base64 in the database), so a
// sketch is never lost.
import { createHash } from 'crypto';
import prisma from '../utils/prismaClient';
import { uploadSketchBuffer, downloadSketchBuffer, deleteSketchFile } from './firebaseStorageService';

const db: any = prisma;

export async function saveSketch(b64: string | null | undefined): Promise<string | null> {
  try {
    if (!b64) return null;
    const buf = Buffer.from(b64, 'base64');
    if (buf.length < 8) return null;
    const png = buf[0] === 0x89 && buf[1] === 0x50;
    const webp = buf[8] === 0x57 && buf[9] === 0x45;
    const ext = png ? 'png' : webp ? 'webp' : 'jpg';
    const mime = png ? 'image/png' : webp ? 'image/webp' : 'image/jpeg';
    const name = 'sketches/' + createHash('sha256').update(buf).digest('hex').slice(0, 32) + '.' + ext;
    await uploadSketchBuffer(name, buf, mime);
    return name;
  } catch (e: any) {
    console.error('saveSketch failed (keeping the picture in the database):', e?.message || e);
    return null;
  }
}

export async function loadSketch(path: string | null | undefined): Promise<string | null> {
  try {
    if (!path || !/^sketches\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(path)) return null;
    const buf = await downloadSketchBuffer(path);
    return buf ? buf.toString('base64') : null;
  } catch (e: any) {
    console.error('loadSketch failed:', e?.message || e);
    return null;
  }
}

// Remove the file only when no idea and no project still points at it.
export async function dropSketchIfUnused(path: string | null | undefined): Promise<void> {
  try {
    if (!path || !/^sketches\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(path)) return;
    const [p, i] = await Promise.all([
      db.project.count({ where: { planSketchPath: path } }),
      db.idea.count({ where: { sketchPath: path } }),
    ]);
    if (p === 0 && i === 0) await deleteSketchFile(path);
  } catch (e: any) {
    console.error('dropSketchIfUnused failed:', e?.message || e);
  }
}

// For a new project: where the sketch goes. Either {planSketchPath} (file saved) or {planSketch} (fallback).
export async function sketchFields(b64: string | undefined | null): Promise<{ planSketchPath?: string; planSketch?: string }> {
  if (!b64) return {};
  const path = await saveSketch(b64);
  return path ? { planSketchPath: path } : { planSketch: b64 };
}
