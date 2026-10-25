<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Response;

use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Contract\ResponseInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;

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

    private string $status;

    private string $taskKey;

    private int $progress;

    private ?string $error;

    public function __construct(bool $success, int $code, string $message, string $fileKey = '', array $metadata = [], string $status = '', string $taskKey = '', int $progress = 0, ?string $error = null)
    {
        $this->success = $success;
        $this->code = $code;
        $this->message = $message;
        $this->fileKey = $fileKey;
        $this->metadata = $metadata;
        $this->status = $status;
        $this->taskKey = $taskKey;
        $this->progress = $progress;
        $this->error = $error;
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
            (string) ($data['status'] ?? ''),
            (string) ($data['task_key'] ?? ''),
            (int) ($data['progress'] ?? 0),
            isset($data['error']) ? (string) $data['error'] : null,
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
            (string) ($data['status'] ?? ''),
            (string) ($data['task_key'] ?? ''),
            (int) ($data['progress'] ?? 0),
            isset($data['error']) ? (string) $data['error'] : null,
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

    public function getStatus(): string
    {
        return $this->status;
    }

    public function getTaskKey(): string
    {
        return $this->taskKey;
    }

    public function getProgress(): int
    {
        return $this->progress;
    }

    public function getError(): ?string
    {
        return $this->error;
    }

    public function getData(): array
    {
        $data = [
            'code' => $this->code,
            'message' => $this->message,
            'file_key' => $this->fileKey,
            'metadata' => $this->metadata,
            'progress' => $this->progress,
        ];
        if ($this->status !== '') {
            $data['status'] = $this->status;
        }
        if ($this->taskKey !== '') {
            $data['task_key'] = $this->taskKey;
        }
        if ($this->error !== null && $this->error !== '') {
            $data['error'] = $this->error;
        }
        return $data;
    }

    public function toArray(): array
    {
        return $this->getData();
    }
}
