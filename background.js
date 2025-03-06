// LinkedIn Feed Collector - Background Script
console.log("LinkedIn Feed Collector background script initialized");

// Import OpenAI integration
importScripts('openai-integration.js');

// Initialize extension when installed
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed:", details.reason);
  
  // Set default settings
  chrome.storage.local.set({
    isCollecting: false,
    autoComment: false,
    lastSummaryDate: '',
    commentTemplates: [
      "Great insights! Thanks for sharing.",
      "This is really valuable information. Thanks for posting!",
      "Interesting perspective. I appreciate you sharing this.",
      "Thanks for sharing these thoughts. Very insightful!",
      "I found this very helpful. Thanks for posting!",
      "Great content as always!",
      "This resonates with me. Thanks for sharing your perspective.",
      "Valuable information! Thanks for putting this out there."
    ]
  });
  
  // Create alarm for daily summary
  chrome.alarms.create('dailySummary', {
    periodInMinutes: 1440 // Once per day
  });
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);
  
  // Handle different actions
  switch (message.action) {
    case 'updateBadge':
      console.log("Handling updateBadge action");
      updateBadge(message.count || 0);
      sendResponse({ success: true });
      break;
      
    case 'exportData':
      console.log("Handling exportData action");
      exportData(message.format || 'json')
        .then(result => {
          console.log("Export result:", result);
          sendResponse(result);
        })
        .catch(error => {
          console.error("Export error:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep the message channel open for the async response
      
    case 'generateSummary':
      console.log("Handling generateSummary action");
      console.log("Custom prompt:", message.customPrompt);
      
      // Immediately respond that we're processing
      sendResponse({ success: true, processing: true });
      
      // Then generate the summary asynchronously
      generateDailySummary(message.customPrompt)
        .then(result => {
          console.log("Summary generation result:", result);
          
          // Since we've already sent a response, we can't send another one
          // The popup will need to check storage for the result
          
          // If there was an error, log it
          if (!result.success) {
            console.error("Error generating summary:", result.error);
          }
        })
        .catch(error => {
          console.error("Unexpected error in summary generation:", error);
        });
      
      return false; // We've already sent the initial response
      
    case 'clearCollectedPosts':
      console.log("Handling clearCollectedPosts action");
      chrome.storage.local.set({ feedHistory: {}, summaries: {} }, () => {
        console.log("Cleared collected posts and summaries from storage");
        sendResponse({ success: true });
      });
      return true; // Keep the message channel open for the async response
      
    case 'getStatus':
      console.log("Handling getStatus action");
      chrome.storage.local.get(['isCollecting', 'collectedPostsCount', 'processedPostsCount'], (result) => {
        console.log("Status:", result);
        sendResponse({
          success: true,
          isCollecting: result.isCollecting || false,
          collectedPostsCount: result.collectedPostsCount || 0,
          processedPostsCount: result.processedPostsCount || 0
        });
      });
      return true; // Keep the message channel open for the async response
      
    default:
      console.log("Unknown action:", message.action);
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailySummary') {
    generateDailySummary();
  }
});

// Update the extension badge with post count
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#0077B5' }); // LinkedIn blue
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Check if we need to generate a daily summary
function checkForDailySummary() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  chrome.storage.local.get(['lastSummaryDate'], (result) => {
    if (result.lastSummaryDate !== today) {
      // It's a new day, generate summary for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      generateSummaryForDate(yesterdayStr);
    }
  });
}

