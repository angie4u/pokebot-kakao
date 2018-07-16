require('dotenv').config()
var restify = require('restify')
var DirectlineClient = require('./DirectlineClient')

// =========================================================
// Bot Setup
// =========================================================

// Setup Restify Server
var server = restify.createServer()
server.use(restify.plugins.bodyParser())

server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log('%s listening to %s', server.name, server.url)
})

server.get('/', function (req, res) {
  res.json({'message': 'hello from the bot framework. However you should probably hit this app with a client or connector'})
})

server.get('/keyboard', (req, res) => {
  res.json({
    'type': 'buttons',
    'buttons': ['1. 포켓몬 검색', '2. 포켓몬 진화단계 검색']
  })
})

server.post('/message', DirectlineClient)
