<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\SocketIO;

use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ChatSocketIoNameSpace;
use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\SocketIOServer\SocketIO;

/**
 * SocketIO utility class, unified management of SocketIO data pushing.
 */
class SocketIOUtil
{
    /**
     * Optimized push: only send seq_id, let RedisAdapter get complete message content locally
     * This can reduce Redis pub/sub bandwidth usage.
     */
    public static function sendSequenceId(MagicSeqEntity $receiveSeqEntity)
    {
        $socketEventType = self::getSocketEventType($receiveSeqEntity);
        // Only push seq_id, RedisAdapter will get complete content through MessageContentProvider
        $receiveData = ['seq_id' => $receiveSeqEntity->getSeqId()];
        di(SocketIO::class)->of(ChatSocketIoNameSpace::Im->value)->to($receiveSeqEntity->getObjectId())->emit($socketEventType->value, $receiveData);
    }

    /**
     * Push temporary status messages.
     */
    public static function sendIntermediate(SocketEventType $socketEventType, int|string $roomId, mixed $pushData)
    {
        di(SocketIO::class)->of(ChatSocketIoNameSpace::Im->value)->to($roomId)->emit($socketEventType->value, $pushData);
    }

    private static function getSocketEventType(MagicSeqEntity $seqEntity): SocketEventType
    {
        return SeqAssembler::getSocketEventType($seqEntity);
    }
}
