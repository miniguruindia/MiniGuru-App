// lib/screens/addDraftScreen.dart
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:miniguru/state/sessionState.dart';
import 'package:http/http.dart' as http;
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/models/ProjectCategory.dart';
import 'package:miniguru/repository/draftsRepository.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/repository/projectRepository.dart';
import 'package:miniguru/repository/GoinsRepository.dart';
import 'package:miniguru/widgets/material_picker_widget.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:miniguru/secrets.dart';
import 'homeScreen.dart';
import 'package:url_launcher/url_launcher.dart';

// ── Light theme colours ───────────────────────────────────────────────────────
const _blue      = Color(0xFF5B6EF5);
const _green     = Color(0xFF10B981);
const _amber     = Color(0xFFF59E0B);
const _red       = Color(0xFFEF4444);
const _purple    = Color(0xFF8B5CF6);
const _bg        = Color(0xFFF5F7FF);   // was _bgDark 0xFF0F172A
const _card      = Color(0xFFFFFFFF);   // was 0xFF1E293B
const _cardBorder= Color(0xFFE8EAFF);  // was _cardLight 0xFF334155
const _ink       = Color(0xFF1A1A2E);
const _muted     = Color(0xFF8888AA);
const _accent    = Color(0xFF5B6EF5);   // appbar — was _navy 0xFF1E3A8A

class AddDraftScreen extends StatefulWidget {
  final int? draftId;
  final List<Map<String, String>>? presetCollaborators;
  const AddDraftScreen({super.key, this.draftId, this.presetCollaborators});
  @override
  State<AddDraftScreen> createState() => _AddDraftScreenState();
}

