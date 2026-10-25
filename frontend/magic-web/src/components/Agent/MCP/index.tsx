import MCPForm from "./MCPForm"
import MCPEditor from "./MCPEditor"
import MCPOAuth from "./MCPOAuth"
import MCPButton from "./MCPButton"
import AgentSettings from "./AgentSettings"

/**
 * MCP UI entry points for selecting connectors, configuring services, and completing authorization.
 * MCPButton opens AgentSettings; MCPForm creates or edits a service and MCPEditor imports JSON.
 * MCPOAuth handles required setup fields and OAuth authorization before enabling a connector.
 * Modal content receives onClose through AgentCommonModalChildrenProps; openAgentCommonModal
 * supplies that callback when callers provide a component as its children.
 * The shared modal handles Suspense content, desktop dragging, and responsive mobile presentation.
 * List retrieval strategies live in MCPManagerService, while scoped selections and persistence
 * are accessed through getMCPAccess. MCPOAuthService owns authorization polling and cleanup.
 */
export * from "./types"
export { MCPForm, MCPEditor, MCPOAuth, MCPButton, AgentSettings }
