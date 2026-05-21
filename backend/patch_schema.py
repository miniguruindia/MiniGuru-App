with open('prisma/schema.prisma', 'r') as f:
    content = f.read()

content = content.replace(
    'phoneNumber   String         @unique',
    'phoneNumber   String?'
)

if 'guardianEmail' not in content:
    content = content.replace(
        'parentPhone  String?',
        'parentPhone  String?\n  guardianEmail String?\n  emailVerified Boolean  @default(false)'
    )

new_models = '''
model PendingRegistration {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  miniguruId    String   @unique
  childName     String
  age           Int
  grade         String?
  guardianName  String?
  guardianEmail String
  guardianPhone String?
  passwordHash  String
  otpHash       String
  otpExpiry     DateTime
  createdAt     DateTime @default(now())
  @@map("pending_registrations")
}

model ProductSuggestion {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  childName  String?
  userId     String?  @db.ObjectId
  suggestion String
  category   String?
  createdAt  DateTime @default(now())
  @@map("product_suggestions")
}

'''

if 'PendingRegistration' not in content:
    content = content.replace('model VideoRating {', new_models + 'model VideoRating {')

with open('prisma/schema.prisma', 'w') as f:
    f.write(content)

print("Done")
