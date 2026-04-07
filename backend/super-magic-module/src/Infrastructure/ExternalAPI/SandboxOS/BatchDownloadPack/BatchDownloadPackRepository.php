<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\BatchDownloadPack;

use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\BatchDownloadPackRepositoryInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\FileConverterInterface;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Request\FileConverterRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response\FileConverterResponse;

class BatchDownloadPackRepository implements BatchDownloadPackRepositoryInterface
{
    public function __construct(
        private readonly FileConverterInterface $fileConverter,
    ) {
    }

    public function submitPackTask(
        string $userId,
        string $organizationCode,
        string $sandboxId,
        string $projectId,
        FileConverterRequest $request,
        string $workDir
    ): FileConverterResponse {
        return $this->fileConverter->convert(
            $userId,
            $organizationCode,
            $sandboxId,
            $projectId,
            $request,
            $workDir
        );
    }

    public function queryPackTask(string $sandboxId, string $projectId, string $taskKey): FileConverterResponse
    {
        return $this->fileConverter->queryConvertResult($sandboxId, $projectId, $taskKey);
    }
}
