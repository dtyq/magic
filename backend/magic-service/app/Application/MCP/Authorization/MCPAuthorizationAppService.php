<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\MCP\Authorization\Discovery\MCPAuthorizationDiscoveryClient;
use App\Application\MCP\Authorization\Flow\MCPAuthorizationTokenClient;
use App\Application\MCP\Authorization\State\MCPAuthorizationStateStore;
use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\MCPAuthorizationCredentialEntity;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\Authorization\MCPAuthorizationConfig;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use App\Domain\MCP\Service\MCPAuthorizationCredentialDomainService;
use App\Domain\MCP\Service\MCPServerDomainService;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use RuntimeException;
use Throwable;

/**
 * MCP 2026-07-28 Authorization 应用服务。
 */
class MCPAuthorizationAppService extends AbstractKernelAppService
{
    private LoggerInterface $logger;

    private MCPAuthorizationDiscoveryClient $discoveryClient;

    private MCPAuthorizationTokenClient $tokenClient;

    private MCPAuthorizationPreflightService $preflightService;

    private MCPAuthorizationCapabilityService $capabilityService;

    public function __construct(
        private readonly MCPAuthorizationCredentialDomainService $credentialDomainService,
        private readonly MCPAuthorizationStateStore $stateStore,
        private readonly MCPAuthorizationSecretCipher $secretCipher,
        private readonly MCPServerDomainService $mcpServerDomainService,
        private readonly ConfigInterface $config,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('MCPAuthorizationAppService');
        $httpClient = new Client();
        $this->discoveryClient = new MCPAuthorizationDiscoveryClient($httpClient);
        $this->tokenClient = new MCPAuthorizationTokenClient($httpClient);
        $this->capabilityService = new MCPAuthorizationCapabilityService($httpClient, $this->discoveryClient);
        $this->preflightService = new MCPAuthorizationPreflightService($this->capabilityService);
    }

