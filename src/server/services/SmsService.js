const twilio = require('twilio');

class SmsService {
  constructor() {
    // Check if credentials are properly configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken || 
        accountSid === 'your_twilio_account_sid_here' || 
        authToken === 'your_twilio_auth_token_here' ||
        !accountSid.startsWith('AC')) {
      console.warn('⚠️  Twilio credentials not configured. SMS functionality will be in debug mode.');
      this.client = null;
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';
      this.debugMode = true;
      return;
    }

    try {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
      this.debugMode = process.env.DEBUG_SMS === 'true';
      console.log('📞 Twilio client initialized successfully');
    } catch (error) {
      console.warn('⚠️  Twilio initialization failed:', error.message);
      this.client = null;
      this.debugMode = true;
    }
  }

  async sendSMS(to, message, options = {}) {
    if (!this.client) {
      console.log('📱 SMS Debug Mode - Would send:', { to, message });
      return { 
        success: false, 
        error: 'Twilio not configured',
        debugMessage: { to, message }
      };
    }

    try {
      if (this.debugMode) {
        console.log('📱 Sending SMS:', { to, from: this.fromNumber, message });
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
        ...options
      });

      if (this.debugMode) {
        console.log('✅ SMS sent successfully:', result.sid);
      }

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        to: result.to,
        from: result.from
      };

    } catch (error) {
      console.error('❌ SMS sending failed:', error.message);
      
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  async sendSurveyQuestion(recipient, question, questionNumber = 1, totalQuestions = 6) {
    const message = this.formatSurveyMessage(
      recipient, 
      question, 
      questionNumber, 
      totalQuestions
    );
    
    return await this.sendSMS(recipient.phoneNumber, message);
  }

  formatSurveyMessage(recipient, question, questionNumber, totalQuestions) {
    let message = '';
    
    // First question gets a greeting
    if (questionNumber === 1) {
      const petInfo = recipient.petBreed ? ` your ${recipient.petBreed}` : ' your new puppy';
      message += `Hi ${recipient.firstName || 'there'}! Thanks for purchasing${petInfo} from ${process.env.BUSINESS_NAME || 'us'}. We'd love your feedback!\n\n`;
    }
    
    // Question with progress
    message += `Q${questionNumber}/${totalQuestions}: ${question.smsText}`;
    
    // Add opt-out info for first question
    if (questionNumber === 1 && !question.smsText.includes('STOP')) {
      message += '\n\nReply STOP to opt out anytime.';
    }
    
    return message;
  }

  async sendThankYouMessage(recipient, customMessage = null) {
    const defaultMessage = "Thank you for your feedback! We appreciate your business and hope you and your new puppy are doing great! 🐶";
    const message = customMessage || defaultMessage;
    
    return await this.sendSMS(recipient.phoneNumber, message);
  }

  async sendManagerCallbackConfirmation(recipient, topic) {
    const message = `Thanks for requesting a manager follow-up! Our store manager will call you within 24 hours regarding: ${topic}`;
    
    return await this.sendSMS(recipient.phoneNumber, message);
  }

  // Test method to verify Twilio connection
  async testConnection() {
    if (!this.client) {
      return {
        success: false,
        error: 'Twilio client not initialized. Check your credentials in .env file.',
        instructions: [
          '1. Sign up at https://twilio.com',
          '2. Get your Account SID and Auth Token from the Console',
          '3. Purchase a phone number',
          '4. Update your .env file with the credentials'
        ]
      };
    }

    try {
      // Test by getting account info
      const account = await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      
      return {
        success: true,
        accountSid: account.sid,
        accountStatus: account.status,
        fromNumber: this.fromNumber,
        message: 'Twilio connection successful! Ready to send SMS.'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  // Process incoming SMS responses
  parseIncomingResponse(messageBody, questionType) {
    const cleanMessage = messageBody.trim().toUpperCase();
    
    // Check for opt-out keywords
    const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'QUIT', 'END', 'CANCEL'];
    if (optOutKeywords.some(keyword => cleanMessage.includes(keyword))) {
      return {
        type: 'opt_out',
        keyword: optOutKeywords.find(keyword => cleanMessage.includes(keyword)),
        originalMessage: messageBody
      };
    }
    
    // Parse based on question type
    switch (questionType) {
      case 'rating':
        return this.parseRatingResponse(cleanMessage, messageBody);
      case 'multiple_choice':
        return this.parseMultipleChoiceResponse(cleanMessage, messageBody);
      case 'nps_scale':
        return this.parseNPSResponse(cleanMessage, messageBody);
      case 'yes_no':
      case 'yes_no_with_text':
        return this.parseYesNoResponse(cleanMessage, messageBody);
      case 'open_text':
        return this.parseTextResponse(messageBody);
      default:
        return {
          type: 'unknown',
          value: messageBody,
          valid: false,
          error: 'Unknown question type'
        };
    }
  }

  parseRatingResponse(cleanMessage, originalMessage) {
    const rating = parseInt(cleanMessage);
    if (rating >= 1 && rating <= 5) {
      return {
        type: 'rating',
        value: rating,
        valid: true,
        originalMessage
      };
    }
    return {
      type: 'rating',
      value: originalMessage,
      valid: false,
      error: 'Please reply with a number from 1-5'
    };
  }

  parseMultipleChoiceResponse(cleanMessage, originalMessage) {
    // Accept A, B, C, D, E format
    const match = cleanMessage.match(/^([A-E])$/);
    if (match) {
      return {
        type: 'multiple_choice',
        value: match[1],
        valid: true,
        originalMessage
      };
    }
    return {
      type: 'multiple_choice',
      value: originalMessage,
      valid: false,
      error: 'Please reply with A, B, C, D, or E'
    };
  }

  parseNPSResponse(cleanMessage, originalMessage) {
    const score = parseInt(cleanMessage);
    if (score >= 0 && score <= 10) {
      return {
        type: 'nps',
        value: score,
        valid: true,
        originalMessage
      };
    }
    return {
      type: 'nps',
      value: originalMessage,
      valid: false,
      error: 'Please reply with a number from 0-10'
    };
  }

  parseYesNoResponse(cleanMessage, originalMessage) {
    if (['A', 'YES', 'Y', 'NO', 'N', 'B'].includes(cleanMessage)) {
      return {
        type: 'yes_no',
        value: cleanMessage,
        valid: true,
        originalMessage
      };
    }
    return {
      type: 'yes_no',
      value: originalMessage,
      valid: false,
      error: 'Please reply with A, B, YES, or NO'
    };
  }

  parseTextResponse(originalMessage) {
    if (originalMessage.trim().length > 0) {
      return {
        type: 'text',
        value: originalMessage.trim(),
        valid: true,
        originalMessage
      };
    }
    return {
      type: 'text',
      value: originalMessage,
      valid: false,
      error: 'Please provide a response'
    };
  }
}

module.exports = new SmsService();