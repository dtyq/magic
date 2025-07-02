<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

class SSEServiceConfig extends AbstractServiceConfig
{
    /**
     * @var array<HeaderConfig>
     */
    protected array $headers = [];

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

    public function validate(): void
    {
        // Validate each header using its own validation method
        foreach ($this->headers as $header) {
            $header->validate();
        }
    }

    public static function fromArray(array $array): ServiceConfigInterface
    {
        $instance = new self();
        $instance->setHeaders(array_map(
            fn (array $headerData) => HeaderConfig::fromArray($headerData),
            $array['headers'] ?? []
        ));
        return $instance;
    }
}
