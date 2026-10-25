<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Contact\Entity\ValueObject\AccountStatus;
use App\Domain\Contact\Repository\Facade\MagicAccountRepositoryInterface;
use Hyperf\DbConnection\Db;

/**
 * 账号状态领域服务。
 *
 * 状态变更集中在 magic-service，统一复用账号仓储的行锁和缓存失效逻辑。
 */
class MagicAccountStatusService
{
    public function __construct(
        private readonly MagicAccountRepositoryInterface $accountRepository,
    ) {
    }

    /**
     * 启用账号。
     *
     * @return bool 是否发生了状态变更
     */
    public function enable(string $magicId): bool
    {
        return Db::transaction(function () use ($magicId): bool {
            return $this->updateStatus($magicId, AccountStatus::Normal);
        });
    }

    /**
     * 在调用方事务中更新账号状态。
     *
     * @return bool 是否发生了状态变更
     */
    public function updateStatus(string $magicId, AccountStatus $targetStatus): bool
    {
        return $this->accountRepository->updateStatus($magicId, $targetStatus);
    }
}
