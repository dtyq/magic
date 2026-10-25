<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\Service;

use App\Domain\Contact\Entity\ValueObject\UserSearchField;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Di\Annotation\Inject;

class PlatformUserAppService extends AbstractContactAppService
{
    #[Inject]
    protected MagicUserDomainService $magicUserDomainService;

    /**
     * @return array{total: int, list: array<int, array<string, mixed>>}
     */
    public function queries(Page $page, ?array $filters = null): array
    {
        return $this->magicUserDomainService->queriesPlatformUsers($page, $filters);
    }

    /**
     * 按指定字段搜索用户。
     *
     * @param null|string $organizationCodeFilter 组织编码过滤条件；null 表示不限制组织
     * @return array{total: int, list: array<int, array<string, mixed>>}
     */
    public function searchUsers(
        Page $page,
        UserSearchField $searchField,
        string $keyword,
        ?string $organizationCodeFilter = null
    ): array {
        return $this->magicUserDomainService->searchUsers($page, $searchField, $keyword, $organizationCodeFilter);
    }
}
