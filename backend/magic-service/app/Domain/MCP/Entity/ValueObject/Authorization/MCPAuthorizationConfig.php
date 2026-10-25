<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\Authorization;

use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\SSRF\SSRFUtil;

/**
 * MCP 2026-07-28 Authorization 模式配置。
 *
 * 该对象与旧 Oauth2Config 完全隔离，不解释旧字段的语义。
 */
class MCPAuthorizationConfig extends AbstractValueObject
{
    protected string $resource = '';

    protected string $resourceMetadataUrl = '';

    protected string $authorizationServerUrl = '';

    protected string $authorizationEndpoint = '';

    protected string $tokenEndpoint = '';

    protected string $registrationEndpoint = '';

    protected string $registrationMode = 'auto';

    protected string $clientId = '';

    protected string $clientSecret = '';

    protected string $clientMetadataUrl = '';

    protected string $tokenEndpointAuthMethod = '';

    protected string $applicationType = 'native';

    protected string $scope = '';

    protected string $redirectUri = '';

    /** @var array<string, mixed> */
    protected array $additionalParams = [];

    public function getResource(): string
    {
        return $this->resource;
    }

    public function setResource(string $resource): void
    {
        $this->resource = trim($resource);
    }

    public function getResourceMetadataUrl(): string
    {
        return $this->resourceMetadataUrl;
    }

    public function setResourceMetadataUrl(string $url): void
    {
        $this->resourceMetadataUrl = trim($url);
    }

    public function getAuthorizationServerUrl(): string
    {
        return $this->authorizationServerUrl;
    }

    public function setAuthorizationServerUrl(string $url): void
    {
        $this->authorizationServerUrl = trim($url);
    }

    public function getAuthorizationEndpoint(): string
    {
        return $this->authorizationEndpoint;
    }

    public function setAuthorizationEndpoint(string $url): void
    {
        $this->authorizationEndpoint = trim($url);
    }

    public function getTokenEndpoint(): string
    {
        return $this->tokenEndpoint;
    }

    public function setTokenEndpoint(string $url): void
    {
        $this->tokenEndpoint = trim($url);
    }

    public function getRegistrationEndpoint(): string
    {
        return $this->registrationEndpoint;
    }

    public function setRegistrationEndpoint(string $url): void
    {
        $this->registrationEndpoint = trim($url);
    }

    public function getRegistrationMode(): string
    {
        return $this->registrationMode;
    }

    public function setRegistrationMode(string $mode): void
    {
        $this->registrationMode = strtolower(trim($mode)) ?: 'auto';
    }

    public function getClientId(): string
    {
        return $this->clientId;
    }

    public function setClientId(string $clientId): void
    {
        $this->clientId = trim($clientId);
    }

    public function getClientSecret(): string
    {
        return $this->clientSecret;
    }

    public function setClientSecret(string $clientSecret): void
    {
        $this->clientSecret = $clientSecret;
    }

    public function getClientMetadataUrl(): string
    {
        return $this->clientMetadataUrl;
    }

    public function setClientMetadataUrl(string $url): void
    {
        $this->clientMetadataUrl = trim($url);
    }

    public function getTokenEndpointAuthMethod(): string
    {
        return $this->tokenEndpointAuthMethod;
    }

    public function setTokenEndpointAuthMethod(string $method): void
    {
        $this->tokenEndpointAuthMethod = strtolower(trim($method));
    }

    public function getApplicationType(): string
    {
        return $this->applicationType;
    }

    public function setApplicationType(string $type): void
    {
        $this->applicationType = strtolower(trim($type)) ?: 'native';
    }

    public function getScope(): string
    {
        return $this->scope;
    }

    public function setScope(string $scope): void
    {
        $this->scope = trim($scope);
    }

    public function getRedirectUri(): string
    {
        return $this->redirectUri;
    }

    public function setRedirectUri(string $uri): void
    {
        $this->redirectUri = trim($uri);
    }

    /**
     * @return array<string, mixed>
     */
    public function getAdditionalParams(): array
    {
        return $this->additionalParams;
    }

