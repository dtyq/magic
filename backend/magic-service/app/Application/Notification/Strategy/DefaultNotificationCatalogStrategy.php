<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Strategy;

/**
 * 公共能力版本的消息目录。
 *
 * 企业扩展通过宿主侧组合策略追加目录项，公共策略不引用企业业务值。
 */
final class DefaultNotificationCatalogStrategy implements NotificationCatalogStrategyInterface
{
    /**
     * @var list<string>
     */
    private const EVENT_TYPES = [
        'task.finished',
        'task.error',
        'share.project.recipients_added',
        'share.file.recipients_added',
        'share.project.withdrawn',
        'share.file.withdrawn',
        'review.skill.version_approved',
        'review.agent.version_approved',
    ];

    /**
     * @var list<string>
     */
    private const NOTIFICATION_TYPES = [
        'task_finished',
        'task_failed',
        'project_shared',
        'file_shared',
        'skill_approved',
        'agent_approved',
    ];

    public function eventTypes(): array
    {
        return self::EVENT_TYPES;
    }

    public function notificationTypes(): array
    {
        return self::NOTIFICATION_TYPES;
    }

    public function supportsEvent(string $eventType): bool
    {
        return in_array($eventType, self::EVENT_TYPES, true);
    }

    public function supportsNotification(string $notificationType): bool
    {
        return in_array($notificationType, self::NOTIFICATION_TYPES, true);
    }

    public function notificationTypeForEvent(string $eventType, array $payload = []): ?string
    {
        return match ($eventType) {
            'task.finished' => 'task_finished',
            'task.error' => 'task_failed',
            'share.project.recipients_added' => 'project_shared',
            'share.file.recipients_added' => 'file_shared',
            'review.skill.version_approved' => 'skill_approved',
            'review.agent.version_approved' => 'agent_approved',
            default => null,
        };
    }
}
