<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\ImageOperation;

use App\Infrastructure\Util\File\TemporaryFileManager;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class TemporaryFileManagerTest extends TestCase
{
    public function testCreateTempFileUsesGenericDirectoryAndPrefix(): void
    {
        $tempFile = TemporaryFileManager::createTempFile(
            prefix: 'generic_',
            directory: sys_get_temp_dir() . '/magic-generic-temp',
        );

        try {
            $this->assertStringContainsString('/magic-generic-temp/', $tempFile);
            $this->assertStringContainsString('generic_', basename($tempFile));
            $this->assertFileExists($tempFile);
        } finally {
            if (is_file($tempFile)) {
                unlink($tempFile);
            }
        }
    }
}
