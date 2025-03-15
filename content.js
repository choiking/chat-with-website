chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getPageContent") {
    sendResponse({content: document.body.innerText});
    console.log(document.body.innerText)
  }
  return true;  // Will respond asynchronously
});

console.log('Content script loaded');  // Add this line for debugging
