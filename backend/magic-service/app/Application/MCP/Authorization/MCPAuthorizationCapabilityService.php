<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\MCP\Authorization;

use App\Application\MCP\Authorization\Discovery\MCPAuthorizationDiscoveryClient;
use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\Domain\MCP\Entity\MCPServerEntity;
use App\Domain\MCP\Entity\ValueObject\Authorization\MCPAuthorizationConfig;
use App\Domain\MCP\Entity\ValueObject\ServiceConfig\ExternalSSEServiceConfig;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\RequestOptions;
use RuntimeException;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * MCP Authorization 能力探测服务。
 *
 * 只读取 MCP Resource 和授权服务器的公开元数据，不执行 DCR、用户授权或 Token 交换。
 */
class MCPAuthorizationCapabilityService
{
    public function __construct(
        private readonly ClientInterface $httpClient,
        private readonly MCPAuthorizationDiscoveryClient $discoveryClient
    ) {
    }

    /**
     * 探测 MCP Server 的授权能力，并根据当前草稿配置生成推荐配置。
     *
     * @return array<string, mixed>
     */
    public function analyze(MCPServerEntity $mcpServer): array
    {
        $serviceConfig = $mcpServer->getServiceConfig();
        if (! $serviceConfig instanceof ExternalSSEServiceConfig || $serviceConfig->getAuthType() !== ServiceConfigAuthType::MCP_AUTHORIZATION) {
            return $this->buildFailureResult('unsupported', trans('mcp.authorization_capability.unsupported'));
        }

        $authorizationConfig = $serviceConfig->getMcpAuthorizationConfig();
        if ($authorizationConfig === null) {
            return $this->buildFailureResult('invalid', trans('mcp.authorization_capability.not_configured'), [
                'error_code' => 'MCPAuthorizationNotConfigured',
            ]);
        }

        try {
            // 能力探测需要继续访问远端，以便把模式必填字段结构化返回给前端。
            $serviceConfig->validate(false);
            $resource = $authorizationConfig->getResource() ?: $serviceConfig->getUrl();
            if ($resource === '' || str_contains($resource, '${')) {
                throw new RuntimeException(trans('mcp.authorization_capability.resource_url_required'));
            }

            $probe = $this->probeResource($resource, $serviceConfig->getHeadersArray());
            $metadata = $this->resolveMetadata($resource, $authorizationConfig);
            $authorizationServer = $metadata['authorization_server'] ?? null;
            if (! is_array($authorizationServer)) {
                throw new RuntimeException(trans('mcp.authorization_capability.invalid_server_metadata'));
            }

            $authorizationEndpoint = $this->getStringValue($authorizationServer, 'authorization_endpoint');
            $tokenEndpoint = $this->getStringValue($authorizationServer, 'token_endpoint');
            if ($authorizationEndpoint === '' || $tokenEndpoint === '') {
                throw new RuntimeException(trans('mcp.authorization_capability.missing_server_endpoints'));
            }

            $registration = $this->analyzeRegistration(
                $authorizationConfig,
                $authorizationServer,
                ! $mcpServer->shouldCreate()
            );
            $recommendedRegistration = is_string($registration['recommended'] ?? null)
                ? $registration['recommended']
                : null;
            $tokenEndpointAuth = $this->analyzeTokenEndpointAuth(
                $authorizationConfig,
                $authorizationServer,
                $recommendedRegistration,
                ! $mcpServer->shouldCreate()
            );
            $scope = $this->analyzeScope($authorizationConfig, $metadata, $probe['www_authenticate']);
            $registrationRequiredFields = is_array($registration['required_fields'] ?? null)
                ? $registration['required_fields']
                : [];
            $tokenEndpointAuthRequiredFields = is_array($tokenEndpointAuth['required_fields'] ?? null)
                ? $tokenEndpointAuth['required_fields']
                : [];
            $requiredFields = array_values(array_unique(array_merge(
                $registrationRequiredFields,
                $tokenEndpointAuthRequiredFields
            )));
            $status = $requiredFields === [] ? 'ready' : 'needs_configuration';
            $warnings = $this->buildWarnings($registration, $tokenEndpointAuth);

            return [
                'status' => $status,
                'confidence' => $this->resolveConfidence($metadata, $registration),
                'resource' => $resource,
                'issuer' => $this->getStringValue($authorizationServer, 'issuer'),
                'http' => [
                    'status_code' => $probe['status_code'],
                    'authenticated_response' => in_array($probe['status_code'], [401, 403], true),
                ],
                'endpoints' => [
                    'authorization_endpoint' => $authorizationEndpoint,
                    'token_endpoint' => $tokenEndpoint,
                    'registration_endpoint' => $registration['registration_endpoint'],
                ],
                'registration' => $registration,
                'token_endpoint_auth' => $tokenEndpointAuth,
                'scope' => $scope,
                'required_fields' => $requiredFields,
                'warnings' => $warnings,
            ];
        } catch (Throwable $throwable) {
            return $this->buildFailureResult('unavailable', trans('mcp.authorization_capability.probe_failed'), [
                'reason' => $this->normalizeFailureReason($throwable),
            ]);
        }
    }

