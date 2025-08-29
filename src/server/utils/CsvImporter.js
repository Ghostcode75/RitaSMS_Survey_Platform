const csvParser = require('csv-parser');
const fs = require('fs');

class CsvImporter {
  constructor() {
    // In-memory storage for development (replace with database when ready)
    this.customers = [];
    this.importStats = {
      total: 0,
      successful: 0,
      needsPhone: 0
    };
  }

  async importFromFile(filePath) {
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
          this.processRows(results);
          resolve({
            customers: this.customers,
            stats: this.importStats,
            success: true
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async importFromData(csvData) {
    this.customers = [];
    this.importStats = { total: 0, successful: 0, needsPhone: 0 };

    return new Promise((resolve, reject) => {
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
      
      this.processRows(results);
      resolve({
        customers: this.customers,
        stats: this.importStats,
        success: true
      });
    });
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

  processRows(rows) {
    rows.forEach((row, index) => {
      this.importStats.total++;
      
      // Skip empty rows
      if (!row.Email || row.Email.trim() === '') {
        return;
      }

      const customer = this.processCustomerRow(row, index);
      if (customer) {
        this.customers.push(customer);
        this.importStats.successful++;
        
        if (!customer.phoneNumber) {
          this.importStats.needsPhone++;
        }
      }
    });
  }

  processCustomerRow(row, index) {
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

  updateCustomerPhone(customerId, phoneNumber) {
    const customer = this.customers.find(c => c.id === customerId);
    if (customer) {
      const formatted = this.formatPhoneNumber(phoneNumber);
      
      if (this.isValidPhoneNumber(formatted)) {
        customer.phoneNumber = formatted;
        customer.status = 'ready';
        customer.updatedAt = new Date();
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

  getCustomers() {
    return {
      customers: this.customers,
      stats: {
        total: this.customers.length,
        ready: this.customers.filter(c => c.status === 'ready').length,
        needsPhone: this.customers.filter(c => c.status === 'phone_needed').length,
        inProgress: this.customers.filter(c => c.surveyStarted && !c.surveyCompleted).length,
        completed: this.customers.filter(c => c.surveyCompleted).length
      }
    };
  }

  getCustomersByStatus(status) {
    return this.customers.filter(c => c.status === status);
  }

  exportToCSV() {
    if (this.customers.length === 0) {
      return 'No customers to export';
    }

    // Generate CSV with phone number column
    const headers = [
      'Email', 'FirstName', 'LastName', 'PhoneNumber', 'Status',
      'PetBreed', 'PurchaseDate', 'SalesAssociate', 'StoreLocation',
      'SurveyStarted', 'SurveyCompleted', 'ResponseCount'
    ];

    let csv = headers.join(',') + '\n';
    
    this.customers.forEach(customer => {
      const row = [
        customer.email,
        customer.firstName,
        customer.lastName,
        customer.phoneNumber || '',
        customer.status,
        customer.petBreed || '',
        customer.purchaseDate || '',
        customer.salesAssociate || '',
        customer.storeLocation || '',
        customer.surveyStarted,
        customer.surveyCompleted,
        customer.responses.length
      ];
      
      csv += row.map(field => `"${field}"`).join(',') + '\n';
    });

    return csv;
  }
}

module.exports = new CsvImporter();