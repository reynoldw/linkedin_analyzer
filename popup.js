// LinkedIn Feed Collector - Popup Script
document.addEventListener('DOMContentLoaded', function() {
  console.log("Popup DOM loaded");
  
  // DOM elements
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const collectionToggleBtn = document.getElementById('collection-toggle-btn');
  const autoCommentToggleBtn = document.getElementById('auto-comment-toggle-btn');
  const todayCount = document.getElementById('today-count');
  const totalCount = document.getElementById('total-count');
  const daysCount = document.getElementById('days-count');
  const postList = document.getElementById('post-list');
  const summaryContent = document.getElementById('summary-content');
  const viewAllBtn = document.getElementById('view-all-btn');
  const exportBtn = document.getElementById('export-btn');
  const generateSummaryBtn = document.getElementById('generate-summary-btn');
  const clearBtn = document.getElementById('clear-btn');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log("Toggle buttons:", collectionToggleBtn, autoCommentToggleBtn);
  
  // Initialize popup
  initPopup();
  
  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      console.log(`Switching to tab: ${tabId}`);
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show corresponding content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });
      
      // If switching to summary tab, make sure it's loaded
      if (tabId === 'summary') {
        console.log("Loading summary for tab switch");
        loadSummary();
      }
    });
  });
  
  // Collection toggle button
  if (collectionToggleBtn) {
    collectionToggleBtn.addEventListener('click', () => {
      console.log("Collection toggle button clicked");
      
      // Get current state from button class
      const isCurrentlyActive = collectionToggleBtn.classList.contains('active');
      const newState = !isCurrentlyActive;
      
      // Update UI immediately for better feedback
      if (newState) {
        collectionToggleBtn.classList.add('active');
        collectionToggleBtn.textContent = 'Stop Collection';
      } else {
        collectionToggleBtn.classList.remove('active');
        collectionToggleBtn.textContent = 'Start Collection';
      }
      updateStatusUI(newState);
      
      // Disable button temporarily to prevent multiple clicks
      collectionToggleBtn.disabled = true;
      collectionToggleBtn.classList.add('loading');
      
      // Save state to storage
      chrome.storage.local.set({ isCollecting: newState }, () => {
        console.log(`Collection state saved: ${newState}`);
        
        // Send message to content script
        const action = newState ? 'startCollection' : 'stopCollection';
        sendMessageToActiveTab({ action }, (response) => {
          console.log("Toggle response:", response);
          
          // Re-enable button
          collectionToggleBtn.disabled = false;
          collectionToggleBtn.classList.remove('loading');
          
          if (response && response.success) {
            console.log(`Collection ${newState ? 'started' : 'stopped'} successfully`);
          } else {
            console.error(`Failed to ${newState ? 'start' : 'stop'} collection`);
            
            // Check if this is a connection error
            if (response && response.isConnectionError) {
              // Show a warning to the user
              const warningDiv = document.createElement('div');
              warningDiv.className = 'warning';
              warningDiv.textContent = 'Connection to LinkedIn lost. Please refresh the LinkedIn page and try again.';
              
              // Insert the warning after the controls
              const controlsDiv = document.querySelector('.controls');
              if (controlsDiv && controlsDiv.parentNode) {
                controlsDiv.parentNode.insertBefore(warningDiv, controlsDiv.nextSibling);
                
                // Remove the warning after 5 seconds
                setTimeout(() => {
                  if (warningDiv.parentNode) {
                    warningDiv.parentNode.removeChild(warningDiv);
                  }
                }, 5000);
              }
            }
            
            // Revert UI if there was an error
            if (newState) {
              collectionToggleBtn.classList.remove('active');
              collectionToggleBtn.textContent = 'Start Collection';
            } else {
              collectionToggleBtn.classList.add('active');
              collectionToggleBtn.textContent = 'Stop Collection';
            }
            updateStatusUI(!newState);
            
            // Revert storage
            chrome.storage.local.set({ isCollecting: !newState });
          }
        });
      });
    });
  }
  
  // Auto-comment toggle button
  if (autoCommentToggleBtn) {
    autoCommentToggleBtn.addEventListener('click', () => {
      console.log("Auto-comment toggle button clicked");
      
      // Get current state from button class
      const isCurrentlyActive = autoCommentToggleBtn.classList.contains('active');
      const newState = !isCurrentlyActive;
      
      // Update UI immediately for better feedback
      if (newState) {
        autoCommentToggleBtn.classList.add('active');
        autoCommentToggleBtn.textContent = 'Disable Auto-Comment';
      } else {
        autoCommentToggleBtn.classList.remove('active');
        autoCommentToggleBtn.textContent = 'Enable Auto-Comment';
      }
      
      // Disable button temporarily to prevent multiple clicks
      autoCommentToggleBtn.disabled = true;
      autoCommentToggleBtn.classList.add('loading');
      
      // Save state to storage
      chrome.storage.local.set({ autoComment: newState }, () => {
        console.log(`Auto-comment state saved: ${newState}`);
        
        // Send message to content script
        sendMessageToActiveTab({ action: 'autoComment', enabled: newState }, (response) => {
          console.log("Auto-comment toggle response:", response);
          
          // Re-enable button
          autoCommentToggleBtn.disabled = false;
          autoCommentToggleBtn.classList.remove('loading');
          
          if (response && response.success) {
            console.log(`Auto-comment ${newState ? 'enabled' : 'disabled'} successfully`);
          } else {
            console.error(`Failed to ${newState ? 'enable' : 'disable'} auto-comment`);
            
            // Check if this is a connection error
            if (response && response.isConnectionError) {
              // Show a warning to the user
              const warningDiv = document.createElement('div');
              warningDiv.className = 'warning';
              warningDiv.textContent = 'Connection to LinkedIn lost. Please refresh the LinkedIn page and try again.';
              
              // Insert the warning after the controls
              const controlsDiv = document.querySelector('.controls');
              if (controlsDiv && controlsDiv.parentNode) {
                controlsDiv.parentNode.insertBefore(warningDiv, controlsDiv.nextSibling);
                
                // Remove the warning after 5 seconds
                setTimeout(() => {
                  if (warningDiv.parentNode) {
                    warningDiv.parentNode.removeChild(warningDiv);
                  }
                }, 5000);
              }
            }
            
            // Revert UI if there was an error
            if (newState) {
              autoCommentToggleBtn.classList.remove('active');
              autoCommentToggleBtn.textContent = 'Enable Auto-Comment';
            } else {
              autoCommentToggleBtn.classList.add('active');
              autoCommentToggleBtn.textContent = 'Disable Auto-Comment';
            }
            
            // Revert storage
            chrome.storage.local.set({ autoComment: !newState });
          }
        });
      });
    });
  }
  
  // View all button
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      // Open a new tab with all collected posts
      chrome.tabs.create({ url: 'view.html' });
    });
  }
  
  // Export button
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      // Show export options
      const format = prompt('Choose export format (json, csv, txt):', 'json');
      if (format) {
        chrome.runtime.sendMessage({
          action: 'exportData',
          format: format.toLowerCase()
        });
      }
    });
  }
  
  // Generate summary button
  if (generateSummaryBtn) {
    generateSummaryBtn.addEventListener('click', () => {
      console.log("Generate summary button clicked");
      generateSummary();
    });
  }
  
  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      console.log("Clear button clicked");
      
      if (confirm('Are you sure you want to clear all collected data?')) {
        // Disable button temporarily
        clearBtn.disabled = true;
        clearBtn.classList.add('loading');
        
        // Clear storage
        chrome.storage.local.set({ feedHistory: {}, summaries: {} }, () => {
          console.log("Data cleared from storage");
          
          // Update UI
          updateStats({});
          loadRecentPosts({});
          loadSummary({});
          
          // Send message to content script
          sendMessageToActiveTab({ action: 'clearCollectedPosts' }, (response) => {
            console.log("Clear response:", response);
            
            // Re-enable button
            clearBtn.disabled = false;
            clearBtn.classList.remove('loading');
            
            if (response && response.success) {
              console.log("Posts cleared successfully");
            } else {
              console.error("Failed to clear posts");
              
              // Check if this is a connection error
              if (response && response.isConnectionError) {
                // Show a warning to the user
                const warningDiv = document.createElement('div');
                warningDiv.className = 'warning';
                warningDiv.textContent = 'Connection to LinkedIn lost, but data was cleared from storage.';
                
                // Insert the warning after the controls
                const controlsDiv = document.querySelector('.controls');
                if (controlsDiv && controlsDiv.parentNode) {
                  controlsDiv.parentNode.insertBefore(warningDiv, controlsDiv.nextSibling);
                  
                  // Remove the warning after 5 seconds
                  setTimeout(() => {
                    if (warningDiv.parentNode) {
                      warningDiv.parentNode.removeChild(warningDiv);
                    }
                  }, 5000);
                }
              }
            }
          });
        });
      }
    });
  }
});

