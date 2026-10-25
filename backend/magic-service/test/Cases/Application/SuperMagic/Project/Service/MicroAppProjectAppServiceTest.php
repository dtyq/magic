<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\SuperMagic\Project\Service;

use App\Application\SuperMagic\Common\Share\Service\ResourceShareAppService;
use App\Application\SuperMagic\Project\DTO\Request\MicroAppListRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\PublishedMicroAppListRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\PublishMicroAppRequestDTO;
use App\Application\SuperMagic\Project\DTO\Request\UpdateMicroAppRequestDTO;
use App\Application\SuperMagic\Project\Service\MicroAppProjectAppService;
use App\Application\SuperMagic\Project\Service\MicroAppProjectResponseFormatter;
use App\Application\SuperMagic\Project\Service\MicroAppShareConfig;
use App\Application\SuperMagic\Project\Service\ProjectAppService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppFileAccessService;
use App\Application\SuperMagic\Project\Service\PublishedMicroAppResolver;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Repository\Facade\MagicDepartmentUserRepositoryInterface;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Domain\SuperMagic\Common\Share\Constant\ShareAccessType;
use App\Domain\SuperMagic\Common\Share\Entity\ResourceShareEntity;
use App\Domain\SuperMagic\Common\Share\Service\ResourceShareDomainService;
use App\Domain\SuperMagic\File\Repository\Facade\TaskFileRepositoryInterface;
use App\Domain\SuperMagic\Project\Entity\MicroAppEntity;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MemberRole;
use App\Domain\SuperMagic\Project\Entity\ValueObject\MicroAppListScope;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\MicroAppVisitRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Facade\ProjectRepositoryInterface;
use App\Domain\SuperMagic\Project\Repository\Persistence\MicroAppTransferRepository;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Project\Service\ProjectMemberDomainService;
use App\Domain\SuperMagic\Workspace\Repository\Facade\WorkspaceRepositoryInterface;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\SuperMagic\Utils\ShareUrlBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\SuperMagic\Common\Share\DTO\Request\CreateShareRequestDTO;
use App\Interfaces\SuperMagic\Common\Share\DTO\Response\ShareItemDTO;
use Hyperf\Codec\Packer\PhpSerializerPacker;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Contract\ValidatorInterface;
use Hyperf\Database\ConnectionInterface;
use Hyperf\Database\ConnectionResolverInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Qbhy\HyperfAuth\Authenticatable;
use ReflectionProperty;
use RuntimeException;
use Throwable;

/**
 * @internal
 */
class MicroAppProjectAppServiceTest extends TestCase
{
    private ?ContainerInterface $previousContainer = null;

    protected function tearDown(): void
    {
        if ($this->previousContainer !== null) {
            ApplicationContext::setContainer($this->previousContainer);
        } elseif (ApplicationContext::hasContainer()) {
            $containerProperty = new ReflectionProperty(ApplicationContext::class, 'container');
            $containerProperty->setAccessible(true);
            $containerProperty->setValue(null, null);
        }

        parent::tearDown();
    }

    public function testPublishPassesPureModeToTheCommonShareRecord(): void
    {
        $appId = 1001;
        $projectId = 2001;
        $authorization = (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode('org-1');
        $requestContext = $this->createMock(RequestContext::class);
        $requestContext->method('getUserAuthorization')->willReturn($authorization);

        $record = (new MicroAppEntity())
            ->setId($appId)
            ->setProjectId($projectId)
            ->setResourceId('resource-1')
            ->setOrganizationCode('org-1');
        $project = (new ProjectEntity())
            ->setId($projectId)
            ->setUserId('user-1')
            ->setUserOrganizationCode('org-1')
            ->setProjectName('Demo App')
            ->setProjectMode(ProjectMode::MICRO_APP->value);

        $this->setDatabaseContainer();

        $microAppRepository = $this->createMock(MicroAppRepositoryInterface::class);
        $microAppRepository->method('findById')->with($appId)->willReturn($record);
        $microAppRepository->expects(self::once())
            ->method('save')
            ->with($record)
            ->willReturn($record);
        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->method('findById')->with($projectId)->willReturn($project);

        $shareDomainService = $this->createMock(ResourceShareDomainService::class);
        $shareDomainService->expects(self::once())
            ->method('getShareByResourceIdWithTrashed')
            ->with('resource-1')
            ->willReturn((new ResourceShareEntity())->setExtra([
                'allow_copy_project_files' => true,
                '_authorization_version' => 'internal-version',
            ]));
        $shareItem = ShareItemDTO::fromArray([
            'id' => 'share-1',
            'share_code' => 'share-code-1',
            'extra' => ['allow_copy_project_files' => true, 'pure_mode' => true],
        ]);
        $resourceShareAppService = $this->createMock(ResourceShareAppService::class);
        $resourceShareAppService->expects(self::once())
            ->method('createShare')
            ->with(
                self::callback(static fn ($auth) => $auth->getId() === 'user-1' && $auth->getOrganizationCode() === 'org-1'),
                self::callback(static function (CreateShareRequestDTO $dto): bool {
                    self::assertTrue($dto->hasField('extra'));
                    self::assertSame([
                        'allow_copy_project_files' => true,
                        'pure_mode' => true,
                    ], $dto->getExtra());
                    return true;
                }),
            )
            ->willReturn($shareItem);

        $shareUrlBuilder = $this->createMock(ShareUrlBuilder::class);
        $shareUrlBuilder->method('buildMicroAppShareUrl')
            ->with((string) $appId)
            ->willReturn('https://example.com/micro-app/1001');
        $responseFormatter = $this->createMock(MicroAppProjectResponseFormatter::class);
        $responseFormatter->expects(self::once())
            ->method('formatPublishRecord')
            ->with($record, 'Demo App', $shareItem->extra)
            ->willReturn(['extra' => ['pure_mode' => true]]);

        $locks = $this->createMock(MicroAppTransferRepository::class);
        $locks->method('lockProject')->with($projectId)->willReturn($project);
        $locks->method('lockAppByProject')->with($projectId, 'org-1')->willReturn($record);
        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $resourceShareAppService,
            $shareDomainService,
            $shareUrlBuilder,
            $responseFormatter,
            mutationLocks: $locks,
        );
        $requestDTO = new PublishMicroAppRequestDTO([
            'app_name' => 'Demo App',
            'share_type' => ShareAccessType::Internet->value,
            'extra' => ['pure_mode' => true],
        ]);

        self::assertSame(
            ['extra' => ['pure_mode' => true]],
            $service->publish($requestContext, $appId, $requestDTO),
        );
    }

