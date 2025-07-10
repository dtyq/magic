<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter\Request\PdfConverterRequest;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\PdfConverter\Response\PdfConverterResponse;

interface PdfConverterInterface
{
    /**
     * 转换 HTML 文件为 PDF.
     */
    public function convert(string $sandboxId, PdfConverterRequest $request): PdfConverterResponse;
}