// Initialize popup
function initPopup() {
  console.log("Initializing popup");
  
  // Load settings
  chrome.storage.local.get(['isCollecting', 'autoComment', 'feedHistory', 'summaries'], (result) => {
    console.log("Loaded settings:", result);
    
    // Update collection toggle
    const isCollecting = result.isCollecting || false;
    const collectionToggleBtn = document.getElementById('collection-toggle-btn');
    if (collectionToggleBtn) {
      if (isCollecting) {
        collectionToggleBtn.classList.add('active');
        collectionToggleBtn.textContent = 'Stop Collection';
      } else {
        collectionToggleBtn.classList.remove('active');
        collectionToggleBtn.textContent = 'Start Collection';
      }
    }
    updateStatusUI(isCollecting);
    
    // Update auto-comment toggle
    const autoCommentToggleBtn = document.getElementById('auto-comment-toggle-btn');
    if (autoCommentToggleBtn) {
      const autoComment = result.autoComment || false;
      if (autoComment) {
        autoCommentToggleBtn.classList.add('active');
        autoCommentToggleBtn.textContent = 'Disable Auto-Comment';
      } else {
        autoCommentToggleBtn.classList.remove('active');
        autoCommentToggleBtn.textContent = 'Enable Auto-Comment';
      }
    }
    
    // Update stats
    updateStats(result.feedHistory || {});
    
    // Load recent posts
    loadRecentPosts(result.feedHistory || {});
    
    // Load summary
    loadSummary(result.summaries || {});
    
    // Check if we're on LinkedIn and verify collection status with content script
    checkIfOnLinkedIn(() => {
      // Verify collection status with content script
      sendMessageToActiveTab({ action: 'getStatus' }, (response) => {
        if (response && response.isCollecting !== undefined) {
          // If there's a mismatch between storage and content script state, update UI
          if (response.isCollecting !== isCollecting) {
            console.log("Collection state mismatch, updating to match content script:", response.isCollecting);
            if (collectionToggleBtn) {
              if (response.isCollecting) {
                collectionToggleBtn.classList.add('active');
                collectionToggleBtn.textContent = 'Stop Collection';
              } else {
                collectionToggleBtn.classList.remove('active');
                collectionToggleBtn.textContent = 'Start Collection';
              }
            }
            updateStatusUI(response.isCollecting);
            
            // Update storage to match content script state
            chrome.storage.local.set({ isCollecting: response.isCollecting });
          }
        }
      });
    });
  });
}