    /** @dataProvider mutationMethods */
    public function testMutationsRecheckPermissionAfterConcurrentTransfer(string $method): void
    {
        $this->setDatabaseContainer(false);
        $authorization = (new MagicUserAuthorization())->setId('old-owner')->setOrganizationCode('org-1');
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn($authorization);
        $oldProject = (new ProjectEntity())->setId(2001)->setUserId('old-owner')->setUserOrganizationCode('org-1')
            ->setProjectMode(ProjectMode::MICRO_APP->value);
        $newProject = clone $oldProject;
        $newProject->setUserId('new-owner');
        $record = (new MicroAppEntity())->setId(1001)->setProjectId(2001)->setOrganizationCode('org-1');
        $apps = $this->createMock(MicroAppRepositoryInterface::class);
        $apps->method('findById')->willReturn($record);
        $apps->expects(self::never())->method('save');
        $projects = $this->createMock(ProjectRepositoryInterface::class);
        $projects->method('findById')->willReturn($oldProject);
        $locks = $this->createMock(MicroAppTransferRepository::class);
        $locks->expects(self::once())->method('lockProject')->with(2001)->willReturn($newProject);
        $locks->expects(self::once())->method('lockAppByProject')->with(2001, 'org-1')->willReturn($record);
        $shares = $this->createMock(ResourceShareAppService::class);
        $shares->expects(self::never())->method('createShare');
        $shares->expects(self::never())->method('cancelShareByResourceId');
        $service = $this->createService(
            $apps,
            $projects,
            $shares,
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $this->createMock(MicroAppProjectResponseFormatter::class),
            denyCollaboration: true,
            mutationLocks: $locks
        );
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('project access denied');
        match ($method) {
            'publish' => $service->publish($context, 1001, new PublishMicroAppRequestDTO(['app_name' => 'Changed', 'share_type' => 1])),
            'update' => $service->update($context, 1001, new UpdateMicroAppRequestDTO(['app_name' => 'Changed'])),
            'unpublish' => $service->unpublish($context, 1001),
            'delete' => $service->delete($context, 1001),
        };
    }

    public static function mutationMethods(): array
    {
        return [['publish'], ['update'], ['unpublish'], ['delete']];
    }

    /** @dataProvider publishingRoles */
    public function testPublishingRolesUseStableOwnerAndRealOperator(MemberRole $role, string $method): void
    {
        $allowed = $role->isHigherOrEqualThan(MemberRole::MANAGE);
        $this->setDatabaseContainer($allowed);
        $operator = $role === MemberRole::OWNER ? 'receiver' : 'sender';
        $authorization = (new MagicUserAuthorization())->setId($operator)->setOrganizationCode('org-1');
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn($authorization);
        $project = new ProjectEntity(['id' => 2001, 'project_mode' => ProjectMode::MICRO_APP->value,
            'project_name' => 'App', 'user_id' => 'receiver', 'user_organization_code' => 'org-1']);
        $record = new MicroAppEntity(['id' => 1001, 'project_id' => 2001, 'resource_id' => 'resource-1',
            'organization_code' => 'org-1', 'user_id' => 'receiver', 'creator_id' => 'historical-author', 'publish_status' => 'published']);
        $apps = $this->createMock(MicroAppRepositoryInterface::class);
        $apps->method('findById')->willReturn($record);
        $apps->expects($allowed ? self::once() : self::never())->method('save')->willReturnArgument(0);
        $projects = $this->createMock(ProjectRepositoryInterface::class);
        $projects->method('findById')->willReturn($project);
        $locks = $this->createMock(MicroAppTransferRepository::class);
        $locks->method('lockProject')->willReturn($project);
        $locks->method('lockAppByProject')->willReturn($record);
        $locks->expects($allowed ? self::once() : self::never())->method('recordShareOperator')->with($record, $operator);
        $shares = $this->createMock(ResourceShareAppService::class);
        $ownerAuthorization = self::callback(static fn ($auth) => $auth->getId() === 'receiver' && $auth->getOrganizationCode() === 'org-1');
        if ($method === 'publish') {
            $shares->expects($allowed ? self::once() : self::never())->method('assertMicroAppShareAllowed')->with($authorization, 1);
            $shares->expects($allowed ? self::once() : self::never())->method('createShare')->with($ownerAuthorization, self::anything(), 'micro_app')
                ->willReturn(ShareItemDTO::fromArray(['id' => '100', 'share_code' => 'stable-code']));
        } else {
            $shares->expects($allowed ? self::once() : self::never())->method('cancelShareByResourceId')->with($ownerAuthorization, 'resource-1');
        }
        $formatter = $this->createMock(MicroAppProjectResponseFormatter::class);
        $formatter->method('formatPublishRecord')->willReturn(['app_id' => '1001']);
        $service = $this->createService(
            $apps,
            $projects,
            $shares,
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $formatter,
            mutationLocks: $locks
        );
        $service->testRole = $role;
        if (! $allowed) {
            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('project access denied');
        }
        $response = $method === 'publish'
            ? $service->publish($context, 1001, new PublishMicroAppRequestDTO(['app_name' => 'App', 'share_type' => 1]))
            : $service->unpublish($context, 1001);
        self::assertSame(['app_id' => '1001'], $response);
        self::assertSame('receiver', $record->getUserId());
        self::assertSame('historical-author', $record->getCreatorId());
    }

    public static function publishingRoles(): array
    {
        return [[MemberRole::OWNER, 'publish'], [MemberRole::MANAGE, 'publish'], [MemberRole::EDITOR, 'publish'], [MemberRole::VIEWER, 'publish'],
            [MemberRole::OWNER, 'unpublish'], [MemberRole::MANAGE, 'unpublish'], [MemberRole::EDITOR, 'unpublish'], [MemberRole::VIEWER, 'unpublish']];
    }

    public function testManagerDeniedByPublishMethodPolicyCannotDelegateShareWrite(): void
    {
        $this->setDatabaseContainer(false);
        $authorization = (new MagicUserAuthorization())->setId('manager')->setOrganizationCode('org-1');
        $context = $this->createMock(RequestContext::class);
        $context->method('getUserAuthorization')->willReturn($authorization);
        $project = new ProjectEntity(['id' => 2001, 'user_id' => 'receiver', 'user_organization_code' => 'org-1',
            'project_mode' => ProjectMode::MICRO_APP->value, 'project_name' => 'App']);
        $record = new MicroAppEntity(['id' => 1001, 'project_id' => 2001, 'organization_code' => 'org-1']);
        $apps = $this->createMock(MicroAppRepositoryInterface::class);
        $apps->method('findById')->willReturn($record);
        $apps->expects(self::never())->method('save');
        $projects = $this->createMock(ProjectRepositoryInterface::class);
        $projects->method('findById')->willReturn($project);
        $locks = $this->createMock(MicroAppTransferRepository::class);
        $locks->method('lockProject')->willReturn($project);
        $locks->method('lockAppByProject')->willReturn($record);
        $shares = $this->createMock(ResourceShareAppService::class);
        $shares->expects(self::once())->method('assertMicroAppShareAllowed')->with($authorization, 1)
            ->willThrowException(new RuntimeException('share method disabled'));
        $shares->expects(self::never())->method('createShare');
        $service = $this->createService(
            $apps,
            $projects,
            $shares,
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $this->createMock(MicroAppProjectResponseFormatter::class),
            mutationLocks: $locks
        );
        $service->testRole = MemberRole::MANAGE;
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('share method disabled');
        $service->publish($context, 1001, new PublishMicroAppRequestDTO(['app_name' => 'App', 'share_type' => 1]));
    }

