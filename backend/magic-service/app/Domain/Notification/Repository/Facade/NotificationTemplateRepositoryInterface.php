<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Notification\Repository\Facade;

use App\Domain\Notification\Entity\NotificationTemplateEntity;

interface NotificationTemplateRepositoryInterface
{
    public function findByTypeVersionLocale(
        string $templateType,
        int $version,
        string $locale
    ): ?NotificationTemplateEntity;

    /** @return list<NotificationTemplateEntity> */
    public function listCatalog(string $locale): array;

    public function findLatestActive(string $templateType, string $locale): ?NotificationTemplateEntity;
}
