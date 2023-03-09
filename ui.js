// get the selected frame
const selection = figma.currentPage.selection
if (selection.length !== 1 || selection[0].type !== 'FRAME') {
  figma.closePlugin('Please select a single frame to export.')
}

const frame = selection[0]

function arrayBufferToBase64(bytes) {
  var base64 = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var byteLength = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63 // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
}

;(async function () {
  figma.clientStorage.setAsync('lastDirectory', '/')

  // get the selected parent frame
  const frame = figma.currentPage.selection[0]

  // hide all child layers of the selected parent frame
  frame.children.forEach(child => {
    child.visible = false
  })

  // export the frame using current export settings
  const exportSettings = JSON.parse(JSON.stringify(figma.currentPage.exportSettings))
  const allowedFormats = ['PNG', 'JPG']
  if (!allowedFormats.includes(exportSettings.format)) {
    exportSettings.format = allowedFormats[0]
  }

  // create a new JSZip instance
  const zip = new JSZip()

  // iterate through each child layer and export it as a PNG file
  for (const child of frame.children) {
    child.visible = true
    const imageBytes = await child.exportAsync(exportSettings)
    zip.file(`${child.name}.png`, imageBytes)
    child.visible = false
  }

  // generate a base64-encoded ZIP file containing all the PNG files
  const zipFile = await zip.generateAsync({ type: 'base64' })

  // download the ZIP file
  const fileName = `${frame.name}.zip`
  figma.clientStorage.getAsync('lastDirectory').then(directory => {
    figma.showUI(__html__, { visible: false })
    figma.ui.postMessage({ type: 'download', data: { base64: zipFile, fileName, directory } })
  })

  // listen for messages from the UI
  figma.ui.onmessage = message => {
    console.log(message.type)
    if (message.type === 'directory_selected') {
      figma.clientStorage.setAsync('lastDirectory', message.data).then(directory => {
        figma.ui.postMessage({
          type: 'download',
          data: { base64: zipFile, fileName, directory: message.data },
        })
      })
    } else if (message.type === 'download_complete') {
      figma.closePlugin('Images exported successfully.')
    }
  }
})()
