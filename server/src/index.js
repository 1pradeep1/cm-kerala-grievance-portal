const app = require('./app');
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`CM Kerala grievance portal API listening on port ${port}`));