    /**
     * 探测 MCP Resource 是否可访问，并读取授权挑战头。
     *
     * 401、403、405 表示服务端已经响应；404、重定向和 5xx 才视为不可用。
     *
     * @param array<string, string> $headers
     * @return array{status_code: int, www_authenticate: string}
     */
    private function probeResource(string $resource, array $headers): array
    {
        try {
            $response = $this->httpClient->request('GET', $resource, [
                RequestOptions::HEADERS => array_merge($headers, [
                    'Accept' => 'application/json, text/event-stream',
                ]),
                RequestOptions::HTTP_ERRORS => false,
                RequestOptions::ALLOW_REDIRECTS => false,
                RequestOptions::STREAM => true,
                RequestOptions::TIMEOUT => 10,
                RequestOptions::CONNECT_TIMEOUT => 5,
            ]);
        } catch (GuzzleException $exception) {
            throw new RuntimeException('MCP Resource 无法访问', 0, $exception);
        }

        $statusCode = $response->getStatusCode();
        $wwwAuthenticate = $response->getHeaderLine('WWW-Authenticate');
        $response->getBody()->close();
        if ($statusCode === 404 || $statusCode >= 500 || ($statusCode >= 300 && $statusCode < 400)) {
            throw new RuntimeException('MCP Resource 返回不可用状态');
        }

        return [
            'status_code' => $statusCode,
            'www_authenticate' => $wwwAuthenticate,
        ];
    }

    /**
     * 使用显式端点或标准 Discovery 获取授权服务器元数据。
     *
     * @return array<string, mixed>
     */
    private function resolveMetadata(string $resource, MCPAuthorizationConfig $authorizationConfig): array
    {
        if ($authorizationConfig->getAuthorizationEndpoint() !== '' && $authorizationConfig->getTokenEndpoint() !== '') {
            return [
                'authorization_server' => [
                    'authorization_endpoint' => $authorizationConfig->getAuthorizationEndpoint(),
                    'token_endpoint' => $authorizationConfig->getTokenEndpoint(),
                    'issuer' => $authorizationConfig->getAuthorizationServerUrl(),
                ],
            ];
        }

        return $this->discoveryClient->discover(
            $resource,
            $authorizationConfig->getResourceMetadataUrl() ?: null,
            $authorizationConfig->getAuthorizationServerUrl() ?: null
        );
    }

