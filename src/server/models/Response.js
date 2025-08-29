const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipient',
    required: true
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  
  // Response data
  rawMessage: {
    type: String,
    required: true,
    trim: true
  },
  processedAnswer: {
    type: String,
    trim: true
  },
  answerValue: {
    // Flexible object for structured data
    type: mongoose.Schema.Types.Mixed
  },
  
  // Validation
  isValid: {
    type: Boolean,
    default: true
  },
  validationErrors: [{
    type: String
  }],
  
  // SMS metadata
  twilioMessageId: {
    type: String,
    trim: true
  },
  fromPhone: {
    type: String,
    trim: true
  },
  toPhone: {
    type: String,
    trim: true
  },
  
  // Timing
  questionSentAt: Date,
  responseReceivedAt: {
    type: Date,
    default: Date.now
  },
  processingTime: {
    type: Number // milliseconds
  }
}, {
  timestamps: true
});

// Indexes for performance
responseSchema.index({ recipientId: 1, createdAt: 1 });
responseSchema.index({ campaignId: 1, questionId: 1 });
responseSchema.index({ twilioMessageId: 1 });

module.exports = mongoose.model('Response', responseSchema);