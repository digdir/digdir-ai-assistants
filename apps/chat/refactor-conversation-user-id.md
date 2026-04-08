# Updating Your Integration: X-User-Id, Agents, and Dataset References

## 1. Replace `X-User-Email` with `X-User-Id` (required, all conversation-scoped endpoints)

The `X-User-Email` header has been removed. All public API endpoints that touch conversations now **require** an `X-User-Id` header.

`X-User-Id` is an **opaque external identifier** that you control. It can be any non-blank string — a UUID, a customer account ID, an internal username, etc. It is **not** related to any internal Playground or admin user account. The API stores it as-is and uses it solely to scope conversation ownership.

### Affected endpoints

| Method | Endpoint | `X-User-Id` |
|--------|----------|-------------|
| `POST` | `/api/rag` | Required |
| `GET` | `/api/conversations` | Required — returns only this user's conversations |
| `POST` | `/api/conversations` | Required — creates a conversation owned by this user |
| `GET` | `/api/conversations/:id` | Required — must match the conversation owner |
| `PUT` | `/api/conversations/:id` | Required — must match the conversation owner |
| `DELETE` | `/api/conversations/:id` | Required — must match the conversation owner |

### Key rules

- A conversation can only be read, updated, or deleted by the same `X-User-Id` that created it.
- When continuing a conversation via `POST /api/rag` with a `conversation-id`, the same `X-User-Id` must be supplied.
- There is no unscoped "list all" mode on the public API. `GET /api/conversations` always filters by the supplied `X-User-Id`.
- Omitting the header returns a `400 Bad Request`.

### Example — query with conversation history

```bash
curl -X POST https://admin.kunnskap.digdir.cloud/api/rag \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rag_your_api_key" \
  -H "X-User-Id: customer-user-123" \
  -d '{
    "query": "Hva er Altinn?",
    "conversation-id": "dPPIA0UWuF4JPMGBUDbjD"
  }'
```

### Example — list conversations for a user

```bash
curl -X GET "https://admin.kunnskap.digdir.cloud/api/conversations?page_size=20&page_index=0" \
  -H "X-API-Key: rag_your_api_key" \
  -H "X-User-Id: customer-user-123"
```

### Example — create a conversation

```bash
curl -X POST https://admin.kunnskap.digdir.cloud/api/conversations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rag_your_api_key" \
  -H "X-User-Id: customer-user-123" \
  -d '{"title": "My New Conversation"}'
```

---


## 2. Specifying tenant, environment, agent, and dataset (pipeline)

API keys now carry **explicit dataset refs**, **agent grants**, and **config ceilings**.
Your requests must align with what your API key is authorized to access.

### Agent (`agent`)

Each conversation is scoped to an **agent** (a policy-governed runtime actor that determines behavior, allowed skills, and accessible datasets).

- Pass `agent` in the request body to select an agent.
- When continuing an existing conversation, the agent must match the conversation's original agent.

### Dataset reference (`tenant`, `environment`, `pipeline`)

Datasets are identified by a three-part reference: `{tenant, environment, pipeline}`.
Do not rely on implicit tenant defaults. If your client selects a dataset explicitly, send
all three values together.


```json
{
  "query": "Hva er Altinn?",
  "tenant": "altinn-docs",
  "environment": "dev",
  "pipeline": "assistant"
}
```


**API key scoping:** Dataset refs alone are not enough. For each tenant used by your
client, the upstream API key must also include explicit config ceilings for:

- `platform` - the shared system root in the actual HTTP payload
- `runtime`
- `dataset`

Each config ceiling must carry the correct `node-id`. If your internal docs or tooling use
the term `system` root, map that to `platform` in the actual HTTP request payload.

**Agent-level restrictions:** Even if your API key grants access to multiple datasets, the selected agent may restrict which datasets it is allowed to use. Requesting a dataset outside the agent's allowed set returns `403`.

### Putting it all together

```bash
curl -X POST https://knowledge.digdir.cloud/api/rag \
  -H "Content-Type: application/json" \
  -H "X-API-Key: rag_your_api_key" \
  -H "X-User-Id: customer-user-123" \
  -d '{
    "query": "Hva er Altinn?",
    "agent": "altinn-assistant",
    "tenant": "altinn-docs",
    "environment": "dev",
    "pipeline": "assistant"
  }'
```

### Error responses to expect

| Status | Meaning |
|--------|---------|
| `400` | Missing `X-User-Id`, incomplete dataset ref (e.g. tenant without environment/pipeline), or ambiguous selection (multiple grants, none specified) |
| `401` | Invalid/missing API key, or API key has no usable dataset/config scope |
| `403` | Requested dataset or agent not in API key scope, required config ceilings are missing, or agent policy blocks the dataset |
| `404` | Conversation not found or not owned by the supplied `X-User-Id`; pipeline config not found for the resolved dataset |
