<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Service;

use App\Domain\Notification\Entity\NotificationEntity;
use BackedEnum;

/** Restore stable routing fields for messages written by older producers. */
final class NotificationResourcePayload
{
    public static function canOpenResource(NotificationEntity $notification, ?string $businessResult = null): bool
    {
        if ($notification->getMessageStatus()->value !== 'active') {
            return false;
        }
        $type = $notification->getType();
        $type = $type instanceof BackedEnum ? $type->value : $type;
        if (is_string($type) && str_ends_with($type, '_access_revoked')) {
            return false;
        }
        if ($notification->getCategory()?->value === 'authorization') {
            if ($notification->getActionStatus()->value !== 'accepted' || $businessResult !== 'applied') {
                return false;
            }
        }
        $payload = self::forNotification($notification);
        if (in_array($type, ['project_shared', 'file_shared'], true)) {
            return ! empty($payload['share_code']);
        }
        if (($payload['project_mode'] ?? '') === 'magiclaw') {
            return ! empty($payload['resource_code']);
        }
        if (in_array($type, ['task_finished', 'task_failed'], true)) {
            return ! empty($payload['project_id']) && ! empty($payload['topic_id']);
        }
        return match ($payload['resource_type'] ?? null) {
            'agent', 'skill' => ! empty($payload['resource_code']),
            'project', 'micro_app' => ! empty($payload['resource_id']),
            default => false,
        };
    }

    /** @return array<string, mixed> */
    public static function forNotification(NotificationEntity $notification): array
    {
        $payload = $notification->getPayload();
        $type = $notification->getType();
        $type = $type instanceof BackedEnum ? $type->value : $type;
        $resourceType = match ($type) {
            'task_finished', 'task_failed', 'project_shared', 'project_invitation', 'project_access_revoked' => 'project',
            'file_shared' => 'file',
            'agent_approved', 'agent_invitation', 'agent_access_revoked' => 'agent',
            'skill_approved', 'skill_invitation', 'skill_access_revoked' => 'skill',
            'micro_app_invitation', 'micro_app_access_revoked' => 'micro_app',
            default => null,
        };
        if ($resourceType !== null && empty($payload['resource_type'])) {
            $payload['resource_type'] = $resourceType;
        }
        if (in_array($type, ['task_finished', 'task_failed'], true)) {
            // The event source ID is a task ID, never a project route parameter.
            if (empty($payload['resource_id']) && ! empty($payload['project_id'])) {
                $payload['resource_id'] = (string) $payload['project_id'];
            }
        } elseif ($resourceType !== null && empty($payload['resource_id'])) {
            $payload['resource_id'] = $notification->getSourceId();
        }
        return $payload;
    }
}
