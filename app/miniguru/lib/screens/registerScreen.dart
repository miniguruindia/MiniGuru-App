import 'dart:convert';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/loginScreen.dart';

import '../constants.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  static String id = "RegisterScreen";

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _ageController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();

  bool _obscurePassword = true;
  bool _isChecked = false;
  bool _isLoading = false;

  late MiniguruApi _api;

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
  }

  // Registration logic
  void _register() async {
    if (_formKey.currentState!.validate()) {
      String name = _nameController.text.trim();
      String email = _emailController.text.trim();
      String password = _passwordController.text.trim();
      String age = _ageController.text.trim();
      String phoneNumber = _phoneController.text.trim();

      setState(() {
        _isLoading = true;
      });
      var response = await _api.register(
          name, email, password, int.parse(age), phoneNumber);

      setState(() {
        _isLoading = false;
      });

      if (response.statusCode == 201) {
        _showSnackBar("Account created successfully!", Colors.green);
        Navigator.of(context)
            .pushNamedAndRemoveUntil(LoginScreen.id, (route) => false);
      } else {
        _showSnackBar(jsonDecode(response.body)['error'], null);
      }
    }
  }

  void _goToLogin() {
    Navigator.pushNamed(context, LoginScreen.id);
  }

  void _openTermsAndConditions() {
    //TODO: Add something
  }

  void _showSnackBar(String msg, Color? backgroundColor) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
          content: Text(
            msg,
            style: bodyTextStyle.copyWith(color: Colors.white),
          ),
          backgroundColor: backgroundColor ?? Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: pastelBlue,
      body: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              height: 0.85 * MediaQuery.of(context).size.height,
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
                      "Register",
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
                          // Name field
                          TextFormField(
                            controller: _nameController,
                            style: bodyTextStyle,
                            decoration: InputDecoration(
                              labelText: 'Name',
                              labelStyle: bodyTextStyle,
                              prefixIcon: const Icon(Icons.account_circle),
                              border: const OutlineInputBorder(),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter your name';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

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

                          // Password field with show/hide option
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
                          const SizedBox(height: 16),

                          TextFormField(
                            controller: _phoneController,
                            style: bodyTextStyle,
                            decoration: InputDecoration(
                              labelText: 'Phone Number',
                              labelStyle: bodyTextStyle,
                              prefixIcon: const Icon(Icons.phone),
                              border: const OutlineInputBorder(),
                            ),
                            keyboardType: TextInputType.number,
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter your phone number';
                              } else if (int.tryParse(value) == null ||
                                  value.length < 10) {
                                return 'Please enter a valid phone number';
                              }
                              return null;
                            },
                          ),

                          const SizedBox(
                            height: 16,
                          ),

                          // Age field
                          TextFormField(
                            controller: _ageController,
                            style: bodyTextStyle,
                            decoration: InputDecoration(
                              labelText: 'Age',
                              labelStyle: bodyTextStyle,
                              prefixIcon: const Icon(Icons.numbers_rounded),
                              border: const OutlineInputBorder(),
                            ),
                            keyboardType: TextInputType.number,
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter your age';
                              } else if (int.tryParse(value) == null ||
                                  int.parse(value) <= 0) {
                                return 'Please enter a valid age';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 8),

                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Checkbox(
                                value: _isChecked,
                                onChanged: (bool? value) {
                                  setState(() {
                                    _isChecked = value ?? false;
                                  });
                                },
                              ),
                              RichText(
                                text: TextSpan(
                                  text: "I agree to ",
                                  style: bodyTextStyle,
                                  children: [
                                    TextSpan(
                                      text: "Terms and Conditions",
                                      style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .primary,
                                        fontWeight: FontWeight.bold,
                                      ),
                                      recognizer: TapGestureRecognizer()
                                        ..onTap = _openTermsAndConditions,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 24),

                          // Register Button
                          ElevatedButton(
                            onPressed: () {
                              if (_isChecked) {
                                if (!_isLoading) {
                                  _register();
                                }
                              } else {
                                _showSnackBar(
                                    'Please agree to the Terms and Conditions to continue!',
                                    null);
                              }
                            },
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

                          const SizedBox(height: 12),

                          RichText(
                            text: TextSpan(
                              text: "Already have an account? ",
                              style: bodyTextStyle,
                              children: <TextSpan>[
                                TextSpan(
                                  text: 'Sign In',
                                  style: TextStyle(
                                    color:
                                        Theme.of(context).colorScheme.primary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  // Make the "Sign Up" part clickable
                                  recognizer: TapGestureRecognizer()
                                    ..onTap = _goToLogin,
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
          ),
        ],
      ),
    );
  }
}
