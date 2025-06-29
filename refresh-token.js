const { google } = require('googleapis');
require('dotenv').config();

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Set credentials
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

// Function to refresh token
async function refreshToken() {
  try {
    console.log('Refreshing access token...');
    
    // This will automatically refresh the access token using the refresh token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    console.log('✅ Token refreshed successfully!');
    console.log('New access token expires at:', new Date(credentials.expiry_date));
    
    // Test the new token
    const gmail = google.gmail('v1');
    const response = await gmail.users.labels.list({
      auth: oauth2Client,
      userId: 'me'
    });
    
    console.log('✅ Gmail API test successful!');
    console.log('Found', response.data.labels.length, 'labels');
    
  } catch (error) {
    console.error('❌ Error refreshing token:', error.message);
    if (error.message.includes('invalid_grant')) {
      console.log('\n🔧 Refresh token has expired. You need to get a new one using get-new-token.js');
    }
  }
}

// Run the refresh
refreshToken(); 