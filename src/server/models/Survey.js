const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  businessType: {
    type: String,
    default: 'pet_store'
  },
  
  // Survey completion settings
  completionRules: {
    requireAllQuestions: {
      type: Boolean,
      default: true
    },
    allowPartialCompletion: {
      type: Boolean,
      default: false
    },
    minQuestionsRequired: {
      type: Number,
      default: 4
    }
  },
  
  // Thank you message and follow-up actions
  completionActions: {
    sendThankYou: {
      type: Boolean,
      default: true
    },
    thankYouMessage: {
      type: String,
      default: 'Thank you for your feedback! We appreciate your business and hope you and your new puppy are doing great! 🐶'
    },
    managerCallbackRequired: {
      type: String,
      enum: ['never', 'always', 'conditional'],
      default: 'conditional'
    },
    exportToCRM: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Survey', surveySchema);