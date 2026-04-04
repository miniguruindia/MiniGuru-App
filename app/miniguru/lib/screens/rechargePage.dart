import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/secrets.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

class RechargePage extends StatefulWidget {
  final User user;
  const RechargePage({super.key, required this.user});

  @override
  State<RechargePage> createState() => _RechargePageState();
}

class _RechargePageState extends State<RechargePage> {
  final miniguruApi = MiniguruApi();
  final TextEditingController _amountController = TextEditingController();
  bool _isLoading = false;
  int? _selectedAmount;
  late Razorpay _razorpay;

  final List<int> _quickAmounts = [100, 500, 1000, 2000, 5000];

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    _amountController.dispose();
    super.dispose();
  }

  void _showSnackBar(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: bodyTextStyle.copyWith(color: Colors.white)),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final String? paymentId = response.paymentId;
    final String? orderId = response.orderId;

    if (paymentId != null && orderId != null) {
      await _verifyTransaction(orderId, paymentId);
    } else {
      _showSnackBar("Payment verification failed", Colors.red);
      setState(() => _isLoading = false);
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    setState(() => _isLoading = false);
    _showSnackBar("Payment failed: ${response.message}", Colors.red);
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    setState(() => _isLoading = false);
    _showSnackBar("External wallet selected: ${response.walletName}", Colors.blue);
  }

  Future<void> _initiatePayment(int amount) async {
    setState(() => _isLoading = true);

    final orderData = await miniguruApi.createOrder(widget.user.id, amount);
    if (orderData == null) {
      _showSnackBar("Failed to create order", Colors.red);
      setState(() => _isLoading = false);
      return;
    }

    final String orderId = orderData["orderId"];

    var options = {
      'key': razorpay_key_test,
      'amount': amount * 100, // Amount in paise
      'name': 'MiniGuru',
      'description': 'Wallet Recharge',
      'order_id': orderId,
      'prefill': {
        'contact': '', // You can add phone number if available
        'email': widget.user.email
      },
      'theme': {
        'color': '#5B6EF5'
      }
    };

    try {
      _razorpay.open(options);
    } catch (e) {
      setState(() => _isLoading = false);
      _showSnackBar("Error opening payment gateway", Colors.red);
    }
  }

    setState(() => _isLoading = false);
  }

  Future<void> _verifyTransaction(String orderId, String paymentId) async {
    setState(() => _isLoading = true);
    final success = await miniguruApi.verifyTransaction(
      widget.user.id,
      paymentId,
      orderId,
    );
    setState(() => _isLoading = false);

    if (success && mounted) {
      _showSnackBar("Wallet recharged successfully!", Colors.green);
      await Future.delayed(const Duration(milliseconds: 800));
      if (mounted) Navigator.pop(context);
    } else if (mounted) {
      _showSnackBar("Payment verification failed. Contact support.", Colors.red);
    }
  }

  Widget _buildAmountButton(int amount) {
    final isSelected = _selectedAmount == amount;
    return GestureDetector(
      onTap: () => setState(() {
        _selectedAmount = amount;
        _amountController.text = amount.toString();
      }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: BoxDecoration(
          color: isSelected ? pastelBlueText : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? pastelBlueText : Colors.grey.shade300,
          ),
          boxShadow: isSelected
              ? [BoxShadow(
                  color: pastelBlueText.withOpacity(0.2),
                  blurRadius: 8,
                  offset: const Offset(0, 4))]
              : null,
        ),
        child: Text(
          "₹$amount",
          style: bodyTextStyle.copyWith(
            color: isSelected ? Colors.white : Colors.black87,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        elevation: 0,
        backgroundColor: pastelBlue,
        title: Text("Recharge Wallet",
            style: bodyTextStyle.copyWith(fontSize: 18, fontWeight: FontWeight.bold)),
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [pastelBlueText.withOpacity(0.8), pastelBlueText],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.account_balance_wallet,
                        color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      "Add money to your wallet for seamless transactions",
                      style: bodyTextStyle.copyWith(color: Colors.white, fontSize: 16),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Text("Select Amount",
                style: bodyTextStyle.copyWith(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: _quickAmounts.map(_buildAmountButton).toList(),
            ),
            const SizedBox(height: 24),
            Text("Or Enter Custom Amount",
                style: bodyTextStyle.copyWith(fontSize: 16, color: Colors.grey[600])),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                      color: Colors.grey.withOpacity(0.1),
                      blurRadius: 8,
                      offset: const Offset(0, 4))
                ],
              ),
              child: TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                style: bodyTextStyle.copyWith(fontSize: 16),
                decoration: InputDecoration(
                  prefixText: "₹ ",
                  prefixStyle: bodyTextStyle.copyWith(fontSize: 16),
                  hintText: "Enter amount",
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding: const EdgeInsets.all(16),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              "Test card: 4111 1111 1111 1111 | Any future date | CVV: 123 | OTP: 1234",
              style: bodyTextStyle.copyWith(fontSize: 12, color: Colors.grey[500]),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading
                    ? null
                    : () {
                        final amount = int.tryParse(_amountController.text) ?? 0;
                        if (amount > 0) {
                          _initiatePayment(amount);
                        } else {
                          _showSnackBar("Enter a valid amount", Colors.red);
                        }
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: pastelBlueText,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ))
                    : Text("Proceed to Pay",
                        style: bodyTextStyle.copyWith(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        )),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
