# Infrastructure Deployment Guide

This guide explains how to set up and deploy the Pulumi stack for this project.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/)
- AWS credentials configured (e.g., via `aws configure`)

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   ```

2**Login to Pulumi (optional, if using Pulumi Cloud):**
   ```sh
   pulumi login
   ```

3**Create a new stack:**
   ```sh
   pulumi stack init fh-backend
   ```

4. **Deploy the stack:**
   ```sh
   pulumi up
   ```

## Additional Commands

- **Update the stack:**
  ```sh
  pulumi up
  ```
- **Destroy the stack:**
  ```sh
  pulumi destroy
  ```
- **View stack outputs:**
  ```sh
  pulumi stack output
  ```

## Notes
- Make sure your AWS credentials are set up and have sufficient permissions.
- For more information, see the [Pulumi documentation](https://www.pulumi.com/docs/).

