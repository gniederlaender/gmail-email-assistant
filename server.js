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
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
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

// Task detection function
function detectTask(instructions) {
  const lowerInstructions = instructions.toLowerCase();
  
  if (lowerInstructions.includes('summarize') || lowerInstructions.includes('summary')) {
    return 'summarize';
  } else if (lowerInstructions.includes('todo') || lowerInstructions.includes('task') || lowerInstructions.includes('action')) {
    return 'todos';
  } else if (lowerInstructions.includes('analyze') || lowerInstructions.includes('analysis')) {
    return 'analyze';
  } else if (lowerInstructions.includes('translate') || lowerInstructions.includes('translation')) {
    return 'translate';
  } else {
    return 'respond'; // Default task
  }
}

// Prompt templates for different tasks
const promptTemplates = {
  summarize: `Please provide a concise summary of the following business email:

From: {sender}
Subject: {subject}

Email Content:
{content}

{additionalInstructions}

Please create a summary that:
1. Captures the main points and key information
2. Identifies any action items or deadlines
3. Highlights important details
4. Is professional and well-structured
5. Sign with Gabor

Summary:`,

  todos: `Please extract and organize action items from the following business email:

From: {sender}
Subject: {subject}

Email Content:
{content}

{additionalInstructions}

Please create a task list that:
1. Identifies all action items and tasks mentioned
2. Prioritizes tasks by urgency/importance
3. Includes any deadlines or timeframes
4. Clarifies who is responsible for each task
5. Adds any missing context or requirements
6. Sign with Gabor

Task List:`,

  analyze: `Please provide a detailed analysis of the following business email:

From: {sender}
Subject: {subject}

Email Content:
{content}

{additionalInstructions}

Please provide an analysis that:
1. Identifies the main business objectives
2. Assesses potential risks or concerns
3. Suggests strategic considerations
4. Evaluates the impact on business operations
5. Provides recommendations if applicable
6. Sign with Gabor

Analysis:`,

  translate: `Please translate the following business email:

From: {sender}
Subject: {subject}

Email Content:
{content}

{additionalInstructions}

Please provide a translation that:
1. Maintains the professional tone and business context
2. Preserves all important details and technical terms
3. Ensures cultural appropriateness
4. Keeps the same level of formality
5. Sign with Gabor

Translation:`,

  respond: `I received the following business email and need to generate a professional response:

From: {sender}
Subject: {subject}

{additionalInstructions}

Email Content:
{content}

Please generate a professional, helpful response that:
1. Addresses the sender's request appropriately
2. Maintains a friendly and professional tone
3. Is concise but complete
4. Includes appropriate greetings and closing
5. Sign with Gabor
6. In case the request is in another language, please answer in the same language
7. Follows any specific instructions provided above

Response:`
};

// Generate AI response with task-specific prompts
async function generateResponse(emailContent, sender, subject, instructions) {
  try {
    const task = detectTask(instructions);
    console.log(`\n=== Detected Task: ${task} ===`);
    
    const template = promptTemplates[task];
    const additionalInstructions = instructions ? `Additional Instructions:\n${instructions}\n\n` : '';
    
    const prompt = template
      .replace('{sender}', sender)
      .replace('{subject}', subject)
      .replace('{content}', emailContent)
      .replace('{additionalInstructions}', additionalInstructions);

    console.log(`\n=== Using ${task} prompt template ===`);
    console.log('Prompt preview:', prompt.substring(0, 200) + '...');

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a professional business assistant helping with ${task} tasks. Generate appropriate, professional ${task} outputs for business emails.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800, // Increased for more detailed outputs
      temperature: 0.7
    });

    const response = completion.choices[0].message.content.trim();
    console.log(`\n=== Generated ${task} response ===`);
    console.log(response.substring(0, 200) + '...');
    
    return response;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'Error generating response. Please try again.';
  }
}

// Send email response with task-specific formatting
async function sendResponse(to, subject, body, originalEmailId, task = 'respond') {
  try {
    // Create task-specific subject lines
    const subjectPrefixes = {
      summarize: 'Summary:',
      todos: 'Action Items:',
      analyze: 'Analysis:',
      translate: 'Translation:',
      respond: 'Re:'
    };
    
    const subjectPrefix = subjectPrefixes[task] || 'Re:';
    const emailSubject = `${subjectPrefix} ${subject}`;
    
    // Create task-specific HTML formatting
    const taskTitles = {
      summarize: 'Email Summary',
      todos: 'Action Items & Tasks',
      analyze: 'Business Analysis',
      translate: 'Email Translation',
      respond: 'AI Generated Response'
    };
    
    const taskTitle = taskTitles[task] || 'AI Generated Response';
    
    const mailOptions = {
      from: process.env.GMAIL_ADDRESS,
      to: to,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
            ${taskTitle}
          </h2>
          <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0;">
            ${body.replace(/\n/g, '<br>')}
          </div>
          <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 20px 0;">
          <p style="color: #7f8c8d; font-size: 12px; font-style: italic;">
            This ${task} was automatically generated by AI. Please review before using.
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`${taskTitle} sent successfully:`, result.messageId);
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
      
      // Only process emails from specific senders (case-insensitive)
      const authorizedSenders = [
        'gabor.niederlaender@erstebank.at',
        'gabor.niederlaender@gmx.at'
      ];
      
      const isAuthorizedSender = authorizedSenders.some(sender => 
        from.toLowerCase().includes(sender.toLowerCase())
      );
      
      if (!isAuthorizedSender) {
        console.log(`Skipping email from: ${from} - not from authorized sender`);
        console.log(`Authorized senders: ${authorizedSenders.join(', ')}`);
        
        // Mark as read even if skipped
        await gmail.users.messages.modify({
          auth: oauth2Client,
          userId: 'me',
          id: message.id,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        });
        
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
      console.log(`Instructions: ${parsed.instructions}`);
      
      // Detect task type
      const task = detectTask(parsed.instructions);
      console.log(`Detected task type: ${task}`);
      
      // Generate AI response
      const aiResponse = await generateResponse(
        parsed.originalContent,
        parsed.originalSender,
        parsed.originalSubject,
        parsed.instructions
      );
      
      // Send response back to the user with task-specific formatting
      await sendResponse(
        process.env.YOUR_COMPANY_EMAIL, // Your company email
        parsed.originalSubject,
        aiResponse,
        message.id,
        task
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