class _AddDraftScreenState extends State<AddDraftScreen>
    with TickerProviderStateMixin {
  final _formKey   = GlobalKey<FormState>();
  final _draftRepo = DraftRepository();
  final _goinsRepo = GoinsRepository();
  final _picker    = ImagePicker();

  List<String>         _categories         = [];
  List<PickedMaterial> _pickedMaterials     = [];
  // Shared/group projects — collaborators added while planning only.
  // Confirmed product decision: planning-only, instant-add, equal Goins
  // split on approval. Each entry: {'id': userId, 'name': displayName}.
  final List<Map<String, String>> _collaborators = [];
  bool _collabSearching = false;
  final TextEditingController _collabCtrl = TextEditingController();
  bool                 _loading             = true;
  bool                 _submitting          = false;
  int                  _draftId             = -1;
  DateTime?            _startDate;
  DateTime?            _endDate;
  XFile?               _video;
  XFile?               _thumbnail;

  final _titleCtrl    = TextEditingController();
  final _descCtrl     = TextEditingController();
  final _categoryCtrl = TextEditingController();

  late final AnimationController _fadeCtrl = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 500));

  static const _defaultCategories = [
    'Robotics', 'Mechanics', 'ArtCraft', 'Science'
  ];

  @override
  void initState() {
    super.initState();
    if (widget.draftId != null && widget.draftId! > 0) {
      _draftId = widget.draftId!;
    }
    if (widget.presetCollaborators != null) {
      _collaborators.addAll(widget.presetCollaborators!);
    }
    _loadInitialData();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _categoryCtrl.dispose();
    _fadeCtrl.dispose();
    _collabCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    await Future.wait([
      _loadCategories().catchError((_) {
        if (mounted) setState(() { _categories = _defaultCategories; _loading = false; });
      }),
      if (_draftId > 0) _loadExistingDraft(_draftId),
    ]);
    if (mounted) _fadeCtrl.forward();
  }

  Future<void> _loadCategories() async {
    try {
      final cats  = await ProjectRepository().getProjectCategories();
      final names = cats.map((c) => c.name).toList();
      if (mounted) setState(() {
        _categories = names.isNotEmpty ? names : _defaultCategories;
        _loading    = false;
      });
    } catch (_) {
      if (mounted) setState(() { _categories = _defaultCategories; _loading = false; });
    }
  }

  Future<void> _loadExistingDraft(int id) async {
    try {
      final draft = await _draftRepo.getDraftById(id);
      if (draft == null || !mounted) return;
      _titleCtrl.text    = draft.title;
      _descCtrl.text     = draft.description;
      _categoryCtrl.text = draft.category;
      _startDate         = draft.startDate;
      _endDate           = draft.endDate;
      if (draft.materials.isNotEmpty) {
        final all    = await _goinsRepo.getMaterials();
        final picked = <PickedMaterial>[];
        draft.materials.forEach((id, qty) {
          try {
            picked.add(PickedMaterial(
                item: all.firstWhere((m) => m.id == id), quantity: qty));
          } catch (_) {}
        });
        if (mounted) setState(() => _pickedMaterials = picked);
      }
      if (mounted) setState(() {});
    } catch (e) {
      debugPrint('load draft error: $e');
    }
  }

  // ── VIDEO PICKER ─────────────────────────────────────────
  Future<void> _pickVideo() async {
    try {
      if (kIsWeb) {
        final result = await FilePicker.platform.pickFiles(
            type: FileType.video, allowMultiple: false,
            withData: false, withReadStream: true);
        if (result != null && result.files.isNotEmpty) {
          final f      = result.files.first;
          final chunks = await f.readStream!.expand((x) => x).toList();
          final bytes  = Uint8List.fromList(chunks);
          setState(() => _video =
              XFile.fromData(bytes, name: f.name, mimeType: 'video/mp4'));
          _showSnack('Video selected: ${f.name}');
        }
      } else {
        await [Permission.storage].request();
        final f = await _picker.pickVideo(source: ImageSource.gallery);
        if (f != null) setState(() => _video = f);
      }
    } catch (e) {
      _showSnack('Could not pick video: $e', isError: true);
    }
  }

  Future<void> _pickThumbnail() async {
    try {
      if (kIsWeb) {
        final result = await FilePicker.platform.pickFiles(
            type: FileType.image, allowMultiple: false,
            withData: false, withReadStream: true);
        if (result != null && result.files.isNotEmpty) {
          final f       = result.files.first;
          final chunks2 = await f.readStream!.expand((x) => x).toList();
          final bytes2  = Uint8List.fromList(chunks2);
          setState(() => _thumbnail =
              XFile.fromData(bytes2, name: f.name, mimeType: 'image/jpeg'));
        }
      } else {
        await [Permission.storage].request();
        final f = await _picker.pickImage(source: ImageSource.gallery);
        if (f != null) setState(() => _thumbnail = f);
      }
    } catch (e) {
      _showSnack('Could not pick image: $e', isError: true);
    }
  }

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _startDate : _endDate) ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate:  DateTime(2101),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: ColorScheme.light(
            primary: _blue,
            onPrimary: Colors.white,
            surface: _card,
            onSurface: _ink,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() => isStart ? _startDate = picked : _endDate = picked);
    }
  }

  Future<void> _openMaterialPicker() async {
    final result = await showMaterialPicker(
        context: context,
        // MaterialPickerWidget still requires this param, but its own
        // internal balance/budget UI was already removed in the June 2
        // architecture change (Rule 25 — Goins are never spent/blocked).
        // A large constant here is the least-risky fix: it keeps that
        // widget's constructor untouched rather than reworking it too.
        currentGoinsBalance: 999999,
        existingPicked: _pickedMaterials);
    if (result != null) setState(() => _pickedMaterials = result);
  }

  String? _validateDraft() {
    if (_titleCtrl.text.trim().isEmpty)    return 'Title is required.';
    if (_categoryCtrl.text.trim().isEmpty) return 'Category is required.';
    if (_descCtrl.text.trim().isEmpty)     return 'Description is required.';
    return null;
  }

  String? _validateFinal() {
    final d = _validateDraft();
    if (d != null) return d;
    if (_startDate == null) return 'Start date is required.';
    if (_endDate == null)   return 'End date is required.';
    if (_video == null)     return 'Please pick a project video.';
    return null;
  }

  Future<void> _handleSubmit({required bool isDraft}) async {
    final error = isDraft ? _validateDraft() : _validateFinal();
    if (error != null) { _showSnack(error, isError: true); return; }
    final materialsMap = {for (final m in _pickedMaterials) m.item.id: m.quantity};

    if (isDraft) {
      _draftId = await _draftRepo.saveOrUpdateDraft(
        id:          _draftId > 0 ? _draftId : null,
        title:       _titleCtrl.text,
        description: _descCtrl.text,
        category:    _categoryCtrl.text,
        startDate:   _startDate,
        endDate:     _endDate,
        materials:   materialsMap,
        childKey:    SessionState.isChildSession
            ? SessionState.activeChildProfileId
            : 'self',
      );
      _showSnack('Saved as draft! ✅');
      if (mounted) {
        Navigator.pushNamedAndRemoveUntil(context, HomeScreen.id, (r) => false);
      }
      return;
    }

    setState(() => _submitting = true);
    showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const _UploadingDialog());

    try {
      final statusCode = await _draftRepo.uploadProjects(
        {
          'title':       _titleCtrl.text,
          'description': _descCtrl.text,
          'startDate':   _startDate,
          'endDate':     _endDate,
          'category':    _categoryCtrl.text,
          'materials':   materialsMap,
          'collaboratorIds': _collaborators.map((c) => c['id']!).toList(),
        },
        _video!,
        _thumbnail,
      );
      if (mounted) Navigator.pop(context);

      if (statusCode == 201) {
        if (_pickedMaterials.isNotEmpty) {
          // Goins are earned by completing projects, not spent on materials
          if (mounted) {
            await showProjectKitPopup(
              context: context,
              pickedMaterials: _pickedMaterials,
            );
          }
        }
        if (_draftId > 0) await _draftRepo.deleteDraft(_draftId);
        _showSnack('Project submitted! 🚀');
        if (mounted) {
          Navigator.pushNamedAndRemoveUntil(context, HomeScreen.id, (r) => false);
        }
      } else {
        _showSnack('Upload failed. Please try again.', isError: true);
      }
    } catch (e) {
      if (mounted) Navigator.pop(context);
      _showSnack('Error: $e', isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  bool _isSendingKit = false;

  void _showSendKitToParent() {
    if (_pickedMaterials.isEmpty) return;
    final emailCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: Color(0xFF1E293B),
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: StatefulBuilder(builder: (ctx2, setSt) {
            bool sending = false;
            bool sent    = false;
            String? err;

            Future<void> doSend() async {
              if (_isSendingKit) return;
              final email = emailCtrl.text.trim();
              if (email.isEmpty || !email.contains('@')) {
                setSt(() => err = 'Please enter a valid email address');
                return;
              }
              _isSendingKit = true;
              setSt(() { sending = true; err = null; });
              try {
                final items = _pickedMaterials.map((p) => {
                  'name':    p.item.name,
                  'qty':     p.quantity,
                  'unit':    p.item.unit,
                  'icon':    p.item.icon ?? '🔩',
                  'amazonASIN': p.item.amazonUrl ?? '',
                  'amazonUrl':  p.item.amazonUrl ?? '',
                  'imageUrl':   p.item.imageUrl  ?? '',
                  'priceEstimate': null,
                }).toList();
                final res = await http.post(
                  Uri.parse('$apiBaseUrl/shop/send-to-parent'),
                  headers: {'Content-Type': 'application/json'},
                  body: jsonEncode({
                    'parentEmail': email,
                    'childName':   'Your child',
                    'items':       items,
                    'cartUrl':     '',
                  }),
                );
                _isSendingKit = false;
                if (res.statusCode == 200) {
                  setSt(() { sent = true; sending = false; });
                  await Future.delayed(const Duration(milliseconds: 300));
                  if (ctx2.mounted) Navigator.pop(ctx2);
                  if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text('Materials sent to $email ✓',
                        style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.w700)),
                    backgroundColor: const Color(0xFF10B981),
                    behavior: SnackBarBehavior.floating,
                    duration: const Duration(seconds: 4),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ));
                } else {
                  setSt(() { err = 'Failed to send. Try again.'; sending = false; });
                }
              } catch (e) {
                _isSendingKit = false;
                setSt(() { err = 'Network error. Try again.'; sending = false; });
              }
            }

            return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Center(child: Container(width: 40, height: 4,
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)))),
              const SizedBox(height: 16),
              Row(children: [
                const Text('🛒', style: TextStyle(fontSize: 22)),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Send Materials to Parent',
                      style: GoogleFonts.poppins(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white)),
                  Text('${_pickedMaterials.length} items — parent gets Amazon buy link',
                      style: GoogleFonts.poppins(fontSize: 12, color: Colors.white54)),
                ])),
                IconButton(icon: const Icon(Icons.close_rounded, color: Colors.white54),
                    onPressed: () => Navigator.pop(ctx2)),
              ]),
              const Divider(color: Colors.white12, height: 24),
              Text("Parent's email address",
                  style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
              const SizedBox(height: 8),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                style: GoogleFonts.poppins(fontSize: 14, color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'parent@example.com',
                  hintStyle: GoogleFonts.poppins(color: Colors.white38, fontSize: 14),
                  prefixIcon: const Icon(Icons.email_outlined, color: Colors.white38, size: 20),
                  filled: true, fillColor: const Color(0xFF0F172A),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  errorText: err,
                  errorStyle: GoogleFonts.poppins(color: const Color(0xFFEF4444)),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: (sending || sent) ? null : doSend,
                  icon: sending
                      ? const SizedBox(width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('🛒', style: TextStyle(fontSize: 16)),
                  label: Text(sending ? 'Sending...' : 'Send to Parent',
                      style: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 14)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: sending ? Colors.grey : const Color(0xFFFF9900),
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                )),
            ]);
          }),
        ),
      ),
    );
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg,
          style: GoogleFonts.nunito(
              color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
      backgroundColor: isError ? _red : _green,
      behavior:        SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(12),
    ));
  }

  // ── BUILD ─────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark, // dark icons on light background
      child: Scaffold(
        backgroundColor: _bg,
        appBar: _buildAppBar(),
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: _blue))
            : FadeTransition(
                opacity: _fadeCtrl,
                child: Form(
                  key: _formKey,
                  child: CustomScrollView(slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          _section(
                              emoji: '📋',
                              title: 'Project Details',
                              child: _buildDetails()),
                          const SizedBox(height: 12),
                          _section(
                              emoji: '📅',
                              title: 'Timeline',
                              child: _buildTimeline()),
                          const SizedBox(height: 12),
                          _section(
                              emoji: '🎬',
                              title: 'Media',
                              child: _buildMedia()),
                          const SizedBox(height: 12),
                          _buildMaterials(),
                          const SizedBox(height: 12),
                          _buildCollaborators(),
                        ]),
                      ),
                    ),
                  ]),
                ),
              ),
        bottomNavigationBar: _buildBottomBar(),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() => AppBar(
        backgroundColor: _accent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          _draftId > 0 ? 'Edit Draft' : 'New Project',
          style: GoogleFonts.nunito(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 18),
        ),
        actions: const [],
      );

  Widget _section(
          {required String emoji,
          required String title,
          required Widget child}) =>
      Container(
        decoration: BoxDecoration(
          color:        _card,
          borderRadius: BorderRadius.circular(16),
          border:       Border.all(color: _cardBorder),
          boxShadow: [
            BoxShadow(
              color:  Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(emoji, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Text(title,
                style: GoogleFonts.nunito(
                    color:      _ink,
                    fontWeight: FontWeight.w900,
                    fontSize:   14)),
          ]),
          const SizedBox(height: 14),
          child,
        ]),
      );

  Widget _buildDetails() => Column(children: [
        _field(
            ctrl:  _titleCtrl,
            label: 'Title',
            hint:  'What did you build?',
            icon:  Icons.title_rounded),
        const SizedBox(height: 12),
        _field(
            ctrl:     _descCtrl,
            label:    'Description',
            hint:     'Describe your project and what you learned...',
            icon:     Icons.description_rounded,
            maxLines: 3),
        const SizedBox(height: 12),
        _buildCategoryDropdown(),
      ]);

  Widget _field({
    required TextEditingController ctrl,
    required String label,
    required String hint,
    required IconData icon,
    int maxLines = 1,
  }) =>
      TextFormField(
        controller: ctrl,
        maxLines:   maxLines,
        style: GoogleFonts.nunito(
            color: _ink, fontSize: 14, fontWeight: FontWeight.w600),
        cursorColor: _blue,
        decoration: InputDecoration(
          labelText: label,
          hintText:  hint,
          labelStyle: GoogleFonts.nunito(color: _muted, fontSize: 13),
          hintStyle:  GoogleFonts.nunito(color: const Color(0xFFCCCCDD), fontSize: 13),
          prefixIcon: Icon(icon, color: _muted, size: 18),
          filled:     true,
          fillColor:  const Color(0xFFF8F9FF),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: Color(0xFFE8EAFF)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: _blue, width: 1.5),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      );

  Widget _buildCategoryDropdown() => DropdownButtonFormField<String>(
        value: (_categoryCtrl.text.isNotEmpty &&
                _categories.contains(_categoryCtrl.text))
            ? _categoryCtrl.text
            : null,
        dropdownColor: _card,
        style: GoogleFonts.nunito(
            color: _ink, fontSize: 14, fontWeight: FontWeight.w600),
        icon: const Icon(Icons.keyboard_arrow_down_rounded, color: _muted),
        decoration: InputDecoration(
          labelText: 'Category',
          labelStyle: GoogleFonts.nunito(color: _muted, fontSize: 13),
          prefixIcon: const Icon(Icons.category_rounded, color: _muted, size: 18),
          filled:    true,
          fillColor: const Color(0xFFF8F9FF),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: Color(0xFFE8EAFF)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:   const BorderSide(color: _blue, width: 1.5),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
        items: _categories
            .map((c) => DropdownMenuItem(
                  value: c,
                  child: Text(c,
                      style: GoogleFonts.nunito(color: _ink, fontSize: 14)),
                ))
            .toList(),
        onChanged: (v) => setState(() => _categoryCtrl.text = v ?? ''),
      );

  Widget _buildTimeline() => Row(children: [
        Expanded(child: _dateTile('Start Date', _startDate, () => _pickDate(true))),
        const SizedBox(width: 10),
        const Icon(Icons.arrow_forward_rounded, color: _muted, size: 18),
        const SizedBox(width: 10),
        Expanded(child: _dateTile('End Date', _endDate, () => _pickDate(false))),
      ]);

  Widget _dateTile(String label, DateTime? date, VoidCallback onTap) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
          decoration: BoxDecoration(
            color:        const Color(0xFFF8F9FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: date != null ? _blue.withOpacity(0.5) : _cardBorder),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: GoogleFonts.nunito(color: _muted, fontSize: 10)),
            const SizedBox(height: 4),
            Row(children: [
              Icon(Icons.calendar_today_rounded,
                  size:  13,
                  color: date != null ? _blue : _muted),
              const SizedBox(width: 6),
              Text(
                date != null
                    ? '${date.day}/${date.month}/${date.year}'
                    : 'Pick date',
                style: GoogleFonts.nunito(
                    color: date != null ? _ink : _muted,
                    fontSize:   12,
                    fontWeight: date != null
                        ? FontWeight.w700
                        : FontWeight.normal),
              ),
            ]),
          ]),
        ),
      );

  Widget _buildMedia() => Column(children: [
        _mediaTile(
          Icons.video_library_rounded,
          'Project Video',
          _video != null ? '✅ ${_video!.name}' : 'Tap to pick a video file',
          _video != null,
          _pickVideo,
          _purple,
        ),
        const SizedBox(height: 10),
      ]);

  Widget _mediaTile(IconData icon, String label, String sub, bool hasFile,
      VoidCallback onTap, Color accent) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color:        const Color(0xFFF8F9FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: hasFile ? accent.withOpacity(0.5) : _cardBorder),
          ),
          child: Row(children: [
            Container(
              width:  44, height: 44,
              decoration: BoxDecoration(
                color:        accent.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: accent, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: GoogleFonts.nunito(
                            color:      _ink,
                            fontSize:   13,
                            fontWeight: FontWeight.w700)),
                    Text(sub,
                        style: GoogleFonts.nunito(
                            color:    hasFile ? accent : _muted,
                            fontSize: 11),
                        maxLines:  1,
                        overflow:  TextOverflow.ellipsis),
                  ]),
            ),
            Icon(Icons.chevron_right_rounded, color: _muted, size: 20),
          ]),
        ),
      );

  Future<void> _addCollaborator(String miniguruId) async {
    if (miniguruId.trim().isEmpty) return;
    if (_collaborators.any((c) => c['id'] == miniguruId.trim())) return;
    setState(() => _collabSearching = true);
    final result = await MiniguruApi().findCollaborator(miniguruId.trim());
    if (!mounted) return;
    setState(() => _collabSearching = false);
    if (result == null) {
      _showSnack(
        "Couldn't find that account. Ask your friend to open their own "
        "Profile page, tap their MiniGuru ID to copy it, and send you the "
        "exact text — it's easy to mistype or misremember.",
        isError: true,
      );
      return;
    }
    final id = result['id'] as String;
    if (_collaborators.any((c) => c['id'] == id)) {
      _showSnack('Already added.', isError: true);
      return;
    }
    setState(() {
      _collaborators.add({'id': id, 'name': result['name'] as String});
    });
  }

  Widget _buildCollaborators() {
    return Container(
      decoration: BoxDecoration(
        color:        _card,
        borderRadius: BorderRadius.circular(16),
        border:       Border.all(color: _cardBorder),
        boxShadow: [
          BoxShadow(
            color:      Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset:     const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('🤝', style: TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Text('Working with a friend? (optional)',
              style: GoogleFonts.nunito(
                  color: _ink, fontWeight: FontWeight.w900, fontSize: 14)),
        ]),
        const SizedBox(height: 4),
        Text(
          'Add their MiniGuru ID — Goins from this project will be split '
          'equally between everyone added. Can only be added before you submit.',
          style: GoogleFonts.nunito(color: _muted, fontSize: 12),
        ),
        const SizedBox(height: 12),
        if (_collaborators.isNotEmpty) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _collaborators
                .map((c) => Chip(
                      label: Text(c['name']!,
                          style: GoogleFonts.nunito(
                              fontSize: 12, fontWeight: FontWeight.w700)),
                      backgroundColor: const Color(0xFFF0F4FF),
                      deleteIcon: const Icon(Icons.close, size: 16),
                      onDeleted: () =>
                          setState(() => _collaborators.remove(c)),
                    ))
                .toList(),
          ),
          const SizedBox(height: 12),
        ],
        Row(children: [
          Expanded(
            child: TextField(
              controller: _collabCtrl,
              style: GoogleFonts.nunito(fontSize: 13),
              decoration: InputDecoration(
                hintText: 'e.g. aarav.ujjain@miniguru.in',
                hintStyle: GoogleFonts.nunito(fontSize: 12, color: _muted),
                isDense: true,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: _cardBorder)),
              ),
              onSubmitted: (v) {
                _addCollaborator(v);
                _collabCtrl.clear();
              },
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 40,
            child: ElevatedButton(
              onPressed: _collabSearching
                  ? null
                  : () {
                      _addCollaborator(_collabCtrl.text);
                      _collabCtrl.clear();
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: _blue,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: _collabSearching
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.add, color: Colors.white, size: 20),
            ),
          ),
        ]),
      ]),
    );
  }

  Widget _buildMaterials() {
    return Container(
      decoration: BoxDecoration(
        color:        _card,
        borderRadius: BorderRadius.circular(16),
        border:       Border.all(color: _cardBorder),
        boxShadow: [
          BoxShadow(
            color:      Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset:     const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Text('🧰', style: TextStyle(fontSize: 16)),
          const SizedBox(width: 8),
          Text('Materials',
              style: GoogleFonts.nunito(
                  color: _ink, fontWeight: FontWeight.w900, fontSize: 14)),
        ]),
        const SizedBox(height: 14),
        if (_pickedMaterials.isEmpty)
          GestureDetector(
            onTap: _openMaterialPicker,
            child: Container(
              width:   double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 20),
              decoration: BoxDecoration(
                color:        const Color(0xFFF8F9FF),
                borderRadius: BorderRadius.circular(12),
                border:       Border.all(
                    color: _cardBorder, style: BorderStyle.solid),
              ),
              child: Column(children: [
                const Text('📦', style: TextStyle(fontSize: 32)),
                const SizedBox(height: 8),
                Text('No materials selected yet',
                    style: GoogleFonts.nunito(color: _muted, fontSize: 13)),
                const SizedBox(height: 4),
                Text('Tap to pick materials for your project',
                    style: GoogleFonts.nunito(
                        color: _blue, fontSize: 12, fontWeight: FontWeight.w700)),
              ]),
            ),
          )
        else ...[
          ..._pickedMaterials.map((pm) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  Container(
                    width:  36, height: 36,
                    decoration: BoxDecoration(
                        color:        const Color(0xFFF0F4FF),
                        borderRadius: BorderRadius.circular(8)),
                    child: pm.item.imageUrl != null &&
                            pm.item.imageUrl!.isNotEmpty
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(pm.item.imageUrl!,
                                fit:          BoxFit.contain,
                                errorBuilder: (_, __, ___) => const Center(
                                    child: Text('📦',
                                        style: TextStyle(fontSize: 16)))))
                        : const Center(
                            child:
                                Text('📦', style: TextStyle(fontSize: 16))),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(pm.item.name,
                              style: GoogleFonts.nunito(
                                  color:      _ink,
                                  fontSize:   13,
                                  fontWeight: FontWeight.w700)),
                          Text('×${pm.quantity} ${pm.item.unit}',
                              style: GoogleFonts.nunito(
                                  color: _muted, fontSize: 11)),
                        ]),
                  ),
                ]),
              )),
          const SizedBox(height: 8),
        ],
        const SizedBox(height: 4),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _openMaterialPicker,
            icon:  const Icon(Icons.add_rounded, size: 18),
            label: Text(
              _pickedMaterials.isEmpty
                  ? 'Pick Materials'
                  : 'Edit Materials',
              style: GoogleFonts.nunito(
                  fontWeight: FontWeight.w800, fontSize: 13),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: _blue,
              side:            const BorderSide(color: _blue),
              padding:         const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _buildBottomBar() => SafeArea(
        child: Container(
          padding:   const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: BoxDecoration(
            color:  _card,
            border: const Border(top: BorderSide(color: Color(0xFFE8EAFF))),
            boxShadow: [
              BoxShadow(
                color:      Colors.black.withOpacity(0.05),
                blurRadius: 12,
                offset:     const Offset(0, -3),
              ),
            ],
          ),
          child: Row(children: [
            // Materials summary — Goins are earned only on admin approval,
            // never spent here (Rule 25). This is informational only.
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize:       MainAxisSize.min,
                  children: [
                    Text('Materials selected',
                        style: GoogleFonts.nunito(
                            color: _muted, fontSize: 11)),
                    Text(
                      _pickedMaterials.isEmpty
                          ? 'None yet'
                          : '${_pickedMaterials.length} item${_pickedMaterials.length > 1 ? 's' : ''}',
                      style: GoogleFonts.nunito(
                          color:      _blue,
                          fontSize:   13,
                          fontWeight: FontWeight.w800),
                    ),
                  ]),
            ),
            // Save draft
            GestureDetector(
              onTap: () => _handleSubmit(isDraft: true),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color:        const Color(0xFFF0F4FF),
                  borderRadius: BorderRadius.circular(12),
                  border:       Border.all(color: _cardBorder),
                ),
                child: Text('Save Draft',
                    style: GoogleFonts.nunito(
                        color:      _blue,
                        fontSize:   13,
                        fontWeight: FontWeight.w800)),
              ),
            ),
            // Submit
            GestureDetector(
              onTap: _submitting ? null : () => _handleSubmit(isDraft: false),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 18, vertical: 10),
                decoration: BoxDecoration(
                  color:        _blue,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(
                    Icons.upload_rounded,
                    color: Colors.white,
                    size:  16,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _submitting ? 'Uploading...' : 'Submit',
                    style: GoogleFonts.nunito(
                        color:      Colors.white,
                        fontSize:   13,
                        fontWeight: FontWeight.w800),
                  ),
                ]),
              ),
            ),
          ]),
        ),
      );
}

