<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\ClassMap\SocketIoServer;

/**
 * Parsed Socket.IO sid.
 *
 * The sid format is part of the cross-node routing contract. If this value
 * object changes, update DistributedSidCodec and RedisAdapterV3 tests together.
 */
readonly class ParsedSid
{
    public function __construct(
        public string $serverId,
        public int $pid,
        public string $nodeId,
        public int $seq
    ) {
    }
}
