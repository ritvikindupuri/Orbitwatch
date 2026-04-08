# OrbitWatch Docker Secrets

## Required Files

```
secrets/
├── elastic_url      # Elasticsearch Cloud URL
└── elastic_api_key  # Elasticsearch API Key (Base64 encoded)
```

## Setup

```bash
# Create secret files (no quotes, no trailing newline)
echo -n "https://your-deployment.es.us-west-1.aws.found.io:9243" > elastic_url
echo -n "your_base64_api_key" > elastic_api_key

# Secure them
chmod 600 *
```

## Creating an API Key

1. Open Kibana > **Management > Security > API Keys**
2. Click **Create API key**
3. Name it `orbitwatch`
4. Copy the **Base64-encoded** key

## Security

- Never commit secret files to git
- Files are mounted read-only at `/run/secrets/`
- For development, use `.env` with `docker-compose.dev.yml`
