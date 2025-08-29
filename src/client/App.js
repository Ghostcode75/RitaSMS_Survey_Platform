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
    phoneInput: ''
  };

  componentDidMount() {
    this.loadData();
  }

  loadData = async () => {
    try {
      const [customersResponse, statsResponse] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/survey/stats')
      ]);
      
      const customers = await customersResponse.json();
      const stats = await statsResponse.json();
      
      this.setState({
        customers: customers.customers || [],
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

  renderDashboard() {
    const { stats, customers } = this.state;
    
    if (!stats) return <div className="loading">Loading dashboard...</div>;

    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Rita SMS Survey Dashboard</h1>
          <p>Puppies N Love Customer Feedback Platform</p>
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
              <h3>{stats.averageNPS}</h3>
              <p>NPS Score</p>
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
                <h3>Store Performance</h3>
              </div>
              <div className="store-list">
                {Object.entries(stats.byStore || {}).map(([store, data]) => (
                  <div key={store} className="store-item">
                    <div className="store-info">
                      <h4>{store}</h4>
                      <p>{data.count} surveys</p>
                    </div>
                    <div className="store-ratings">
                      <span className="rating">⭐ {data.avgRating}</span>
                      <span className="nps">💬 {data.avgNPS}</span>
                    </div>
                  </div>
                ))}
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
          <button onClick={this.loadSampleData} className="btn btn-primary">
            Load Sample Data
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
      </div>
    );
  }

  render() {
    const { loading, activeTab } = this.state;

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
        <div className="sidebar">
          <div className="logo">
            <h2>🐶 Rita</h2>
            <p>SMS Survey Platform</p>
          </div>
          
          <nav className="nav">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => this.setState({ activeTab: 'dashboard' })}
            >
              📊 Dashboard
            </button>
            <button 
              className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => this.setState({ activeTab: 'customers' })}
            >
              👥 Customers
            </button>
          </nav>
        </div>

        <div className="main-content">
          {activeTab === 'dashboard' && this.renderDashboard()}
          {activeTab === 'customers' && this.renderCustomers()}
        </div>
      </div>
    );
  }
}
