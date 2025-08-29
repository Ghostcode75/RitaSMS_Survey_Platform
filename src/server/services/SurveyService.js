const SmsService = require('./SmsService');

class SurveyService {
  constructor() {
    // Load the Puppies N Love 6-question survey
    this.surveyQuestions = this.loadPuppiesNLoveSurvey();
  }

  loadPuppiesNLoveSurvey() {
    return [
      {
        id: 1,
        type: 'rating',
        text: 'Please rate your overall experience purchasing your puppy on a scale of 1-5 stars',
        smsText: 'Hi! Please rate your overall experience purchasing your puppy from Puppies N Love. Reply with 1-5 (5 being the best).',
        validation: { min: 1, max: 5, required: true },
        helpText: '1=Poor, 2=Fair, 3=Good, 4=Very Good, 5=Excellent'
      },
      {
        id: 2,
        type: 'multiple_choice',
        text: 'In what areas could we have improved your experience the most?',
        smsText: 'What could we improve? Reply A, B, C, D, or E:\\nA) Pet specialist experience\\nB) Puppy health\\nC) Paperwork process\\nD) Everything was great!\\nE) Other',
        options: [
          'Experience with pet specialist',
          'Health of your puppy', 
          'The paperwork process',
          'Everything was great!',
          'Other (please specify)'
        ],
        validation: { required: true }
      },
      {
        id: 3,
        type: 'multiple_choice',
        text: 'Have you received a follow up call from your pet specialist?',
        smsText: 'Have you received a follow-up call from your pet specialist? Reply:\\nA) Yes, we spoke\\nB) Yes, left message\\nC) No follow-up yet',
        options: [
          'Yes, and I have spoken with my pet specialist',
          'Yes, but they left a message and we haven\'t spoken yet', 
          'No, there has been no follow up call or message left'
        ],
        validation: { required: true }
      },
      {
        id: 4,
        type: 'nps_scale',
        text: 'How likely would you recommend us to a friend? (Net Promoter Score)',
        smsText: 'On a scale of 0-10, how likely would you recommend Puppies N Love to a friend or colleague? (0=Not likely, 10=Extremely likely)',
        validation: { min: 0, max: 10, required: true },
        helpText: '0-6=Detractor, 7-8=Passive, 9-10=Promoter'
      },
      {
        id: 5,
        type: 'open_text',
        text: 'Is there anything that would have made your experience with us better?',
        smsText: 'Is there anything that would have made your experience with us better? Please share your thoughts or reply NONE if no suggestions.',
        validation: { maxLength: 320, required: false }
      },
      {
        id: 6,
        type: 'yes_no_with_text',
        text: 'Would you like the store manager to call and follow up with you personally?',
        smsText: 'Would you like the store manager to call you personally? Reply:\\nA) No thanks, I\'m set!\\nB) Yes, please call me\\n\\nIf B, please briefly describe the topic.',
        validation: { required: true },
        followUpRequired: true
      }
    ];
  }

  async startSurvey(customer) {
    try {
      // Update customer status
      customer.surveyStarted = true;
      customer.currentQuestionId = 1;
      customer.surveyStartedAt = new Date();
      customer.status = 'active';

      // Send first question
      const firstQuestion = this.surveyQuestions[0];
      const result = await SmsService.sendSurveyQuestion(customer, firstQuestion, 1, 6);
      
      if (result.success) {
        console.log(`📋 Survey started for ${customer.firstName} ${customer.lastName} (${customer.email})`);
        return {
          success: true,
          messageId: result.messageId,
          nextQuestionId: 1,
          customer
        };
      } else {
        return {
          success: false,
          error: result.error,
          customer
        };
      }
    } catch (error) {
      console.error('Error starting survey:', error);
      return {
        success: false,
        error: error.message,
        customer
      };
    }
  }

