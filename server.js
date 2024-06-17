const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
app.use(cors());


app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/drive', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define a schema and model
const transactionSchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true,
        unique: true
      },
      title: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      category: {
        type: String,
        required: true
      },
      image: {
        type: String,
        required: true
      },
      sold: {
        type: Boolean,
        required: true
      },
      dateOfSale: {
        type: Date,
        required: true
      }
    });

const Transaction = mongoose.model('Transaction', transactionSchema);

// Fetch and initialize database with seed data
app.get('/initialize', async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    const transactions = response.data;

    await Transaction.deleteMany({});
    await Transaction.insertMany(transactions);

    res.send('Database initialized with seed data');
  } catch (error) {
    res.status(500).send('Error initializing database');
  }
});

// Function to get month boundaries
const getMonthBoundaries = (year, month) => {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));   // Month is 0-based in JavaScript Date
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));      // Setting day to 0 gives last day of previous month
    return { start, end };
  };
  
  // Express route to fetch transactions for a specific month
  app.get('/transactions', async (req, res) => {
    try {
      const { year,month, search = '', page = 1, perPage = 10 } = req.query;
      const { start, end } = getMonthBoundaries(parseInt(year), parseInt(month));
  
      console.log('Fetching transactions for month:',year, month);  // Debugging log
      console.log('Date range:', start, 'to', end);            // Debugging log
  
      // Constructing the query for MongoDB
      const query = {
        dateOfSale: {
          $gte: start,
          $lt: end
        },
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { price: !isNaN(parseFloat(search)) ? parseFloat(search) : { $exists: true } }
        ]
      };
  
      // Perform pagination
      const totalCount = await Transaction.countDocuments(query);
      const totalPages = Math.ceil(totalCount / perPage);
      const transactions = await Transaction.find(query)
        .skip((page - 1) * perPage)
        .limit(parseInt(perPage))
        .exec();
  
      console.log('Transactions found:', transactions.length);  // Debugging log
  
      res.status(200).json({
        transactions
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);  // Debugging log
      res.status(500).send({ error: 'Error fetching transactions' });
    }
  });


// Get statistics for the selected month and year
app.get('/statistics', async (req, res) => {
    const { year, month } = req.query;
  
    // Parse month and year inputs
    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);
  
    // Validate inputs (optional step)
    if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
      return res.status(400).json({ error: 'Invalid month' });
    }
    if (isNaN(parsedYear)) {
      return res.status(400).json({ error: 'Invalid year' });
    }
  
    // Calculate start and end dates for the selected month and year
    const startDate = new Date(parsedYear, parsedMonth - 1, 1);
    const endDate = new Date(parsedYear, parsedMonth, 0);
  
    try {
      // Fetch transactions within the specified date range
      const transactions = await Transaction.find({
        dateOfSale: { $gte: startDate, $lt: endDate },
      });
  
      // Calculate statistics
      const totalSaleAmount = transactions.reduce((sum, transaction) => sum + transaction.price, 0);
      const totalSoldItems = transactions.filter((transaction) => transaction.isSold).length;
      const totalNotSoldItems = transactions.length - totalSoldItems;
  
      // Respond with statistics
      res.json({
        totalSaleAmount,
        totalSoldItems,
        totalNotSoldItems,
      });
    } catch (error) {
      console.error('Error fetching statistics:', error.message);
      res.status(500).send('Error fetching statistics');
    }
  });
  

// Get bar chart data for the selected month
app.get('/bar-chart', async (req, res) => {
    const { year, month } = req.query;
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  
    try {
      const transactions = await Transaction.find({
        dateOfSale: { $gte: startDate, $lt: endDate },
      });
  
      const priceRanges = {
        '0-100': 0,
        '101-200': 0,
        '201-300': 0,
        '301-400': 0,
        '401-500': 0,
        '501-600': 0,
        '601-700': 0,
        '701-800': 0,
        '801-900': 0,
        '901-above': 0,
      };
  
      transactions.forEach((transaction) => {
        if (transaction.price >= 0 && transaction.price <= 100) priceRanges['0-100']++;
        else if (transaction.price >= 101 && transaction.price <= 200) priceRanges['101-200']++;
        else if (transaction.price >= 201 && transaction.price <= 300) priceRanges['201-300']++;
        else if (transaction.price >= 301 && transaction.price <= 400) priceRanges['301-400']++;
        else if (transaction.price >= 401 && transaction.price <= 500) priceRanges['401-500']++;
        else if (transaction.price >= 501 && transaction.price <= 600) priceRanges['501-600']++;
        else if (transaction.price >= 601 && transaction.price <= 700) priceRanges['601-700']++;
        else if (transaction.price >= 701 && transaction.price <= 800) priceRanges['701-800']++;
        else if (transaction.price >= 801 && transaction.price <= 900) priceRanges['801-900']++;
        else if (transaction.price >= 901) priceRanges['901-above']++;
      });
  
      res.json(priceRanges);
    } catch (error) {
      console.error('Error fetching bar chart data:', error.message);
      res.status(500).send('Error fetching bar chart data');
    }
  });
  

// Get pie chart data for the selected month
app.get('/pie-chart', async (req, res) => {
    const { year, month } = req.query;
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  
    try {
      const transactions = await Transaction.find({
        dateOfSale: { $gte: startDate, $lt: endDate },
      });
  
      const categoryCounts = {};
  
      transactions.forEach((transaction) => {
        if (categoryCounts[transaction.category]) {
          categoryCounts[transaction.category]++;
        } else {
          categoryCounts[transaction.category] = 1;
        }
      });
  
      res.json(categoryCounts);
    } catch (error) {
      console.error('Error fetching pie chart data:', error.message);
      res.status(500).send('Error fetching pie chart data');
    }
  });
  
// Get combined data from all APIs
app.get('/combined-data', async (req, res) => {
    const { year, month } = req.query;
  
    try {
      const [statisticsResponse, barChartResponse, pieChartResponse] = await Promise.all([
        axios.get(`http://localhost:3000/statistics?year=${year}&month=${month}`),
        axios.get(`http://localhost:3000/bar-chart?year=${year}&month=${month}`),
        axios.get(`http://localhost:3000/pie-chart?year=${year}&month=${month}`),
      ]);
  
      res.json({
        statistics: statisticsResponse.data,
        barChartData: barChartResponse.data,
        pieChartData: pieChartResponse.data,
      });
    } catch (error) {
      console.error('Error fetching combined data:', error.message);
      res.status(500).send('Error fetching combined data');
    }
  });
  

// Example endpoint to create a transaction manually (for testing purposes)
app.post('/create-transaction', async (req, res) => {
  try {
    const { id, title, price, description, category, image, sold, dateOfSale } = req.body;

    const newTransaction = new Transaction({
      productId: id,
      title,
      price,
      description,
      category,
      image,
      isSold: sold,
      dateOfSale: new Date(dateOfSale),
    });

    const savedTransaction = await newTransaction.save();
    res.json(savedTransaction);
  } catch (error) {
    console.error('Error creating transaction:', error.message);
    res.status(500).send('Error creating transaction');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
