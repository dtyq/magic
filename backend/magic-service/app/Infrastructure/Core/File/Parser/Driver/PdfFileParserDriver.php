<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\File\Parser\Driver;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\PdfFileParserDriverInterface;
use App\Infrastructure\ExternalAPI\OCR\OCRClientFactory;
use App\Infrastructure\ExternalAPI\OCR\OCRClientType;
use App\Infrastructure\ExternalAPI\OCR\OCRService;
use Exception;

class PdfFileParserDriver implements PdfFileParserDriverInterface
{
    public function parse(string $filePath, string $url, string $fileExtension, array $config = []): string
    {
        try {
            $ocrService = make(OCRService::class, [
                'clientFactory' => make(OCRClientFactory::class),
            ]);
            return $ocrService->ocr(OCRClientType::Volcengine, $url, $config);
        } catch (Exception $e) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, sprintf('Failed to read OCR file: %s', $e->getMessage()));
        }
    }
}
