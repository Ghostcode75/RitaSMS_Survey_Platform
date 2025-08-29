require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const connectDB = require('./config/database');
const SmsService = require('./services/SmsService');
const SurveyService = require('./services/SurveyService');
const CsvImporter = require('./utils/CsvImporter');

const app = express();

// Connect to database
let dbStatus = { connected: false };
connectDB().then(status => {
  dbStatus = status;
}).catch(err => {
  console.error('Database connection error:', err);
  dbStatus = { connected: false, error: err.message };
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../../dist')));

// Basic routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Rita SMS Survey Platform',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test Twilio connection
app.get('/api/test-sms', async (req, res) => {
  try {
    const result = await SmsService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send test SMS (only in development)
app.post('/api/send-test-sms', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ 
      error: 'Test SMS not available in production' 
    });
  }

  const { to, message } = req.body;
  
  if (!to || !message) {
    return res.status(400).json({ 
      error: 'Phone number (to) and message are required' 
    });
  }

  try {
    const result = await SmsService.sendSMS(to, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|text\/csv|application\/vnd.ms-excel/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// === CUSTOMER MANAGEMENT ROUTES ===

// Import CSV file
app.post('/api/customers/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided' });
    }

    const result = await CsvImporter.importFromFile(req.file.path);
    
    // Clean up uploaded file
    require('fs').unlinkSync(req.file.path);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Import CSV data (paste content)
app.post('/api/customers/import-data', async (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData) {
      return res.status(400).json({ error: 'No CSV data provided' });
    }

    const result = await CsvImporter.importFromData(csvData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all customers
app.get('/api/customers', (req, res) => {
  try {
    const result = CsvImporter.getCustomers();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get customers by status
app.get('/api/customers/status/:status', (req, res) => {
  try {
    const { status } = req.params;
    const customers = CsvImporter.getCustomersByStatus(status);
    res.json({ customers, count: customers.length });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update customer phone number
app.put('/api/customers/:id/phone', (req, res) => {
  try {
    const { id } = req.params;
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    const result = CsvImporter.updateCustomerPhone(id, phoneNumber);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Export customers to CSV
app.get('/api/customers/export', (req, res) => {
  try {
    const csv = CsvImporter.exportToCSV();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rita-customers.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Load sample data for testing
app.post('/api/customers/load-sample', async (req, res) => {
  try {
    const sampleCsvPath = path.join(__dirname, '../../sample-data/Survey email list.csv');
    
    if (require('fs').existsSync(sampleCsvPath)) {
      const result = await CsvImporter.importFromFile(sampleCsvPath);
      res.json({
        ...result,
        message: 'Sample data loaded successfully from Survey email list.csv'
      });
    } else {
      res.status(404).json({ 
        error: 'Sample data file not found',
        path: sampleCsvPath
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// === SURVEY MANAGEMENT ROUTES ===

// Start survey for a customer
app.post('/api/survey/start/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Find customer
    const customers = CsvImporter.getCustomers().customers;
    const customer = customers.find(c => c.id === customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (!customer.phoneNumber) {
      return res.status(400).json({ error: 'Customer needs phone number first' });
    }
    
    if (customer.surveyStarted && !customer.surveyCompleted) {
      return res.status(400).json({ error: 'Survey already in progress' });
    }
    
    const result = await SurveyService.startSurvey(customer);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Simulate incoming SMS response (for testing)
app.post('/api/survey/respond/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Find customer
    const customers = CsvImporter.getCustomers().customers;
    const customer = customers.find(c => c.id === customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (!customer.surveyStarted) {
      return res.status(400).json({ error: 'Survey not started for this customer' });
    }
    
    const result = await SurveyService.processResponse(customer, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get survey statistics
app.get('/api/survey/stats', (req, res) => {
  try {
    const customers = CsvImporter.getCustomers().customers;
    const stats = SurveyService.getSurveyStats(customers);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get survey questions
app.get('/api/survey/questions', (req, res) => {
  try {
    const questions = SurveyService.getSurveyQuestions();
    res.json({
      success: true,
      questions
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update a survey question
app.put('/api/survey/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const questionData = req.body;
    
    const result = SurveyService.updateSurveyQuestion(parseInt(id), questionData);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Add a new survey question
app.post('/api/survey/questions', (req, res) => {
  try {
    const questionData = req.body;
    
    const result = SurveyService.addSurveyQuestion(questionData);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete a survey question
app.delete('/api/survey/questions/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = SurveyService.deleteSurveyQuestion(parseInt(id));
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get customers who need manager callbacks
app.get('/api/survey/callbacks', (req, res) => {
  try {
    const customers = CsvImporter.getCustomers().customers;
    const callbacks = customers.filter(c => c.managerCallbackRequested);
    
    res.json({
      callbacks: callbacks.map(c => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phoneNumber: c.phoneNumber,
        petBreed: c.petBreed,
        storeLocation: c.storeLocation,
        salesAssociate: c.salesAssociate,
        callbackTopic: c.callbackTopic,
        satisfactionRating: c.satisfactionRating,
        npsScore: c.npsScore,
        requestedAt: c.surveyCompletedAt
      })),
      count: callbacks.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Webhook endpoint for Twilio (incoming SMS)
app.post('/api/webhooks/sms', async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;
    
    console.log(`📨 Incoming SMS from ${From}: ${Body}`);
    
    // Find customer by phone number
    const customers = CsvImporter.getCustomers().customers;
    const customer = customers.find(c => c.phoneNumber === From);
    
    if (!customer) {
      console.log(`⚠️  No customer found for phone number: ${From}`);
      // Could send a generic response or ignore
      return res.status(200).send('OK');
    }
    
    if (!customer.surveyStarted || customer.surveyCompleted) {
      console.log(`⚠️  No active survey for customer: ${customer.firstName} ${customer.lastName}`);
      return res.status(200).send('OK');
    }
    
    // Process the response
    const result = await SurveyService.processResponse(customer, Body);
    
    if (result.success) {
      console.log(`✅ Response processed for ${customer.firstName}: ${Body}`);
    } else {
      console.log(`❌ Error processing response: ${result.error}`);
    }
    
    // Respond to Twilio
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing SMS webhook:', error);
    res.status(500).send('Error');
  }
});

// Original route for testing
app.get('/api/getUsername', (req, res) => {
  res.json({ 
    username: require('os').userInfo().username,
    service: 'Rita SMS Survey Platform'
  });
});

// Catch all handler - MUST be the last route to serve the React app for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('🚀 Rita SMS Survey Platform');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📱 SMS Debug Mode: ${process.env.DEBUG_SMS === 'true' ? 'ON' : 'OFF'}`);
  console.log(`🏪 Business: ${process.env.BUSINESS_NAME || 'Not configured'}`);
  
  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.log('⚠️  Twilio not configured - SMS will be in debug mode');
    console.log('   Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env');
  } else {
    console.log('📞 Twilio configured - SMS ready');
  }
});