// ── Uploading dialog ──────────────────────────────────────────────────────────
class _UploadingDialog extends StatelessWidget {
  const _UploadingDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: _card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const CircularProgressIndicator(color: _blue, strokeWidth: 3),
          const SizedBox(height: 20),
          Text('Uploading your project...',
              style: GoogleFonts.nunito(
                  color:      _ink,
                  fontSize:   15,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text('This may take a minute 🎬',
              style: GoogleFonts.nunito(color: _muted, fontSize: 12)),
        ]),
      ),
    );
  }
}

// ── Project Kit Popup ─────────────────────────────────────────────────────────
Future<void> showProjectKitPopup({
  required BuildContext context,
  required List<PickedMaterial> pickedMaterials,
}) async {
  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ProjectKitSheet(pickedMaterials: pickedMaterials),
  );
}

class _ProjectKitSheet extends StatelessWidget {
  final List<PickedMaterial> pickedMaterials;
  const _ProjectKitSheet({required this.pickedMaterials});

  static const _bg     = Color(0xFFF5F7FF);
  static const _accent = Color(0xFF5B6EF5);
  static const _amber  = Color(0xFFE8A000);
  static const _ink    = Color(0xFF1A1A2E);
  static const _muted  = Color(0xFF8888AA);

  @override
  Widget build(BuildContext context) {
    final withLink    = pickedMaterials.where((m) => (m.item.amazonUrl ?? '').isNotEmpty).toList();
    final withoutLink = pickedMaterials.where((m) => (m.item.amazonUrl ?? '').isEmpty).toList();

    return Container(
      decoration: const BoxDecoration(
        color: _bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Colors.black12,
                borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(children: [
            const Text('🛒', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Your Project Kit',
                  style: GoogleFonts.nunito(
                    fontSize: 18, fontWeight: FontWeight.w900, color: _ink)),
                Text('Materials needed to build your project',
                  style: GoogleFonts.nunito(fontSize: 12, color: _muted)),
              ]),
            ),
            IconButton(
              icon: const Icon(Icons.close_rounded, color: _muted),
              onPressed: () => Navigator.pop(context),
            ),
          ]),

