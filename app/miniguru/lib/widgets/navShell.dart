// lib/widgets/navShell.dart
//
// Keeps the laptop's left navigation bar on screen for EVERY page once the
// child/parent is inside the app (pages opened from Profile, "See All",
// videos, etc. used to cover it). The bar lives above the Navigator (see
// main.dart builder), so it never disappears while pages are pushed.
//
// HomeScreen owns the five tabs; it publishes their labels/icons here and
// listens for taps. Phones and tablets keep the normal bottom bar.

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/widgets/mgIcons.dart';
import 'package:miniguru/screens/navScreen/community_screen.dart' show EventsPage;

class NavShell {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  static final ValueNotifier<int> index = ValueNotifier<int>(0);
  static final ValueNotifier<bool> visible = ValueNotifier<bool>(false);
  static final ValueNotifier<List<BottomNavigationBarItem>> items =
      ValueNotifier<List<BottomNavigationBarItem>>(const []);

  // Counts live HomeScreens so a closing one can never hide the strip that a
  // newly opened one just asked for (the two post-frame callbacks could run
  // in either order). The strip shows while at least one HomeScreen exists.
  static int _alive = 0;
  static void _sync() =>
      WidgetsBinding.instance.addPostFrameCallback((_) => visible.value = _alive > 0);
  static void attach() {
    _alive++;
    _sync();
  }

  static void detach() {
    if (_alive > 0) _alive--;
    _sync();
  }

  /// Switch tab from anywhere: close any pages on top and show tab [i].
  static void go(int i) {
    index.value = i;
    navigatorKey.currentState?.popUntil((r) => r.settings.name == 'HomeScreen' || r.isFirst);
  }
}

class NavShellFrame extends StatelessWidget {
  final Widget child;
  const NavShellFrame({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return ValueListenableBuilder<bool>(
      valueListenable: NavShell.visible,
      builder: (context, vis, _) {
        final show = width >= 1000 && vis;
        // The tree shape never changes (so the Navigator keeps its pages);
        // only widths/colours switch.
        return Material(
          color: show ? const Color(0xFFEEF0FA) : Colors.transparent,
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SizedBox(
              width: show ? 93 : 0,
              child: show ? const _Rail() : null,
            ),
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: show ? 1400 : double.infinity),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: show ? Colors.white : null,
                      border: show
                          ? const Border.symmetric(vertical: BorderSide(color: Color(0xFFE3E6F7)))
                          : null,
                    ),
                    child: child,
                  ),
                ),
              ),
            ),
          ]),
        );
      },
    );
  }
}

class _Rail extends StatelessWidget {
  const _Rail();

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<BottomNavigationBarItem>>(
      valueListenable: NavShell.items,
      builder: (context, items, _) {
        if (items.length < 2) return const SizedBox.shrink();
        return ValueListenableBuilder<int>(
          valueListenable: NavShell.index,
          builder: (context, idx, _) {
            return NavigationRail(
                  selectedIndex: idx.clamp(0, items.length - 1),
                  onDestinationSelected: NavShell.go,
                  labelType: NavigationRailLabelType.all,
                  useIndicator: false, // the coloured icon pill already shows the open tab
                  backgroundColor: Colors.white,
                  minWidth: 92,
                  selectedIconTheme: const IconThemeData(color: Color(0xFF0A6CFF)),
                  unselectedIconTheme: IconThemeData(color: Colors.grey.shade500),
                  selectedLabelTextStyle: GoogleFonts.nunito(
                      fontSize: 11, fontWeight: FontWeight.w700, color: const Color(0xFF0A6CFF)),
                  unselectedLabelTextStyle: GoogleFonts.nunito(
                      fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
                  trailing: Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => NavShell.navigatorKey.currentState
                          ?.pushNamed(EventsPage.routeName),
                      child: Container(
                        width: 72,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: GColors.yellow,
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                                color: GColors.yellow.withOpacity(0.45),
                                blurRadius: 8,
                                offset: const Offset(0, 2)),
                          ],
                        ),
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          const Text('🏆', style: TextStyle(fontSize: 22)),
                          const SizedBox(height: 2),
                          Text('Events',
                              style: GoogleFonts.nunito(
                                  fontSize: 11, fontWeight: FontWeight.w900, color: const Color(0xFF1A1A2E))),
                        ]),
                      ),
                    ),
                  ),
                  destinations: [
                    for (final it in items)
                      NavigationRailDestination(
                        icon: it.icon,
                        selectedIcon: it.activeIcon,
                        label: Text(it.label ?? '', textAlign: TextAlign.center),
                      ),
                  ],
                );
          },
        );
      },
    );
  }
}
