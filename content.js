// LinkedIn Feed Collector - Content Script
console.log("LinkedIn Feed Collector initialized");

// Configuration
const CONFIG = {
  feedCheckInterval: 5000, // Check for new posts every 5 seconds
  maxPostsPerDay: 100,     // Maximum posts to collect per day
  commentProbability: 0.1, // Probability of commenting on a post (10%)
  commentTemplates: [
    "Great insights! Thanks for sharing.",
    "This is really valuable information. Thanks for posting!",
    "Interesting perspective. I appreciate you sharing this.",
    "Thanks for sharing these thoughts. Very insightful!",
    "I found this very helpful. Thanks for posting!",
    "Great content as always!",
    "This resonates with me. Thanks for sharing your perspective.",
    "Valuable information! Thanks for putting this out there."
  ],
  skipPromotedPosts: true // Added for the new processFeed function
};

// State management
let collectedPosts = [];
let processedPostIds = new Set();
let isCollecting = false;
let observer = null;
let feedCheckInterval = null;

// Initialize when the page is fully loaded
window.addEventListener('load', () => {
  // Wait a bit for LinkedIn's JS to initialize
  setTimeout(initFeedCollector, 3000);
});

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);
  
  try {
    switch (message.action) {
      case 'startCollection':
        startCollection();
        sendResponse({ success: true, isCollecting: true, message: "Collection started" });
        break;
        
      case 'stopCollection':
        stopCollection();
        sendResponse({ success: true, isCollecting: false, message: "Collection stopped" });
        break;
        
      case 'autoComment':
        toggleAutoComment(message.enabled);
        sendResponse({ success: true, autoComment: message.enabled, message: `Auto-comment ${message.enabled ? 'enabled' : 'disabled'}` });
        break;
        
      case 'clearCollectedPosts':
        collectedPosts = [];
        processedPostIds.clear();
        saveCollectedPosts();
        sendResponse({ success: true, message: "Collected posts cleared" });
        break;
        
      case 'getStatus':
        sendResponse({
          success: true,
          isCollecting: isCollecting,
          collectedCount: collectedPosts.length,
          processedCount: processedPostIds.size
        });
        break;
        
      default:
        sendResponse({ success: false, message: "Unknown action" });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    
    // Check if this is an extension context invalidated error
    if (error.message && error.message.includes("Extension context invalidated")) {
      console.warn("Extension context invalidated. The page may have been refreshed or navigated away.");
      // We can't send a response in this case, as the context is invalid
    } else {
      // For other errors, try to send a response
      try {
        sendResponse({ success: false, error: error.message });
      } catch (sendError) {
        console.error("Error sending response:", sendError);
      }
    }
  }
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});

// Initialize the feed collector
function initFeedCollector() {
  console.log("Initializing LinkedIn feed collector");
  
  // Check if we're on the feed page
  if (window.location.href.includes('linkedin.com/feed')) {
    setupFeedObserver();
    
    // Check for stored settings
    chrome.storage.local.get(['isCollecting', 'autoComment'], (result) => {
      if (result.isCollecting) {
        startCollection();
      }
    });
  }
}

// Set up the observer to detect new posts
function setupFeedObserver() {
  // Target the feed container
  const feedContainer = document.querySelector('.scaffold-finite-scroll__content');
  
  if (!feedContainer) {
    console.log("Feed container not found. Retrying in 2 seconds...");
    setTimeout(setupFeedObserver, 2000);
    return;
  }
  
  // Create a mutation observer to detect when new posts are added
  observer = new MutationObserver((mutations) => {
    if (isCollecting) {
      processFeed();
    }
  });
  
  // Start observing
  observer.observe(feedContainer, { 
    childList: true,
    subtree: true 
  });
  
  console.log("Feed observer set up successfully");
}

// Start collecting posts
function startCollection() {
  console.log("Starting LinkedIn feed collection");
  
  if (isCollecting) {
    console.log("Collection already active");
    return;
  }
  
  isCollecting = true;
  
  // Save state
  chrome.storage.local.set({ isCollecting: true }, () => {
    console.log("Collection state saved to storage");
  });
  
  // Process current feed
  processFeed();
  
  // Set up interval to check for new posts
  feedCheckInterval = setInterval(processFeed, CONFIG.feedCheckInterval);
  
  // Update badge
  updateBadgeCount();
  
  console.log("LinkedIn feed collection started");
}

