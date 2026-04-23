<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ModelGateway;

use App\Infrastructure\ModelGateway\FfprobeVideoMediaProbe;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class FfprobeVideoMediaProbeTest extends TestCase
{
    public function testProbeReportsMissingFfprobeBinaryClearly(): void
    {
        $tempFile = tempnam(sys_get_temp_dir(), 'ffprobe-missing-');
        $this->assertIsString($tempFile);
        file_put_contents($tempFile, 'not a real video');

        try {
            $probe = new FfprobeVideoMediaProbe('__missing_ffprobe_for_test__');

            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('ffprobe binary not found');
            $this->expectExceptionMessage('MODEL_GATEWAY_FFPROBE_BINARY');

            $probe->probe($tempFile);
        } finally {
            if (is_file($tempFile)) {
                @unlink($tempFile);
            }
        }
    }
}
