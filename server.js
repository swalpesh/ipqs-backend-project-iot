require('./cornjob');
require('./dailySummaryJob');
require('./monthlyCronjob');
const express = require('express');
require('dotenv').config();
require('./models/db');       // Database connection
require('./mqttClient');      // Initialize MQTT client
const cors = require('cors');
const cron = require('node-cron'); // ✅ For hourly job scheduling

// Route Imports
const superadminRoutes = require('./routes/superadminRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const companyRoutes = require('./routes/companyRoutes');
const companyAuthRoutes = require('./routes/companyAuthRoutes');
const companyDashboardRoutes = require('./routes/companyDashboardRoutes');
const adminRoutes = require('./routes/adminRoutes'); // ✅ Admin routes
const hourlyDataRoutes = require('./routes/hourlyDataRoutes');
const dailySummaryRoutes = require('./routes/dailySummaryRoutes');
const monthlySummaryRoutes = require('./routes/monthlySummaryRoutes');
const alertRoutes = require('./routes/alertRoutes');
const alertRoutesid = require('./routes/alerts');



const app = express();
app.use(express.json());

app.use(cors({
    origin: '*',
    credentials: true
}));

// Routes
app.use('/api/superadmin', superadminRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company/auth', companyAuthRoutes);
app.use('/api/company', companyDashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hourly', hourlyDataRoutes);
app.use('/api/summary', dailySummaryRoutes);
app.use('/api', monthlySummaryRoutes);
app.use('/api', alertRoutes);
app.use('/api/alerts', alertRoutesid);



// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
