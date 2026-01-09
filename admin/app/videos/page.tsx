'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface PendingVideo {
  _id: string;
  title: string;
  description: string;
  category: string;
  originalName: string;
  fileSize: number;
  uploadedBy: {
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  youtubeUrl?: string;
  rejectionReason?: string;
}

export default function VideoApprovalPage() {
  const [videos, setVideos] = useState<PendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<PendingVideo | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchPendingVideos();
  }, []);

  const fetchPendingVideos = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('No auth token found');
        setVideos([]);
        setLoading(false);
        return;
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/videos/pending`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.log('Unauthorized - Please login as admin');
          setVideos([]);
          return;
        }
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error: any) {
      console.error('Error fetching videos:', error);
      // Don't show error toast if it's just empty data
      if (error.message !== 'Failed to fetch videos') {
        toast.error('Failed to load pending videos');
      }
    } finally {
      setLoading(false);
    }
  };

  const approveVideo = async (videoId: string, privacyStatus: 'public' | 'unlisted' = 'public') => {
    if (!confirm('Are you sure you want to approve this video and upload it to YouTube?')) {
      return;
    }

    try {
      setProcessingId(videoId);
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/videos/approve/${videoId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ privacyStatus }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve video');
      }

      toast.success(`Video approved and uploaded to YouTube! 🎉`);
      
      // Show YouTube URL
      if (data.youtubeUrl) {
        toast.success(
          <div>
            <p>YouTube URL:</p>
            <a 
              href={data.youtubeUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {data.youtubeUrl}
            </a>
          </div>,
          { duration: 10000 }
        );
      }

      // Refresh list
      fetchPendingVideos();
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error(error.message || 'Failed to approve video');
    } finally {
      setProcessingId(null);
    }
  };

  const rejectVideo = async (videoId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    if (!confirm('Are you sure you want to reject this video?')) {
      return;
    }

    try {
      setProcessingId(videoId);
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/videos/reject/${videoId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject video');
      }

      toast.success('Video rejected');
      setSelectedVideo(null);
      setRejectionReason('');
      fetchPendingVideos();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error(error.message || 'Failed to reject video');
    } finally {
      setProcessingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pending videos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Video Approval Queue</h1>
        <p className="text-gray-600 mt-2">
          Review and approve user-submitted videos to publish on YouTube
        </p>
      </div>

      {videos.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">🎬</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            No Pending Videos
          </h2>
          <p className="text-gray-600">
            All videos have been reviewed. New submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {videos.map((video) => (
            <div
              key={video._id}
              className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {video.title}
                    </h3>
                    <p className="text-gray-600 mb-4">{video.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Category:</span>
                        <p className="font-medium">{video.category}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">File Size:</span>
                        <p className="font-medium">{formatFileSize(video.fileSize)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Uploaded By:</span>
                        <p className="font-medium">{video.uploadedBy.name}</p>
                        <p className="text-xs text-gray-500">{video.uploadedBy.email}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Submitted:</span>
                        <p className="font-medium">{formatDate(video.submittedAt)}</p>
                      </div>
                    </div>
                  </div>

                  <span className="ml-4 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    Pending
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => approveVideo(video._id, 'public')}
                    disabled={processingId === video._id}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === video._id ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading to YouTube...
                      </span>
                    ) : (
                      '✅ Approve & Upload to YouTube'
                    )}
                  </button>

                  <button
                    onClick={() => approveVideo(video._id, 'unlisted')}
                    disabled={processingId === video._id}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    📝 Approve as Unlisted
                  </button>

                  <button
                    onClick={() => setSelectedVideo(video)}
                    disabled={processingId === video._id}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Reject Video</h3>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting "{selectedVideo.title}"
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="E.g., Content does not meet quality standards, inappropriate content, etc."
              className="w-full border border-gray-300 rounded-lg p-3 mb-4 h-32 resize-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedVideo(null);
                  setRejectionReason('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectVideo(selectedVideo._id)}
                disabled={!rejectionReason.trim() || processingId === selectedVideo._id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
              >
                {processingId === selectedVideo._id ? 'Rejecting...' : 'Reject Video'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}