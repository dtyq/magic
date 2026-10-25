<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Persistence;

use App\Domain\Notification\Constant\NotificationTemplateStatus;
use App\Domain\Notification\Entity\NotificationTemplateEntity;
use App\Domain\Notification\Repository\Facade\NotificationTemplateRepositoryInterface;
use Hyperf\DbConnection\Db;

final class NotificationTemplateRepository implements NotificationTemplateRepositoryInterface
{
    public function findByTypeVersionLocale(
        string $templateType,
        int $version,
        string $locale
    ): ?NotificationTemplateEntity {
        $row = Db::table('magic_notification_templates')
            ->where('template_type', $templateType)
            ->where('version', $version)
            ->where('locale', $locale)
            ->first();
        return $row === null ? null : NotificationTemplateEntity::fromArray((array) $row);
    }

    public function listCatalog(string $locale): array
    {
        $rows = Db::table('magic_notification_templates')
            ->where('locale', $locale)
            ->orderBy('template_type')
            ->orderByDesc('version')
            ->get();

        $templates = [];
        foreach ($rows as $row) {
            $templates[] = NotificationTemplateEntity::fromArray((array) $row);
        }
        return $templates;
    }

    public function findLatestActive(string $templateType, string $locale): ?NotificationTemplateEntity
    {
        $row = Db::table('magic_notification_templates')
            ->where('template_type', $templateType)
            ->where('locale', $locale)
            ->where('status', NotificationTemplateStatus::ACTIVE->value)
            ->orderByDesc('version')
            ->first();
        return $row === null ? null : NotificationTemplateEntity::fromArray((array) $row);
    }
}
