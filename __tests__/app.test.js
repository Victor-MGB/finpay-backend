const request = require("supertest");
const app = require("../index");
const mongoose = require('mongoose');
const { exchangeRateInterval } = require('../src/services/fetchExchangeRates');
const birthdayJob = require('../src/cron/cronJobs'); // Import the cron job

describe('FinPay API test', () => {
  it('should respond with 200 ok on home route', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
  });

  it('should return 404 on unknown routes', async () => {
    const res = await request(app).get('/non-existing-route');
    expect(res.statusCode).toEqual(404);
  });
});

afterAll(async () => {
    if (birthdayJob && typeof birthdayJob.stop === 'function') {
      birthdayJob.stop();
    }
  
    if (exchangeRateInterval) {
      clearInterval(exchangeRateInterval);
    }
  
    await mongoose.connection.close();
  });
  