const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'failed'],
    default: 'draft'
  },
  
  // Scheduling
  scheduledAt: {
    type: Date
  },
  launchedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  timezone: {
    type: String,
    default: 'America/Phoenix'
  },
  
  // Settings
  settings: {
    responseTimeout: {
      type: Number,
      default: 120 // minutes
    },
    reminderEnabled: {
      type: Boolean,
      default: true
    },
    reminderDelay: {
      type: Number,
      default: 60 // minutes
    },
    maxReminders: {
      type: Number,
      default: 1
    },
    autoEndAfter: {
      type: Number,
      default: 7 // days
    },
    businessHoursOnly: {
      type: Boolean,
      default: true
    },
    businessHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '19:00'
      }
    }
  },
  
  // Statistics (updated in real-time)
  stats: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    messagesSent: {
      type: Number,
      default: 0
    },
    responsesReceived: {
      type: Number,
      default: 0
    },
    optOuts: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    },
    averageNPS: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Calculate completion rate
campaignSchema.methods.updateStats = async function() {
  const Recipient = mongoose.model('Recipient');
  const Response = mongoose.model('Response');
  
  const recipients = await Recipient.countDocuments({ campaignId: this._id });
  const completed = await Recipient.countDocuments({ 
    campaignId: this._id, 
    status: 'completed' 
  });
  const responses = await Response.countDocuments({ campaignId: this._id });
  
  this.stats.totalRecipients = recipients;
  this.stats.responsesReceived = responses;
  this.stats.completionRate = recipients > 0 ? (completed / recipients) * 100 : 0;
  
  await this.save();
};

module.exports = mongoose.model('Campaign', campaignSchema);