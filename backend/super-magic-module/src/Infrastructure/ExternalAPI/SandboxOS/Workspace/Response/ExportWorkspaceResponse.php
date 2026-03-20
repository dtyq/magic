<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Response;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract\ResponseInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;

/**
 * Workspace export response.
 * Wraps the sandbox API response for POST /api/v1/workspace/export.
 */
class ExportWorkspaceResponse implements ResponseInterface
{
    private bool $success;

    private int $code;

    private string $message;

    private string $fileKey;

    private array $metadata;

    public function __construct(bool $success, int $code, string $message, string $fileKey = '', array $metadata = [])
    {
        $this->success = $success;
        $this->code = $code;
        $this->message = $message;
        $this->fileKey = $fileKey;
        $this->metadata = $metadata;
    }

    public static function fromGatewayResult(GatewayResult $result): self
    {
        $data = $result->getData();
        return new self(
            $result->isSuccess(),
            $result->getCode(),
            $result->getMessage(),
            (string) ($data['file_key'] ?? ''),
            (array) ($data['metadata'] ?? []),
        );
    }

    public static function fromApiResponse(array $response): self
    {
        $data = $response['data'] ?? [];
        return new self(
            ($response['code'] ?? -1) === 1000,
            $response['code'] ?? -1,
            $response['message'] ?? 'Unknown error',
            (string) ($data['file_key'] ?? ''),
            (array) ($data['metadata'] ?? []),
        );
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function getCode(): int
    {
        return $this->code;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function getFileKey(): string
    {
        return $this->fileKey;
    }

    public function getMetadata(): array
    {
        return $this->metadata;
    }

    public function getData(): array
    {
        return [
            'file_key' => $this->fileKey,
            'metadata' => $this->metadata,
        ];
    }

    public function toArray(): array
    {
        return $this->getData();
    }
}
