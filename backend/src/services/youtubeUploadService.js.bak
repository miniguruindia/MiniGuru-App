// backend/src/services/youtubeUploadService.js
const { google } = require('googleapis');
const fs = require('fs');
const multer = require('multer');

// Configure multer for temporary video storage
const upload = multer({
  dest: 'temp/uploads/',
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'));
    }
  }
});

// OAuth2 client setup
let oauth2Client = null;

function getOAuth2Client() {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );
    const tokens = JSON.parse(process.env.YOUTUBE_TOKENS || '{}');
    oauth2Client.setCredentials(tokens);
  }
  return oauth2Client;
}

// Generate OAuth URL for initial setup (run once)
function getAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube'],
  });
}

// Handle OAuth callback (run once to get tokens)
async function handleCallback(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  console.log('Save these tokens to your .env as YOUTUBE_TOKENS:');
  console.log(JSON.stringify(tokens));
  return tokens;
}

// ─── Upload video to YouTube as UNLISTED ─────────────────────────────────────
// Called from projectController when student submits a project
async function uploadToYouTube(videoPath, metadata) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });

    console.log(`📤 Uploading video to YouTube: ${metadata.title}`);

    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description || '',
          tags: metadata.tags || ['MiniGuru', 'STEM', 'Education'],
          categoryId: '28', // Science & Technology
        },
        status: {
          privacyStatus: 'unlisted', // Always UNLISTED until admin approves
          selfDeclaredMadeForKids: true,
        },
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    console.log(`✅ Video uploaded as UNLISTED: ${response.data.id}`);

    // Delete local file after successful upload
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
      console.log(`🗑️  Deleted local file: ${videoPath}`);
    }

    return {
      videoId: response.data.id,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    };
  } catch (error) {
    console.error('❌ YouTube upload error:', error);
    // Clean up local file even on failure
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    throw error;
  }
}

// ─── Set video to PUBLIC ──────────────────────────────────────────────────────
// Called from videoApprovalController when admin approves a project
async function setVideoPublic(videoId) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });

    await youtube.videos.update({
      part: 'status',
      requestBody: {
        id: videoId,
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: true,
        },
      },
    });

    console.log(`✅ YouTube video ${videoId} set to PUBLIC`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set video ${videoId} to public:`, error);
    throw error;
  }
}

// ─── Delete video from YouTube ────────────────────────────────────────────────
// Called from videoApprovalController when admin rejects + chooses to delete
async function deleteVideo(videoId) {
  try {
    const youtube = google.youtube({ version: 'v3', auth: getOAuth2Client() });

    await youtube.videos.delete({ id: videoId });

    console.log(`🗑️  YouTube video ${videoId} deleted`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete video ${videoId}:`, error);
    throw error;
  }
}

module.exports = {
  upload,
  getAuthUrl,
  handleCallback,
  uploadToYouTube,
  setVideoPublic,  // ← NEW: used by admin approve
  deleteVideo,     // ← NEW: used by admin reject
};