import React, { Component } from 'react';
import './app.css';

export default class App extends Component {
  state = {
    customers: [],
    stats: null,
    loading: true,
    activeTab: 'dashboard',
    selectedCustomer: null,
    showCustomerModal: false,
    editingPhone: false,
    phoneInput: '',
    surveyQuestions: [],
    editingQuestionId: null,
    showQuestionModal: false,
    selectedQuestion: null,
    showUploadModal: false,
    uploadGroupName: '',
    uploadFile: null,
    uploading: false,
    customerGroups: {},
    scheduledSurveys: [],
    showScheduleModal: false,
    selectedGroup: '',
    scheduledDate: '',
    scheduledTime: '',
    mobileMenuOpen: false
  };

  componentDidMount() {
    this.loadData();
    this.loadSurveyQuestions();
    this.loadScheduledSurveys();
  }

  toggleMobileMenu = () => {
    this.setState(prevState => ({
      mobileMenuOpen: !prevState.mobileMenuOpen
    }));
  }

  closeMobileMenu = () => {
    this.setState({ mobileMenuOpen: false });
  }

  handleTabChange = (tab) => {
    this.setState({ 
      activeTab: tab,
      mobileMenuOpen: false // Close mobile menu when tab changes
    });
  }

  loadData = async () => {
    try {
      const [customersResponse, statsResponse] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/survey/stats')
      ]);
      
      const customers = await customersResponse.json();
      const stats = await statsResponse.json();
      
      // Group customers by their group/campaign name
      const customerGroups = {};
      if (customers.customers) {
        customers.customers.forEach(customer => {
          const groupName = customer.groupName || 'Default Group';
          if (!customerGroups[groupName]) {
            customerGroups[groupName] = [];
          }
          customerGroups[groupName].push(customer);
        });
      }
      
