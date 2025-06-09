<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

/**
 * Message content provider interface
 * Used to retrieve real message content from seq_id to reduce SocketIO pub/sub memory bandwidth usage.
 */
interface MessageContentProviderInterface
{
    /**
     * Resolve actual message packet content
     * If seq_id is detected, retrieve complete message; otherwise return original packet.
     *
     * @param string $packet Original message packet
     * @return string Resolved message packet
     */
    public function resolveActualPacket(string $packet): string;
}
