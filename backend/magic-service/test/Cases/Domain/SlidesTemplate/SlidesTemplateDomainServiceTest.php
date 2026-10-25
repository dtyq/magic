<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Test\Cases\Domain\SlidesTemplate;

use App\Domain\SlidesTemplate\Entity\SlidesTemplateDataIsolation;
use App\Domain\SlidesTemplate\Entity\SlidesTemplateEntity;
use App\Domain\SlidesTemplate\Entity\ValueObject\Query\SlidesTemplateQuery;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateOwnerType;
use App\Domain\SlidesTemplate\Entity\ValueObject\SlidesTemplateSourceType;
use App\Domain\SlidesTemplate\Repository\Facade\SlidesTemplateRepositoryInterface;
use App\Domain\SlidesTemplate\Service\SlidesTemplateDomainService;
use App\Domain\SlidesTemplate\Service\SlidesTemplateTagDomainService;
use App\Domain\SlidesTemplate\Service\UsageCount\DefaultSlidesTemplateUsageCountPolicy;
use App\ErrorCode\SlidesTemplateErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionClass;
use RuntimeException;

/**
 * @internal
 */
class SlidesTemplateDomainServiceTest extends TestCase
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

    public function testCreateBuildsSearchTextBeforeSaving(): void
    {
        $repository = new CapturingSlidesTemplateRepository();
        $service = $this->makeService($repository);

        $template = $this->makeTemplate();
        $service->create($this->makeDataIsolation(), $template);

        $this->assertSame(
            'ppt-business-minimal system 职场白皮书 corporate whitepaper 适用于企业汇报 for business reviews',
            $repository->savedEntity?->toArray()['search_text'] ?? null
        );
        $this->assertSame('OFFICIAL_ORG', $repository->savedEntity?->getOrganizationCode());
        $this->assertSame(SlidesTemplateOwnerType::Official, $repository->savedEntity?->getOwnerType());
        $this->assertSame('OFFICIAL_ORG', $repository->savedEntity?->getOwnerId());
    }

    public function testCreateThrowsBusinessExceptionWhenCodeAlreadyExists(): void
    {
        $repository = new CapturingSlidesTemplateRepository();
        $repository->entityWithTrashed = $this->makeTemplate()->setId(123);
        $service = $this->makeService($repository);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::CODE_ALREADY_EXISTS->value);

        $service->create($this->makeDataIsolation(), $this->makeTemplate());
    }

    public function testCreateDoesNotRestoreDeletedTemplateWithSameCode(): void
    {
        $repository = new CapturingSlidesTemplateRepository();
        $repository->entityWithTrashed = $this->makeTemplate()
            ->setId(123)
            ->setActualUsageCount(7)
            ->setCreatedUid('old-user')
            ->setUpdatedUid('old-user')
            ->setDeletedAt('2026-07-01 10:00:00');
        $service = $this->makeService($repository);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::CODE_ALREADY_EXISTS->value);

        $service->create($this->makeDataIsolation(), $this->makeTemplate());
    }

    public function testFindByIdRejectsTemplateOutsideOfficialOrganization(): void
    {
        $repository = new CapturingSlidesTemplateRepository();
        $repository->entityToFind = $this->makeTemplate()
            ->setId(123)
            ->setOrganizationCode('PERSONAL_ORG')
            ->setOwnerType(SlidesTemplateOwnerType::Official)
            ->setOwnerId('PERSONAL_ORG');
        $service = $this->makeService($repository);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND->value);

        $service->findByIdOrFail($this->makeDataIsolation(), 123);
    }

    public function testFindOfficialByCodeRejectsOwnerIdMismatch(): void
    {
        $repository = new CapturingSlidesTemplateRepository();
        $repository->entityToFind = $this->makeTemplate()
            ->setId(123)
            ->setOrganizationCode('OFFICIAL_ORG')
            ->setOwnerType(SlidesTemplateOwnerType::Official)
            ->setOwnerId('another-owner');
        $service = $this->makeService($repository);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND->value);

        $service->findOfficialByCodeOrFail($this->makeDataIsolation(), 'PPT-BUSINESS-MINIMAL');
    }

    public function testAssertUserAccessibleAllowsOwnedDisabledPersonalTemplate(): void
    {
        $dataIsolation = $this->makeDataIsolation();
        $dataIsolation->setCurrentOrganizationCode('PERSONAL_ORG');
        $template = $this->makeTemplate()
            ->setOrganizationCode('PERSONAL_ORG')
            ->setOwnerType(SlidesTemplateOwnerType::User)
            ->setOwnerId('user-1')
            ->setStatus(0);

        $this->makeService(new CapturingSlidesTemplateRepository())->assertUserAccessible($dataIsolation, $template);

        $this->addToAssertionCount(1);
    }

    public function testAssertUserAccessibleRejectsOtherUsersPersonalTemplate(): void
    {
        $dataIsolation = $this->makeDataIsolation();
        $dataIsolation->setCurrentOrganizationCode('PERSONAL_ORG');
        $template = $this->makeTemplate()
            ->setOrganizationCode('PERSONAL_ORG')
            ->setOwnerType(SlidesTemplateOwnerType::User)
            ->setOwnerId('other-user');

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND->value);

        $this->makeService(new CapturingSlidesTemplateRepository())->assertUserAccessible($dataIsolation, $template);
    }

    public function testAssertUserAccessibleRejectsDisabledOfficialTemplate(): void
    {
        $template = $this->makeTemplate()->setStatus(0);

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND->value);

        $this->makeService(new CapturingSlidesTemplateRepository())->assertUserAccessible($this->makeDataIsolation(), $template);
    }

    public function testCreateRejectsNonOfficialOrganization(): void
    {
        $service = $this->makeService(new CapturingSlidesTemplateRepository());
        $dataIsolation = $this->makeDataIsolation();
        $dataIsolation->setCurrentOrganizationCode('PERSONAL_ORG');

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SlidesTemplateErrorCode::TEMPLATE_NOT_FOUND->value);

        $service->create($dataIsolation, $this->makeTemplate());
    }

    public function testUpdateRebuildsSearchTextBeforeSaving(): void
    {
        $repository = new CapturingSlidesTemplateRepository();
        $repository->entityToFind = $this->makeTemplate()->setId(123);
        $service = $this->makeService($repository);

        $template = $this->makeTemplate()
            ->setId(123)
            ->setLabel([
                'zh_CN' => '季度总结',
                'en_US' => 'Quarterly Review',
            ]);

        $service->update($this->makeDataIsolation(), $template);

        $this->assertSame(
            'ppt-business-minimal system 季度总结 quarterly review 适用于企业汇报 for business reviews',
            $repository->savedEntity?->toArray()['search_text'] ?? null
        );
    }

    public function testDefaultUsageCountPolicyReturnsTodayCreatedCount(): void
    {
        $repository = new CapturingSlidesTemplateRepository();
        $repository->countResult = 100;
        $repository->totalUsageCount = 200;
        $repository->todayCreatedCount = 12;

        $policy = new DefaultSlidesTemplateUsageCountPolicy($repository);

        $this->assertSame([
            'total' => 100,
            'total_usage_count' => 200,
            'template_count_today_growth' => 12,
        ], $policy->getCount($this->makeDataIsolation(), new SlidesTemplateQuery()));
    }

    public function testSaveUserTemplatePropagatesTransactionFailureWithoutExecutingPersistence(): void
    {
        $repository = new CapturingSlidesTemplateRepository();
        $tagService = $this->createMock(SlidesTemplateTagDomainService::class);
        $tagService->expects(self::never())->method('syncTemplateTagsByCodes');
        $service = new FailingTransactionSlidesTemplateDomainService($repository, $tagService);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('transaction failed');

        try {
            $service->saveUserTemplate(
                $this->makeDataIsolation(),
                $this->makeTemplate()->setCode('PERSONAL-TEMPLATE'),
                null,
                ['tag-a']
            );
        } finally {
            self::assertNull($repository->savedEntity);
        }
    }

    private function makeTemplate(): SlidesTemplateEntity
    {
        $template = new SlidesTemplateEntity();
        $template->setOrganizationCode('OFFICIAL_ORG')
            ->setOwnerType(SlidesTemplateOwnerType::Official)
            ->setOwnerId('OFFICIAL_ORG')
            ->setCode('PPT-BUSINESS-MINIMAL')
            ->setSourceType(SlidesTemplateSourceType::System)
            ->setLabel([
                'zh_CN' => '职场白皮书',
                'en_US' => 'Corporate Whitepaper',
            ])
            ->setDescription([
                'zh_CN' => '适用于企业汇报',
                'en_US' => 'For business reviews',
            ]);

        return $template;
    }

    private function makeDataIsolation(): SlidesTemplateDataIsolation
    {
        /** @var SlidesTemplateDataIsolation $dataIsolation */
        $dataIsolation = (new ReflectionClass(SlidesTemplateDataIsolation::class))->newInstanceWithoutConstructor();
        $dataIsolation->setCurrentOrganizationCode('OFFICIAL_ORG');
        $dataIsolation->setCurrentUserId('user-1');
        $dataIsolation->setMagicId('magic-1');
        $dataIsolation->setEnabled(true);
        $dataIsolation->setOfficialOrganizationCodes(['OFFICIAL_ORG']);
        return $dataIsolation;
    }

    private function makeService(CapturingSlidesTemplateRepository $repository): SlidesTemplateDomainService
    {
        return new SlidesTemplateDomainService(
            $repository,
            new DefaultSlidesTemplateUsageCountPolicy($repository),
            $this->createMock(SlidesTemplateTagDomainService::class),
        );
    }
}

