<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Response;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract\ResponseInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;

/**
 * Workspace import response.
 * Wraps the sandbox API response for POST /api/v1/workspace/import.
 */
class ImportWorkspaceResponse implements ResponseInterface
{
    private bool $success;

    private int $code;

    private string $message;

    private string $workspaceDir;

    private int $extractedFiles;

    public function __construct(
        bool $success,
        int $code,
        string $message,
        string $workspaceDir = '',
        int $extractedFiles = 0
    ) {
        $this->success = $success;
        $this->code = $code;
        $this->message = $message;
        $this->workspaceDir = $workspaceDir;
        $this->extractedFiles = $extractedFiles;
    }

    public static function fromGatewayResult(GatewayResult $result): self
    {
        $data = $result->getData();
        return new self(
            $result->isSuccess(),
            $result->getCode(),
            $result->getMessage(),
            (string) ($data['workspace_dir'] ?? ''),
            (int) ($data['extracted_files'] ?? 0),
        );
    }

    public static function fromApiResponse(array $response): self
    {
        $data = $response['data'] ?? [];
        return new self(
            ($response['code'] ?? -1) === 1000,
            (int) ($response['code'] ?? -1),
            (string) ($response['message'] ?? 'Unknown error'),
            (string) ($data['workspace_dir'] ?? ''),
            (int) ($data['extracted_files'] ?? 0),
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

    public function getWorkspaceDir(): string
    {
        return $this->workspaceDir;
    }

    public function getExtractedFiles(): int
    {
        return $this->extractedFiles;
    }

    public function getData(): array
    {
        return [
            'workspace_dir' => $this->workspaceDir,
            'extracted_files' => $this->extractedFiles,
        ];
    }

    public function toArray(): array
    {
        return $this->getData();
    }
}
