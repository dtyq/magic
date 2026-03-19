# LoginServiceProvider

## Component Overview

LoginServiceProvider is a React Context Provider component designed to manage login service state and logic. It primarily handles login workflows across different deployment environments (public cloud and private cloud) and provides relevant context data and methods to child components.

## Key Features

-   Manages login deployment environments (public cloud/private cloud)
-   Provides LoginService instance to child components
-   Manages cluster code (clusterCode) state
-   Provides environment switching capabilities

## Data Structure

```typescript
interface LoginServiceStore {
	// Login service instance
	service: ServiceContainer
	// Current deployment environment type (public cloud/private cloud)
	deployment: LoginDeployment
	// Set deployment environment
	setDeployment: (deployment: LoginDeployment) => void
	// Cluster code (used for private deployment)
	clusterCode: string | null
	// Set cluster code
	setDeployCode: (clusterCode: string) => void
}
```

## Usage

### Basic Usage

```tsx
import { LoginServiceProvider } from "./LoginServiceProvider"
import { LoginService } from "@/service/user/LoginService"
import { service } from "@/services"

// Create login service instance
const loginService = new LoginService(apis, service)

function App() {
	return (
		<LoginServiceProvider service={loginService}>
			{/* Child components can access context via useLoginServiceContext */}
			<YourLoginComponent />
		</LoginServiceProvider>
	)
}
```

### Using HOC Wrapper

```tsx
import { withLoginService } from "./withLoginService"
import { LoginService } from "@/service/user/LoginService"
import { service } from "@/services/user/LoginService"

// Create login service instance
const loginService = new LoginService(apis, service)

// Wrap component with HOC
const WrappedComponent = withLoginService(YourComponent, loginService)

function App() {
	return <WrappedComponent />
}
```

### Using Context in Child Components

```tsx
import { useLoginServiceContext } from "./useLoginServiceContext"
import { LoginDeployment } from "@/opensource/pages/login/constants"

function LoginComponent() {
	const { service, deployment, setDeployment, clusterCode, setDeployCode } =
		useLoginServiceContext()

	const handleLogin = async () => {
		// Use service for login operations
		// ...
	}

	const switchToPrivateDeployment = () => {
		setDeployment(LoginDeployment.PrivateDeploymentLogin)
	}

	return (
		<div>
			{/* Render different login interfaces based on deployment environment */}
			{deployment === LoginDeployment.PublicDeploymentLogin ? (
				<PublicLoginForm onLogin={handleLogin} />
			) : (
				<PrivateLoginForm
					clusterCode={clusterCode}
					onSetClusterCode={setDeployCode}
					onLogin={handleLogin}
				/>
			)}

			<button onClick={switchToPrivateDeployment}>Switch to Private Deployment Login</button>
		</div>
	)
}
```

## Important Notes

-   LoginServiceProvider should be placed at the top of the component tree that needs access to login services
-   Switching deployment environments automatically handles clearing and restoring clusterCode
-   In private deployment mode, the last used clusterCode is restored from cache
