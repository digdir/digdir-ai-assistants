# API Migration Prompt

Use this prompt with an AI coding assistant to update client code to the current Digdir RAG API contract.

## Prompt

```text
Update my client code to the current Digdir RAG API contract.

Important contract rules:

1. There are two separate API surfaces:
   - Public API: `/api/...`, authenticated with `X-API-Key`
   - Operator Console API: `/console-api/...`, authenticated with the `auth-token` cookie

2. The public API is dataset-first:
   - Public callers select datasets with `tenant` + `dataset-config-key`
   - Public callers do not use pipeline selectors
   - Public callers do not call public dataset pipeline routes, because those routes are gone

3. Public requests must stop sending legacy selector fields:
   - `environment`
   - `pipeline`
   - `config-key`
   - `tenant-config-key`

4. API key payloads now use:
   - `dataset-scopes`
   - `allowed-config-keys`

5. Allowed config keys are root-scoped and use one of:
   - `platform-config-key`
   - `runtime-config-key`
   - `dataset-config-key`

6. Operator Console materialization routes use canonical dataset-first names too:
   - query params: `tenant` + `dataset-config-key`
   - create body: `tenant`, `dataset-config-key`, `pipeline-name`
   - responses use `execution-pipeline-id`

7. Use examples centered on:
   - tenant: `digdir`
   - dataset: `public-docs`

Route updates to apply:

Public API:
- keep `POST /api/rag`
- keep `POST /api/retrieve`
- keep `GET /api/datasets`
- keep `GET /api/datasets/:dataset-id`
- keep conversation, skill, and skill-graph endpoints
- remove any usage of `GET /api/datasets/:dataset-id/pipelines`
- remove any usage of `GET /api/datasets/:dataset-id/pipelines/:pipeline-id`

Operator Console API:
- use `PUT /console-api/api-keys/:key-id/allowed-config-keys`
- stop using `/config-grants` or `/config-ceilings`
- keep dataset and pipeline management under `/console-api/datasets/...`

Request/response shape updates:

Create API key request:
{
  "name": "Public Docs Integration",
  "dataset-scopes": [
    {
      "tenant": "digdir",
      "dataset-config-key": "public-docs"
    }
  ],
  "allowed-config-keys": [
    {
      "root": "dataset",
      "tenant": "digdir",
      "dataset-config-key": "public-docs"
    },
    {
      "root": "runtime",
      "tenant": "digdir",
      "runtime-config-key": "default"
    }
  ]
}

Create API key response:
{
  "api-key-id": "key_abc123",
  "api-key": "rag_...",
  "name": "Public Docs Integration",
  "dataset-scopes": [
    {
      "tenant": "digdir",
      "dataset-config-key": "public-docs"
    }
  ],
  "allowed-config-keys": [
    {
      "root": "dataset",
      "tenant": "digdir",
      "dataset-config-key": "public-docs"
    },
    {
      "root": "runtime",
      "tenant": "digdir",
      "runtime-config-key": "default"
    }
  ]
}

Public dataset list response:
{
  "datasets": [
    {
      "id": "public-docs",
      "name": "Public Docs",
      "description": "Shared public Digdir documentation",
      "enabled?": true,
      "status": "ready"
    }
  ]
}

Public dataset detail response:
{
  "dataset": {
    "id": "public-docs",
    "name": "Public Docs",
    "description": "Shared public Digdir documentation",
    "enabled?": true,
    "status": "ready"
  }
}

Retrieve request:
{
  "query": "What changed?",
  "tenant": "digdir",
  "dataset-config-key": "public-docs"
}

Retrieve response:
{
  "dataset-scope": {
    "tenant": "digdir",
    "dataset-config-key": "public-docs"
  }
}

RAG request:
{
  "query": "What changed?",
  "tenant": "digdir",
  "dataset-config-key": "public-docs",
  "runtime-config-key": "default",
  "agent-id": "agent/digdir"
}

Console create pipeline request:
{
  "tenant": "digdir",
  "dataset-config-key": "public-docs",
  "pipeline-name": "assistant",
  "properties": {
    "name": "Assistant",
    "sourceType": "website"
  }
}

Console create pipeline response:
{
  "pipeline-name": "assistant",
  "execution-pipeline-id": "digdir:public-docs:assistant",
  "datasetId": "ds_123"
}

Please update:
- route paths
- request field names
- response field names
- client-side types/interfaces
- serializers/deserializers
- tests and fixtures
- docs/examples in the codebase

Do not preserve compatibility for the old external field names. Migrate directly to the target shape.
```
