const processCard = require('./processCard')
const parseArray = require('./parseArray')

function processActivities (activity, messageObject) {
  if (activity.attachments == undefined) {
        // there is no attachment, so just parsing the text
    if (activity.text !== undefined) {
      messageObject.textMessage += activity.text + '\n'
      return messageObject
    }
  } else if (activity.attachments[0].content.type === 'AdaptiveCard') {
    var body = activity.attachments[0].content.body[0].columns
    var factSetArray = []
    var imgUrl = []
    var textBlock = []
    processCard(body, imgUrl, textBlock, factSetArray)
    console.log('factest:' + factSetArray)
    console.log('img:' + imgUrl)
    console.log('text:' + textBlock)

    var printText = parseArray(textBlock) + '\n' + parseArray(factSetArray)
    messageObject.textMessage += printText
    messageObject.imgUrl += imgUrl[0]
    return messageObject
  }
}
module.exports = processActivities
