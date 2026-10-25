<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Skill;

use App\Application\SuperMagic\Skill\Service\SkillAppService;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\UserSkillRepositoryInterface;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryRelationDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use App\ErrorCode\SkillErrorCode;
use App\Infrastructure\Core\DataIsolation\OrganizationInfoManagerInterface;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Config\Config;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use ReflectionProperty;

/** @internal */
class SkillPreparedPublishTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    protected function setUp(): void
    {
        if (ApplicationContext::hasContainer()) {
            $this->previousContainer = ApplicationContext::getContainer();
        }
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(static fn ($id) => $id);
        $config = new Config(['error_message' => ['error_code_mapper' => [SkillErrorCode::class => [51239, 51338]]]]);
        $container = $this->createMock(ContainerInterface::class);
        $container->method('get')->willReturnCallback(static fn ($id) => match ($id) {
            ConfigInterface::class => $config,
            TranslatorInterface::class => $translator,
            default => null,
        });
        ApplicationContext::setContainer($container);
    }

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        }
    }

    public function testLostResponseReturnsExistingReleaseWithoutPublishingAgain(): void
    {
        $record = $this->record();
        $version = new SkillVersionEntity([
            'id' => 123, 'code' => 'skill-code', 'organization_code' => 'org', 'creator_id' => 'user',
            'publisher_user_id' => 'user', 'project_id' => 456, 'version' => '1.0.0', 'file_key' => 'snapshot.zip',
            'publish_status' => 'PUBLISHED', 'review_status' => 'APPROVED', 'publish_target_type' => 'PRIVATE',
        ]);
        $service = $this->service($record, [$version]);
        $result = $service->publishSkillPreparation($this->context(), 'skill-code', 'token');
        self::assertSame('published', $result['status']);
        self::assertSame('123', $result['version_id']);
        self::assertSame('456', $result['project_id']);
    }

    public function testVersionWithAnotherPackageCannotBeAdoptedAsSuccessfulRetry(): void
    {
        $version = new SkillVersionEntity([
            'id' => 123, 'code' => 'skill-code', 'version' => '1.0.0', 'file_key' => 'other.zip', 'publisher_user_id' => 'user',
        ]);
        $service = $this->service($this->record(), [$version]);
        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SkillErrorCode::VERSION_ALREADY_EXISTS->value);
        $service->publishSkillPreparation($this->context(), 'skill-code', 'token');
    }

    public function testPreparationIsBoundToUserOrganizationAndSkill(): void
    {
        foreach (['user_id', 'organization_code', 'skill_code'] as $field) {
            $record = $this->record();
            $record[$field] = 'someone-else';
            $service = $this->service($record);
            try {
                $service->getPreparedSkillPublishResult($this->context(), 'skill-code', 'token');
                self::fail('A preparation from another identity was accepted');
            } catch (BusinessException $error) {
                self::assertSame(SkillErrorCode::PUBLISH_PREPARATION_STALE->value, $error->getCode());
            }
        }
    }

    public function testReadyExportHasNotSubmittedARelease(): void
    {
        $result = $this->service($this->record())->getPreparedSkillPublishResult($this->context(), 'skill-code', 'token');
        self::assertSame('not_submitted', $result['status']);
        self::assertFalse($result['submitted']);
    }

    public function testExpiredPreparationIsRejected(): void
    {
        $record = $this->record();
        $record['expires_at'] = time() - 1;
        $this->expectExceptionCode(SkillErrorCode::PUBLISH_PREPARATION_STALE->value);
        $this->service($record)->getPreparedSkillPublishResult($this->context(), 'skill-code', 'token');
    }

    public function testPrivatePublishesAndOrganizationAndMarketAwaitReview(): void
    {
        foreach (['PRIVATE', 'ORGANIZATION', 'MARKET'] as $target) {
            $isolation = $this->getMockBuilder(SkillDataIsolation::class)->disableOriginalConstructor()->getMock();
            $isolation->method('getCurrentUserId')->willReturn('user');
            $organization = $this->createMock(OrganizationInfoManagerInterface::class);
            $organization->method('getOrganizationType')->willReturn(OrganizationType::Team);
            $isolation->method('getOrganizationInfoManager')->willReturn($organization);
            $skills = $this->createMock(SkillRepositoryInterface::class);
            $skills->expects(self::once())->method('lockByCode')->with($isolation, 'skill-code');
            $versions = $this->createMock(SkillVersionRepositoryInterface::class);
            $versions->method('findLatestByCode')->willReturn(null);
            $versions->method('save')->willReturnCallback(static function ($scope, $version) {
                $version->setId(123);
                return $version;
            });
            $domain = new SkillVersionDomainService(
                $skills,
                $versions,
                $this->createMock(UserSkillRepositoryInterface::class),
                $this->createMock(SkillMarketDomainService::class),
                $this->createMock(SkillCategoryRelationDomainService::class),
            );
            $skill = new SkillEntity([
                'code' => 'skill-code', 'organization_code' => 'org', 'creator_id' => 'user',
                'source_type' => 'DIALOGUE_CREATION', 'project_id' => 456, 'file_key' => 'immutable.zip',
                'package_name' => 'demo', 'package_description' => 'A reusable procedure',
                'name_i18n' => ['default' => 'Demo'], 'description_i18n' => ['default' => 'Description'],
            ]);
            $version = new SkillVersionEntity(['version' => '1.0.0', 'publish_target_type' => $target, 'skill_file_key' => 'immutable-SKILL.md']);
            $result = $domain->publishSkill($isolation, $skill, $version, expectedLatestVersionId: '');
            self::assertSame($target === 'PRIVATE' ? 'PUBLISHED' : 'UNPUBLISHED', $result->getPublishStatus()->value);
            self::assertSame($target === 'PRIVATE' ? 'APPROVED' : 'UNDER_REVIEW', $result->getReviewStatus()->value);
            self::assertSame('immutable.zip', $result->getFileKey());
            self::assertSame('immutable-SKILL.md', $result->getSkillFileKey());
            self::assertSame(456, $result->getProjectId());
        }
    }

    public function testConcurrentVersionChangeIsRejectedBeforeWriting(): void
    {
        $isolation = $this->getMockBuilder(SkillDataIsolation::class)->disableOriginalConstructor()->getMock();
        $skills = $this->createMock(SkillRepositoryInterface::class);
        $skills->expects(self::once())->method('lockByCode')->with($isolation, 'skill-code');
        $skills->expects(self::never())->method('save');
        $versions = $this->createMock(SkillVersionRepositoryInterface::class);
        $versions->method('findLatestByCode')->willReturn(new SkillVersionEntity(['id' => 456]));
        $versions->expects(self::never())->method('save');
        $versions->expects(self::never())->method('invalidateAwaitingReviewVersionsByCode');
        $domain = new SkillVersionDomainService(
            $skills,
            $versions,
            $this->createMock(UserSkillRepositoryInterface::class),
            $this->createMock(SkillMarketDomainService::class),
            $this->createMock(SkillCategoryRelationDomainService::class),
        );
        $this->expectExceptionCode(SkillErrorCode::PUBLISH_PREPARATION_STALE->value);
        $domain->publishSkill($isolation, new SkillEntity(['code' => 'skill-code']), new SkillVersionEntity(), expectedLatestVersionId: '123');
    }

    private function record(): array
    {
        return ['skill_code' => 'skill-code', 'user_id' => 'user', 'organization_code' => 'org',
            'expires_at' => time() + 3600, 'status' => 'ready', 'version' => '1.0.0', 'file_key' => 'snapshot.zip'];
    }

    private function service(array $record, array $versions = []): SkillAppService
    {
        $isolation = $this->getMockBuilder(SkillDataIsolation::class)->disableOriginalConstructor()->getMock();
        $isolation->method('getCurrentOrganizationCode')->willReturn('org');
        $isolation->method('getCurrentUserId')->willReturn('user');
        $service = $this->getMockBuilder(SkillAppService::class)->disableOriginalConstructor()
            ->onlyMethods(['createSkillDataIsolation', 'assertSkillEditable', 'acquireImportLock', 'releaseImportLock'])->getMock();
        $service->method('createSkillDataIsolation')->willReturn($isolation);
        $service->expects(self::atLeastOnce())->method('assertSkillEditable')->with($isolation, 'skill-code');
        $service->method('acquireImportLock')->willReturn('owner');
        $redis = $this->getMockBuilder(Redis::class)->disableOriginalConstructor()->addMethods(['get'])->getMock();
        $redis->method('get')->willReturn(json_encode($record));
        (new ReflectionProperty($service, 'redis'))->setValue($service, $redis);
        $domain = $this->createMock(SkillVersionDomainService::class);
        $domain->method('findAllSkillVersionsByCode')->willReturn($versions);
        $domain->expects(self::never())->method('publishSkill');
        (new ReflectionProperty($service, 'skillVersionDomainService'))->setValue($service, $domain);
        return $service;
    }

    private function context(): RequestContext
    {
        $context = new RequestContext();
        $context->setUserAuthorization($this->createMock(MagicUserAuthorization::class));
        return $context;
    }
}
