const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  surveyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['rating', 'multiple_choice', 'nps_scale', 'open_text', 'yes_no', 'yes_no_with_text'],
    required: true
  },
  order: {
    type: Number,
    required: true
  },
  
  // Question-specific settings
  options: [{
    type: String,
    trim: true
  }],
  
  validation: {
    required: {
      type: Boolean,
      default: true
    },
    minLength: Number,
    maxLength: Number,
    minValue: Number,
    maxValue: Number,
    allowMultiple: {
      type: Boolean,
      default: false
    }
  },
  
  // SMS formatting
  smsText: {
    type: String,
    required: true,
    trim: true
  },
  helpText: {
    type: String,
    trim: true
  },
  
  // Follow-up configuration
  followUpRequired: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Create index for efficient querying
questionSchema.index({ surveyId: 1, order: 1 });

module.exports = mongoose.model('Question', questionSchema);