// Generate a summary for a specific date
async function generateSummaryForDate(date, customPrompt = null) {
  console.log(`Generating summary for date: ${date}`);
  console.log(`Custom prompt: ${customPrompt}`);
  
  try {
    const { feedHistory = {} } = await chrome.storage.local.get(['feedHistory']);
    
    if (!feedHistory[date] || feedHistory[date].length === 0) {
      console.error(`No posts found for date: ${date}`);
      return { success: false, error: `No posts collected for ${date}` };
    }
    
    const posts = feedHistory[date];
    console.log(`Found ${posts.length} posts for ${date}`);
    
    // Check if OpenAI integration is available and configured
    let summaryText = '';
    let useOpenAI = false;
    
    try {
      // Check if OpenAI script is loaded
      console.log("Checking if OpenAI integration is available");
      if (typeof window.openaiIntegration !== 'undefined') {
        console.log("OpenAI integration is available, checking for API key");
        const { openaiApiKey, useOpenAI: openaiEnabled } = await chrome.storage.local.get(['openaiApiKey', 'useOpenAI']);
        useOpenAI = !!openaiApiKey && openaiEnabled !== false;
        console.log(`OpenAI API key available: ${!!openaiApiKey}, OpenAI enabled: ${openaiEnabled !== false}`);
      } else {
        console.error("OpenAI integration is not available");
      }
    } catch (e) {
      console.error("Error checking OpenAI configuration:", e);
      useOpenAI = false;
    }
    
    // Generate summary text
    if (useOpenAI) {
      console.log("Using OpenAI for summary generation");
      try {
        const openaiResult = await window.openaiIntegration.generateOpenAISummary(posts, customPrompt);
        console.log("OpenAI summary result:", openaiResult);
        
        if (openaiResult.success) {
          summaryText = openaiResult.summary;
          console.log("Successfully generated OpenAI summary");
        } else {
          console.warn("OpenAI summary failed, using fallback:", openaiResult.error);
          summaryText = openaiResult.fallbackSummary || generateTextSummary(posts, customPrompt);
        }
      } catch (e) {
        console.error("Error generating OpenAI summary:", e);
        summaryText = generateTextSummary(posts, customPrompt);
      }
    } else {
      console.log("Using built-in summary generator");
      summaryText = generateTextSummary(posts, customPrompt);
    }
    
    // Generate summary object
    const summary = {
      date: date,
      text: summaryText,
      timestamp: Date.now(),
      postCount: posts.length,
      topAuthors: getTopAuthors(posts),
      topEngagements: getTopEngagements(posts)
    };
    
    // Save the summary
    try {
      const { summaries = {} } = await chrome.storage.local.get(['summaries']);
      summaries[date] = summary;
      
      await chrome.storage.local.set({ 
        summaries: summaries,
        lastSummaryDate: date
      });
      
      console.log(`Summary for ${date} saved successfully to storage`);
    } catch (storageError) {
      console.error("Error saving summary to storage:", storageError);
      // Continue without saving to storage
    }
    
    // Try to create a notification, but handle errors gracefully
    try {
      if (chrome.notifications && typeof chrome.notifications.create === 'function') {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.svg',
          title: 'LinkedIn Feed Summary',
          message: `Your summary for ${date} is ready! ${posts.length} posts analyzed.`
        });
      }
    } catch (notificationError) {
      console.warn("Could not create notification:", notificationError);
      // Continue without notification
    }
    
    return {
      success: true,
      summary: summary
    };
  } catch (error) {
    console.error("Error in generateSummaryForDate:", error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred",
      fallbackSummary: generateTextSummary(feedHistory[date] || [], customPrompt)
    };
  }
}

// Generate daily summary (prioritize today's data)
async function generateDailySummary(customPrompt = null) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    console.log(`Starting daily summary generation with custom prompt: ${customPrompt}`);
    // First check if we have data for today
    const { feedHistory = {} } = await chrome.storage.local.get(['feedHistory']);
    
    // If we have posts for today, generate summary for today
    if (feedHistory[today] && feedHistory[today].length > 0) {
      console.log(`Found ${feedHistory[today].length} posts for today, generating summary`);
      return await generateSummaryForDate(today, customPrompt);
    }
    
    // If no posts for today, try yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`No posts for today, trying yesterday (${yesterdayStr})`);
    return await generateSummaryForDate(yesterdayStr, customPrompt);
  } catch (error) {
    console.error("Error in generateDailySummary:", error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred during summary generation" 
    };
  }
}

// Get top authors from posts
function getTopAuthors(posts) {
  const authorCounts = {};
  
  posts.forEach(post => {
    const authorName = post.author.name;
    authorCounts[authorName] = (authorCounts[authorName] || 0) + 1;
  });
  
  return Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
}

// Get top engagements from posts
function getTopEngagements(posts) {
  return posts
    .sort((a, b) => {
      const engagementA = (a.engagement.likes || 0) + (a.engagement.comments || 0);
      const engagementB = (b.engagement.likes || 0) + (b.engagement.comments || 0);
      return engagementB - engagementA;
    })
    .slice(0, 5)
    .map(post => ({
      author: post.author.name,
      content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      engagement: {
        likes: post.engagement.likes || 0,
        comments: post.engagement.comments || 0
      }
    }));
}

