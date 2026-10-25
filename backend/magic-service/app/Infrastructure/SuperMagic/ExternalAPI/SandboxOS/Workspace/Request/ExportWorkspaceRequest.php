<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Workspace\Request;

use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Contract\RequestInterface;

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
        private readonly ?string $archiveRoot = null,
        private readonly ?string $fileName = null,
        private readonly ?array $publicUploadConfig = null,
        private readonly array $excludePaths = [],
        private readonly ?string $skillsMdHash = null,
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

    public function getArchiveRoot(): ?string
    {
        return $this->archiveRoot;
    }

    public function getFileName(): ?string
    {
        return $this->fileName;
    }

    public function getPublicUploadConfig(): ?array
    {
        return $this->publicUploadConfig;
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

        if ($this->archiveRoot !== null && $this->archiveRoot !== '') {
            $request['archive_root'] = $this->archiveRoot;
        }

        if ($this->fileName !== null && $this->fileName !== '') {
            $request['file_name'] = $this->fileName;
        }

        if ($this->publicUploadConfig !== null && $this->publicUploadConfig !== []) {
            $request['public_upload_config'] = $this->publicUploadConfig;
        }

        if ($this->excludePaths !== []) {
            $request['exclude_paths'] = $this->excludePaths;
        }
        if ($this->skillsMdHash !== null) {
            $request['skills_md_hash'] = $this->skillsMdHash;
        }

        return $request;
    }
}
