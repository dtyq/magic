# LoginServiceProvider

## Overview

`LoginServiceProvider` manages the login page state for public and private
deployment flows. It coordinates three closely related concepts:

- `deployment`: which login UI should be rendered
- login-scoped `clusterCode`: which private deployment the current login page is using
- `clusterCodeCache`: the last remembered private deployment code

## Terminology

- Active cluster:
  `configStore.cluster.clusterCode`
  The global cluster currently used by requests after login succeeds.
- Cached private cluster:
  `configStore.cluster.clusterCodeCache`
  The remembered private deployment code used to restore the login UI.
- Login-scoped cluster:
  `useClusterCode().clusterCode` inside the login page.
  The temporary cluster used by the current login session before the global
  active cluster takes over.

## Current Behavior

The login cluster state machine is centralized in
`useLoginClusterSession.ts`.

- If `clusterCodeCache` exists on mount, the login page defaults to
  `PrivateDeploymentLogin`
- Calling `showPublicDeployment()` clears the login-scoped `clusterCode`
- Calling `showPrivateDeployment()` restores `clusterCodeCache`
- Calling `setPrivateClusterCode(code)` updates the current login-scoped cluster
  and persists the cache through `ConfigService`

## Action API

| Action | Primary effect | Typical caller |
| --- | --- | --- |
| `showPublicDeployment()` | Switches the login UI to public mode and clears the login-scoped `clusterCode` | Public/private switch actions |
| `showPrivateDeployment()` | Switches the login UI to private mode and restores `clusterCodeCache` into the login-scoped cluster | Public-to-private switch actions |
| `setPrivateClusterCode(code)` | Updates the login-scoped cluster immediately and persists the cached private cluster | Private code form submission, account modal preset |

## Why It Matters

The login page must separate **request state** from **UI preference**:

- Global `configStore.cluster.clusterCode` controls which base URL requests use
- `clusterCodeCache` preserves the last private deployment choice for the login UI
- The login page can therefore keep showing private login options after logout
  while requests safely fall back to SaaS

## Tests

Focused regression coverage lives in:

- `src/layouts/SSOLayout/providers/LoginServiceProvider/__tests__/useLoginClusterSession.test.tsx`
- `src/layouts/SSOLayout/providers/LoginServiceProvider/__tests__/LoginServiceProvider.test.tsx`
- `src/services/user/__tests__/AccountService.test.ts`
- `src/apis/clients/interceptor/__tests__/resolve-cluster-base-url.test.ts`

## Detailed Design

See `docs/login-cluster-scenarios.md` for scenario-by-scenario behavior and
Mermaid flowcharts.
