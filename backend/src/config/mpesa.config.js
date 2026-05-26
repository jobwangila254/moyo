const axios = require('axios');

class DarajaAPI {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortCode = process.env.MPESA_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    this.baseURL = this.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(
        `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        { headers: { Authorization: `Basic ${auth}` } }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error('Daraja auth error:', error.response?.data || error.message);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  async initiateSTKPush({ amount, phoneNumber, timestamp, password, accountReference, transactionDesc }) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber,
          PartyB: this.shortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: `${process.env.BACKEND_URL}/api/payments/callback`,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    } catch (error) {
      console.error('STK Push error:', error.response?.data || error.message);
      throw error;
    }
  }

  async queryStatus({ checkoutRequestId, timestamp, password }) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: this.shortCode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      return response.data;
    } catch (error) {
      console.error('Query status error:', error.response?.data || error.message);
      throw error;
    }
  }
}

const Daraja = new DarajaAPI();

module.exports = { Daraja, DarajaAPI };