    public function testResolvePublishedReturnsDisplayConfigFromShareRecord(): void
    {
        $record = (new MicroAppEntity())
            ->setId(1001)
            ->setResourceId('resource-1');
        $shareEntity = (new ResourceShareEntity())
            ->setShareCode('share-code-1')
            ->setExtra(['pure_mode' => true]);
        $publishedResolver = $this->createMock(PublishedMicroAppResolver::class);
        $publishedResolver->expects(self::once())
            ->method('findPublished')
            ->with(1001)
            ->willReturn([$record, $shareEntity]);
        $responseFormatter = $this->createMock(MicroAppProjectResponseFormatter::class);
        $responseFormatter->expects(self::once())
            ->method('formatPublishedResolution')
            ->with($record, $shareEntity)
            ->willReturn(['extra' => ['pure_mode' => true]]);

        $service = $this->createService(
            $this->createMock(MicroAppRepositoryInterface::class),
            $this->createMock(ProjectRepositoryInterface::class),
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            $publishedResolver,
        );

        self::assertSame(
            ['extra' => ['pure_mode' => true]],
            $service->resolvePublished(1001),
        );
    }

    public function testShowByProjectReturnsCurrentUserRole(): void
    {
        $authorization = (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode('org-1');
        $requestContext = $this->createMock(RequestContext::class);
        $requestContext->method('getUserAuthorization')->willReturn($authorization);

        $project = (new ProjectEntity())
            ->setId(2001)
            ->setUserId('user-1')
            ->setCreatedUid('user-1')
            ->setUserOrganizationCode('org-1')
            ->setProjectMode(ProjectMode::MICRO_APP->value);
        $record = (new MicroAppEntity())
            ->setId(1001)
            ->setProjectId(2001);

        $microAppRepository = $this->createMock(MicroAppRepositoryInterface::class);
        $microAppRepository->expects(self::once())
            ->method('ensureByProjectId')
            ->with(2001, 'org-1', 'user-1', 'user-1')
            ->willReturn($record);
        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->expects(self::once())->method('findById')->with(2001)->willReturn($project);
        $responseFormatter = $this->createMock(MicroAppProjectResponseFormatter::class);
        $responseFormatter->expects(self::once())
            ->method('formatMicroApp')
            ->with($record, $project)
            ->willReturn(['project' => ['id' => 2001]]);

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
        );

        self::assertSame(
            ['project' => ['id' => 2001, 'user_role' => 'owner']],
            $service->showByProject($requestContext, 2001),
        );
    }

    public function testShowAllowsShareVisibleNonMember(): void
    {
        [$requestContext, $microAppRepository, $projectRepository, $responseFormatter] = $this->createShowFixtures();
        $publishedResolver = $this->createMock(PublishedMicroAppResolver::class);
        $publishedResolver->expects(self::once())
            ->method('canAccessPublishedShare')
            ->with(1001, 'user-1', 'org-1')
            ->willReturn(true);
        $responseFormatter->expects(self::once())
            ->method('formatMicroApp')
            ->willReturn(['project_id' => 2001, 'project' => ['id' => 2001]]);

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            $publishedResolver,
            denyCollaboration: true,
        );

