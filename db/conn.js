const { Client, errors } = require('@elastic/elasticsearch');


//http://192.155.100.53:5601/app/home#/
//GET _aliases
const elasticClient = new Client({
  node: 'http://192.155.100.53:9200',
  auth: {
    username: "elastic",
    password: "M2IqzCt09S1Y49J-K57E"
  },
  tls: {
    rejectUnauthorized: false,
  }
  // requestTimeout: 60000,
});

// Function to check the connection and log the status
async function checkConnection() {
  try {
    await elasticClient.ping();
    console.log('Connection established');
  } catch (err) {
    if (err instanceof errors.ConnectionError) {
      console.error('Elasticsearch unavailable', { error: err });
    } else {
      console.error('An unexpected error occurred', { error: err });
    }
  }
}

// Check connection and then export the client
checkConnection();

module.exports = elasticClient;
