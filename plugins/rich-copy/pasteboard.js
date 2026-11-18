ObjC.import('AppKit')
ObjC.import('Foundation')

function run() {
  const data = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile
  const input = ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding))
  const payload = JSON.parse(input)
  if (typeof payload.text !== 'string' || (payload.html !== undefined && typeof payload.html !== 'string') ||
      (payload.name !== undefined && (typeof payload.name !== 'string' || !payload.name))) {
    throw new Error('Invalid clipboard payload')
  }

  const board = payload.name === undefined ? $.NSPasteboard.generalPasteboard : $.NSPasteboard.pasteboardWithName($(payload.name))
  const item = $.NSPasteboardItem.alloc.init
  if (!item.setStringForType($(payload.text), $('public.utf8-plain-text'))) throw new Error('Failed to set clipboard text')
  if (payload.html !== undefined && !item.setStringForType($(payload.html), $('public.html'))) throw new Error('Failed to set clipboard HTML')
  board.clearContents
  if (!board.writeObjects($([item]))) throw new Error('Failed to write clipboard')
}
