<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Agent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\ZipUtil;
use DateTime;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Application\Agent\DTO\ParsedAgentData;
use Dtyq\SuperMagic\Application\Agent\Parser\AgentZipParser;
use Dtyq\SuperMagic\Application\SuperAgent\DTO\Request\CreateAgentProjectRequestDTO;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\Agent\Entity\AgentVersionEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentVersionDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskFileSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Hyperf\Di\Annotation\Inject;
use Psr\Container\ContainerInterface;
use Qbhy\HyperfAuth\Authenticatable;
use RuntimeException;
use Throwable;

use function Hyperf\Support\retry;

/**
 * Application service for importing an agent from a ZIP package.
 *
 * Flow:
 *   1. Parse the ZIP → ParsedAgentData
 *   2. Idempotent create-or-update the Agent entity (keyed on name + orgCode)
 *   3. Create and bind a CUSTOM_AGENT project if agent has none
 *   4. Clear the project workspace and rebuild it under .magic/
 *   5. Upload the original ZIP to private object storage → set file_key
 *   6. Auto-publish the agent (organization-wide) using the already-uploaded ZIP
 *   7. Clean up temp directory
 */
class ImportAgentAppService extends AbstractSuperMagicAppService
{
    #[Inject]
    protected TaskFileDomainService $taskFileDomainService;

    #[Inject]
    protected AgentZipParser $agentZipParser;

    #[Inject]
    protected ProjectDomainService $projectDomainService;

    #[Inject]
    protected SuperMagicAgentVersionDomainService $superMagicAgentVersionDomainService;

    #[Inject]
    protected ContainerInterface $container;

    /**
     * Import an agent from a ZIP file.
     *
     * @param string $tempZipPath Local path to the uploaded ZIP
     * @param string $originalFilename Original filename provided by the client
     * @return SuperMagicAgentEntity The created or updated agent entity (caller handles DTO assembly)
     */
    public function import(
        Authenticatable $authorization,
        RequestContext $requestContext,
        string $tempZipPath,
        string $originalFilename
    ): SuperMagicAgentEntity {
        $dataIsolation = $this->createSuperMagicDataIsolation($authorization);
        $orgCode = $dataIsolation->getCurrentOrganizationCode();
        $userId = $dataIsolation->getCurrentUserId();

        $extractDir = null;

        try {
            // 1. Parse ZIP
            $parsedData = $this->agentZipParser->parse($tempZipPath);
            $extractDir = $parsedData->extractDir;

            // 2. Idempotent create-or-update the agent
            $agentName = $parsedData->nameI18n['en_US'] ?? ($parsedData->nameI18n['default'] ?? '');
            $existingAgent = $this->superMagicAgentDomainService->findByNameAndOrgCode($agentName, $orgCode);
            if ($existingAgent !== null) {
                $existingAgent = $this->superMagicAgentDomainService->getByCodeWithUserCheck(
                    $dataIsolation,
                    $existingAgent->getCode()
                );
            }

            $entityToSave = $this->buildAgentEntity($parsedData, $existingAgent);

            $savedEntity = $this->superMagicAgentDomainService->save($dataIsolation, $entityToSave, false);
            $agentCode = $savedEntity->getCode();

            // 3. Create and bind project if agent has none
            $projectId = $savedEntity->getProjectId();
            if (empty($projectId)) {
                $projectId = $this->createAndBindProject($requestContext, $savedEntity->getName(), $agentCode);
            }

            // 4. Rebuild the project workspace under .magic/
            $projectEntity = $this->projectDomainService->getProject((int) $projectId, $userId);
            $this->rebuildProjectWorkspace($projectEntity, $parsedData->agentDir, $userId);

            // 5. Upload ZIP to private bucket and record file_key
            $fileKey = $this->uploadZipToStorage($orgCode, $agentCode, $tempZipPath);

            // Persist file_key and project_id in one save
            $savedEntity->setFileKey($fileKey);
            $savedEntity->setProjectId($projectId);
            $savedEntity->setModifier($userId);
            $savedEntity->setUpdatedAt(new DateTime());
            $this->superMagicAgentDomainService->saveDirectly($dataIsolation, $savedEntity);

            // 6. Auto-publish (skip sandbox export — reuse the already-uploaded ZIP as file_key)
            // Inherit publish_target_type from the latest version; fall back to ORGANIZATION when no prior version exists.
            $latestVersion = $this->superMagicAgentVersionDomainService->findLatestVersionByCreatedAt($dataIsolation, $agentCode);
            $versionEntity = new AgentVersionEntity();
            $versionEntity->setVersion($this->resolveNextVersion($latestVersion));
            $versionEntity->setPublishTargetType($latestVersion?->getPublishTargetType() ?? PublishTargetType::ORGANIZATION);
            $this->superMagicAgentDomainService->publishAgent($dataIsolation, $savedEntity, $versionEntity);

            // 7. Sync resource visibility: ORGANIZATION publish means the agent is visible to all org members.
            //    The application-layer publishAgent (SuperMagicAgentAppService) normally calls syncPublishedAgentScope
            //    for this, but we bypassed it to avoid re-triggering sandbox export. So we do it here manually.
            $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
            $visibilityConfig = new VisibilityConfig();
            $visibilityConfig->setVisibilityType(VisibilityType::ALL);
            $this->resourceVisibilityDomainService->saveVisibilityConfig(
                $permissionDataIsolation,
                ResourceVisibilityResourceType::SUPER_MAGIC_AGENT,
                $agentCode,
                $visibilityConfig
            );

            return $savedEntity;
        } finally {
            if ($extractDir !== null) {
                try {
                    ZipUtil::removeDirectory($extractDir);
                } catch (Throwable) {
                    // Cleanup failure is non-fatal; log and continue.
                    $this->logger->warning('Failed to remove agent import temp directory', ['dir' => $extractDir]);
                }
            }
        }
    }

