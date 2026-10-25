<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Task\Service;

use App\Application\Chat\Service\Mention\Normalizer\MicroAppMentionNormalizer;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppResolver;
use App\Application\SuperMagic\Task\Service\ReferencedProjectAccessKind;
use App\Application\SuperMagic\Task\Service\ReferencedProjectCollaborationAccess;
use App\Application\SuperMagic\Task\Service\ReferencedProjectMountPlanner;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * Real UI payload: frontend @micro_app only sends app_id / app_name.
 *
 * @internal
 */
class MicroAppPasswordMentionMountTest extends TestCase
{
    public function testPasswordCollaboratorMentionWithoutProjectIdIsPlannedAsCollaboration(): void
    {
        $mentions = $this->normalizePasswordMention(canAccessProject: true);
        $mounts = (new ReferencedProjectMountPlanner())->plan($mentions, 1001);

        self::assertCount(1, $mounts);
        self::assertSame('4001', $mounts[0]->projectId);
        self::assertSame(ReferencedProjectAccessKind::Collaboration, $mounts[0]->accessKind);
        self::assertSame('3001', $mounts[0]->appId);
    }

    public function testPasswordNonMemberMentionWithoutProjectIdIsNotMounted(): void
    {
        $mentions = $this->normalizePasswordMention(canAccessProject: false);
        $this->expectException(RuntimeException::class);
        $mounts = (new ReferencedProjectMountPlanner())->plan($mentions, 1001);

        self::assertSame([], $mounts);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function normalizePasswordMention(bool $canAccessProject): array
    {
        $share = (new ResourceShareEntity())
            ->setShareCode('share-password')
            ->setShareType(ShareAccessType::PasswordProtected->value);
        $record = (new MicroAppEntity())->setId(3001)->setProjectId(4001)->setPublishStatus('published');

        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $resolver->method('findPublished')->willReturn([$record, $share]);
        $resolver->method('getProjectNameFromRecord')->willReturn('Password App');

        $collaborationAccess = $this->createMock(ReferencedProjectCollaborationAccess::class);
        $collaborationAccess->method('canAccess')->willReturn($canAccessProject);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        $normalizer = new MicroAppMentionNormalizer(
            $loggerFactory,
            $resolver,
            $this->createMock(MicroAppRepositoryInterface::class),
            $collaborationAccess,
            $this->createMock(PublishedMicroAppFileAccessService::class),
        );
        $dataIsolation = $this->createMock(BaseDataIsolation::class);
        $dataIsolation->method('getCurrentUserId')->willReturn('user-1');
        $dataIsolation->method('getCurrentOrganizationCode')->willReturn('org-1');

        return [$normalizer->normalize(
            ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => 'Password App'],
            $dataIsolation,
        )];
    }
}
