<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Infrastructure\Core\ClassMap\SocketIoServer\DistributedSidCodec;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class DistributedSidCodecTest extends TestCase
{
    public function testBuildAndParseSid(): void
    {
        $sid = DistributedSidCodec::buildSid('server-a', 123, 456);
        $parsed = DistributedSidCodec::parseSid($sid);

        self::assertSame('server-a:p123#456', $sid);
        self::assertNotNull($parsed);
        self::assertSame('server-a', $parsed->serverId);
        self::assertSame(123, $parsed->pid);
        self::assertSame('server-a:p123', $parsed->nodeId);
        self::assertSame(456, $parsed->seq);
        self::assertSame('server-a:p123', DistributedSidCodec::parseNodeIdFromSid($sid));
    }

    public function testParseSidSupportsColonInServerId(): void
    {
        $sid = DistributedSidCodec::buildSid('pod:with:colon', 99, 1);
        $parsed = DistributedSidCodec::parseSid($sid);

        self::assertNotNull($parsed);
        self::assertSame('pod:with:colon', $parsed->serverId);
        self::assertSame('pod:with:colon:p99', $parsed->nodeId);
    }

    public function testParseInvalidSidReturnsNull(): void
    {
        self::assertNull(DistributedSidCodec::parseSid(''));
        self::assertNull(DistributedSidCodec::parseSid('server:p1'));
        self::assertNull(DistributedSidCodec::parseSid('server:p#1'));
        self::assertNull(DistributedSidCodec::parseSid('server:pabc#1'));
        self::assertNull(DistributedSidCodec::parseSid('server:p1#abc'));
    }

    public function testIsSelfRoomRequiresExactMatch(): void
    {
        $sid = DistributedSidCodec::buildSid('server-a', 1, 2);

        self::assertTrue(DistributedSidCodec::isSelfRoom($sid, $sid));
        self::assertFalse(DistributedSidCodec::isSelfRoom($sid, 'user-room'));
        self::assertFalse(DistributedSidCodec::isSelfRoom('', ''));
    }
}
