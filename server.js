const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const gmail = google.gmail('v1');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// OAuth2 client for Gmail API
const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Set credentials (you'll get these from the OAuth flow)
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN
});

// Nodemailer setup for sending emails
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    type: 'OAuth2',
    user: process.env.GMAIL_ADDRESS,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    accessToken: oauth2Client.credentials.access_token
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Store processed email IDs to avoid duplicates
const processedEmails = new Set();

// Email parsing function
function parseForwardedEmail(emailBody) {
  console.log('\n=== Original Email ===');
  console.log(emailBody);
  console.log('\n=== Starting Parsing ===');

  // Common patterns for forwarded emails in German
  const forwardPatterns = [
    /Gesendet von Outlook für iOS/,  // Updated to match the full line including URL
    /Von:.*?Gesendet:.*?Betreff:/s,
    /---------- Weitergeleitete Nachricht ----------/,
    /-----Ursprüngliche Nachricht-----/
  ];
  
  let originalContent = emailBody;
  let originalSender = '';
  let originalSubject = '';
  let instructions = '';
  
  // Extract subject from German format first
  const subjectMatch = emailBody.match(/Betreff:\s*([^\n]+)/);
  if (subjectMatch) {
    originalSubject = subjectMatch[1].trim();
    console.log('\n=== Extracted Subject ===');
    console.log(originalSubject);
  } else {
    console.log('\n=== Subject Pattern Not Found ===');
    console.log('Looking for pattern: Betreff:');
    console.log('In content:', emailBody);
  }
  
    // Extract sender from German format
  const senderMatch = emailBody.match(/Von:\s*(.+?)(?:\n|<)/);
  if (senderMatch) {
    originalSender = senderMatch[1].trim();
    console.log('\n=== Extracted Sender ===');
    console.log(originalSender);
  }

  // Try to extract forwarded content and instructions
  for (const pattern of forwardPatterns) {
    const match = emailBody.match(pattern);
    if (match) {
      console.log('\n=== Matched Forward Pattern ===');
      console.log(pattern);
      const parts = emailBody.split(pattern);
      if (parts.length > 1) {
        // Check if there's any content before the forward marker
        const beforeForward = parts[0].trim();
        if (beforeForward) {
          instructions = beforeForward;
          console.log('\n=== Found Instructions ===');
          console.log(instructions);
        }
        originalContent = parts[1]; // Take the part after the forward marker
        console.log('\n=== Content After Forward Marker ===');
        console.log(originalContent);
        break;
      }
    }
  }
  
  
  // Clean up the content (remove headers and Microsoft Teams info)
  // originalContent = originalContent
  //  .replace(/Microsoft Teams.*$/s, '') // Remove Microsoft Teams section
  //  .replace(/_{3,}.*$/s, '') // Remove separator lines (3 or more underscores)
  //  .replace(/Von:.*?Betreff:.*?\n\n/s, '') // Remove German email headers
  //  .trim();
  
  console.log('\n=== Final Cleaned Content ===');
  console.log(originalContent);
  
  return {
    originalSender,
    originalSubject,
    originalContent: originalContent,
    instructions: instructions.trim(),
    fullForwardedEmail: emailBody
  };
}

// Generate AI response
async function generateResponse(emailContent, sender, subject, instructions) {
  try {
    const prompt = `I received the following business email and need to generate a professional response:

From: ${sender}
Subject: ${subject}

${instructions ? `Instructions for response:\n${instructions}\n\n` : ''}Email Content:
${emailContent}

Please generate a professional, helpful response that:
1. Addresses the sender's request appropriately
2. Maintains a friendly and professional tone
3. Is concise but complete
4. Includes appropriate greetings and closing
5. Sign with Gabor
6. In case the request is in another language, please answer in the same language
${instructions ? '7. Follows the specific instructions provided above' : ''}

Response:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional business assistant helping to draft email responses. Generate appropriate, professional responses to business emails."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'Error generating response. Please try again.';
  }
}

// Send email response
async function sendResponse(to, subject, body, originalEmailId) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_ADDRESS,
      to: to,
      subject: `Re: ${subject} - AI Generated Response`,
      html: `
        <p><strong>AI Generated Response:</strong></p>
        <div style="margin: 15px 0;">
          ${body.replace(/\n/g, '<br>')}
        </div>
        <hr>
        <p><em>This response was automatically generated. Please review before sending.</em></p>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Response sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Check for new emails
async function checkNewEmails() {
  try {
    const response = await gmail.users.messages.list({
      auth: oauth2Client,
      userId: 'me',
      q: 'is:unread in:inbox',
      maxResults: 10
    });

    const messages = response.data.messages || [];
    
    for (const message of messages) {
      if (processedEmails.has(message.id)) {
        continue;
      }

      // Get full message
      const fullMessage = await gmail.users.messages.get({
        auth: oauth2Client,
        userId: 'me',
        id: message.id,
        format: 'full'
      });

      const headers = fullMessage.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      
      // Only process emails from specific sender
      if (!from.includes('gabor.niederlaender@erstebank.at')) {
        console.log(`Skipping email from: ${from} - not from authorized sender`);
        continue;
      }
      
      // Get email body
      let emailBody = '';
      if (fullMessage.data.payload.parts) {
        const textPart = fullMessage.data.payload.parts.find(part => 
          part.mimeType === 'text/plain' || part.mimeType === 'text/html'
        );
        if (textPart && textPart.body.data) {
          emailBody = Buffer.from(textPart.body.data, 'base64').toString();
        }
      } else if (fullMessage.data.payload.body.data) {
        emailBody = Buffer.from(fullMessage.data.payload.body.data, 'base64').toString();
      }

      // Parse forwarded email
      const parsed = parseForwardedEmail(emailBody);
      
      console.log(`Processing email from: ${from}`);
      console.log(`Original sender: ${parsed.originalSender}`);
      console.log(`Original subject: ${parsed.originalSubject}`);
      
      // Generate AI response
      const aiResponse = await generateResponse(
        parsed.originalContent,
        parsed.originalSender,
        parsed.originalSubject,
        parsed.instructions
      );
      
      // Send response back to the user
      await sendResponse(
        process.env.YOUR_COMPANY_EMAIL, // Your company email
        parsed.originalSubject,
        aiResponse,
        message.id
      );
      
      // Mark as processed
      processedEmails.add(message.id);
      
      // Mark as read in Gmail
      await gmail.users.messages.modify({
        auth: oauth2Client,
        userId: 'me',
        id: message.id,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });
      
      console.log(`Processed and responded to email: ${subject}`);
    }
  } catch (error) {
    console.error('Error checking emails:', error);
  }
}

// Start email monitoring
function startEmailMonitoring() {
  console.log('Starting email monitoring...');
  
  // Check immediately
  checkNewEmails();
  
  // Then check every 30 seconds
  setInterval(checkNewEmails, 30000);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'running', timestamp: new Date().toISOString() });
});

// Manual trigger endpoint for testing
app.post('/process-emails', async (req, res) => {
  try {
    await checkNewEmails();
    res.json({ message: 'Email check triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startEmailMonitoring();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});