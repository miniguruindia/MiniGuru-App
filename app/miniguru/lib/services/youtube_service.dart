import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:miniguru/secrets.dart';

class YouTubeService {
  static const String _baseUrl = 'https://www.googleapis.com/youtube/v3';

  // Fetch channel videos with detailed debug logging
  static Future<List<Map<String, dynamic>>> getChannelVideos({
    int maxResults = 50,
  }) async {
    try {
      print('');
      print('=================================');
      print('📺 YOUTUBE SERVICE DEBUG');
      print('=================================');
      print('Channel ID: $youtubeChannelId');
      print('API Key: ${youtubeApiKey.substring(0, 10)}...');
      print('Max Results: $maxResults');
      print('');

      // Step 1: Get channel info
      final channelUrl = '$_baseUrl/channels?part=contentDetails&id=$youtubeChannelId&key=$youtubeApiKey';
      print('🔍 Step 1: Fetching channel info...');
      print('URL: $channelUrl');
      
      final channelResponse = await http.get(
        Uri.parse(channelUrl),
      ).timeout(
        const Duration(seconds: 15),
        onTimeout: () {
          print('⏱️  Timeout: Channel request took > 15 seconds');
          throw Exception('Request timeout');
        },
      );

      print('Status Code: ${channelResponse.statusCode}');
      
      if (channelResponse.statusCode != 200) {
        print('❌ Failed to fetch channel info');
        print('Response body: ${channelResponse.body}');
        return _getPlaceholderVideos();
      }

      final channelData = json.decode(channelResponse.body);
      print('✅ Channel data received');
      
      if (channelData['items'] == null || channelData['items'].isEmpty) {
        print('❌ No channel found with this ID');
        print('Response: ${json.encode(channelData)}');
        return _getPlaceholderVideos();
      }

      final uploadsPlaylistId = channelData['items'][0]['contentDetails']
          ['relatedPlaylists']['uploads'];
      print('📋 Uploads Playlist ID: $uploadsPlaylistId');
      print('');

      // Step 2: Get videos from playlist
      final videosUrl = '$_baseUrl/playlistItems?part=snippet&playlistId=$uploadsPlaylistId&maxResults=$maxResults&key=$youtubeApiKey';
      print('🔍 Step 2: Fetching videos from playlist...');
      print('URL: ${videosUrl.substring(0, 100)}...');
      
      final videosResponse = await http.get(
        Uri.parse(videosUrl),
      ).timeout(
        const Duration(seconds: 15),
        onTimeout: () {
          print('⏱️  Timeout: Videos request took > 15 seconds');
          throw Exception('Request timeout');
        },
      );

      print('Status Code: ${videosResponse.statusCode}');

      if (videosResponse.statusCode != 200) {
        print('❌ Failed to fetch videos');
        print('Response body: ${videosResponse.body}');
        return _getPlaceholderVideos();
      }

      final videosData = json.decode(videosResponse.body);
      final List<dynamic> items = videosData['items'] ?? [];
      print('✅ Videos received: ${items.length}');

      if (items.isEmpty) {
        print('⚠️  No videos found in channel');
        return _getPlaceholderVideos();
      }

      final videos = items.map((item) {
        final snippet = item['snippet'];
        return {
          'videoId': snippet['resourceId']['videoId'],
          'title': snippet['title'],
          'description': snippet['description'],
          'thumbnail': snippet['thumbnails']['high']['url'],
          'publishedAt': snippet['publishedAt'],
          'channelTitle': snippet['channelTitle'],
        };
      }).toList();

      print('');
      print('=================================');
      print('✅ SUCCESS: Loaded ${videos.length} videos');
      print('=================================');
      print('');

      // Print first video as sample
      if (videos.isNotEmpty) {
        print('Sample video:');
        print('  Title: ${videos[0]['title']}');
        print('  Video ID: ${videos[0]['videoId']}');
        print('');
      }

      return videos;
      
    } on Exception catch (e, stackTrace) {
      print('');
      print('=================================');
      print('❌ EXCEPTION in getChannelVideos');
      print('=================================');
      print('Error: $e');
      print('Stack trace: $stackTrace');
      print('');
      return _getPlaceholderVideos();
    } catch (e, stackTrace) {
      print('');
      print('=================================');
      print('❌ UNKNOWN ERROR in getChannelVideos');
      print('=================================');
      print('Error: $e');
      print('Type: ${e.runtimeType}');
      print('Stack trace: $stackTrace');
      print('');
      return _getPlaceholderVideos();
    }
  }

  // Search videos by query
  static Future<List<Map<String, dynamic>>> searchVideos(String query) async {
    try {
      print('🔍 Searching YouTube for: $query');
      
      final response = await http.get(
        Uri.parse(
          '$_baseUrl/search?part=snippet&channelId=$youtubeChannelId&q=$query&type=video&maxResults=20&key=$youtubeApiKey',
        ),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode != 200) {
        print('❌ Search failed: ${response.statusCode}');
        return _getPlaceholderVideos();
      }

      final data = json.decode(response.body);
      final List<dynamic> items = data['items'] ?? [];
      
      print('✅ Found ${items.length} videos matching "$query"');

      return items.map((item) {
        final snippet = item['snippet'];
        return {
          'videoId': item['id']['videoId'],
          'title': snippet['title'],
          'description': snippet['description'],
          'thumbnail': snippet['thumbnails']['high']['url'],
          'publishedAt': snippet['publishedAt'],
          'channelTitle': snippet['channelTitle'],
        };
      }).toList();
    } catch (e) {
      print('❌ Error searching YouTube videos: $e');
      return _getPlaceholderVideos();
    }
  }

  // Get video categories (you can filter by keywords)
  static List<Map<String, dynamic>> filterByCategory(
    List<Map<String, dynamic>> videos,
    String category,
  ) {
    if (category == 'All') return videos;

    final filtered = videos.where((video) {
      final title = video['title'].toString().toLowerCase();
      final description = video['description'].toString().toLowerCase();
      final categoryLower = category.toLowerCase();

      return title.contains(categoryLower) ||
          description.contains(categoryLower);
    }).toList();

    print('🏷️  Filtered to category "$category": ${filtered.length} videos');
    return filtered;
  }

  // Placeholder videos when YouTube fails
  static List<Map<String, dynamic>> _getPlaceholderVideos() {
    print('📦 Returning placeholder videos');
    return [
      {
        'videoId': 'placeholder1',
        'title': '🔧 YouTube API Issue - Using Placeholder',
        'description': 'Check console logs for YouTube API errors',
        'channelTitle': 'MiniGuru',
        'thumbnail': 'https://via.placeholder.com/320x180.png?text=Check+Console+Logs',
        'publishedAt': DateTime.now().toIso8601String(),
      },
      {
        'videoId': 'placeholder2',
        'title': '📺 Real videos coming soon',
        'description': 'Debugging YouTube API connection...',
        'channelTitle': 'MiniGuru',
        'thumbnail': 'https://via.placeholder.com/320x180.png?text=Debugging+API',
        'publishedAt': DateTime.now().toIso8601String(),
      },
      {
        'videoId': 'placeholder3',
        'title': '✅ YouTube integration will work once debugged',
        'description': 'Check Google Cloud Console quotas and API key restrictions',
        'channelTitle': 'MiniGuru',
        'thumbnail': 'https://via.placeholder.com/320x180.png?text=Coming+Soon',
        'publishedAt': DateTime.now().toIso8601String(),
      },
    ];
  }
}