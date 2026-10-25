<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\OrganizationEnvironment\Service;

use App\Domain\Contact\Service\MagicAccountDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Domain\OrganizationEnvironment\Entity\ValueObject\OrganizationSearchField;
use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Di\Annotation\Inject;

class OrganizationAppService
{
    #[Inject]
    protected OrganizationDomainService $organizationDomainService;

    #[Inject]
    protected MagicUserDomainService $magicUserDomainService;

    #[Inject]
    protected MagicAccountDomainService $magicAccountDomainService;

    /**
     * @return array{total: int, list: array}
     */
    public function queries(Page $page, ?array $filters = null): array
    {
        return $this->organizationDomainService->queries($page, $filters);
    }

    /**
     * 按指定字段搜索组织。
     *
     * @param null|string $organizationCodeFilter 组织编码过滤条件；null 表示不限制组织
     * @return array{total: int, list: OrganizationEntity[]}
     */
    public function searchOrganizations(
        Page $page,
        OrganizationSearchField $searchField,
        string $keyword,
        ?string $organizationCodeFilter = null
    ): array {
        return $this->organizationDomainService->searchOrganizations($page, $searchField, $keyword, $organizationCodeFilter);
    }

    /**
     * @param string[] $creatorIds
     * @return array<string, array{user_id: string, magic_id: ?string, name: string, avatar: string, email: ?string, phone: ?string}>
     */
    public function getCreators(array $creatorIds): array
    {
        if ($creatorIds === []) {
            return [];
        }

        $users = $this->magicUserDomainService->getUserByIdsWithoutOrganization($creatorIds);
        if ($users === []) {
            return $this->buildFallbackCreators($creatorIds);
        }

        $creatorMap = [];
        $magicIdToUserId = [];

        foreach ($users as $user) {
            $userId = $user->getUserId();
            if ($userId === '') {
                continue;
            }
            $creatorMap[$userId] = [
                'user_id' => $userId,
                'magic_id' => $user->getMagicId(),
                'name' => $user->getNickname(),
                'avatar' => $user->getAvatarUrl(),
            ];
            $magicId = $user->getMagicId();
            $magicIdToUserId[$magicId] = $userId;
        }

        if ($magicIdToUserId !== []) {
            $accounts = $this->magicAccountDomainService->getAccountByMagicIds(array_keys($magicIdToUserId));
            foreach ($accounts as $account) {
                $magicId = $account->getMagicId();
                if ($magicId === null || $magicId === '') {
                    continue;
                }
                $userId = $magicIdToUserId[$magicId] ?? null;
                if ($userId === null || ! array_key_exists($userId, $creatorMap)) {
                    continue;
                }
                $creator = $creatorMap[$userId];
                if ($account->getRealName()) {
                    $creator['name'] = $account->getRealName();
                }
                $creator['email'] = $account->getEmail();
                $creator['phone'] = $account->getPhone();
                $creatorMap[$userId] = $creator;
            }
        }

        foreach ($creatorIds as $creatorId) {
            if (! array_key_exists($creatorId, $creatorMap)) {
                $creatorMap[$creatorId] = [
                    'user_id' => $creatorId,
                    'magic_id' => null,
                    'name' => '',
                    'avatar' => '',
                    'email' => null,
                    'phone' => null,
                ];
            }
        }

        return $creatorMap;
    }

    /**
     * @param string[] $creatorIds
     * @return array<string, array{user_id: string, magic_id: ?string, name: string, avatar: string, email: ?string, phone: ?string}>
     */
    private function buildFallbackCreators(array $creatorIds): array
    {
        $fallback = [];
        foreach ($creatorIds as $creatorId) {
            $fallback[$creatorId] = [
                'user_id' => $creatorId,
                'magic_id' => null,
                'name' => '',
                'avatar' => '',
                'email' => null,
                'phone' => null,
            ];
        }
        return $fallback;
    }
}
