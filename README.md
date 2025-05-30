# Gmail Email Assistant

An AI-powered email assistant that automatically processes and responds to forwarded emails using OpenAI's GPT-4. The assistant is specifically configured to handle emails from a designated sender and generate professional responses.

## Features

- Automatic email monitoring and processing
- AI-powered response generation using GPT-4
- Support for forwarded emails in German format
- Secure Gmail API integration
- Configurable response criteria
- Health check endpoint for monitoring
- Manual trigger endpoint for testing

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

## Usage

The assistant will automatically:
1. Monitor your Gmail inbox for new emails
2. Process emails from the authorized sender
3. Generate AI responses based on the email content
4. Send responses back to your company email

### API Endpoints

- `GET /health` - Health check endpoint
- `POST /process-emails` - Manual trigger for email processing

## Security

- Only processes emails from authorized sender (gabor.niederlaender@erstebank.at)
- Uses OAuth2 for Gmail API authentication
- Environment variables for sensitive data
- Secure SMTP connection for sending emails

## Development

The `test/` directory contains test files and is excluded from Git commits.

## License

MIT License

## Author

Gabor Niederlaender 