// Stop collecting posts
function stopCollection() {
  console.log("Stopping LinkedIn feed collection");
  
  if (!isCollecting) {
    console.log("Collection already inactive");
    return;
  }
  
  isCollecting = false;
  
  // Save state
  chrome.storage.local.set({ isCollecting: false }, () => {
    console.log("Collection state saved to storage");
  });
  
  // Clear interval
  if (feedCheckInterval) {
    clearInterval(feedCheckInterval);
    feedCheckInterval = null;
  }
  
  console.log("LinkedIn feed collection stopped");
}

// Process the LinkedIn feed
function processFeed() {
  if (!isCollecting) return;
  
  // Find all posts in the feed - use more comprehensive selectors to catch all post types
  const posts = document.querySelectorAll('.feed-shared-update-v2, .occludable-update, .feed-shared-update, .update-components-actor');
  
  if (posts.length === 0) {
    console.log("No posts found in feed");
    return;
  }
  
  console.log(`Found ${posts.length} posts in feed`);
  
  // Keep track of content hashes in this processing batch to avoid duplicates
  const contentHashes = new Set();
  
  // Process each post
  posts.forEach(post => {
    try {
      // Check if it's a promoted post
      const isPromoted = post.querySelector('.feed-shared-actor__sub-description')?.textContent.includes('Promoted') || 
                         post.querySelector('.update-components-actor__description')?.textContent.includes('Promoted') ||
                         post.querySelector('.update-components-actor__sub-description')?.textContent.includes('Promoted');
      
      // Skip promoted posts if configured to do so
      if (isPromoted && CONFIG.skipPromotedPosts) {
        console.log("Skipping promoted post");
        return;
      }
      
      // Extract content for deduplication check
      let content;
      try {
        content = extractContent(post);
      } catch (error) {
        console.warn("Error extracting content for deduplication:", error);
        content = "";
      }
      
      // Create a simple hash of the content for deduplication
      const contentHash = simpleHash(content);
      
      // Skip if we've seen this content in this batch
      if (contentHash && contentHashes.has(contentHash)) {
        console.log("Skipping duplicate content");
        return;
      }
      
      // Add to our batch tracking
      if (contentHash) {
        contentHashes.add(contentHash);
      }
      
      processPost(post);
    } catch (error) {
      console.error("Error processing post:", error);
    }
  });
  
  // Save collected posts to storage
  if (collectedPosts.length > 0) {
    saveCollectedPosts();
  }
}