      this.setState({
        customers: customers.customers || [],
        customerGroups,
        stats,
        loading: false
      });
    } catch (error) {
      console.error('Error loading data:', error);
      this.setState({ loading: false });
    }
  };

  loadSampleData = async () => {
    try {
      await fetch('/api/customers/load-sample', { method: 'POST' });
      this.loadData();
    } catch (error) {
      console.error('Error loading sample data:', error);
    }
  };

  startSurvey = async (customerId) => {
    try {
      const response = await fetch(`/api/survey/start/${customerId}`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        alert(`Survey started for customer! SMS sent with ID: ${result.messageId}`);
        this.loadData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error starting survey:', error);
    }
  };

  openCustomerModal = (customer) => {
    this.setState({
      selectedCustomer: customer,
      showCustomerModal: true,
      phoneInput: customer.phoneNumber || ''
    });
  };

  closeCustomerModal = () => {
    this.setState({
      selectedCustomer: null,
      showCustomerModal: false,
      editingPhone: false,
      phoneInput: ''
    });
  };

  startEditingPhone = () => {
    this.setState({ editingPhone: true });
  };

  cancelEditingPhone = () => {
    const { selectedCustomer } = this.state;
    this.setState({
      editingPhone: false,
      phoneInput: selectedCustomer?.phoneNumber || ''
    });
  };

  updatePhoneNumber = async () => {
    const { selectedCustomer, phoneInput } = this.state;
    
    if (!phoneInput.trim()) {
      alert('Phone number cannot be empty');
      return;
    }

    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}/phone`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: phoneInput })
      });

      const result = await response.json();

      if (result.success) {
        this.setState({ editingPhone: false });
        this.loadData();
        // Update selected customer
        const updatedCustomer = { ...selectedCustomer, phoneNumber: phoneInput };
        this.setState({ selectedCustomer: updatedCustomer });
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating phone number:', error);
      alert('Failed to update phone number');
    }
  };

  // Survey Questions Management
  loadSurveyQuestions = async () => {
    try {
      console.log('Loading survey questions...'); // Debug log
      const response = await fetch('/api/survey/questions');
      const result = await response.json();
      
      console.log('Survey questions response:', result); // Debug log
      
      if (result.success) {
        console.log('Setting survey questions:', result.questions); // Debug log
        this.setState({ surveyQuestions: result.questions });
      } else {
        console.error('Error loading survey questions:', result.error);
      }
    } catch (error) {
      console.error('Error loading survey questions:', error);
    }
  };

  addNewQuestion = async () => {
    try {
      const response = await fetch('/api/survey/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'open_text',
          text: 'New Question - Click to Edit',
          smsText: 'New SMS question - please edit this message'
        })
      });

      const result = await response.json();

      if (result.success) {
        this.loadSurveyQuestions(); // Reload questions
        alert('New question added successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error adding question:', error);
      alert('Failed to add question');
    }
  };

  deleteQuestion = async (questionId) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/survey/questions/${questionId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        this.loadSurveyQuestions(); // Reload questions
        alert('Question deleted successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  openQuestionModal = (question) => {
    this.setState({
      selectedQuestion: { ...question },
      showQuestionModal: true
    });
  };

  closeQuestionModal = () => {
    this.setState({
      selectedQuestion: null,
      showQuestionModal: false
    });
  };

  updateQuestion = async (questionData) => {
    const { selectedQuestion } = this.state;
    
    try {
      const response = await fetch(`/api/survey/questions/${selectedQuestion.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(questionData)
      });

      const result = await response.json();

      if (result.success) {
        this.loadSurveyQuestions(); // Reload questions
        this.closeQuestionModal();
        alert('Question updated successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating question:', error);
      alert('Failed to update question');
    }
  };

  // File Upload Modal Methods
  openUploadModal = () => {
    this.setState({ 
      showUploadModal: true,
      uploadGroupName: '',
      uploadFile: null
    });
  };

  closeUploadModal = () => {
    this.setState({ 
      showUploadModal: false,
      uploadGroupName: '',
      uploadFile: null,
      uploading: false
    });
  };

  handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      this.setState({ uploadFile: file });
    } else {
      alert('Please select a valid CSV file');
      event.target.value = '';
    }
  };

  uploadCustomerList = async () => {
    const { uploadFile, uploadGroupName } = this.state;
    
    if (!uploadFile) {
      alert('Please select a CSV file');
      return;
    }
    
    if (!uploadGroupName.trim()) {
      alert('Please enter a group name for this customer list');
      return;
    }

    this.setState({ uploading: true });

    try {
      const formData = new FormData();
      formData.append('csvFile', uploadFile);
      formData.append('groupName', uploadGroupName.trim());

      const response = await fetch('/api/customers/import', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully uploaded ${result.imported || 0} customers in group "${uploadGroupName}"`);
        this.loadData(); // Reload customer data
        this.closeUploadModal();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload customer list');
    }

    this.setState({ uploading: false });
  };

  // Survey Scheduling Methods
  openScheduleModal = () => {
    this.setState({ 
      showScheduleModal: true,
      selectedGroup: '',
      scheduledDate: '',
      scheduledTime: '10:00'
    });
  };

  closeScheduleModal = () => {
    this.setState({ 
      showScheduleModal: false,
      selectedGroup: '',
      scheduledDate: '',
      scheduledTime: ''
    });
  };

  scheduleGroupSurvey = async () => {
    const { selectedGroup, scheduledDate, scheduledTime, customerGroups } = this.state;
    
    if (!selectedGroup) {
      alert('Please select a customer group');
      return;
    }
    
    if (!scheduledDate) {
      alert('Please select a date');
      return;
    }
    
    const scheduleDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    const now = new Date();
    
    if (scheduleDateTime <= now) {
      alert('Please select a future date and time');
      return;
    }

    const customersInGroup = customerGroups[selectedGroup] || [];
    const readyCustomers = customersInGroup.filter(c => c.status === 'ready' && c.phoneNumber);
    
    if (readyCustomers.length === 0) {
      alert('No customers ready for survey in this group (need phone numbers)');
      return;
    }

    try {
      const response = await fetch('/api/survey/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupName: selectedGroup,
          scheduledDateTime: scheduleDateTime.toISOString(),
          customerIds: readyCustomers.map(c => c.id)
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Survey scheduled for ${readyCustomers.length} customers in "${selectedGroup}" on ${scheduledDate} at ${scheduledTime}`);
        this.loadScheduledSurveys();
        this.closeScheduleModal();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error scheduling survey:', error);
      alert('Failed to schedule survey');
    }
  };

  loadScheduledSurveys = async () => {
    try {
      const response = await fetch('/api/survey/scheduled');
      const result = await response.json();
      
      if (result.success) {
        this.setState({ scheduledSurveys: result.scheduled || [] });
      }
    } catch (error) {
      console.error('Error loading scheduled surveys:', error);
    }
  };

  cancelScheduledSurvey = async (scheduleId) => {
    if (!confirm('Are you sure you want to cancel this scheduled survey?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/survey/scheduled/${scheduleId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        alert('Scheduled survey cancelled');
        this.loadScheduledSurveys();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cancelling scheduled survey:', error);
      alert('Failed to cancel scheduled survey');
    }
  };

  renderDashboard() {
    const { stats, customers } = this.state;
    
    if (!stats) return <div className="loading">Loading dashboard...</div>;

    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Rita SMS Survey Dashboard</h1>
          <p>Customer Feedback Platform</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{stats.totalCustomers}</h3>
              <p>Total Customers</p>
            </div>
          </div>

          <div className="stat-card success">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{stats.completedSurveys}</h3>
              <p>Completed Surveys</p>
            </div>
          </div>

          <div className="stat-card warning">
            <div className="stat-icon">⭐</div>
            <div className="stat-content">
              <h3>{stats.averageRating}</h3>
              <p>Average Rating</p>
            </div>
          </div>

          <div className="stat-card info">
            <div className="stat-icon">💬</div>
            <div className="stat-content">
              <h3>{stats.companyNPS || stats.averageNPS}</h3>
              <p>Company NPS</p>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          <div className="chart-section">
            <div className="card">
              <div className="card-header">
                <h3>Survey Completion Rate</h3>
                <span className="completion-rate">{stats.completionRate.toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${stats.completionRate}%` }}
                ></div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>NPS Breakdown</h3>
              </div>
              <div className="nps-breakdown">
                <div className="nps-item promoter">
                  <span className="nps-label">Promoters (9-10)</span>
                  <span className="nps-count">{stats.npsBreakdown.promoters}</span>
                </div>
                <div className="nps-item passive">
                  <span className="nps-label">Passives (7-8)</span>
                  <span className="nps-count">{stats.npsBreakdown.passives}</span>
                </div>
                <div className="nps-item detractor">
                  <span className="nps-label">Detractors (0-6)</span>
                  <span className="nps-count">{stats.npsBreakdown.detractors}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="store-performance">
            <div className="card">
              <div className="card-header">
                <h3>🏢 NPS Performance Hierarchy</h3>
                <span className="company-nps-badge">Company NPS: {stats.companyNPS || stats.averageNPS}</span>
              </div>
              <div className="nps-hierarchy">
                {Object.entries(stats.byStore || {}).map(([store, storeData]) => (
                  <div key={store} className="store-nps-section">
                    <div className="store-header">
                      <h4>🏢 {store}</h4>
                      <div className="store-metrics">
                        <span className="store-nps">Store NPS: {storeData.storeNPS || 0}</span>
                        <span className="store-count">({storeData.count} surveys)</span>
                      </div>
                    </div>
                    
                    <div className="associates-list">
                      {Object.entries(storeData.associates || {}).map(([associate, assocData]) => (
                        <div key={associate} className="associate-item">
                          <div className="associate-info">
                            <span className="associate-name">👤 {associate}</span>
                            <span className="associate-count">({assocData.count} surveys)</span>
                          </div>
                          <div className="associate-metrics">
                            <span className="associate-rating">⭐ {assocData.avgRating}</span>
                            <span className="associate-nps">NPS: {assocData.associateNPS || 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {Object.keys(stats.byStore || {}).length === 0 && (
                  <div className="empty-nps-state">
                    <p>No survey data available yet. Complete some surveys to see NPS hierarchy.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderCustomers() {
    const { customers } = this.state;

    return (
      <div className="customers-page">
        <div className="page-header">
          <h2>Customer Management</h2>
          <button onClick={this.openUploadModal} className="btn btn-primary">
            Upload Customer List
          </button>
        </div>

        <div className="customers-grid">
          {customers.map(customer => (
            <div 
              key={customer.id} 
              className={`customer-card ${customer.status} clickable`}
              onClick={() => this.openCustomerModal(customer)}
            >
              <div className="customer-header">
                <h3>{customer.firstName} {customer.lastName}</h3>
                <span className={`status-badge ${customer.status}`}>
                  {customer.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className="customer-details">
                <p><strong>Email:</strong> {customer.email}</p>
                <p><strong>Pet:</strong> {customer.petBreed}</p>
                <p><strong>Store:</strong> {customer.storeLocation}</p>
                <p><strong>Associate:</strong> {customer.salesAssociate}</p>
                {customer.phoneNumber && (
                  <p><strong>Phone:</strong> {customer.phoneNumber}</p>
                )}
                {!customer.phoneNumber && (
                  <p className="phone-needed"><strong>Phone:</strong> <span className="missing">Click to add</span></p>
                )}
              </div>

              <div className="customer-actions">
                {customer.status === 'ready' && !customer.surveyStarted && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); this.startSurvey(customer.id); }}
                    className="btn btn-success"
                  >
                    Start Survey
                  </button>
                )}
                {customer.surveyStarted && !customer.surveyCompleted && (
                  <span className="survey-status">Survey In Progress...</span>
                )}
                {customer.surveyCompleted && (
                  <div className="survey-results">
                    <span className="rating">⭐ {customer.satisfactionRating}/5</span>
                    <span className="nps">💬 {customer.npsScore}/10</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    );
  }

  renderCustomerModal() {
    const { selectedCustomer, editingPhone, phoneInput } = this.state;
    
    if (!selectedCustomer) return null;

    return (
      <div className="modal-overlay" onClick={this.closeCustomerModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{selectedCustomer.firstName} {selectedCustomer.lastName}</h2>
            <button className="modal-close" onClick={this.closeCustomerModal}>×</button>
          </div>

          <div className="modal-body">
            <div className="customer-info-section">
              <h3>Customer Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>Email:</label>
                  <span>{selectedCustomer.email}</span>
                </div>
                <div className="info-item">
                  <label>Pet Breed:</label>
                  <span>{selectedCustomer.petBreed}</span>
                </div>
                <div className="info-item">
                  <label>Store Location:</label>
                  <span>{selectedCustomer.storeLocation}</span>
                </div>
                <div className="info-item">
                  <label>Sales Associate:</label>
                  <span>{selectedCustomer.salesAssociate}</span>
                </div>
                <div className="info-item">
                  <label>Purchase Date:</label>
                  <span>{selectedCustomer.purchaseDate}</span>
                </div>
                <div className="info-item">
                  <label>Phone Number:</label>
                  <div className="phone-edit">
                    {editingPhone ? (
                      <div className="phone-input-group">
                        <input 
                          type="tel" 
                          value={phoneInput}
                          onChange={(e) => this.setState({ phoneInput: e.target.value })}
                          placeholder="Enter phone number"
                          className="phone-input"
                        />
                        <button onClick={this.updatePhoneNumber} className="btn btn-success btn-sm">Save</button>
                        <button onClick={this.cancelEditingPhone} className="btn btn-secondary btn-sm">Cancel</button>
                      </div>
                    ) : (
                      <div className="phone-display">
                        <span>{selectedCustomer.phoneNumber || 'Not provided'}</span>
                        <button onClick={this.startEditingPhone} className="btn btn-primary btn-sm">
                          {selectedCustomer.phoneNumber ? 'Edit' : 'Add'} Phone
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Show Survey Questions and Answers for completed surveys */}
            {selectedCustomer.surveyCompleted && (
              <div className="survey-responses-section">
                <h3>📋 Survey Questions & Responses</h3>
                <div className="responses-grid">
                  {this.state.surveyQuestions.map((question, index) => {
                    const response = selectedCustomer.responses?.find(r => r.questionId === question.id);
                    return (
                      <div key={question.id} className="question-response-pair">
                        <div className="question-header">
                          <span className="question-number">Q{question.id}</span>
                          <span className="question-type">{question.type.replace('_', ' ')}</span>
                        </div>
                        <div className="question-text">{question.text}</div>
                        <div className="sms-text">📱 SMS: "{question.smsText}"</div>
                        {response ? (
                          <div className="customer-response completed">
                            <strong>Customer Answer:</strong> {response.processedAnswer}
                            {response.rawAnswer !== response.processedAnswer && (
                              <div className="raw-response">Raw SMS: "{response.rawAnswer}"</div>
                            )}
                          </div>
                        ) : (
                          <div className="customer-response unanswered">
                            <em>Not answered</em>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  <div className="summary-scores">
                    {selectedCustomer.satisfactionRating && (
                      <div className="score-item">
                        <span className="score-label">Satisfaction Rating:</span>
                        <span className="score-value">⭐ {selectedCustomer.satisfactionRating}/5</span>
                      </div>
                    )}
                    {selectedCustomer.npsScore !== undefined && (
                      <div className="score-item">
                        <span className="score-label">NPS Score:</span>
                        <span className="score-value">💬 {selectedCustomer.npsScore}/10</span>
                      </div>
                    )}
                    {selectedCustomer.managerCallbackRequested && (
                      <div className="score-item callback-requested">
                        <span className="score-label">Manager Callback:</span>
                        <span className="score-value">📞 Requested - {selectedCustomer.callbackTopic}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Show Survey Questions for in-progress surveys */}
            {!selectedCustomer.surveyCompleted && selectedCustomer.surveyStarted && (
              <div className="survey-questions-section">
                <h3>📋 Survey Questions & Progress</h3>
                <div className="questions-progress">
                  {this.state.surveyQuestions.map((question, index) => {
                    const isCurrentQuestion = question.id === selectedCustomer.currentQuestionId;
                    const response = selectedCustomer.responses?.find(r => r.questionId === question.id);
                    const isCompleted = !!response;
                    
                    return (
                      <div key={question.id} className={`question-progress-item ${isCurrentQuestion ? 'current' : ''} ${isCompleted ? 'completed' : ''}`}>
                        <div className="question-header">
                          <span className="question-number">Q{question.id}</span>
                          <span className="question-status">
                            {isCompleted ? '✅' : isCurrentQuestion ? '⏳' : '⏸️'}
                          </span>
                        </div>
                        <div className="question-text">{question.text}</div>
                        {isCompleted && response && (
                          <div className="customer-response completed">
                            <strong>Answer:</strong> {response.processedAnswer}
                          </div>
                        )}
                        {isCurrentQuestion && (
                          <div className="current-question-note">
                            Customer is currently answering this question
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!selectedCustomer.surveyCompleted && selectedCustomer.surveyStarted && (
              <div className="survey-status-section">
                <h3>Survey in Progress</h3>
                <p>Customer is currently completing the survey.</p>
                <div className="progress-info">
                  <span>Current Question: {selectedCustomer.currentQuestionId || 'Starting...'}</span>
                </div>
              </div>
            )}

            {!selectedCustomer.surveyStarted && (
              <div className="survey-not-started-section">
                <h3>Survey Not Started</h3>
                <p>Survey has not been initiated for this customer yet.</p>
                {selectedCustomer.status === 'ready' && (
                  <button 
                    onClick={() => { this.startSurvey(selectedCustomer.id); this.closeCustomerModal(); }}
                    className="btn btn-success"
                  >
                    Start Survey Now
                  </button>
                )}
                {selectedCustomer.status === 'phone_needed' && (
                  <p className="status-note">Phone number required before starting survey.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  renderSurveyQuestions() {
    const { surveyQuestions } = this.state;

    console.log('Survey Questions in render:', surveyQuestions); // Debug log

    return (
      <div className="questions-page">
        <div className="page-header">
          <div>
            <h2>Survey Questions Management</h2>
            <p>Edit and customize your survey questions ({surveyQuestions.length} questions loaded)</p>
          </div>
          <button onClick={this.addNewQuestion} className="btn btn-success">
            ➕ Add Question
          </button>
        </div>

        {surveyQuestions.length === 0 ? (
          <div className="no-questions-message">
            <p>Loading survey questions...</p>
          </div>
        ) : (
          <div className="questions-list">
            {surveyQuestions.map(question => (
            <div key={question.id} className="question-card clickable" onClick={() => this.openQuestionModal(question)}>
              <div className="question-card-header">
                <div className="question-number">Question {question.id}</div>
                <div className="question-type-badge">{question.type.replace('_', ' ')}</div>
              </div>
              
              <div className="question-content">
                <h3>{question.text}</h3>
                <div className="sms-preview">
                  <strong>📱 SMS Text:</strong>
                  <div className="sms-bubble">"{question.smsText}"</div>
                </div>
                
                {question.options && (
                  <div className="question-options">
                    <strong>Options:</strong>
                    <ul>
                      {question.options.map((option, index) => (
                        <li key={index}>{String.fromCharCode(65 + index)}) {option}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {question.validation && (
                  <div className="question-validation">
                    <strong>Validation:</strong>
                    {question.validation.min && <span> Min: {question.validation.min}</span>}
                    {question.validation.max && <span> Max: {question.validation.max}</span>}
                    {question.validation.required && <span> Required</span>}
                    {question.validation.maxLength && <span> Max Length: {question.validation.maxLength}</span>}
                  </div>
                )}

                {question.helpText && (
                  <div className="question-help">
                    <strong>Help Text:</strong> {question.helpText}
                  </div>
                )}
              </div>
              
              <div className="question-actions">
                <button 
                  onClick={(e) => { e.stopPropagation(); this.openQuestionModal(question); }}
                  className="btn btn-primary btn-sm"
                >
                  ✏️ Edit
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); this.deleteQuestion(question.id); }}
                  className="btn btn-danger btn-sm"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    );
  }

  renderQuestionModal() {
    const { selectedQuestion } = this.state;
    
    if (!selectedQuestion) return null;

    const handleSave = () => {
      this.updateQuestion(selectedQuestion);
    };

    return (
      <div className="modal-overlay" onClick={this.closeQuestionModal}>
        <div className="modal-content question-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Edit Question {selectedQuestion.id}</h2>
            <button className="modal-close" onClick={this.closeQuestionModal}>×</button>
          </div>

          <div className="modal-body">
            <div className="form-section">
              <div className="form-group">
                <label>Question Type:</label>
                <select 
                  value={selectedQuestion.type} 
                  onChange={(e) => this.setState({ 
                    selectedQuestion: { ...selectedQuestion, type: e.target.value }
                  })}
                  className="form-select"
                  disabled
                >
                  <option value="rating">Rating Scale</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="nps_scale">NPS Scale</option>
                  <option value="open_text">Open Text</option>
                  <option value="yes_no_with_text">Yes/No with Text</option>
                </select>
                <small className="form-hint">Question type cannot be changed</small>
              </div>

              <div className="form-group">
                <label>Question Text:</label>
                <textarea
                  value={selectedQuestion.text}
                  onChange={(e) => this.setState({ 
                    selectedQuestion: { ...selectedQuestion, text: e.target.value }
                  })}
                  className="form-textarea"
                  rows="3"
                  placeholder="Enter the question text..."
                />
              </div>

              <div className="form-group">
                <label>SMS Text (sent to customer):</label>
                <textarea
                  value={selectedQuestion.smsText}
                  onChange={(e) => this.setState({ 
                    selectedQuestion: { ...selectedQuestion, smsText: e.target.value }
                  })}
                  className="form-textarea"
                  rows="4"
                  placeholder="Enter the SMS message text..."
                />
                <small className="form-hint">This is the actual text message sent to customers</small>
              </div>

              {selectedQuestion.helpText !== undefined && (
                <div className="form-group">
                  <label>Help Text:</label>
                  <input
                    type="text"
                    value={selectedQuestion.helpText || ''}
                    onChange={(e) => this.setState({ 
                      selectedQuestion: { ...selectedQuestion, helpText: e.target.value }
                    })}
                    className="form-input"
                    placeholder="Help text for invalid responses..."
                  />
                </div>
              )}

              {selectedQuestion.options && (
                <div className="form-group">
                  <label>Answer Options:</label>
                  {selectedQuestion.options.map((option, index) => (
                    <div key={index} className="option-input">
                      <span className="option-letter">{String.fromCharCode(65 + index)})</span>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...selectedQuestion.options];
                          newOptions[index] = e.target.value;
                          this.setState({ 
                            selectedQuestion: { ...selectedQuestion, options: newOptions }
                          });
                        }}
                        className="form-input"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="form-actions">
                <button onClick={handleSave} className="btn btn-success">
                  Save Changes
                </button>
                <button onClick={this.closeQuestionModal} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderScheduleSurveys() {
    const { customerGroups, scheduledSurveys } = this.state;
    
    return (
      <div className="schedule-page">
        <div className="page-header">
          <div>
            <h2>Schedule Surveys</h2>
            <p>Schedule surveys by customer group for future delivery</p>
          </div>
          <button onClick={this.openScheduleModal} className="btn btn-primary">
            📅 Schedule New Survey
          </button>
        </div>

        <div className="schedule-content">
          <div className="customer-groups-section">
            <h3>Customer Groups</h3>
            <div className="groups-grid">
              {Object.entries(customerGroups).map(([groupName, customers]) => {
                const readyCustomers = customers.filter(c => c.status === 'ready' && c.phoneNumber);
                const completedSurveys = customers.filter(c => c.surveyCompleted).length;
                
                return (
                  <div key={groupName} className="group-card">
                    <div className="group-header">
                      <h4>📁 {groupName}</h4>
                      <span className="group-size">{customers.length} customers</span>
                    </div>
                    
                    <div className="group-stats">
                      <div className="stat-item">
                        <span className="stat-label">Ready for Survey:</span>
                        <span className="stat-value">{readyCustomers.length}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Completed:</span>
                        <span className="stat-value">{completedSurveys}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        this.setState({ selectedGroup: groupName });
                        this.openScheduleModal();
                      }}
                      className="btn btn-success btn-sm"
                      disabled={readyCustomers.length === 0}
                    >
                      📅 Schedule Survey
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="scheduled-surveys-section">
            <h3>Scheduled Surveys</h3>
            {scheduledSurveys.length === 0 ? (
              <div className="empty-state">
                <p>No surveys scheduled yet</p>
              </div>
            ) : (
              <div className="scheduled-list">
                {scheduledSurveys.map(schedule => {
                  const scheduleDate = new Date(schedule.scheduledDateTime);
                  const isUpcoming = scheduleDate > new Date();
                  
                  return (
                    <div key={schedule.id} className={`schedule-item ${isUpcoming ? 'upcoming' : 'past'}`}>
                      <div className="schedule-info">
                        <h4>{schedule.groupName}</h4>
                        <div className="schedule-details">
                          <span className="schedule-date">📅 {scheduleDate.toLocaleDateString()}</span>
                          <span className="schedule-time">🕐 {scheduleDate.toLocaleTimeString()}</span>
                          <span className="schedule-count">👥 {schedule.customerCount} customers</span>
                        </div>
                      </div>
                      
                      <div className="schedule-actions">
                        <span className={`schedule-status ${schedule.status}`}>
                          {schedule.status.replace('_', ' ')}
                        </span>
                        {isUpcoming && schedule.status === 'scheduled' && (
                          <button 
                            onClick={() => this.cancelScheduledSurvey(schedule.id)}
                            className="btn btn-danger btn-sm"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  renderUploadModal() {
    const { uploadGroupName, uploadFile, uploading } = this.state;
    
    return (
      <div className="modal-overlay" onClick={this.closeUploadModal}>
        <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📁 Upload Customer List</h2>
            <button className="modal-close" onClick={this.closeUploadModal}>×</button>
          </div>

          <div className="modal-body">
            <div className="form-section">
              <div className="form-group">
                <label>Group Name:</label>
                <input
                  type="text"
                  value={uploadGroupName}
                  onChange={(e) => this.setState({ uploadGroupName: e.target.value })}
                  placeholder="Enter a name for this customer group (e.g., 'March 2024 Customers')"
                  className="form-input"
                  disabled={uploading}
                />
                <small className="form-hint">This name will be used to group and organize these customers</small>
              </div>

              <div className="form-group">
                <label>CSV File:</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={this.handleFileChange}
                  className="form-file-input"
                  disabled={uploading}
                />
                {uploadFile && (
                  <div className="file-info">
                    <span className="file-name">📄 {uploadFile.name}</span>
                    <span className="file-size">({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
                <small className="form-hint">Select a CSV file containing customer information</small>
              </div>

              <div className="csv-format-help">
                <h4>📋 Expected CSV Format:</h4>
                <p>Your CSV should include these columns:</p>
                <div className="csv-columns">
                  <span className="csv-column">firstName</span>
                  <span className="csv-column">lastName</span>
                  <span className="csv-column">email</span>
                  <span className="csv-column">petBreed</span>
                  <span className="csv-column">storeLocation</span>
                  <span className="csv-column">salesAssociate</span>
                  <span className="csv-column">purchaseDate</span>
                  <span className="csv-column optional">phoneNumber (optional)</span>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  onClick={this.uploadCustomerList} 
                  className="btn btn-success"
                  disabled={uploading || !uploadFile || !uploadGroupName.trim()}
                >
                  {uploading ? '⏳ Uploading...' : '📤 Upload Customer List'}
                </button>
                <button 
                  onClick={this.closeUploadModal} 
                  className="btn btn-secondary"
                  disabled={uploading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderScheduleModal() {
    const { selectedGroup, scheduledDate, scheduledTime, customerGroups } = this.state;
    
    // Get today's date in YYYY-MM-DD format for min date
    const today = new Date().toISOString().split('T')[0];
    
    return (
      <div className="modal-overlay" onClick={this.closeScheduleModal}>
        <div className="modal-content schedule-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📅 Schedule Group Survey</h2>
            <button className="modal-close" onClick={this.closeScheduleModal}>×</button>
          </div>

          <div className="modal-body">
            <div className="form-section">
              <div className="form-group">
                <label>Customer Group:</label>
                <select
                  value={selectedGroup}
                  onChange={(e) => this.setState({ selectedGroup: e.target.value })}
                  className="form-select"
                >
                  <option value="">Select a customer group...</option>
                  {Object.entries(customerGroups).map(([groupName, customers]) => {
                    const readyCustomers = customers.filter(c => c.status === 'ready' && c.phoneNumber);
                    return (
                      <option key={groupName} value={groupName} disabled={readyCustomers.length === 0}>
                        {groupName} ({readyCustomers.length} ready)
                      </option>
                    );
                  })}
                </select>
                {selectedGroup && (
                  <small className="form-hint">
                    {customerGroups[selectedGroup]?.filter(c => c.status === 'ready' && c.phoneNumber).length || 0} customers ready for survey
                  </small>
                )}
              </div>

              <div className="form-group">
                <label>Survey Date:</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => this.setState({ scheduledDate: e.target.value })}
                  min={today}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Survey Time:</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => this.setState({ scheduledTime: e.target.value })}
                  className="form-input"
                />
                <small className="form-hint">Surveys will be sent at this time on the selected date</small>
              </div>

              {selectedGroup && scheduledDate && (
                <div className="schedule-preview">
                  <h4>📋 Schedule Preview</h4>
                  <div className="preview-details">
                    <div className="preview-item">
                      <strong>Group:</strong> {selectedGroup}
                    </div>
                    <div className="preview-item">
                      <strong>Date & Time:</strong> {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                    </div>
                    <div className="preview-item">
                      <strong>Recipients:</strong> {customerGroups[selectedGroup]?.filter(c => c.status === 'ready' && c.phoneNumber).length || 0} customers
                    </div>
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button 
                  onClick={this.scheduleGroupSurvey} 
                  className="btn btn-success"
                  disabled={!selectedGroup || !scheduledDate || !scheduledTime}
                >
                  📅 Schedule Survey
                </button>
                <button 
                  onClick={this.closeScheduleModal} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { loading, activeTab, showCustomerModal, showQuestionModal, mobileMenuOpen } = this.state;

    if (loading) {
      return (
        <div className="app">
          <div className="loading-screen">
            <div className="loading-spinner"></div>
            <h2>Loading Rita Dashboard...</h2>
          </div>
        </div>
      );
    }

    return (
      <div className="app">
        {/* Mobile Header */}
        <div className="mobile-header">
          <button className="hamburger-menu" onClick={this.toggleMobileMenu}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          <div className="mobile-logo">
            <h2>🐶 Rita</h2>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && <div className="mobile-overlay" onClick={this.closeMobileMenu}></div>}

        {/* Sidebar */}
        <div className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="logo">
            <h2>🐶 Rita</h2>
            <p>SMS Survey Platform</p>
          </div>
          
          <nav className="nav">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => this.handleTabChange('dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => this.handleTabChange('customers')}
            >
              👥 Customers
            </button>
            <button 
              className={`nav-item ${activeTab === 'questions' ? 'active' : ''}`}
              onClick={() => this.handleTabChange('questions')}
            >
              📋 Survey Questions
            </button>
            <button 
              className={`nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
              onClick={() => this.handleTabChange('schedule')}
            >
              📅 Schedule Surveys
            </button>
          </nav>
        </div>

        <div className="main-content">
          {activeTab === 'dashboard' && this.renderDashboard()}
          {activeTab === 'customers' && this.renderCustomers()}
          {activeTab === 'questions' && this.renderSurveyQuestions()}
          {activeTab === 'schedule' && this.renderScheduleSurveys()}
        </div>

        {showCustomerModal && this.renderCustomerModal()}
        {showQuestionModal && this.renderQuestionModal()}
        {this.state.showUploadModal && this.renderUploadModal()}
        {this.state.showScheduleModal && this.renderScheduleModal()}
      </div>
    );
  }
}