    /**
     * 分析客户端注册方式，并计算当前配置缺少的字段。
     *
     * @param array<string, mixed> $authorizationServer
     * @param bool $allowExistingSecret 更新已有 MCP Server 时允许由领域服务保留密钥
     * @return array<string, mixed>
     */
    private function analyzeRegistration(MCPAuthorizationConfig $config, array $authorizationServer, bool $allowExistingSecret): array
    {
        $registrationEndpoint = $this->getStringValue($authorizationServer, 'registration_endpoint') ?: $config->getRegistrationEndpoint();
        $cimdSupported = ($authorizationServer['client_id_metadata_document_supported'] ?? false) === true;
        $clientId = $config->getClientId();
        $clientMetadataUrl = $config->getClientMetadataUrl();
        $requestedMode = $config->getRegistrationMode();

        $preRegisteredRequiredFields = [];
        if ($clientId === '') {
            $preRegisteredRequiredFields[] = 'client_id';
        }
        if (! $allowExistingSecret
            && $config->getTokenEndpointAuthMethod() !== 'none'
            && $config->getTokenEndpointAuthMethod() !== ''
            && $config->getClientSecret() === '') {
            $preRegisteredRequiredFields[] = 'client_secret';
        }

        $cimdRequiredFields = $clientMetadataUrl === '' ? ['client_metadata_url'] : [];
        $dcrRequiredFields = $registrationEndpoint === '' ? ['registration_endpoint'] : [];
        $candidates = [
            'pre_registered' => [
                'available' => $preRegisteredRequiredFields === [],
                'required_fields' => $preRegisteredRequiredFields,
                'reason' => trans('mcp.authorization_capability.registration.pre_registered'),
            ],
            'cimd' => [
                'available' => $cimdSupported && $cimdRequiredFields === [],
                'advertised' => $cimdSupported,
                'required_fields' => $cimdRequiredFields,
                'reason' => $cimdSupported
                    ? trans('mcp.authorization_capability.registration.cimd_supported')
                    : trans('mcp.authorization_capability.registration.cimd_unsupported'),
            ],
            'dcr' => [
                'available' => $registrationEndpoint !== '',
                'required_fields' => $dcrRequiredFields,
                'reason' => $registrationEndpoint !== ''
                    ? trans('mcp.authorization_capability.registration.dcr_found')
                    : trans('mcp.authorization_capability.registration.dcr_missing'),
            ],
        ];

        $recommended = $this->resolveRecommendedRegistrationMode(
            $requestedMode,
            $clientId,
            $clientMetadataUrl,
            $cimdSupported,
            $registrationEndpoint
        );
        $requiredFields = $recommended !== null ? $candidates[$recommended]['required_fields'] : ['registration_mode'];

        return [
            'requested' => $requestedMode,
            'supported' => array_keys(array_filter($candidates, static fn (array $candidate): bool => $candidate['available'])),
            'recommended' => $recommended,
            'required_fields' => $requiredFields,
            'registration_endpoint' => $registrationEndpoint,
            'candidates' => $candidates,
        ];
    }

    /**
     * 分析 Token 端点认证方式，并判断预注册模式是否需要密钥。
     *
     * @param array<string, mixed> $authorizationServer
     * @param bool $allowExistingSecret 更新已有 MCP Server 时允许由领域服务保留密钥
     * @return array<string, mixed>
     */
    private function analyzeTokenEndpointAuth(
        MCPAuthorizationConfig $config,
        array $authorizationServer,
        ?string $registrationMode,
        bool $allowExistingSecret
    ): array {
        $supported = [];
        $metadataMethods = $authorizationServer['token_endpoint_auth_methods_supported'] ?? [];
        if (is_array($metadataMethods)) {
            $supported = array_values(array_filter(
                $metadataMethods,
                static fn (mixed $method): bool => is_string($method) && in_array($method, ['none', 'client_secret_basic', 'client_secret_post'], true)
            ));
        }
        $configured = $config->getTokenEndpointAuthMethod();
        $recommended = $configured !== ''
            ? $configured
            : (in_array('none', $supported, true) ? 'none' : ($supported[0] ?? 'none'));
        $requiredFields = [];
        if (! $allowExistingSecret
            && $registrationMode === 'pre_registered'
            && in_array($recommended, ['client_secret_basic', 'client_secret_post'], true)
            && $config->getClientSecret() === '') {
            $requiredFields[] = 'client_secret';
        }

        return [
            'supported' => $supported,
            'recommended' => $recommended,
            'required_fields' => $requiredFields,
            'configured' => $configured,
        ];
    }

    /**
     * 分析 scope 建议，不自动把全部可用 scope 写入配置。
     *
     * @param array<string, mixed> $metadata
     * @return array<string, mixed>
     */
    private function analyzeScope(MCPAuthorizationConfig $config, array $metadata, string $wwwAuthenticate): array
    {
        $resourceMetadata = $metadata['resource_metadata'] ?? [];
        $supported = is_array($resourceMetadata) && is_array($resourceMetadata['scopes_supported'] ?? null)
            ? array_values(array_filter($resourceMetadata['scopes_supported'], 'is_string'))
            : [];
        $challengeScope = $this->extractChallengeScope($wwwAuthenticate);
        $configured = $config->getScope();

        return [
            'configured' => $configured,
            'supported' => $supported,
            'recommended' => $challengeScope ?: ($configured !== '' ? $configured : null),
            'source' => $challengeScope !== '' ? 'www-authenticate' : ($configured !== '' ? 'configuration' : null),
        ];
    }

