<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Request\FileConverterRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\FileConverter\Response\FileConverterResponse;

interface FileConverterInterface
{
    /**
     * 转换文件.
     */
    public function convert(string $sandboxId, FileConverterRequest $request): FileConverterResponse;
}
