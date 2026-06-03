<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\ClassMap\SocketIoServer;

/**
 * Central codec for distributed Socket.IO sid.
 *
 * Format: {serverId}:p{pid}#{seq}
 *
 * RedisAdapterV3 depends on this format to route sid self-room messages
 * directly to a worker node without creating Redis room keys for every sid.
 * Do not parse or build sid strings outside this class.
 */
final class DistributedSidCodec
{
    public static function buildNodeId(string $serverId, int $pid): string
    {
        return $serverId . ':p' . max(0, $pid);
    }

    public static function buildSid(string $serverId, int $pid, int $seq): string
    {
        return self::buildNodeId($serverId, $pid) . '#' . max(0, $seq);
    }

    public static function parseSid(string $sid): ?ParsedSid
    {
        if ($sid === '') {
            return null;
        }

        $hashPos = strrpos($sid, '#');
        if ($hashPos === false || $hashPos === 0 || $hashPos === strlen($sid) - 1) {
            return null;
        }

        $nodeId = substr($sid, 0, $hashPos);
        $seqRaw = substr($sid, $hashPos + 1);
        if (! ctype_digit($seqRaw)) {
            return null;
        }

        $nodeMarkerPos = strrpos($nodeId, ':p');
        if ($nodeMarkerPos === false || $nodeMarkerPos === 0 || $nodeMarkerPos === strlen($nodeId) - 2) {
            return null;
        }

        $serverId = substr($nodeId, 0, $nodeMarkerPos);
        $pidRaw = substr($nodeId, $nodeMarkerPos + 2);
        if ($serverId === '' || ! ctype_digit($pidRaw)) {
            return null;
        }

        return new ParsedSid(
            serverId: $serverId,
            pid: (int) $pidRaw,
            nodeId: $nodeId,
            seq: (int) $seqRaw
        );
    }

    public static function parseNodeIdFromSid(string $sid): ?string
    {
        return self::parseSid($sid)?->nodeId;
    }

    public static function isSelfRoom(string $sid, string $room): bool
    {
        return $sid !== '' && $sid === $room;
    }
}
