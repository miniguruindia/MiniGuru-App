import 'dart:convert';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  static String id = "LoginScreen";

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  bool _obscurePassword = true;
  bool _isLoading = false;

  late MiniguruApi _api;
  late DatabaseHelper _db;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _db = DatabaseHelper();
  }

  void _login() async {
    if (_formKey.currentState!.validate()) {
      String email = _emailController.text;
      String password = _passwordController.text;

      setState(() {
        _isLoading = true;
      });

      var response = await _api.login(email, password);

      if (response.statusCode == 200) {
        var body = jsonDecode(response.body);
        var accessToken = body['accessToken'];
        var refreshToken = body['refreshToken'];

        try {
          await _db.insertAuthToken(accessToken, refreshToken);
          Navigator.of(context)
              .pushNamedAndRemoveUntil(HomeScreen.id, (route) => false);
        } catch (e) {
          setState(() {
            _isLoading = false;
          });
          _showSnackBar("Something went wrong! Please try again.");
        }
      } else {
        setState(() {
          _isLoading = false;
        });
        _showSnackBar(jsonDecode(response.body)['error']);
      }
    }
  }

  void _goToRegister() {
    Navigator.pushNamed(context, RegisterScreen.id);
  }

  void _showSnackBar(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          msg,
          style: bodyTextStyle.copyWith(color: Colors.white),
        ),
        backgroundColor: Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Scaffold(
        backgroundColor: pastelBlue,
        body: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Align(
              alignment: Alignment.bottomCenter,
              child: Container(
                height: 0.7 * MediaQuery.of(context).size.height,
                width: double.infinity,
                decoration: const BoxDecoration(
                  color: backgroundWhite,
                  borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(25),
                      topRight: Radius.circular(25)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text(
                        "Login",
                        style: headingTextStyle,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Email field
                            TextFormField(
                              controller: _emailController,
                              style: bodyTextStyle,
                              decoration: InputDecoration(
                                labelText: 'Email',
                                labelStyle: bodyTextStyle,
                                prefixIcon: const Icon(Icons.email),
                                border: const OutlineInputBorder(),
                              ),
                              keyboardType: TextInputType.emailAddress,
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Please enter your email';
                                } else if (!RegExp(r'^[^@]+@[^@]+\.[^@]+')
                                    .hasMatch(value)) {
                                  return 'Please enter a valid email';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),

                            // Password field
                            TextFormField(
                              controller: _passwordController,
                              style: bodyTextStyle,
                              decoration: InputDecoration(
                                labelText: 'Password',
                                labelStyle: bodyTextStyle,
                                prefixIcon: const Icon(Icons.key),
                                border: const OutlineInputBorder(),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility
                                        : Icons.visibility_off,
                                  ),
                                  onPressed: () {
                                    setState(() {
                                      _obscurePassword = !_obscurePassword;
                                    });
                                  },
                                ),
                              ),
                              obscureText: _obscurePassword,
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Please enter your password';
                                } else if (value.length < 6) {
                                  return 'Password must be at least 6 characters long';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 48),

                            // Login Button
                            ElevatedButton(
                              onPressed: !_isLoading ? _login : null,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: buttonBlack,
                                disabledBackgroundColor: buttonBlack,
                                minimumSize: const Size(250, 50),
                              ),
                              child: !_isLoading
                                  ? Text(
                                      'Login',
                                      style: buttonTextStyle,
                                    )
                                  : const CircularProgressIndicator(
                                      color: backgroundWhite,
                                    ),
                            ),

                            const SizedBox(height: 24),

                            RichText(
                              text: TextSpan(
                                text: "Don't have an account? ",
                                style: bodyTextStyle,
                                children: <TextSpan>[
                                  TextSpan(
                                    text: 'Sign Up',
                                    style: TextStyle(
                                      color:
                                          Theme.of(context).colorScheme.primary,
                                      fontWeight: FontWeight.bold,
                                    ),
                                    // Make the "Sign Up" part clickable
                                    recognizer: TapGestureRecognizer()
                                      ..onTap = _goToRegister,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}
