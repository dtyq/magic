<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\Service;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillCategoryQuery;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryDomainService;
use App\ErrorCode\SuperMagicErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Skill\DTO\Request\CreateSkillCategoryRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillCategoriesRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillCategoryRequestAdminDTO;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class AdminSkillCategoryAppService extends AbstractSkillAppService
{
    public function __construct(
        private readonly SkillCategoryDomainService $categoryDomainService,
        private readonly MagicUserDomainService $magicUserDomainService,
    ) {
    }

    /** @return array<int, array<string, mixed>> */
    public function query(QuerySkillCategoriesRequestAdminDTO $requestDTO): array
    {
        $query = new SkillCategoryQuery();
        $query->setKeyword($requestDTO->getKeyword());
        $query->setStatus($requestDTO->getStatus());
        $categories = $this->categoryDomainService->findByQuery($query);
        if ($requestDTO->getKeyword() !== null) {
            $allQuery = new SkillCategoryQuery();
            $allQuery->setStatus($requestDTO->getStatus());
            $allCategories = $this->categoryDomainService->findByQuery($allQuery);
            $allMap = [];
            $retainedIds = [];
            foreach ($allCategories as $category) {
                $allMap[(int) $category->getId()] = $category;
            }
            foreach ($categories as $category) {
                $current = $category;
                while ($current !== null) {
                    $retainedIds[(int) $current->getId()] = true;
                    $parentId = $current->getParentId();
                    $current = $parentId === 0 ? null : ($allMap[$parentId] ?? null);
                }
            }
            $categories = array_values(array_filter(
                $allCategories,
                static fn (SkillCategoryEntity $category): bool => isset($retainedIds[(int) $category->getId()])
            ));
        }
        return $this->buildCategoryTree($categories, false, true, false, false);
    }

    /** @return array<string, mixed> */
    public function getDetail(int $id): array
    {
        $category = $this->get($id);
        $descendantIds = $this->categoryDomainService->findSelfAndDescendantIds([$id]);
        $marketIds = array_merge(...array_values($this->categoryDomainService->getMarketIdsMap($descendantIds)) ?: [[]]);
        return $this->buildCategoryResponse($category, $this->buildOperatorUserMap([$category]), count(array_unique($marketIds)));
    }

    /** @return array<string, mixed> */
    public function create(Authenticatable $authorization, CreateSkillCategoryRequestAdminDTO $requestDTO): array
    {
        $authorization = $this->resolveMagicUserAuthorization($authorization);
        $dataIsolation = $this->createSkillDataIsolation($authorization);
        $category = (new SkillCategoryEntity())
            ->setParentId((int) $requestDTO->parentId)
            ->setOrganizationCode($dataIsolation->getCurrentOrganizationCode())
            ->setNameI18n($requestDTO->nameI18n)
            ->setLogo($requestDTO->logo)
            ->setSortOrder($requestDTO->sortOrder)
            ->setStatus($requestDTO->status)
            ->setCreatorId($dataIsolation->getCurrentUserId())
            ->setModifierId($dataIsolation->getCurrentUserId());
        $category = $this->categoryDomainService->save($category);
        return $this->getDetail((int) $category->getId());
    }

    /** @return array<string, mixed> */
    public function update(Authenticatable $authorization, int $id, UpdateSkillCategoryRequestAdminDTO $requestDTO): array
    {
        $authorization = $this->resolveMagicUserAuthorization($authorization);
        $dataIsolation = $this->createSkillDataIsolation($authorization);
        $category = $this->get($id);
        $payload = $requestDTO->getUpdatePayload();
        if (array_key_exists('parent_id', $payload)) {
            $category->setParentId((int) $payload['parent_id']);
        }
        if (array_key_exists('name_i18n', $payload)) {
            $category->setNameI18n($payload['name_i18n']);
        }
        if (array_key_exists('logo', $payload)) {
            $category->setLogo($payload['logo']);
        }
        if (array_key_exists('sort_order', $payload)) {
            $category->setSortOrder($payload['sort_order']);
        }
        if (array_key_exists('status', $payload)) {
            $category->setStatus($payload['status']);
        }
        $category->setModifierId($dataIsolation->getCurrentUserId());
        $this->categoryDomainService->save($category);
        return $this->getDetail($id);
    }

    public function delete(int $id): void
    {
        $this->get($id);
        if (! $this->categoryDomainService->deleteById($id)) {
            ExceptionBuilder::throw(SuperMagicErrorCode::DeleteFailed, 'common.operation_failed');
        }
    }

    /** @return array<int, array<string, mixed>> */
    public function getPublicTree(bool $includeEmpty): array
    {
        $query = new SkillCategoryQuery();
        $query->setStatus(1);
        $categories = $this->categoryDomainService->findByQuery($query);
        $categories = $this->filterCategoriesWithEnabledAncestors($categories);
        $tree = $this->buildCategoryTree($categories, ! $includeEmpty, false, true, true);
        $this->updateCategoryLogoUrls($tree);
        return $tree;
    }

    /** @param SkillCategoryEntity[] $categories @return SkillCategoryEntity[] */
    private function filterCategoriesWithEnabledAncestors(array $categories): array
    {
        $map = [];
        foreach ($categories as $category) {
            $map[(int) $category->getId()] = $category;
        }

        $result = [];
        foreach ($categories as $category) {
            $parentId = $category->getParentId();
            $valid = true;
            while ($parentId !== 0) {
                $parent = $map[$parentId] ?? null;
                if ($parent === null) {
                    $valid = false;
                    break;
                }
                $parentId = $parent->getParentId();
            }
            if ($valid) {
                $result[] = $category;
            }
        }
        return $result;
    }

    private function get(int $id): SkillCategoryEntity
    {
        $category = $this->categoryDomainService->findById($id);
        if ($category === null) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => (string) $id]);
        }
        return $category;
    }

    /** @param SkillCategoryEntity[] $categories @return array<int, array<string, mixed>> */
    private function buildCategoryTree(
        array $categories,
        bool $removeEmpty,
        bool $includeOperators,
        bool $visiblePublishedOnly,
        bool $localizedNameOnly
    ): array {
        $categoryIds = array_values(array_filter(array_map(static fn (SkillCategoryEntity $category): ?int => $category->getId(), $categories)));
        $marketIdsMap = $visiblePublishedOnly
            ? $this->categoryDomainService->getVisiblePublishedMarketIdsMap($categoryIds)
            : $this->categoryDomainService->getMarketIdsMap($categoryIds);
        $operatorMap = $includeOperators ? $this->buildOperatorUserMap($categories) : [];
        $childrenByParent = [];
        foreach ($categories as $category) {
            $childrenByParent[$category->getParentId()][] = $category;
        }

        $build = function (int $parentId) use (&$build, $childrenByParent, $marketIdsMap, $operatorMap, $removeEmpty, $includeOperators, $localizedNameOnly): array {
            $nodes = [];
            foreach ($childrenByParent[$parentId] ?? [] as $category) {
                $children = $build((int) $category->getId());
                $marketIds = $marketIdsMap[(int) $category->getId()] ?? [];
                foreach ($children as $child) {
                    $marketIds = array_merge($marketIds, $child['_market_ids']);
                }
                $marketIds = array_values(array_unique($marketIds));
                if ($removeEmpty && $marketIds === []) {
                    continue;
                }
                $node = $this->buildCategoryResponse($category, $operatorMap, count($marketIds));
                $node['children'] = $children;
                if ($localizedNameOnly) {
                    $node['name'] = $category->getI18nName(CoContext::getLanguage());
                    unset($node['name_i18n']);
                }
                if (! $includeOperators) {
                    unset($node['creator'], $node['modifier']);
                }
                $node['_market_ids'] = $marketIds;
                $nodes[] = $node;
            }
            return $nodes;
        };

        return array_map(static function (array $node): array {
            return self::removeInternalMarketIds($node);
        }, $build(0));
    }

    /** @param array<string, MagicUserEntity> $operatorMap @return array<string, mixed> */
    private function buildCategoryResponse(SkillCategoryEntity $category, array $operatorMap, int $skillCount): array
    {
        $data = $category->toArray();
        $data['id'] = (string) $category->getId();
        $data['parent_id'] = (string) $category->getParentId();
        $data['skill_count'] = $skillCount;
        $data['creator'] = $this->buildUserInfo($category->getCreatorId(), $operatorMap);
        $data['modifier'] = $this->buildUserInfo($category->getModifierId(), $operatorMap);
        return $data;
    }

    /** @param SkillCategoryEntity[] $categories @return array<string, MagicUserEntity> */
    private function buildOperatorUserMap(array $categories): array
    {
        $userIds = [];
        foreach ($categories as $category) {
            $userIds[] = $category->getCreatorId();
            $userIds[] = $category->getModifierId();
        }
        $userIds = array_values(array_unique(array_filter($userIds)));
        if ($userIds === []) {
            return [];
        }
        try {
            $users = $this->magicUserDomainService->getUserByIdsWithoutOrganization($userIds);
        } catch (Throwable) {
            return [];
        }
        $map = [];
        foreach ($users as $user) {
            $map[$user->getUserId()] = $user;
        }
        return $map;
    }

    /** @param array<string, MagicUserEntity> $operatorMap @return array{user_id:string,nickname:string} */
    private function buildUserInfo(?string $userId, array $operatorMap): array
    {
        if ($userId === null || $userId === '') {
            return ['user_id' => '', 'nickname' => ''];
        }
        $user = $operatorMap[$userId] ?? null;
        return ['user_id' => $userId, 'nickname' => $user?->getNickname() ?? ''];
    }

    private function resolveMagicUserAuthorization(Authenticatable $authorization): MagicUserAuthorization
    {
        if (! $authorization instanceof MagicUserAuthorization) {
            ExceptionBuilder::throw(SuperMagicErrorCode::OperationFailed, 'common.operation_failed');
        }
        return $authorization;
    }

    private static function removeInternalMarketIds(array $node): array
    {
        unset($node['_market_ids']);
        $node['children'] = array_map(self::removeInternalMarketIds(...), $node['children'] ?? []);
        return $node;
    }

    /** @param array<int, array<string, mixed>> $tree */
    private function updateCategoryLogoUrls(array &$tree): void
    {
        $paths = [];
        $collect = static function (array $nodes) use (&$collect, &$paths): void {
            foreach ($nodes as $node) {
                $path = EasyFileTools::formatPath($node['logo'] ?? '');
                if ($path !== '') {
                    $paths[] = $path;
                }
                $collect($node['children'] ?? []);
            }
        };
        $collect($tree);
        if ($paths === []) {
            return;
        }

        $links = $this->getIconsWithSmartOrganization($paths);
        $replace = static function (array &$nodes) use (&$replace, $links): void {
            foreach ($nodes as &$node) {
                $path = EasyFileTools::formatPath($node['logo'] ?? '');
                if ($path !== '' && isset($links[$path])) {
                    $node['logo'] = $links[$path]->getUrl();
                }
                $replace($node['children']);
            }
        };
        $replace($tree);
    }
}
