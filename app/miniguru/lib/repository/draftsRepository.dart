import 'dart:convert';
import 'dart:core';

import 'package:image_picker/image_picker.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/Draft.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class DraftRepository {
  final _db = DatabaseHelper();
  final _api = MiniguruApi();

  Future<int> saveDraft(String title, String description, String category,
      {String? videoId,
      Map<String, int>? materials,
      DateTime? startDate,
      DateTime? endDate}) async {
    final draft = Draft(
      title: title,
      description: description,
      category: category,
      materials: materials ?? {},
      startDate: startDate,
      endDate: endDate,
    );
    return await _db.insertDraft(draft);
  }

  Future<List<Draft>> getDrafts() async {
    return await _db.drafts();
  }

  Future<void> updateDraft(
      int id, String title, String description, String category,
      {String? videoId,
      Map<String, int>? materials,
      DateTime? startDate,
      DateTime? endDate}) async {
    final draft = Draft(
      id: id,
      title: title,
      description: description,
      category: category,
      materials: materials ?? {},
      startDate: startDate,
      endDate: endDate,
    );
    await _db.updateDraft(draft);
  }

  Future<void> deleteDraft(int id) async {
    await _db.deleteDraft(id);
  }

  Future<int> saveOrUpdateDraft(
      {int? id,
      required String title,
      required String description,
      required String category,
      Map<String, int>? materials,
      DateTime? startDate,
      DateTime? endDate}) async {
    if (id == null) {
      return await saveDraft(title, description, category,
          materials: materials, startDate: startDate, endDate: endDate);
    } else {
      await updateDraft(id, title, description, category,
          materials: materials, startDate: startDate, endDate: endDate);
      return -1;
    }
  }

  Future<Draft?> getDraftById(int id) async {
    return _db.getDraftById(id);
  }

  Future<int> uploadProjects(
      Map<String, dynamic> project, XFile video, XFile thumbnail) async {
    final data = transformProject(project);
    final response = await _api.uploadProjectWithMedia(data, video, thumbnail);
    
    // ✅ NULL SAFETY FIX
    if (response != null && response.statusCode == 201) {
      jsonDecode(response.body);
      return response.statusCode;
    } else {
      print('❌ Failed to upload project: ${response?.statusCode}');
      throw Exception("Error uploading video");
    }
  }

  Map<String, dynamic> transformProject(Map<String, dynamic> project) {
    List<dynamic> transformedMaterials = project['materials']
        .entries
        .map((entry) => {
              'productId': entry.key,
              'quantity': entry.value,
            })
        .toList();

    String? formatDate(DateTime? date) {
      return date?.toIso8601String();
    }

    Map<String, dynamic> transformedProject = {
      'title': project['title'],
      'description': project['description'],
      'startDate': formatDate(project['startDate']),
      'endDate': formatDate(project['endDate']),
      'categoryName': project['category'],
      'videoId': project['videoId'],
      'materials': transformedMaterials,
    };

    return transformedProject;
  }
}