<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class Oauth2Config extends AbstractValueObject
{
    protected string $clientId;

    protected string $clientSecret;

    protected string $clientUrl;

    protected string $scope = '';

    protected string $authorizationUrl;

    protected string $authorizationContentType = 'application/json';

    public function setClientId(string $clientId): void
    {
        $this->clientId = $clientId;
    }

    public function setClientSecret(string $clientSecret): void
    {
        $this->clientSecret = $clientSecret;
    }

    public function setClientUrl(string $clientUrl): void
    {
        $this->clientUrl = $clientUrl;
    }

    public function setScope(string $scope): void
    {
        $this->scope = $scope;
    }

    public function setAuthorizationUrl(string $authorizationUrl): void
    {
        $this->authorizationUrl = $authorizationUrl;
    }

    public function setAuthorizationContentType(string $authorizationContentType): void
    {
        $this->authorizationContentType = $authorizationContentType;
    }

    public function getAuthorizationUrl(): string
    {
        return $this->authorizationUrl;
    }

    public function getClientId(): string
    {
        return $this->clientId;
    }

    public function getClientSecret(): string
    {
        return $this->clientSecret;
    }

    public function getClientUrl(): string
    {
        return $this->clientUrl;
    }

    public function getScope(): string
    {
        return $this->scope;
    }

    public function getAuthorizationContentType(): string
    {
        return $this->authorizationContentType;
    }

    public function validate(): void
    {
        if (empty(trim($this->clientId))) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.client_id']);
        }

        if (empty(trim($this->clientSecret))) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.client_secret']);
        }

        if (empty(trim($this->clientUrl))) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.client_url']);
        }

        if (! is_url($this->clientUrl)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'mcp.fields.client_url']);
        }

        if (empty(trim($this->authorizationUrl))) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.authorization_url']);
        }

        if (! is_url($this->authorizationUrl)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'mcp.fields.authorization_url']);
        }
    }

    public static function fromArray(array $array): self
    {
        $instance = new self();
        $instance->setClientId($array['client_id'] ?? '');
        $instance->setClientSecret($array['client_secret'] ?? '');
        $instance->setClientUrl($array['client_url'] ?? '');
        $instance->setScope($array['scope'] ?? '');
        $instance->setAuthorizationUrl($array['authorization_url'] ?? '');
        $instance->setAuthorizationContentType($array['authorization_content_type'] ?? 'application/json');
        return $instance;
    }
}
