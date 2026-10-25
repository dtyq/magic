<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\MCP\Authorization\Flow\MCPAuthorizationTokenClient;
use App\Application\MCP\Authorization\State\MCPAuthorizationStateStore;
use App\Domain\MCP\Entity\MCPAuthorizationCredentialEntity;
use App\Domain\MCP\Entity\ValueObject\MCPDataIsolation;
use App\Domain\MCP\Service\MCPAuthorizationCredentialDomainService;
use App\Domain\MCP\Service\MCPServerDomainService;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use RuntimeException;
use Throwable;

/**
 * MCP Authorization 回调绑定服务。
 */
class MCPAuthorizationBindingService extends AbstractKernelAppService
{
    private MCPAuthorizationTokenClient $tokenClient;

    private LoggerInterface $logger;

    public function __construct(
        private readonly MCPAuthorizationStateStore $stateStore,
        private readonly MCPAuthorizationCredentialDomainService $credentialDomainService,
        private readonly MCPAuthorizationAppService $authorizationAppService,
        private readonly MCPAuthorizationSecretCipher $secretCipher,
        private readonly MCPServerDomainService $mcpServerDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->tokenClient = new MCPAuthorizationTokenClient(new Client());
        $this->logger = $loggerFactory->get('MCPAuthorizationBindingService');
    }

    /**
     * 处理不携带 Magic 登录态的公开回调。
     *
     * 回调身份由一次性 state 绑定的用户和组织决定，成功后只返回授权结果摘要。
     */
    public function bindPublic(string $code, string $state, ?string $iss = null, ?string $error = null): array
    {
        $stateHash = $this->hashValue($state);
        $this->logger->info('MCPAuthorizationPublicCallbackStarted', [
            'state_hash' => $stateHash,
            'has_code' => $code !== '',
            'has_issuer' => $iss !== null && $iss !== '',
            'has_error' => $error !== null && $error !== '',
        ]);

        try {
            $stateData = $this->consumeState($code, $state, $iss, $error);
            $this->logger->info('MCPAuthorizationStateConsumed', [
                'state_hash' => $stateHash,
                'mcp_server_code' => $stateData['mcp_server_code'] ?? '',
                'organization_code' => $stateData['organization_code'] ?? '',
                'user_id' => $stateData['user_id'] ?? '',
            ]);

            $result = $this->completeBinding($stateData, $code);
            $this->logger->info('MCPAuthorizationPublicCallbackSucceeded', [
                'state_hash' => $stateHash,
                'mcp_server_code' => $stateData['mcp_server_code'] ?? '',
                'organization_code' => $stateData['organization_code'] ?? '',
                'user_id' => $stateData['user_id'] ?? '',
            ]);
            return $result;
        } catch (Throwable $throwable) {
            $this->logger->error('MCPAuthorizationPublicCallbackFailed', [
                'state_hash' => $stateHash,
                'error_type' => get_class($throwable),
                'error' => $throwable->getMessage(),
                'file' => $throwable->getFile(),
                'line' => $throwable->getLine(),
                'provider_error' => $this->extractProviderError($throwable),
            ]);
            throw $throwable;
        }
    }

    /**
     * 获取公开回调页面使用的 state 语种，不消费一次性 state。
     */
    public function getPublicCallbackLanguage(string $state): ?string
    {
        $stateData = $this->stateStore->get($state);
        $language = $stateData['language'] ?? null;
        return is_string($language) && $language !== '' ? $language : null;
    }

    /**
     * 删除新模式凭据，不影响旧 OAuth2 数据。
     */
    public function unbind(Authenticatable $authorization, string $mcpServerCode, ?string $issuer = null): array
    {
        if ($mcpServerCode === '') {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp_server_code']);
        }
        // 解绑需要兼容官方组织中的 MCP Server，因此不限制当前组织。
        $dataIsolation = $this->createMCPDataIsolation($authorization)->disabled();
        $deleted = $issuer !== null && $issuer !== ''
            ? $this->credentialDomainService->deleteByIssuer($dataIsolation, $authorization->getId(), $mcpServerCode, $issuer)
            : $this->credentialDomainService->deleteByServer($dataIsolation, $authorization->getId(), $mcpServerCode);
        return ['success' => true, 'data' => ['deleted' => $deleted]];
    }

    /**
     * 校验并消费授权回调 state。
     *
     * @return array<string, mixed>
     */
    private function consumeState(string $code, string $state, ?string $iss, ?string $error): array
    {
        if ($state === '') {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationStateInvalid);
        }

