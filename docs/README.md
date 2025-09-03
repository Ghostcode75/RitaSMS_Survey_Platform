# 🐶 Rita SMS Survey Platform Documentation

**Complete Pet Store Customer Feedback System**

Rita is a comprehensive SMS survey platform designed for pet stores to collect customer feedback, manage surveys, and analyze NPS performance across their organization.

## Documentation Structure

### 📋 Planning (`/planning/`)
Project planning documents and requirements
- `project-outline.md` - Main project outline and roadmap

### 📈 Progress (`/progress/`)
Session logs and progress tracking
- `session-log.md` - Detailed log of work done in each session

### 🏗️ Architecture (`/architecture/`)
System design and architecture documentation
- Architecture diagrams
- Database schemas
- System flow documents

### 🔌 API (`/api/`)
API documentation and specifications
- Endpoint documentation
- Request/response examples
- Authentication specs

## How to Use This Documentation

1. **Before starting a session**: Check `progress/session-log.md` for the current status
2. **During planning**: Update documents in `planning/`
3. **During development**: Log progress in `progress/session-log.md`
4. **For reference**: Use `architecture/` and `api/` docs as needed

## ✅ Current Features (Fully Implemented)

### 📱 **SMS Survey System**
- End-to-end SMS surveys via Twilio integration
- 6-question pet store feedback survey
- Automatic phone number validation and management
- Real-time response processing with opt-out handling

### 👥 **Customer Management**
- CSV import with drag-and-drop file uploads
- Customer grouping by campaign/list name
- Phone number editing and management
- Customer status tracking and survey progress

### 📅 **Survey Scheduling**
- Schedule surveys by customer group
- Date and time picker for precise scheduling
- Upcoming and past survey schedule management
- Group-based campaign targeting

### 📊 **Advanced NPS Analytics**
- **3-Tier NPS Hierarchy**: Associate → Store → Company
- Individual sales associate NPS tracking
- Store-level NPS rollup with associate breakdowns
- Company-wide NPS calculation and display
- Proper NPS formula: % Promoters - % Detractors

### 🎨 **Modern Dashboard**
- Dogs Dashboard inspired design (warm, pet-friendly)
- Real-time analytics and performance metrics
- Interactive customer cards with detailed modals
- Survey questions management with CRUD operations

### 🔧 **Survey Management**
- Dynamic survey question editing
- Add/remove questions functionality
- Multiple question types (rating, NPS, multiple choice, open text)
- SMS message customization

## Quick Links
- [Project Outline](planning/project-outline.md)
- [Latest Session Log](progress/session-log.md)
- [Feature Specifications](planning/feature-specifications.md)

## 🚀 Getting Started
1. Install dependencies: `npm install`
2. Configure Twilio credentials in `.env`
3. Start server: `npm run server`
4. Build frontend: `npm run build`
5. Access at `http://localhost:3001`

---
*Last Updated: 2025-08-29*