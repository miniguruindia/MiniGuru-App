import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/repository/cartRepository.dart';
import 'package:miniguru/screens/homeScreen.dart';

class DeliveryAddressPage extends StatefulWidget {
  final List<Map<String, dynamic>> cartItems;
  final double totalBill;
  final CartRepository cartRepository;

  const DeliveryAddressPage({
    super.key,
    required this.cartItems,
    required this.totalBill,
    required this.cartRepository,
  });

  @override
  State<DeliveryAddressPage> createState() => _DeliveryAddressPageState();
}

class _DeliveryAddressPageState extends State<DeliveryAddressPage> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressLine1Controller = TextEditingController();
  final _addressLine2Controller = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _zipController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async => !_isLoading,
      child: Scaffold(
        backgroundColor: backgroundWhite,
        appBar: AppBar(
          title: Text(
            "Delivery Address",
            style: headingTextStyle.copyWith(
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          backgroundColor: Colors.transparent,
          elevation: 0,
          iconTheme: const IconThemeData(color: buttonBlack),
        ),
        body: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Where should we deliver your order?',
                    style: headingTextStyle.copyWith(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 24),
                  _buildTextField(
                    controller: _nameController,
                    label: 'Full Name',
                    prefixIcon: Icons.person_outline,
                    validator: (value) => value?.isEmpty ?? true
                        ? 'Please enter your name'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _phoneController,
                    label: 'Phone Number',
                    prefixIcon: Icons.phone_outlined,
                    keyboardType: TextInputType.phone,
                    validator: (value) => value?.isEmpty ?? true
                        ? 'Please enter your phone number'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _addressLine1Controller,
                    label: 'Address Line 1',
                    prefixIcon: Icons.home_outlined,
                    validator: (value) => value?.isEmpty ?? true
                        ? 'Please enter your address'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _addressLine2Controller,
                    label: 'Address Line 2 (Optional)',
                    prefixIcon: Icons.apartment_outlined,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _buildTextField(
                          controller: _cityController,
                          label: 'City',
                          prefixIcon: Icons.location_city_outlined,
                          validator: (value) =>
                              value?.isEmpty ?? true ? 'Required' : null,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildTextField(
                          controller: _stateController,
                          label: 'State',
                          prefixIcon: Icons.map_outlined,
                          validator: (value) =>
                              value?.isEmpty ?? true ? 'Required' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _buildTextField(
                    controller: _zipController,
                    label: 'PIN Code',
                    prefixIcon: Icons.pin_drop_outlined,
                    keyboardType: TextInputType.number,
                    validator: (value) =>
                        value?.isEmpty ?? true ? 'Please enter PIN code' : null,
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _handlePlaceOrder,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16.0),
                      shape: const StadiumBorder(),
                      backgroundColor: buttonBlack,
                    ),
                    child: _isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : Text(
                            'Place Order',
                            style: headingTextStyle.copyWith(
                              fontSize: 18,
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
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
    required IconData prefixIcon,
    String? Function(String?)? validator,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      validator: validator,
      keyboardType: keyboardType,
      style: bodyTextStyle,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: bodyTextStyle.copyWith(color: Colors.grey[600]),
        prefixIcon: Icon(prefixIcon, color: buttonBlack),
        filled: true,
        fillColor: pastelBlue.withOpacity(0.1),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(30),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(30),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(30),
          borderSide: BorderSide(color: buttonBlack),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(30),
          borderSide: const BorderSide(color: Colors.red),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
      ),
    );
  }

  void _handlePlaceOrder() async {
    if (_formKey.currentState?.validate() ?? false) {
      setState(() => _isLoading = true);

      // Create delivery address map
      final deliveryAddress = {
        'full_name': _nameController.text,
        'phone': _phoneController.text,
        'address_line1': _addressLine1Controller.text,
        'address_line2': _addressLine2Controller.text,
        'city': _cityController.text,
        'state': _stateController.text,
        'zip': _zipController.text,
      };

      // Add delivery address to cart items
      // ignore: unused_local_variable
      final orderData = {
        'cart_items': widget.cartItems,
        'total_bill': widget.totalBill,
        'delivery_address': deliveryAddress,
      };

      final address =
          "${deliveryAddress['full_name']}\n${deliveryAddress['address_line1']}\n${deliveryAddress['address_line2']}\n${deliveryAddress['city']}\t${deliveryAddress['state']}\t${deliveryAddress['zip']}\n${deliveryAddress['phone']}";

      try {
        final res =
            await widget.cartRepository.placeOrder(widget.cartItems, address);
        if (res != null) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                backgroundColor: pastelGreen,
                content: Text(
                  'Order placed successfully! OrderID: $res',
                  style: bodyTextStyle.copyWith(color: buttonBlack),
                ),
              ),
            );
            // Navigate to home screen and clear stack
            Navigator.of(context).pushNamedAndRemoveUntil(
              HomeScreen.id,
              (route) => false,
            );
          }
        } else {
          throw Exception('Order placement failed');
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.red,
              content: Text(
                'Failed to place order: ${e.toString()}',
                style: bodyTextStyle.copyWith(color: backgroundWhite),
              ),
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _addressLine1Controller.dispose();
    _addressLine2Controller.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _zipController.dispose();
    super.dispose();
  }
}
