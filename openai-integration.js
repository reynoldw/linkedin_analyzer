// LinkedIn Feed Collector - OpenAI Integration

// API configuration
let apiConfig = {
  apiKey: '', // Will be set from options
  model: 'gpt-3.5-turbo', // Default model
  defaultPrompt: 'What are the key trends and insights from my LinkedIn feed today?'
};

// Initialize API configuration
async function initOpenAI() {
  try {
    const { openaiApiKey, openaiModel, defaultPrompt } = await chrome.storage.local.get(['openaiApiKey', 'openaiModel', 'defaultPrompt']);
    
    if (openaiApiKey) {
      apiConfig.apiKey = openaiApiKey;
    }
    
    if (openaiModel) {
      apiConfig.model = openaiModel;
    }
    
    if (defaultPrompt) {
      apiConfig.defaultPrompt = defaultPrompt;
    }
    
    return { success: true, configured: !!openaiApiKey };
  } catch (error) {
    console.error("Error initializing API:", error);
    return { success: false, error: error.message };
  }
}

// Generate a summary using AI
async function generateOpenAISummary(posts, customPrompt = null) {
  console.log("Starting OpenAI summary generation");
  console.log(`Received ${posts ? posts.length : 0} posts for summarization`);
  
  if (!posts || posts.length === 0) {
    console.error("No posts provided for summarization");
    return {
      success: false,
      error: "No posts provided for summarization",
      fallbackSummary: "No posts available to summarize."
    };
  }
  
  try {
    // Initialize API
    console.log("Initializing API configuration");
    const initResult = await initOpenAI();
    
    if (!initResult.success) {
      console.error("Failed to initialize API:", initResult.error);
      throw new Error("Failed to initialize API: " + initResult.error);
    }
    
    if (!initResult.configured) {
      console.error("API key not configured");
      throw new Error("API key not configured. Please set it in the options page.");
    }
    
    console.log(`API initialized with model: ${apiConfig.model}`);
    
    // Prepare the data for AI
    console.log(`Preparing data for ${posts.length} posts`);
    const postsData = posts.map(post => ({
      author: post.author.name,
      authorTitle: post.author.title,
      content: post.content,
      engagement: {
        likes: post.engagement?.likes || 0,
        comments: post.engagement?.comments || 0,
        shares: post.engagement?.shares || 0
      }
    }));
    
    // Create the prompt - use custom prompt if provided, otherwise use default from settings
    let prompt = customPrompt || apiConfig.defaultPrompt;
    console.log(`Using prompt: ${prompt}`);
    
    // Determine if we're using OpenAI or Claude
    const isClaudeModel = apiConfig.model.toLowerCase().includes('claude');
    console.log(`Using ${isClaudeModel ? 'Claude' : 'OpenAI'} API`);
    
    let endpoint, headers, body;
    
    if (isClaudeModel) {
      // Claude API configuration
      endpoint = 'https://api.anthropic.com/v1/messages';
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiConfig.apiKey,
        'anthropic-version': '2023-06-01'
      };
      body = {
        model: apiConfig.model,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nHere is my LinkedIn feed data with ${posts.length} posts:\n${JSON.stringify(postsData, null, 2)}`
          }
        ],
        max_tokens: 1000
      };
    } else {
      // OpenAI API configuration
      endpoint = 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      };
      body = {
        model: apiConfig.model,
        messages: [
          {
            role: "system",
            content: "You are an AI assistant that analyzes LinkedIn feed data and provides insightful summaries. Be concise, professional, and focus on extracting valuable insights."
          },
          {
            role: "user",
            content: `${prompt}\n\nHere is my LinkedIn feed data with ${posts.length} posts:\n${JSON.stringify(postsData, null, 2)}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      };
    }
    
    // Call the API
    console.log(`Sending request to: ${endpoint}`);
    console.log('Request headers:', JSON.stringify(headers, null, 2).replace(apiConfig.apiKey, '[REDACTED]'));
    console.log('Request body size:', JSON.stringify(body).length, 'bytes');
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      const responseText = await response.text();
      console.log('Response text length:', responseText.length, 'bytes');
      
      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error?.message || errorData.error || response.statusText;
          console.error("API error details:", errorData);
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        throw new Error(`API error: ${errorMessage}`);
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("API response parsed successfully");
      } catch (e) {
        console.error("Error parsing JSON response:", e);
        throw new Error("Invalid JSON response from API");
      }
      
      // Extract the content based on the API used
      let summaryContent;
      if (isClaudeModel) {
        console.log("Extracting content from Claude response");
        summaryContent = data.content?.[0]?.text;
        if (!summaryContent) {
          console.error("Could not find content in Claude response:", data);
          throw new Error("Invalid response format from Claude API");
        }
      } else {
        console.log("Extracting content from OpenAI response");
        summaryContent = data.choices?.[0]?.message?.content;
        if (!summaryContent) {
          console.error("Could not find content in OpenAI response:", data);
          throw new Error("Invalid response format from OpenAI API");
        }
      }
      
      console.log("Summary generation successful");
      return {
        success: true,
        summary: summaryContent
      };
    } catch (fetchError) {
      console.error("Error during API request:", fetchError);
      throw new Error(`API request failed: ${fetchError.message}`);
    }
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return {
      success: false,
      error: error.message,
      fallbackSummary: generateFallbackSummary(posts, customPrompt || apiConfig.defaultPrompt)
    };
  }
}

