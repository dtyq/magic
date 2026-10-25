<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\SlidesTemplate;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateTagEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateTagQuery;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateTagRelationRepositoryInterface;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateTagRepositoryInterface;
use App\Domain\SlidesTemplate\Service\SlidesTemplateTagDomainService;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\Log\NullLogger;
use Psr\SimpleCache\CacheInterface;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class SlidesTemplateTagDomainServiceTest extends TestCase
{
    private static bool $hadOriginalContainer = false;

    private static ?ContainerInterface $originalContainer = null;

    public static function setUpBeforeClass(): void
    {
        self::$hadOriginalContainer = ApplicationContext::hasContainer();
        self::$originalContainer = self::$hadOriginalContainer ? ApplicationContext::getContainer() : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id)
            {
                return match ($id) {
                    ConfigInterface::class => new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return match ($key) {
                                'error_message' => [
                                    'exception_class' => BusinessException::class,
                                    'error_code_mapper' => [
                                        SlidesTemplateErrorCode::class => [47000, 47999],
                                    ],
                                ],
                                default => $default,
                            };
                        }

                        public function has(string $keys): bool
                        {
                            return $keys === 'error_message';
                        }

                        public function set(string $key, mixed $value): void
                        {
                        }
                    },
                    TranslatorInterface::class => new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
                        {
                            return $key;
                        }

                        public function getLocale(): string
                        {
                            return 'zh_CN';
                        }

                        public function setLocale(string $locale)
                        {
                            return $this;
                        }
                    },
                    default => throw new RuntimeException('Unexpected container dependency: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [ConfigInterface::class, TranslatorInterface::class], true);
            }
        });
    }

    public static function tearDownAfterClass(): void
    {
        $property = (new ReflectionClass(ApplicationContext::class))->getProperty('container');
        $property->setAccessible(true);
        $property->setValue(null, self::$hadOriginalContainer ? self::$originalContainer : null);

        self::$hadOriginalContainer = false;
        self::$originalContainer = null;
    }

    public function testUpdateRejectsNodeTypeChange(): void
    {
        $repository = new CapturingSlidesTemplateTagRepository();
        $repository->entityToFind = $this->makeGroup();
        $service = $this->makeService($repository);

        $tag = $this->makeTag()->setId(1);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::TAG_STRUCTURE_INVALID->value);

        $service->update($this->makeDataIsolation(), $tag);
    }

    public function testDeleteRejectsGroupWithChildren(): void
    {
        $repository = new CapturingSlidesTemplateTagRepository();
        $repository->entityToFind = $this->makeGroup();
        $repository->hasChildren = true;
        $service = $this->makeService($repository);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::TAG_STRUCTURE_INVALID->value);

        $service->delete($this->makeDataIsolation(), 1);
    }

    public function testFindEnabledByCodesIgnoresUnavailableTags(): void
    {
        $repository = new CapturingSlidesTemplateTagRepository();
        $repository->entitiesByCodes = [$this->makeTag()->setId(2)];

        $tags = $this->makeService($repository)->findEnabledByCodes(
            $this->makeDataIsolation(),
            ['purpose-annual-report', 'missing-tag'],
        );

        $this->assertCount(1, $tags);
        $this->assertSame('purpose-annual-report', $tags[0]->getCode());
    }

    public function testQueriesCachedVisibleGroupsUsesCacheAroundRealtimeQuery(): void
    {
        $repository = new CapturingSlidesTemplateTagRepository();
        $group = $this->makeGroup();
        $repository->visibleGroups = [$group];

        $cache = $this->createMock(CacheInterface::class);
        $cache->expects($this->once())
            ->method('get')
            ->with($this->isType('string'))
            ->willReturn(null);
        $cache->expects($this->once())
            ->method('set')
            ->with($this->isType('string'), [$group], 60)
            ->willReturn(true);

        $groups = $this->makeService($repository, $cache)->queriesCachedVisibleGroupsWithTagsByCategory(
            $this->makeDataIsolation(),
            'PPT-CATE-work',
        );

        $this->assertSame([$group], $groups);
    }

    private function makeService(CapturingSlidesTemplateTagRepository $repository, ?CacheInterface $cache = null): SlidesTemplateTagDomainService
    {
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());
        return new SlidesTemplateTagDomainService(
            $repository,
            new NullSlidesTemplateTagRelationRepository(),
            $loggerFactory,
            $cache ?? $this->createMock(CacheInterface::class),
        );
    }

    private function makeGroup(): SlidesTemplateTagEntity
    {
        $group = new SlidesTemplateTagEntity();
        $group->setId(1)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setParentId(0)
            ->setNodeType('group')
            ->setCode('purpose_group')
            ->setNameI18n(['zh_CN' => '用途与交付物', 'en_US' => 'Purpose']);

        return $group;
    }

    private function makeTag(): SlidesTemplateTagEntity
    {
        $tag = new SlidesTemplateTagEntity();
        $tag->setOrganizationCode('OFFICIAL_ORG')
            ->setParentId(1)
            ->setNodeType('tag')
            ->setCode('purpose-annual-report')
            ->setNameI18n(['zh_CN' => '年度报告', 'en_US' => 'Annual Report']);

        return $tag;
    }

    private function makeDataIsolation(): SlidesTemplateDataIsolation
    {
        /** @var SlidesTemplateDataIsolation $dataIsolation */
        $dataIsolation = (new ReflectionClass(SlidesTemplateDataIsolation::class))->newInstanceWithoutConstructor();
        $dataIsolation->setCurrentOrganizationCode('OFFICIAL_ORG');
        $dataIsolation->setCurrentUserId('user-1');
        $dataIsolation->setMagicId('magic-1');
        $dataIsolation->setEnabled(true);
        return $dataIsolation;
    }
}