// Generate text summary of posts
function generateTextSummary(posts, customPrompt = null) {
  // If there's a custom prompt, use a more detailed format
  if (customPrompt) {
    return `
      ${customPrompt}
      
      Based on your LinkedIn feed with ${posts.length} posts:
      
      - You've seen content from ${new Set(posts.map(post => post.author.name)).size} different authors
      - The most engaging post had ${Math.max(...posts.map(post => (post.engagement.likes || 0) + (post.engagement.comments || 0)))} interactions
      - ${posts.filter(post => post.content.includes('[Shared Article]')).length} shared articles
      - ${posts.filter(post => post.content.includes('[Shared Image]')).length} posts with images
      - ${posts.filter(post => post.content.includes('[Shared Video]')).length} posts with videos
      
      Top authors in your feed:
      ${getTopAuthors(posts).map(author => `- ${author.name} (${author.count} posts)`).join('\n')}
      
      Most engaging content was about:
      ${getTopEngagements(posts).map(post => `- "${truncateText(post.content, 100)}" by ${post.author} with ${post.engagement.likes + post.engagement.comments} interactions`).join('\n')}
    `;
  }
  
  // Count posts by type
  const articleCount = posts.filter(post => post.content.includes('[Shared Article]')).length;
  const textPostCount = posts.length - articleCount;
  
  // Get unique authors
  const uniqueAuthors = new Set(posts.map(post => post.author.name)).size;
  
  // Calculate average engagement
  const totalEngagement = posts.reduce((sum, post) => {
    return sum + (post.engagement.likes || 0) + (post.engagement.comments || 0);
  }, 0);
  const avgEngagement = totalEngagement / posts.length;
  
  return `
    Today's LinkedIn Feed Summary:
    
    - Total posts collected: ${posts.length}
    - Unique authors: ${uniqueAuthors}
    - Articles shared: ${articleCount}
    - Text-only posts: ${textPostCount}
    - Average engagement per post: ${avgEngagement.toFixed(1)}
    
    Top authors in your feed:
    ${getTopAuthors(posts).map(author => `- ${author.name} (${author.count} posts)`).join('\n')}
    
    Most engaging content:
    ${getTopEngagements(posts).map(post => `- "${truncateText(post.content, 100)}" with ${post.engagement.likes + post.engagement.comments} interactions`).join('\n')}
  `;
}

// Helper function to truncate text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Export data in various formats
async function exportData(format = 'json') {
  try {
    const { feedHistory } = await chrome.storage.local.get(['feedHistory']);
    
    if (!feedHistory) {
      return { success: false, error: 'No data to export' };
    }
    
    let content = '';
    let filename = `linkedin-feed-export-${new Date().toISOString().split('T')[0]}`;
    let mimeType = '';
    
    switch (format.toLowerCase()) {
      case 'json':
        content = JSON.stringify(feedHistory, null, 2);
        filename += '.json';
        mimeType = 'application/json';
        break;
        
      case 'csv':
        content = convertToCSV(feedHistory);
        filename += '.csv';
        mimeType = 'text/csv';
        break;
        
      case 'txt':
        content = convertToText(feedHistory);
        filename += '.txt';
        mimeType = 'text/plain';
        break;
        
      default:
        return { success: false, error: 'Unsupported export format' };
    }
    
    // Create a download URL
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    // Create a download link and click it
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error exporting data:", error);
    return { success: false, error: error.message };
  }
}

// Convert feed history to CSV
function convertToCSV(feedHistory) {
  // Headers
  let csv = 'Date,Post ID,Author,Title,Content,Likes,Comments,URL\n';
  
  // Add each post
  Object.entries(feedHistory).forEach(([date, posts]) => {
    posts.forEach(post => {
      // Escape fields that might contain commas
      const escapedContent = `"${post.content.replace(/"/g, '""')}"`;
      const escapedAuthor = `"${post.author.name.replace(/"/g, '""')}"`;
      const escapedTitle = `"${post.author.title.replace(/"/g, '""')}"`;
      
      csv += `${date},${post.id},${escapedAuthor},${escapedTitle},${escapedContent},${post.engagement.likes || 0},${post.engagement.comments || 0},${post.url}\n`;
    });
  });
  
  return csv;
}

// Convert feed history to plain text
function convertToText(feedHistory) {
  let text = 'LINKEDIN FEED EXPORT\n\n';
  
  Object.entries(feedHistory).forEach(([date, posts]) => {
    text += `=== ${date} ===\n\n`;
    
    posts.forEach((post, index) => {
      text += `[${index + 1}] ${post.author.name} (${post.author.title})\n`;
      text += `${post.content}\n`;
      text += `Engagement: ${post.engagement.likes || 0} likes, ${post.engagement.comments || 0} comments\n`;
      text += `URL: ${post.url}\n\n`;
    });
    
    text += '\n';
  });
  
  return text;
} 