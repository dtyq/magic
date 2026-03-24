<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Assembler;

use Dtyq\SuperMagic\Domain\Agent\Entity\MagicClawEntity;

class MagicClawAssembler
{
    /**
     * Assemble a full magic claw item (used in create response and detail response).
     * Includes extra field with project and topic info.
     *
     * @param array{project?: array<string,mixed>, topic?: array<string,mixed>} $extra
     * @return array<string,mixed>
     */
    public static function toItem(MagicClawEntity $entity, array $extra = []): array
    {
        return [
            'id' => (string) $entity->getId(),
            'code' => $entity->getCode(),
            'icon_file_url' => $entity->getIconFileUrl(),
            'name' => $entity->getName(),
            'description' => $entity->getDescription(),
            'template_code' => $entity->getTemplateCode(),
            'project_id' => (string) ($entity->getProjectId() ?? ''),
            'extra' => [
                'project' => $extra['project'] ?? [],
                'topic' => $extra['topic'] ?? [],
            ],
        ];
    }

    /**
     * Assemble a list item (used in queries response).
     * Does not include extra field.
     * Status is resolved externally via sandbox gateway and passed in — not stored on the entity.
     *
     * @param null|string $status Sandbox running status (e.g. Running, Exited, Pending) or null if unknown
     * @param null|int $topicId Current topic ID of the associated project, or null if none assigned
     * @return array<string,mixed>
     */
    public static function toListItem(MagicClawEntity $entity, ?string $status = null, ?int $topicId = null): array
    {
        return [
            'id' => (string) $entity->getId(),
            'code' => $entity->getCode(),
            'icon_file_url' => $entity->getIconFileUrl(),
            'name' => $entity->getName(),
            'description' => $entity->getDescription(),
            'template_code' => $entity->getTemplateCode(),
            'project_id' => (string) ($entity->getProjectId() ?? ''),
            'topic_id' => (string) ($topicId ?? ''),
            'status' => $status,
        ];
    }
}
