<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\File\Parser\Driver\Interfaces;

interface FileParserDriverInterface
{
    public function parse(string $filePath, string $url, string $fileExtension, array $config = []): string;
}
