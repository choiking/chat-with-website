document.addEventListener('DOMContentLoaded', function() {
  const chatMessages = document.getElementById('chat-messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const summarizeBtn = document.getElementById('summarize-btn');
  const apiKeyInput = document.getElementById('api-key');
  const saveKeyBtn = document.getElementById('save-key');

  sendBtn.addEventListener('click', sendMessage);
  summarizeBtn.addEventListener('click', summarizePage);

  saveKeyBtn.addEventListener('click', saveApiKey);

  function sendMessage() {
    const message = userInput.value;
    if (message.trim() !== '') {
      addMessage('user', message);
      // TODO: Implement AI response logic
      addMessage('ai', 'This is a placeholder AI response.');
      userInput.value = '';
    }
  }

  function addMessage(role, content) {
    if (role === 'assistant') {
        currentAssistantMessage += content;
        updateAssistantMessage();
    } else {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', role);
        
        // Check if the content contains code-like patterns
        if (role === 'ai' && (content.includes('```') || content.includes('`'))) {
            const formattedContent = content
                .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => 
                    `<pre><code class="language-${lang || 'plaintext'}">${code}</code></pre>`)
                .replace(/`([^`]+)`/g, '<code>$1</code>');
            messageElement.innerHTML = formattedContent;
        } else {
            messageElement.textContent = content;
        }
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function summarizePage() {
    console.log('Summarize button clicked');
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      console.log('Sending summarize message to content script');
      chrome.tabs.sendMessage(tabs[0].id, {action: "summarize"}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to content script:', chrome.runtime.lastError);
          addMessage('assistant', 'Error: Unable to communicate with the page. Please make sure you\'re on a valid web page.');
          return;
        }

        console.log('Received response from content script:', response);
        if (response && response.pageText) {
          console.log('Sending summarize message to background script');
          chrome.runtime.sendMessage({action: "summarize", pageText: response.pageText}, function(backResponse) {
            if (chrome.runtime.lastError) {
              console.error('Error sending message to background script:', chrome.runtime.lastError);
              addMessage('assistant', 'Error: Unable to process the summary. Please try again later.');
              return;
            }

            console.log('Received response from background script:', backResponse);
            if (backResponse && backResponse.summary) {
              addMessage('assistant', 'Page summary: ' + backResponse.summary);
            } else if (backResponse && backResponse.error) {
              console.error('Error from background script:', backResponse.error);
              addMessage('assistant', 'Error: ' + backResponse.error);
            } else {
              addMessage('assistant', 'Error: Unexpected response from the server. Please try again.');
            }
          });
        } else {
          addMessage('assistant', 'Error: Unable to extract page content. Please try again on a different page.');
        }
      });
    });
  }

  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({openaiApiKey: apiKey}, function() {
        alert('API key saved successfully!');
      });
    } else {
      alert('Please enter a valid API key.');
    }
  }
});
