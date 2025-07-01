# Gmail Email Assistant

An AI-powered email assistant that automatically processes and responds to forwarded emails using OpenAI's GPT-4. The assistant is specifically configured to handle emails from a designated sender and generate professional responses based on different task types.

## Features

- **Automatic email monitoring and processing**
- **AI-powered response generation using GPT-4**
- **Multi-task support**: summarize, todos, analyze, translate, respond
- **Smart task detection** based on instructions in forwarded emails
- **Flexible prompt templates** for different business needs
- **Support for forwarded emails in German format**
- **Secure Gmail API integration**
- **Configurable response criteria**
- **Health check endpoint for monitoring**
- **Manual trigger endpoint for testing**
- **Task-specific email formatting and subject lines**

## Task Types

The assistant uses a consistent task detection system with XML-like tags. The task must be specified between `<t></t>` tags, followed by any additional instructions.

### Task Detection Format
```
<t>task</t> additional instructions here
```

### Supported Tasks

### 1. **Summarize** 
- **Task tag**: `<t>summarize</t>`
- **Purpose**: Creates concise summaries of emails with key points and action items
- **Output**: Professional summary with highlighted important details

### 2. **Todos** 
- **Task tag**: `<t>todos</t>`
- **Purpose**: Extracts and organizes action items from emails
- **Output**: Prioritized task list with deadlines and responsibilities

### 3. **Analyze** 
- **Task tag**: `<t>analyze</t>`
- **Purpose**: Provides detailed business analysis and strategic insights
- **Output**: Comprehensive analysis with risks, recommendations, and strategic considerations

### 4. **Translate** 
- **Task tag**: `<t>translate</t>`
- **Purpose**: Translates emails while maintaining professional tone and context
- **Output**: Professional translation preserving business terminology

### 5. **Write** 
- **Task tag**: `<t>write</t>`
- **Purpose**: Creates new emails based on instructions
- **Output**: Complete new email draft

### 6. **Respond** (Default)
- **Task tag**: `<t>respond</t>`
- **Purpose**: Generates professional email responses
- **Output**: Complete email response with appropriate greetings and closing

**Note**: If no task tag is found, the system falls back to keyword detection for backward compatibility.

## Usage Examples

### Summarize an Email
Forward an email with instructions like:
```
<t>summarize</t> Please highlight the key points and action items
```

### Extract Action Items
Forward an email with instructions like:
```
<t>todos</t> Extract all action items and deadlines from this email
```

### Analyze Business Proposal
Forward an email with instructions like:
```
<t>analyze</t> Provide business analysis and strategic insights
```

### Translate Email
Forward an email with instructions like:
```
<t>translate</t> Translate this German email to English
```

### Write New Email
Forward an email with instructions like:
```
<t>write</t> Create a new email about the quarterly report
```

### Generate Response
Forward an email with instructions like:
```
<t>respond</t> Please help me respond to this email professionally
```

### Multiple Instructions
You can include detailed instructions after the task tag:
```
<t>summarize</t> 
Please create a brief summary focusing on:
- Key decisions made
- Action items with deadlines
- Important financial figures
```

## Prerequisites

- Node.js (v14 or higher)
- Gmail account with 2-step verification enabled
- OpenAI API key
- Google Cloud Project with Gmail API enabled

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=your_redirect_uri
GMAIL_REFRESH_TOKEN=your_refresh_token
GMAIL_ADDRESS=your_gmail_address
OPENAI_API_KEY=your_openai_api_key
YOUR_COMPANY_EMAIL=your_company_email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/gniederlaender/gmail-email-assistant.git
cd gmail-email-assistant
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables in `.env`

4. Start the server:
```bash
node server.js
```

## Testing

Run the test script to see how the new task detection system works:
```bash
node test-task-detection.js
```

This will demonstrate the new `<t></t>` tag format and show how additional instructions are extracted.

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /process-emails` - Manual trigger for email processing

## Security

- Only processes emails from authorized senders:
  - gabor.niederlaender@erstebank.at
  - gabor.niederlaender@gmx.at
- Uses OAuth2 for Gmail API authentication
- Environment variables for sensitive data
- Secure SMTP connection for sending emails

## Development

The `test/` directory contains test files and is excluded from Git commits.

## License

MIT License

## Author

Gabor Niederlaender 