  async processResponse(customer, incomingMessage) {
    try {
      const currentQuestion = this.surveyQuestions.find(q => q.id === customer.currentQuestionId);
      
      if (!currentQuestion) {
        return {
          success: false,
          error: 'No current question found',
          customer
        };
      }

      // Parse the response
      const parsedResponse = SmsService.parseIncomingResponse(incomingMessage, currentQuestion.type);
      
      // Handle opt-out
      if (parsedResponse.type === 'opt_out') {
        return await this.handleOptOut(customer, parsedResponse);
      }

      // Validate response
      if (!parsedResponse.valid) {
        // Send help message
        await SmsService.sendSMS(
          customer.phoneNumber, 
          `${parsedResponse.error}. ${currentQuestion.helpText || 'Please try again.'}`
        );
        return {
          success: false,
          error: parsedResponse.error,
          retry: true,
          customer
        };
      }

      // Store the response
      const response = {
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        rawAnswer: incomingMessage,
        processedAnswer: parsedResponse.value,
        answeredAt: new Date(),
        valid: true
      };

      customer.responses.push(response);

      // Update customer data based on response type
      this.updateCustomerFromResponse(customer, currentQuestion, parsedResponse);

      // Move to next question or complete survey
      return await this.moveToNextQuestion(customer);

    } catch (error) {
      console.error('Error processing response:', error);
      return {
        success: false,
        error: error.message,
        customer
      };
    }
  }

  updateCustomerFromResponse(customer, question, response) {
    switch (question.id) {
      case 1: // Overall rating
        customer.satisfactionRating = parseInt(response.value);
        break;
      case 4: // NPS score
        customer.npsScore = parseInt(response.value);
        break;
      case 6: // Manager callback
        if (response.value === 'B' || response.value.toUpperCase().includes('YES')) {
          customer.managerCallbackRequested = true;
          // If there's additional text, store it as callback topic
          const parts = response.originalMessage.split('\n');
          if (parts.length > 1) {
            customer.callbackTopic = parts.slice(1).join(' ').trim();
          }
        }
        break;
    }
  }

  async moveToNextQuestion(customer) {
    const nextQuestionId = customer.currentQuestionId + 1;
    
    if (nextQuestionId > this.surveyQuestions.length) {
      // Survey completed
      return await this.completeSurvey(customer);
    }

    // Send next question
    customer.currentQuestionId = nextQuestionId;
    customer.questionsAnswered = customer.responses.length;
    customer.completionPercentage = (customer.questionsAnswered / this.surveyQuestions.length) * 100;

    const nextQuestion = this.surveyQuestions[nextQuestionId - 1];
    const result = await SmsService.sendSurveyQuestion(customer, nextQuestion, nextQuestionId, 6);

    if (result.success) {
      return {
        success: true,
        messageId: result.messageId,
        nextQuestionId,
        progress: customer.completionPercentage,
        customer
      };
    } else {
      return {
        success: false,
        error: result.error,
        customer
      };
    }
  }

  async completeSurvey(customer) {
    try {
      customer.surveyCompleted = true;
      customer.surveyCompletedAt = new Date();
      customer.status = 'completed';
      customer.completionPercentage = 100;
      customer.questionsAnswered = this.surveyQuestions.length;

      // Send thank you message
      await SmsService.sendThankYouMessage(customer);

      // Send manager callback confirmation if requested
      if (customer.managerCallbackRequested) {
        const topic = customer.callbackTopic || 'general feedback';
        await SmsService.sendManagerCallbackConfirmation(customer, topic);
      }

      console.log(`✅ Survey completed for ${customer.firstName} ${customer.lastName}`);
      console.log(`   Rating: ${customer.satisfactionRating}/5, NPS: ${customer.npsScore}/10`);
      console.log(`   Manager callback: ${customer.managerCallbackRequested ? 'Yes' : 'No'}`);

      return {
        success: true,
        completed: true,
        stats: {
          rating: customer.satisfactionRating,
          npsScore: customer.npsScore,
          managerCallbackRequested: customer.managerCallbackRequested,
          callbackTopic: customer.callbackTopic,
          completionTime: new Date() - customer.surveyStartedAt
        },
        customer
      };
    } catch (error) {
      console.error('Error completing survey:', error);
      return {
        success: false,
        error: error.message,
        customer
      };
    }
  }

