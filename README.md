# Foundation Health - MP3 frame counting application

A serverless application built with Pulumi featuring a Node.js ping Lambda function fronted by API Gateway, with LocalStack support for local development.

## Architecture

- **API Gateway (REST API)**: Handles incoming HTTP requests
- **Lambda Function**: Node.js function that responds to ping requests
- **LocalStack**: Local AWS cloud stack for development

## Prerequisites

- Node.js 20+
- Docker running (for LocalStack)
- Docker Compose (included with Docker)
- Pulumi CLI (https://www.pulumi.com/docs/iac/download-install/)

## Project Structure

```
foundation-health/
├── infrastructure/         # Pulumi infrastructure code
├── scripts/                # CLI helper scripts
├── src/
│   └── functions/          # Lambda functions
│       └── mp3/
│           └── analyse.ts  # Lambda function for counting frames in file
├── docker-compose.yml      # LocalStack configuration
├── build.js                # Script for building ts code with esbuild
└── package.json
```

## Setup

1. **Verify setup requirements:**
   ```bash
   npm run setup:check
   ```
2. **Setup Pulumi**
If Pulumi is not configured, follow instructions at https://www.pulumi.com/docs/get-started/install/ to download and install.
If you do not want to use Pulumi Cloud, you can use the local file system backend. For the purposes of this test, that is recommended:
   ```bash
   pulumi login --local
   ```

3. **Install dependencies:**
   ```bash
   npm install
   cd infrastructure
   npm install
   cd ..
   ```

4. **Start Docker** (required for LocalStack)

5. **Start LocalStack (for local development):**
   ```bash
   npm run localstack:start
   ```

6. **Run the application locally:**
   ```bash
   npm run deploy:local
   ```

## Available Scripts

* npm run build - Build the application
* npm run build:tsc - Build TypeScript using tsc
* npm run lint - Run ESLint on the src directory
* npm run lint:fix - Run ESLint and automatically fix problems
* npm run prettier - Check code formatting with Prettier
* npm run prettier:fix - Format code with Prettier
* npm run typecheck - Run TypeScript type checking
* npm run localstack:start - Start LocalStack container
* npm run localstack:stop - Stop LocalStack container
* npm run localstack:logs - View LocalStack logs
* npm run setup:check - Verify setup requirements
* npm run deploy:local - Build and deploy to LocalStack

## Local Development with LocalStack

LocalStack provides a local AWS cloud stack for development and testing. This project is configured to deploy to localstack and not AWS.

### Testing the endpoints

Once deployed, the Pulumi log should display an output similar to this:

```bash
Outputs:
  ~ url: "https://0hbpmzxlvm.execute-api.us-east-1.amazonaws.com/fh-backend"

Resources:
    + 29 created
    1 unchanged

Duration: 31s
```
This will display the API Gateway URL. For localstack testing, take the API ID from the URL and use it to construct the local endpoint. The API will be available at a local endpoint - `http://localhost:4566/_aws/execute-api/{api-id}/fh-backend/file-upload`. Using the Pulumi output above that would make the url `http://localhost:4566/_aws/execute-api/0hbpmzxlvm/fh-backend/file-upload`

The `file-upload` endpoint can be tested with Postman and including the sample.mp3 file the the binary body of the request.

## API Endpoints

### GET /ping

Returns a simple pong response with metadata.

**Response:**
```json
{
  "message": "pong",
  "timestamp": "2025-01-05T12:00:00.000Z",
  "requestId": "abc123",
  "environment": "local",
  "version": "1.0.0"
}
```

### POST /file-upload

Upload an mp3 file and get the number of frames in the file.

**Response:**
```json
{
  "frameCount": 6000
}
```

## Troubleshooting

### LocalStack Issues

1. **Check if LocalStack is running:**
   ```bash
   docker ps | grep localstack
   ```

2. **View LocalStack logs:**
   ```bash
   npm run localstack:logs
   ```

3. **Reset LocalStack:**
   ```bash
   npm run localstack:stop
   npm run localstack:start
   ```

4. **Cancel Pulumi Deployment:**
   ```bash
   cd infrastructure
   pulumi cancel
   ```