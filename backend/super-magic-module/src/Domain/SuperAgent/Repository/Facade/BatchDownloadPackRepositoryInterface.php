<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Request\FileConverterRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response\FileConverterResponse;

interface BatchDownloadPackRepositoryInterface
{
    public function submitPackTask(
        string $userId,
        string $organizationCode,
        string $sandboxId,
        string $projectId,
        FileConverterRequest $request,
        string $workDir
    ): FileConverterResponse;

    public function queryPackTask(string $sandboxId, string $projectId, string $taskKey): FileConverterResponse;
}
