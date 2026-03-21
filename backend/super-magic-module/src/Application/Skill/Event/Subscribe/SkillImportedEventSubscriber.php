<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Event\Subscribe;

use App\Domain\File\Service\FileDomainService;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\CloudFile\Kernel\Struct\FileLink;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Event\SkillImportedEvent;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

#[Listener]
class SkillImportedEventSubscriber implements ListenerInterface
{
    private const LOCK_KEY_FORMAT = 'skill_import_post_process:%s:%s';

    private LoggerInterface $logger;

    public function __construct(
        private readonly ContainerInterface $container,
        private readonly SkillDomainService $skillDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly LockerInterface $locker
    ) {
        /** @var LoggerFactory $loggerFactory */
        $loggerFactory = $this->container->get(LoggerFactory::class);
        $this->logger = $loggerFactory->get(static::class);
    }

    public function listen(): array
    {
        return [
            SkillImportedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        if (! $event instanceof SkillImportedEvent) {
            return;
        }

        Coroutine::create(function () use ($event) {
            $this->handleSkillImportedEvent($event);
        });
    }

    private function handleSkillImportedEvent(SkillImportedEvent $event): void
    {
        $userAuthorization = $event->getUserAuthorization();
        $skillCode = $event->getSkillCode();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $userId = $userAuthorization->getId();

        $lockKey = sprintf(self::LOCK_KEY_FORMAT, $organizationCode, $skillCode);
        $lockOwner = IdGenerator::getUniqueId32();

        if (! $this->locker->mutexLock($lockKey, $lockOwner, 120)) {
            $this->logger->info('Skip skill import post-process due to lock contention', [
                'skill_code' => $skillCode,
                'organization_code' => $organizationCode,
            ]);
            return;
        }

        try {
            $dataIsolation = SkillDataIsolation::create($organizationCode, $userId);
            $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $skillCode);

            $projectId = (int) ($skillEntity->getProjectId() ?? 0);
            if ($projectId <= 0) {
                $requestContext = new RequestContext();
                $requestContext->setUserAuthorization($userAuthorization);
                $requestContext->setUserId($userId);
                $requestContext->setOrganizationCode($organizationCode);

                $projectRequestDTO = new CreateAgentProjectRequestDTO();
                $projectRequestDTO->setProjectName($skillEntity->getPackageName() ?: $skillEntity->getCode());
                $projectRequestDTO->setInitTemplateFiles(false);

                $projectAppService = $this->getProjectAppService();
                $projectResult = $projectAppService->createAgentProject(
                    $requestContext,
                    $projectRequestDTO,
                    ProjectMode::CUSTOM_SKILL
                );

                $projectId = (int) ($projectResult['project']['id'] ?? 0);
                if ($projectId <= 0) {
                    throw new RuntimeException('Failed to create project for imported skill');
                }

                $skillEntity->setProjectId($projectId);
                $this->skillDomainService->saveSkill($dataIsolation, $skillEntity);
            }

            $fileKey = $skillEntity->getFileKey();
            if ($fileKey === '') {
                throw new RuntimeException('Skill file_key is empty');
            }

            $fileUrl = $this->resolvePrivateFileUrl($organizationCode, $fileKey);
            if ($fileUrl === '') {
                throw new RuntimeException('Failed to resolve skill file_url from file_key');
            }

            $projectAppService = $this->getProjectAppService();
            $projectEntity = $projectAppService->getProjectNotUserId($projectId);
            if ($projectEntity === null) {
                throw new RuntimeException('Project not found for imported skill');
            }

            $fullPrefix = $this->taskFileDomainService->getFullPrefix($projectEntity->getUserOrganizationCode());
            $fullWorkdir = WorkDirectoryUtil::getFullWorkdir($fullPrefix, $projectEntity->getWorkDir());

            $this->skillDomainService->importSkillWorkspaceFromSandbox(
                $dataIsolation,
                $projectId,
                $fullWorkdir,
                $fileUrl
            );

            $this->logger->info('Skill import post-process completed', [
                'skill_code' => $skillCode,
                'project_id' => $projectId,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('Skill import post-process failed', [
                'skill_code' => $skillCode,
                'organization_code' => $organizationCode,
                'error' => $e->getMessage(),
            ]);
        } finally {
            $this->locker->release($lockKey, $lockOwner);
        }
    }

    private function resolvePrivateFileUrl(string $organizationCode, string $fileKey): string
    {
        $fileLink = $this->fileDomainService->getLinks($organizationCode, [$fileKey], StorageBucketType::Private)[$fileKey] ?? null;

        return $fileLink instanceof FileLink ? $fileLink->getUrl() : '';
    }

    private function getProjectAppService(): ProjectAppService
    {
        /** @var ProjectAppService $projectAppService */
        return $this->container->get(ProjectAppService::class);
    }
}
