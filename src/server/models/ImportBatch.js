const mongoose = require('mongoose');

const importBatchSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // File info
  filename: {
    type: String,
    required: true,
    trim: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileType: {
    type: String,
    enum: ['csv', 'xlsx', 'xls'],
    required: true
  },
  
  // Import results
  totalRows: {
    type: Number,
    default: 0
  },
  successfulImports: {
    type: Number,
    default: 0
  },
  failedImports: {
    type: Number,
    default: 0
  },
  duplicateEmails: {
    type: Number,
    default: 0
  },
  phoneNumbersNeeded: {
    type: Number,
    default: 0
  },
  
  // Validation errors
  validationErrors: [{
    row: Number,
    field: String,
    error: String,
    value: String
  }],
  
  // Processing status
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing'
  },
  processedAt: Date,
  
  // CSV column mapping (for Puppies N Love format)
  columnMapping: {
    email: {
      type: String,
      default: 'Email'
    },
    firstName: {
      type: String,
      default: 'FirstName'
    },
    lastName: {
      type: String,
      default: 'LastName'
    },
    petBreed: {
      type: String,
      default: 'CustomData1'
    },
    purchaseDate: {
      type: String,
      default: 'CustomData2'
    },
    salesAssociate: {
      type: String,
      default: 'CustomData3'
    },
    storeLocation: {
      type: String,
      default: 'CustomData4'
    }
  }
}, {
  timestamps: true
});

// Method to calculate success rate
importBatchSchema.virtual('successRate').get(function() {
  return this.totalRows > 0 ? (this.successfulImports / this.totalRows) * 100 : 0;
});

module.exports = mongoose.model('ImportBatch', importBatchSchema);