import 'dart:math';

import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/models/User.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/repository/userDataRepository.dart';
import 'package:miniguru/screens/loginScreen.dart';
// ignore: unused_import
import 'package:miniguru/screens/rechargePage.dart';
import 'package:miniguru/screens/walletPage.dart';

class Profile extends StatefulWidget {
  const Profile({super.key});
  static String id = "Profile";
  @override
  State<Profile> createState() => _ProfileState();
}

class _ProfileState extends State<Profile> {
  UserRepository userRepository = UserRepository();
  User? _user;

  final colors = [pastelBlue];
  final fontColors = [
    pastelBlueText,
  ];

  int index = 0;

  @override
  void initState() {
    super.initState();
    fetchUserData();
    Random random = Random();
    index = random.nextInt(colors.length);
  }

  Future<void> fetchUserData() async {
    await userRepository.fetchAndStoreUserData();
    User? user = await userRepository.getUserDataFromLocalDb();
    setState(() {
      _user = user!;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Profile',
          style: headingTextStyle.copyWith(fontSize: 24),
        ),
      ),
      body: _user == null
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Profile Picture
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16.0), // Less rounded
                      child: Image.network(
                        'https://picsum.photos/200',
                        width: 100,
                        height: 100,
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Name and Email
                    Text(
                      _user!.name,
                      style: headingTextStyle,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _user!.email,
                      style: bodyTextStyle.copyWith(
                        color: Colors.grey[700],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // // Progress Section
                    // Padding(
                    //   padding: const EdgeInsets.all(8.0),
                    //   child: Align(
                    //     alignment: Alignment.centerLeft,
                    //     child: Text(
                    //       'Progress',
                    //       style: headingTextStyle.copyWith(
                    //         fontSize: 20,
                    //         color: Colors.black,
                    //       ),
                    //     ),
                    //   ),
                    // ),
                    // const SizedBox(height: 16),
                    // Container(
                    //   padding: const EdgeInsets.all(12.0),
                    //   decoration: BoxDecoration(
                    //     color: colors[index], // pastelBlue
                    //     borderRadius:
                    //         BorderRadius.circular(16.0), // Less rounded
                    //   ),
                    //   child: Column(
                    //     crossAxisAlignment: CrossAxisAlignment.start,
                    //     children: [
                    //       Row(
                    //         mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    //         children: [
                    //           Text(
                    //             'Master',
                    //             style: headingTextStyle.copyWith(fontSize: 14),
                    //           ),
                    //           Text(
                    //             '${_user!.score}/300',
                    //             style: headingTextStyle.copyWith(fontSize: 12),
                    //           ),
                    //         ],
                    //       ),
                    //       const SizedBox(height: 10),
                    //       // Custom Linear Progress Bar
                    //       Stack(
                    //         children: [
                    //           Container(
                    //             width: double.infinity,
                    //             height: 10.0,
                    //             decoration: BoxDecoration(
                    //               color: Colors.grey[100],
                    //               borderRadius: BorderRadius.circular(5.0),
                    //             ),
                    //           ),
                    //           Container(
                    //             width: (_user!.score / 300) *
                    //                 MediaQuery.of(context)
                    //                     .size
                    //                     .width, // Dynamic width based on score
                    //             height: 10.0,
                    //             decoration: BoxDecoration(
                    //               color: fontColors[index],
                    //               borderRadius: BorderRadius.circular(5.0),
                    //             ),
                    //           ),
                    //         ],
                    //       ),
                    //       const SizedBox(height: 8),
                    //       // Level Text
                    //       Text(
                    //         'Lvl 3',
                    //         style: bodyTextStyle.copyWith(
                    //           color: Colors.black, // Black text
                    //         ),
                    //       ),
                    //     ],
                    //   ),
                    // ),
                    const SizedBox(height: 24),

                    // Wallet Section
                    Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Wallet',
                          style: headingTextStyle.copyWith(
                            fontSize: 20,
                            color: Colors.black,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => WalletPage(
                              user: _user!,
                            ),
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.all(16.0),
                        decoration: BoxDecoration(
                          color: colors[index],
                          borderRadius: BorderRadius.circular(16.0),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.account_balance_wallet_rounded,
                                  color: fontColors[index],
                                  size: 40,
                                ),
                                const SizedBox(width: 16),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Wallet Balance',
                                      style: headingTextStyle.copyWith(
                                        fontSize: 14,
                                      ),
                                    ),
                                    Text('₹${(_user!.walletBalance)}',
                                        style: bodyTextStyle.copyWith(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 16,
                                        )),
                                  ],
                                ),
                              ],
                            ),
                            const Icon(
                              Icons.arrow_forward_ios,
                              color: Colors.blueAccent,
                              size: 24,
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Settings Section
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Settings',
                        style: headingTextStyle.copyWith(
                          fontSize: 20,
                          color: Colors.black,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ElevatedButton(
                          onPressed: () {
                            // Navigate to Privacy Policy
                          },
                          style: ElevatedButton.styleFrom(
                              backgroundColor: colors[index], // pastelBlue
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(8.0), // Less rounded
                              ),
                              minimumSize: const Size(double.infinity, 50)),
                          child: Row(
                            children: [
                              const Icon(Icons.privacy_tip),
                              const SizedBox(
                                width: 16,
                              ),
                              Text(
                                'Privacy Policy',
                                style: bodyTextStyle.copyWith(
                                    fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(
                          height: 8,
                        ),
                        ElevatedButton(
                          onPressed: () {
                            // Navigate to Terms and Conditions
                          },
                          style: ElevatedButton.styleFrom(
                              backgroundColor: colors[index], // pastelBlue
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(8.0), // Less rounded
                              ),
                              minimumSize: const Size(double.infinity, 50)),
                          child: Row(
                            children: [
                              const Icon(Icons.settings),
                              const SizedBox(
                                width: 16,
                              ),
                              Text(
                                'Terms and Conditions',
                                style: bodyTextStyle.copyWith(
                                    fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(
                          height: 36,
                        ),
                        ElevatedButton(
                          onPressed: () async {
                            final db = DatabaseHelper();
                            final api = MiniguruApi();

                            await api.logout();
                            await db.clearAllTables();

                            Navigator.of(context).pushNamedAndRemoveUntil(
                                LoginScreen.id, (route) => false);
                          },
                          style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.redAccent,
                              shape: RoundedRectangleBorder(
                                borderRadius:
                                    BorderRadius.circular(16.0), // Less rounded
                              ),
                              minimumSize: const Size(double.infinity, 60)),
                          child: Text(
                            'Logout',
                            style: bodyTextStyle.copyWith(color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
