import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/models/ProjectCategory.dart';
import 'package:miniguru/repository/draftsRepository.dart';
import 'package:miniguru/repository/projectRepository.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:miniguru/models/Product.dart';
import 'package:miniguru/repository/productRepository.dart';

import 'homeScreen.dart';

class AddDraftScreen extends StatefulWidget {
  const AddDraftScreen({super.key});
  @override
  State<AddDraftScreen> createState() => _AddDraftScreenState();
}

class _AddDraftScreenState extends State<AddDraftScreen> {
  final _formKey = GlobalKey<FormState>();

  List<Product> _products = [];
  List<String> _categories = [];

  final Map<String, int> _selectedMaterials = {};
  List<Product> _filteredProducts = [];

  bool _loading = true;
  bool _searchLoading = false;

  final cardColor = pastelBlue;

  DateTime? _startDate;
  DateTime? _endDate;

  final ImagePicker _picker = ImagePicker();
  XFile? video;
  XFile? thumbnail;

  int _draftId = -1;

  final DraftRepository _repository = DraftRepository();

  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  final TextEditingController _categoryController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _loadCategories();
  }

  Future<void> _onSearchChanged(String query) async {
    if (query.isEmpty) {
      setState(() {
        _filteredProducts = _products;
      });
    } else {
      ProductRepository repo = ProductRepository();
      List<Product> results = await repo.getProductsByQuery(query);
      setState(() {
        _filteredProducts = results;
      });
    }
  }

  Future<void> _loadProducts() async {
    setState(() {
      _searchLoading = true;
    });
    ProductRepository repo = ProductRepository();
    await repo.fetchAndStoreProducts();
    List<Product> products = await repo.getProducts();
    setState(() {
      _products = products;
      _searchLoading = false;
    });
    await _onSearchChanged('');
  }

  Future<void> _loadCategories() async {
    ProjectRepository repo = ProjectRepository();
    List<ProjectCategory> categories = await repo.getProjectCategories();
    setState(() {
      _categories = categories.map((project) => project.name).toList();
      _loading = false;
    });
  }

  Future<void> _requestPermissions() async {
    await [Permission.storage].request();
  }

  Future<void> _pickVideo() async {
    await _requestPermissions();
    final pickedFile = await _picker.pickVideo(source: ImageSource.gallery);
    setState(() {
      video = pickedFile;
    });
  }

  Future<void> _pickThumbnail() async {
    await _requestPermissions();
    final pickedFile = await _picker.pickImage(source: ImageSource.gallery);
    setState(() {
      thumbnail = pickedFile;
    });
  }

  Future _submitForm({bool isDraft = false}) async {
    DraftRepository repository = DraftRepository();
    String? validationError; // To hold any specific validation error message

    // Validate form based on whether it's a draft or a final submission
    bool isValid = isDraft
        ? (validationError = _validateDraftFields()) ==
            null // Custom draft validation
        : (validationError = _validateFinalFields()) ==
            null; // Custom final validation

    if (isValid) {
      final project = {
        'title': _titleController.text,
        'description': _descriptionController.text,
        'startDate': _startDate,
        'endDate': _endDate,
        'category': _categoryController.text,
        'materials': _selectedMaterials,
      };

      if (isDraft) {
        _draftId = await repository.saveOrUpdateDraft(
          title: project['title'] as String,
          description: project['description'] as String,
          category: project['category'] as String,
          startDate: project['startDate'] as DateTime?,
          endDate: project['endDate'] as DateTime?,
          materials: project['materials'] as Map<String, int>,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: Colors.green,
            content: Text(
              'Saved as draft!',
              style: bodyTextStyle.copyWith(color: backgroundWhite),
            ),
            duration: const Duration(seconds: 2),
          ),
        );
      } else {
        setState(() {
          _loading = true;
        });

        // Show a non-dismissible loading dialog
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (BuildContext context) {
            return const Dialog(
              child: Padding(
                padding: EdgeInsets.all(20.0),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(width: 20),
                    Text("Uploading project..."),
                  ],
                ),
              ),
            );
          },
        );

        int statusCode =
            await _repository.uploadProjects(project, video!, thumbnail!);

        setState(() {
          _loading = false;
        });

        // Dismiss the dialog only after the upload attempt
        Navigator.pop(context);

        if (statusCode == 201) {
          if (_draftId != -1) await repository.deleteDraft(_draftId);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.green,
              content: Text(
                'Project submitted successfully!',
                style: bodyTextStyle.copyWith(color: backgroundWhite),
              ),
              duration: const Duration(seconds: 2),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.red,
              content: Text(
                'Failed uploading the project. Please try again later!',
                style: bodyTextStyle.copyWith(color: backgroundWhite),
              ),
              duration: const Duration(seconds: 2),
            ),
          );
        }
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: Colors.red,
          content: Text(
            validationError!, // Show the specific validation error
            style: bodyTextStyle.copyWith(color: backgroundWhite),
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }
    Navigator.pushNamedAndRemoveUntil(context, HomeScreen.id, (route) => false);
  }

