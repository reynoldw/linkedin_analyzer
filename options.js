// LinkedIn Feed Collector - Options Script
document.addEventListener('DOMContentLoaded', function() {
  console.log("Options page loaded");
  
  // DOM elements
  const autoStartToggle = document.getElementById('auto-start');
  const checkIntervalInput = document.getElementById('check-interval');
  const maxPostsInput = document.getElementById('max-posts');
  const autoCommentToggle = document.getElementById('auto-comment');
  const commentProbabilityInput = document.getElementById('comment-probability');
  const commentTemplatesContainer = document.getElementById('comment-templates');
  const addTemplateBtn = document.getElementById('add-template');
  const storageUsageElement = document.getElementById('storage-usage');
  const exportFormatSelect = document.getElementById('export-format');
  const exportAllBtn = document.getElementById('export-all');
  const clearDataBtn = document.getElementById('clear-data');
  const saveBtn = document.getElementById('save');
  const statusElement = document.getElementById('status');
  
  // OpenAI elements
  const useOpenAIBtn = document.getElementById('use-openai-btn');
  const openaiApiKeyInput = document.getElementById('openai-api-key');
  const openaiModelSelect = document.getElementById('openai-model');
  const defaultPromptInput = document.getElementById('default-prompt');
  const testOpenAIBtn = document.getElementById('test-openai');
  
  // OpenAI state
  let openAIEnabled = false;
  
  console.log("Toggle elements:", autoStartToggle, autoCommentToggle, useOpenAIBtn);
  
  // Add direct click handlers for toggles
  if (autoStartToggle) {
    autoStartToggle.addEventListener('click', function(event) {
      console.log("Auto-start toggle clicked, new state:", this.checked);
    });
  }
  
  if (autoCommentToggle) {
    autoCommentToggle.addEventListener('click', function(event) {
      console.log("Auto-comment toggle clicked, new state:", this.checked);
    });
  }
  
  // Add click handler for OpenAI toggle button
  if (useOpenAIBtn) {
    useOpenAIBtn.addEventListener('click', function() {
      openAIEnabled = !openAIEnabled;
      updateOpenAIToggleUI();
      console.log("OpenAI toggle clicked, new state:", openAIEnabled);
    });
  }
  
  // Update OpenAI toggle UI based on state
  function updateOpenAIToggleUI() {
    if (!useOpenAIBtn) return;
    
    if (openAIEnabled) {
      useOpenAIBtn.classList.add('active');
      useOpenAIBtn.textContent = 'Disable OpenAI';
    } else {
      useOpenAIBtn.classList.remove('active');
      useOpenAIBtn.textContent = 'Enable OpenAI';
    }
  }
  
  // Default comment templates
  const defaultTemplates = [
    "Great insights! Thanks for sharing this valuable information.",
    "This is really interesting. I appreciate you sharing your perspective.",
    "Thanks for sharing! This is very helpful for my current project.",
    "I've been thinking about this topic recently. Your post adds a lot of value to the conversation.",
    "Excellent points! I'd love to discuss this further sometime."
  ];
  
  // Load saved settings
  loadSettings();
  
  // Calculate storage usage
  calculateStorageUsage();
  
  // Event listeners
  if (addTemplateBtn) {
    addTemplateBtn.addEventListener('click', function() {
      addTemplateField();
    });
  }
  
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', function() {
      exportAllData();
    });
  }
  
  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', function() {
      clearAllData();
    });
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      saveSettings();
    });
  }
  
  // Load settings from storage
  function loadSettings() {
    chrome.storage.local.get([
      'settings',
      'commentTemplates',
      'openaiApiKey',
      'openaiModel',
      'useOpenAI',
      'defaultPrompt'
    ], function(result) {
      const settings = result.settings || {};
      const templates = result.commentTemplates || defaultTemplates;
      
      console.log("Loaded settings:", settings);
      
      // Apply settings to form
      if (autoStartToggle) {
        autoStartToggle.checked = settings.autoStart !== undefined ? settings.autoStart : false;
      }
      
      if (checkIntervalInput) {
        checkIntervalInput.value = settings.checkInterval || 10;
      }
      
      if (maxPostsInput) {
        maxPostsInput.value = settings.maxPostsPerDay || 100;
      }
      
      if (autoCommentToggle) {
        autoCommentToggle.checked = settings.autoComment !== undefined ? settings.autoComment : false;
      }
      
      if (commentProbabilityInput) {
        commentProbabilityInput.value = settings.commentProbability || 10;
      }
      
      if (exportFormatSelect) {
        exportFormatSelect.value = settings.defaultExportFormat || 'json';
      }
      
      // OpenAI settings
      if (useOpenAIBtn) {
        openAIEnabled = result.useOpenAI || false;
        updateOpenAIToggleUI();
      }
      
      if (openaiApiKeyInput) {
        openaiApiKeyInput.value = result.openaiApiKey || '';
      }
      
      if (openaiModelSelect) {
        openaiModelSelect.value = result.openaiModel || 'gpt-3.5-turbo';
      }
      
      if (defaultPromptInput) {
        defaultPromptInput.value = result.defaultPrompt || 'What are the key trends and insights from my LinkedIn feed today?';
      }
      
      // Populate comment templates
      if (commentTemplatesContainer) {
        // Clear existing templates
        commentTemplatesContainer.innerHTML = '';
        
        // Add templates
        templates.forEach(function(template) {
          addTemplateField(template);
        });
      }
    });
  }
  
  // Save settings to storage
  function saveSettings() {
    // Collect settings from form
    const settings = {
      autoStart: autoStartToggle.checked,
      checkInterval: parseInt(checkIntervalInput.value, 10),
      maxPostsPerDay: parseInt(maxPostsInput.value, 10),
      autoComment: autoCommentToggle.checked,
      commentProbability: parseInt(commentProbabilityInput.value, 10),
      defaultExportFormat: exportFormatSelect.value
    };
    
    // OpenAI settings
    const useOpenAI = openAIEnabled;
    const openaiApiKey = openaiApiKeyInput ? openaiApiKeyInput.value.trim() : '';
    const openaiModel = openaiModelSelect ? openaiModelSelect.value : 'gpt-3.5-turbo';
    const defaultPrompt = defaultPromptInput ? defaultPromptInput.value.trim() : '';
    
    // Collect comment templates
    const templateInputs = document.querySelectorAll('.template-input input');
    const commentTemplates = Array.from(templateInputs)
      .map(input => input.value.trim())
      .filter(template => template.length > 0);
    
    // Validate settings
    if (settings.checkInterval < 5 || settings.checkInterval > 60) {
      showStatus('Check interval must be between 5 and 60 seconds', 'error');
      return;
    }
    
    if (settings.maxPostsPerDay < 10 || settings.maxPostsPerDay > 1000) {
      showStatus('Maximum posts per day must be between 10 and 1000', 'error');
      return;
    }
    
    if (settings.commentProbability < 1 || settings.commentProbability > 100) {
      showStatus('Comment probability must be between 1 and 100', 'error');
      return;
    }
    
    if (commentTemplates.length === 0 && settings.autoComment) {
      showStatus('Please add at least one comment template or disable auto-commenting', 'error');
      return;
    }
    
    // Validate OpenAI settings
    if (useOpenAI && !openaiApiKey) {
      showStatus('Please enter your OpenAI API key or disable OpenAI integration', 'error');
      return;
    }
    
    // Save to storage
    chrome.storage.local.set({
      settings: settings,
      commentTemplates: commentTemplates,
      useOpenAI: useOpenAI,
      openaiApiKey: openaiApiKey,
      openaiModel: openaiModel,
      defaultPrompt: defaultPrompt
    }, () => {
      showStatus('Settings saved successfully!', 'success');
      
      // Notify content script and background script of settings change
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'settingsUpdated', settings });
        }
      });
      
      chrome.runtime.sendMessage({ action: 'settingsUpdated', settings });
    });
  }
  
  // Add a new template input field
  function addTemplateField(template = '') {
    const templateItem = document.createElement('div');
    templateItem.className = 'template-item';
    
    const templateInput = document.createElement('div');
    templateInput.className = 'template-input';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = template;
    input.placeholder = 'Enter comment template...';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      templateItem.remove();
    });
    
    templateInput.appendChild(input);
    templateItem.appendChild(templateInput);
    templateItem.appendChild(removeBtn);
    
    commentTemplatesContainer.appendChild(templateItem);
  }
  
  // Calculate and display storage usage
  function calculateStorageUsage() {
    chrome.storage.local.get(null, (items) => {
      const bytes = new Blob([JSON.stringify(items)]).size;
      const kilobytes = (bytes / 1024).toFixed(2);
      const megabytes = (kilobytes / 1024).toFixed(2);
      
      let sizeText = '';
      if (megabytes >= 1) {
        sizeText = `${megabytes} MB`;
      } else {
        sizeText = `${kilobytes} KB`;
      }
      
      storageUsageElement.textContent = sizeText;
    });
  }
  
  // Export all data
  function exportAllData() {
    chrome.storage.local.get(['feedHistory'], (result) => {
      const feedHistory = result.feedHistory || {};
      const format = exportFormatSelect.value;
      
      let content = '';
      let filename = `linkedin_feed_${new Date().toISOString().split('T')[0]}`;
      
      switch (format) {
        case 'json':
          content = JSON.stringify(feedHistory, null, 2);
          filename += '.json';
          break;
          
        case 'csv':
          // Create CSV header
          content = 'Date,Post ID,Author Name,Author Title,Content,Likes,Comments,Shares,URL,Timestamp\n';
          
          // Add rows for each post
          Object.entries(feedHistory).forEach(([date, posts]) => {
            posts.forEach(post => {
              // Escape content for CSV
              const escapedContent = post.content ? `"${post.content.replace(/"/g, '""')}"` : '';
              
              content += [
                date,
                post.id,
                post.author.name,
                post.author.title,
                escapedContent,
                post.engagement.likes || 0,
                post.engagement.comments || 0,
                post.engagement.shares || 0,
                post.url,
                post.timestamp
              ].join(',') + '\n';
            });
          });
          
          filename += '.csv';
          break;
          
        case 'txt':
          Object.entries(feedHistory).forEach(([date, posts]) => {
            content += `=== ${date} ===\n\n`;
            
            posts.forEach(post => {
              content += `Author: ${post.author.name} (${post.author.title})\n`;
              content += `Content: ${post.content}\n`;
              content += `Engagement: ${post.engagement.likes || 0} likes, ${post.engagement.comments || 0} comments, ${post.engagement.shares || 0} shares\n`;
              content += `URL: ${post.url}\n`;
              content += `Timestamp: ${post.timestamp}\n\n`;
            });
            
            content += '\n';
          });
          
          filename += '.txt';
          break;
      }
      
      // Create download link
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
    });
  }
  
  // Clear all data
  function clearAllData() {
    if (confirm('Are you sure you want to clear all collected data? This cannot be undone.')) {
      chrome.storage.local.remove(['feedHistory', 'summaries'], () => {
        showStatus('All data has been cleared successfully!', 'success');
        calculateStorageUsage();
        
        // Notify content script and background script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'dataCleared' });
          }
        });
        
        chrome.runtime.sendMessage({ action: 'dataCleared' });
      });
    }
  }
  
  // Show status message
  function showStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusElement.className = 'status';
    }, 3000);
  }
  
  // Add event listener for the test OpenAI button
  if (testOpenAIBtn) {
    testOpenAIBtn.addEventListener('click', function() {
      testOpenAIConnection();
    });
  }
  
  // Test OpenAI connection
  async function testOpenAIConnection() {
    const apiKey = openaiApiKeyInput.value.trim();
    const model = openaiModelSelect.value;
    
    if (!apiKey) {
      showStatus('Please enter your OpenAI API key', 'error');
      return;
    }
    
    testOpenAIBtn.textContent = 'Testing...';
    testOpenAIBtn.disabled = true;
    
    // Clear any previous status
    showStatus('Testing connection...', 'info');
    
    console.log(`Testing connection with model: ${model}`);
    
    try {
      // Determine the API endpoint based on the model
      let endpoint = 'https://api.openai.com/v1/chat/completions';
      let headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      let body = {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant."
          },
          {
            role: "user",
            content: "Test connection to API. Please respond with 'Connection successful!'"
          }
        ],
        max_tokens: 20
      };
      
      // Handle Claude models
      if (model.includes('claude')) {
        endpoint = 'https://api.anthropic.com/v1/messages';
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        };
        body = {
          model: model,
          messages: [
            {
              role: "user",
              content: "Test connection to API. Please respond with 'Connection successful!'"
            }
          ],
          max_tokens: 20
        };
      }
      
      console.log(`Sending request to: ${endpoint}`);
      console.log('Request headers:', JSON.stringify(headers, null, 2).replace(apiKey, '[REDACTED]'));
      console.log('Request body:', JSON.stringify(body, null, 2));
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error?.message || errorData.error || response.statusText;
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(errorMessage);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error("Error parsing JSON response:", e);
        throw new Error("Invalid JSON response from API");
      }
      
      // Enable OpenAI if the test is successful
      openAIEnabled = true;
      updateOpenAIToggleUI();
      
      // Save the API key and model to storage
      chrome.storage.local.set({
        openaiApiKey: apiKey,
        openaiModel: model,
        useOpenAI: true
      }, function() {
        console.log('OpenAI settings saved');
      });
      
      showStatus('Connection successful! OpenAI integration enabled.', 'success');
    } catch (error) {
      console.error("API test error:", error);
      showStatus(`Connection failed: ${error.message}`, 'error');
      
      // Disable OpenAI if the test fails
      openAIEnabled = false;
      updateOpenAIToggleUI();
    } finally {
      testOpenAIBtn.textContent = 'Test Connection';
      testOpenAIBtn.disabled = false;
    }
  }
}); 