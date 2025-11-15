import 'dart:convert';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/ProjectCategory.dart';
import 'package:miniguru/models/Projects.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class ProjectRepository {
  final MiniguruApi _api = MiniguruApi();
  final DatabaseHelper _dbHelper = DatabaseHelper();

  Future<int> fetchAndStoreProjects(int page, int limit) async {
    final response = await _api.getAllProjects(page: page, limit: limit);

    if (response.statusCode == 200) {
      _dbHelper.deleteProject();
      List<dynamic> data = jsonDecode(response.body)['projects'];
      int pagination = jsonDecode(response.body)['pagination']['totalProjects'];
      for (var item in data) {
        Project project = Project.fromJson(item);
        await _dbHelper.insertProject(project);
      }
      return pagination;
    } else {
      throw Exception('Failed to load projects');
    }
  }

  Future<void> fetchAndStoreProjectsForUser() async {
    final response = await _api.getAllProjectsForUser();

    if (response.statusCode == 200) {
      _dbHelper.deleteProject();
      List<dynamic> data = jsonDecode(response.body);
      for (var item in data) {
        Project project = Project.fromJson(item);
        await _dbHelper.insertProject(project);
      }
    } else {
      throw Exception('Failed to load projects');
    }
  }

  Future<List<Project>> getProjects() async {
    return await DatabaseHelper().getProjects();
  }

  Future<List<Project>> getProjectsByQuery(String query) async {
    return await DatabaseHelper().getProjectsByQuery(query);
  }

  Future<void> fetchAndStoreProjectCategory() async {
    final response = await _api.getProjectCategories();

    if (response.statusCode == 200) {
      _dbHelper.deleteProjectCategories();
      List<dynamic> data = jsonDecode(response.body);
      for (var item in data) {
        ProjectCategory category = ProjectCategory.fromJson(item);
        await _dbHelper.insertProjectCategory(category);
      }
    } else {
      throw Exception("Failed to load project categories");
    }
  }

  Future<List<ProjectCategory>> getProjectCategories() async {
    return await DatabaseHelper().getProjectCategories();
  }
}