// Simple string hashing function
function simpleHash(str) {
  if (!str || typeof str !== 'string' || str.length < 10) return null;
  
  // Take the first 100 chars to avoid performance issues with very long posts
  const sample = str.substring(0, 100);
  
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

// Process a single post
function processPost(postElement) {
  try {
    // Skip if element is no longer in the DOM
    if (!postElement || !postElement.isConnected) {
      return;
    }
    
    // Extract post ID
    const postId = extractPostId(postElement);
    
    // Skip if already processed or no ID found
    if (!postId || processedPostIds.has(postId)) {
      return;
    }
    
    // Mark as processed
    processedPostIds.add(postId);
    
    // Extract post data with error handling for each step
    let author, content, engagement, url;
    
    try {
      author = extractAuthor(postElement);
    } catch (error) {
      console.warn("Error extracting author:", error);
      author = { name: "Unknown" };
    }
    
    try {
      content = extractContent(postElement);
    } catch (error) {
      console.warn("Error extracting content:", error);
      content = "Content could not be extracted";
    }
    
    try {
      engagement = extractEngagement(postElement);
    } catch (error) {
      console.warn("Error extracting engagement:", error);
      engagement = { likes: 0, comments: 0, shares: 0 };
    }
    
    try {
      url = extractPostUrl(postElement);
    } catch (error) {
      console.warn("Error extracting URL:", error);
      url = "";
    }
    
    // Create post data object
    const postData = {
      id: postId,
      timestamp: new Date().toISOString(),
      author: author,
      content: content,
      engagement: engagement,
      url: url
    };
    
    // Add to collected posts
    collectedPosts.push(postData);
    console.log("Collected post:", postData);
    
    // Check if we should auto-comment
    chrome.storage.local.get(['autoComment'], (result) => {
      if (result.autoComment && Math.random() < CONFIG.commentProbability) {
        const randomComment = CONFIG.commentTemplates[
          Math.floor(Math.random() * CONFIG.commentTemplates.length)
        ];
        
        // Add a small delay before commenting
        setTimeout(() => {
          commentOnPost(postId, randomComment);
        }, 2000 + Math.random() * 5000); // Random delay between 2-7 seconds
      }
    });
    
    // Limit the number of posts we collect
    if (collectedPosts.length > CONFIG.maxPostsPerDay) {
      collectedPosts.shift(); // Remove oldest post
    }
  } catch (error) {
    console.error("Error processing post:", error);
  }
}

// Extract post ID
function extractPostId(postElement) {
  // Try multiple methods to find the post ID
  
  // Method 1: Look for data-urn attribute
  const urnElement = postElement.querySelector('[data-urn]');
  if (urnElement && urnElement.getAttribute('data-urn')) {
    return urnElement.getAttribute('data-urn');
  }
  
  // Method 2: Look for data-id attribute
  const idElement = postElement.querySelector('[data-id]');
  if (idElement && idElement.getAttribute('data-id')) {
    return idElement.getAttribute('data-id');
  }
  
  // Method 3: Look for data-activity-urn attribute
  const activityElement = postElement.querySelector('[data-activity-urn]');
  if (activityElement && activityElement.getAttribute('data-activity-urn')) {
    return activityElement.getAttribute('data-activity-urn');
  }
  
  // Method 4: Look for article link with articleId
  const articleLink = postElement.querySelector('a[href*="articleId="]');
  if (articleLink && articleLink.href) {
    const match = articleLink.href.match(/articleId=([^&]+)/);
    if (match && match[1]) {
      return `article:${match[1]}`;
    }
  }
  
  // Method 5: Try to extract from any link that might contain a post ID
  const anyLink = postElement.querySelector('a[href*="/feed/update/"]');
  if (anyLink && anyLink.href) {
    const match = anyLink.href.match(/\/feed\/update\/([^?/]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Fallback: Generate a unique ID based on content and author
  const content = extractContent(postElement);
  const author = extractAuthor(postElement);
  if (content && author) {
    // Use a combination of author name/id and content to create a unique hash
    const uniqueString = `${author.name || author.profileId || 'unknown'}-${content.substring(0, 50)}`;
    return btoa(uniqueString).replace(/[+/=]/g, ''); // Base64 encode and remove special chars
  }
  
  // Last resort: random ID with timestamp to ensure uniqueness
  return `unknown-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// Extract author information
function extractAuthor(postElement) {
  try {
    // Try multiple selectors for author name and profile link
    const authorElement = postElement.querySelector('.feed-shared-actor__name, .update-components-actor__name, .update-components-actor__title, .feed-shared-actor__title');
    const titleElement = postElement.querySelector('.feed-shared-actor__description, .update-components-actor__description, .update-components-actor__subtitle, .feed-shared-actor__subtitle');
    const actorLink = postElement.querySelector('.feed-shared-actor__container a, .update-components-actor__container a, .update-components-actor a, .feed-shared-actor a');
    
    // Get profile URL from the actor link
    let profileUrl = '';
    if (actorLink && actorLink.href) {
      profileUrl = actorLink.href;
      // Clean up the URL to ensure it's the profile URL
      if (profileUrl.includes('?')) {
        profileUrl = profileUrl.split('?')[0];
      }
    }
    
    // Try to get the profile ID from the URL
    let profileId = '';
    if (profileUrl) {
      // Extract the profile ID from the URL (e.g., linkedin.com/in/profile-id)
      const matches = profileUrl.match(/linkedin\.com\/in\/([^\/]+)/);
      if (matches && matches[1]) {
        profileId = matches[1];
      }
    }
    
    // Get the author's image URL
    const authorImageElement = postElement.querySelector('.feed-shared-actor__avatar-image, .update-components-actor__avatar-image, .presence-entity__image');
    let authorImageUrl = '';
    
    if (authorImageElement && authorImageElement.src) {
      authorImageUrl = authorImageElement.src;
    } else {
      // Try data-delayed-url attribute which LinkedIn sometimes uses
      const delayedImage = postElement.querySelector('[data-delayed-url]');
      if (delayedImage) {
        authorImageUrl = delayedImage.getAttribute('data-delayed-url');
      }
    }
    
    // Get author name and connection status
    let authorName = 'Unknown';
    let connectionStatus = '';
    
    if (authorElement && authorElement.textContent) {
      const fullText = authorElement.textContent.trim();
      
      // Split by bullet points to separate name from connection status
      const parts = fullText.split('•').map(part => part.trim());
      
      if (parts.length > 0) {
        // First part is the name
        let name = parts[0];
        
        // Check for duplicated names (e.g., "Behshad BehzadiBehshad Behzadi")
        if (name.length > 10) {
          const halfLength = Math.floor(name.length / 2);
          const firstHalf = name.substring(0, halfLength).trim();
          const secondHalf = name.substring(halfLength).trim();
          
          // If the two halves are very similar, use just the first half
          if (firstHalf.length > 3 && secondHalf.startsWith(firstHalf.substring(0, 3))) {
            name = firstHalf;
          }
        }
        
        authorName = name;
        
        // Look for connection status in the remaining parts
        for (let i = 1; i < parts.length; i++) {
          if (parts[i].includes('1st') || parts[i].includes('2nd') || 
              parts[i].includes('3rd') || parts[i].includes('Following')) {
            connectionStatus = parts[i];
            break;
          }
        }
      }
    } else if (profileId) {
      // Use profile ID as fallback
      authorName = profileId;
    }
    
    // Get title/description
    let authorTitle = '';
    if (titleElement && titleElement.textContent) {
      const titleText = titleElement.textContent.trim();
      
      // Remove duplicated information
      const titleParts = titleText.split('•').map(part => part.trim());
      if (titleParts.length > 0) {
        // Use Set to remove duplicates
        const uniqueParts = [...new Set(titleParts)];
        authorTitle = uniqueParts.join(', ');
      } else {
        authorTitle = titleText;
      }
    }
    
    return {
      name: authorName,
      connectionStatus: connectionStatus,
      title: authorTitle,
      profileUrl: profileUrl,
      profileId: profileId,
      imageUrl: authorImageUrl
    };
  } catch (error) {
    console.error("Error extracting author:", error);
    // Return a minimal object with the name to ensure backward compatibility
    return {
      name: "Unknown Author",
      connectionStatus: "",
      title: "",
      profileUrl: "",
      profileId: "",
      imageUrl: ""
    };
  }
}

// Extract post content
function extractContent(postElement) {
  // Check for regular text posts first (most common)
  const feedTextElement = postElement.querySelector('.feed-shared-text, .feed-shared-update-v2__description, .update-components-text, .feed-shared-text__text-view');
  if (feedTextElement) {
    return feedTextElement.textContent.trim();
  }
  
  // Check for activity updates (likes, comments, etc.)
  const activityElement = postElement.querySelector('.feed-shared-update-v2__description-wrapper');
  if (activityElement) {
    return activityElement.textContent.trim();
  }
  
  // Check for shared articles
  const articleElement = postElement.querySelector('.feed-shared-article__description, .feed-shared-article__subtitle, .feed-shared-news-module__headline');
  if (articleElement) {
    const title = postElement.querySelector('.feed-shared-article__title, .feed-shared-news-module__headline');
    return `[Shared Article] ${title ? title.textContent.trim() : ''} - ${articleElement.textContent.trim()}`;
  }
  
  // Check for shared posts
  const sharedElement = postElement.querySelector('.feed-shared-update-v2__reshared-content-container');
  if (sharedElement) {
    const sharedText = sharedElement.querySelector('.feed-shared-text, .feed-shared-update-v2__description');
    const sharedAuthor = sharedElement.querySelector('.feed-shared-actor__name, .update-components-actor__name');
    return `[Shared Post] ${sharedAuthor ? 'From ' + sharedAuthor.textContent.trim() + ': ' : ''}${sharedText ? sharedText.textContent.trim() : ''}`;
  }
  
  // Check for shared images
  const imageElement = postElement.querySelector('.feed-shared-image__container, .feed-shared-image');
  if (imageElement) {
    const imageCaption = postElement.querySelector('.feed-shared-text, .feed-shared-update-v2__description');
    return `[Shared Image] ${imageCaption ? imageCaption.textContent.trim() : 'No caption'}`;
  }
  
  // Check for shared videos
  const videoElement = postElement.querySelector('.feed-shared-video, .video-s-loader');
  if (videoElement) {
    const videoCaption = postElement.querySelector('.feed-shared-text, .feed-shared-update-v2__description');
    return `[Shared Video] ${videoCaption ? videoCaption.textContent.trim() : 'No caption'}`;
  }
  
  // Check for shared documents
  const documentElement = postElement.querySelector('.feed-shared-document, .feed-shared-document__container');
  if (documentElement) {
    const documentTitle = postElement.querySelector('.feed-shared-document__title');
    return `[Shared Document] ${documentTitle ? documentTitle.textContent.trim() : 'No title'}`;
  }
  
  // Check for polls
  const pollElement = postElement.querySelector('.feed-shared-poll');
  if (pollElement) {
    const pollQuestion = postElement.querySelector('.feed-shared-poll__question-text');
    return `[Poll] ${pollQuestion ? pollQuestion.textContent.trim() : 'No question'}`;
  }
  
  // Check for job postings
  const jobElement = postElement.querySelector('.job-card-container');
  if (jobElement) {
    const jobTitle = postElement.querySelector('.job-card-list__title');
    const company = postElement.querySelector('.job-card-container__company-name');
    return `[Job Posting] ${jobTitle ? jobTitle.textContent.trim() : ''} at ${company ? company.textContent.trim() : ''}`;
  }
  
  // Check for events
  const eventElement = postElement.querySelector('.feed-shared-event');
  if (eventElement) {
    const eventTitle = postElement.querySelector('.feed-shared-event__title');
    return `[Event] ${eventTitle ? eventTitle.textContent.trim() : 'No title'}`;
  }
  
  // If no content is found, try to get any text content from the post
  const anyText = postElement.textContent.trim();
  if (anyText) {
    // Limit to a reasonable length to avoid capturing too much unrelated content
    return anyText.substring(0, 500) + (anyText.length > 500 ? '...' : '');
  }
  
  // If no content is found, return a default message
  return '[No content available]';
}

// Extract engagement metrics
function extractEngagement(postElement) {
  // Try multiple selectors for engagement metrics
  const socialCountsSection = postElement.querySelector('.social-details-social-counts, .social-details-social-activity');
  
  // Default values
  let likes = 0;
  let comments = 0;
  let shares = 0;
  
  if (socialCountsSection) {
    // Get likes/reactions
    const likeCount = socialCountsSection.querySelector('.social-details-social-counts__reactions-count, .social-activity-counts__reactions-count');
    if (likeCount) {
      // Handle number formatting (e.g., "1K" -> 1000)
      const likeText = likeCount.textContent.trim();
      if (likeText.includes('K')) {
        likes = parseFloat(likeText.replace('K', '')) * 1000;
      } else if (likeText.includes('M')) {
        likes = parseFloat(likeText.replace('M', '')) * 1000000;
      } else {
        likes = parseInt(likeText) || 0;
      }
    }
    
    // Get comments
    const commentCount = socialCountsSection.querySelector('.social-details-social-counts__comments, .social-activity-counts__comments');
    if (commentCount) {
      const commentText = commentCount.textContent.trim();
      if (commentText.includes('K')) {
        comments = parseFloat(commentText.replace('K', '')) * 1000;
      } else if (commentText.includes('M')) {
        comments = parseFloat(commentText.replace('M', '')) * 1000000;
      } else {
        comments = parseInt(commentText) || 0;
      }
    }
    
    // Get shares/reposts
    const shareCount = socialCountsSection.querySelector('.social-details-social-counts__shares, .social-activity-counts__shares');
    if (shareCount) {
      const shareText = shareCount.textContent.trim();
      if (shareText.includes('K')) {
        shares = parseFloat(shareText.replace('K', '')) * 1000;
      } else if (shareText.includes('M')) {
        shares = parseFloat(shareText.replace('M', '')) * 1000000;
      } else {
        shares = parseInt(shareText) || 0;
      }
    }
  }
  
  return {
    likes: likes,
    comments: comments,
    shares: shares,
    total: likes + comments + shares
  };
}

// Extract post URL
function extractPostUrl(postElement) {
  // Method 1: Try to find a direct link to the post
  const directLink = postElement.querySelector('.feed-shared-update-v2__update-link-container a, .update-components-link');
  if (directLink && directLink.href) {
    return directLink.href;
  }
  
  // Method 2: Try to extract from data-urn attribute
  const urnElement = postElement.querySelector('[data-urn]');
  if (urnElement && urnElement.getAttribute('data-urn')) {
    const urn = urnElement.getAttribute('data-urn');
    // LinkedIn URNs for posts often follow this pattern: urn:li:activity:1234567890
    if (urn.includes('activity:')) {
      const activityId = urn.split('activity:')[1];
      return `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}`;
    }
  }
  
  // Method 3: Try to find the "Copy link" button and extract the post ID
  const actionsContainer = postElement.querySelector('.feed-shared-social-actions, .social-details-social-activity');
  if (actionsContainer) {
    const postId = extractPostId(postElement);
    if (postId && postId.includes('activity:')) {
      return `https://www.linkedin.com/feed/update/${postId}`;
    }
  }
  
  // Fallback: Return current page URL with a note
  return `${window.location.href}#unknown-post-url`;
}

// Save collected posts to Chrome storage
function saveCollectedPosts() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  chrome.storage.local.get(['feedHistory'], (result) => {
    const feedHistory = result.feedHistory || {};
    
    // Add today's posts
    feedHistory[today] = collectedPosts;
    
    // Keep only the last 7 days
    const dates = Object.keys(feedHistory).sort();
    if (dates.length > 7) {
      const oldestDate = dates[0];
      delete feedHistory[oldestDate];
    }
    
    // Save back to storage
    chrome.storage.local.set({ feedHistory });
    
    // Notify background script
    chrome.runtime.sendMessage({
      action: 'postsUpdated',
      count: collectedPosts.length,
      date: today
    });
  });
}

