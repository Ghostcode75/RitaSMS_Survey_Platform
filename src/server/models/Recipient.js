const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  
  // Contact Information
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  
  // Pet Purchase Details (from CSV custom fields)
  petBreed: {
    type: String,
    trim: true
  },
  purchaseDate: {
    type: String,
    trim: true
  },
  salesAssociate: {
    type: String,
    trim: true
  },
  storeLocation: {
    type: String,
    trim: true
  },
  
  // Survey State
  status: {
    type: String,
    enum: ['pending', 'phone_needed', 'active', 'completed', 'opted_out', 'failed'],
    default: 'phone_needed'
  },
  currentQuestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  },
  currentQuestionOrder: {
    type: Number,
    default: 0
  },
  
  // Progress tracking
  questionsAnswered: {
    type: Number,
    default: 0
  },
  totalQuestions: {
    type: Number,
    default: 6
  },
  completionPercentage: {
    type: Number,
    default: 0
  },
  
  // Timing
  surveyStartedAt: Date,
  surveyCompletedAt: Date,
  lastMessageSentAt: Date,
  lastResponseReceivedAt: Date,
  nextMessageScheduledAt: Date,
  
  // Business-specific flags
  managerCallbackRequested: {
    type: Boolean,
    default: false
  },
  callbackTopic: {
    type: String,
    trim: true
  },
  npsScore: {
    type: Number,
    min: 0,
    max: 10
  },
  satisfactionRating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  // Import metadata
  importBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImportBatch'
  },
  importRowNumber: Number
}, {
  timestamps: true
});

// Indexes for performance
recipientSchema.index({ campaignId: 1, status: 1 });
recipientSchema.index({ phoneNumber: 1 });
recipientSchema.index({ nextMessageScheduledAt: 1 });

// Virtual for full name
recipientSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.email;
});

// Method to update progress
recipientSchema.methods.updateProgress = function() {
  this.completionPercentage = this.totalQuestions > 0 
    ? (this.questionsAnswered / this.totalQuestions) * 100 
    : 0;
};

module.exports = mongoose.model('Recipient', recipientSchema);