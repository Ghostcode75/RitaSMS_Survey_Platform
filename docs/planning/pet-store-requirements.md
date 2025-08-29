# Rita - Pet Store Customer Feedback Requirements

## Business Context
**Client**: Puppies N Love / Animal Kingdom  
**Use Case**: Post-purchase customer satisfaction surveys  
**Current Process**: Email-based SurveyMonkey surveys  
**Goal**: Convert to SMS-based surveys for higher response rates

## Sample Data Analysis

### Customer Data Structure (from CSV)
```csv
Email,FirstName,LastName,CustomData1,CustomData2,CustomData3,CustomData4
trip9racing@yahoo.com,Diana Ayala,& Alicia Cook,Beagle,9/18/2022,Lily,Animal Kingdom - Arizona Mills
```

**Key Insights**:
- Primary identifier: **Email** (not phone number)
- Multiple customers per purchase (couples)
- Rich purchase context data
- Multiple store locations

### Custom Data Fields
1. **CustomData1**: Pet breed (Beagle, Goldendoodle, Bichon Frise, etc.)
2. **CustomData2**: Purchase date (9/18/2022)
3. **CustomData3**: Sales associate name (Lily, Victoria, Alex, etc.)
4. **CustomData4**: Store location (Animal Kingdom - Arizona Mills, Puppies N Love - SanTan Village)

## Survey Structure (6 Questions)

### Question 1: Overall Experience Rating
- **Type**: 5-star rating scale
- **SMS Format**: "Rate your overall experience purchasing your puppy from Puppies N Love. Reply 1-5 (5=best)"

### Question 2: Areas for Improvement
- **Type**: Multiple choice (select all that apply)
- **Options**:
  - Experience with pet specialist
  - Health of your puppy
  - The paperwork process
  - Everything was great!
  - Other (specify)
- **SMS Format**: Multi-option with A, B, C, D, E format

### Question 3: Follow-up Call Status
- **Type**: Multiple choice (single select)
- **Options**:
  - Yes, and I spoke with my pet specialist
  - Yes, but they left a message and we haven't spoken yet
  - No, there has been no follow up call or message left
- **SMS Format**: A, B, C options

### Question 4: Net Promoter Score (NPS)
- **Type**: 0-10 scale
- **Question**: "How likely would you recommend this company to a friend or colleague?"
- **SMS Format**: "On a scale of 0-10, how likely would you recommend Puppies N Love to a friend?"

### Question 5: Improvement Suggestions
- **Type**: Open text
- **Question**: "Is there anything that would have made your experience with us better?"
- **SMS Format**: Free text with character limit

### Question 6: Manager Follow-up Request
- **Type**: Yes/No with conditional text
- **Options**:
  - No thank you, I'm set and love my puppy!
  - Yes, please have the store manager call me! (with topic)
- **SMS Format**: A/B choice with follow-up text if B selected

## Key Technical Requirements

### Data Import Adaptations
- **Primary Challenge**: CSV has emails, not phone numbers
- **Solution**: 
  1. Import email-based customer data
  2. Add phone number collection step (manual entry or lookup)
  3. Map CustomData fields to structured pet purchase data

### SMS Message Flow
1. **Welcome Message**: "Hi [FirstName]! Thanks for purchasing your [PetBreed] from [StoreName]. We'd love your feedback!"
2. **Question Delivery**: One question at a time with clear response format
3. **Response Processing**: Handle A/B/C choices, ratings, and text
4. **Thank You**: "Thanks for your feedback! We hope you and your puppy are doing great! 🐶"

### Business Logic Requirements
- **Manager Callback Tracking**: Flag customers requesting manager follow-up
- **NPS Categorization**: Automatically categorize responses (Detractor 0-6, Passive 7-8, Promoter 9-10)
- **Associate Performance**: Track satisfaction by sales associate
- **Store Comparison**: Compare performance across store locations
- **Breed-specific Insights**: Analyze feedback by pet breed

### Analytics & Reporting Needs
- **NPS Dashboard**: Real-time Net Promoter Score tracking
- **Store Performance**: Comparison between locations
- **Associate Performance**: Individual sales associate ratings
- **Common Issues**: Categorization of improvement areas
- **Callback Queue**: List of customers requesting manager follow-up

## MVP Feature Priority

### Phase 1: Core Survey System
1. Import email-based customer CSV
2. Add phone number collection interface
3. Send 6-question SMS survey sequence
4. Store responses with pet purchase context
5. Basic analytics dashboard

### Phase 2: Business Intelligence
1. NPS calculation and categorization
2. Store location performance comparison  
3. Sales associate performance tracking
4. Manager callback queue management
5. Response export with business context

### Phase 3: Advanced Features
1. Automated follow-up workflows
2. AI-powered sentiment analysis of open responses
3. Integration with CRM/sales systems
4. Advanced reporting and insights
5. Multi-location campaign management

## Data Export Requirements

### Survey Results Export Format
```csv
Email,FirstName,LastName,PetBreed,PurchaseDate,SalesAssociate,StoreLocation,OverallRating,NPSScore,ImprovementAreas,FollowupReceived,ManagerCallbackRequested,CallbackTopic,SurveyCompletedAt,ResponseTime
```

### Manager Callback Report
```csv
CustomerName,Email,Phone,PetBreed,SalesAssociate,StoreLocation,CallbackTopic,Priority,RequestedAt
```

### Store Performance Summary  
```csv
StoreLocation,TotalResponses,AverageRating,NPSScore,PromoterPercent,DetractorPercent,CallbackRequests,TopIssues
```

## Implementation Notes

### Phone Number Collection Strategy
**Option 1**: Manual entry during import process
**Option 2**: SMS opt-in campaign to existing email list
**Option 3**: Phone number lookup service integration
**Recommended**: Combination of Option 1 + Option 2

### Message Timing
- **Business Hours**: 9 AM - 7 PM (Arizona time)
- **Response Timeout**: 2 hours between questions
- **Reminder**: 1 reminder after 1 hour
- **Survey Window**: 7 days to complete

### Compliance Considerations
- SMS opt-in requirements
- TCPA compliance for business texting
- Customer data privacy (pet purchase history)
- Opt-out handling and respect

This requirements document provides the foundation for building Rita specifically for the pet store customer feedback use case.