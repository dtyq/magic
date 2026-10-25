<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Unit;

use App\Domain\File\Constant\FileUploadBusinessCode;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class FileUploadBusinessCodeTest extends TestCase
{
    public function testAssetBusinessCodeResolvesToAssetDirectory(): void
    {
        $directory = FileUploadBusinessCode::from('asset')->getDir();

        self::assertStringStartsWith('asset/', $directory);
    }
}
