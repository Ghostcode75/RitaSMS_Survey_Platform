# Rita - System Architecture

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   React Client  │◄──►│  Node.js API    │◄──►│    Database     │
│                 │    │                 │    │  (MongoDB/PG)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │                 │
                       │   Twilio SMS    │
                       │      API        │
                       │                 │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │                 │
                       │  SMS Recipients │
                       │                 │
                       └─────────────────┘
```

## Component Architecture

### Frontend (React)
```
src/client/
├── components/
│   ├── Auth/
│   │   ├── Login.js
│   │   ├── Register.js
│   │   └── ProtectedRoute.js
│   ├── Campaign/
│   │   ├── CampaignList.js
│   │   ├── CampaignBuilder.js
│   │   ├── CampaignDashboard.js
│   │   └── CampaignScheduler.js
│   ├── Survey/
│   │   ├── QuestionBuilder.js
│   │   ├── ResponseViewer.js
│   │   └── SurveyPreview.js
│   ├── Import/
│   │   ├── FileUpload.js
│   │   ├── ContactImporter.js
│   │   └── DataPreview.js
│   ├── Analytics/
│   │   ├── Dashboard.js
│   │   ├── ResponseChart.js
│   │   └── ExportData.js
│   └── Common/
│       ├── Header.js
│       ├── Sidebar.js
│       └── Loading.js
├── hooks/
│   ├── useAuth.js
│   ├── useCampaigns.js
│   └── useWebSocket.js
├── services/
│   ├── api.js
│   ├── auth.js
│   └── websocket.js
├── context/
│   ├── AuthContext.js
│   └── CampaignContext.js
└── utils/
    ├── validation.js
    ├── formatters.js
    └── constants.js
```

### Backend (Node.js/Express)
```
src/server/
├── routes/
│   ├── auth.js
│   ├── campaigns.js
│   ├── surveys.js
│   ├── responses.js
│   ├── imports.js
│   └── webhooks.js
├── controllers/
│   ├── AuthController.js
│   ├── CampaignController.js
│   ├── SurveyController.js
│   ├── ResponseController.js
│   └── WebhookController.js
├── models/
│   ├── User.js
│   ├── Campaign.js
│   ├── Survey.js
│   ├── Question.js
│   ├── Recipient.js
│   ├── Response.js
│   └── OptOut.js
├── services/
│   ├── SmsService.js
│   ├── SchedulerService.js
│   ├── ImportService.js
│   ├── ExportService.js
│   └── AnalyticsService.js
├── middleware/
│   ├── auth.js
│   ├── validation.js
│   ├── rateLimiting.js
│   └── errorHandler.js
├── utils/
│   ├── database.js
│   ├── encryption.js
│   └── logger.js
└── jobs/
    ├── campaignScheduler.js
    ├── responseTimeout.js
    └── dataCleanup.js
```

## Data Flow

### Campaign Creation Flow
1. User creates campaign in React UI
2. Frontend validates and sends to API
3. Backend stores campaign and questions
4. User imports recipients via CSV/Excel
5. Backend processes and validates contacts
6. Campaign ready for scheduling

### SMS Survey Flow
1. Scheduler triggers campaign launch
2. SMS Service sends first question to all recipients
3. Recipients reply via SMS
4. Twilio webhook receives responses
5. Backend processes and stores responses
6. Next question sent or survey completed
7. Real-time updates sent to dashboard

### Response Processing Flow
```
SMS Response → Twilio → Webhook → Response Parser → Database
                                       │
                                       ▼
                              State Machine → Next Question
                                       │
                                       ▼
                               SMS Service → Twilio → Recipient
```

## Database Design

### Core Tables/Collections

#### Users
- id, email, password_hash, created_at, updated_at
- role, organization_id, settings

#### Campaigns
- id, user_id, name, description, status
- scheduled_at, launched_at, completed_at
- settings (timeout, reminders, etc.)

#### Surveys
- id, campaign_id, name, questions[]
- flow_logic, completion_rules

#### Questions
- id, survey_id, text, type, order
- options[], validation_rules

#### Recipients
- id, campaign_id, phone_number, first_name
- status, current_question_id, opt_out_status

#### Responses
- id, recipient_id, question_id, answer
- timestamp, message_id, is_valid

#### OptOuts
- phone_number, opt_out_date, campaign_id
- global_opt_out, reason

## External Integrations

### Twilio SMS API
- **Send SMS**: POST to Twilio messaging service
- **Receive SMS**: Webhook endpoint for incoming messages
- **Message Status**: Delivery and read receipts
- **Phone Validation**: Number verification service

### File Processing
- **CSV Parser**: Papa Parse library
- **Excel Parser**: SheetJS/ExcelJS
- **Validation**: Phone number and data format checking

### Scheduling System
- **Node-cron**: Time-based campaign triggering
- **Job Queue**: Bull/Agenda for background processing
- **Retry Logic**: Failed message handling

## Security Architecture

### Authentication & Authorization
- JWT tokens for API authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Session management and refresh tokens

### Data Protection
- Encryption at rest for sensitive data
- HTTPS/TLS for all communications
- Input validation and sanitization
- SQL injection prevention

### SMS Security
- Webhook signature verification
- Rate limiting on endpoints
- Opt-out compliance
- Message content filtering

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- Database connection pooling
- Load balancing capability
- Microservices architecture ready

### Performance Optimization
- Database indexing strategy
- Caching layer (Redis)
- Message queuing for SMS
- CDN for static assets

### Monitoring & Logging
- Application performance monitoring
- SMS delivery tracking
- Error logging and alerting
- Usage analytics and reporting

## Development Environment

### Local Setup
```
Rita/
├── docker-compose.yml     # Local development stack
├── .env.example          # Environment variables template
└── scripts/
    ├── setup.sh         # Initial setup script
    └── seed-data.js     # Sample data for development
```

### Infrastructure
- **Database**: MongoDB Atlas or PostgreSQL
- **SMS**: Twilio account with phone number
- **Hosting**: AWS/Heroku/DigitalOcean
- **CDN**: CloudFront or similar
- **Monitoring**: DataDog/New Relic

## API Design

### RESTful Endpoints
```
Authentication:
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh

Campaigns:
GET    /api/campaigns
POST   /api/campaigns
GET    /api/campaigns/:id
PUT    /api/campaigns/:id
DELETE /api/campaigns/:id

Surveys:
POST   /api/campaigns/:id/surveys
GET    /api/surveys/:id
PUT    /api/surveys/:id

Recipients:
POST   /api/campaigns/:id/recipients/import
GET    /api/campaigns/:id/recipients
POST   /api/campaigns/:id/recipients

Responses:
GET    /api/campaigns/:id/responses
GET    /api/surveys/:id/responses
POST   /api/campaigns/:id/export

Webhooks:
POST   /api/webhooks/sms          # Twilio webhook
POST   /api/webhooks/delivery     # Delivery status
```

### WebSocket Events
```
Connection: /ws/campaigns/:id

Events:
- response_received
- campaign_status_changed
- survey_completed
- error_occurred
```

This architecture provides a solid foundation for Rita's SMS survey platform with room for growth and enhancement.