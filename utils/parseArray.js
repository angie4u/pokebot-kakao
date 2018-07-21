function parseArray (arr) {
  var temp = ''
  arr.forEach(val => {
    temp += val + '\n'
  })
  return temp.slice(0, -1)
}
module.exports = parseArray
