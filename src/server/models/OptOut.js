const mongoose = require('mongoose');

const optOutSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  
  // Opt-out details
  optOutKeyword: {
    type: String,
    trim: true,
    uppercase: true
  },
  optOutMessage: {
    type: String,
    trim: true
  },
  globalOptOut: {
    type: Boolean,
    default: false
  },
  
  // Recovery options
  optBackInAt: Date,
  optBackInMessage: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for uniqueness
optOutSchema.index({ phoneNumber: 1, campaignId: 1 }, { unique: true });

// Static method to check if phone number is opted out
optOutSchema.statics.isOptedOut = async function(phoneNumber, campaignId = null) {
  const query = { phoneNumber };
  
  // Check for global opt-out first
  const globalOptOut = await this.findOne({ 
    phoneNumber, 
    globalOptOut: true 
  });
  
  if (globalOptOut) return true;
  
  // Check for campaign-specific opt-out
  if (campaignId) {
    const campaignOptOut = await this.findOne({ phoneNumber, campaignId });
    return !!campaignOptOut;
  }
  
  return false;
};

module.exports = mongoose.model('OptOut', optOutSchema);