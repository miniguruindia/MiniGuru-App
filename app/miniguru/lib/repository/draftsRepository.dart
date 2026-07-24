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
      DateTime? endDate,
      String? childKey}) async {
    final draft = Draft(
      title: title,
      description: description,
      category: category,
      materials: materials ?? {},
      startDate: startDate,
      endDate: endDate,
      childKey: childKey,
    );
    return await _db.insertDraft(draft);
  }

  /// Pass [childKey] to only get drafts tagged for a specific child (or
  /// 'self' for the logged-in user's own drafts). Drafts saved before this
  /// tagging existed have no childKey yet and are always included, rather
  /// than silently disappearing.
  Future<List<Draft>> getDrafts({String? childKey}) async {
    final all = await _db.drafts();
    if (childKey == null) return all;
    return all.where((d) => d.childKey == childKey || d.childKey == null).toList();
  }

  Future<void> updateDraft(
      int id, String title, String description, String category,
      {String? videoId,
      Map<String, int>? materials,
      DateTime? startDate,
      DateTime? endDate,
      String? childKey}) async {
    final draft = Draft(
      id: id,
      title: title,
      description: description,
      category: category,
      materials: materials ?? {},
      startDate: startDate,
      endDate: endDate,
      childKey: childKey,
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
      DateTime? endDate,
      String? childKey}) async {
    if (id == null) {
      return await saveDraft(title, description, category,
          materials: materials,
          startDate: startDate,
          endDate: endDate,
          childKey: childKey);
    } else {
      await updateDraft(id, title, description, category,
          materials: materials,
          startDate: startDate,
          endDate: endDate,
          childKey: childKey);
      return -1;
    }
  }

  Future<Draft?> getDraftById(int id) async {
    return _db.getDraftById(id);
  }

  Future<int> uploadProjects(
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
      // Shared/group projects — list of collaborator user IDs, if any
      // were added while planning. Empty/absent for a normal solo project.
      'collaboratorIds': project['collaboratorIds'] ?? [],
      // STEAM Challenge join (optional) — BUGFIX: this was previously
      // dropped here, so a child could pick a challenge in addDraftScreen
      // and it would silently never reach the backend (no participant
      // count, no bonus Goins, no error shown). Pass it through if present.
      if (project['challengeId'] != null) 'challengeId': project['challengeId'],
    };

    return transformedProject;
  }
}