// Update toggle UI
function updateToggleUI(toggleBtn, isActive) {
  if (!toggleBtn) return;
  
  if (isActive) {
    toggleBtn.classList.add('active');
    toggleBtn.textContent = toggleBtn.id === 'collection-toggle-btn' ? 'Stop Collection' : 'Disable Auto-Comment';
  } else {
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = toggleBtn.id === 'collection-toggle-btn' ? 'Start Collection' : 'Enable Auto-Comment';
  }
}

// Update status UI
function updateStatusUI(isCollecting) {
  console.log("Updating status UI, isCollecting:", isCollecting);
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  
  if (statusDot && statusText) {
    if (isCollecting) {
      statusDot.classList.add('active');
      statusText.textContent = 'Active';
      statusText.classList.add('active');
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = 'Inactive';
      statusText.classList.remove('active');
    }
  }
}

// Update stats
function updateStats(feedHistory = null) {
  console.log("Updating stats");
  const statsContainer = document.getElementById('stats-container');
  if (!statsContainer) return;
  
  if (!feedHistory) {
    chrome.storage.local.get(['feedHistory'], (result) => {
      updateStats(result.feedHistory || {});
    });
    return;
  }
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const todaysPosts = feedHistory[today] || [];
  
  // Calculate total posts across all days
  let totalPosts = 0;
  Object.values(feedHistory).forEach(posts => {
    totalPosts += posts.length;
  });
  
  // Update stats in the UI
  statsContainer.innerHTML = `
    <div class="stat-item">
      <div class="stat-value">${todaysPosts.length}</div>
      <div class="stat-label">Posts Today</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${totalPosts}</div>
      <div class="stat-label">Total Posts</div>
    </div>
    <div class="stat-item">
      <div class="stat-value">${Object.keys(feedHistory).length}</div>
      <div class="stat-label">Days Collected</div>
    </div>
  `;
}