    /**
     * @param array<string, mixed> $params
     */
    public function setAdditionalParams(array $params): void
    {
        $this->additionalParams = $params;
    }

    /**
     * 验证新模式配置的静态约束。
     *
     * @param bool $validateRequiredFields 是否校验注册模式的条件必填字段
     */
    public function validate(bool $validateRequiredFields = true): void
    {
        if (! in_array($this->registrationMode, ['auto', 'pre_registered', 'cimd', 'dcr'], true)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'mcp.fields.registration_mode']);
        }
        if ($this->tokenEndpointAuthMethod !== '' && ! in_array($this->tokenEndpointAuthMethod, ['none', 'client_secret_basic', 'client_secret_post'], true)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'mcp.fields.token_endpoint_auth_method']);
        }
        if ($validateRequiredFields && $this->registrationMode === 'pre_registered' && empty($this->clientId)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.client_id']);
        }
        if ($validateRequiredFields && $this->registrationMode === 'cimd' && ! filter_var($this->clientMetadataUrl, FILTER_VALIDATE_URL)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'mcp.fields.client_metadata_url']);
        }
        foreach (['resource_metadata_url' => $this->resourceMetadataUrl, 'authorization_server_url' => $this->authorizationServerUrl, 'authorization_endpoint' => $this->authorizationEndpoint, 'token_endpoint' => $this->tokenEndpoint, 'registration_endpoint' => $this->registrationEndpoint, 'redirect_uri' => $this->redirectUri] as $field => $url) {
            if ($url !== '' && ! filter_var($url, FILTER_VALIDATE_URL)) {
                ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'mcp.fields.' . $field]);
            }
            if ($url !== '' && $field !== 'redirect_uri') {
                SSRFUtil::getSafeUrl($url, replaceIp: false, allowRedirect: false);
            }
        }
    }

    /**
     * 转换为不包含 secret 的配置数组。
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'resource' => $this->resource,
            'resource_metadata_url' => $this->resourceMetadataUrl,
            'authorization_server_url' => $this->authorizationServerUrl,
            'authorization_endpoint' => $this->authorizationEndpoint,
            'token_endpoint' => $this->tokenEndpoint,
            'registration_endpoint' => $this->registrationEndpoint,
            'registration_mode' => $this->registrationMode,
            'client_id' => $this->clientId,
            'client_metadata_url' => $this->clientMetadataUrl,
            'token_endpoint_auth_method' => $this->tokenEndpointAuthMethod,
            'application_type' => $this->applicationType,
            'scope' => $this->scope,
            'redirect_uri' => $this->redirectUri,
            'additional_params' => $this->additionalParams,
        ];
    }

    /**
     * 从配置数组构造值对象。
     *
     * @param array<string, mixed> $array
     */
    public static function fromArray(array $array): self
    {
        $instance = new self();
        $instance->setResource((string) ($array['resource'] ?? ''));
        $instance->setResourceMetadataUrl((string) ($array['resource_metadata_url'] ?? ''));
        $instance->setAuthorizationServerUrl((string) ($array['authorization_server_url'] ?? ''));
        $instance->setAuthorizationEndpoint((string) ($array['authorization_endpoint'] ?? ''));
        $instance->setTokenEndpoint((string) ($array['token_endpoint'] ?? ''));
        $instance->setRegistrationEndpoint((string) ($array['registration_endpoint'] ?? ''));
        $instance->setRegistrationMode((string) ($array['registration_mode'] ?? 'auto'));
        $instance->setClientId((string) ($array['client_id'] ?? ''));
        $instance->setClientSecret((string) ($array['client_secret'] ?? ''));
        $instance->setClientMetadataUrl((string) ($array['client_metadata_url'] ?? ''));
        $instance->setTokenEndpointAuthMethod((string) ($array['token_endpoint_auth_method'] ?? ''));
        $instance->setApplicationType((string) ($array['application_type'] ?? 'native'));
        $instance->setScope((string) ($array['scope'] ?? ''));
        $instance->setRedirectUri((string) ($array['redirect_uri'] ?? ''));
        $instance->setAdditionalParams(is_array($array['additional_params'] ?? null) ? $array['additional_params'] : []);
        return $instance;
    }
}
