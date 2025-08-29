# Rita - Database Schema

## Schema Overview
This document defines the database structure for Rita's SMS survey platform using MongoDB collections (can be adapted for PostgreSQL tables).

## Collections/Tables

### Users
```javascript
{
  _id: ObjectId,
  email: String, // unique, required
  password_hash: String, // bcrypt hashed
  first_name: String,
  last_name: String,
  role: String, // 'admin', 'user', 'viewer'
  organization_id: ObjectId, // for multi-tenant support
  phone_number: String, // optional, for notifications
  timezone: String, // default 'UTC'
  settings: {
    email_notifications: Boolean,
    sms_notifications: Boolean,
    default_timeout: Number // minutes
  },
  is_active: Boolean,
  created_at: Date,
  updated_at: Date,
  last_login: Date
}
```

### Organizations
```javascript
{
  _id: ObjectId,
  name: String,
  subscription_plan: String, // 'free', 'pro', 'enterprise'
  settings: {
    max_campaigns: Number,
    max_recipients_per_campaign: Number,
    ai_features_enabled: Boolean
  },
  created_at: Date,
  updated_at: Date
}
```

### Campaigns
```javascript
{
  _id: ObjectId,
  user_id: ObjectId, // campaign creator
  organization_id: ObjectId,
  name: String,
  description: String,
  status: String, // 'draft', 'scheduled', 'active', 'paused', 'completed', 'failed'
  
  // Scheduling
  scheduled_at: Date, // when to start
  launched_at: Date, // actual start time
  completed_at: Date, // actual end time
  timezone: String,
  
  // Settings
  settings: {
    response_timeout: Number, // minutes to wait between questions
    reminder_enabled: Boolean,
    reminder_delay: Number, // minutes after timeout
    max_reminders: Number,
    auto_end_after: Number, // days
    allow_opt_back_in: Boolean
  },
  
  // Statistics (updated in real-time)
  stats: {
    total_recipients: Number,
    messages_sent: Number,
    responses_received: Number,
    opt_outs: Number,
    completion_rate: Number,
    current_question_stats: [{
      question_id: ObjectId,
      sent: Number,
      responded: Number,
      pending: Number
    }]
  },
  
  created_at: Date,
  updated_at: Date
}
```

### Surveys
```javascript
{
  _id: ObjectId,
  campaign_id: ObjectId,
  name: String,
  description: String,
  
  // Survey Flow
  questions: [ObjectId], // ordered array of question IDs
  flow_logic: {
    // Advanced: conditional branching based on responses
    rules: [{
      condition: String, // "if_answer_equals", "if_answer_contains"
      question_id: ObjectId,
      value: String,
      action: String, // "skip_to", "end_survey"
      target_question_id: ObjectId
    }]
  },
  
  // Completion rules
  completion_rules: {
    require_all_questions: Boolean,
    allow_partial_completion: Boolean,
    min_questions_required: Number
  },
  
  created_at: Date,
  updated_at: Date
}
```

### Questions
```javascript
{
  _id: ObjectId,
  survey_id: ObjectId,
  text: String, // the question text sent via SMS
  type: String, // 'text', 'multiple_choice', 'rating', 'yes_no', 'number'
  order: Number, // position in survey
  
  // Question-specific settings
  options: [String], // for multiple choice questions
  validation: {
    required: Boolean,
    min_length: Number,
    max_length: Number,
    pattern: String, // regex pattern
    min_value: Number, // for rating/number questions
    max_value: Number
  },
  
  // SMS formatting
  sms_template: String, // formatted question with instructions
  help_text: String, // sent if user asks for help
  
  created_at: Date,
  updated_at: Date
}
```

### Recipients (Pet Store Customers)
```javascript
{
  _id: ObjectId,
  campaign_id: ObjectId,
  
  // Contact Information
  email: String, // primary identifier from CSV
  phone_number: String, // E.164 format: +1234567890 (collected or imported)
  first_name: String,
  last_name: String,
  
  // Pet Purchase Details (from CSV custom fields)
  pet_breed: String, // CustomData1: "Beagle", "Goldendoodle", etc.
  purchase_date: String, // CustomData2: "9/18/2022"
  sales_associate: String, // CustomData3: "Lily", "Victoria", etc.
  store_location: String, // CustomData4: "Animal Kingdom - Arizona Mills"
  
  // Survey State
  status: String, // 'pending', 'active', 'completed', 'opted_out', 'failed'
  current_question_id: ObjectId, // null if completed/opted out
  current_question_order: Number,
  
  // Progress tracking
  questions_answered: Number,
  total_questions: Number,
  completion_percentage: Number,
  
  // Timing
  survey_started_at: Date,
  survey_completed_at: Date,
  last_message_sent_at: Date,
  last_response_received_at: Date,
  next_message_scheduled_at: Date,
  
  // Business-specific flags
  manager_callback_requested: Boolean,
  callback_topic: String, // if manager callback requested
  nps_score: Number, // for quick analytics
  satisfaction_rating: Number, // 1-5 star rating
  
  // Metadata from CSV import
  import_batch_id: ObjectId,
  import_row_number: Number,
  
  created_at: Date,
  updated_at: Date
}
```