// Comment on a post
async function commentOnPost(postId, commentText) {
  console.log(`Attempting to comment on post ${postId}: "${commentText}"`);
  
  try {
    // Find the post element
    const postElement = findPostElementById(postId);
    if (!postElement) {
      throw new Error("Post element not found");
    }
    
    // Find the comment button and click it
    const commentButton = postElement.querySelector('button[aria-label="Comment"]');
    if (!commentButton) {
      throw new Error("Comment button not found");
    }
    
    commentButton.click();
    
    // Wait for the comment box to appear
    await waitForElement('.comments-comment-box__form-container');
    
    // Find the comment input and type the comment
    const commentInput = document.querySelector('.ql-editor');
    if (!commentInput) {
      throw new Error("Comment input not found");
    }
    
    // Set the comment text
    commentInput.textContent = commentText;
    commentInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Find and click the post button
    await waitForElement('button.comments-comment-box__submit-button:not(:disabled)');
    const postButton = document.querySelector('button.comments-comment-box__submit-button');
    
    if (!postButton) {
      throw new Error("Post button not found");
    }
    
    postButton.click();
    
    console.log(`Successfully commented on post ${postId}`);
    return { success: true };
  } catch (error) {
    console.error(`Error commenting on post ${postId}:`, error);
    return { success: false, error: error.message };
  }
}

// Find a post element by its ID
function findPostElementById(postId) {
  const posts = document.querySelectorAll('.feed-shared-update-v2');
  
  for (const post of posts) {
    const idElement = post.querySelector('[data-urn]');
    if (idElement && idElement.getAttribute('data-urn') === postId) {
      return post;
    }
  }
  
  return null;
}

// Toggle auto-commenting
function toggleAutoComment(enabled) {
  console.log(`${enabled ? 'Enabling' : 'Disabling'} auto-commenting`);
  
  chrome.storage.local.set({ autoComment: enabled }, () => {
    console.log(`Auto-commenting ${enabled ? 'enabled' : 'disabled'} and saved to storage`);
  });
}

// Helper function to wait for an element to appear
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

// Update badge count
function updateBadgeCount() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Get today's posts
  chrome.storage.local.get(['feedHistory'], (result) => {
    const feedHistory = result.feedHistory || {};
    const todayPosts = feedHistory[today] || [];
    
    // Send message to background script to update badge
    chrome.runtime.sendMessage({
      action: 'postsUpdated',
      count: todayPosts.length
    });
  });
} 