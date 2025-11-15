import 'dart:io';

import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/screens/splashScreen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: pastelBlue),
        useMaterial3: true,
      ),

      // Change this line to start with Login Screen
      initialRoute: LoginScreen.id,

      routes: {
        SplashScreen.id: (context) => const SplashScreen(),
        LoginScreen.id: (context) => const LoginScreen(),
        RegisterScreen.id: (context) => const RegisterScreen(),
        HomeScreen.id: (context) => const HomeScreen(),
      },
    );
  }
}
