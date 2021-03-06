const fetch = require('node-fetch')
const WebSocket = require('ws')
const InMemory = require('./repositories/InMemory')
const messageFormat = require('./utils/messageFormat')
const processActivities = require('./utils/processActivities')
var messageObject = { 'imgUrl': '', 'textMessage': ''}

const {
  BOT_DIRECTLINE_SECRET: SECRET
} = process.env

const directLineBase = 'https://directline.botframework.com'
const repository = new InMemory()
const conversationMapping = new InMemory() // {conversationId => threadId}

function startConversation (threadId) {
  return fetch(directLineBase + `/v3/directline/conversations`, {
    method: 'post',
    headers: {
      authorization: `bearer ${SECRET}`
    }
  })
    .then(res => res.json())
    .then(data => {
      // console.log('get start conversation from directline client', data)
      return repository.set(threadId, {
        conversationId: data.conversationId,
        muteBot: false,
        isConnected: false
      }).then(() => {
        return {url: data.streamUrl, convoId: data.conversationId, threadId}
      })
    }).then(({url, convoId, threadId}) => {
      return conversationMapping.set(convoId, threadId)
        .then(() => {
          return {url, threadId}
        })
    })
    .then(startConnection)
}

function startConnection ({url, threadId}) {
  const ws = new WebSocket(url)
  // console.log('started Conection')
  const resultPromise = new Promise((resolve) => {
    ws.on('open', () => {
      // console.log('WS CONNECTED')
      repository.updateProperty(threadId, 'isConnected', true)
      resolve()
    })
  })
  ws.on('message', (messageStr) => {
    // console.log('got message from websocket', messageStr)

    const message = messageStr !== '' ? JSON.parse(messageStr) : {}
    console.log(message)

    if (message.activities) {
      // update conversation watermark
      console.log(message.activities)
      repository.updateProperty(threadId, 'watermark', message.watermark)
      const activity = message.activities[0]
      if (activity.from.name) {
        conversationMapping.get(activity.conversation.id)
          .then((threadId) => {
            console.log('POST API: ThreadId = ', threadId, 'convoId: ', activity.conversation.id, 'activity.text: ', activity.text)
            console.log(activity.attachments)

            if (activity.type !== 'typing') {
              // console.log('msgFromServer: ' + messageFromServer)
              console.log(messageObject)
              messageObject = processActivities(activity, messageObject)
              // console.log(messageToUSer)
            }
          })
      }
    }
  })
  ws.on('disconnect', () => {
    // console.log('WS DISCONNECT')
  })

  return resultPromise
}

function isConnectionOpen (threadId) {
  var connection = repository.get(threadId)
  return connection.then((convoObject) => {
    return convoObject.isConnected
  })
}

function reconnectWebSocket (threadId) {
  return repository.get(threadId)
    .then(convoObject => {
      const endpoint = directLineBase + `/v3/directline/conversations/${convoObject.conversationId}?watermark=${convoObject.watermark}`
      return fetch(endpoint, {
        method: 'post',
        headers: {
          authorization: `bearer ${SECRET}`
        }
      })
    })
    .then(res => res.json())
    .then(result => {
      return {url: result.url, threadId}
    })
    .then(startConnection)
}

function sendMessageToBotConnector (threadId, message) {
  return repository.get(threadId)
    .then((convoObject) => {
      return convoObject.conversationId
    }).then((convoId) => {
      const endpoint = directLineBase + `/v3/directline/conversations/${convoId}/activities`
      // console.log('send message to bot connector endpoint', endpoint)
      return fetch(endpoint, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `bearer ${SECRET}`
        },
        body: JSON.stringify({
          type: 'message',
          from: {
            id: threadId
          },
          text: message
        })
      })
    })
}

const client = (req, response) => {
  const initialBody = req.body
  const threadId = initialBody.user_key
  const msg = initialBody.content

  var conversationIdRequest = repository.get(threadId)

  if (conversationIdRequest.muteBot === true) { return }

  console.log('threadId from webhook:', threadId)
  console.log('payload msg:', msg)

  // TODO close ws connection

  repository.exists(threadId)
    .then((convoExists) => {
      if (convoExists) {
        return isConnectionOpen(threadId)
          .then((isConnected) => {
            // console.log('isConnected', isConnected)
            if (!isConnected) {
              return reconnectWebSocket(threadId)
            }
          })
      }
      return startConversation(threadId)
    }).then(() => {
      // console.log('beforeSendingMessage')
      return sendMessageToBotConnector(threadId, msg)
    }).then(() => {
      console.log(messageObject)
      var result
      if (messageObject.imgUrl === '') {
        result = messageFormat.kakaoTextFormat(messageObject.textMessage)
      } else {
        result = messageFormat.kakaoImgTextFormat(messageObject.textMessage, messageObject.imgUrl)
      }

      response.json(result)
      messageObject = { 'imgUrl': '', 'textMessage': ''}
    }).catch((err) => {
      console.log(err.message)
    })
}

module.exports = client
