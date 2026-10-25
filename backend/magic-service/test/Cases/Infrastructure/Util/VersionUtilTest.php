<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util;

use App\Infrastructure\Util\VersionUtil;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
final class VersionUtilTest extends TestCase
{
    public function testIncrementsThreeSegmentVersionWithoutChangingPrefix(): void
    {
        self::assertSame('v1.0.1', VersionUtil::getNextVersion('v1.0.0'));
        self::assertSame('V1.0.1', VersionUtil::getNextVersion('V1.0.0'));
        self::assertSame('1.0.5', VersionUtil::getNextVersion('1.0.4'));
        self::assertSame('6.0.1', VersionUtil::getNextVersion('6.0.0'));
        self::assertSame('3.0.1', VersionUtil::getNextVersion('3.0.0'));
        self::assertSame('1.0.10', VersionUtil::getNextVersion('1.0.9'));
    }

    public function testIncrementsTwoSegmentVersionWithoutChangingPrefix(): void
    {
        self::assertSame('v1.1', VersionUtil::getNextVersion('v1.0'));
        self::assertSame('V1.10', VersionUtil::getNextVersion('V1.9'));
        self::assertSame('1.1', VersionUtil::getNextVersion('1.0'));
    }

    public function testInvalidHistoricalVersionFallsBackToV100(): void
    {
        self::assertSame('v1.0.0', VersionUtil::getNextVersion('V1'));
        self::assertSame('v1.0.0', VersionUtil::getNextVersion('24234'));
        self::assertSame('v1.0.0', VersionUtil::getNextVersion('adasd'));
    }

    public function testMissingHistoricalVersionKeepsInitialVersion(): void
    {
        self::assertSame('1.0.0', VersionUtil::getNextVersion(null));
        self::assertSame('1.0.0', VersionUtil::getNextVersion(''));
    }

    public function testOnlyTwoOrThreeNumericSegmentsAreValid(): void
    {
        self::assertTrue(VersionUtil::isValidVersion('v1.0'));
        self::assertTrue(VersionUtil::isValidVersion('V1.0.0'));
        self::assertTrue(VersionUtil::isValidVersion('1.0.0'));
        self::assertFalse(VersionUtil::isValidVersion('V1'));
        self::assertFalse(VersionUtil::isValidVersion('24234'));
        self::assertFalse(VersionUtil::isValidVersion('adasd'));
    }
}
