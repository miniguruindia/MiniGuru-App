import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:miniguru/secrets.dart';

class YouTubeService {
  static const String _baseUrl = 'https://www.googleapis.com/youtube/v3';

  // Fetch channel videos
  static Future<List<Map<String, dynamic>>> getChannelVideos({
    int maxResults = 50,
  }) async {
    try {
      // First, get the channel's uploads playlist ID
      final channelResponse = await http.get(
        Uri.parse(
          '$_baseUrl/channels?part=contentDetails&id=$youtubeChannelId&key=$youtubeApiKey',
        ),
      );

      if (channelResponse.statusCode != 200) {
        print('❌ Failed to fetch channel info: ${channelResponse.statusCode}');
        return [];
      }

      final channelData = json.decode(channelResponse.body);
      final uploadsPlaylistId = channelData['items'][0]['contentDetails']
          ['relatedPlaylists']['uploads'];

      // Fetch videos from uploads playlist
      final videosResponse = await http.get(
        Uri.parse(
          '$_baseUrl/playlistItems?part=snippet&playlistId=$uploadsPlaylistId&maxResults=$maxResults&key=$youtubeApiKey',
        ),
      );

      if (videosResponse.statusCode != 200) {
        print('❌ Failed to fetch videos: ${videosResponse.statusCode}');
        return [];
      }

      final videosData = json.decode(videosResponse.body);
      final List<dynamic> items = videosData['items'];

      return items.map((item) {
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
    } catch (e) {
      print('❌ Error fetching YouTube videos: $e');
      return [];
    }
  }

  // Search videos by query
  static Future<List<Map<String, dynamic>>> searchVideos(String query) async {
    try {
      final response = await http.get(
        Uri.parse(
          '$_baseUrl/search?part=snippet&channelId=$youtubeChannelId&q=$query&type=video&maxResults=20&key=$youtubeApiKey',
        ),
      );

      if (response.statusCode != 200) {
        return [];
      }

      final data = json.decode(response.body);
      final List<dynamic> items = data['items'];

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
      return [];
    }
  }

  // Get video categories (you can filter by keywords)
  static List<Map<String, dynamic>> filterByCategory(
    List<Map<String, dynamic>> videos,
    String category,
  ) {
    if (category == 'All') return videos;

    return videos.where((video) {
      final title = video['title'].toString().toLowerCase();
      final description = video['description'].toString().toLowerCase();
      final categoryLower = category.toLowerCase();

      return title.contains(categoryLower) ||
          description.contains(categoryLower);
    }).toList();
  }
}
