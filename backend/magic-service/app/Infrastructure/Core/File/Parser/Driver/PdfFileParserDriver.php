<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\File\Parser\Driver;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\PdfFileParserDriverInterface;
use App\Infrastructure\ExternalAPI\OCR\OCRClientType;
use App\Infrastructure\ExternalAPI\OCR\OCRService;
use Exception;

class PdfFileParserDriver implements PdfFileParserDriverInterface
{
    public function parse(string $filePath, string $url, string $fileExtension): string
    {
        try {
            /** @var OCRService $ocrService */
            $ocrService = di()->get(OCRService::class);
            return $ocrService->ocr(OCRClientType::VOLCE, $url);
        } catch (Exception $e) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, sprintf('Failed to read OCR file: %s', $e->getMessage()));
        }
    }
}
