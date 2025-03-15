document.addEventListener('DOMContentLoaded', function() {
    const aiSelect = document.getElementById('ai-select');
    const apiKeyInput = document.getElementById('api-key');
    const saveButton = document.getElementById('save');
    const apiKeySection = document.getElementById('api-key-section');
    const chatSection = document.getElementById('chat-section');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendMessageButton = document.getElementById('send-message');
    const cleanMessageButton = document.getElementById('clean-message');
    const selectedAISpan = document.getElementById('selected-ai');
    const changeAIButton = document.getElementById('change-ai');
    const includePageContentCheckbox = document.getElementById('include-page-content');
    const formattedMessageDiv = document.getElementById('formatted-message');
    const stopStreamButton = document.getElementById('stop-stream');

    let currentAI = 'deepseek';
    let currentApiKey = '';
    let currentPageContent = null;
    let hasPageContentBeenSent = false;
    let currentAssistantMessage = '';
    let controller; // AbortController for managing the fetch request

    // Load saved settings and conversation history
    loadApiKeyAndHistory();

    // Change API key input when AI service is changed
    aiSelect.addEventListener('change', function() {
        loadApiKeyAndHistory();
        updateSelectedAIDisplay();
    });

    // Save API key
    saveButton.addEventListener('click', saveApiKey);

    // Ensure single event listener for send message button
    sendMessageButton.removeEventListener('click', handleUserInput);
    sendMessageButton.addEventListener('click', handleUserInput);

    // Clean message
    cleanMessageButton.removeEventListener('click', cleanMessage);
    cleanMessageButton.addEventListener('click', cleanMessage);

    // Handle Enter key press for sending message
    chatInput.removeEventListener('keypress', handleKeyPress);
    chatInput.addEventListener('keypress', handleKeyPress);

    includePageContentCheckbox.removeEventListener('change', handleCheckboxChange);
    includePageContentCheckbox.addEventListener('change', handleCheckboxChange);

    // Add event listener for stop stream button
    stopStreamButton.addEventListener('click', stopStream);

    // Add event listener for change AI button
    changeAIButton.addEventListener('click', function() {
        apiKeySection.style.display = 'block'; // Show the API key section
        chatSection.style.display = 'none'; // Hide the chat section
        chatMessages.innerHTML = ''; // Clear chat messages
        hasPageContentBeenSent = false; // Reset page content flag
    });

    function handleKeyPress(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default to avoid line break
            handleUserInput();
        }
    }

    function loadApiKeyAndHistory() {
        currentAI = aiSelect.value;
        chrome.storage.local.get([currentAI + 'ApiKey'], function(result) {
            apiKeyInput.value = result[currentAI + 'ApiKey'] || '';
            apiKeyInput.placeholder = `Enter ${currentAI} API Key`;
            currentApiKey = result[currentAI + 'ApiKey'] || '';
            updateChatVisibility();
            updateSelectedAIDisplay();
            displayChatHistory();
        });
    }

    function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();
        
        if (apiKey) {
            const saveObject = {};
            saveObject[currentAI + 'ApiKey'] = apiKey;
            
            chrome.storage.local.set(saveObject, function() {
                currentApiKey = apiKey;
                updateChatVisibility();
                updateSelectedAIDisplay();
                // Show a success message
                const status = document.createElement('p');
                status.textContent = `${currentAI} API Key saved successfully!`;
                status.style.color = 'green';
                document.body.appendChild(status);
                setTimeout(() => status.remove(), 3000); // Remove the message after 3 seconds
            });
        } else {
            alert('Please enter a valid API key.');
        }
    }

    function updateChatVisibility() {
        if (currentApiKey) {
            apiKeySection.style.display = 'none';
            chatSection.style.display = 'block';
        } else {
            apiKeySection.style.display = 'block';
            chatSection.style.display = 'none';
        }
    }

    function updateSelectedAIDisplay() {
        selectedAISpan.textContent = currentAI.charAt(0).toUpperCase() + currentAI.slice(1);
    }

    function changeAI() {
        apiKeySection.style.display = 'block';
        chatSection.style.display = 'none';
        chatMessages.innerHTML = ''; // Clear chat messages
        hasPageContentBeenSent = false;
        // Clear conversation history when changing AI
        chrome.storage.local.set({ conversationHistory: [] });
    }

    function handleCheckboxChange() {
        if (includePageContentCheckbox.checked) {
            fetchPageContent();
        } else {
            currentPageContent = null;
            hasPageContentBeenSent = false;
            addMessage('assistant', 'Page content will no longer be included in your messages.');
        }
    }

    function fetchPageContent() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                // Check if the current page is a chrome:// URL
                if (tabs[0].url.startsWith('chrome://')) {
                    addMessage('system', 'Cannot access content on chrome:// pages. Please navigate to a regular web page to use this feature.');
                    includePageContentCheckbox.checked = false;
                    currentPageContent = null;
                    return;
                }

                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['contentExtractor.js']
                }, (injectionResults) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        addMessage('system', 'Error: Unable to access page content. Make sure you\'re on a web page and the extension has permission to access it.');
                        includePageContentCheckbox.checked = false;
                        currentPageContent = null;
                        return;
                    }

                    const content = injectionResults[0].result;
                    if (!content) {
                        addMessage('system', 'Error: Unable to extract content from the page.');
                        includePageContentCheckbox.checked = false;
                        currentPageContent = null;
                        return;
                    }

                    currentPageContent = content;
                    addMessage('system', 'Page content has been loaded and will be included in your messages.');
                });
            } else {
                addMessage('system', 'Error: No active tab found.');
                includePageContentCheckbox.checked = false;
                currentPageContent = null;
            }
        });
    }

    function handleUserInput() {
        console.log('handleUserInput called');
        const userInput = chatInput.value.trim();
        if (userInput) {
            sendMessage(userInput);
            chatInput.value = '';
        }
    }

    function sendMessage(message) {
        console.log('sendMessage called with:', message);
        let updatedMessage = message;
        if (includePageContentCheckbox.checked && currentPageContent && !hasPageContentBeenSent) {
            updatedMessage = `Given the following webpage content:

${createSummaryPrompt(currentPageContent)}

User's message: ${message}

Please respond to the user's message in the context of this webpage content.`;
            hasPageContentBeenSent = true;
        } 

        addMessage('user', message); // Display original message to user
        addToHistory('user', updatedMessage); // Add to history without displaying

        chrome.storage.local.get(['conversationHistory'], function(result) {
            let history = result.conversationHistory || [];
            history.push({role: "user", content: updatedMessage});
            sendToAI(history);
        });
    }

    function addToHistory(role, text) {
        chrome.storage.local.get(['conversationHistory'], function(result) {
            let history = result.conversationHistory || [];
            history.push({role: role, content: text});
            chrome.storage.local.set({ conversationHistory: history });
        });
    }

    function sendToAI(history) {
        const apiConfig = {
            openai: {
                endpoint: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-3.5-turbo'
            },
            deepseek: {
                endpoint: 'https://api.deepseek.com/v1/chat/completions',
                model: 'deepseek-chat'
            }
        };

        const { endpoint, model } = apiConfig[currentAI];

        let fullMessage = '';
        currentAssistantMessage = ''; // Reset the current assistant message before starting

        // Create a new AbortController
        controller = new AbortController();
        const signal = controller.signal;

        // Enable the stop stream button
        stopStreamButton.disabled = false;

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: history,
                stream: true
            }),
            signal: signal // Add the AbortSignal to the fetch options
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            function readStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        addDataToHistory('assistant', fullMessage);
                        currentAssistantMessage = ''; // Reset after completion
                        stopStreamButton.disabled = true; // Disable the stop button
                        return;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');
                    lines.forEach(line => {
                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                            try {
                                const jsonData = JSON.parse(line.slice(6));
                                if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.content) {
                                    const content = jsonData.choices[0].delta.content;
                                    fullMessage += content;
                                    addMessage('assistant', content);
                                }
                            } catch (error) {
                                console.error('Error parsing JSON:', error);
                            }
                        }
                    });

                    readStream();
                }).catch(error => {
                    if (error.name === 'AbortError') {
                        console.log('Fetch aborted');
                    } else {
                        console.error('Error reading stream:', error);
                        addMessage('assistant', 'Sorry, there was an error processing your request.');
                    }
                    currentAssistantMessage = ''; // Reset on error
                    stopStreamButton.disabled = true; // Disable the stop button
                });
            }

            readStream();
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Error:', error);
                addMessage('assistant', 'Sorry, there was an error processing your request.');
            }
            currentAssistantMessage = ''; // Reset on error
            stopStreamButton.disabled = true; // Disable the stop button
        });
    }

    function stopStream() {
        if (controller) {
            controller.abort(); // Abort the fetch request
            stopStreamButton.disabled = true; // Disable the stop button
        }
    }

    function createSummaryPrompt(content) {
        return `Webpage Content:
URL: ${content.url}
Title: ${content.title}
Meta Description: ${content.metaDescription}
Main Heading: ${content.h1}

Key Headings:
${content.headings.h2s.slice(0, 3).map(h => `- ${h}`).join('\n')}

Main Content:
${content.mainContent}

Important Links:
${content.importantLinks.map(link => `- ${link.text}: ${link.href}`).join('\n')}`;
    }

    function addMessage(role, content) {
        if (role === 'assistant') {
            currentAssistantMessage += content;
            updateAssistantMessage();
        } else {
            const newMessageElement = document.createElement('div');
            newMessageElement.classList.add('message', role);
            newMessageElement.textContent = content;
            chatMessages.appendChild(newMessageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function updateAssistantMessage() {
        let messageElement = document.querySelector('.message.assistant:last-child');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.classList.add('message', 'assistant');
            chatMessages.appendChild(messageElement);
        }
        
        // Configure marked options for better code formatting
        marked.setOptions({
            highlight: function(code, lang) {
                return code;
            },
            breaks: true,
            gfm: true
        });
        
        messageElement.innerHTML = marked.parse(currentAssistantMessage);
        
        // Add click-to-copy functionality for code blocks
        messageElement.querySelectorAll('pre code').forEach(block => {
            block.style.cursor = 'pointer';
            block.title = 'Click to copy';
            block.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(block.textContent);
                    const originalTitle = block.title;
                    block.title = 'Copied!';
                    setTimeout(() => {
                        block.title = originalTitle;
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy code:', err);
                }
            });
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function displayChatHistory() {
        chrome.storage.local.get(['conversationHistory'], function(result) {
            const history = result.conversationHistory || [];
            chatMessages.innerHTML = ''; // Clear existing messages
            history.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.classList.add('message', message.role === 'user' ? 'user' : 'assistant');
                
                if (message.role === 'assistant') {
                    // Use Marked to parse the Markdown
                    const formattedHtml = marked.parse(message.content);
                    messageElement.innerHTML = formattedHtml;
                } else {
                    messageElement.textContent = message.content;
                }
                
                chatMessages.appendChild(messageElement);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    function addDataToHistory(role, text) {
        chrome.storage.local.get(['conversationHistory'], function(result) {
            let history = result.conversationHistory || [];
            history.push({role: role, content: text});
            chrome.storage.local.set({ conversationHistory: history });
        });
    }

    function cleanMessage() {
        chatMessages.innerHTML = ''; // Clear the chat messages display
        chrome.storage.local.set({ conversationHistory: [] }); // Clear stored conversation history
    }
});