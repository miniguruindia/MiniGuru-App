import 'dotenv/config';
import path from 'path';
import { reviewVideoFile } from './src/services/aiVideoReviewService';

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
};

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: npx ts-node test_ai_review.ts /path/to/video.mp4');
    process.exit(1);
  }
  const absPath = path.resolve(inputPath);
  const ext = path.extname(absPath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext];
  if (!mimeType) {
    console.error(`Unrecognized extension "${ext}". Supported: ${Object.keys(MIME_BY_EXT).join(', ')}`);
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in backend/.env');
    process.exit(1);
  }
  console.log(`\nReviewing: ${absPath}`);
  console.log(`MIME type: ${mimeType}`);
  console.log('Running... can take 10–90 seconds depending on video length.\n');
  const startedAt = Date.now();
  const result = await reviewVideoFile(absPath, mimeType);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('─'.repeat(60));
  console.log(`Verdict:     ${result.verdict}`);
  console.log(`Confidence:  ${result.confidence}`);
  console.log(`Reason:      ${result.reason}`);
  console.log(`Time taken:  ${elapsed}s`);
  console.log('─'.repeat(60));
  if (result.verdict === 'UNSURE' && result.reason.startsWith('AI review skipped')) {
    console.log('\n⚠️  Setup/config issue — read the reason above carefully.');
  } else {
    console.log('\n✅ Integration ran end-to-end — real judgment from Gemini.');
  }
}

main().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
