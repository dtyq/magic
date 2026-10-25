<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperMagic\Skill;

use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillCategoryQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillCategoryRelationType;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRelationRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillCategoryRepositoryInterface;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryRelationDomainService;
use PHPUnit\Framework\TestCase;
use Throwable;

/**
 * @internal
 */
final class SkillMultiCategoryDomainTest extends TestCase
{
    public function testCategoryIdsAreNormalizedAndStoredAsMultipleRelations(): void
    {
        $categoryRepository = new SkillCategoryRepositoryStub([
            3 => $this->category(3),
            7 => $this->category(7),
        ]);
        $relationRepository = new SkillCategoryRelationRepositoryStub();
        $service = new SkillCategoryRelationDomainService($relationRepository, $categoryRepository);

        self::assertSame([3, 7], $service->replaceMarketCategories('org', 42, [3, '7', 0, 3]));
        self::assertSame([3, 7], $service->getMarketCategoryIds(42));
    }

    public function testCategoryTreeCannotBeDeeperThanTwoLevels(): void
    {
        $categoryRepository = new SkillCategoryRepositoryStub([
            10 => $this->category(10),
            20 => $this->category(20, 10),
        ]);
        $service = $this->categoryService($categoryRepository);

        $this->expectException(Throwable::class);
        $service->save($this->category(30, 20));
    }

    public function testCategoryCannotUseItselfOrDescendantAsParent(): void
    {
        $categoryRepository = new SkillCategoryRepositoryStub([
            10 => $this->category(10),
            20 => $this->category(20, 10),
        ]);
        $service = $this->categoryService($categoryRepository);

        $this->expectException(Throwable::class);
        $service->save($this->category(10, 20));
    }

    public function testCategoryWithChildrenCannotBeDeleted(): void
    {
        $categoryRepository = new SkillCategoryRepositoryStub([
            10 => $this->category(10),
            20 => $this->category(20, 10),
        ]);
        $service = $this->categoryService($categoryRepository);

        $this->expectException(Throwable::class);
        $service->deleteById(10);
    }

    public function testParentFilterExpandsToAllDescendants(): void
    {
        $categoryRepository = new SkillCategoryRepositoryStub([
            10 => $this->category(10),
            20 => $this->category(20, 10),
            30 => $this->category(30, 20),
        ]);

        self::assertSame([10, 20, 30], $categoryRepository->findSelfAndDescendantIds([10]));
    }

    public function testCategoryEntityResolvesLocalizedNameWithDefaultFallback(): void
    {
        $category = $this->category(10)->setNameI18n([
            'default' => 'Default category',
            'zh_CN' => '分类',
        ]);

        self::assertSame('分类', $category->getI18nName('zh_CN'));
        self::assertSame('Default category', $category->getI18nName('en_US'));
    }

    public function testCategoryEntityReturnsEmptyNameWhenNoLanguageValueExists(): void
    {
        $category = $this->category(10)->setNameI18n(['zh_CN' => '分类']);

        self::assertSame('', $category->getI18nName('en_US'));
    }

    public function testVersionEntityResolvesLocalizedSourceWithDefaultFallback(): void
    {
        $version = (new SkillVersionEntity())->setSourceI18n([
            'default' => 'Default source',
            'zh_CN' => '来源',
        ]);

        self::assertSame('来源', $version->getI18nSource('zh_CN'));
        self::assertSame('Default source', $version->getI18nSource('en_US'));
    }

    private function categoryService(SkillCategoryRepositoryStub $categoryRepository): SkillCategoryDomainService
    {
        return new SkillCategoryDomainService(
            $categoryRepository,
            new SkillCategoryRelationDomainService(new SkillCategoryRelationRepositoryStub(), $categoryRepository)
        );
    }

    private function category(int $id, int $parentId = 0): SkillCategoryEntity
    {
        return (new SkillCategoryEntity())
            ->setId($id)
            ->setParentId($parentId)
            ->setNameI18n(['zh_CN' => '分类' . $id]);
    }
}

final class SkillCategoryRepositoryStub implements SkillCategoryRepositoryInterface
{
    /** @param array<int, SkillCategoryEntity> $categories */
    public function __construct(private array $categories = [])
    {
    }

    public function findById(int $id): ?SkillCategoryEntity
    {
        return $this->categories[$id] ?? null;
    }

    public function findByIds(array $ids): array
    {
        return array_values(array_intersect_key($this->categories, array_flip($ids)));
    }

    public function findByQuery(SkillCategoryQuery $query): array
    {
        return array_values($this->categories);
    }

    public function findAll(): array
    {
        return array_values($this->categories);
    }

    public function findChildren(int $parentId): array
    {
        return array_values(array_filter($this->categories, static fn (SkillCategoryEntity $category): bool => $category->getParentId() === $parentId));
    }

    public function findSelfAndDescendantIds(array $categoryIds): array
    {
        $result = array_values(array_unique(array_map('intval', $categoryIds)));
        $pending = $result;
        while ($pending !== []) {
            $children = [];
            foreach ($this->categories as $category) {
                if (in_array($category->getParentId(), $pending, true) && ! in_array($category->getId(), $result, true)) {
                    $children[] = (int) $category->getId();
                }
            }
            $result = array_merge($result, $children);
            $pending = $children;
        }
        return $result;
    }

    public function save(SkillCategoryEntity $entity): SkillCategoryEntity
    {
        $this->categories[(int) $entity->getId()] = $entity;
        return $entity;
    }

    public function deleteById(int $id): bool
    {
        unset($this->categories[$id]);
        return true;
    }
}

final class SkillCategoryRelationRepositoryStub implements SkillCategoryRelationRepositoryInterface
{
    /** @var array<string, array<int, int[]>> */
    private array $relations = [];

    public function replaceRelations(string $organizationCode, SkillCategoryRelationType $type, int $relationId, array $categoryIds): void
    {
        $this->relations[$type->value][$relationId] = $categoryIds;
    }

    public function findCategoryIds(SkillCategoryRelationType $type, int $relationId): array
    {
        return $this->relations[$type->value][$relationId] ?? [];
    }

    public function findCategoryIdsByRelationIds(SkillCategoryRelationType $type, array $relationIds): array
    {
        return array_intersect_key($this->relations[$type->value] ?? [], array_flip($relationIds));
    }

    public function deleteByRelationIds(SkillCategoryRelationType $type, array $relationIds): int
    {
        foreach ($relationIds as $relationId) {
            unset($this->relations[$type->value][$relationId]);
        }
        return count($relationIds);
    }

    public function countByCategoryId(SkillCategoryRelationType $type, int $categoryId): int
    {
        return 0;
    }

    public function countMarketRelationsByCategoryIds(array $categoryIds, bool $publishedOnly = false, bool $visibleOnly = false): array
    {
        return [];
    }

    public function findMarketIdsByCategoryIds(array $categoryIds, bool $publishedOnly = false, bool $visibleOnly = false): array
    {
        return [];
    }
}