        self::assertSame(
            ['project_id' => 2001, 'project' => ['id' => 2001, 'user_role' => 'owner']],
            $service->show($requestContext, 1001),
        );
    }

    public function testShowUsesCollaborationWithoutShareCheck(): void
    {
        [$requestContext, $microAppRepository, $projectRepository, $responseFormatter] = $this->createShowFixtures();
        $publishedResolver = $this->createMock(PublishedMicroAppResolver::class);
        $publishedResolver->expects(self::never())->method('canAccessPublishedShare');
        $responseFormatter->expects(self::once())
            ->method('formatMicroApp')
            ->willReturn(['project_id' => 2001, 'project' => ['id' => 2001]]);

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            $publishedResolver,
        );

        self::assertSame(
            ['project_id' => 2001, 'project' => ['id' => 2001, 'user_role' => 'owner']],
            $service->show($requestContext, 1001),
        );
    }

    public function testShowDeniesWhenNeitherCollaboratorNorShareVisible(): void
    {
        $this->setErrorMessageContainer();
        [$requestContext, $microAppRepository, $projectRepository, $responseFormatter] = $this->createShowFixtures();
        $publishedResolver = $this->createMock(PublishedMicroAppResolver::class);
        $publishedResolver->expects(self::once())
            ->method('canAccessPublishedShare')
            ->with(1001, 'user-1', 'org-1')
            ->willReturn(false);

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            $publishedResolver,
            denyCollaboration: true,
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionCode(SuperAgentErrorCode::PROJECT_ACCESS_DENIED->value);
        $service->show($requestContext, 1001);
    }

    public function testRuntimeProjectAllowsSameOrganizationPublicNonMember(): void
    {
        [$requestContext, $microAppRepository, $projectRepository, $responseFormatter] = $this->createShowFixtures();
        $share = (new ResourceShareEntity())
            ->setShareType(ShareAccessType::Internet->value)
            ->setOrganizationCode('org-1');
        $record = (new MicroAppEntity())->setId(1001)->setProjectId(2001)->setOrganizationCode('org-1');
        $publishedResolver = $this->createMock(PublishedMicroAppResolver::class);
        $publishedResolver->method('findPublished')->with(1001)->willReturn([$record, $share]);
        $publishedAccess = $this->createMock(PublishedMicroAppFileAccessService::class);
        $publishedAccess->expects(self::once())->method('canAccessProject')->with(2001, 'user-1', 'org-1')->willReturn(true);

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            $publishedResolver,
            denyCollaboration: true,
            publishedFileAccess: $publishedAccess,
        );

        self::assertSame(['exists' => false, 'project' => null], $service->getRuntimeProject($requestContext, 1001));
    }

    public function testRuntimeProjectResponsesIncludeCurrentUserRole(): void
    {
        [$requestContext, $microAppRepository, $projectRepository, $responseFormatter] = $this->createShowFixtures();
        $runtimeProject = (new ProjectEntity())
            ->setId(2001)
            ->setUserId('user-1')
            ->setUserOrganizationCode('org-1');
        $projectAppService = $this->createMock(ProjectAppService::class);
        $projectAppService->expects(self::once())
            ->method('findSpecialProject')
            ->with($requestContext, 'micro-app-runtime_1001')
            ->willReturn($runtimeProject);
        $projectAppService->expects(self::once())
            ->method('ensureMicroAppRuntimeProject')
            ->with($requestContext, 'micro-app-runtime_1001')
            ->willReturn(['project' => ['id' => 2001], 'is_existing' => true]);
        $responseFormatter->expects(self::exactly(2))
            ->method('formatProject')
            ->willReturn(['id' => '2001']);

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            projectAppService: $projectAppService,
        );

        self::assertSame(
            ['exists' => true, 'project' => ['id' => '2001', 'user_role' => 'owner']],
            $service->getRuntimeProject($requestContext, 1001),
        );
        self::assertSame(
            ['project' => ['id' => '2001', 'user_role' => 'owner'], 'is_existing' => true],
            $service->ensureRuntimeProject($requestContext, 1001),
        );
    }

    public function testRuntimeProjectExplainsPasswordShareForNonMember(): void
    {
        $this->setErrorMessageContainer();
        [$requestContext, $microAppRepository, $projectRepository, $responseFormatter] = $this->createShowFixtures();
        $share = (new ResourceShareEntity())->setShareType(ShareAccessType::PasswordProtected->value);
        $record = (new MicroAppEntity())->setId(1001)->setProjectId(2001);
        $publishedResolver = $this->createMock(PublishedMicroAppResolver::class);
        $publishedResolver->method('findPublished')->with(1001)->willReturn([$record, $share]);
        $publishedAccess = $this->createMock(PublishedMicroAppFileAccessService::class);
        $publishedAccess->expects(self::never())->method('canAccessProject');

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            $publishedResolver,
            denyCollaboration: true,
            publishedFileAccess: $publishedAccess,
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('micro_app.password_conversation_unsupported');
        $service->getRuntimeProject($requestContext, 1001);
    }

    public function testRuntimeProjectKeepsPasswordShareAvailableToCollaborator(): void
    {
        [$requestContext, $microAppRepository, $projectRepository, $responseFormatter] = $this->createShowFixtures();
        $publishedResolver = $this->createMock(PublishedMicroAppResolver::class);
        $publishedResolver->expects(self::never())->method('findPublished');
        $publishedAccess = $this->createMock(PublishedMicroAppFileAccessService::class);
        $publishedAccess->expects(self::never())->method('canAccessProject');

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            $publishedResolver,
            publishedFileAccess: $publishedAccess,
        );

        self::assertSame(['exists' => false, 'project' => null], $service->getRuntimeProject($requestContext, 1001));
    }

    public function testRuntimeProjectRejectsCrossOrganizationBeforeCollaborationAccess(): void
    {
        $this->setErrorMessageContainer();
        [$requestContext, $microAppRepository, $projectRepository, $responseFormatter] = $this->createShowFixtures('other-org');
        $publishedResolver = $this->createMock(PublishedMicroAppResolver::class);
        $publishedResolver->expects(self::never())->method('findPublished');
        $publishedAccess = $this->createMock(PublishedMicroAppFileAccessService::class);
        $publishedAccess->expects(self::never())->method('canAccessProject');

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            $publishedResolver,
            publishedFileAccess: $publishedAccess,
        );

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('micro_app.cross_organization_conversation_unsupported');
        $service->getRuntimeProject($requestContext, 1001);
    }

    public function testListReturnsProjectIdAndEffectiveUserRole(): void
    {
        $authorization = (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode('org-1');
        $requestContext = $this->createMock(RequestContext::class);
        $requestContext->method('getUserAuthorization')->willReturn($authorization);

        $rows = [
            [
                'app_id' => 1001,
                'project_id' => 2001,
                'app_name' => 'Owned App',
                'app_description' => 'Owned description',
                'creator_id' => 'user-1',
                'cover_file_key' => null,
                'publish_status' => 'published',
                'updated_at' => '2026-08-28 10:00:00',
                'project_owner_id' => 'user-1',
                'organization_code' => 'org-1',
            ],
            [
                'app_id' => 1002,
                'project_id' => 2002,
                'app_name' => 'Managed App',
                'app_description' => 'Managed description',
                'creator_id' => 'user-2',
                'cover_file_key' => null,
                'publish_status' => 'unpublished',
                'updated_at' => null,
                'project_owner_id' => 'user-2',
                'organization_code' => 'org-1',
            ],
        ];

        $microAppRepository = $this->createMock(MicroAppRepositoryInterface::class);
        $microAppRepository->expects(self::once())
            ->method('paginateAccessible')
            ->with(
                'user-1',
                ['dept-1'],
                ['org-1'],
                MicroAppListScope::All,
                '',
                1,
                20,
            )
            ->willReturn(['total' => 2, 'list' => $rows]);

        $projectMemberDomainService = $this->createMock(ProjectMemberDomainService::class);
        $projectMemberDomainService->expects(self::once())
            ->method('getProjectIdsByCollaboratorTargets')
            ->with(['user-1', 'dept-1'])
            ->willReturn([]);
        $projectMemberDomainService->expects(self::once())
            ->method('getUserHighestRolesInProjects')
            ->with([2001, 2002], ['user-1', 'dept-1'])
            ->willReturn([2002 => 'manage']);

        $departmentRepository = $this->createMock(MagicDepartmentUserRepositoryInterface::class);
        $departmentRepository->expects(self::once())
            ->method('getDepartmentIdsByUserIds')
            ->willReturn(['user-1' => ['dept-1']]);

        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $projectDomainService->expects(self::once())
            ->method('getOrganizationCodesByProjectIds')
            ->with([])
            ->willReturn([]);
        $packageFilterService = $this->createMock(PackageFilterInterface::class);
        $packageFilterService->expects(self::once())
            ->method('filterPaidOrganizations')
            ->with([])
            ->willReturn([]);

        $responseFormatter = $this->createMock(MicroAppProjectResponseFormatter::class);
        $responseFormatter->expects(self::once())
            ->method('resolveCoverUrls')
            ->with($rows)
            ->willReturn([]);
        $responseFormatter->method('coverUrlMapKey')
            ->willReturnCallback(
                static fn (array $row, string $coverKey): string => (string) ($row['organization_code'] ?? '') . ':' . $coverKey
            );

        $service = $this->createService(
            $microAppRepository,
            $this->createMock(ProjectRepositoryInterface::class),
            $this->createMock(ResourceShareAppService::class),
            $this->createMock(ResourceShareDomainService::class),
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            projectMemberDomainService: $projectMemberDomainService,
            departmentUserDomainService: new MagicDepartmentUserDomainService($departmentRepository),
            projectDomainService: $projectDomainService,
            packageFilterService: $packageFilterService,
        );

        self::assertSame(
            [
                'list' => [
                    [
                        'app_id' => '1001',
                        'project_id' => '2001',
                        'app_name' => 'Owned App',
                        'app_description' => 'Owned description',
                        'creator_id' => 'user-1',
                        'cover_url' => '',
                        'publish_status' => 'published',
                        'updated_at' => '2026-08-28 10:00:00',
                        'user_role' => 'owner',
                        'can_delete' => true,
                    ],
                    [
                        'app_id' => '1002',
                        'project_id' => '2002',
                        'app_name' => 'Managed App',
                        'app_description' => 'Managed description',
                        'creator_id' => 'user-2',
                        'cover_url' => '',
                        'publish_status' => 'unpublished',
                        'updated_at' => null,
                        'user_role' => 'manage',
                        'can_delete' => false,
                    ],
                ],
                'total' => 2,
                'page' => 1,
                'page_size' => 20,
            ],
            $service->list($requestContext, new MicroAppListRequestDTO()),
        );
    }

    public function testListAccessibleReturnsOrgShareAppsAndSkipsPasswordProtected(): void
    {
        $authorization = (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode('org-1');
        $requestContext = $this->createMock(RequestContext::class);
        $requestContext->method('getUserAuthorization')->willReturn($authorization);

        $accessibleRecord = (new MicroAppEntity())
            ->setId(3001)
            ->setProjectId(4001)
            ->setResourceId('resource-accessible')
            ->setCreatorId('user-2')
            ->setCoverFileKey('cover-accessible')
            ->setPublishStatus('published');
        $passwordRecord = (new MicroAppEntity())
            ->setId(3002)
            ->setProjectId(4002)
            ->setResourceId('resource-password')
            ->setCreatorId('user-3')
            ->setPublishStatus('published');
        $deniedRecord = (new MicroAppEntity())
            ->setId(3003)
            ->setProjectId(4003)
            ->setResourceId('resource-denied')
            ->setCreatorId('user-4')
            ->setPublishStatus('published');
        $expiredRecord = (new MicroAppEntity())
            ->setId(3004)
            ->setProjectId(4004)
            ->setResourceId('resource-expired')
            ->setCreatorId('user-5')
            ->setPublishStatus('published');

        $accessibleProject = (new ProjectEntity())
            ->setId(4001)
            ->setUserId('user-2')
            ->setUserOrganizationCode('org-1')
            ->setProjectName('Org Shared App')
            ->setProjectDescription('Shared with the org')
            ->setProjectMode(ProjectMode::MICRO_APP->value)
            ->setUpdatedAt('2026-09-11 08:00:00');
        $passwordProject = (new ProjectEntity())
            ->setId(4002)
            ->setUserId('user-3')
            ->setUserOrganizationCode('org-1')
            ->setProjectName('Password App')
            ->setProjectMode(ProjectMode::MICRO_APP->value);
        $deniedProject = (new ProjectEntity())
            ->setId(4003)
            ->setUserId('user-4')
            ->setUserOrganizationCode('org-1')
            ->setProjectName('Private App')
            ->setProjectMode(ProjectMode::MICRO_APP->value);
        $expiredProject = (new ProjectEntity())
            ->setId(4004)
            ->setUserId('user-5')
            ->setUserOrganizationCode('org-1')
            ->setProjectName('Expired App')
            ->setProjectMode(ProjectMode::MICRO_APP->value);

        $microAppRepository = $this->createMock(MicroAppRepositoryInterface::class);
        $microAppRepository->expects(self::never())->method('paginateAccessible');
        $microAppRepository->expects(self::once())
            ->method('findPublishedByOrganization')
            ->with('org-1')
            ->willReturn([$accessibleRecord, $passwordRecord, $deniedRecord, $expiredRecord]);

        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->expects(self::once())
            ->method('findByIds')
            ->with([4001, 4002, 4003, 4004])
            ->willReturn([$accessibleProject, $passwordProject, $deniedProject, $expiredProject]);

        $accessibleShare = (new ResourceShareEntity())
            ->setResourceId('resource-accessible')
            ->setShareCode('share-accessible')
            ->setShareType(ShareAccessType::TeamShare->value);
        $passwordShare = (new ResourceShareEntity())
            ->setResourceId('resource-password')
            ->setShareCode('share-password')
            ->setShareType(ShareAccessType::PasswordProtected->value);
        $deniedShare = (new ResourceShareEntity())
            ->setResourceId('resource-denied')
            ->setShareCode('share-denied')
            ->setShareType(ShareAccessType::TeamShare->value);
        $expiredShare = (new ResourceShareEntity())
            ->setResourceId('resource-expired')
            ->setShareCode('share-expired')
            ->setShareType(ShareAccessType::TeamShare->value)
            ->setExpireAt('2020-01-01 00:00:00');
        $expiredLaterValidShare = (new ResourceShareEntity())
            ->setResourceId('resource-expired')
            ->setShareCode('share-expired-later')
            ->setShareType(ShareAccessType::TeamShare->value);

        $shareDomainService = $this->createMock(ResourceShareDomainService::class);
        $shareDomainService->expects(self::once())
            ->method('getSharesByResourceIds')
            ->with(['resource-accessible', 'resource-password', 'resource-denied', 'resource-expired'])
            ->willReturn([$accessibleShare, $passwordShare, $deniedShare, $expiredShare, $expiredLaterValidShare]);
        $shareDomainService->method('validateShareAccess')
            ->willReturnCallback(function (ResourceShareEntity $shareEntity): void {
                if ($shareEntity->getShareCode() === 'share-denied') {
                    throw new RuntimeException('permission denied');
                }
            });

        $projectMemberDomainService = $this->createMock(ProjectMemberDomainService::class);
        $projectMemberDomainService->expects(self::never())->method('getProjectIdsByCollaboratorTargets');
        $projectMemberDomainService->expects(self::once())
            ->method('getUserHighestRolesInProjects')
            ->with([4001], ['user-1', 'dept-1'])
            ->willReturn([]);

        $departmentRepository = $this->createMock(MagicDepartmentUserRepositoryInterface::class);
        $departmentRepository->expects(self::once())
            ->method('getDepartmentIdsByUserIds')
            ->willReturn(['user-1' => ['dept-1']]);

        $accessibleRow = [
            'app_id' => 3001,
            'project_id' => 4001,
            'app_name' => 'Org Shared App',
            'app_description' => 'Shared with the org',
            'creator_id' => 'user-2',
            'cover_file_key' => 'cover-accessible',
            'publish_status' => 'published',
            'updated_at' => '2026-09-11 08:00:00',
            'project_owner_id' => 'user-2',
            'organization_code' => 'org-1',
        ];
        $responseFormatter = $this->createMock(MicroAppProjectResponseFormatter::class);
        $responseFormatter->expects(self::once())
            ->method('resolveCoverUrls')
            ->with([$accessibleRow])
            ->willReturn(['org-1:cover-accessible' => 'https://cdn.example.com/cover.png']);
        $responseFormatter->method('coverUrlMapKey')
            ->willReturnCallback(
                static fn (array $row, string $coverKey): string => (string) ($row['organization_code'] ?? '') . ':' . $coverKey
            );

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $shareDomainService,
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            projectMemberDomainService: $projectMemberDomainService,
            departmentUserDomainService: new MagicDepartmentUserDomainService($departmentRepository),
        );

        $requestDTO = new MicroAppListRequestDTO();
        $requestDTO->setScope(MicroAppListScope::Accessible->value);

        self::assertSame(
            [
                'list' => [
                    [
                        'app_id' => '3001',
                        'project_id' => '4001',
                        'app_name' => 'Org Shared App',
                        'app_description' => 'Shared with the org',
                        'creator_id' => 'user-2',
                        'cover_url' => 'https://cdn.example.com/cover.png',
                        'publish_status' => 'published',
                        'updated_at' => '2026-09-11 08:00:00',
                        'user_role' => null,
                        'can_delete' => false,
                    ],
                ],
                'total' => 1,
                'page' => 1,
                'page_size' => 20,
            ],
            $service->list($requestContext, $requestDTO),
        );
    }

    public function testMentionListIncludesAccessibleUnpublishedApps(): void
    {
        $authorization = (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode('org-1');
        $requestContext = $this->createMock(RequestContext::class);
        $requestContext->method('getUserAuthorization')->willReturn($authorization);

        $ownedRows = [
            [
                'app_id' => 1001,
                'project_id' => 2001,
                'app_name' => 'Owned App',
                'app_description' => 'Owned description',
                'creator_id' => 'user-1',
                'cover_file_key' => null,
                'publish_status' => 'published',
                'updated_at' => '2026-08-28 10:00:00',
                'project_owner_id' => 'user-1',
                'organization_code' => 'org-1',
            ],
            [
                'app_id' => 1002,
                'project_id' => 2002,
                'app_name' => 'Draft App',
                'app_description' => 'Unpublished',
                'creator_id' => 'user-1',
                'cover_file_key' => null,
                'publish_status' => 'unpublished',
                'updated_at' => '2026-08-29 10:00:00',
                'project_owner_id' => 'user-1',
                'organization_code' => 'org-1',
            ],
            [
                'app_id' => 1003,
                'project_id' => 2003,
                'app_name' => 'Collaborated App',
                'app_description' => 'Collaborated description',
                'creator_id' => 'user-2',
                'cover_file_key' => null,
                'publish_status' => 'published',
                'updated_at' => '2026-08-27 10:00:00',
                'project_owner_id' => 'user-2',
                'organization_code' => 'org-1',
            ],
            [
                'app_id' => 1004,
                'project_id' => 2004,
                'app_name' => 'Editor Draft App',
                'app_description' => 'Editor draft',
                'creator_id' => 'user-2',
                'cover_file_key' => null,
                'publish_status' => 'unpublished',
                'updated_at' => '2026-08-30 10:00:00',
                'project_owner_id' => 'user-2',
                'organization_code' => 'org-1',
                'test_role' => 'editor',
            ],
            [
                'app_id' => 1005,
                'project_id' => 2005,
                'app_name' => 'Viewer Draft App',
                'app_description' => 'Viewer draft',
                'creator_id' => 'user-3',
                'cover_file_key' => null,
                'publish_status' => 'unpublished',
                'updated_at' => '2026-08-31 10:00:00',
                'project_owner_id' => 'user-3',
                'organization_code' => 'org-1',
                'test_role' => 'viewer',
            ],
        ];
        $microAppRepository = $this->createMock(MicroAppRepositoryInterface::class);
        $microAppRepository->expects(self::once())->method('findPublishedByOrganization')->with('org-1')->willReturn([]);
        $microAppRepository->expects(self::once())
            ->method('paginateAccessible')
            ->with(
                'user-1',
                ['dept-1'],
                ['org-1'],
                MicroAppListScope::All,
                '',
                1,
                1000,
                false,
                true,
            )
            ->willReturnCallback(static function (...$args) use ($ownedRows): array {
                self::assertFalse($args[7]);
                self::assertTrue($args[8]);
                $rows = array_values(array_filter(
                    $ownedRows,
                    static fn (array $row): bool => $row['publish_status'] === 'published'
                        || in_array($row['test_role'] ?? 'owner', ['owner', 'manage', 'editor'], true),
                ));
                return ['total' => count($rows), 'list' => $rows];
            });
        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->expects(self::once())->method('findByIds')->with([])->willReturn([]);

        $shareDomainService = $this->createMock(ResourceShareDomainService::class);
        $shareDomainService->expects(self::once())->method('getSharesByResourceIds')->with([])->willReturn([]);

        $projectMemberDomainService = $this->createMock(ProjectMemberDomainService::class);
        $projectMemberDomainService->expects(self::once())
            ->method('getProjectIdsByCollaboratorTargets')
            ->with(['user-1', 'dept-1'])
            ->willReturn([]);
        $projectMemberDomainService->expects(self::once())
            ->method('getUserHighestRolesInProjects')
            ->with([2004, 2002, 2001, 2003], ['user-1', 'dept-1'])
            ->willReturn([2003 => 'viewer', 2004 => 'editor']);

        $departmentRepository = $this->createMock(MagicDepartmentUserRepositoryInterface::class);
        $departmentRepository->expects(self::once())
            ->method('getDepartmentIdsByUserIds')
            ->willReturn(['user-1' => ['dept-1']]);

        $projectDomainService = $this->createMock(ProjectDomainService::class);
        $projectDomainService->expects(self::once())
            ->method('getOrganizationCodesByProjectIds')
            ->with([])
            ->willReturn([]);
        $packageFilterService = $this->createMock(PackageFilterInterface::class);
        $packageFilterService->expects(self::once())
            ->method('filterPaidOrganizations')
            ->with([])
            ->willReturn([]);

        $mergedRows = [$ownedRows[3], $ownedRows[1], $ownedRows[0], $ownedRows[2]];
        $responseFormatter = $this->createMock(MicroAppProjectResponseFormatter::class);
        $responseFormatter->expects(self::once())
            ->method('resolveCoverUrls')
            ->with($mergedRows)
            ->willReturn(['org-1:cover-accessible' => 'https://cdn.example.com/cover.png']);
        $responseFormatter->method('coverUrlMapKey')
            ->willReturnCallback(
                static fn (array $row, string $coverKey): string => (string) ($row['organization_code'] ?? '') . ':' . $coverKey
            );

        $service = $this->createService(
            $microAppRepository,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $shareDomainService,
            $this->createMock(ShareUrlBuilder::class),
            $responseFormatter,
            projectMemberDomainService: $projectMemberDomainService,
            departmentUserDomainService: new MagicDepartmentUserDomainService($departmentRepository),
            projectDomainService: $projectDomainService,
            packageFilterService: $packageFilterService,
        );

        self::assertSame(
            [
                'list' => [
                    [
                        'app_id' => '1004',
                        'project_id' => '2004',
                        'app_name' => 'Editor Draft App',
                        'app_description' => 'Editor draft',
                        'creator_id' => 'user-2',
                        'cover_url' => '',
                        'publish_status' => 'unpublished',
                        'updated_at' => '2026-08-30 10:00:00',
                        'user_role' => 'editor',
                        'can_delete' => false,
                    ],
                    [
                        'app_id' => '1002',
                        'project_id' => '2002',
                        'app_name' => 'Draft App',
                        'app_description' => 'Unpublished',
                        'creator_id' => 'user-1',
                        'cover_url' => '',
                        'publish_status' => 'unpublished',
                        'updated_at' => '2026-08-29 10:00:00',
                        'user_role' => 'owner',
                        'can_delete' => true,
                    ],
                    [
                        'app_id' => '1001',
                        'project_id' => '2001',
                        'app_name' => 'Owned App',
                        'app_description' => 'Owned description',
                        'creator_id' => 'user-1',
                        'cover_url' => '',
                        'publish_status' => 'published',
                        'updated_at' => '2026-08-28 10:00:00',
                        'user_role' => 'owner',
                        'can_delete' => true,
                    ],
                    [
                        'app_id' => '1003',
                        'project_id' => '2003',
                        'app_name' => 'Collaborated App',
                        'app_description' => 'Collaborated description',
                        'creator_id' => 'user-2',
                        'cover_url' => '',
                        'publish_status' => 'published',
                        'updated_at' => '2026-08-27 10:00:00',
                        'user_role' => 'viewer',
                        'can_delete' => false,
                    ],
                ],
                'total' => 4,
                'page' => 1,
                'page_size' => 20,
            ],
            $service->mentionList($requestContext, new PublishedMicroAppListRequestDTO()),
        );
    }

    public function testMentionListAddsOnlyAuthorizedOrganizationPublicationsWithoutRoles(): void
    {
        $authorization = (new MagicUserAuthorization())->setId('user-1')->setOrganizationCode('org-1');
        $request = $this->createMock(RequestContext::class);
        $request->method('getUserAuthorization')->willReturn($authorization);
        $records = $projects = $shares = [];
        foreach ([ShareAccessType::TeamShare, ShareAccessType::Internet, ShareAccessType::PasswordProtected, ShareAccessType::TeamShare] as $index => $type) {
            $id = 3001 + $index;
            $records[] = (new MicroAppEntity())->setId($id)->setProjectId($id)
                ->setOrganizationCode('org-1')->setResourceId('resource-' . $id)
                ->setPublishStatus('published')->setCreatorId('user-2');
            $projects[] = (new ProjectEntity())->setId($id)->setUserId('user-2')
                ->setUserOrganizationCode('org-1')->setProjectMode(ProjectMode::MICRO_APP->value)
                ->setProjectName('App ' . $id)->setUpdatedAt('2026-09-16 10:00:00');
            $shares[] = (new ResourceShareEntity())->setResourceId('resource-' . $id)
                ->setProjectId((string) $id)->setResourceType(12)->setShareProject(true)
                ->setOrganizationCode('org-1')->setIsEnabled(true)->setShareType($type->value)
                ->setShareCode('share-' . $id);
        }
        $apps = $this->createMock(MicroAppRepositoryInterface::class);
        $apps->method('paginateAccessible')->willReturn(['total' => 0, 'list' => []]);
        $apps->method('findPublishedByOrganization')->with('org-1')->willReturn($records);
        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->method('findByIds')->willReturn($projects);
        $shareDomain = $this->createMock(ResourceShareDomainService::class);
        $shareDomain->method('getSharesByResourceIds')->willReturn($shares);
        $resolver = $this->createMock(PublishedMicroAppResolver::class);
        $shareDomain->expects(self::exactly(2))->method('validateShareAccess')
            ->willReturnCallback(static function (ResourceShareEntity $share): void {
                if ($share->getShareCode() !== 'share-3001') {
                    throw new RuntimeException('Share access denied');
                }
            });
        $service = $this->createService(
            $apps,
            $projectRepository,
            $this->createMock(ResourceShareAppService::class),
            $shareDomain,
            $this->createMock(ShareUrlBuilder::class),
            $this->createMock(MicroAppProjectResponseFormatter::class),
            publishedResolver: $resolver,
        );
        $result = $service->mentionList($request, new PublishedMicroAppListRequestDTO());
        self::assertSame(1, $result['total']);
        self::assertSame('3001', $result['list'][0]['app_id']);
        self::assertNull($result['list'][0]['user_role']);
        self::assertFalse($result['list'][0]['can_delete']);
    }

    private function setDatabaseContainer(bool $success = true): void
    {
        $connection = $this->createMock(ConnectionInterface::class);
        $connection->expects(self::once())->method('beginTransaction');
        $connection->expects($success ? self::once() : self::never())->method('commit');
        $connection->expects($success ? self::never() : self::once())->method('rollBack');
        $connection->method('transaction')->willReturnCallback(static function ($callback) use ($connection) {
            $connection->beginTransaction();
            try {
                $result = $callback();
                $connection->commit();
                return $result;
            } catch (Throwable $error) {
                $connection->rollBack();
                throw $error;
            }
        });
        $resolver = $this->createMock(ConnectionResolverInterface::class);
        $resolver->method('connection')->willReturn($connection);
        $validator = $this->createMock(ValidatorInterface::class);
        $validator->method('fails')->willReturn(false);
        $validatorFactory = $this->createMock(ValidatorFactoryInterface::class);
        $validatorFactory->method('make')->willReturn($validator);
        $this->previousContainer = ApplicationContext::hasContainer()
            ? ApplicationContext::getContainer()
            : null;
        ApplicationContext::setContainer(new class($resolver, $validatorFactory) implements ContainerInterface {
            public function __construct(
                private readonly ConnectionResolverInterface $resolver,
                private readonly ValidatorFactoryInterface $validatorFactory,
            ) {
            }

            public function get(string $id): mixed
            {
                return match ($id) {
                    Db::class => new Db($this),
                    ConnectionResolverInterface::class => $this->resolver,
                    PhpSerializerPacker::class => new PhpSerializerPacker(),
                    ValidatorFactoryInterface::class => $this->validatorFactory,
                    default => throw new RuntimeException("Unsupported test dependency: {$id}"),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [
                    Db::class,
                    ConnectionResolverInterface::class,
                    PhpSerializerPacker::class,
                    ValidatorFactoryInterface::class,
                ], true);
            }
        });
    }

    /**
     * @return array{0: RequestContext, 1: MicroAppRepositoryInterface, 2: ProjectRepositoryInterface, 3: MicroAppProjectResponseFormatter}
     */
    private function createShowFixtures(string $authorizationOrganizationCode = 'org-1'): array
    {
        $authorization = (new MagicUserAuthorization())
            ->setId('user-1')
            ->setOrganizationCode($authorizationOrganizationCode);
        $requestContext = $this->createMock(RequestContext::class);
        $requestContext->method('getUserAuthorization')->willReturn($authorization);

        $record = (new MicroAppEntity())
            ->setId(1001)
            ->setProjectId(2001)
            ->setOrganizationCode('org-1');
        $project = (new ProjectEntity())
            ->setId(2001)
            ->setUserId('user-1')
            ->setCreatedUid('user-1')
            ->setUserOrganizationCode('org-1')
            ->setProjectMode(ProjectMode::MICRO_APP->value);

        $microAppRepository = $this->createMock(MicroAppRepositoryInterface::class);
        $microAppRepository->method('findById')->with(1001)->willReturn($record);
        $projectRepository = $this->createMock(ProjectRepositoryInterface::class);
        $projectRepository->method('findById')->with(2001)->willReturn($project);

        return [
            $requestContext,
            $microAppRepository,
            $projectRepository,
            $this->createMock(MicroAppProjectResponseFormatter::class),
        ];
    }

    private function setErrorMessageContainer(): void
    {
        $this->previousContainer = ApplicationContext::hasContainer()
            ? ApplicationContext::getContainer()
            : null;

        ApplicationContext::setContainer(new class implements ContainerInterface {
            public function get(string $id)
            {
                return match ($id) {
                    ConfigInterface::class => new class implements ConfigInterface {
                        public function get(string $key, mixed $default = null): mixed
                        {
                            return match ($key) {
                                'app_env' => 'test',
                                'error_message' => [
                                    'exception_class' => BusinessException::class,
                                    'error_code_mapper' => [
                                        SuperAgentErrorCode::class => [51000, 51299],
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
                    default => throw new RuntimeException('Unexpected id: ' . $id),
                };
            }

            public function has(string $id): bool
            {
                return in_array($id, [ConfigInterface::class, TranslatorInterface::class], true);
            }
        });
    }

    private function createMemberService(): ProjectMemberDomainService
    {
        $projectMemberDomainService = $this->createMock(ProjectMemberDomainService::class);
        $projectMemberDomainService->method('getUserHighestRolesInProjects')->willReturn([]);

        return $projectMemberDomainService;
    }

    private function createService(
        MicroAppRepositoryInterface $microAppRepository,
        ProjectRepositoryInterface $projectRepository,
        ResourceShareAppService $resourceShareAppService,
        ResourceShareDomainService $shareDomainService,
        ShareUrlBuilder $shareUrlBuilder,
        MicroAppProjectResponseFormatter $responseFormatter,
        ?PublishedMicroAppResolver $publishedResolver = null,
        ?ProjectMemberDomainService $projectMemberDomainService = null,
        ?MagicDepartmentUserDomainService $departmentUserDomainService = null,
        ?ProjectDomainService $projectDomainService = null,
        ?PackageFilterInterface $packageFilterService = null,
        bool $denyCollaboration = false,
        ?PublishedMicroAppFileAccessService $publishedFileAccess = null,
        ?ProjectAppService $projectAppService = null,
        ?MicroAppTransferRepository $mutationLocks = null,
    ): MicroAppProjectAppService {
        $class = $denyCollaboration
            ? TestableDeniedCollaborationMicroAppProjectAppService::class
            : TestableMicroAppProjectAppService::class;

        $service = new $class(
            $microAppRepository,
            $projectRepository,
            $this->createMock(WorkspaceRepositoryInterface::class),
            $resourceShareAppService,
            $shareDomainService,
            $shareUrlBuilder,
            $projectDomainService ?? $this->createMock(ProjectDomainService::class),
            $projectAppService ?? $this->createMock(ProjectAppService::class),
            $projectMemberDomainService ?? $this->createMemberService(),
            $departmentUserDomainService ?? new MagicDepartmentUserDomainService(
                $this->createMock(MagicDepartmentUserRepositoryInterface::class)
            ),
            $packageFilterService ?? $this->createMock(PackageFilterInterface::class),
            $this->createMock(EventDispatcherInterface::class),
            $publishedResolver ?? $this->createMock(PublishedMicroAppResolver::class),
            $publishedFileAccess ?? $this->createMock(PublishedMicroAppFileAccessService::class),
            $responseFormatter,
            new MicroAppShareConfig(),
            $this->createMock(MicroAppVisitRepositoryInterface::class),
            $this->createMock(TaskFileRepositoryInterface::class),
            $mutationLocks ?? $this->createMock(MicroAppTransferRepository::class),
        );
        if ($service instanceof TestableMicroAppProjectAppService) {
            $identity = $this->createMock(DataIsolation::class);
            $identity->method('getCurrentUserId')->willReturn('user-1');
            $identity->method('getCurrentOrganizationCode')->willReturn('org-1');
            $service->testDataIsolation = $identity;
        }
        return $service;
    }
}

final class TestableMicroAppProjectAppService extends MicroAppProjectAppService
{
    public DataIsolation $testDataIsolation;

    public MemberRole $testRole = MemberRole::OWNER;

    public function getAccessibleProject(
        int $projectId,
        string $userId,
        string $organizationCode,
        MemberRole $requiredRole = MemberRole::VIEWER,
    ): ProjectEntity {
        if (! $this->testRole->isHigherOrEqualThan($requiredRole)) {
            throw new RuntimeException('project access denied');
        }
        return new ProjectEntity();
    }

    public function getAccessibleProjectWithManager(
        int $projectId,
        string $userId,
        string $organizationCode,
    ): ProjectEntity {
        return new ProjectEntity();
    }

    protected function createDataIsolation(Authenticatable $authorization): DataIsolation
    {
        return $this->testDataIsolation;
    }
}

final class TestableDeniedCollaborationMicroAppProjectAppService extends MicroAppProjectAppService
{
    public function getAccessibleProject(
        int $projectId,
        string $userId,
        string $organizationCode,
        MemberRole $requiredRole = MemberRole::VIEWER,
    ): ProjectEntity {
        throw new RuntimeException('project access denied');
    }

    public function getAccessibleProjectWithManager(
        int $projectId,
        string $userId,
        string $organizationCode,
    ): ProjectEntity {
        throw new RuntimeException('project access denied');
    }
}
