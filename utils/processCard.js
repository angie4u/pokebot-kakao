function processCard (body, imgUrl, textBlock, factSetArray) {
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
}
module.exports = processCard