// Validation function for draft submission with specific error messages
  String? _validateDraftFields() {
    if (_titleController.text.isEmpty) {
      return 'Title is required for saving as draft.';
    } else if (_categoryController.text.isEmpty) {
      return 'Category is required for saving as draft.';
    } else if (_descriptionController.text.isEmpty) {
      return 'Description is required for saving as draft.';
    }
    return null; // Return null if there are no validation errors
  }

// Validation function for final submission with specific error messages
  String? _validateFinalFields() {
    if (_titleController.text.isEmpty) {
      return 'Title is required for project submission.';
    } else if (_categoryController.text.isEmpty) {
      return 'Category is required for project submission.';
    } else if (_descriptionController.text.isEmpty) {
      return 'Description is required for project submission.';
    } else if (_startDate == null) {
      return 'Start date is required for project submission.';
    } else if (_endDate == null) {
      return 'End date is required for project submission.';
    } else if (_selectedMaterials.isEmpty) {
      return 'At least one material must be selected for project submission.';
    } else if (video == null) {
      return 'Video is required for uploading the project';
    } else if (thumbnail == null) {
      return 'Thumbnail is required for uploading the project';
    }
    return null; // Return null if there are no validation errors
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Add Draft',
          style: bodyTextStyle.copyWith(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: cardColor,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionTitle('Project Details', cardColor),
                      _buildTextField(
                        controller: _titleController,
                        label: 'Title',
                        validatorMessage: 'Please enter a title',
                      ),
                      _buildTextField(
                        controller: _descriptionController,
                        label: 'Description',
                        validatorMessage: 'Please enter a description',
                        maxLines: 3,
                      ),
                      _buildCategoryDropdown(cardColor),
                      Column(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          _buildDatePicker(
                            'Start Date',
                            _startDate,
                            (DateTime? date) {
                              setState(() {
                                _startDate = date;
                              });
                            },
                            (DateTime? date) {
                              print(date);
                              if (date == null) {
                                return 'Please select a start date';
                              }
                              return null;
                            },
                          ),
                          _buildDatePicker(
                            'End Date',
                            _endDate,
                            (DateTime? date) {
                              setState(() {
                                _endDate = date;
                              });
                            },
                            (DateTime? date) {
                              if (date == null) {
                                return 'Please select an end date';
                              }
                              return null;
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildVideoPickerSection(cardColor),
                      const SizedBox(height: 16),
                      _buildThumbnailPickerSection(cardColor),
                      const SizedBox(height: 16),
                      _buildMaterialsSection(cardColor),
                      const SizedBox(height: 16),
                      _buildSubmitButton(cardColor),
                    ],
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title, Color cardColor) {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: Text(
        title,
        style: bodyTextStyle.copyWith(
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    String? validatorMessage,
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: bodyTextStyle,
          border: const OutlineInputBorder(),
        ),
        style: bodyTextStyle,
        validator: validatorMessage != null
            ? (value) {
                if (value == null || value.isEmpty) {
                  return validatorMessage;
                }
                return null;
              }
            : null,
        maxLines: maxLines,
      ),
    );
  }

  Widget _buildCategoryDropdown(Color cardColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: DropdownButtonFormField<String>(
        value: _categoryController.text.isNotEmpty
            ? _categoryController.text
            : null,
        decoration: const InputDecoration(
          labelText: 'Category',
          border: OutlineInputBorder(),
        ),
        items: _categories.map((String category) {
          return DropdownMenuItem<String>(
            value: category,
            child: Text(category),
          );
        }).toList(),
        validator: (String? value) {
          if (value == null || value.isEmpty) {
            return 'Please select a category';
          }
          return null;
        },
        onChanged: (String? newValue) {
          setState(() {
            _categoryController.text = newValue ?? '';
          });
        },
        onTap: () {
          showSearch<String>(
            context: context,
            delegate: CategorySearchDelegate(_categories),
          ).then((value) {
            if (value != null) {
              setState(() {
                _categoryController.text = value;
              });
            }
          });
        },
      ),
    );
  }

  Widget _buildVideoPickerSection(Color cardColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ElevatedButton.icon(
          onPressed: _pickVideo,
          icon: const Icon(Icons.video_library),
          label: Text(video == null ? 'Pick Video' : 'Change Video'),
        ),
        const SizedBox(height: 8),
        if (video != null)
          Text(
            'Selected Video: ${video?.name}',
            style: bodyTextStyle.copyWith(
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
      ],
    );
  }

  Widget _buildThumbnailPickerSection(Color cardColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ElevatedButton.icon(
          onPressed: _pickThumbnail,
          icon: const Icon(Icons.image),
          label:
              Text(thumbnail == null ? 'Pick Thumbnail' : 'Change Thumbnail'),
        ),
        const SizedBox(height: 8),
        if (thumbnail != null)
          Text(
            'Selected Thumbnail: ${thumbnail?.name}',
            style: bodyTextStyle.copyWith(
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
      ],
    );
  }

  Widget _buildDatePicker(
      String label,
      DateTime? selectedDate,
      FormFieldSetter<DateTime?> onSaved,
      FormFieldValidator<DateTime?> validator) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () async {
                final DateTime? pickedDate = await showDatePicker(
                  context: context,
                  initialDate: selectedDate ?? DateTime.now(),
                  firstDate: DateTime(2000),
                  lastDate: DateTime(2101),
                );
                if (pickedDate != null && pickedDate != selectedDate) {
                  onSaved(pickedDate);
                }
              },
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: label,
                  border: const OutlineInputBorder(),
                ),
                child: Text(
                  selectedDate != null
                      ? '${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}'
                      : 'Select $label',
                  style: bodyTextStyle,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMaterialsSection(Color cardColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Materials',
          style: bodyTextStyle.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.only(bottom: 8.0),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search materials...',
              hintStyle: bodyTextStyle,
              border: const OutlineInputBorder(),
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searchLoading
                  ? const Padding(
                      padding: EdgeInsets.all(36.0),
                      child: CircularProgressIndicator(),
                    )
                  : null,
            ),
            onChanged: (query) async {
              await _onSearchChanged(query);
            },
          ),
        ),
        Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8.0),
          ),
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _filteredProducts.length,
                    itemBuilder: (context, index) {
                      final product = _filteredProducts[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8.0),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4.0),
                              child: Image.network(
                                product.images,
                                height: 30,
                                width: 30,
                              ),
                            ),
                            const SizedBox(
                              width: 16.0,
                            ),
                            Expanded(
                              flex: 3,
                              child: Text(
                                product.name,
                                style: bodyTextStyle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 60,
                              child: TextField(
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(
                                  hintText: 'Qty',
                                  hintStyle:
                                      bodyTextStyle.copyWith(fontSize: 12),
                                  border: const OutlineInputBorder(),
                                ),
                                onChanged: (value) {
                                  setState(() {
                                    if (value.isNotEmpty) {
                                      _selectedMaterials[product.id] =
                                          int.parse(value);
                                    } else {
                                      _selectedMaterials.remove(product.id);
                                    }
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildSubmitButton(Color cardColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: buttonBlack),
          onPressed: () => _submitForm(isDraft: true), // Save as draft
          child: Row(
            children: [
              const Icon(
                Icons.drafts,
                color: backgroundWhite,
              ),
              const SizedBox(
                width: 8,
              ),
              Text(
                'Save as Draft',
                style: bodyTextStyle.copyWith(color: backgroundWhite),
              ),
            ],
          ),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: buttonBlack),
          onPressed: () => _submitForm(isDraft: false), // Submit the form
          child: Text(
            'Submit',
            style: bodyTextStyle.copyWith(color: backgroundWhite),
          ),
        ),
      ],
    );
  }
}

class CategorySearchDelegate extends SearchDelegate<String> {
  final List<String> categories;

  CategorySearchDelegate(this.categories);

  @override
  List<Widget> buildActions(BuildContext context) => [];

  @override
  Widget buildLeading(BuildContext context) => IconButton(
        icon: const Icon(Icons.arrow_back),
        onPressed: () => Navigator.pop(context),
      );

  @override
  Widget buildResults(BuildContext context) {
    final results = categories
        .where(
            (category) => category.toLowerCase().contains(query.toLowerCase()))
        .toList();
    return ListView(
      children: results
          .map((category) => ListTile(
                title: Text(category),
                onTap: () => Navigator.pop(context, category),
              ))
          .toList(),
    );
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    final suggestions = categories
        .where(
            (category) => category.toLowerCase().contains(query.toLowerCase()))
        .toList();
    return ListView(
      children: suggestions
          .map((category) => ListTile(
                title: Text(category),
                onTap: () => Navigator.pop(context, category),
              ))
          .toList(),
    );
  }
}