### Responses
```javascript
{
  _id: ObjectId,
  recipient_id: ObjectId,
  question_id: ObjectId,
  campaign_id: ObjectId, // denormalized for easier querying
  
  // Response data
  raw_message: String, // original SMS text
  processed_answer: String, // cleaned/validated answer
  answer_value: {}, // structured data (for analytics)
  
  // Validation
  is_valid: Boolean,
  validation_errors: [String],
  
  // SMS metadata
  twilio_message_id: String,
  from_phone: String,
  to_phone: String,
  
  // Timing
  question_sent_at: Date,
  response_received_at: Date,
  processing_time: Number, // milliseconds
  
  created_at: Date
}
```

### OptOuts
```javascript
{
  _id: ObjectId,
  phone_number: String, // E.164 format
  campaign_id: ObjectId, // which campaign they opted out from
  
  // Opt-out details
  opt_out_keyword: String, // 'STOP', 'UNSUBSCRIBE', etc.
  opt_out_message: String, // full message they sent
  global_opt_out: Boolean, // opted out of all campaigns
  
  // Recovery
  opt_back_in_at: Date, // if they opted back in
  opt_back_in_message: String,
  
  created_at: Date,
  updated_at: Date
}
```

### ImportBatches
```javascript
{
  _id: ObjectId,
  campaign_id: ObjectId,
  user_id: ObjectId,
  
  // File info
  filename: String,
  file_size: Number,
  file_type: String, // 'csv', 'xlsx', 'xls'
  
  // Import results
  total_rows: Number,
  successful_imports: Number,
  failed_imports: Number,
  duplicate_phone_numbers: Number,
  
  // Validation errors
  validation_errors: [{
    row: Number,
    field: String,
    error: String,
    value: String
  }],
  
  // Processing status
  status: String, // 'processing', 'completed', 'failed'
  processed_at: Date,
  
  created_at: Date
}
```

### MessageLogs
```javascript
{
  _id: ObjectId,
  campaign_id: ObjectId,
  recipient_id: ObjectId,
  question_id: ObjectId,
  
  // Message details
  direction: String, // 'outbound', 'inbound'
  message_text: String,
  message_type: String, // 'question', 'reminder', 'opt_out_confirmation'
  
  // Twilio data
  twilio_message_id: String,
  from_phone: String,
  to_phone: String,
  status: String, // 'sent', 'delivered', 'failed', 'undelivered'
  error_code: String,
  error_message: String,
  
  // Costs and analytics
  cost: Number,
  segments: Number, // SMS segments used
  
  sent_at: Date,
  delivered_at: Date,
  created_at: Date
}
```

## Indexes

### Performance Optimization
```javascript
// Users
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "organization_id": 1 })

// Campaigns
db.campaigns.createIndex({ "user_id": 1, "status": 1 })
db.campaigns.createIndex({ "scheduled_at": 1 })
db.campaigns.createIndex({ "organization_id": 1 })

// Recipients
db.recipients.createIndex({ "campaign_id": 1, "status": 1 })
db.recipients.createIndex({ "phone_number": 1, "campaign_id": 1 })
db.recipients.createIndex({ "next_message_scheduled_at": 1 })

// Responses
db.responses.createIndex({ "recipient_id": 1, "created_at": 1 })
db.responses.createIndex({ "campaign_id": 1, "question_id": 1 })
db.responses.createIndex({ "created_at": 1 }) // for time-based queries

// OptOuts
db.optouts.createIndex({ "phone_number": 1 }, { unique: true })
db.optouts.createIndex({ "campaign_id": 1 })

// MessageLogs
db.messagelogs.createIndex({ "campaign_id": 1, "sent_at": 1 })
db.messagelogs.createIndex({ "twilio_message_id": 1 })
db.messagelogs.createIndex({ "recipient_id": 1, "created_at": 1 })
```

## Sample Data Structure

### Sample Campaign
```javascript
{
  name: "Customer Satisfaction Survey",
  description: "Post-purchase feedback collection",
  settings: {
    response_timeout: 60, // 1 hour
    reminder_enabled: true,
    reminder_delay: 30,
    max_reminders: 1,
    auto_end_after: 7
  }
}
```

### Sample Questions
```javascript
[
  {
    text: "On a scale of 1-5, how satisfied were you with your recent purchase?",
    type: "rating",
    validation: { min_value: 1, max_value: 5 },
    sms_template: "On a scale of 1-5, how satisfied were you with your recent purchase? Reply with a number 1-5."
  },
  {
    text: "What did you like most about the product?",
    type: "text",
    validation: { max_length: 160 },
    sms_template: "What did you like most about the product? (Keep it under 160 characters)"
  },
  {
    text: "Would you recommend us to a friend?",
    type: "yes_no",
    sms_template: "Would you recommend us to a friend? Reply YES or NO"
  }
]
```

### Sample Recipients CSV Format
```csv
phone_number,first_name,last_name,purchase_date,product_category
+1234567890,John,Doe,2024-01-15,Electronics
+1987654321,Jane,Smith,2024-01-16,Clothing
+1555123456,Bob,Johnson,2024-01-17,Home
```

This schema provides flexibility for growth while maintaining performance and ensuring data integrity for Rita's SMS survey platform.