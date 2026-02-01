import state from '../state.js'
import config from '../config.js'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function nowISO() {
  return new Date().toISOString()
}

function buildEnvFile() {
  const k = state.canaryKeys
  return `# OpenClaw Environment Configuration
# Auto-generated — do not edit manually

ANTHROPIC_API_KEY=${k.anthropicApi}
OPENAI_API_KEY=${k.openaiApi}
OPENROUTER_API_KEY=${k.openrouterApi}
GATEWAY_TOKEN=${k.gatewayToken}
TELEGRAM_BOT_TOKEN=${k.telegramBot}
DISCORD_BOT_TOKEN=${k.discordBot}
HOOKS_TOKEN=${k.hooksToken}
AWS_ACCESS_KEY_ID=${k.awsAccessKey}
AWS_SECRET_ACCESS_KEY=${k.awsSecretKey}
GOOGLE_OAUTH_TOKEN=${k.googleOAuth}
SERVICE_NAME=${config.serviceName}
VERSION=${config.fakeVersion}
NODE_ENV=production
LOG_LEVEL=info
`
}

function buildAuthProfiles() {
  const k = state.canaryKeys
  return JSON.stringify({
    profiles: [
      {
        name: 'default',
        provider: 'anthropic',
        apiKey: k.anthropicApi,
        model: 'claude-sonnet-4',
        createdAt: new Date(Date.now() - 2592000000).toISOString(),
      },
      {
        name: 'openai-fallback',
        provider: 'openai',
        apiKey: k.openaiApi,
        model: 'gpt-4o',
        createdAt: new Date(Date.now() - 1728000000).toISOString(),
      },
      {
        name: 'google-oauth',
        provider: 'google',
        accessToken: k.googleOAuth,
        refreshToken: `rt-${k.googleOAuth}`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ],
    aws: {
      accessKeyId: k.awsAccessKey,
      secretAccessKey: k.awsSecretKey,
      region: 'eu-south-1',
    },
  }, null, 2)
}

function buildIdentity() {
  return JSON.stringify({
    id: 'main',
    name: 'Molty',
    model: 'anthropic/claude-sonnet-4',
    workspace: '/root/clawd',
    createdAt: new Date(Date.now() - 7776000000).toISOString(),
    owner: 'marco.rossi',
  }, null, 2)
}

const MEMORY_MD = `# Personal Context

## Owner
- **Name**: Marco Rossi
- **Location**: Milan, Italy
- **Role**: DevOps Engineer at TechCorp S.r.l.
- **Email**: marco.rossi@techcorp.it
- **Phone**: +39 3XX XXX XXXX

## Work Context
- Managing AWS infrastructure (eu-south-1)
- Kubernetes cluster on EKS (3 nodes)
- CI/CD with GitHub Actions
- Monitoring with Grafana + Prometheus

## Preferences
- Prefers concise responses
- Uses Italian for personal messages, English for work
- Timezone: Europe/Rome (CET/CEST)
- SSH key: ~/.ssh/id_ed25519

## Important Accounts
- AWS Console: marco.rossi@techcorp.it
- GitHub: @mrossi-tc
- Slack workspace: techcorp.slack.com
- Jira: techcorp.atlassian.net
`

const USER_MD = `# User Profile

## Marco Rossi
Senior DevOps Engineer at TechCorp S.r.l., Milan

### Active Projects
- **infra-migration**: Migrating from EC2 to EKS
- **monitoring-v2**: New Grafana dashboards
- **api-gateway**: Kong to Traefik migration

### Quick Notes
- Sprint review every Friday at 15:00 CET
- On-call rotation: every 3rd week
- VPN config in 1Password vault "TechCorp Infra"
`

function buildDailyMemory() {
  const d = today()
  return `# Daily Log — ${d}

## Morning
- Checked Kubernetes cluster health: all nodes healthy
- Reviewed PR #247 for API gateway changes
- Deployed staging build v2.4.1

## Afternoon
- Meeting with security team about penetration test results
- Updated Terraform modules for RDS instances
- Sent weekly report to CTO

## Pending
- [ ] Review CloudWatch alarms configuration
- [ ] Update SSL certificates (expiring in 12 days)
- [ ] Prepare demo for Monday stakeholder meeting
`
}

function buildSessionTranscript() {
  const lines = []
  const baseTime = Date.now() - 7200000
  const messages = [
    { role: 'user', content: 'Check the status of all EKS nodes' },
    { role: 'assistant', content: 'All 3 EKS nodes are healthy. Node i-0a1b2c3d: Ready, Node i-0e4f5g6h: Ready, Node i-0i7j8k9l: Ready.' },
    { role: 'user', content: 'Show me the current CPU usage across the cluster' },
    { role: 'assistant', content: 'Current cluster CPU usage:\n- Node 1: 34% (4/12 cores)\n- Node 2: 67% (8/12 cores)\n- Node 3: 12% (1.5/12 cores)\nAverage: 37.7%' },
    { role: 'user', content: 'Deploy the latest build to staging' },
    { role: 'assistant', content: 'Deploying build v2.4.1 to staging namespace. Pipeline triggered: GitHub Actions run #1847. ETA: ~3 minutes.' },
    { role: 'user', content: 'Check if the deployment is complete' },
    { role: 'assistant', content: 'Deployment complete. All 3 replicas are running. Health check passed. Staging URL: https://staging.techcorp.it' },
    { role: 'user', content: 'Run the integration tests' },
    { role: 'assistant', content: 'Running integration test suite... 47/47 tests passed. Coverage: 89.2%. No regressions detected.' },
    { role: 'user', content: 'Send the test results to the team channel' },
    { role: 'assistant', content: 'Sent test results to #engineering on Slack. Summary: v2.4.1 staging deployment successful, all tests green.' },
    { role: 'user', content: 'What meetings do I have tomorrow?' },
    { role: 'assistant', content: 'Tomorrow\'s schedule:\n- 09:30 Daily standup (15 min)\n- 11:00 Architecture review with Backend team (1h)\n- 14:00 1:1 with CTO (30 min)\n- 15:00 Sprint review (1h)' },
    { role: 'user', content: 'Check the SSL certificate expiry dates' },
    { role: 'assistant', content: 'SSL Certificate Status:\n- *.techcorp.it: expires in 12 days (Feb 12, 2026)\n- api.techcorp.it: expires in 89 days\n- staging.techcorp.it: expires in 89 days\n⚠️ Action needed: Renew *.techcorp.it wildcard cert soon.' },
    { role: 'user', content: 'Create a reminder to renew the wildcard cert next Monday' },
    { role: 'assistant', content: 'Reminder set for Monday Feb 3, 2026 at 09:00: "Renew *.techcorp.it wildcard SSL certificate". I\'ll send a notification via Telegram.' },
    { role: 'user', content: 'Show me the latest CloudWatch alarms' },
    { role: 'assistant', content: 'Active CloudWatch Alarms:\n- RDS CPU > 80%: OK (current: 23%)\n- EKS Pod restart count: OK (0 restarts/24h)\n- API latency p99 > 500ms: OK (current: 127ms)\n- Disk usage > 85%: WARNING (current: 82% on vol-0abc123)\nAll critical alarms are clear.' },
    { role: 'user', content: 'Can you check the billing dashboard?' },
    { role: 'assistant', content: 'AWS Cost Summary (January 2026):\n- Month-to-date: $4,287.32\n- Projected: $4,450\n- Budget: $5,000\n- Top services: EC2 ($1,890), RDS ($980), EKS ($670), S3 ($320)\nYou\'re within budget. EC2 costs could be optimized with reserved instances.' },
    { role: 'user', content: 'Generate the weekly infrastructure report' },
    { role: 'assistant', content: 'Weekly report generated and saved to canvas. Key metrics:\n- Uptime: 99.97%\n- Incidents: 1 minor (resolved in 8 min)\n- Deployments: 4 successful\n- Cost trend: -3% vs last week\nReport available at /__openclaw__/canvas/report.html' },
    { role: 'user', content: 'Send the report to marco.rossi@techcorp.it via email' },
    { role: 'assistant', content: 'Email sent to marco.rossi@techcorp.it with subject "Weekly Infrastructure Report - Jan 27-31, 2026". Attached PDF version and CSV data export.' },
    { role: 'user', content: 'Good night, see you tomorrow' },
    { role: 'assistant', content: 'Good night, Marco! I\'ll keep monitoring the systems. I\'ll alert you via Telegram if anything critical comes up. See you tomorrow! 🌙' },
  ]

  for (let i = 0; i < messages.length; i++) {
    const ts = new Date(baseTime + i * 180000).toISOString()
    lines.push(JSON.stringify({ ...messages[i], ts, model: 'anthropic/claude-sonnet-4', sessionId: 'main' }))
  }

  // Pad to 50+ lines with older messages
  const olderBase = Date.now() - 86400000
  const olderMsgs = [
    { role: 'user', content: 'Update the Terraform state' },
    { role: 'assistant', content: 'Terraform state refreshed. 47 resources tracked, 0 changes detected.' },
    { role: 'user', content: 'List all running pods in production' },
    { role: 'assistant', content: '12 pods running in production namespace. All healthy.' },
    { role: 'user', content: 'Check the database backup status' },
    { role: 'assistant', content: 'Last backup: 2 hours ago. Size: 4.2GB. Retention: 30 days. All backups verified.' },
    { role: 'user', content: 'Show me the API error rate for the last hour' },
    { role: 'assistant', content: 'API error rate (last 1h): 0.02% (3 errors out of 15,247 requests). All errors were 429 rate limits.' },
    { role: 'user', content: 'Scale up the API pods to 5 replicas' },
    { role: 'assistant', content: 'Scaled api-gateway deployment to 5 replicas. New pods are initializing... All 5 replicas running.' },
    { role: 'user', content: 'Run security scan on the production cluster' },
    { role: 'assistant', content: 'Security scan complete. No critical vulnerabilities. 2 medium findings: outdated nginx image (1 pod), missing network policy (1 namespace).' },
    { role: 'user', content: 'Update the nginx image to latest' },
    { role: 'assistant', content: 'Updated nginx from 1.24 to 1.25.3 in production. Rolling update in progress... Complete. Zero downtime.' },
    { role: 'user', content: 'Check the Git repository for any open PRs' },
    { role: 'assistant', content: 'Open PRs:\n- #247: API gateway rate limiting (ready for review)\n- #251: Add OpenTelemetry tracing (draft)\n- #253: Fix memory leak in worker service (needs rebase)' },
    { role: 'user', content: 'Approve and merge PR #247' },
    { role: 'assistant', content: 'PR #247 approved and merged to main. CI pipeline triggered. Deployment to staging will start automatically.' },
    { role: 'user', content: 'What is our current monthly AWS spend trend?' },
    { role: 'assistant', content: 'Monthly trend (last 6 months):\n- Aug: $4,120\n- Sep: $4,350\n- Oct: $4,180\n- Nov: $4,520\n- Dec: $4,290\n- Jan (projected): $4,450\nRelatively stable. Spike in Nov was due to load testing.' },
    { role: 'user', content: 'Check the load balancer health' },
    { role: 'assistant', content: 'ALB health check: all 5 targets healthy. Average response time: 23ms. No 5xx errors in the last hour.' },
    { role: 'user', content: 'Show me the DNS configuration for techcorp.it' },
    { role: 'assistant', content: 'DNS records for techcorp.it:\n- A: 52.28.xxx.xxx (ALB)\n- MX: mail.techcorp.it (priority 10)\n- TXT: v=spf1 include:_spf.google.com ~all\n- CNAME: www -> techcorp.it' },
  ]

  for (let i = 0; i < olderMsgs.length; i++) {
    const ts = new Date(olderBase + i * 120000).toISOString()
    lines.unshift(JSON.stringify({ ...olderMsgs[i], ts, model: 'anthropic/claude-sonnet-4', sessionId: 'main' }))
  }

  return lines.join('\n') + '\n'
}

const fileMap = new Map()
let lastInitDate = ''

function initFiles() {
  lastInitDate = today()
  fileMap.clear()
  const svc = config.serviceName
  const home = `/home/user/.${svc}`
  const root = `/root/.${svc}`

  const configJson = JSON.stringify(state.getConfig(), null, 2)
  const envContent = buildEnvFile()
  const authProfiles = buildAuthProfiles()
  const identity = buildIdentity()
  const transcript = buildSessionTranscript()
  const dailyMemory = buildDailyMemory()

  const paths = {
    [`~/.${svc}/${svc}.json`]: { content: configJson, contentType: 'application/json' },
    [`~/.${svc}/.env`]: { content: envContent, contentType: 'text/plain' },
    [`~/.${svc}/agents/main/agent/auth-profiles.json`]: { content: authProfiles, contentType: 'application/json' },
    [`~/.${svc}/agents/main/agent/identity.json`]: { content: identity, contentType: 'application/json' },
    [`~/.${svc}/agents/main/workspace/MEMORY.md`]: { content: MEMORY_MD, contentType: 'text/markdown' },
    [`~/.${svc}/agents/main/workspace/USER.md`]: { content: USER_MD, contentType: 'text/markdown' },
    [`~/.${svc}/agents/main/workspace/memory/${today()}.md`]: { content: dailyMemory, contentType: 'text/markdown' },
    [`~/.${svc}/agents/main/sessions/main.jsonl`]: { content: transcript, contentType: 'application/jsonl' },
  }

  for (const [path, data] of Object.entries(paths)) {
    fileMap.set(path, data)
    // Also register with expanded home paths
    fileMap.set(path.replace('~', home), data)
    fileMap.set(path.replace('~', root), data)
    fileMap.set(path.replace('~', '/home/user'), data)
  }

  // Common LFI targets
  fileMap.set('.env', { content: envContent, contentType: 'text/plain' })
  fileMap.set('/.env', { content: envContent, contentType: 'text/plain' })
  fileMap.set(`${svc}.json`, { content: configJson, contentType: 'application/json' })
}

initFiles()

export function getFile(path) {
  // Regenerate files when date changes (daily memory, session transcript, etc.)
  if (today() !== lastInitDate) {
    initFiles()
  }

  // Normalize path
  const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/')

  // Direct match
  if (fileMap.has(normalized)) {
    return fileMap.get(normalized)
  }

  // Try partial match (for LFI attempts with ../)
  for (const [key, value] of fileMap) {
    if (normalized.endsWith(key) || normalized.includes(key)) {
      return value
    }
  }

  return null
}
