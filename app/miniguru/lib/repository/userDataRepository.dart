import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class UserRepository {
  final DatabaseHelper _dbHelper = DatabaseHelper();
  final MiniguruApi _api = MiniguruApi();

  // Fetch from API and store in SQLite
  Future<void> fetchAndStoreUserData() async {
    User? apiUser = await _api.getUserData();
    if (apiUser != null) {
      await _dbHelper.insertUserData(apiUser);
    }
  }

  // Get user data from SQLite
  Future<User?> getUserDataFromLocalDb() async {
    return await _dbHelper.getUserData();
  }
}