          const SizedBox(height: 4),
          const Divider(),
          const SizedBox(height: 8),

          // Materials with Amazon links
          if (withLink.isNotEmpty) ...[
            Text('Buy on Amazon',
              style: GoogleFonts.nunito(
                fontSize: 12, fontWeight: FontWeight.w800,
                color: _accent)),
            const SizedBox(height: 8),
            ...withLink.map((m) => _KitItem(picked: m, hasLink: true)),
            const SizedBox(height: 12),
          ],

          // Materials without Amazon links
          if (withoutLink.isNotEmpty) ...[
            Text('Buy locally / stationery store',
              style: GoogleFonts.nunito(
                fontSize: 12, fontWeight: FontWeight.w800,
                color: _muted)),
            const SizedBox(height: 8),
            ...withoutLink.map((m) => _KitItem(picked: m, hasLink: false)),
            const SizedBox(height: 12),
          ],

          // Send to parent button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                // TODO: wire to send-to-parent flow
              },
              icon: const Icon(Icons.send_rounded, size: 16),
              label: Text('Send Kit to Parent',
                style: GoogleFonts.nunito(
                  fontWeight: FontWeight.w800, fontSize: 14)),
              style: ElevatedButton.styleFrom(
                backgroundColor: _accent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _KitItem extends StatelessWidget {
  final PickedMaterial picked;
  final bool hasLink;
  const _KitItem({required this.picked, required this.hasLink});

  static const _accent = Color(0xFF5B6EF5);
  static const _amber  = Color(0xFFE8A000);
  static const _ink    = Color(0xFF1A1A2E);
  static const _muted  = Color(0xFF8888AA);

  @override
  Widget build(BuildContext context) {
    final imageUrl = picked.item.imageUrl ?? '';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: hasLink
            ? _accent.withOpacity(0.2)
            : Colors.black.withOpacity(0.06)),
      ),
      child: Row(children: [
        // Image or emoji
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Container(
            width: 44, height: 44,
            color: const Color(0xFFF0F0FF),
            child: imageUrl.isNotEmpty
              ? Image.network(imageUrl, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                    Center(child: Text(picked.item.icon ?? '📦',
                      style: const TextStyle(fontSize: 22))))
              : Center(child: Text(picked.item.icon ?? '📦',
                  style: const TextStyle(fontSize: 22))),
          ),
        ),
        const SizedBox(width: 12),

        // Name + qty
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(picked.item.name,
              style: GoogleFonts.nunito(
                fontSize: 13, fontWeight: FontWeight.w700, color: _ink),
              maxLines: 1, overflow: TextOverflow.ellipsis),
            Text('Qty: ${picked.quantity}  •  ${picked.item.unit ?? "piece"}',
              style: GoogleFonts.nunito(fontSize: 11, color: _muted)),
          ]),
        ),

        // Action button
        if (hasLink)
          GestureDetector(
            onTap: () async {
              final url = picked.item.amazonUrl ?? '';
              if (url.isNotEmpty) {
                final uri = Uri.parse(url);
                if (await canLaunchUrl(uri)) launchUrl(uri,
                  mode: LaunchMode.externalApplication);
              }
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFF9900),
                borderRadius: BorderRadius.circular(8)),
              child: Text('Amazon →',
                style: GoogleFonts.nunito(
                  fontSize: 11, fontWeight: FontWeight.w800,
                  color: Colors.white)),
            ),
          )
        else
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.05),
              borderRadius: BorderRadius.circular(8)),
            child: Text('Local shop',
              style: GoogleFonts.nunito(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: _muted)),
          ),
      ]),
    );
  }
}