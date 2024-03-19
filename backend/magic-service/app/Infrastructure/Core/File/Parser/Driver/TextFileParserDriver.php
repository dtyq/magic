<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\File\Parser\Driver;

use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\File\Parser\Driver\Interfaces\TextFileParserDriverInterface;
use Exception;

class TextFileParserDriver implements TextFileParserDriverInterface
{
    public function parse(string $filePath, string $url, string $fileExtension, array $config = []): string
    {
        try {
            $content = file_get_contents($filePath);
            if ($content === false) {
                ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, sprintf('Failed to read file: %s', $filePath));
            }
            return $content;
        } catch (Exception $e) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, sprintf('Failed to read text file: %s', $e->getMessage()));
        }
    }
}
