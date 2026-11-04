const serverless = require('serverless-http');
const app = require('../../api/_server/server.js');
const handle = serverless(app);

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  let p = event.path.replace('/.netlify/functions/api', '');
  if (!p.startsWith('/api')) p = '/api' + p;
  event.path = p;
  return handle(event, context);
};
