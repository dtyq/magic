<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Assembler;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\OpenMessageScheduleEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\Query\OpenMessageScheduleQuery;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateOpenMessageScheduleRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateOpenMessageScheduleRequestDTO;

class OpenMessageScheduleAssembler
{
    public static function createEntity(CreateOpenMessageScheduleRequestDTO $dto): OpenMessageScheduleEntity
    {
        $entity = new OpenMessageScheduleEntity();
        $entity->setTaskName($dto->getTaskName());
        $entity->setSpecifyTopic($dto->getSpecifyTopic());
        $entity->setTopicId((int) $dto->getTopicId());
        $entity->setTimeConfig($dto->getTimeConfig());
        $entity->setEnabled(1);
        $entity->setRemark($dto->getRemark());
        $entity->setModelId($dto->getModelId());
        $entity->setMessageContentText($dto->getMessageContentText());
        $entity->setDeadline($dto->getDeadline());

        return $entity;
    }

    public static function updateEntity(UpdateOpenMessageScheduleRequestDTO $dto): OpenMessageScheduleEntity
    {
        $entity = new OpenMessageScheduleEntity();

        if ($dto->hasTaskName()) {
            $entity->setOpenTaskName($dto->getTaskName());
        }

        if ($dto->hasMessageContentText()) {
            $entity->setMessageContentText($dto->getMessageContentText());
        }

        if ($dto->hasTimeConfig()) {
            $entity->setOpenTimeConfig($dto->getTimeConfig());
        }

        if ($dto->hasEnabled()) {
            $entity->setOpenEnabled($dto->getEnabled());
        }

        if ($dto->hasModelId()) {
            $entity->setModelId($dto->getModelId());
        }

        if ($dto->hasDeadline()) {
            $entity->setOpenDeadline($dto->getDeadline());
        }

        return $entity;
    }

    public static function createQueryFromArray(array $data): OpenMessageScheduleQuery
    {
        $query = new OpenMessageScheduleQuery();
        $query->setProjectId(self::toNullableString($data, 'project_id'));
        $query->setTaskName(self::toNullableString($data, 'task_name'));
        $query->setEnabled(self::toNullableInt($data, 'enabled'));
        $query->setCompleted(self::toNullableInt($data, 'completed'));

        if (self::hasNonEmptyValue($data, 'page')) {
            $query->setPage((int) $data['page']);
        }

        if (self::hasNonEmptyValue($data, 'page_size')) {
            $query->setPageSize((int) $data['page_size']);
        }

        return $query;
    }

    private static function toNullableString(array $data, string $key): ?string
    {
        if (! self::hasNonEmptyValue($data, $key)) {
            return null;
        }

        return (string) $data[$key];
    }

    private static function toNullableInt(array $data, string $key): ?int
    {
        if (! self::hasNonEmptyValue($data, $key)) {
            return null;
        }

        return (int) $data[$key];
    }

    private static function hasNonEmptyValue(array $data, string $key): bool
    {
        return array_key_exists($key, $data) && $data[$key] !== null && $data[$key] !== '';
    }
}