// Load recent posts
function loadRecentPosts(feedHistory = null) {
  console.log("Loading recent posts");
  const recentPostsContent = document.getElementById('recent-posts-content');
  if (!recentPostsContent) return;
  
  if (!feedHistory) {
    chrome.storage.local.get(['feedHistory'], (result) => {
      loadRecentPosts(result.feedHistory || {});
    });
    return;
  }
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const todaysPosts = feedHistory[today] || [];
  
  if (todaysPosts.length > 0) {
    // Sort posts by timestamp (newest first)
    const sortedPosts = [...todaysPosts].sort((a, b) => b.timestamp - a.timestamp);
    
    // Take the 10 most recent posts
    const recentPosts = sortedPosts.slice(0, 10);
    
    recentPostsContent.innerHTML = `
      <div class="post-list">
        ${recentPosts.map(post => {
          let authorName = 'Unknown';
          let authorImg = '';
          let authorTitle = '';
          let connectionStatus = '';
          
          if (post.author) {
            if (typeof post.author === 'object') {
              authorName = post.author.name || 'Unknown';
              authorImg = post.author.imageUrl || '';
              authorTitle = post.author.title || '';
              connectionStatus = post.author.connectionStatus || '';
            } else if (typeof post.author === 'string') {
              authorName = post.author;
            }
          }
          
          // Format the author display name with connection status if available
          const authorDisplay = connectionStatus ? 
            `${authorName}, ${connectionStatus}` : 
            authorName;
          
          // Debug information
          console.log('Post author data:', {
            name: authorName,
            title: authorTitle,
            connectionStatus: connectionStatus,
            imageUrl: authorImg
          });
          
          return `
          <div class="post-item">
            <div class="post-header">
              ${authorImg ? `<img src="${authorImg}" class="post-author-img" alt="${authorName}">` : ''}
              <div class="post-author-info">
                <div class="post-author">${authorDisplay}</div>
                ${authorTitle ? `<div class="post-author-title">${authorTitle}</div>` : ''}
                <div class="post-timestamp">${new Date(post.timestamp).toLocaleString()}</div>
              </div>
            </div>
            <div class="post-content">${post.content || ''}</div>
            ${post.type ? `<div class="post-type">${post.type}</div>` : ''}
            <div class="post-footer">
              <div class="post-engagement">
                <span class="engagement-icon like">👍</span> ${post.engagement?.likes || 0}
                <span class="engagement-icon comment">💬</span> ${post.engagement?.comments || 0}
              </div>
              ${post.url ? `<a href="${post.url}" target="_blank" class="post-link">View on LinkedIn</a>` : ''}
            </div>
          </div>
        `}).join('')}
      </div>
    `;
  } else {
    recentPostsContent.innerHTML = `
      <div class="no-data">No posts collected today</div>
    `;
  }
}

