// LinkedIn Feed Collector - View All Posts Script
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const postsContainer = document.getElementById('posts-container');
  const pagination = document.getElementById('pagination');
  const dateFilter = document.getElementById('date-filter');
  const authorFilter = document.getElementById('author-filter');
  const searchInput = document.getElementById('search-input');
  const exportBtn = document.getElementById('export-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const backBtn = document.getElementById('back-btn');
  
  // State variables
  let allPosts = [];
  let filteredPosts = [];
  let currentPage = 1;
  const postsPerPage = 10;
  
  // Initialize
  loadPosts();
  
  // Event listeners
  dateFilter.addEventListener('change', applyFilters);
  authorFilter.addEventListener('change', applyFilters);
  searchInput.addEventListener('input', applyFilters);
  
  exportBtn.addEventListener('click', () => {
    const format = prompt('Choose export format (json, csv, txt):', 'json');
    if (format) {
      chrome.runtime.sendMessage({
        action: 'exportData',
        format: format.toLowerCase()
      });
    }
  });
  
  refreshBtn.addEventListener('click', loadPosts);
  
  backBtn.addEventListener('click', () => {
    window.close();
  });
  
  // Load all posts from storage
  function loadPosts() {
    postsContainer.innerHTML = '<div class="loading">Loading posts...</div>';
    
    chrome.storage.local.get(['feedHistory'], (result) => {
      const feedHistory = result.feedHistory || {};
      
      // Reset all posts array
      allPosts = [];
      
      // Process all posts from all days
      Object.entries(feedHistory).forEach(([date, posts]) => {
        posts.forEach(post => {
          allPosts.push({
            ...post,
            date
          });
        });
      });
      
      // Sort by timestamp (newest first)
      allPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Populate filters
      populateFilters(allPosts);
      
      // Apply initial filters
      applyFilters();
    });
  }
  
  // Populate filter dropdowns
  function populateFilters(posts) {
    // Clear existing options (except the first one)
    while (dateFilter.options.length > 1) {
      dateFilter.remove(1);
    }
    
    while (authorFilter.options.length > 1) {
      authorFilter.remove(1);
    }
    
    // Get unique dates
    const dates = [...new Set(posts.map(post => post.date))].sort().reverse();
    
    // Add date options
    dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = formatDate(date);
      dateFilter.appendChild(option);
    });
    
    // Get unique authors
    const authors = [...new Set(posts.map(post => post.author.name))].sort();
    
    // Add author options
    authors.forEach(author => {
      const option = document.createElement('option');
      option.value = author;
      option.textContent = author;
      authorFilter.appendChild(option);
    });
  }
  
  // Apply filters and search
  function applyFilters() {
    const selectedDate = dateFilter.value;
    const selectedAuthor = authorFilter.value;
    const searchTerm = searchInput.value.toLowerCase();
    
    // Filter posts
    filteredPosts = allPosts.filter(post => {
      // Date filter
      if (selectedDate !== 'all' && post.date !== selectedDate) {
        return false;
      }
      
      // Author filter
      if (selectedAuthor !== 'all' && post.author.name !== selectedAuthor) {
        return false;
      }
      
      // Search filter
      if (searchTerm && !post.content.toLowerCase().includes(searchTerm)) {
        return false;
      }
      
      return true;
    });
    
    // Reset to first page
    currentPage = 1;
    
    // Render posts and pagination
    renderPosts();
    renderPagination();
  }
  
  // Render posts for current page
  function renderPosts() {
    // Calculate start and end indices
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    
    // Get posts for current page
    const postsToShow = filteredPosts.slice(startIndex, endIndex);
    
    // Check if there are any posts
    if (filteredPosts.length === 0) {
      postsContainer.innerHTML = '<div class="no-data">No posts found matching your filters</div>';
      return;
    }
    
    // Create HTML for posts
    let html = '<div class="post-list">';
    
    postsToShow.forEach(post => {
      // Ensure author name is properly displayed
      const authorName = post.author && post.author.name && post.author.name !== 'Unknown' 
        ? post.author.name 
        : (post.author && post.author.profileId ? post.author.profileId : 'Unknown');
      
      // Default profile image if none available
      const profileImg = post.author && post.author.imageUrl 
        ? post.author.imageUrl 
        : 'https://static.licdn.com/sc/h/1c5u578iilxfi4m4dvc4q810q';
      
      html += `
        <div class="post-item">
          <div class="post-header">
            <div class="post-author-img">
              <img src="${profileImg}" alt="${authorName}" />
            </div>
            <div class="post-author-info">
              <div class="post-author-name">${authorName}</div>
              <div class="post-author-title">${post.author.title || ''}</div>
              <div class="post-date">${formatDate(post.date)}</div>
            </div>
          </div>
          
          <div class="post-content">${post.content}</div>
          
          <div class="post-engagement">
            <span>${post.engagement.likes || 0} likes</span>
            <span>${post.engagement.comments || 0} comments</span>
            <span>${post.engagement.shares || 0} shares</span>
          </div>
          
          <div class="post-actions">
            <a href="${post.url}" target="_blank" class="post-link">View on LinkedIn</a>
            <button class="copy-btn" data-post-id="${post.id}">Copy Text</button>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Update container
    postsContainer.innerHTML = html;
    
    // Add event listeners to copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const postId = e.target.getAttribute('data-post-id');
        const post = filteredPosts.find(p => p.id === postId);
        
        if (post) {
          navigator.clipboard.writeText(post.content)
            .then(() => {
              // Change button text temporarily
              const originalText = e.target.textContent;
              e.target.textContent = 'Copied!';
              
              setTimeout(() => {
                e.target.textContent = originalText;
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy text: ', err);
            });
        }
      });
    });
  }
  
  // Render pagination
  function renderPagination() {
    // Calculate total pages
    const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
    
    // Clear pagination
    pagination.innerHTML = '';
    
    // Don't show pagination if there's only one page
    if (totalPages <= 1) {
      return;
    }
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderPosts();
        renderPagination();
      }
    });
    pagination.appendChild(prevBtn);
    
    // Page buttons
    const maxButtons = 5; // Maximum number of page buttons to show
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.classList.toggle('active', i === currentPage);
      
      pageBtn.addEventListener('click', () => {
        currentPage = i;
        renderPosts();
        renderPagination();
      });
      
      pagination.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderPosts();
        renderPagination();
      }
    });
    pagination.appendChild(nextBtn);
  }
  
  // Helper: Format date
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
}); 