  async handleOptOut(customer, optOutResponse) {
    try {
      customer.status = 'opted_out';
      customer.optOutAt = new Date();
      customer.optOutKeyword = optOutResponse.keyword;

      // Send opt-out confirmation
      await SmsService.sendSMS(
        customer.phoneNumber,
        'You have been opted out of surveys from Puppies N Love. Thank you for your time.'
      );

      console.log(`⛔ Customer opted out: ${customer.firstName} ${customer.lastName} (${optOutResponse.keyword})`);

      return {
        success: true,
        optedOut: true,
        keyword: optOutResponse.keyword,
        customer
      };
    } catch (error) {
      console.error('Error handling opt-out:', error);
      return {
        success: false,
        error: error.message,
        customer
      };
    }
  }

  // Get survey analytics
  getSurveyStats(customers) {
    const completed = customers.filter(c => c.surveyCompleted);
    const total = customers.length;

    if (completed.length === 0) {
      return {
        totalCustomers: total,
        completedSurveys: 0,
        completionRate: 0,
        averageRating: 0,
        averageNPS: 0,
        npsBreakdown: {
          promoters: 0,
          passives: 0,
          detractors: 0
        },
        managerCallbacks: 0,
        optOuts: customers.filter(c => c.status === 'opted_out').length,
        byStore: {},
        byAssociate: {}
      };
    }

    const ratings = completed.filter(c => c.satisfactionRating).map(c => c.satisfactionRating);
    const npsScores = completed.filter(c => c.npsScore !== undefined).map(c => c.npsScore);
    
    // Calculate company-wide NPS
    const companyNPS = this.calculateNPS(npsScores);
    
    return {
      totalCustomers: total,
      completedSurveys: completed.length,
      completionRate: (completed.length / total) * 100,
      averageRating: ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 0,
      averageNPS: npsScores.length > 0 ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1) : 0,
      companyNPS: companyNPS,
      npsBreakdown: {
        promoters: npsScores.filter(score => score >= 9).length,
        passives: npsScores.filter(score => score >= 7 && score <= 8).length,
        detractors: npsScores.filter(score => score <= 6).length
      },
      managerCallbacks: completed.filter(c => c.managerCallbackRequested).length,
      optOuts: customers.filter(c => c.status === 'opted_out').length,
      byStore: this.getStoreStats(completed),
      byAssociate: this.getAssociateStats(completed)
    };
  }

  getStoreStats(customers) {
    const stores = {};
    customers.forEach(customer => {
      const store = customer.storeLocation || 'Unknown';
      if (!stores[store]) {
        stores[store] = { 
          count: 0, 
          totalRating: 0, 
          totalNPS: 0, 
          validRatings: 0, 
          validNPS: 0,
          npsScores: [],
          associates: {}
        };
      }
      stores[store].count++;
      
      if (customer.satisfactionRating) {
        stores[store].totalRating += customer.satisfactionRating;
        stores[store].validRatings++;
      }
      
      if (customer.npsScore !== undefined) {
        stores[store].totalNPS += customer.npsScore;
        stores[store].validNPS++;
        stores[store].npsScores.push(customer.npsScore);
      }
      
      // Track associates within each store
      const associate = customer.salesAssociate || 'Unknown';
      if (!stores[store].associates[associate]) {
        stores[store].associates[associate] = {
          count: 0,
          totalRating: 0,
          totalNPS: 0,
          validRatings: 0,
          validNPS: 0,
          npsScores: []
        };
      }
      
      stores[store].associates[associate].count++;
      if (customer.satisfactionRating) {
        stores[store].associates[associate].totalRating += customer.satisfactionRating;
        stores[store].associates[associate].validRatings++;
      }
      if (customer.npsScore !== undefined) {
        stores[store].associates[associate].totalNPS += customer.npsScore;
        stores[store].associates[associate].validNPS++;
        stores[store].associates[associate].npsScores.push(customer.npsScore);
      }
    });

    // Calculate NPS for stores and their associates
    Object.keys(stores).forEach(store => {
      const data = stores[store];
      data.avgRating = data.validRatings > 0 ? (data.totalRating / data.validRatings).toFixed(1) : 0;
      data.avgNPS = data.validNPS > 0 ? (data.totalNPS / data.validNPS).toFixed(1) : 0;
      data.storeNPS = this.calculateNPS(data.npsScores);
      
      // Calculate NPS for each associate in the store
      Object.keys(data.associates).forEach(associate => {
        const assocData = data.associates[associate];
        assocData.avgRating = assocData.validRatings > 0 ? (assocData.totalRating / assocData.validRatings).toFixed(1) : 0;
        assocData.avgNPS = assocData.validNPS > 0 ? (assocData.totalNPS / assocData.validNPS).toFixed(1) : 0;
        assocData.associateNPS = this.calculateNPS(assocData.npsScores);
      });
    });

    return stores;
  }

  getAssociateStats(customers) {
    const associates = {};
    customers.forEach(customer => {
      const associate = customer.salesAssociate || 'Unknown';
      if (!associates[associate]) {
        associates[associate] = { 
          count: 0, 
          totalRating: 0, 
          totalNPS: 0, 
          validRatings: 0, 
          validNPS: 0,
          npsScores: [],
          storeLocation: customer.storeLocation || 'Unknown'
        };
      }
      associates[associate].count++;
      if (customer.satisfactionRating) {
        associates[associate].totalRating += customer.satisfactionRating;
        associates[associate].validRatings++;
      }
      if (customer.npsScore !== undefined) {
        associates[associate].totalNPS += customer.npsScore;
        associates[associate].validNPS++;
        associates[associate].npsScores.push(customer.npsScore);
      }
    });

    Object.keys(associates).forEach(associate => {
      const data = associates[associate];
      data.avgRating = data.validRatings > 0 ? (data.totalRating / data.validRatings).toFixed(1) : 0;
      data.avgNPS = data.validNPS > 0 ? (data.totalNPS / data.validNPS).toFixed(1) : 0;
      data.associateNPS = this.calculateNPS(data.npsScores);
    });

    return associates;
  }

  // Calculate proper NPS score: % Promoters - % Detractors
  calculateNPS(scores) {
    if (!scores || scores.length === 0) return 0;
    
    const promoters = scores.filter(score => score >= 9).length;
    const detractors = scores.filter(score => score <= 6).length;
    const total = scores.length;
    
    const promoterPercentage = (promoters / total) * 100;
    const detractorPercentage = (detractors / total) * 100;
    
    return Math.round(promoterPercentage - detractorPercentage);
  }

  getSurveyQuestions() {
    return this.surveyQuestions;
  }

  updateSurveyQuestion(questionId, questionData) {
    try {
      const questionIndex = this.surveyQuestions.findIndex(q => q.id === questionId);
      
      if (questionIndex === -1) {
        return {
          success: false,
          error: 'Question not found'
        };
      }

      // Update the question while preserving the ID
      this.surveyQuestions[questionIndex] = {
        ...this.surveyQuestions[questionIndex],
        ...questionData,
        id: questionId // Ensure ID doesn't change
      };

      return {
        success: true,
        question: this.surveyQuestions[questionIndex],
        message: 'Question updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  addSurveyQuestion(questionData) {
    try {
      // Generate new ID (highest current ID + 1)
      const maxId = Math.max(...this.surveyQuestions.map(q => q.id));
      const newId = maxId + 1;

      // Default question template
      const defaultQuestion = {
        id: newId,
        type: 'open_text',
        text: 'Enter your question here',
        smsText: 'Enter your SMS message here',
        validation: {
          required: true,
          maxLength: 160
        }
      };

      // Merge with provided data
      const newQuestion = {
        ...defaultQuestion,
        ...questionData,
        id: newId // Always use the generated ID
      };

      // Add to questions array
      this.surveyQuestions.push(newQuestion);

      return {
        success: true,
        question: newQuestion,
        message: 'Question added successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  deleteSurveyQuestion(questionId) {
    try {
      const questionIndex = this.surveyQuestions.findIndex(q => q.id === questionId);
      
      if (questionIndex === -1) {
        return {
          success: false,
          error: 'Question not found'
        };
      }

      // Don't allow deletion if it's the only question
      if (this.surveyQuestions.length === 1) {
        return {
          success: false,
          error: 'Cannot delete the only question. Survey must have at least one question.'
        };
      }

      // Remove the question
      const deletedQuestion = this.surveyQuestions.splice(questionIndex, 1)[0];

      return {
        success: true,
        question: deletedQuestion,
        message: 'Question deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new SurveyService();