class CapturingSlidesTemplateRepository implements SlidesTemplateRepositoryInterface
{
    public ?SlidesTemplateEntity $savedEntity = null;

    public ?SlidesTemplateEntity $entityToFind = null;

    public ?SlidesTemplateEntity $entityWithTrashed = null;

    public int $countResult = 0;

    public int $totalUsageCount = 0;

    public int $todayCreatedCount = 0;

    public function findById(SlidesTemplateDataIsolation $dataIsolation, int|string $id): ?SlidesTemplateEntity
    {
        return $this->entityToFind;
    }

    public function findByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity
    {
        return $this->entityToFind;
    }

    public function findByCodeWithTrashed(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity
    {
        return $this->entityWithTrashed;
    }

    public function findGloballyByCodeWithTrashed(string $code): ?SlidesTemplateEntity
    {
        return $this->entityWithTrashed;
    }

    public function findOfficialByCode(SlidesTemplateDataIsolation $dataIsolation, string $code): ?SlidesTemplateEntity
    {
        return $this->entityToFind;
    }

    public function findByCodes(SlidesTemplateDataIsolation $dataIsolation, array $codes): array
    {
        return $this->entityToFind ? [$this->entityToFind] : [];
    }

    public function findByIds(SlidesTemplateDataIsolation $dataIsolation, array $ids): array
    {
        return $this->entityToFind ? [$this->entityToFind] : [];
    }

    public function findVisibleByIds(
        SlidesTemplateDataIsolation $dataIsolation,
        array $ids,
    ): array {
        return $this->entityToFind ? [$this->entityToFind] : [];
    }

    public function findIdsForSync(
        SlidesTemplateDataIsolation $dataIsolation,
        string $organizationCode,
        array $templateIds,
        ?string $categoryCode,
        array $tagCodes,
        string $tagMatch,
        string $afterId,
        int $limit
    ): array {
        return [];
    }

    public function queries(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query, Page $page): array
    {
        return ['total' => 0, 'list' => []];
    }

    public function queriesFavorites(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query, Page $page): array
    {
        return ['total' => 0, 'list' => []];
    }

    public function count(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int
    {
        return $this->countResult;
    }

    public function sumTotalUsageCount(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int
    {
        return $this->totalUsageCount;
    }

    public function countTodayCreated(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateQuery $query): int
    {
        return $this->todayCreatedCount;
    }

    public function save(SlidesTemplateDataIsolation $dataIsolation, SlidesTemplateEntity $entity): SlidesTemplateEntity
    {
        $this->savedEntity = $entity;
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

    public function incrementActualUsageCount(SlidesTemplateDataIsolation $dataIsolation, string $code, int $totalUsageIncrement): bool
    {
        return true;
    }

    public function updateBaseUsageCount(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $baseUsageCount, int $totalUsageCount, string $updatedUid): bool
    {
        return true;
    }

    public function findRankedForUsageCount(SlidesTemplateDataIsolation $dataIsolation, int $offset, int $limit): array
    {
        return [];
    }

    public function countForUsageCount(SlidesTemplateDataIsolation $dataIsolation): int
    {
        return 0;
    }

    public function updateUsageCounts(SlidesTemplateDataIsolation $dataIsolation, int|string $id, int $baseUsageCount, int $totalUsageCount): bool
    {
        return true;
    }

    public function delete(SlidesTemplateDataIsolation $dataIsolation, int|string $id): bool
    {
        return true;
    }
}

class FailingTransactionSlidesTemplateDomainService extends SlidesTemplateDomainService
{
    public function __construct(
        CapturingSlidesTemplateRepository $repository,
        SlidesTemplateTagDomainService $tagService,
    ) {
        parent::__construct(
            $repository,
            new DefaultSlidesTemplateUsageCountPolicy($repository),
            $tagService
        );
    }

    protected function transaction(callable $callback): mixed
    {
        throw new RuntimeException('transaction failed');
    }
}
