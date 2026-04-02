<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Workspace\Request;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Contract\RequestInterface;

/**
 * Workspace export request.
 * Maps to the sandbox API: POST /api/v1/workspace/export.
 */
class ExportWorkspaceRequest implements RequestInterface
{
    public function __construct(
        private readonly string $type,
        private readonly string $code,
        private readonly array $uploadConfig,
        private readonly ?string $sourcePath = null,
    ) {
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getUploadConfig(): array
    {
        return $this->uploadConfig;
    }

    public function getSourcePath(): ?string
    {
        return $this->sourcePath;
    }

    public function toArray(): array
    {
        $request = [
            'type' => $this->type,
            'code' => $this->code,
            'upload_config' => $this->uploadConfig,
        ];

        if ($this->sourcePath !== null && $this->sourcePath !== '') {
            $request['source_path'] = $this->sourcePath;
        }

        return $request;
    }
}