    /**
     * 获取新模式授权状态和授权 URL。
     *
     * @return array<string, mixed>
     */
    public function getAuthConfig(
        MCPDataIsolation $dataIsolation,
        MCPServerEntity $mcpServer,
        ?Authenticatable $authorization
    ): array {
        $config = $this->getConfig($mcpServer);
        $resource = $config->getResource() ?: $this->getResource($mcpServer);
        $userId = $authorization?->getId() ?: $dataIsolation->getCurrentUserId();
        $credential = $this->credentialDomainService->getByResource($dataIsolation, $userId, $mcpServer->getCode(), $resource);

        // 密文存在且未过期并不代表当前密钥仍可解密；密钥轮换后必须重新授权。
        if (
            $credential?->isAccessTokenValid((int) $this->config->get('mcp_authorization.token_expiry_leeway', 30))
            && $this->isAccessTokenDecryptable($credential)
        ) {
            return [
                'is_authenticated' => true,
                'oauth_url' => '',
                'authorization_url' => '',
                'issuer' => $credential->getIssuer(),
                'resource' => $resource,
                'scope' => $credential->getScope(),
                'expires_at' => $credential->getExpiresAt()?->format('Y-m-d H:i:s'),
            ];
        }

        try {
            $fingerprint = $this->buildConfigFingerprint($mcpServer, $resource, $this->tryGetCallbackUrl());
            $pendingState = $this->stateStore->getPending(
                $dataIsolation->getCurrentOrganizationCode(),
                (string) $userId,
                $mcpServer->getCode()
            );
            if ($pendingState !== null && MCPAuthorizationConfigFingerprint::matches($pendingState, $fingerprint)) {
                $this->logger->info('MCPAuthorizationPendingStateReused', [
                    'mcp_server_code' => $mcpServer->getCode(),
                    'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $userId,
                ]);
                return $this->buildPendingAuthConfig($pendingState, $resource);
            }
            if ($pendingState !== null) {
                $this->logger->info('MCPAuthorizationPendingStateInvalidated', [
                    'mcp_server_code' => $mcpServer->getCode(),
                    'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                    'user_id' => $userId,
                    'pending_resource' => (string) ($pendingState['resource'] ?? ''),
                    'current_resource' => $resource,
                ]);
                $this->stateStore->invalidatePending(
                    $dataIsolation->getCurrentOrganizationCode(),
                    (string) $userId,
                    $mcpServer->getCode(),
                    (string) ($pendingState['state'] ?? '')
                );
            }

            if ($credential && $credential->getRefreshTokenCiphertext() !== null) {
                try {
                    $refreshed = $this->refreshCredential($dataIsolation, $credential, $config);
                    if ($refreshed) {
                        return [
                            'is_authenticated' => true,
                            'oauth_url' => '',
                            'authorization_url' => '',
                            'issuer' => $refreshed->getIssuer(),
                            'resource' => $resource,
                            'scope' => $refreshed->getScope(),
                            'expires_at' => $refreshed->getExpiresAt()?->format('Y-m-d H:i:s'),
                        ];
                    }
                } catch (Throwable $throwable) {
                    $this->logger->warning('MCPAuthorizationTokenRefreshFailed', [
                        'mcp_server_code' => $mcpServer->getCode(),
                        'error' => $throwable->getMessage(),
                    ]);
                }
            }

            // MCP Authorization 的回调地址由 magic-service 统一配置，忽略前端传入值和服务级 redirect_uri。
            $redirectUri = $this->getCallbackUrl();
            $metadata = $this->resolveMetadata($resource, $config);
            $registration = $this->resolveClientRegistration($config, $metadata, $redirectUri);
            $clientId = $registration['client_id'];
            $state = bin2hex(random_bytes(32));
            $codeVerifier = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

            $issuer = (string) ($metadata['issuer'] ?? '');

            $authorizationEndpoint = (string) ($metadata['authorization_server']['authorization_endpoint'] ?? $config->getAuthorizationEndpoint());
            if ($authorizationEndpoint === '') {
                throw new RuntimeException('MCP authorization endpoint is missing');
            }
            $query = array_merge($config->getAdditionalParams(), [
                'response_type' => 'code',
                'client_id' => $clientId,
                'redirect_uri' => $redirectUri,
                'state' => $state,
                'code_challenge' => rtrim(strtr(base64_encode(hash('sha256', $codeVerifier, true)), '+/', '-_'), '='),
                'code_challenge_method' => 'S256',
                'resource' => $resource,
            ]);
            if ($config->getScope() !== '') {
                $query['scope'] = $config->getScope();
            }
            $url = $authorizationEndpoint . (str_contains($authorizationEndpoint, '?') ? '&' : '?') . http_build_query($query);

            $stateTtl = (int) $this->config->get('mcp_authorization.state_ttl', 600);
            $fingerprint = $this->buildConfigFingerprint($mcpServer, $resource, $redirectUri);
            $this->stateStore->put($state, [
                'user_id' => $userId,
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'mcp_server_code' => $mcpServer->getCode(),
                'resource' => $resource,
                'issuer' => $issuer,
                'redirect_uri' => $redirectUri,
                'code_verifier' => $codeVerifier,
                'client_id' => $clientId,
                'client_secret_ciphertext' => $registration['client_secret'] !== '' ? $this->secretCipher->encrypt($registration['client_secret']) : null,
                'token_endpoint_auth_method' => $registration['token_endpoint_auth_method'],
                'registration_mode' => $this->resolveRegistrationMode($config),
                'metadata' => $metadata,
                'language' => $dataIsolation->getLanguage(),
                'authorization_url' => $url,
                'config_fingerprint' => $fingerprint,
                'expires_at' => time() + $stateTtl,
                'created_at' => time(),
            ]);

            if (! $this->stateStore->putPending(
                $dataIsolation->getCurrentOrganizationCode(),
                (string) $userId,
                $mcpServer->getCode(),
                $state
            )) {
                $this->stateStore->delete($state);
                $pendingState = $this->stateStore->getPending(
                    $dataIsolation->getCurrentOrganizationCode(),
                    (string) $userId,
                    $mcpServer->getCode()
                );
                if ($pendingState !== null && MCPAuthorizationConfigFingerprint::matches($pendingState, $fingerprint)) {
                    $this->logger->info('MCPAuthorizationPendingStateRaceLost', [
                        'mcp_server_code' => $mcpServer->getCode(),
                        'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                        'user_id' => $userId,
                    ]);
                    return $this->buildPendingAuthConfig($pendingState, $resource);
                }
                throw new RuntimeException('MCP authorization pending state could not be created');
            }

            return [
                'is_authenticated' => false,
                'oauth_url' => $url,
                'authorization_url' => $url,
                'state' => $state,
                'expires_in' => $stateTtl,
                'issuer' => $issuer,
                'resource' => $resource,
            ];
        } catch (Throwable $throwable) {
            $this->logger->warning('MCPAuthorizationUrlGenerationFailed', [
                'mcp_server_code' => $mcpServer->getCode(),
                'error' => $throwable->getMessage(),
            ]);
            return [
                'is_authenticated' => false,
                'oauth_url' => '',
                'authorization_url' => '',
                'resource' => $resource,
                'error' => 'MCP authorization is not available',
            ];
        }
    }

