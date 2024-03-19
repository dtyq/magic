<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Chat\Entity\MagicMessageVersionEntity;
use App\Domain\Chat\Service\AbstractDomainService;

class MagicMessageVersionDomainService extends AbstractDomainService
{
    /**
     * 获取消息的版本列表，按 version_id 升序.
     * @return null|MagicMessageVersionEntity[]
     */
    public function getMessageVersions(string $magicMessageId): ?array
    {
        $messageVersions = $this->magicChatMessageVersionsRepository->getMessageVersions($magicMessageId);
        if (empty($messageVersions)) {
            return null;
        }
        // 按 version_id 升序
        usort($messageVersions, function ($a, $b) {
            return $a->getVersionId() <=> $b->getVersionId();
        });
        return $messageVersions;
    }
}