// Load summary
function loadSummary(summaries = null) {
  console.log("Loading summary");
  const summaryContent = document.getElementById('summary-content');
  if (!summaryContent) return;
  
  if (!summaries) {
    console.log("No summaries provided, fetching from storage");
    chrome.storage.local.get(['summaries', 'lastSummaryDate'], (result) => {
      console.log("Fetched summaries from storage:", result.summaries);
      console.log("Last summary date:", result.lastSummaryDate);
      loadSummary(result.summaries || {});
    });
    return;
  }
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Try to get today's summary first, then fall back to the last generated summary
  let summary = summaries[today];
  let summaryDate = today;
  
  if (!summary) {
    console.log(`No summary found for today (${today}), checking for last summary date`);
    chrome.storage.local.get(['lastSummaryDate'], (result) => {
      if (result.lastSummaryDate && summaries[result.lastSummaryDate]) {
        console.log(`Found summary for ${result.lastSummaryDate}`);
        displaySummary(summaries[result.lastSummaryDate], result.lastSummaryDate);
      } else {
        console.log("No summaries found");
        summaryContent.innerHTML = `
          <div class="no-data">
            <p>No summaries available. Click "Generate Summary" to create one.</p>
          </div>
        `;
      }
    });
  } else {
    console.log(`Found summary for today (${today})`);
    displaySummary(summary, today);
  }
  
  // Helper function to display a summary
  function displaySummary(summary, date) {
    console.log("Displaying summary:", summary);
    try {
      if (!summary) {
        throw new Error("Summary is undefined");
      }
      
      const summaryText = summary.text || 'No text content available';
      const postCount = summary.postCount || 0;
      const timestamp = summary.timestamp || Date.now();
      
      let topAuthorsHtml = '';
      if (summary.topAuthors && summary.topAuthors.length > 0) {
        topAuthorsHtml = `
          <div class="summary-section">
            <h3>Top Authors</h3>
            <ul>
              ${summary.topAuthors.map(author => `<li>${author.name} (${author.count} posts)</li>`).join('')}
            </ul>
          </div>
        `;
      }
      
      let topEngagementsHtml = '';
      if (summary.topEngagements && summary.topEngagements.length > 0) {
        topEngagementsHtml = `
          <div class="summary-section">
            <h3>Most Engaging Posts</h3>
            <ul>
              ${summary.topEngagements.map(post => `
                <li>
                  <div class="engagement-post">
                    <div class="engagement-author">${post.author}</div>
                    <div class="engagement-content">${truncateText(post.content, 100)}</div>
                    <div class="engagement-stats">👍 ${post.likes || 0} | 💬 ${post.comments || 0}</div>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }
      
      summaryContent.innerHTML = `
        <div class="summary-header">
          <div class="summary-date">Summary for ${formatDateFull(date)} • ${postCount} posts analyzed</div>
          <div class="summary-timestamp">Generated on ${new Date(timestamp).toLocaleString()}</div>
        </div>
        <div class="summary-text">${summaryText.replace(/\n/g, '<br>')}</div>
        ${topAuthorsHtml}
        ${topEngagementsHtml}
      `;
    } catch (error) {
      console.error("Error rendering summary:", error);
      summaryContent.innerHTML = `
        <div class="no-data">
          <p>Error displaying summary: ${error.message}</p>
          <p>Please try generating a new summary.</p>
        </div>
      `;
    }
  }
}

// Check if we're on LinkedIn
function checkIfOnLinkedIn(callback = null) {
  // Get the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const linkedInStatusElement = document.getElementById('linkedin-status');
    const collectionToggleBtn = document.getElementById('collection-toggle-btn');
    const autoCommentToggleBtn = document.getElementById('auto-comment-toggle-btn');
    const clearBtn = document.getElementById('clear-btn');
    const generateSummaryBtn = document.getElementById('generate-summary-btn');
    
    if (currentTab && currentTab.url && currentTab.url.includes('linkedin.com')) {
      console.log("On LinkedIn");
      if (linkedInStatusElement) {
        linkedInStatusElement.textContent = 'Connected to LinkedIn';
        linkedInStatusElement.classList.add('connected');
      }
      
      // Enable buttons
      if (collectionToggleBtn) collectionToggleBtn.disabled = false;
      if (autoCommentToggleBtn) autoCommentToggleBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
      if (generateSummaryBtn) generateSummaryBtn.disabled = false;
    } else {
      console.log("Not on LinkedIn");
      if (linkedInStatusElement) {
        linkedInStatusElement.textContent = 'Not connected to LinkedIn';
        linkedInStatusElement.classList.remove('connected');
      }
      
      // Disable buttons
      if (collectionToggleBtn) collectionToggleBtn.disabled = true;
      if (autoCommentToggleBtn) autoCommentToggleBtn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      if (generateSummaryBtn) generateSummaryBtn.disabled = true;
    }
    
    if (callback && typeof callback === 'function') {
      callback();
    }
  });
}

