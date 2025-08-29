# Sample Data for Rita Development

This directory contains sample data files for testing and development of the Rita SMS survey platform.

## File Structure

### Recipients Lists
- `sample-recipients.csv` - Sample contact list for testing imports
- `sample-recipients.xlsx` - Excel version of contact list

### Survey Examples  
- `sample-survey.json` - Example survey structure with questions
- `customer-satisfaction-survey.json` - Customer feedback survey example
- `event-feedback-survey.json` - Event feedback survey example

### Response Data
- `sample-responses.json` - Example response data for testing analytics
- `sample-analytics.json` - Sample analytics data structure

## CSV Import Format

The expected format for recipient CSV files:

### Required Fields
- `phone_number` - Phone number in E.164 format (+1234567890)

### Optional Fields  
- `first_name` - Recipient's first name
- `last_name` - Recipient's last name
- `email` - Email address (for notifications)

### Custom Fields
Any additional columns will be stored as custom fields for personalization.

### Example CSV Structure
```csv
phone_number,first_name,last_name,email,company,purchase_date
+1234567890,John,Doe,john@example.com,Acme Corp,2024-01-15
+1987654321,Jane,Smith,jane@example.com,Tech Solutions,2024-01-16
```

## Survey JSON Format

Example survey structure:
```json
{
  "name": "Customer Satisfaction Survey",
  "description": "Post-purchase feedback collection",
  "questions": [
    {
      "text": "How satisfied were you with your purchase?",
      "type": "rating",
      "validation": {"min_value": 1, "max_value": 5}
    },
    {
      "text": "What did you like most about the product?", 
      "type": "text",
      "validation": {"max_length": 160}
    }
  ],
  "settings": {
    "response_timeout": 60,
    "reminder_enabled": true
  }
}
```

## Usage in Development

1. **Import Testing**: Use the sample CSV files to test the recipient import functionality
2. **Survey Testing**: Use the sample survey JSON files to create test campaigns  
3. **Response Testing**: Use sample response data to test analytics and export features
4. **End-to-End Testing**: Combine sample data for full workflow testing

## Adding Your Own Sample Data

1. Place your sample recipient CSV file in this directory
2. Create your survey structure as a JSON file
3. Update the file references in the development documentation
4. Test the import process with your actual data structure

---

Ready to receive your sample list and survey files!