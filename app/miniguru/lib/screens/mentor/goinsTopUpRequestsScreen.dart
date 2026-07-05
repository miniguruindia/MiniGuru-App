import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/network/MiniguruApi.dart';

class GoinsTopUpRequestsScreen extends StatefulWidget {
  const GoinsTopUpRequestsScreen({super.key});

  @override
  State<GoinsTopUpRequestsScreen> createState() =>
      _GoinsTopUpRequestsScreenState();
}

class _GoinsTopUpRequestsScreenState extends State<GoinsTopUpRequestsScreen> {
  late MiniguruApi _api;
  List<dynamic> _requests = [];
  bool _isLoading = true;
  String? _actingId; // request id currently being approved/denied

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final requests = await _api.getMentorPendingTopUpRequests();
      if (mounted) {
        setState(() {
          _requests = requests;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _decide(String requestId, bool approve) async {
    setState(() => _actingId = requestId);
    final ok = await _api.decideGoinsTopUp(
      requestId: requestId,
      approve: approve,
    );
    if (!mounted) return;
    if (ok) {
      setState(() {
        _requests.removeWhere((r) => r['id'] == requestId);
        _actingId = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(approve
              ? 'Request approved — Goins credited ✓'
              : 'Request denied'),
        ),
      );
    } else {
      setState(() => _actingId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Something went wrong — please try again.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          color: pastelBlueText,
          child: CustomScrollView(
            slivers: [
              // Header
              SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF5B6EF5), Color(0xFF8B9FF8)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius:
                        BorderRadius.vertical(bottom: Radius.circular(24)),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.arrow_back_ios_new,
                            color: Colors.white, size: 20),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Goin Top-Up Requests',
                                style: GoogleFonts.nunito(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white)),
                            const SizedBox(height: 4),
                            Text(
                              _isLoading
                                  ? 'Loading...'
                                  : '${_requests.length} pending request${_requests.length == 1 ? '' : 's'}',
                              style: GoogleFonts.nunito(
                                  fontSize: 14,
                                  color: Colors.white.withOpacity(0.85)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 12)),

              // Loading
              if (_isLoading)
                const SliverToBoxAdapter(
                  child: Center(
                      child: Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: CircularProgressIndicator(color: pastelBlueText),
                  )),
                )
              // Empty
              else if (_requests.isEmpty)
                SliverToBoxAdapter(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 48),
                      child: Column(
                        children: [
                          const Text('🎉', style: TextStyle(fontSize: 56)),
                          const SizedBox(height: 16),
                          Text('No pending requests',
                              style: GoogleFonts.nunito(
                                  fontSize: 18, fontWeight: FontWeight.w900)),
                          const SizedBox(height: 8),
                          Text(
                              'All caught up! New requests\nwill show up here',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.nunito(
                                  fontSize: 14, color: Colors.grey[500])),
                        ],
                      ),
                    ),
                  ),
                )
              // List
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _buildRequestCard(_requests[index]),
                      childCount: _requests.length,
                    ),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 40)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRequestCard(dynamic request) {
    final String id = request['id'] as String;
    final String requesterName =
        (request['requesterName'] as String?) ?? 'Unknown';
    final int amount = (request['amount'] as num?)?.toInt() ?? 0;
    final String? reason = request['reason'] as String?;
    final String? projectContext = request['projectDraftContext'] as String?;
    final String? createdAt = request['createdAt'] as String?;
    final bool isActing = _actingId == id;

    String whenText = '';
    if (createdAt != null) {
      final dt = DateTime.tryParse(createdAt);
      if (dt != null) {
        whenText =
            '${dt.day}/${dt.month}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: pastelBlueText.withOpacity(0.15),
                child: Text(
                    requesterName.isNotEmpty
                        ? requesterName[0].toUpperCase()
                        : '?',
                    style: GoogleFonts.nunito(
                        fontWeight: FontWeight.w900, color: pastelBlueText)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(requesterName,
                        style: GoogleFonts.nunito(
                            fontSize: 15, fontWeight: FontWeight.w800)),
                    if (whenText.isNotEmpty)
                      Text(whenText,
                          style: GoogleFonts.nunito(
                              fontSize: 11, color: Colors.grey[400])),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3CC),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('+$amount Goins',
                    style: GoogleFonts.nunito(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFFE8A000))),
              ),
            ],
          ),
          if (projectContext != null && projectContext.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text('For: $projectContext',
                style: GoogleFonts.nunito(
                    fontSize: 13, color: Colors.grey[600])),
          ],
          if (reason != null && reason.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(reason,
                style:
                    GoogleFonts.nunito(fontSize: 12, color: Colors.grey[400])),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: ElevatedButton.icon(
                    onPressed: isActing ? null : () => _decide(id, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD4F5EE),
                      foregroundColor: const Color(0xFF00B894),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: isActing
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Color(0xFF00B894)),
                          )
                        : const Icon(Icons.check, size: 18),
                    label: Text('Approve',
                        style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: ElevatedButton.icon(
                    onPressed: isActing ? null : () => _decide(id, false),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFFFECEC),
                      foregroundColor: const Color(0xFFFF5C5C),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.close, size: 18),
                    label: Text('Deny',
                        style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}