// Send message to active tab
function sendMessageToActiveTab(message, callback = null) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("No active tab found");
      if (callback) callback({ success: false, error: "No active tab found" });
      return;
    }
    
    try {
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        // Check for runtime errors
        if (chrome.runtime.lastError) {
          const errorMessage = chrome.runtime.lastError.message || "Unknown error";
          console.error("Error sending message:", errorMessage);
          
          // Handle specific error cases
          if (errorMessage.includes("Extension context invalidated") || 
              errorMessage.includes("Could not establish connection")) {
            console.warn("Connection to content script lost. The page may have been refreshed.");
            
            // For toggle operations, we should update the UI to reflect that collection is stopped
            if (message.action === 'startCollection' || message.action === 'stopCollection') {
              // If we were trying to start collection, we should revert the UI
              if (message.action === 'startCollection') {
                const collectionToggleBtn = document.getElementById('collection-toggle-btn');
                if (collectionToggleBtn) {
                  collectionToggleBtn.classList.remove('active');
                  collectionToggleBtn.textContent = 'Start Collection';
                  collectionToggleBtn.disabled = false;
                  collectionToggleBtn.classList.remove('loading');
                }
                updateStatusUI(false);
                
                // Update storage to reflect that collection is stopped
                chrome.storage.local.set({ isCollecting: false });
              }
            }
          }
          
          if (callback) callback({ 
            success: false, 
            error: errorMessage,
            isConnectionError: errorMessage.includes("Extension context invalidated") || 
                              errorMessage.includes("Could not establish connection")
          });
          return;
        }
        
        // Handle normal response
        if (callback) callback(response || { success: true });
      });
    } catch (error) {
      console.error("Error sending message to tab:", error);
      if (callback) callback({ success: false, error: error.message });
    }
  });
}

// Helper: Truncate text
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Helper: Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

