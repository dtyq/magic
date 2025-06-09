<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Repository\Facade\MagicChatSeqRepositoryInterface;
use App\Domain\Chat\Repository\Facade\MagicMessageRepositoryInterface;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\SocketIOServer\Parser\Decoder;
use Hyperf\SocketIOServer\Parser\Encoder;
use Hyperf\SocketIOServer\Parser\Engine;
use Hyperf\SocketIOServer\Parser\Packet;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Message content provider implementation
 * Retrieves complete message content based on seq_id to optimize SocketIO pub/sub performance.
 */
class MessageContentProvider implements MessageContentProviderInterface
{
    public function __construct(
        protected MagicChatSeqRepositoryInterface $seqRepository,
        protected MagicMessageRepositoryInterface $messageRepository,
        protected LoggerInterface $logger
    ) {
    }

    /**
     * Resolve actual message packet content
     * If seq_id is detected, retrieve complete message; otherwise return original packet.
     */
    public function resolveActualPacket(string $packet): string
    {
        try {
            if ($packet[0] !== Engine::MESSAGE) {
                return $packet;
            }
            $parserPacket = di(Decoder::class)->decode($packet);

            if (! is_array($parserPacket->data)) {
                return $packet;
            }
            $sequenceData = $parserPacket->data[1] ?? null;
            $sequenceId = $sequenceData['seq_id'] ?? null;

            // Check if it's a pure seq_id packet (contains only seq_id field)
            if (! is_numeric($sequenceId)) {
                return $packet;
            }
            $fullMessageData = $this->getFullMessageDataBySeqId($sequenceId);
            if ($fullMessageData !== null) {
                // Replace the data[1] part in the original packet
                $parserPacket->data[1] = $fullMessageData;

                // Re-encode the Socket.IO part
                $newPacket = Packet::create([
                    'type' => $parserPacket->type,
                    'nsp' => $parserPacket->nsp,
                    'id' => $parserPacket->id,
                    'data' => $parserPacket->data,
                ]);
                $encodedSocketIO = di(Encoder::class)->encode($newPacket);

                // Return with Engine.IO MESSAGE prefix
                return Engine::MESSAGE . $encodedSocketIO;
            }
            $this->logger->warning('Failed to resolve message content for packet, fallback to original, seq_id: ' . $sequenceId);
            return $packet;
        } catch (Throwable $e) {
            // Fallback to original packet when parsing fails
            $this->logger->warning('Failed to resolve message content for packet, fallback to original: ' . $e->getMessage());
        }

        return $packet;
    }

    /**
     * Get complete message data by seq_id.
     *
     * @param string $seqId Sequence ID
     * @return null|array Returns message data array, or null if not found
     */
    private function getFullMessageDataBySeqId(string $seqId): ?array
    {
        try {
            // 1. Get sequence entity by seq_id
            $seqEntity = $this->seqRepository->getSeqByMessageId($seqId);
            if ($seqEntity === null) {
                $this->logger->warning("Seq not found for seq_id: {$seqId}");
                return null;
            }

            // 2. If it's a chat message, need to get complete content from message table
            if ($seqEntity->getSeqType() instanceof ChatMessageType) {
                $magicMessageId = $seqEntity->getMagicMessageId();
                if (empty($magicMessageId)) {
                    $this->logger->warning("Empty magic_message_id for seq_id: {$seqId}");
                    return null;
                }

                $messageEntity = $this->messageRepository->getMessageByMagicMessageId($magicMessageId);
                if ($messageEntity === null) {
                    $this->logger->warning("Message not found for magic_message_id: {$magicMessageId}");
                    return null;
                }
            } else {
                $messageEntity = null;
            }

            // 3. Build complete client response structure
            return SeqAssembler::getClientSeqStruct($seqEntity, $messageEntity)->toArray();
        } catch (Throwable $e) {
            $this->logger->error("Failed to get message content for seq_id: {$seqId}, error: " . $e->getMessage());
            return null;
        }
    }
}
