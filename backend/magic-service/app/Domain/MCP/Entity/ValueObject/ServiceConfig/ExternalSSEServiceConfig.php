<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

use App\Domain\MCP\Constant\ServiceConfigAuthType;
use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\SSRF\SSRFUtil;

class ExternalSSEServiceConfig extends AbstractServiceConfig
{
    protected string $url = '';

    /**
     * @var array<HeaderConfig>
     */
    protected array $headers = [];

    protected ServiceConfigAuthType $authType = ServiceConfigAuthType::NONE;

    protected ?Oauth2Config $oauth2Config = null;

    public function getAuthType(): ServiceConfigAuthType
    {
        return $this->authType;
    }

    public function setAuthType(int|ServiceConfigAuthType $authType): void
    {
        if (is_int($authType)) {
            $authType = ServiceConfigAuthType::tryFrom($authType) ?? ServiceConfigAuthType::NONE;
        }
        $this->authType = $authType;
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function setUrl(string $url): void
    {
        $this->url = $url;
    }

    /**
     * @return array<HeaderConfig>
     */
    public function getHeaders(): array
    {
        return $this->headers;
    }

    /**
     * @param array<HeaderConfig> $headers
     */
    public function setHeaders(array $headers): void
    {
        $this->headers = $headers;
    }

    public function addHeader(HeaderConfig $header): void
    {
        $this->headers[] = $header;
    }

    public function getOauth2Config(): ?Oauth2Config
    {
        return $this->oauth2Config;
    }

    public function setOauth2Config(null|array|Oauth2Config $oauth2Config): void
    {
        if (is_array($oauth2Config)) {
            $oauth2Config = Oauth2Config::fromArray($oauth2Config);
        }
        $this->oauth2Config = $oauth2Config;
    }

    public function validate(): void
    {
        // Validate URL
        if (empty(trim($this->url))) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.url']);
        }

        if (! is_url($this->url)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.invalid', ['label' => 'mcp.fields.url']);
        }

        // Validate URL for SSRF protection
        SSRFUtil::getSafeUrl($this->url, replaceIp: false, allowRedirect: true);

        // Validate each header using its own validation method
        foreach ($this->headers as $header) {
            $header->validate();
        }

        // Validate OAuth2 configuration only if authType is OAuth2
        if ($this->authType === ServiceConfigAuthType::OAUTH2) {
            $this->oauth2Config?->validate();
        }
    }

    public function toArray(): array
    {
        return [
            'url' => $this->url,
            'headers' => array_map(fn (HeaderConfig $header) => $header->toArray(), $this->headers),
            'auth_type' => $this->authType->value,
            'oauth2_config' => $this->oauth2Config?->toArray(),
        ];
    }

    public static function fromArray(array $array): ServiceConfigInterface
    {
        $instance = new self();
        $instance->setUrl($array['url'] ?? '');
        $instance->setHeaders(array_map(
            fn (array $headerData) => HeaderConfig::fromArray($headerData),
            $array['headers'] ?? []
        ));
        $instance->setAuthType($array['auth_type'] ?? 0);
        $instance->setOauth2Config($array['oauth2_config'] ?? $array['oauth2config'] ?? null);
        return $instance;
    }
}
