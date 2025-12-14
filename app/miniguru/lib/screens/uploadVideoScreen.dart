// lib/screens/uploadVideoScreen.dart
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:miniguru/constants.dart';
import 'package:miniguru/secrets.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:io';

class UploadVideoScreen extends StatefulWidget {
  const UploadVideoScreen({Key? key}) : super(key: key);
  static const String id = "UploadVideoScreen";

  @override
  State<UploadVideoScreen> createState() => _UploadVideoScreenState();
}

class _UploadVideoScreenState extends State<UploadVideoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  
  String? _selectedCategory;
  File? _selectedVideo;
  String? _videoFileName;
  double _uploadProgress = 0.0;
  bool _isUploading = false;

  final List<String> _categories = [
    'Show Piece',
    'Working Model',
    'Science Experiment',
    'Magic Science',
    'Life Hack',
    'Electronics',
  ];

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickVideo() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(
        type: FileType.video,
        allowMultiple: false,
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        
        // Check file size (max 500MB)
        if (file.size > 500 * 1024 * 1024) {
          _showError('Video file is too large. Maximum size is 500MB.');
          return;
        }

        setState(() {
          _selectedVideo = File(file.path!);
          _videoFileName = file.name;
        });
      }
    } catch (e) {
      _showError('Failed to pick video: $e');
    }
  }

  Future<void> _uploadVideo() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_selectedVideo == null) {
      _showError('Please select a video file');
      return;
    }

    if (_selectedCategory == null) {
      _showError('Please select a category');
      return;
    }

    setState(() {
      _isUploading = true;
      _uploadProgress = 0.0;
    });

    try {
      // Get auth token
      // TODO: Replace with your actual token retrieval
      final token = 'YOUR_AUTH_TOKEN';

      // Create multipart request
      var request = http.MultipartRequest(
        'POST',
        Uri.parse('$apiBaseUrl/api/videos/upload'),
      );

      // Add headers
      request.headers['Authorization'] = 'Bearer $token';

      // Add video file
      var videoStream = http.ByteStream(_selectedVideo!.openRead());
      var videoLength = await _selectedVideo!.length();
      var multipartFile = http.MultipartFile(
        'video',
        videoStream,
        videoLength,
        filename: _videoFileName,
      );
      request.files.add(multipartFile);

      // Add form fields
      request.fields['title'] = _titleController.text;
      request.fields['description'] = _descriptionController.text;
      request.fields['category'] = _selectedCategory!;

      // Send request with progress tracking
      var streamedResponse = await request.send();
      
      // Listen to progress (simplified - real implementation needs bytes sent tracking)
      streamedResponse.stream.listen(
        (value) {
          setState(() {
            _uploadProgress += 0.1; // Simplified progress
          });
        },
      );

      // Get response
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        _showSuccess('Video submitted for approval!');
        Navigator.pop(context);
      } else {
        _showError('Upload failed: ${response.body}');
      }
    } catch (e) {
      _showError('Upload error: $e');
    } finally {
      setState(() {
        _isUploading = false;
      });
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Upload Video', style: GoogleFonts.poppins()),
        backgroundColor: pastelBlue,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Instructions
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.info_outline, color: pastelBlueText),
                        const SizedBox(width: 8),
                        Text(
                          'Upload Guidelines',
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w600,
                            color: pastelBlueText,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '• Video will be reviewed before publishing\n'
                      '• Maximum file size: 500MB\n'
                      '• Approved videos appear on YouTube\n'
                      '• Review time: 24-48 hours',
                      style: GoogleFonts.poppins(fontSize: 12),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Video Picker
              GestureDetector(
                onTap: _isUploading ? null : _pickVideo,
                child: Container(
                  height: 150,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300, width: 2),
                    borderRadius: BorderRadius.circular(12),
                    color: _selectedVideo != null 
                        ? Colors.green.shade50 
                        : Colors.grey.shade100,
                  ),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _selectedVideo != null 
                              ? Icons.check_circle 
                              : Icons.video_library,
                          size: 48,
                          color: _selectedVideo != null 
                              ? Colors.green 
                              : Colors.grey,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _videoFileName ?? 'Tap to select video',
                          style: GoogleFonts.poppins(
                            fontWeight: _selectedVideo != null 
                                ? FontWeight.w600 
                                : FontWeight.normal,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Title
              TextFormField(
                controller: _titleController,
                decoration: InputDecoration(
                  labelText: 'Video Title',
                  labelStyle: GoogleFonts.poppins(),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.title),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter a title';
                  }
                  return null;
                },
                maxLength: 100,
              ),

              const SizedBox(height: 16),

              // Description
              TextFormField(
                controller: _descriptionController,
                decoration: InputDecoration(
                  labelText: 'Description',
                  labelStyle: GoogleFonts.poppins(),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.description),
                  alignLabelWithHint: true,
                ),
                maxLines: 5,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter a description';
                  }
                  return null;
                },
                maxLength: 500,
              ),

              const SizedBox(height: 16),

              // Category Dropdown
              DropdownButtonFormField<String>(
                value: _selectedCategory,
                decoration: InputDecoration(
                  labelText: 'Category',
                  labelStyle: GoogleFonts.poppins(),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.category),
                ),
                items: _categories.map((category) {
                  return DropdownMenuItem(
                    value: category,
                    child: Text(category, style: GoogleFonts.poppins()),
                  );
                }).toList(),
                onChanged: _isUploading ? null : (value) {
                  setState(() {
                    _selectedCategory = value;
                  });
                },
                validator: (value) {
                  if (value == null) {
                    return 'Please select a category';
                  }
                  return null;
                },
              ),

              const SizedBox(height: 32),

              // Upload Progress
              if (_isUploading) ...[
                LinearProgressIndicator(
                  value: _uploadProgress,
                  backgroundColor: Colors.grey.shade300,
                  valueColor: const AlwaysStoppedAnimation<Color>(pastelBlueText),
                ),
                const SizedBox(height: 8),
                Text(
                  'Uploading... ${(_uploadProgress * 100).toInt()}%',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(fontSize: 12),
                ),
                const SizedBox(height: 16),
              ],

              // Submit Button
              ElevatedButton(
                onPressed: _isUploading ? null : _uploadVideo,
                style: ElevatedButton.styleFrom(
                  backgroundColor: pastelBlueText,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isUploading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : Text(
                        'Submit for Approval',
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}