// Generate a fallback summary without AI
function generateFallbackSummary(posts, customPrompt = null) {
  // Count posts by type
  const articleCount = posts.filter(post => post.content.includes('[Shared Article]')).length;
  const imageCount = posts.filter(post => post.content.includes('[Shared Image]')).length;
  const videoCount = posts.filter(post => post.content.includes('[Shared Video]')).length;
  const textPostCount = posts.length - articleCount - imageCount - videoCount;
  
  // Get unique authors
  const uniqueAuthors = new Set(posts.map(post => post.author.name)).size;
  
  // Calculate average engagement
  const totalEngagement = posts.reduce((sum, post) => {
    return sum + (post.engagement.likes || 0) + (post.engagement.comments || 0);
  }, 0);
  const avgEngagement = totalEngagement / posts.length;
  
  // Get top authors
  const authorCounts = {};
  posts.forEach(post => {
    const authorName = post.author.name;
    authorCounts[authorName] = (authorCounts[authorName] || 0) + 1;
  });
  
  const topAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count} posts)`);
  
  // Get top engaging posts
  const topPosts = posts
    .sort((a, b) => {
      const engagementA = (a.engagement.likes || 0) + (a.engagement.comments || 0);
      const engagementB = (b.engagement.likes || 0) + (b.engagement.comments || 0);
      return engagementB - engagementA;
    })
    .slice(0, 3)
    .map(post => {
      const content = post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content;
      const engagement = (post.engagement.likes || 0) + (post.engagement.comments || 0);
      return `"${content}" by ${post.author.name} (${engagement} interactions)`;
    });
  
  // Create the summary
  return `
    ${customPrompt ? `${customPrompt}\n\n` : ''}LinkedIn Feed Summary:
    
    - Total posts collected: ${posts.length}
    - Unique authors: ${uniqueAuthors}
    - Content breakdown: ${textPostCount} text posts, ${articleCount} articles, ${imageCount} images, ${videoCount} videos
    - Average engagement per post: ${avgEngagement.toFixed(1)}
    
    Top authors in your feed:
    ${topAuthors.map(author => `- ${author}`).join('\n')}
    
    Most engaging content:
    ${topPosts.map(post => `- ${post}`).join('\n')}
  `;
}

// Export the functions
window.openaiIntegration = {
  initOpenAI,
  generateOpenAISummary,
  generateFallbackSummary
}; 