<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Chat\Service\Mention\Normalizer;

use App\Application\Chat\Service\Mention\Normalizer\MicroAppMentionNormalizer;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppResolver;
use App\Application\SuperMagic\Task\Service\ReferencedProjectAccessKind;
use App\Application\SuperMagic\Task\Service\ReferencedProjectCollaborationAccess;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class MicroAppMentionNormalizerTest extends TestCase
{
    public function testNormalizeDoesNotFillProjectIdForOrgShareWithoutMembership(): void
    {
        $share = (new ResourceShareEntity())
            ->setShareCode('share-org')
            ->setShareType(ShareAccessType::TeamShare->value)
            ->setShareRange('all');

        $normalizer = $this->createNormalizer(
            shareEntity: $share,
            canAccessProject: false,
        );

        $result = $normalizer->normalize(
            ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => 'Org Shared App'],
            $this->createDataIsolation(),
        );

        self::assertSame(
            ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => 'Org Shared App'],
            $result,
        );
    }

    public function testNormalizeUsesPublishedProjectName(): void
    {
        $share = (new ResourceShareEntity())
            ->setShareCode('share-org')
            ->setShareType(ShareAccessType::TeamShare->value)
            ->setShareRange('all');

        $normalizer = $this->createNormalizer(
            shareEntity: $share,
            canAccessProject: true,
            projectName: 'Published Tables',
        );

        $result = $normalizer->normalize(
            ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => ''],
            $this->createDataIsolation(),
        );

        self::assertSame('Published Tables', $result['app_name']);
        self::assertSame('4001', $result['project_id']);
    }

    public function testNormalizeEnrichesPasswordShareForCollaborator(): void
    {
        $share = (new ResourceShareEntity())
            ->setShareCode('share-password')
            ->setShareType(ShareAccessType::PasswordProtected->value);

        $normalizer = $this->createNormalizer(
            shareEntity: $share,
            canAccessProject: true,
        );

        $result = $normalizer->normalize(
            ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => 'Password App'],
            $this->createDataIsolation(),
        );

        self::assertSame('3001', $result['app_id']);
        self::assertSame('4001', $result['project_id']);
        self::assertSame(ReferencedProjectAccessKind::Collaboration->value, $result['access_kind']);
    }

    public function testNormalizeDoesNotEnrichPasswordShareForNonMember(): void
    {
        $share = (new ResourceShareEntity())
            ->setShareCode('share-password')
            ->setShareType(ShareAccessType::PasswordProtected->value);

        $normalizer = $this->createNormalizer(
            shareEntity: $share,
            canAccessProject: false,
        );

        $item = ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => 'Password App'];
        self::assertSame($item, $normalizer->normalize($item, $this->createDataIsolation()));
    }

    public function testNormalizeDoesNotEnrichForNonCollaborator(): void
    {
        $share = (new ResourceShareEntity())
            ->setShareCode('share-org')
            ->setShareType(ShareAccessType::TeamShare->value)
            ->setShareRange('all');

        $normalizer = $this->createNormalizer(
            shareEntity: $share,
            canAccessProject: false,
        );

        $item = ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => 'Hidden App'];
        self::assertSame($item, $normalizer->normalize($item, $this->createDataIsolation()));
    }

    public function testOrganizationPublicationEnrichesWithoutMembership(): void
    {
        $normalizer = $this->createNormalizer(
            shareEntity: (new ResourceShareEntity())->setShareType(ShareAccessType::TeamShare->value),
            canReadPublished: true,
        );
        $result = $normalizer->normalize([
            'type' => 'micro_app', 'app_id' => '3001',
            'project_id' => '9999', 'access_kind' => 'collaboration',
        ], $this->createDataIsolation());
        self::assertSame('4001', $result['project_id']);
        self::assertSame(ReferencedProjectAccessKind::PublishedShare->value, $result['access_kind']);
    }

    public function testDeniedReferenceRemovesForgedAccessFields(): void
    {
        $normalizer = $this->createNormalizer(
            shareEntity: (new ResourceShareEntity())->setShareType(ShareAccessType::Internet->value),
        );
        $result = $normalizer->normalize([
            'type' => 'micro_app', 'app_id' => '3001',
            'project_id' => '9999', 'access_kind' => 'published_share',
        ], $this->createDataIsolation());
        self::assertArrayNotHasKey('project_id', $result);
        self::assertArrayNotHasKey('access_kind', $result);
    }

    public function testNormalizeEnrichesUnpublishedAppForEditor(): void
    {
        $normalizer = $this->createNormalizer(
            shareEntity: (new ResourceShareEntity())->setShareType(ShareAccessType::TeamShare->value),
            projectName: 'Draft App',
            unpublished: true,
            canEdit: true,
        );

        $result = $normalizer->normalize(
            ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => 'Draft App'],
            $this->createDataIsolation(),
        );

        self::assertSame('4001', $result['project_id']);
        self::assertSame(ReferencedProjectAccessKind::Collaboration->value, $result['access_kind']);
    }

    public function testNormalizeRejectsUnpublishedAppForViewer(): void
    {
        $normalizer = $this->createNormalizer(
            shareEntity: (new ResourceShareEntity())->setShareType(ShareAccessType::TeamShare->value),
            unpublished: true,
        );
        $item = ['type' => 'micro_app', 'app_id' => '3001', 'app_name' => 'Draft App'];

        self::assertSame($item, $normalizer->normalize($item, $this->createDataIsolation()));
    }

    private function createDataIsolation(): BaseDataIsolation
    {
        $dataIsolation = $this->createMock(BaseDataIsolation::class);
        $dataIsolation->method('getCurrentUserId')->willReturn('user-1');
        $dataIsolation->method('getCurrentOrganizationCode')->willReturn('org-1');

        return $dataIsolation;
    }

    private function createNormalizer(
        ResourceShareEntity $shareEntity,
        string $projectName = '',
        bool $canAccessProject = false,
        bool $canReadPublished = false,
        bool $unpublished = false,
        bool $canEdit = false,
    ): MicroAppMentionNormalizer {
        $record = (new MicroAppEntity())
            ->setId(3001)
            ->setProjectId(4001)
            ->setResourceId('resource-1')
            ->setPublishStatus($unpublished ? 'unpublished' : 'published');

        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $resolver->method('findPublished')->with(3001)->willReturn($unpublished ? null : [$record, $shareEntity]);
        $resolver->method('getProjectNameFromRecord')->willReturn($projectName);

        $microAppRepository = $this->createMock(MicroAppRepositoryInterface::class);
        $microAppRepository->method('findById')->with(3001)->willReturn($unpublished ? $record : null);

        $collaborationAccess = $this->createMock(ReferencedProjectCollaborationAccess::class);
        $collaborationAccess->method('canAccess')->willReturn($canAccessProject);
        $collaborationAccess->method('canEdit')->willReturn($canEdit);

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($this->createMock(LoggerInterface::class));

        $publishedAccess = $this->createMock(PublishedMicroAppFileAccessService::class);
        $publishedAccess->method('canAccessProject')->willReturn($canReadPublished);

        return new MicroAppMentionNormalizer(
            $loggerFactory,
            $resolver,
            $microAppRepository,
            $collaborationAccess,
            $publishedAccess,
        );
    }
}