    /**
     * Build the agent entity from parsed data.
     * When $existingAgent is provided the entity is set up for the update path (code is set).
     */
    private function buildAgentEntity(
        ParsedAgentData $parsedData,
        ?SuperMagicAgentEntity $existingAgent
    ): SuperMagicAgentEntity {
        $entity = new SuperMagicAgentEntity();

        if ($existingAgent !== null) {
            $entity->setCode($existingAgent->getCode());
        }

        $agentName = $parsedData->nameI18n['en_US'] ?? ($parsedData->nameI18n['default'] ?? '');
        $description = $parsedData->descriptionI18n['en_US'] ?? ($parsedData->descriptionI18n['default'] ?? '');

        $entity->setName($agentName);
        $entity->setDescription($description);
        $entity->setNameI18n($parsedData->nameI18n);
        $entity->setRoleI18n($parsedData->roleI18n);
        $entity->setDescriptionI18n($parsedData->descriptionI18n);
        $entity->setTools([]);

        // Build system prompt from AGENTS.md (main body) and SOUL.md (personality layer)
        $promptParts = [];
        foreach (['AGENTS.md', 'SOUL.md'] as $file) {
            $path = $parsedData->agentDir . '/' . $file;
            if (file_exists($path)) {
                $content = trim((string) file_get_contents($path));
                if ($content !== '') {
                    $promptParts[] = $content;
                }
            }
        }

        $entity->setPrompt([
            'version' => '1.0.0',
            'structure' => ['string' => implode("\n\n", $promptParts)],
        ]);

        return $entity;
    }

    /**
     * Upload the original ZIP to private object storage and return the file_key.
     *
     * Storage path: agent_export/{agentCode}/{agentCode}.zip
     * This mirrors the convention used during sandbox export so downstream publish logic is compatible.
     *
     * Uses uploadByCredential (STS-based) because direct binary write is not supported by all drivers
     * (e.g. FileServiceDriver used in some environments throws "暂不支持" for Flysystem::write).
     */
    private function uploadZipToStorage(string $orgCode, string $agentCode, string $localZipPath): string
    {
        $filename = $agentCode . '.zip';
        $uploadFile = new UploadFile($localZipPath, 'agent_export/' . $agentCode, $filename, false);
        $this->fileDomainService->uploadByCredential($orgCode, $uploadFile, StorageBucketType::Private);
        // getKey() returns the full storage path (with credential dir prefix) set by cloudfile after upload.
        // getKeyPath() only returns the relative dir/name we specified, which is incomplete.
        return $uploadFile->getKey();
    }