        $stateData = $this->stateStore->consume($state);
        if (! $stateData) {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationStateInvalid);
        }
        $this->stateStore->clearPending(
            (string) ($stateData['organization_code'] ?? ''),
            (string) ($stateData['user_id'] ?? ''),
            (string) ($stateData['mcp_server_code'] ?? ''),
            $state
        );
        $issuer = (string) ($stateData['issuer'] ?? '');
        if ($iss !== null && $iss !== '' && $iss !== $issuer) {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationIssuerMismatch);
        }
        if ($error !== null && $error !== '') {
            throw new RuntimeException('MCP authorization was denied: ' . $error);
        }
        if ($code === '') {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationStateInvalid);
        }
        return $stateData;
    }

    /**
     * 根据 state 中的用户和组织信息完成 Token 交换与凭据保存。
     *
     * @param array<string, mixed> $stateData
     */
    private function completeBinding(array $stateData, string $code): array
    {
        $organizationCode = (string) ($stateData['organization_code'] ?? '');
        $userId = (string) ($stateData['user_id'] ?? '');
        $issuer = (string) ($stateData['issuer'] ?? '');
        if ($organizationCode === '' || $userId === '') {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationStateInvalid);
        }

        $dataIsolation = MCPDataIsolation::create($organizationCode, $userId);
        $dataIsolation->setContainOfficialOrganization(true);
        $serverCode = (string) ($stateData['mcp_server_code'] ?? '');
        $server = $this->mcpServerDomainService->getByCode($dataIsolation, $serverCode);
        if (! $server) {
            ExceptionBuilder::throw(MCPErrorCode::NotFound, 'common.not_found', ['label' => $serverCode]);
        }

        $config = $this->authorizationAppService->getConfig($server);
        $tokenEndpoint = (string) ($stateData['metadata']['authorization_server']['token_endpoint'] ?? $config->getTokenEndpoint());
        if ($tokenEndpoint === '') {
            ExceptionBuilder::throw(MCPErrorCode::MCPAuthorizationTokenExchangeFailed);
        }
        $config->setClientId((string) ($stateData['client_id'] ?? $config->getClientId()));
        $config->setClientSecret($this->secretCipher->decrypt($stateData['client_secret_ciphertext'] ?? null));
        $config->setTokenEndpointAuthMethod((string) ($stateData['token_endpoint_auth_method'] ?? $config->getTokenEndpointAuthMethod()));
        $this->logger->info('MCPAuthorizationTokenExchangeStarted', [
            'mcp_server_code' => $serverCode,
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'issuer' => $issuer,
            'token_endpoint_host' => parse_url($tokenEndpoint, PHP_URL_HOST) ?: '',
            'token_endpoint_auth_method' => $config->getTokenEndpointAuthMethod(),
            'has_client_secret' => $config->getClientSecret() !== '',
        ]);
        $tokens = $this->tokenClient->exchangeCode(
            $tokenEndpoint,
            $config,
            $code,
            (string) $stateData['redirect_uri'],
            (string) $stateData['code_verifier'],
            (string) $stateData['resource']
        );
        $this->logger->info('MCPAuthorizationTokenExchangeSucceeded', [
            'mcp_server_code' => $serverCode,
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'has_refresh_token' => ! empty($tokens['refresh_token']),
            'token_type' => $tokens['token_type'] ?? null,
            'scope' => $tokens['scope'] ?? null,
            'expires_in' => $tokens['expires_in'] ?? null,
        ]);

        $credential = new MCPAuthorizationCredentialEntity();
        $credential->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $credential->setUserId($userId);
        $credential->setMcpServerId($serverCode);
        $credential->setResource((string) $stateData['resource']);
        $credential->setIssuer($issuer);
        $credential->setRegistrationMode((string) ($stateData['registration_mode'] ?? 'pre_registered'));
        $credential->setClientId((string) ($stateData['client_id'] ?? $config->getClientId()));
        $credential->setClientSecretCiphertext($config->getClientSecret() !== '' ? $this->secretCipher->encrypt($config->getClientSecret()) : null);
        $credential->setTokenEndpointAuthMethod($config->getTokenEndpointAuthMethod() ?: (! empty($config->getClientSecret()) ? 'client_secret_basic' : 'none'));
        $credential->setDiscoveryMetadata(is_array($stateData['metadata'] ?? null) ? $stateData['metadata'] : []);
        $credential->setClientMetadata(['client_id' => $credential->getClientId(), 'registration_mode' => $credential->getRegistrationMode()]);
        $this->authorizationAppService->applyTokenSet($credential, $tokens);
        $this->credentialDomainService->save($dataIsolation, $credential);
        $this->logger->info('MCPAuthorizationCredentialSaved', [
            'mcp_server_code' => $serverCode,
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'credential_id' => $credential->getId(),
        ]);

        return [
            'success' => true,
            'data' => [
                'auth_info' => [
                    'is_authenticated' => true,
                    'scope' => $credential->getScope(),
                    'token_type' => $credential->getTokenType(),
                    'access_token_expires_at' => $credential->getExpiresAt()?->format('Y-m-d H:i:s'),
                ],
            ],
        ];
    }

    /**
     * 对敏感值生成不可逆标识，仅用于日志关联。
     */
    private function hashValue(string $value): string
    {
        return $value === '' ? '' : substr(hash('sha256', $value), 0, 16);
    }

    /**
     * 从授权服务器 HTTP 异常中提取安全的标准错误字段。
     *
     * 不记录响应原文，避免错误响应中意外包含 Token 或其他敏感信息。
     *
     * @return null|array{status: int, error: null|string, error_description: null|string}
     */
    private function extractProviderError(Throwable $throwable): ?array
    {
        if (! $throwable instanceof RequestException || ! $throwable->hasResponse()) {
            return null;
        }

        $response = $throwable->getResponse();
        $payload = json_decode((string) $response->getBody(), true);
        if (! is_array($payload)) {
            return [
                'status' => $response->getStatusCode(),
                'error' => null,
                'error_description' => null,
            ];
        }

        return [
            'status' => $response->getStatusCode(),
            'error' => isset($payload['error']) ? substr((string) $payload['error'], 0, 128) : null,
            'error_description' => isset($payload['error_description'])
                ? substr((string) $payload['error_description'], 0, 512)
                : null,
        ];
    }
}