    /**
     * 根据规范和当前配置选择注册方式。
     */
    private function resolveRecommendedRegistrationMode(
        string $requestedMode,
        string $clientId,
        string $clientMetadataUrl,
        bool $cimdSupported,
        string $registrationEndpoint
    ): ?string {
        if ($requestedMode !== 'auto') {
            return $requestedMode;
        }
        if ($clientId !== '') {
            return 'pre_registered';
        }
        if ($cimdSupported && $clientMetadataUrl !== '') {
            return 'cimd';
        }
        if ($registrationEndpoint !== '') {
            return 'dcr';
        }
        if ($clientMetadataUrl !== '') {
            return 'cimd';
        }
        return null;
    }

    /**
     * 根据探测证据评估推荐结果的置信度。
     *
     * @param array<string, mixed> $metadata
     * @param array<string, mixed> $registration
     */
    private function resolveConfidence(array $metadata, array $registration): string
    {
        if (! empty($metadata['resource_metadata']) && ! empty($registration['recommended'])) {
            return 'high';
        }
        return ! empty($registration['recommended']) ? 'medium' : 'low';
    }

    /**
     * 生成能力分析告警。
     *
     * @param array<string, mixed> $registration
     * @param array<string, mixed> $tokenEndpointAuth
     * @return array<int, string>
     */
    private function buildWarnings(array $registration, array $tokenEndpointAuth): array
    {
        $warnings = [];
        if (($registration['recommended'] ?? null) === 'dcr') {
            $warnings[] = trans('mcp.authorization_capability.warnings.dcr_recommended');
        }
        if (($registration['recommended'] ?? null) === 'cimd' && empty($registration['candidates']['cimd']['advertised'])) {
            $warnings[] = trans('mcp.authorization_capability.warnings.cimd_not_advertised');
        }
        if (($tokenEndpointAuth['recommended'] ?? '') === 'none' && empty($tokenEndpointAuth['supported'])) {
            $warnings[] = trans('mcp.authorization_capability.warnings.token_auth_not_advertised');
        }
        return $warnings;
    }

    /**
     * 从 WWW-Authenticate 中提取 scope。
     */
    private function extractChallengeScope(string $wwwAuthenticate): string
    {
        if ($wwwAuthenticate === '') {
            return '';
        }
        if (preg_match('/(?:^|[,\s])scope="([^"]+)"/i', $wwwAuthenticate, $matches) === 1) {
            return trim($matches[1]);
        }
        if (preg_match('/(?:^|[,\s])scope=([^,\s]+)/i', $wwwAuthenticate, $matches) === 1) {
            return trim($matches[1]);
        }
        return '';
    }

    /**
     * 安全读取授权服务器元数据字符串字段。
     *
     * @param array<string, mixed> $data
     */
    private function getStringValue(array $data, string $key): string
    {
        return isset($data[$key]) && is_string($data[$key]) ? trim($data[$key]) : '';
    }

    /**
     * 生成不包含敏感信息的失败结果。
     *
     * @param array<string, mixed> $extra
     * @return array<string, mixed>
     */
    private function buildFailureResult(string $status, string $message, array $extra = []): array
    {
        return array_merge([
            'status' => $status,
            'confidence' => 'low',
            'required_fields' => [],
            'warnings' => [$message],
            'error' => $message,
        ], $extra);
    }

    /**
     * 将底层异常转换为不包含完整响应内容的诊断信息。
     */
    private function normalizeFailureReason(Throwable $throwable): string
    {
        return match (true) {
            $throwable instanceof GuzzleException => trans('mcp.authorization_capability.failure_reason.remote_request'),
            default => trans('mcp.authorization_capability.failure_reason.configuration_or_discovery'),
        };
    }
}
