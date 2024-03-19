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

    public static function fromArray(array $array): self
    {
        $instance = new self();
        $instance->setHeaders(array_map(
            fn (array $headerData) => HeaderConfig::fromArray($headerData),
            $array['headers'] ?? []
        ));
        return $instance;
    }

    /**
     * Extract required fields from all headers.
     *
     * @return array<string> Array of field names
     */
    public function getRequireFields(): array
    {
        $fields = [];

        // Extract from all headers - only process header values
        foreach ($this->headers as $header) {
            $headerValue = $header->getValue();
            if (! empty($headerValue)) {
                $headerFields = $this->extractRequiredFields($headerValue);
                $fields = array_merge($fields, $headerFields);
            }
        }

        return array_unique($fields);
    }

    public function replaceRequiredFields(array $fieldValues): self
    {
        // Replace fields in headers directly
        foreach ($this->headers as $header) {
            // Only replace value field, keep key and mapper_system_input unchanged
            $header->setValue($this->replaceFields($header->getValue(), $fieldValues));
        }

        return $this;
    }

    public function toArray(): array
    {
        return [
            'headers' => array_map(fn (HeaderConfig $header) => [
                'key' => $header->getKey(),
                'value' => $header->getValue(),
                'mapper_system_input' => $header->getMapperSystemInput(),
            ], $this->headers),
        ];
    }
}
