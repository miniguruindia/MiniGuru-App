import 'dart:convert';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:google_fonts/google_fonts.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  static const String id = "LoginScreen";

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

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      print('━' * 50);
      print('🔐 LOGIN ATTEMPT');
      print('━' * 50);
      print('📧 Email: ${_emailController.text.trim()}');
      print('🔗 API URL: ${await _api.checkConnection() ? "Connected" : "Not Connected"}');
      
      final response = await _api.login(
        _emailController.text.trim(),
        _passwordController.text.trim(),
      );

      print('📦 Response Status: ${response.statusCode}');
      print('📦 Response Body: ${response.body}');

      if (!mounted) return;

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        print('✅ Login successful!');
        print('🎫 Access Token: ${body['accessToken']?.substring(0, 20)}...');
        print('🎫 Refresh Token: ${body['refreshToken']?.substring(0, 20)}...');
        
        // Save tokens to database
        await _db.insertAuthToken(body['accessToken'], body['refreshToken']);
        print('💾 Tokens saved to database');

        // Verify tokens were saved
        final savedToken = await _db.getAuthToken();
        print('✅ Token verification: ${savedToken != null ? "Success" : "Failed"}');

        if (mounted) {
          print('🔄 Navigating to HomeScreen...');
          _showSnackBar("Login successful! Welcome back.", Colors.green);
          
          // Small delay to let user see success message
          await Future.delayed(const Duration(milliseconds: 500));
          
          if (mounted) {
            Navigator.of(context).pushNamedAndRemoveUntil(
              HomeScreen.id,
              (route) => false,
            );
          }
        }
      } else {
        print('❌ Login failed with status: ${response.statusCode}');
        final errorBody = jsonDecode(response.body);
        print('❌ Error body: $errorBody');
        
        // Handle different error messages
        String errorMessage = 'Login failed';
        if (errorBody['message'] != null) {
          errorMessage = errorBody['message'];
        } else if (errorBody['error'] != null) {
          errorMessage = errorBody['error'];
        }
        
        // User-friendly error messages
        if (response.statusCode == 401) {
          errorMessage = 'Invalid email or password';
        } else if (response.statusCode == 404) {
          errorMessage = 'Account not found. Please sign up first.';
        } else if (response.statusCode == 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        
        if (mounted) _showSnackBar(errorMessage, Colors.red);
      }
    } catch (e, stackTrace) {
      print('━' * 50);
      print('❌ LOGIN EXCEPTION');
      print('━' * 50);
      print('Error: $e');
      print('Stack trace: $stackTrace');
      print('━' * 50);
      
      if (mounted) {
        String errorMsg = "Connection error. Please check your internet.";
        if (e.toString().contains('SocketException')) {
          errorMsg = "Cannot reach server. Check your connection.";
        } else if (e.toString().contains('TimeoutException')) {
          errorMsg = "Request timed out. Please try again.";
        }
        _showSnackBar(errorMsg, Colors.red);
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSnackBar(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: bodyTextStyle.copyWith(color: Colors.white)),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo
                  Hero(
                    tag: 'app_logo',
                    child: Container(
                      constraints:
                          const BoxConstraints(maxWidth: 200, maxHeight: 100),
                      child: Image.asset(
                        'assets/mg-logo.png',
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            width: 80,
                            height: 80,
                            decoration: const BoxDecoration(
                              color: pastelBlue,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.rocket_launch,
                              size: 40,
                              color: pastelBlueText,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Welcome Text
                  Text(
                    'Welcome Back!',
                    style: GoogleFonts.poppins(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Login to continue your journey',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 40),

                  // Email Field
                  _buildTextField(
                    controller: _emailController,
                    label: 'Email',
                    icon: Icons.email_outlined,
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your email';
                      }
                      if (!value.contains('@')) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Password Field
                  _buildTextField(
                    controller: _passwordController,
                    label: 'Password',
                    icon: Icons.lock_outline,
                    obscureText: _obscurePassword,
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off
                            : Icons.visibility,
                        color: Colors.grey[600],
                      ),
                      onPressed: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please enter your password';
                      }
                      if (value.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 32),

                  // Login Button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: pastelBlueText,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 2,
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : Text(
                              'Login',
                              style: GoogleFonts.poppins(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Sign Up Link
                  RichText(
                    text: TextSpan(
                      text: "Don't have an account? ",
                      style: GoogleFonts.poppins(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                      children: [
                        TextSpan(
                          text: 'Sign Up',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            color: pastelBlueText,
                            fontWeight: FontWeight.w600,
                          ),
                          recognizer: TapGestureRecognizer()
                            ..onTap = () {
                              Navigator.pushNamed(context, RegisterScreen.id);
                            },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
    Widget? suffixIcon,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      validator: validator,
      style: GoogleFonts.poppins(fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: GoogleFonts.poppins(color: Colors.grey[600]),
        prefixIcon: Icon(icon, color: Colors.grey[600]),
        suffixIcon: suffixIcon,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey[300]!),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: pastelBlueText, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.red),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.red, width: 2),
        ),
        filled: true,
        fillColor: Colors.white,
      ),
    );
  }
}