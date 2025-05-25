<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Assembler;

use Dtyq\SuperMagic\Domain\SuperAgent\Event\TopicTaskMessageEvent;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;

/**
 * 话题任务消息装配器.
 */
class TopicTaskMessageAssembler
{
    /**
     * 将DTO转换为领域事件.
     */
    public static function toEvent(TopicTaskMessageDTO $dto): TopicTaskMessageEvent
    {
        return new TopicTaskMessageEvent($dto->getMetadata(), $dto->getPayload(), $dto->getTokenUsageDetails());
    }

    /**
     * 将领域事件转换为DTO.
     */
    public static function toDTO(TopicTaskMessageEvent $event): TopicTaskMessageDTO
    {
        return new TopicTaskMessageDTO(
            $event->getMetadata(),
            $event->getPayload(),
            $event->getTokenUsageDetails(),
        );
    }
}
