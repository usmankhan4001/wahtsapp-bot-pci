# Premier Choice International WhatsApp Sales Assistant

A robust, enterprise-grade AI sales assistant built to automate the real estate qualification and proposal generation process over WhatsApp. Designed for Premier Choice International, this system serves as an initial point of contact, seamlessly qualifying leads before handing them over to the appropriate human sales or support teams.

## System Overview

The application integrates deeply with existing infrastructure to provide a cohesive customer experience:
- **Natural Language Understanding**: Powered by Google's Gemini models to handle unstructured customer input in English, Urdu, and Roman Urdu.
- **Dynamic Inventory Verification**: Direct integration with the Bitrix24 backend to query live unit availability, ensuring customers receive accurate and up-to-date information.
- **Automated Proposal Generation**: Capable of building and rendering comprehensive payment proposals in PDF format directly within the chat window.
- **Retrieval-Augmented Generation (RAG)**: Integrates an administrative dashboard that ingests official PDF brochures, embedding them into a local vector index to accurately answer detailed project inquiries.

## Architecture

The system is decoupled to allow maximum flexibility, isolating the core business logic from the messaging adapter.

```
WhatsApp API Gateway (WAHA) <--> Bot Core Service (Node.js)
                                      |
                                      +--> Bitrix24 (Inventory & Pricing)
                                      +--> Gemini API (LLM & Embeddings)
                                      +--> Document Processing (PDF Proposals & RAG)
                                      +--> Cloudflare R2 (Static Assets)
```

By abstracting the WhatsApp I/O through a dedicated messaging adapter, the underlying WAHA gateway can be transparently swapped for the official WhatsApp Business (WABA) Cloud API in the future without modifying the core system.

## Key Features

- **Structured Qualification**: Systematically qualifies leads by budget, intended use, property type, and project preference.
- **CRM Handoffs**: Compiles comprehensive lead profiles and transmits them to designated human sales executives or support teams.
- **Admin Dashboard**: A secure web interface allowing non-technical staff to upload project brochures, which are automatically parsed, chunked, and vectorized for the AI's knowledge base.
- **Resilient Session Management**: Includes debounced persistence, idle session garbage collection, and robust error handling to maintain conversation continuity.

## Local Development Setup

Ensure you have Node.js (version 22 recommended) and Docker installed on your system.

1. Clone the repository and navigate to the project root.
2. Duplicate `.env.example` to `.env` and populate the required environment variables.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Production Deployment

The recommended deployment strategy utilizes Docker to ensure environmental consistency. A multi-stage Dockerfile is provided to minimize image size while securing necessary rendering dependencies.

For detailed deployment instructions on Dokploy or similar platforms, please refer to the deployment documentation included in the repository (`DEPLOY-DOKPLOY.md`).

## Configuration Reference

The application behavior can be modified extensively via environment variables without requiring code changes. Key configurations include:
- `WEBHOOK_TOKEN`: Security token for verifying inbound messaging webhooks.
- `WAHA_API_KEY`: Authentication key for the WhatsApp gateway.
- `GEMINI_API_KEY`: Authentication for the LLM provider.
- `SALES_MANAGER_WHATSAPP`: Routing destination for generated proposals and manager notifications.
- `ADMIN_PASSWORD`: Access credential for the RAG ingestion dashboard.

Please review `.env.example` for the complete list of configurable variables.
