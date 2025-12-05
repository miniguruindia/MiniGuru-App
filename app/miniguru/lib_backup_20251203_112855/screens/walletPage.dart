import 'package:flutter/material.dart';
import 'package:sticky_headers/sticky_headers.dart';
import 'package:intl/intl.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/rechargePage.dart';

class WalletPage extends StatefulWidget {
  final User user;
  const WalletPage({super.key, required this.user});

  @override
  State<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<WalletPage> {
  double balance = 0.0;
  List transactions = [];
  bool isLoading = true;
  final _miniguruApi = MiniguruApi();

  @override
  void initState() {
    super.initState();
    _fetchWalletData();
  }

  Future<void> _fetchWalletData() async {
    final walletData = await _miniguruApi.fetchWallet();
    if (walletData != null) {
      setState(() {
        balance = walletData["balance"]?.toDouble() ?? 0.0;
        transactions = walletData["transactions"] ?? [];
        isLoading = false;
      });
    } else {
      setState(() => isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Failed to load wallet data"),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Map<String, List> _groupTransactionsByDate() {
    Map<String, List> grouped = {};
    for (var transaction in transactions) {
      final date = DateTime.parse(transaction['createdAt']);
      final monthYear = DateFormat('dd MMMM yyyy').format(date);

      if (!grouped.containsKey(monthYear)) {
        grouped[monthYear] = [];
      }
      grouped[monthYear]!.add(transaction);
    }
    return grouped;
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'COMPLETED':
        return Colors.green;
      case 'PENDING':
        return Colors.orange;
      case 'FAILED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  Widget _buildStatusChip(String status) {
    final color = _getStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        status.toLowerCase().capitalize(),
        style: bodyTextStyle.copyWith(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [pastelBlueText, pastelBlueText.withOpacity(0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: pastelBlue.withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Current Balance",
              style: bodyTextStyle.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              "₹${(balance).toStringAsFixed(2)}",
              style: headingTextStyle.copyWith(
                color: Colors.white,
                fontSize: 32,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionCard(Map transaction) {
    final amount = transaction['amount'];
    final type = transaction['type'];
    final status = transaction['status'] ?? 'PENDING';
    final createdAt = DateTime.parse(transaction['createdAt']);
    final isCredit = type == "CREDIT";

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 12,
        ),
        leading: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isCredit ? Colors.green[100] : Colors.red[100],
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            isCredit ? Icons.add : Icons.remove,
            color: isCredit ? Colors.green[700] : Colors.red[700],
            size: 24,
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                "${isCredit ? "Added" : "Spent"}: ₹$amount",
                style: bodyTextStyle.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
            _buildStatusChip(status),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              DateFormat('hh:mm a').format(createdAt),
              style: bodyTextStyle.copyWith(
                color: Colors.grey[600],
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final groupedTransactions = _groupTransactionsByDate();

    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        elevation: 0,
        backgroundColor: pastelBlue,
        title: Text(
          "Wallet",
          style: bodyTextStyle.copyWith(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _buildBalanceCard(),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      "Recent Transactions",
                      style: bodyTextStyle.copyWith(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final monthYear =
                          groupedTransactions.keys.elementAt(index);
                      final monthTransactions = groupedTransactions[monthYear]!;

                      return StickyHeader(
                        header: Container(
                          color: Colors.grey[100],
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          child: Text(
                            monthYear,
                            style: bodyTextStyle.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[700],
                            ),
                          ),
                        ),
                        content: Column(
                          children: monthTransactions.reversed
                              .map((transaction) =>
                                  _buildTransactionCard(transaction))
                              .toList(),
                        ),
                      );
                    },
                    childCount: groupedTransactions.length,
                  ),
                ),
                const SliverToBoxAdapter(
                  child: SizedBox(height: 80),
                ),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => RechargePage(user: widget.user),
          ),
        ),
        label: Text(
          "Add Money",
          style: bodyTextStyle.copyWith(fontWeight: FontWeight.bold),
        ),
        icon: const Icon(Icons.add),
        backgroundColor: pastelBlue,
      ),
    );
  }
}

// Extension to capitalize first letter of string
extension StringExtension on String {
  String capitalize() {
    return "${this[0].toUpperCase()}${substring(1).toLowerCase()}";
  }
}