    /**
     * Create a CUSTOM_AGENT project for the agent, bind it, and return the new project ID.
     */
    private function createAndBindProject(
        RequestContext $requestContext,
        string $agentName,
        string $agentCode
    ): int {
        /** @var ProjectAppService $projectAppService */
        $projectAppService = $this->container->get(ProjectAppService::class);

        return retry(3, function () use ($projectAppService, $requestContext, $agentName): int {
            $dto = new CreateAgentProjectRequestDTO();
            $dto->setProjectName($agentName);
            $dto->setInitTemplateFiles(false);

            $result = $projectAppService->createAgentProject($requestContext, $dto, ProjectMode::CUSTOM_AGENT);
            $projectId = (int) ($result['project']['id'] ?? 0);

            if ($projectId <= 0) {
                throw new RuntimeException('Failed to create project for imported agent: invalid project ID returned');
            }

            return $projectId;
        }, 1000);
    }

    /**
     * Clear the project workspace and upload the extracted agent package under .magic/.
     */
    private function rebuildProjectWorkspace(
        ProjectEntity $projectEntity,
        string $agentDir,
        string $userId
    ): void {
        $projectId = (int) $projectEntity->getId();
        $workDir = $projectEntity->getWorkDir();
        $projectOrgCode = $projectEntity->getUserOrganizationCode();
        $contactDataIsolation = DataIsolation::simpleMake($projectOrgCode, $userId);

        $rootDirId = $this->taskFileDomainService->findOrCreateProjectRootDirectory(
            $projectId,
            $workDir,
            $userId,
            $projectOrgCode,
            $projectOrgCode,
            TaskFileSource::AGENT
        );

        // Create .magic directory first, then clear only .magic contents (not the entire workspace)
        $magicDirId = $this->taskFileDomainService->createDirectory(
            $projectId,
            $rootDirId,
            '.magic',
            '.magic',
            $workDir,
            $userId,
            $projectOrgCode,
            $projectOrgCode,
            TaskFileSource::AGENT
        );

        $this->taskFileDomainService->clearProjectFile($projectId, $projectOrgCode, $magicDirId);

        $this->uploadDirContents(
            $contactDataIsolation,
            $projectEntity,
            $agentDir,
            $magicDirId,
            $projectId,
            '.magic',
            $workDir,
            $userId,
            $projectOrgCode,
            $projectOrgCode
        );
    }

    /**
     * Recursively traverse a local directory and upload its contents to the project file tree.
     */
    private function uploadDirContents(
        DataIsolation $contactDataIsolation,
        ProjectEntity $projectEntity,
        string $localDir,
        int $parentDirId,
        int $projectId,
        string $relativePath,
        string $workDir,
        string $userId,
        string $orgCode,
        string $projectOrgCode
    ): void {
        $items = array_values(array_diff((array) scandir($localDir), ['.', '..']));

        foreach ($items as $item) {
            $localPath = $localDir . '/' . $item;
            $itemRelativePath = $relativePath . '/' . $item;

            if (is_dir($localPath)) {
                $subDirId = $this->taskFileDomainService->createDirectory(
                    $projectId,
                    $parentDirId,
                    $item,
                    $itemRelativePath,
                    $workDir,
                    $userId,
                    $orgCode,
                    $projectOrgCode,
                    TaskFileSource::AGENT
                );

                $this->uploadDirContents(
                    $contactDataIsolation,
                    $projectEntity,
                    $localPath,
                    $subDirId,
                    $projectId,
                    $itemRelativePath,
                    $workDir,
                    $userId,
                    $orgCode,
                    $projectOrgCode
                );
            } else {
                $content = (string) file_get_contents($localPath);
                $this->taskFileDomainService->createProjectFileWithContent(
                    $contactDataIsolation,
                    $projectEntity,
                    $parentDirId,
                    $item,
                    $content,
                    TaskFileSource::AGENT
                );
            }
        }
    }

    /**
     * Determine the next publish version for the agent.
     * Accepts the latest version entity (already fetched by the caller) and increments the patch segment.
     * Falls back to "1.0.0" when no prior version exists.
     */
    private function resolveNextVersion(?AgentVersionEntity $latestVersion): string
    {
        if ($latestVersion === null) {
            return '1.0.0';
        }

        $parts = explode('.', $latestVersion->getVersion());
        if (count($parts) !== 3) {
            return '1.0.0';
        }

        $patch = (int) $parts[2] + 1;
        return sprintf('%s.%s.%d', $parts[0], $parts[1], $patch);
    }
}
