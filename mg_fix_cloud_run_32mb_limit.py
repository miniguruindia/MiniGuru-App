#!/usr/bin/env python3
"""
mg_fix_cloud_run_32mb_limit.py

THE definitive root cause, confirmed by the actual HTTP status code (413)
and independently verified against Google Cloud's own documented behavior:

Cloud Run enforces a hard, non-configurable 32MB limit on incoming request
bodies. This is a platform limit — no memory setting, multer config, header
fix, or client-side rewrite can touch it, which is exactly why every prior
attempt made zero difference. It explains every piece of evidence gathered:
100% reproducible regardless of code changes, unaffected by memory, zero
trace in Cloud Run's own application logs (rejected before reaching the
Node process), and the misleading CORS wording (the gateway's 413 response
never carries our app's CORS headers, since our app never got to run).

THE FIX: the video (and thumbnail) must never travel through Cloud Run's
own request body at all. Instead:
  1. Flutter asks the backend for a short-lived signed upload URL
  2. Flutter uploads the file DIRECTLY to Firebase Storage (bypasses Cloud
     Run's body-size limit entirely — this is a separate Google service)
  3. Flutter sends a small, plain JSON request to /project/ with just the
     storage path(s) instead of raw file bytes
  4. The backend downloads the video from Firebase Storage on its own
     (server-to-server — Cloud Run's limit only applies to INCOMING
     requests, not its own outbound calls) before running the existing,
     unchanged AI review + YouTube upload steps

This reuses your existing Firebase Admin SDK setup (same service account,
same bucket already used for material images) — no new infrastructure.

Run from the repo root:
    cd /workspaces/MiniGuru-App
    python3 mg_fix_cloud_run_32mb_limit.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
APP = ROOT / "app" / "miniguru"


def patch(path, old, new, expected_count=1, label=""):
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected_count:
        print(f"❌ ABORT [{label}]: expected {expected_count} match(es) in "
              f"{path.name}, found {count}. No edits made — paste this "
              f"error back before re-running.")
        sys.exit(1)
    text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")
    print(f"✅ Patched: {path.relative_to(ROOT)}  [{label}]")


# ══════════════════════════════════════════════════════════════════════════
# 1. firebaseStorageService.ts — add signed-upload-URL + download helpers
# ══════════════════════════════════════════════════════════════════════════
storage_service = BACKEND / "src" / "services" / "firebaseStorageService.ts"

patch(
    storage_service,
    "import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';\nimport { getStorage } from 'firebase-admin/storage';",
    "import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';\n"
    "import { getStorage } from 'firebase-admin/storage';\n"
    "import * as path from 'path';\n"
    "import * as os from 'os';\n"
    "import { randomUUID } from 'crypto';",
    label="add path/os/crypto imports",
)

patch(
    storage_service,
    "function publicUrlFor(storagePath: string): string {",
    "export function publicUrlFor(storagePath: string): string {",
    label="export publicUrlFor (needed for thumbnail URLs)",
)

# Append the new functions at the end of the file.
storage_service_text = storage_service.read_text(encoding="utf-8")
NEW_FUNCTIONS = '''

/**
 * Generates a short-lived (15 min) signed URL the CLIENT can PUT a file to
 * DIRECTLY — completely bypassing Cloud Run's hard, non-configurable 32MB
 * request body limit, since the upload goes straight to Firebase Storage
 * (a separate Google service) and never touches our own backend's request
 * body at all. Used for video/thumbnail uploads from the Flutter app.
 */
export async function generateUploadUrl(
  folder: 'temp-videos' | 'project-thumbnails',
  ownerUserId: string,
  filename: string,
  contentType: string
): Promise<{ uploadUrl: string; storagePath: string }> {
  const firebaseApp = ensureInitialized();
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${ownerUserId}/${Date.now()}-${safeFilename}`;
  const bucket = getStorage(firebaseApp).bucket();
  const file = bucket.file(storagePath);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType,
  });
  return { uploadUrl, storagePath };
}

/**
 * Downloads a previously-uploaded file from Firebase Storage to a local
 * temp path on Cloud Run's own disk, for the existing AI review / YouTube
 * upload code (which both expect a local file path) to keep working
 * completely unchanged. This is a server-to-server transfer — Cloud Run's
 * 32MB limit only applies to requests coming INTO Cloud Run from outside,
 * never to Cloud Run's own outbound calls, so this direction is unaffected.
 */
export async function downloadToTempFile(storagePath: string): Promise<string> {
  const firebaseApp = ensureInitialized();
  const bucket = getStorage(firebaseApp).bucket();
  const ext = path.extname(storagePath) || '.mp4';
  const localPath = path.join(os.tmpdir(), `${randomUUID()}${ext}`);
  await bucket.file(storagePath).download({ destination: localPath });
  return localPath;
}

/**
 * Best-effort cleanup of a temp video upload once YouTube has it — never
 * throws, since a cleanup failure should never affect the actual response.
 * NEVER call this on a thumbnail path — the thumbnail's Firebase Storage
 * URL is the permanent Project.thumbnail reference, not a temp file.
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
  try {
    const firebaseApp = ensureInitialized();
    const bucket = getStorage(firebaseApp).bucket();
    await bucket.file(storagePath).delete();
  } catch (err: any) {
    // Already gone / never existed / any other issue — logging would be
    // nice but this must never throw and never block a response.
  }
}
'''
storage_service.write_text(storage_service_text + NEW_FUNCTIONS, encoding="utf-8")
print("✅ Patched: backend/src/services/firebaseStorageService.ts  [append generateUploadUrl / downloadToTempFile / deleteFromStorage]")


# ══════════════════════════════════════════════════════════════════════════
# 2. projectController.ts — accept storage paths instead of multer files
# ══════════════════════════════════════════════════════════════════════════
project_controller = BACKEND / "src" / "controllers" / "project" / "projectController.ts"

patch(
    project_controller,
    'import { notifyAllAdmins } from "../../services/notificationService";',
    'import { notifyAllAdmins } from "../../services/notificationService";\n'
    'import { generateUploadUrl, downloadToTempFile, deleteFromStorage, publicUrlFor } from "../../services/firebaseStorageService";',
    label="import new Firebase Storage helpers",
)

patch(
    project_controller,
    """  const {
    title, description, startDate, endDate, materials, categoryName, collaboratorIds
  } = req.body;

  if (!title || !description || !startDate || !endDate || !materials || !categoryName) {
    return res.status(400).json({ error: "All fields are required" });
  }""",
    """  const {
    title, description, startDate, endDate, materials, categoryName, collaboratorIds,
    videoStoragePath, thumbnailStoragePath,
  } = req.body;

  if (!title || !description || !startDate || !endDate || !materials || !categoryName) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (!videoStoragePath) {
    return res.status(400).json({ error: "Video is required" });
  }""",
    label="createProject: accept videoStoragePath/thumbnailStoragePath",
)

patch(
    project_controller,
    """  interface MulterFileMap {
    thumbnail?: Express.Multer.File[];
    video?: Express.Multer.File[];
  }
  const files = req.files as MulterFileMap;

  const thumbnailFile = files?.thumbnail?.[0];
  const videoFile = files?.video?.[0];

  if (!videoFile) {
    return res.status(400).json({ error: "Video file is required" });
  }

  // ✅ Upload thumbnail as before (local storage). Guarded — a failed
  // thumbnail write (disk hiccup, permissions, etc.) must never hang the
  // whole upload request; the project can exist without a custom thumbnail
  // (the YouTube-CDN fallback in getPublishedVideoFeed covers this).
  let thumbnailPath = "";
  if (thumbnailFile) {
    try {
      thumbnailPath = await uploadThumbnail(thumbnailFile);
    } catch (thumbError) {
      logger.warn(`Thumbnail upload failed, continuing without it: ${(thumbError as Error).message}`);
      thumbnailPath = "";
    }
  }""",
    """  // ── Video arrives via Firebase Storage now, not the request body ─────
  // Cloud Run enforces a hard, non-configurable 32MB limit on incoming
  // request bodies — real videos routinely exceed that (confirmed via a
  // real 413 response). The Flutter app now uploads the video (and
  // optional thumbnail) DIRECTLY to Firebase Storage first (see
  // requestUploadUrl below), completely bypassing that limit, then sends
  // us just this small JSON request with the storage path(s). We download
  // the video here, server-to-server — Cloud Run's body-size limit only
  // applies to requests INTO Cloud Run from outside, not to Cloud Run's
  // own outbound calls, so this direction is unaffected.
  let localVideoPath: string;
  try {
    localVideoPath = await downloadToTempFile(videoStoragePath);
  } catch (downloadError) {
    logger.error(`Failed to download video from storage: ${(downloadError as Error).message}`);
    return res.status(500).json({ error: "Could not retrieve the uploaded video. Please try again." });
  }

  // The thumbnail is just referenced by its already-public Firebase
  // Storage URL — no need to re-download or re-host it locally (which was
  // also, incidentally, subject to the same "Cloud Run disk writes count
  // as container RAM" gotcha as the old video path — this fixes that too).
  const thumbnailPath = thumbnailStoragePath ? publicUrlFor(thumbnailStoragePath) : "";""",
    label="createProject: download video from storage instead of reading multer file",
)

patch(
    project_controller,
    '    aiReview = await reviewVideoFile(videoFile.path, videoFile.mimetype);',
    '    aiReview = await reviewVideoFile(localVideoPath, "video/mp4");',
    label="createProject: AI review reads the downloaded local path",
)

patch(
    project_controller,
    """      const result = await uploadToYouTube(
        videoFile.path, // multer diskStorage sets file.path to the full local path
        {""",
    """      const result = await uploadToYouTube(
        localVideoPath,
        {""",
    label="createProject: YouTube upload reads the downloaded local path",
)

patch(
    project_controller,
    """  } else {
    logger.warn('YouTube service not available, skipping video upload');
    // For now, we'll store an empty videoUrl - this might need to be handled differently
    // depending on how the frontend expects to handle videos without YouTube
    videoUrl = ""; // Or you could return an error here
  }

  try {
    const project = await projectService.create(ownerUserId, {""",
    """  } else {
    logger.warn('YouTube service not available, skipping video upload');
    // For now, we'll store an empty videoUrl - this might need to be handled differently
    // depending on how the frontend expects to handle videos without YouTube
    videoUrl = ""; // Or you could return an error here
  }

  // The Firebase Storage copy of the VIDEO was only ever a staging area to
  // get it past Cloud Run's request-size limit — not needed once YouTube
  // has it. Deliberately NOT deleting the thumbnail: its Firebase Storage
  // URL IS the permanent thumbnail reference stored on the project.
  deleteFromStorage(videoStoragePath).catch(() => {});

  try {
    const project = await projectService.create(ownerUserId, {""",
    label="createProject: clean up temp video from storage after YouTube has it",
)

# New exported handler for the signed-URL request, added right after createProject.
patch(
    project_controller,
    """    logger.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
};""",
    """    logger.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// POST /project/request-upload-url — generates a short-lived signed URL the
// client can PUT a video or thumbnail to DIRECTLY, bypassing Cloud Run's
// hard 32MB request body limit entirely for the actual file bytes.
export const requestUploadUrl = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { filename, contentType, kind } = req.body;
  if (!filename || !contentType || !kind) {
    return res.status(400).json({ error: "filename, contentType, and kind are required" });
  }
  if (kind !== "video" && kind !== "thumbnail") {
    return res.status(400).json({ error: "kind must be 'video' or 'thumbnail'" });
  }

  try {
    const folder = kind === "video" ? "temp-videos" : "project-thumbnails";
    const { uploadUrl, storagePath } = await generateUploadUrl(folder, userId, filename, contentType);
    res.json({ uploadUrl, storagePath });
  } catch (error) {
    logger.error(`Failed to generate upload URL: ${(error as Error).message}`);
    res.status(500).json({ error: "Could not prepare upload. Please try again." });
  }
};""",
    expected_count=1,
    label="add requestUploadUrl handler",
)

n = len(project_controller.read_text(encoding="utf-8").splitlines())
print(f"   wc -l check [projectController.ts]: {n} lines")
assert n > 260, "file looks truncated — STOP"


# ══════════════════════════════════════════════════════════════════════════
# 3. projectRoutes.ts — new route, remove multer from POST '/'
# ══════════════════════════════════════════════════════════════════════════
project_routes = BACKEND / "src" / "routes" / "projectRoutes.ts"

patch(
    project_routes,
    "import { createProject, updateProject, getProjectById, getAllProjectsForUser , getAllProjects, findCollaborator, getPublishedVideoFeed} from '../controllers/project/projectController';",
    "import { createProject, updateProject, getProjectById, getAllProjectsForUser , getAllProjects, findCollaborator, getPublishedVideoFeed, requestUploadUrl} from '../controllers/project/projectController';",
    label="import requestUploadUrl",
)

patch(
    project_routes,
    "projectRouter.post('/', authenticateToken, resolveSubject, validateProject, uploadThumbnailAndVideoMiddleware, createProject);",
    "projectRouter.post('/', authenticateToken, resolveSubject, validateProject, createProject);\n\n"
    "// Signed direct-to-Firebase-Storage upload URL — bypasses Cloud Run's\n"
    "// hard 32MB request body limit for the actual video/thumbnail bytes.\n"
    "// MUST be registered before get('/:id') below (Rule 28).\n"
    "projectRouter.post('/request-upload-url', authenticateToken, requestUploadUrl);",
    label="projectRoutes: remove multer from POST '/', add request-upload-url route",
)

n = len(project_routes.read_text(encoding="utf-8").splitlines())
print(f"   wc -l check [projectRoutes.ts]: {n} lines")
assert n > 40, "file looks truncated — STOP"


# ══════════════════════════════════════════════════════════════════════════
# 4. MiniguruApi.dart — request signed URLs, PUT directly to storage, then
#    a small plain-JSON POST with just the storage paths
# ══════════════════════════════════════════════════════════════════════════
api_file = APP / "lib" / "network" / "MiniguruApi.dart"

OLD_UPLOAD = """  Future<http.Response?> uploadProjectWithMedia(
    Map<String, dynamic> data,
    XFile video,
    XFile? thumbnail,
  ) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    final url = Uri.parse('$_baseUrl/project/');

    if (kIsWeb) {
      // ── Flutter Web path — build the multipart body manually ──────────
      // http.MultipartRequest.send() streams its body as a ReadableStream
      // on Flutter Web's fetch()-based HTTP client. Modern Chrome requires
      // an explicit `duplex: 'half'` option on any fetch() call whose body
      // is a stream — without it, the browser rejects the call outright
      // with "Failed to fetch", BEFORE the request ever reaches the
      // network. This is a documented issue for this exact combination
      // (Flutter Web + http.MultipartRequest + an Express/Multer backend).
      // Building the body as a single plain byte array and sending it via
      // a normal http.post() call avoids the streamed-body path entirely.
      final videoBytes = await video.readAsBytes();
      final thumbBytes = thumbnail != null ? await thumbnail.readAsBytes() : null;

      final boundary =
          '----MiniGuruBoundary${DateTime.now().microsecondsSinceEpoch}';
      final body = <int>[];

      void writeField(String name, String value) {
        body.addAll(utf8.encode('--$boundary\\r\\n'));
        body.addAll(
            utf8.encode('Content-Disposition: form-data; name="$name"\\r\\n\\r\\n'));
        body.addAll(utf8.encode('$value\\r\\n'));
      }

      void writeFile(
          String fieldName, String filename, List<int> bytes, String contentType) {
        body.addAll(utf8.encode('--$boundary\\r\\n'));
        body.addAll(utf8.encode(
            'Content-Disposition: form-data; name="$fieldName"; filename="$filename"\\r\\n'));
        body.addAll(utf8.encode('Content-Type: $contentType\\r\\n\\r\\n'));
        body.addAll(bytes);
        body.addAll(utf8.encode('\\r\\n'));
      }

      writeField('title', data['title']);
      writeField('description', data['description']);
      writeField('startDate', data['startDate']);
      writeField('endDate', data['endDate']);
      writeField('categoryName', data['categoryName']);
      writeField('materials', jsonEncode(data['materials']));
      if (data['collaboratorIds'] != null &&
          (data['collaboratorIds'] as List).isNotEmpty) {
        writeField('collaboratorIds', jsonEncode(data['collaboratorIds']));
      }

      writeFile('video', video.name, videoBytes, 'video/mp4');
      if (thumbBytes != null) {
        writeFile('thumbnail', thumbnail!.name, thumbBytes, 'image/jpeg');
      }

      body.addAll(utf8.encode('--$boundary--\\r\\n'));

      final headers = _buildHeaders(authToken.accessToken);
      headers.remove('Content-Type');
      headers['Content-Type'] = 'multipart/form-data; boundary=$boundary';

      final response = await http.post(url, headers: headers, body: body);
      _handleResponse(response);
      return response;
    }

    // ── Native (Android/iOS) path — unchanged ──────────────────────────
    // MultipartRequest works fine here since it goes through dart:io's
    // HttpClient, not the browser fetch() API, so the web-only streaming
    // issue above never applied to this path.
    var request = http.MultipartRequest('POST', url);

    request.fields['title']        = data['title'];
    request.fields['description']  = data['description'];
    request.fields['startDate']    = data['startDate'];
    request.fields['endDate']      = data['endDate'];
    request.fields['categoryName'] = data['categoryName'];
    request.fields['materials']    = jsonEncode(data['materials']);
    if (data['collaboratorIds'] != null &&
        (data['collaboratorIds'] as List).isNotEmpty) {
      request.fields['collaboratorIds'] = jsonEncode(data['collaboratorIds']);
    }

    final uploadHeaders = _buildHeaders(authToken.accessToken);
    uploadHeaders.remove('Content-Type');
    request.headers.addAll(uploadHeaders);

    var videoStream = http.ByteStream(video.openRead());
    var videoLength = await video.length();
    request.files.add(http.MultipartFile(
      'video', videoStream, videoLength,
      filename: basename(video.path),
      contentType: MediaType.parse('video/mp4'),
    ));
    if (thumbnail != null) {
      var thumbnailStream = http.ByteStream(thumbnail.openRead());
      var thumbnailLength = await thumbnail.length();
      request.files.add(http.MultipartFile(
        'thumbnail', thumbnailStream, thumbnailLength,
        filename: basename(thumbnail.path),
        contentType: MediaType.parse('image/jpeg'),
      ));
    }

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    _handleResponse(response);
    return response;
  }"""

NEW_UPLOAD = """  /// Asks the backend for a short-lived signed URL to upload a file
  /// DIRECTLY to Firebase Storage, bypassing Cloud Run's hard 32MB request
  /// body limit entirely (confirmed via a real 413 response — this is a
  /// platform limit, not something any client-side or Cloud Run config
  /// change can work around). Returns {'uploadUrl':..., 'storagePath':...}
  /// or null on any failure.
  Future<Map<String, String>?> _requestUploadUrl(
      String filename, String contentType, String kind) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/project/request-upload-url'),
        headers: _buildHeaders(authToken.accessToken),
        body: jsonEncode({
          'filename': filename,
          'contentType': contentType,
          'kind': kind,
        }),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return {
          'uploadUrl': data['uploadUrl'] as String,
          'storagePath': data['storagePath'] as String,
        };
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<http.Response?> uploadProjectWithMedia(
    Map<String, dynamic> data,
    XFile video,
    XFile? thumbnail,
  ) async {
    final authToken = await _getValidToken();
    if (authToken == null) return null;

    // ── Step 1: upload the video DIRECTLY to Firebase Storage ───────────
    // Cloud Run enforces a hard, non-configurable 32MB limit on incoming
    // request bodies — real videos routinely exceed that. Uploading
    // straight to Firebase Storage (a separate Google service) completely
    // bypasses that limit; our own backend's request body never carries
    // the actual video bytes at all.
    final videoUrlInfo = await _requestUploadUrl(video.name, 'video/mp4', 'video');
    if (videoUrlInfo == null) {
      return http.Response(
          jsonEncode({'error': 'Could not prepare video upload. Please try again.'}),
          500);
    }
    final videoBytes = await video.readAsBytes();
    final videoPut = await http.put(
      Uri.parse(videoUrlInfo['uploadUrl']!),
      headers: {'Content-Type': 'video/mp4'},
      body: videoBytes,
    );
    if (videoPut.statusCode < 200 || videoPut.statusCode >= 300) {
      return http.Response(
          jsonEncode({'error': 'Video upload failed (storage error). Please try again.'}),
          500);
    }

    // ── Step 2: same for the thumbnail, if any (non-critical — proceed
    // without one if this fails) ─────────────────────────────────────────
    String? thumbnailStoragePath;
    if (thumbnail != null) {
      final thumbUrlInfo =
          await _requestUploadUrl(thumbnail.name, 'image/jpeg', 'thumbnail');
      if (thumbUrlInfo != null) {
        final thumbBytes = await thumbnail.readAsBytes();
        final thumbPut = await http.put(
          Uri.parse(thumbUrlInfo['uploadUrl']!),
          headers: {'Content-Type': 'image/jpeg'},
          body: thumbBytes,
        );
        if (thumbPut.statusCode >= 200 && thumbPut.statusCode < 300) {
          thumbnailStoragePath = thumbUrlInfo['storagePath'];
        }
      }
    }

    // ── Step 3: a small, plain JSON request with just the metadata +
    // storage paths — comfortably under Cloud Run's 32MB limit no matter
    // how large the actual video is, since the video itself is never in
    // this request body. ─────────────────────────────────────────────────
    final url = Uri.parse('$_baseUrl/project/');
    final body = {
      'title': data['title'],
      'description': data['description'],
      'startDate': data['startDate'],
      'endDate': data['endDate'],
      'categoryName': data['categoryName'],
      'materials': data['materials'],
      'videoStoragePath': videoUrlInfo['storagePath'],
      if (thumbnailStoragePath != null) 'thumbnailStoragePath': thumbnailStoragePath,
      if (data['collaboratorIds'] != null &&
          (data['collaboratorIds'] as List).isNotEmpty)
        'collaboratorIds': data['collaboratorIds'],
    };

    final response = await http.post(
      url,
      headers: _buildHeaders(authToken.accessToken),
      body: jsonEncode(body),
    );
    _handleResponse(response);
    return response;
  }"""

count = api_file.read_text(encoding="utf-8").count(OLD_UPLOAD)
if count != 1:
    print(f"❌ ABORT: expected 1 match for the current uploadProjectWithMedia "
          f"function in MiniguruApi.dart, found {count}. No edits made — "
          f"paste this error back before re-running.")
    sys.exit(1)
text = api_file.read_text(encoding="utf-8").replace(OLD_UPLOAD, NEW_UPLOAD)
api_file.write_text(text, encoding="utf-8")
print("✅ Patched: app/miniguru/lib/network/MiniguruApi.dart  "
      "[uploadProjectWithMedia now uploads direct-to-storage instead of "
      "through Cloud Run's request body]")

n = len(api_file.read_text(encoding="utf-8").splitlines())
print(f"   wc -l check [MiniguruApi.dart]: {n} lines")
assert n > 1200, "file looks truncated — STOP"


# ══════════════════════════════════════════════════════════════════════════
# 5. draftsRepository.dart — STOP SWALLOWING THE REAL ERROR
#    This is the actual reason every failed upload has shown the exact same
#    generic, useless message no matter what really went wrong on the
#    backend. From now on the real status code + real backend error text
#    (or a real network-level message) reaches the screen.
# ══════════════════════════════════════════════════════════════════════════
drafts_repo = APP / "lib" / "repository" / "draftsRepository.dart"
patch(
    drafts_repo,
    """  Future<int> uploadProjects(
      Map<String, dynamic> project, XFile video, XFile? thumbnail) async {
    final data = transformProject(project);
    final response = await _api.uploadProjectWithMedia(data, video, thumbnail);

    // NULL SAFETY FIX
    if (response != null && response.statusCode == 201) {
      jsonDecode(response.body);
      return response.statusCode;
    } else {
      print('Failed to upload project: ${response?.statusCode}');
      throw Exception("Error uploading video");
    }
  }""",
    """  Future<int> uploadProjects(
      Map<String, dynamic> project, XFile video, XFile? thumbnail) async {
    final data = transformProject(project);
    final response = await _api.uploadProjectWithMedia(data, video, thumbnail);

    if (response != null && response.statusCode == 201) {
      jsonDecode(response.body);
      return response.statusCode;
    } else {
      // Surface the REAL backend error instead of a generic message — this
      // was previously discarded entirely, which is why every past failure
      // (regardless of actual cause) showed the exact same unhelpful text.
      String detail = 'no response from server';
      if (response != null) {
        detail = 'HTTP ${response.statusCode}';
        try {
          final parsed = jsonDecode(response.body);
          if (parsed is Map && parsed['error'] != null) {
            detail = '${response.statusCode}: ${parsed['error']}';
          } else if (response.body.isNotEmpty) {
            detail = '${response.statusCode}: ${response.body}';
          }
        } catch (_) {
          if (response.body.isNotEmpty) {
            detail = '${response.statusCode}: ${response.body}';
          }
        }
      }
      print('Failed to upload project: $detail');
      throw Exception(detail);
    }
  }""",
    label="draftsRepository: surface the real backend error instead of a generic message",
)

n = len(drafts_repo.read_text(encoding="utf-8").splitlines())
print(f"   wc -l check [draftsRepository.dart]: {n} lines")
assert n > 100, "file looks truncated — STOP"

print()
print("=" * 76)
print("ALL PATCHES APPLIED. This one touches BOTH backend and frontend.")
print("=" * 76)
print("""
IMPORTANT — one manual check first: the video temp files land in Firebase
Storage under temp-videos/ and project-thumbnails/. Your existing Storage
security rules (from the June session) allow public READ, but WRITE should
still require the signed URL itself (which carries its own short-lived
authorization) — no rule change should be needed, but if the video PUT
step fails with a 403, check Firebase Console → Storage → Rules.

1. BACKEND:
     cd /workspaces/MiniGuru-App/backend
     npm run build
     cp src/services/youtubeUploadService.js dist/services/
     npx tsc --noEmit

   If clean:
     cd /workspaces/MiniGuru-App
     git add -f backend/dist/
     git add -A
     git commit -m "fix: upload video direct-to-Firebase-Storage bypassing Cloud Run's 32MB body limit; stop swallowing the real upload error message"
     git push origin main

   Cloud Shell:
     cd ~/MiniGuru-App && git pull
     gcloud run deploy miniguru-backend --source backend --region asia-south1 \\
       --project miniguru-prod --memory 1Gi

   Verify FIREBASE_SERVICE_ACCOUNT_JSON survived (this fix depends on it):
     gcloud run services describe miniguru-backend --region asia-south1 \\
       --format="value(spec.template.spec.containers[0].env)" | tr ';' '\\n' | grep -E 'DATABASE|GEMINI|FIREBASE'

2. FRONTEND:
     cd app/miniguru
     flutter analyze | grep "error •"

   If nothing prints:
     flutter build web --release --no-tree-shake-icons
     firebase deploy --only hosting

     cd /workspaces/MiniGuru-App
     rm mg_fix_cloud_run_32mb_limit.py
     git add -A
     git commit -m "cleanup: remove one-time patch script"
     git push origin main

3. Have Aarav try the SAME video again once both are deployed. Whatever
   happens now, the app will show the REAL error — please paste back
   exactly what it says, verbatim, even if it looks like backend jargon.
""")
