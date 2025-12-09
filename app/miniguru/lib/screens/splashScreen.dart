import 'dart:async';

import 'package:flutter/material.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  static const String id = "SplashScreen";

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  late MiniguruApi _api;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _checkAuthToken();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
        child: Scaffold(
      body: Center(
        child: Image.asset("assets/ic_logo.png"),
      ),
    ));
  }

  Future<void> _checkAuthToken() async {
    var dbHelper = DatabaseHelper();
    var authToken = await dbHelper.getAuthToken();
    var hasTokenExpired = await dbHelper.hasTokenExpired();

    if (authToken != null) {
      // Navigate to home screen if token exists
      if (hasTokenExpired) {
        authToken = await _api.refreshToken();
        Timer(const Duration(seconds: 2), () {
          Navigator.pushReplacementNamed(context, HomeScreen.id);
        });
      } else {
        Timer(const Duration(seconds: 2), () {
          Navigator.pushReplacementNamed(context, HomeScreen.id);
        });
      }
    } else {
      // Navigate to login screen if token doesn't exist
      Timer(const Duration(seconds: 2), () {
        Navigator.pushReplacementNamed(context, LoginScreen.id);
      });
    }
  }
}
