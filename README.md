
## ❓ FAQ

### What is Magic?

Magic is an **enterprise-grade open-source AI Agent platform** built for **security, control, direct business outcomes, and autonomous 24/7 operation**. It combines a Generalist AI Agent + Workflow Engine + IM + Online collaborative office system. Built for OPC (One Person Company) and OPT (One Person Team) operating models.

### How does Magic differ from personal AI assistants?

| Feature | Magic | OpenClaw | ChatGPT |
|---------|-------|----------|---------|
| Target | Enterprise | Personal | Individual |
| Data Ownership | Organization | Personal account | Third-party |
| Budget Control | Per-dept/user caps | None | None |
| Sandbox Isolation | ✅ Proprietary | ❌ No | ❌ No |
| Approval Workflow | ✅ Human-in-loop | ❌ No | ❌ No |
| Deliverables | PPT/Dashboards/Excel | Text | Text |
| Expert Agents | ✅ Domain specialists | Skills | Plugins |
| Team Collaboration | ✅ Multi-user projects | ❌ No | ❌ No |
| IM Integration | WeCom/DingTalk/Lark | 25+ channels | None |

### 7 Enterprise-Grade Core Capabilities

| Capability | Description |
|------------|-------------|
| **Knowledge Consolidation** | Encapsulate ERP/CRM/databases into digital employees |
| **Results as Deliverables** | PPTs, dashboards, reports, Excel, infinite canvases |
| **Security & Compliance** | Sandbox containers, private VPC, tenant isolation |
| **Human-in-the-Loop** | High-risk operations require approval |
| **Granular Cost Control** | Daily budgets per department/user/Agent |
| **Team Collaboration** | Multi-user projects, real-time visibility |
| **Open Ecosystem** | Compatible with Anthropic Skills + OpenClaw Skills |

### Personal AI Assistant vs Expert Agents

**Personal AI Assistant:**
- Every employee gets a dedicated assistant (24/7)
- Connects to calendars, email, internal systems, data, tools
- Mobilizes the right resources and expertise

**Expert Agents:**
- Domain specialists (legal, finance, sales, operations)
- Deep and comprehensive within their domain
- Reusable organizational assets

### What deployment options are available?

| Option | Description |
|--------|-------------|
| **Self-Hosted** | Docker deployment via `curl -fsSL https://getmagicrew.sh | bash` |
| **Cloud (China)** | [Magic](https://www.letsmagic.cn) |
| **Cloud (International)** | [MagiCrew](https://www.magicrew.ai) |
| **Enterprise Edition** | Private deployment, dedicated models, custom integration |

### Self-Hosted Requirements

- **Docker** + curl
- **Platforms**: macOS, Linux (Windows coming soon)
- **Web UI**: http://localhost:38080
- **Teardown**: `magicrew teardown`

### What deliverables can Magic produce?

| Deliverable | Description |
|-------------|-------------|
| **PPTs** | Professional presentations |
| **Data Dashboards** | Live operational dashboards |
| **Meeting Summaries** | Structured with owners and deadlines |
| **Reports** | Research reports, financial analysis |
| **Excel Files** | Data tables, calculations |
| **Infinite Canvases** | Image creation, poster design |

### How does sandbox isolation work?

- Agents run in **proprietary sandbox containers**
- Isolated from main system in **separate VPC**
- Connected via **private endpoints**
- **Sidecar network proxy** manages traffic per user
- **Complete resource and data isolation** across tenants
- **Plugin security review** catches malicious code

### How does Human-in-the-Loop work?

- High-risk operations trigger **approval workflow**
- Routine actions run autonomously
- Destructive actions (deleting data, sending emails) require **explicit human confirmation**
- Decision authority stays with people

### What is the cost control mechanism?

- **Daily budgets** per department
- **Daily budgets** per user
- **Daily budgets** per Agent
- AI spending becomes **predictable and controllable**
- Every dollar justified

### How does team collaboration work?

- Multiple people share a **single project**
- Each owns different modules
- **Real-time visibility** across team
- Expert users can jump into colleague's project
- Progress auto-reported to **WeCom, DingTalk, Lark**

### What Skills ecosystems are supported?

- **Anthropic Skills** ecosystem compatibility
- **OpenClaw Skills** ecosystem compatibility
- Existing tools and skills plug right in
- Zero migration cost

### What languages are supported?

README available in:
- [English](README.md)
- [简体中文](README_CN.md)

### Use Case Scenarios

1. **8 people doing the work of 80** - Cross-border e-commerce automation
2. **Operational truth, any time** - Live dashboards in 30 seconds
3. **Global business, never offline** - 24/7 customer service Expert Agents
4. **Risk intercepted before it happens** - Legal Expert Agent for contracts
5. **Organizational memory compounding** - AI workforce carries collective intelligence
6. **New hire, Day one, Senior-level output** - Ramp time drops to one week
7. **3 people, 10 markets** - Market expansion Expert Agent
8. **Retiring expert's knowledge preserved** - After-sales Expert Agent
9. **Meetings that work** - Auto-compile data, transcribe, structured summaries

### License

[Magic Open Source License](LICENSE) - based on Apache 2.0 with additional restrictions.

### Help Resources

- **Issues**: [GitHub Issues](https://github.com/dtyq/magic/issues)
- **Discussions**: [GitHub Discussions](https://github.com/dtyq/magic/discussions)
- **Email**: team@dtyq.com (security), bd@dtyq.com (business)
