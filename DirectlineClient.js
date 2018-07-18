const fetch = require('node-fetch')
const WebSocket = require('ws')
const InMemory = require('./repositories/InMemory')
var messageFromServer = ''
var messageType = 1
var kakaoImgTextFormat = {}
var kakaoTextFormat = {}

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
    // console.log(messageStr)
    const message = messageStr !== '' ? JSON.parse(messageStr) : {}
    if (message.activities) {
      // update conversation watermark
      console.log(message.activities)
      repository.updateProperty(threadId, 'watermark', message.watermark)
      const activity = message.activities[0]
      if (activity.from.name) {
        conversationMapping.get(activity.conversation.id)
          .then((threadId) => {
            console.log('POST API: ThreadId = ', threadId, 'convoId: ', activity.conversation.id)
            console.log(activity.attachments)
            if (activity.attachments == undefined) {
              // there is no attachment, so just parsing the text
              if (activity.text !== undefined) {
                messageFromServer += activity.text + '\n'
                kakaoTextFormat = {
                  'message': {
                    'text': messageFromServer
                  }
                }
              }

              // console.log(messageFromServer)
            } else if (activity.attachments[0].content.type === 'AdaptiveCard') {
              // there is a attachment, so we need to parse adaptive card

              messageType = 2
              var body = activity.attachments[0].content.body[0].columns
              var factSetArray = []
              var imgUrl = []
              var textBlock = []
              processCard(body, imgUrl, textBlock, factSetArray)
              console.log('factest:' + factSetArray)
              console.log('img:' + imgUrl)
              console.log('text:' + textBlock)

              var printText = parseArray(textBlock) + '\n' + parseArray(factSetArray)
              kakaoImgTextFormat =
              {
                'message': {
                  'text': printText,
                  'photo': {
                    'url': imgUrl[0],
                    'width': 640,
                    'height': 480
                  }
                }
              }
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

function processCard (body, imgUrl, textBlock, factSetArray) {
  // 목표 - 1.img Obj 값 추리기 2. TextBlock 값 추리기 3. FactSet값 추리기
  body.forEach(element => {
    element.items.forEach(item => {
      if (item.type === 'Image') {
        imgUrl.push(item.url)
      } else if (item.type === 'TextBlock') {
        textBlock.push(item.text)
      } else if (item.type === 'FactSet') {
        const factSet = item.facts[0].title + ' ' + item.facts[0].value
        factSetArray.push(factSet)
      }
    })
  })
// console.log(parseArray(factSetArray))
}

function parseArray (arr) {
  var temp = ''
  arr.forEach(val => {
    temp += val + '\n'
  })
  return temp.slice(0, -1)
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
      if (messageType == 1) {
        response.json(kakaoTextFormat)
        kakaoTextFormat = {}
      } else if (messageType == 2) {
        response.json(kakaoImgTextFormat)
        kakaoImgTextFormat = {}
      } else {
        response.json({
          'message': {
            'text': '문제가 발생했습니다. 여러분의 인내심이 필요해요!'
          }
        })
      }
    }
    ).catch((err) => {
      console.log(err.message)
    })
}

module.exports = client
