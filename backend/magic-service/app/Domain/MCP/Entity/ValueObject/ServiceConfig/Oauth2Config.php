<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\SSRF\SSRFUtil;

class Oauth2Config extends AbstractValueObject
{
    protected string $clientId = '';

    protected string $clientSecret = '';

    protected string $clientUrl = '';

    protected string $scope = '';

    protected string $authorizationUrl = '';

    protected string $authorizationContentType = '';

    public function getClientId(): string
    {
        return $this->clientId;
    }

    public function setClientId(string $clientId): void
    {
        $this->clientId = $clientId;
    }

    public function getClientSecret(): string
    {
        return $this->clientSecret;
    }

    public function setClientSecret(string $clientSecret): void
    {
        $this->clientSecret = $clientSecret;
    }

    public function getClientUrl(): string
    {
        return $this->clientUrl;
    }

    public function setClientUrl(string $clientUrl): void
    {
        $this->clientUrl = $clientUrl;
    }

    public function getScope(): string
    {
        return $this->scope;
    }

    public function setScope(string $scope): void
    {
        $this->scope = $scope;
    }

    public function getAuthorizationUrl(): string
    {
        return $this->authorizationUrl;
    }

    public function setAuthorizationUrl(string $authorizationUrl): void
    {
        $this->authorizationUrl = $authorizationUrl;
    }

    public function getAuthorizationContentType(): string
    {
        return $this->authorizationContentType;
    }

    public function setAuthorizationContentType(string $authorizationContentType): void
    {
        $this->authorizationContentType = $authorizationContentType;
    }

    public function validate(): void
    {
        // Validate required fields
        $requiredFields = [
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'client_url' => $this->clientUrl,
            'authorization_url' => $this->authorizationUrl,
        ];

        foreach ($requiredFields as $fieldKey => $fieldValue) {
            if (empty(trim($fieldValue))) {
                ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.' . $fieldKey]);
            }
        }

        // Validate URLs
        $urls = [
            'client_url' => $this->clientUrl,
            'authorization_url' => $this->authorizationUrl,
        ];

        foreach ($urls as $fieldKey => $url) {
            if (! is_url($url)) {
                ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'mcp.fields.' . $fieldKey]);
            }
            // Validate URL for SSRF protection
            SSRFUtil::getSafeUrl($url, replaceIp: false, allowRedirect: true);
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
        $instance->setAuthorizationContentType($array['authorization_content_type'] ?? '');
        return $instance;
    }
}
