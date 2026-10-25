<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Skill\Service;

use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\ReviewStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\SkillVersionRepositoryInterface;
use App\Domain\SuperMagic\Skill\Repository\Facade\UserSkillRepositoryInterface;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillVersionDomainService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class SkillVersionDomainServiceTest extends TestCase
{
    public function testPlatformRejectionDisablesOrganizationIsolationBeforeSaving(): void
    {
        $version = new SkillVersionEntity([
            'id' => 894757002729398273,
            'code' => 'skill-code',
            'organization_code' => 'source-org',
            'creator_id' => 'creator',
            'publish_status' => PublishStatus::UNPUBLISHED->value,
            'review_status' => ReviewStatus::UNDER_REVIEW->value,
            'publish_target_type' => PublishTargetType::MARKET->value,
            'package_name' => 'package',
            'version' => '1.0.0',
        ]);

        $versionRepository = $this->createMock(SkillVersionRepositoryInterface::class);
        $versionRepository->expects(self::once())
            ->method('findPendingReviewById')
            ->with($version->getId())
            ->willReturn($version);
        $versionRepository->expects(self::once())
            ->method('save')
            ->with(
                self::callback(static fn (SkillDataIsolation $dataIsolation): bool => ! $dataIsolation->isEnable()),
                self::callback(static fn (SkillVersionEntity $savedVersion): bool => $savedVersion->getReviewStatus() === ReviewStatus::REJECTED),
            )
            ->willReturn($version);

        $service = new SkillVersionDomainService(
            $this->createMock(SkillRepositoryInterface::class),
            $versionRepository,
            $this->createMock(UserSkillRepositoryInterface::class),
            $this->createMock(SkillMarketDomainService::class),
        );

        $service->reviewSkillVersion(
            SkillDataIsolation::create('reviewer-org'),
            $version->getId(),
            ReviewStatus::REJECTED->value,
        );

        self::assertSame(ReviewStatus::REJECTED, $version->getReviewStatus());
    }
}
