const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Import models
const Recipient = require('../models/Recipient');
const Campaign = require('../models/Campaign');
const ImportBatch = require('../models/ImportBatch');

class CsvImporter {
  constructor() {
    // Default campaign for development
    this.defaultCampaignId = null;
    this.defaultUserId = new mongoose.Types.ObjectId(); // Generate a default user ID
    
    // In-memory fallback storage
    this.customers = [];
    this.importStats = {
      total: 0,
      successful: 0,
      needsPhone: 0
    };
    
    // File-based persistence for development
    this.dataFile = path.join(__dirname, '../../../.customers-data.json');
    this.loadFromFile();
  }

  loadFromFile() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        this.customers = data.customers || [];
        this.importStats = data.stats || { total: 0, successful: 0, needsPhone: 0 };
        console.log(`📁 Loaded ${this.customers.length} customers from file`);
      }
    } catch (error) {
      console.error('Error loading customers from file:', error);
      this.customers = [];
      this.importStats = { total: 0, successful: 0, needsPhone: 0 };
    }
  }

  saveToFile() {
    try {
      const data = {
        customers: this.customers,
        stats: this.importStats,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.customers.length} customers to file`);
    } catch (error) {
      console.error('Error saving customers to file:', error);
    }
  }

  async ensureDefaultCampaign() {
    if (this.defaultCampaignId) return this.defaultCampaignId;

    try {
      let campaign = await Campaign.findOne({ name: 'Default Campaign' });
      
      if (!campaign) {
        campaign = new Campaign({
          userId: this.defaultUserId,
          name: 'Default Campaign',
          description: 'Default campaign for imported customers',
          status: 'active'
        });
        await campaign.save();
      }
      
      this.defaultCampaignId = campaign._id;
      return this.defaultCampaignId;
    } catch (error) {
      console.error('Error creating default campaign:', error);
      // Fallback to in-memory if database is not available
      return null;
    }
  }

  async importFromFile(filePath, groupName = 'Default Group') {
    try {
      const campaignId = await this.ensureDefaultCampaign();
      
      // If no database connection, fall back to in-memory
      if (!campaignId) {
        return this.importFromFileInMemory(filePath, groupName);
      }

      const stats = { total: 0, successful: 0, needsPhone: 0, errors: [] };
      
      // Create import batch record
      const importBatch = new ImportBatch({
        campaignId,
        userId: this.defaultUserId,
        filename: filePath.split('/').pop(),
        fileSize: fs.statSync(filePath).size,
        fileType: 'csv'
      });

      return new Promise((resolve, reject) => {
        const results = [];
        
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (row) => {
            results.push(row);
          })
          .on('end', async () => {
            try {
              const processResult = await this.processRowsToDatabase(results, campaignId, importBatch._id, groupName);
              
              // Update import batch
              importBatch.totalRows = processResult.total;
              importBatch.successfulImports = processResult.successful;
              importBatch.failedImports = processResult.total - processResult.successful;
              importBatch.phoneNumbersNeeded = processResult.needsPhone;
              importBatch.status = 'completed';
              importBatch.processedAt = new Date();
              await importBatch.save();

              // Get all customers for this campaign
              const customers = await this.getCustomersFromDatabase(campaignId);
              
              resolve({
                customers,
                stats: processResult,
                success: true,
                imported: processResult.successful
              });
            } catch (error) {
              importBatch.status = 'failed';
              await importBatch.save();
              reject(error);
            }
          })
          .on('error', (error) => {
            reject(error);
          });
      });
    } catch (error) {
      console.error('Database import failed, falling back to in-memory:', error);
      return this.importFromFileInMemory(filePath, groupName);
    }
  }

  async processRowsToDatabase(rows, campaignId, importBatchId, groupName) {
    const stats = { total: 0, successful: 0, needsPhone: 0, errors: [] };
    
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      stats.total++;
      
      // Skip empty rows
      if (!row.Email || row.Email.trim() === '') {
        continue;
      }

      try {
        // Check if recipient already exists
        const existingRecipient = await Recipient.findOne({ 
          email: row.Email.trim().toLowerCase(),
          campaignId 
        });
        
        if (existingRecipient) {
          // Update existing recipient
          await this.updateRecipientFromRow(existingRecipient, row, groupName);
          stats.successful++;
          if (!existingRecipient.phoneNumber) {
            stats.needsPhone++;
          }
        } else {
          // Create new recipient
          const recipientData = this.createRecipientFromRow(row, index, campaignId, importBatchId, groupName);
          const recipient = new Recipient(recipientData);
          await recipient.save();
          
          stats.successful++;
          if (!recipient.phoneNumber) {
            stats.needsPhone++;
          }
        }
      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error);
        stats.errors.push({
          row: index + 1,
          error: error.message,
          data: row
        });
      }
    }
    
    return stats;
  }

  createRecipientFromRow(row, index, campaignId, importBatchId, groupName) {
    const phoneNumber = this.formatPhoneNumber(row.Phone || row.PhoneNumber || '');
    
    return {
      campaignId,
      importBatchId,
      email: row.Email.trim().toLowerCase(),
      firstName: row.FirstName?.trim() || '',
      lastName: row.LastName?.trim() || '',
      phoneNumber,
      petBreed: row.CustomData1?.trim() || '',
      purchaseDate: row.CustomData2?.trim() || '',
      salesAssociate: row.CustomData3?.trim() || '',
      storeLocation: row.CustomData4?.trim() || '',
      status: phoneNumber && this.isValidPhoneNumber(phoneNumber) ? 'pending' : 'phone_needed',
      importRowNumber: index + 1
    };
  }

  async updateRecipientFromRow(recipient, row, groupName) {
    const phoneNumber = this.formatPhoneNumber(row.Phone || row.PhoneNumber || '');
    
    recipient.firstName = row.FirstName?.trim() || recipient.firstName;
    recipient.lastName = row.LastName?.trim() || recipient.lastName;
    recipient.petBreed = row.CustomData1?.trim() || recipient.petBreed;
    recipient.purchaseDate = row.CustomData2?.trim() || recipient.purchaseDate;
    recipient.salesAssociate = row.CustomData3?.trim() || recipient.salesAssociate;
    recipient.storeLocation = row.CustomData4?.trim() || recipient.storeLocation;
    
    if (phoneNumber && this.isValidPhoneNumber(phoneNumber)) {
      recipient.phoneNumber = phoneNumber;
      if (recipient.status === 'phone_needed') {
        recipient.status = 'pending';
      }
    }
    
    await recipient.save();
    return recipient;
  }

  async getCustomersFromDatabase(campaignId = null) {
    try {
      const query = campaignId ? { campaignId } : {};
      const recipients = await Recipient.find(query).sort({ createdAt: -1 });
      
      return recipients.map(recipient => ({
        id: recipient._id.toString(),
        email: recipient.email,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
        phoneNumber: recipient.phoneNumber,
        petBreed: recipient.petBreed,
        purchaseDate: recipient.purchaseDate,
        salesAssociate: recipient.salesAssociate,
        storeLocation: recipient.storeLocation,
        status: recipient.status,
        surveyStarted: !!recipient.surveyStartedAt,
        surveyCompleted: !!recipient.surveyCompletedAt,
        currentQuestionId: recipient.currentQuestionId,
        responses: [], // TODO: Load from Response model
        importedAt: recipient.createdAt,
        groupName: 'Default Group' // TODO: Add groupName to Recipient model
      }));
    } catch (error) {
      console.error('Error loading customers from database:', error);
      return [];
    }
  }

  async importFromData(csvData, groupName = 'Default Group') {
    try {
      const campaignId = await this.ensureDefaultCampaign();
      
      // If no database connection, fall back to in-memory
      if (!campaignId) {
        return this.importFromDataInMemory(csvData, groupName);
      }

      const results = [];
      
      // Parse CSV data string
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = this.parseCSVLine(lines[i]);
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          results.push(row);
        }
      }
      
      const processResult = await this.processRowsToDatabase(results, campaignId, null, groupName);
      const customers = await this.getCustomersFromDatabase(campaignId);
      
      return {
        customers,
        stats: processResult,
        success: true,
        imported: processResult.successful
      };
    } catch (error) {
      console.error('Database import failed, falling back to in-memory:', error);
      return this.importFromDataInMemory(csvData, groupName);
    }
  }

  // Fallback in-memory methods for when database is not available
  importFromFileInMemory(filePath, groupName = 'Default Group') {
    this.customers = [];
    this.importStats = { total: 0, successful: 0, needsPhone: 0 };

    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', () => {
          this.processRows(results, groupName);
          this.saveToFile(); // Save to file after import
          resolve({
            customers: this.customers,
            stats: this.importStats,
            success: true,
            imported: this.importStats.successful
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  importFromDataInMemory(csvData, groupName = 'Default Group') {
    this.customers = [];
    this.importStats = { total: 0, successful: 0, needsPhone: 0 };

    const results = [];
    
    // Parse CSV data string
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = this.parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        results.push(row);
      }
    }
    
    this.processRows(results, groupName);
    this.saveToFile(); // Save to file after import
    
    return {
      customers: this.customers,
      stats: this.importStats,
      success: true,
      imported: this.importStats.successful
    };
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  processRows(rows, groupName = 'Default Group') {
    rows.forEach((row, index) => {
      this.importStats.total++;
      
      // Skip empty rows
      if (!row.Email || row.Email.trim() === '') {
        return;
      }

      const customer = this.processCustomerRow(row, index, groupName);
      if (customer) {
        this.customers.push(customer);
        this.importStats.successful++;
        
        if (!customer.phoneNumber) {
          this.importStats.needsPhone++;
        }
      }
    });
  }

  processCustomerRow(row, index, groupName = 'Default Group') {
    try {
      // Extract customer info (handle Puppies N Love CSV format)
      const customer = {
        id: `customer_${index + 1}`,
        email: row.Email?.trim(),
        firstName: row.FirstName?.trim(),
        lastName: row.LastName?.trim(),
        phoneNumber: row.Phone || row.PhoneNumber || '', // Support phone column if present
        
        // Pet store specific fields
        petBreed: row.CustomData1?.trim(),
        purchaseDate: row.CustomData2?.trim(),
        salesAssociate: row.CustomData3?.trim(),
        storeLocation: row.CustomData4?.trim(),
        
        // Group/Campaign information
        groupName: groupName,
        
        // Survey status
        status: 'phone_needed', // Default status
        surveyStarted: false,
        surveyCompleted: false,
        responses: [],
        
        // Metadata
        importedAt: new Date(),
        rowNumber: index + 1
      };

      // Update status if phone number is provided
      if (customer.phoneNumber && this.isValidPhoneNumber(customer.phoneNumber)) {
        customer.status = 'ready';
      }

      return customer;
    } catch (error) {
      console.error(`Error processing row ${index + 1}:`, error);
      return null;
    }
  }

  isValidPhoneNumber(phone) {
    if (!phone) return false;
    
    // Basic phone validation - accepts formats like +1234567890, (123) 456-7890, 123-456-7890
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    const phoneRegex = /^\+?1?[0-9]{10}$/;
    
    return phoneRegex.test(cleaned);
  }

  formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Clean the phone number
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Add +1 if it's a 10-digit US number
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    return phone; // Return original if we can't format it
  }

  async updateCustomerPhone(customerId, phoneNumber) {
    try {
      // Try database first
      const recipient = await Recipient.findById(customerId);
      if (recipient) {
        const formatted = this.formatPhoneNumber(phoneNumber);
        
        if (this.isValidPhoneNumber(formatted)) {
          recipient.phoneNumber = formatted;
          recipient.status = 'pending';
          await recipient.save();
          
          return { 
            success: true, 
            customer: this.convertRecipientToCustomer(recipient)
          };
        } else {
          return { 
            success: false, 
            error: 'Invalid phone number format. Use (123) 456-7890 or +1234567890' 
          };
        }
      }
    } catch (error) {
      console.error('Database update failed, trying in-memory:', error);
    }

    // Fallback to in-memory
    const customer = this.customers.find(c => c.id === customerId);
    if (customer) {
      const formatted = this.formatPhoneNumber(phoneNumber);
      
      if (this.isValidPhoneNumber(formatted)) {
        customer.phoneNumber = formatted;
        customer.status = 'ready';
        customer.updatedAt = new Date();
        this.saveToFile(); // Save to file after update
        return { success: true, customer };
      } else {
        return { 
          success: false, 
          error: 'Invalid phone number format. Use (123) 456-7890 or +1234567890' 
        };
      }
    }
    
    return { success: false, error: 'Customer not found' };
  }

  async getCustomers() {
    try {
      // Try database first
      const campaignId = await this.ensureDefaultCampaign();
      if (campaignId) {
        const customers = await this.getCustomersFromDatabase(campaignId);
        return {
          customers,
          stats: {
            total: customers.length,
            ready: customers.filter(c => c.status === 'ready' || c.status === 'pending').length,
            needsPhone: customers.filter(c => c.status === 'phone_needed').length,
            inProgress: customers.filter(c => c.surveyStarted && !c.surveyCompleted).length,
            completed: customers.filter(c => c.surveyCompleted).length
          }
        };
      }
    } catch (error) {
      console.error('Database query failed, using in-memory:', error);
    }

    // Fallback to in-memory
    const customers = this.customers || [];
    return {
      customers,
      stats: {
        total: customers.length,
        ready: customers.filter(c => c.status === 'ready').length,
        needsPhone: customers.filter(c => c.status === 'phone_needed').length,
        inProgress: customers.filter(c => c.surveyStarted && !c.surveyCompleted).length,
        completed: customers.filter(c => c.surveyCompleted).length
      }
    };
  }

  convertRecipientToCustomer(recipient) {
    return {
      id: recipient._id.toString(),
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      phoneNumber: recipient.phoneNumber,
      petBreed: recipient.petBreed,
      purchaseDate: recipient.purchaseDate,
      salesAssociate: recipient.salesAssociate,
      storeLocation: recipient.storeLocation,
      status: recipient.status,
      surveyStarted: !!recipient.surveyStartedAt,
      surveyCompleted: !!recipient.surveyCompletedAt,
      currentQuestionId: recipient.currentQuestionId,
      responses: [],
      importedAt: recipient.createdAt,
      groupName: 'Default Group'
    };
  }

  async getCustomersByStatus(status) {
    try {
      const campaignId = await this.ensureDefaultCampaign();
      if (campaignId) {
        const recipients = await Recipient.find({ campaignId, status }).sort({ createdAt: -1 });
        return recipients.map(recipient => this.convertRecipientToCustomer(recipient));
      }
    } catch (error) {
      console.error('Database query failed, using in-memory:', error);
    }

    // Fallback to in-memory
    return this.customers.filter(c => c.status === status);
  }

  async exportToCSV() {
    try {
      const customersData = await this.getCustomers();
      const customers = customersData.customers;
      
      if (customers.length === 0) {
        return 'No customers to export';
      }

      // CSV headers
      const headers = [
        'Email', 'FirstName', 'LastName', 'Phone', 
        'CustomData1', 'CustomData2', 'CustomData3', 'CustomData4',
        'Status', 'SurveyStarted', 'SurveyCompleted', 'ImportedAt'
      ];

      // CSV rows
      const rows = customers.map(customer => [
        customer.email,
        customer.firstName,
        customer.lastName,
        customer.phoneNumber,
        customer.petBreed,
        customer.purchaseDate,
        customer.salesAssociate,
        customer.storeLocation,
        customer.status,
        customer.surveyStarted,
        customer.surveyCompleted,
        customer.importedAt
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field || ''}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      console.error('Error exporting CSV:', error);
      return 'Error exporting data';
    }
  }

}

module.exports = CsvImporter;