class CapturingSlidesTemplateTagRepository implements SlidesTemplateTagRepositoryInterface
{
    public ?SlidesTemplateTagEntity $entityToFind = null;

    public bool $hasChildren = false;

    /** @var SlidesTemplateTagEntity[] */
    public array $entitiesByCodes = [];

    /** @var SlidesTemplateTagEntity[] */
    public array $visibleGroups = [];

    public function findById(SlidesTemplateDataIsolation $dataIsolation, int|string $id): ?SlidesTemplateTagEntity
    {
        return $this->entityToFind;
    }

    public function findByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateTagEntity
    {
        return $this->entityToFind;
    }

    public function findByCodeWithTrashed(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateTagEntity
    {
        return null;
    }

    public function findByCodes(SlidesTemplateDataIsolation $dataIsolation, array $codes, ?int $status = null): array
    {
        return $this->entitiesByCodes;
    }

    public function queriesWithTemplateCount(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateTagQuery $query, Page $page): array
    {
        return ['total' => 0, 'list' => []];
    }

    public function queriesVisibleGroupsWithTagsByCategory(SlidesTemplateDataIsolation $dataIsolation, ?string $categoryCode): array
    {
        return $this->visibleGroups;
    }

    public function queriesTree(SlidesTemplateDataIsolation $dataIsolation): array
    {
        return [];
    }

    public function existsByParentId(SlidesTemplateDataIsolation $dataIsolation, int $parentId): bool
    {
        return $this->hasChildren;
    }

    public function save(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateTagEntity $entity): SlidesTemplateTagEntity
    {
        return $entity;
    }

    public function updateStatus(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $status, string $updatedUid): bool
    {
        return true;
    }

    public function updateSort(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $sort, string $updatedUid): bool
    {
        return true;
    }

    public function delete(SlidesTemplateDataIsolation $dataIsolation, int|string $id): bool
    {
        return true;
    }
}

class NullSlidesTemplateTagRelationRepository implements SlidesTemplateTagRelationRepositoryInterface
{
    public function syncTemplateTags(SlidesTemplateDataIsolation $dataIsolation, int $templateId, array $tagIds, string $createdUid): void
    {
    }

    public function deleteByTemplateId(SlidesTemplateDataIsolation $dataIsolation, int $templateId): void
    {
    }

    public function findTagsByTemplateIds(SlidesTemplateDataIsolation $dataIsolation, array $templateIds, ?int $tagStatus = null): array
    {
        return [];
    }
}
