exports.kakaoImgTextFormat = function (textMessage, imgUrl) {
  var kakaoImgTextFormat =
    {
      'message': {
        'text': textMessage,
        'photo': {
          'url': imgUrl,
          'width': 480,
          'height': 480
        }
      }
    }
  return kakaoImgTextFormat
}

exports.kakaoTextFormat = function (textMessage) {
  var kakaoTextFormat = {
    'message': {
      'text': textMessage
    }
  }

  return kakaoTextFormat
}