// Helper: Format date (full)
function formatDateFull(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Generate summary
function generateSummary() {
  try {
    // Create and show a modal for custom prompt
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Generate Summary</h3>
        <p>Would you like to use a custom prompt for this summary?</p>
        <textarea id="custom-prompt-input" rows="4" placeholder="Enter your custom prompt here..."></textarea>
        <div class="modal-buttons">
          <button id="use-default-btn" class="btn">Use Default</button>
          <button id="use-custom-btn" class="btn primary">Use Custom Prompt</button>
          <button id="cancel-prompt-btn" class="btn secondary">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Get the default prompt from storage
    chrome.storage.local.get(['defaultPrompt'], function(result) {
      const defaultPrompt = result.defaultPrompt || 'What are the key trends and insights from my LinkedIn feed today?';
      document.getElementById('custom-prompt-input').value = defaultPrompt;
    });
    
    // Handle button clicks
    document.getElementById('use-default-btn').addEventListener('click', function() {
      document.body.removeChild(modal);
      proceedWithSummaryGeneration(null);
    });
    
    document.getElementById('use-custom-btn').addEventListener('click', function() {
      const customPrompt = document.getElementById('custom-prompt-input').value.trim();
      document.body.removeChild(modal);
      if (customPrompt) {
        proceedWithSummaryGeneration(customPrompt);
      } else {
        proceedWithSummaryGeneration(null);
      }
    });
    
    document.getElementById('cancel-prompt-btn').addEventListener('click', function() {
      document.body.removeChild(modal);
    });
  } catch (error) {
    console.error("Error showing prompt modal:", error);
    // Fallback to direct generation if modal fails
    proceedWithSummaryGeneration(null);
  }
}

// Proceed with summary generation after prompt selection
function proceedWithSummaryGeneration(customPrompt) {
  console.log("Starting summary generation process");
  
  // Switch to the summary tab to show progress
  const summaryTab = document.querySelector('.tab-button[data-tab="summary"]');
  if (summaryTab) {
    console.log("Switching to summary tab");
    summaryTab.click();
  }
  
  const generateSummaryBtn = document.getElementById('generate-summary-btn');
  if (generateSummaryBtn) {
    generateSummaryBtn.disabled = true;
    generateSummaryBtn.textContent = 'Generating...';
    generateSummaryBtn.classList.add('loading');
  }
  
  // Show a loading message in the summary tab
  const summaryContent = document.getElementById('summary-content');
  if (summaryContent) {
    summaryContent.innerHTML = `
      <div class="loading-message">
        <p>Generating summary, please wait...</p>
        <div class="loading-spinner"></div>
      </div>
    `;
  }
  
  console.log("Sending generateSummary message to background script");
  console.log("Custom prompt:", customPrompt);
  
  chrome.runtime.sendMessage({ 
    action: 'generateSummary',
    customPrompt: customPrompt
  }, (response) => {
    console.log("Received response from background script:", response);
    
    if (generateSummaryBtn) {
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.textContent = 'Generate Summary';
      generateSummaryBtn.classList.remove('loading');
    }
    
    if (chrome.runtime.lastError) {
      console.error("Error generating summary:", chrome.runtime.lastError);
      if (summaryContent) {
        summaryContent.innerHTML = `
          <div class="no-data">
            <p>Error: ${chrome.runtime.lastError.message || "Failed to generate summary"}</p>
            <p>Please check the console for more details (F12 > Console).</p>
          </div>
        `;
      }
      return;
    }
    
    if (response && response.success) {
      console.log("Summary generation started successfully");
      
      // Set a timeout to check for the summary after a short delay
      setTimeout(() => {
        console.log("Checking for summary after delay");
        // Force reload from storage to get the latest summary
        chrome.storage.local.get(['summaries', 'lastSummaryDate'], (result) => {
          console.log("Fetched fresh summaries from storage:", result.summaries);
          console.log("Last summary date:", result.lastSummaryDate);
          
          if (result.summaries && result.lastSummaryDate && result.summaries[result.lastSummaryDate]) {
            displaySummary(result.summaries[result.lastSummaryDate], result.lastSummaryDate);
          } else {
            loadSummary();
          }
        });
      }, 3000); // Check after 3 seconds
    } else {
      console.error("Summary generation failed:", response?.error || "Unknown error");
      if (summaryContent) {
        summaryContent.innerHTML = `
          <div class="no-data">
            <p>${response && response.error ? response.error : 'Failed to generate summary'}</p>
            <p>Please check the console for more details (F12 > Console).</p>
            ${response && response.fallbackSummary ? `
              <div class="fallback-summary">
                <h3>Fallback Summary:</h3>
                <div class="summary-text">${response.fallbackSummary}</div>
              </div>
            ` : ''}
          </div>
        `;
      }
    }
  });
  
  // Helper function to display a summary directly
  function displaySummary(summary, date) {
    console.log("Directly displaying summary:", summary);
    try {
      if (!summary) {
        throw new Error("Summary is undefined");
      }
      
      const summaryText = summary.text || 'No text content available';
      const postCount = summary.postCount || 0;
      const timestamp = summary.timestamp || Date.now();
      
      let topAuthorsHtml = '';
      if (summary.topAuthors && summary.topAuthors.length > 0) {
        topAuthorsHtml = `
          <div class="summary-section">
            <h3>Top Authors</h3>
            <ul>
              ${summary.topAuthors.map(author => `<li>${author.name} (${author.count} posts)</li>`).join('')}
            </ul>
          </div>
        `;
      }
      
      let topEngagementsHtml = '';
      if (summary.topEngagements && summary.topEngagements.length > 0) {
        topEngagementsHtml = `
          <div class="summary-section">
            <h3>Most Engaging Posts</h3>
            <ul>
              ${summary.topEngagements.map(post => `
                <li>
                  <div class="engagement-post">
                    <div class="engagement-author">${post.author}</div>
                    <div class="engagement-content">${truncateText(post.content, 100)}</div>
                    <div class="engagement-stats">👍 ${post.engagement?.likes || 0} | 💬 ${post.engagement?.comments || 0}</div>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      }
      
      summaryContent.innerHTML = `
        <div class="summary-header">
          <div class="summary-date">Summary for ${formatDateFull(date)} • ${postCount} posts analyzed</div>
          <div class="summary-timestamp">Generated on ${new Date(timestamp).toLocaleString()}</div>
        </div>
        <div class="summary-text">${summaryText.replace(/\n/g, '<br>')}</div>
        ${topAuthorsHtml}
        ${topEngagementsHtml}
      `;
    } catch (error) {
      console.error("Error rendering summary:", error);
      summaryContent.innerHTML = `
        <div class="no-data">
          <p>Error displaying summary: ${error.message}</p>
          <p>Please try generating a new summary.</p>
        </div>
      `;
    }
  }
} 