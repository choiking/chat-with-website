chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    console.log('Received summarize request in background script');
    chrome.storage.sync.get(['openaiApiKey', 'defaultAI'], function(result) {
      const selectedAI = result.defaultAI || 'openai'; // Use defaultAI, fallback to OpenAI
      if (selectedAI === 'openai' && result.openaiApiKey) {
        console.log('Using OpenAI API');
        summarizeTextOpenAI(request.pageText, result.openaiApiKey)
          .then(summary => {
            console.log('Summary received:', summary);
            sendResponse({summary: summary});
          })
          .catch(error => {
            console.error('Error in summarizeTextOpenAI:', error);
            sendResponse({error: error.message});
          });
      } else {
        console.error('API key not found or AI not selected');
        sendResponse({error: "API key not set or AI not selected. Please check your extension settings."});
      }
    });
    return true; // Indicates we will send a response asynchronously
  }
});

async function summarizeText(text, apiKey) {
  console.log('Calling OpenAI API');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are a helpful assistant that summarizes text."},
        {role: "user", content: `Please summarize the following text in a concise manner: ${text}`}
      ],
      max_tokens: 150
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error('Error from OpenAI API:', data.error);
    throw new Error(data.error.message);
  }
  return data.choices[0].message.content.trim();
}