    /**
     * 从 MCP Server 读取新模式配置。
     */
    public function getConfig(MCPServerEntity $mcpServer): MCPAuthorizationConfig
    {
        $serviceConfig = $mcpServer->getServiceConfig();
        if (! $serviceConfig instanceof ExternalSSEServiceConfig || ! $serviceConfig->getMcpAuthorizationConfig()) {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationNotConfigured);
        }
        return $serviceConfig->getMcpAuthorizationConfig();
    }

    /**
     * 检查新增 MCP Server 是否具备进入 Authorization 流程的基础条件。
     */
    public function preflight(MCPServerEntity $mcpServer): void
    {
        $this->preflightService->check($mcpServer);
    }

    /**
     * 探测 MCP Server 的 Authorization 能力并生成推荐配置。
     *
     * @return array<string, mixed>
     */
    public function analyzeCapabilities(MCPServerEntity $mcpServer): array
    {
        return $this->capabilityService->analyze($mcpServer);
    }

    /**
     * 获取 magic-service 自己承载的 MCP Authorization 回调地址。
     */
    public function getCallbackUrl(): string
    {
        $callbackUrl = trim((string) $this->config->get('mcp_authorization.callback_url', ''));
        if ($callbackUrl === '' || ! filter_var($callbackUrl, FILTER_VALIDATE_URL)) {
            throw new RuntimeException('MCP authorization callback URL is not configured');
        }
        return $callbackUrl;
    }

    /**
     * 解析 protected resource 的规范资源地址。
     */
    public function getResource(MCPServerEntity $mcpServer): string
    {
        $serviceConfig = $mcpServer->getServiceConfig();
        return $serviceConfig instanceof ExternalSSEServiceConfig ? $serviceConfig->getUrl() : '';
    }

    /**
     * 为 Super Magic 任务解析新模式的运行时访问令牌。
     *
     * 返回值仅供当前运行时凭据解析使用，不写入 MCP Server 配置。
     */
    public function getRuntimeAccessToken(MCPDataIsolation $dataIsolation, MCPServerEntity $mcpServer): ?string
    {
        $config = $this->getConfig($mcpServer);
        $resource = $config->getResource() ?: $this->getResource($mcpServer);
        $credential = $this->credentialDomainService->getByResource(
            $dataIsolation,
            $dataIsolation->getCurrentUserId(),
            $mcpServer->getCode(),
            $resource
        );
        if ($credential === null) {
            return null;
        }
        if (! $credential->isAccessTokenValid((int) $this->config->get('mcp_authorization.token_expiry_leeway', 30))) {
            if ($credential->getRefreshTokenCiphertext() === null) {
                return null;
            }
            try {
                $credential = $this->refreshCredential($dataIsolation, $credential, $config);
            } catch (Throwable $throwable) {
                $this->logger->warning('MCPAuthorizationRuntimeTokenRefreshFailed', [
                    'mcp_server_code' => $mcpServer->getCode(),
                    'error' => $throwable->getMessage(),
                ]);
                return null;
            }
            if ($credential === null || ! $credential->isAccessTokenValid((int) $this->config->get('mcp_authorization.token_expiry_leeway', 30))) {
                return null;
            }
        }
        try {
            return $this->secretCipher->decrypt($credential->getAccessTokenCiphertext()) ?: null;
        } catch (Throwable $throwable) {
            $this->logger->warning('MCPAuthorizationRuntimeAccessTokenDecryptFailed', [
                'mcp_server_code' => $mcpServer->getCode(),
                'error' => $throwable->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 为 Super Magic 提供一次性的 MCP Authorization 运行时凭据。
     *
     * 凭据只通过内部服务间接口返回，不写入 MCP Server 配置或用户设置。
     * access token 是否过期、是否需要 refresh 均由本服务内部处理。
     *
     * @return array{status: string, access_token?: string, token_type?: string}
     */
    public function getRuntimeCredential(MCPDataIsolation $dataIsolation, string $mcpServerCode): array
    {
        $dataIsolation->setContainOfficialOrganization(true);
        $mcpServer = $this->mcpServerDomainService->getByCode($dataIsolation, $mcpServerCode);
        if (! $mcpServer || ! $mcpServer->isEnabled()) {
            return ['status' => 'authorization_required'];
        }

        $serviceConfig = $mcpServer->getServiceConfig();
        if (! $serviceConfig instanceof ExternalSSEServiceConfig || $serviceConfig->getAuthType() !== ServiceConfigAuthType::MCP_AUTHORIZATION) {
            return ['status' => 'unsupported'];
        }

        $accessToken = $this->getRuntimeAccessToken($dataIsolation, $mcpServer);
        if ($accessToken === null) {
            $this->logger->notice('MCPAuthorizationRuntimeCredentialUnavailable', [
                'mcp_server_code' => $mcpServerCode,
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
            ]);
            return ['status' => 'authorization_required'];
        }

        return [
            'status' => 'authorized',
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
        ];
    }

    /**
     * 将 Token 响应更新到凭据实体。
     *
     * @param array<string, mixed> $tokens
     */
    public function applyTokenSet(MCPAuthorizationCredentialEntity $credential, array $tokens): void
    {
        $credential->setAccessTokenCiphertext($this->secretCipher->encrypt((string) $tokens['access_token']));
        if (! empty($tokens['refresh_token'])) {
            $credential->setRefreshTokenCiphertext($this->secretCipher->encrypt((string) $tokens['refresh_token']));
        }
        $credential->setTokenType((string) ($tokens['token_type'] ?? 'Bearer'));
        $credential->setScope(isset($tokens['scope']) ? (string) $tokens['scope'] : $credential->getScope());
        $credential->setExpiresAt(isset($tokens['expires_in']) ? date('Y-m-d H:i:s', time() + (int) $tokens['expires_in']) : null);
        $credential->setRefreshTokenExpiresAt(isset($tokens['refresh_token_expires_in']) ? date('Y-m-d H:i:s', time() + (int) $tokens['refresh_token_expires_in']) : $credential->getRefreshTokenExpiresAt());
    }

    /**
     * 计算当前 MCP 服务配置对应的授权指纹。
     */
    private function buildConfigFingerprint(MCPServerEntity $mcpServer, string $resource, string $redirectUri): string
    {
        return MCPAuthorizationConfigFingerprint::from(
            $this->getResource($mcpServer),
            $this->getConfig($mcpServer),
            $resource,
            $redirectUri
        );
    }

    /**
     * 读取回调地址；未配置时返回空字符串，避免复用 pending 时提前失败。
     */
    private function tryGetCallbackUrl(): string
    {
        try {
            return $this->getCallbackUrl();
        } catch (Throwable) {
            return '';
        }
    }

    /**
     * 将已有 pending state 转换为用户设置接口的授权配置响应。
     *
     * @param array<string, mixed> $pendingState
     * @return array<string, mixed>
     */
    private function buildPendingAuthConfig(array $pendingState, string $resource): array
    {
        $expiresAt = (int) ($pendingState['expires_at'] ?? 0);
        return [
            'is_authenticated' => false,
            'oauth_url' => (string) ($pendingState['authorization_url'] ?? ''),
            'authorization_url' => (string) ($pendingState['authorization_url'] ?? ''),
            'state' => (string) ($pendingState['state'] ?? ''),
            'expires_in' => max(0, $expiresAt - time()),
            'issuer' => (string) ($pendingState['issuer'] ?? ''),
            'resource' => (string) ($pendingState['resource'] ?? $resource),
        ];
    }

    /**
     * 解析预注册、CIMD 或 DCR 客户端信息。
     *
     * @param array<string, mixed> $metadata
     * @return array{client_id: string, client_secret: string, token_endpoint_auth_method: string}
     */
    private function resolveClientRegistration(MCPAuthorizationConfig $config, array $metadata, string $redirectUri): array
    {
        $mode = $this->resolveRegistrationMode($config);
        if ($mode === 'cimd') {
            return [
                'client_id' => $config->getClientMetadataUrl(),
                'client_secret' => '',
                'token_endpoint_auth_method' => $config->getTokenEndpointAuthMethod() ?: 'none',
            ];
        }
        if ($mode === 'pre_registered') {
            if ($config->getClientId() === '') {
                throw new RuntimeException('MCP authorization client_id is missing');
            }
            return [
                'client_id' => $config->getClientId(),
                'client_secret' => $config->getClientSecret(),
                'token_endpoint_auth_method' => $config->getTokenEndpointAuthMethod() ?: (! empty($config->getClientSecret()) ? 'client_secret_basic' : 'none'),
            ];
        }

        $registrationEndpoint = (string) ($metadata['authorization_server']['registration_endpoint'] ?? $config->getRegistrationEndpoint());
        if ($registrationEndpoint === '') {
            throw new RuntimeException('MCP dynamic client registration endpoint is missing');
        }
        $tokenEndpointAuthMethod = $this->resolveTokenEndpointAuthMethod($config, $metadata);
        $registrationPayload = [
            'client_name' => 'Magic MCP Client',
            'redirect_uris' => [$redirectUri],
            'response_types' => ['code'],
            'grant_types' => ['authorization_code', 'refresh_token'],
            'token_endpoint_auth_method' => $tokenEndpointAuthMethod,
            'application_type' => $config->getApplicationType(),
        ];
        if ($config->getScope() !== '') {
            $registrationPayload['scope'] = $config->getScope();
        }
        $client = new Client();
        $response = $client->request('POST', $registrationEndpoint, [
            'headers' => ['Accept' => 'application/json', 'Content-Type' => 'application/json'],
            'json' => $registrationPayload,
            'timeout' => 15,
            'connect_timeout' => 5,
        ]);
        $registration = json_decode((string) $response->getBody(), true);
        if (! is_array($registration) || empty($registration['client_id'])) {
            throw new RuntimeException('MCP dynamic client registration response is invalid');
        }
        return [
            'client_id' => (string) $registration['client_id'],
            'client_secret' => (string) ($registration['client_secret'] ?? ''),
            'token_endpoint_auth_method' => (string) ($registration['token_endpoint_auth_method'] ?? $tokenEndpointAuthMethod),
        ];
    }

    /**
     * 根据显式配置和授权服务器元数据选择 Token 端点认证方式。
     *
     * @param array<string, mixed> $metadata
     */
    private function resolveTokenEndpointAuthMethod(MCPAuthorizationConfig $config, array $metadata): string
    {
        if ($config->getTokenEndpointAuthMethod() !== '') {
            return $config->getTokenEndpointAuthMethod();
        }
        $supported = $metadata['authorization_server']['token_endpoint_auth_methods_supported'] ?? [];
        if (is_array($supported)) {
            foreach ($supported as $method) {
                if (is_string($method) && in_array($method, ['none', 'client_secret_basic', 'client_secret_post'], true)) {
                    return $method;
                }
            }
        }
        return 'none';
    }

    private function resolveRegistrationMode(MCPAuthorizationConfig $config): string
    {
        $mode = $config->getRegistrationMode();
        if ($mode === 'auto') {
            $mode = $config->getClientId() !== '' ? 'pre_registered' : ($config->getClientMetadataUrl() !== '' ? 'cimd' : 'dcr');
        }
        if (! in_array($mode, ['pre_registered', 'cimd', 'dcr'], true)) {
            throw new RuntimeException('MCP dynamic client registration is not enabled');
        }
        return $mode;
    }

    /**
     * 读取或构造 discovery metadata。
     *
     * @return array<string, mixed>
     */
    private function resolveMetadata(string $resource, MCPAuthorizationConfig $config): array
    {
        if ($config->getAuthorizationEndpoint() !== '' && $config->getTokenEndpoint() !== '') {
            $issuer = $config->getAuthorizationServerUrl();
            return [
                'issuer' => $issuer,
                'resource_metadata' => ['authorization_servers' => [$issuer]],
                'authorization_server' => [
                    'issuer' => $issuer,
                    'authorization_endpoint' => $config->getAuthorizationEndpoint(),
                    'token_endpoint' => $config->getTokenEndpoint(),
                    'registration_endpoint' => $config->getRegistrationEndpoint(),
                    'token_endpoint_auth_methods_supported' => [$config->getTokenEndpointAuthMethod() ?: 'none'],
                ],
            ];
        }
        return $this->discoveryClient->discover(
            $resource,
            $config->getResourceMetadataUrl() ?: null,
            $config->getAuthorizationServerUrl() ?: null
        );
    }

    /**
     * 刷新已有新模式凭据。
     */
    private function refreshCredential(MCPDataIsolation $dataIsolation, MCPAuthorizationCredentialEntity $credential, MCPAuthorizationConfig $config): ?MCPAuthorizationCredentialEntity
    {
        $refreshToken = $this->secretCipher->decrypt($credential->getRefreshTokenCiphertext());
        if ($refreshToken === '') {
            return null;
        }
        $tokenEndpoint = (string) ($credential->getDiscoveryMetadata()['authorization_server']['token_endpoint'] ?? $config->getTokenEndpoint());
        if ($tokenEndpoint === '') {
            return null;
        }
        $config->setClientId($credential->getClientId());
        $config->setClientSecret($this->secretCipher->decrypt($credential->getClientSecretCiphertext()));
        $config->setTokenEndpointAuthMethod($credential->getTokenEndpointAuthMethod());
        $tokens = $this->tokenClient->refresh($tokenEndpoint, $config, $refreshToken, $credential->getResource());
        $this->applyTokenSet($credential, $tokens);
        return $this->credentialDomainService->save($dataIsolation, $credential);
    }

    /**
     * 检查访问令牌密文是否能使用当前密钥解密。
     */
    private function isAccessTokenDecryptable(MCPAuthorizationCredentialEntity $credential): bool
    {
        try {
            return $this->secretCipher->decrypt($credential->getAccessTokenCiphertext()) !== '';
        } catch (Throwable $throwable) {
            $this->logger->warning('MCPAuthorizationAccessTokenDecryptFailed', [
                'mcp_server_id' => $credential->getMcpServerId(),
                'error' => $throwable->getMessage(),
            ]);
            return false;
        }
    }
}
