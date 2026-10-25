<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Skill\Service;

use App\Application\SuperMagic\Agent\Service\SuperMagicAgentAppService;
use App\Application\SuperMagic\Project\DTO\Request\CreateAgentProjectRequestDTO;
use App\Application\SuperMagic\Project\Service\ProjectAppService;
use App\Application\SuperMagic\Publish\PublishAsyncStatusManager;
use App\Application\SuperMagic\Skill\DTO\PublishSkillResultDTO;
use App\Application\SuperMagic\Skill\Import\SkillPackageParser;
use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\ModelGateway\Entity\ValueObject\SourceId;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\Operation;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationPermissionResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\SuperMagic\File\Entity\TaskFileEntity;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Project\Entity\ProjectEntity;
use App\Domain\SuperMagic\Project\Entity\ValueObject\ProjectMode;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Skill\Entity\SkillCategoryEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillMarketEntity;
use App\Domain\SuperMagic\Skill\Entity\SkillVersionEntity;
use App\Domain\SuperMagic\Skill\Entity\UserSkillEntity;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublisherType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishTargetType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\PublishType;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillListScope;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\Query\SkillQuery;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\ReviewStatus;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillDataIsolation;
use App\Domain\SuperMagic\Skill\Entity\ValueObject\SkillSourceType;
use App\Domain\SuperMagic\Skill\Event\SkillImportedEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketInstalledEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketOfflineEvent;
use App\Domain\SuperMagic\Skill\Event\SkillMarketUninstalledEvent;
use App\Domain\SuperMagic\Skill\Event\SkillUsedEvent;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillCategoryRelationDomainService;
use App\Domain\SuperMagic\Skill\Service\SkillMarketDomainService;
use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxRootFileIds;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\SkillErrorCode;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\SuperMagic\Utils\SkillProjectConfigUtil;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\ZipUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\SuperMagic\Skill\DTO\Request\AddSkillFromStoreRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\CreateSkillDraftRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\GetLatestPublishedSkillVersionsRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\GetSkillFileUrlsRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ImportSkillRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ParseFileImportRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\PrepareSkillPublishRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\PublishSkillRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillVersionsRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillInfoRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\ParseFileImportResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillDetailResponseDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillFileUrlItemDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Response\SkillPublishPrefillResponseDTO;
use Closure;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

/**
 * 用户 Skill 应用服务.
 */
class SkillAppService extends AbstractSkillAppService
{
    private const SKILL_FILE_NAME = 'SKILL.md';

    /**
     * import_token 有效期：30分钟（1800秒，文档要求）
     * 用于控制导入第一阶段生成的 token 的有效期
     */
    /**
     * 分布式锁键格式：skill_import:{userId}:{organizationCode}:{packageName}
     * 用于防止并发重复创建/更新技能.
     */
    private const LOCK_KEY_FORMAT = 'skill_import:%s:%s:%s';

    /**
     * import_token 在 Redis 中的 key 前缀
     * 完整 key 格式：skill_import_token:{token}.
     */
    private const IMPORT_TOKEN_KEY_PREFIX = 'skill_import_token:';

    /**
     * Skill 导入临时文件基础目录
     * 用于存储下载和解压的临时文件
     * 完整格式：{TEMP_DIR_BASE}{prefix}_{uniqueId}.
     */
    private const TEMP_DIR_BASE = BASE_PATH . '/runtime/skills/';

    private const SKILL_PUBLISH_EXPORT_TASK_PROMPT = 'Skill Publish Export Task';

    protected LoggerInterface $logger;

    public function __construct(
        protected SkillMarketDomainService $skillMarketDomainService,
        protected MagicUserDomainService $magicUserDomainService,
        protected MagicDepartmentDomainService $magicDepartmentDomainService,
        protected ProjectAppService $projectAppService,
        protected OperationPermissionDomainService $operationPermissionDomainService,
        protected ProjectDomainService $projectDomainService,
        protected TaskFileDomainService $taskFileDomainService,
        protected AgentDomainService $agentDomainService,
        protected TopicDomainService $topicDomainService,
        protected TaskDomainService $taskDomainService,
        protected SkillCategoryRelationDomainService $skillCategoryRelationDomainService,
        protected SkillCategoryDomainService $skillCategoryDomainService,
        protected SkillPackageParser $skillPackageParser,
        protected PublishAsyncStatusManager $publishAsyncStatusManager,
        protected SuperMagicAgentAppService $agentAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 导入第一阶段：上传文件并解析.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param ParseFileImportRequestDTO $requestDTO 请求 DTO
     * @return ParseFileImportResponseDTO 解析结果
     */
    public function parseFileImport(RequestContext $requestContext, ParseFileImportRequestDTO $requestDTO): ParseFileImportResponseDTO
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $fileKey = $requestDTO->getFileKey();

        // 解析上传文件，获取 Skill 包名和描述。
        $package = $this->skillPackageParser->parseByFileKey($organizationCode, $fileKey);
        $packageName = $package->packageName;
        $packageDescription = $package->packageDescription;

        // 查询当前用户的同名 Skill，确定后续是更新还是新建。
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);
        $existingSkillEntity = $this->skillDomainService->findSkillByPackageNameAndCreator($dataIsolation, $packageName);

        // 更新场景沿用原有编码，新建场景在确认导入时生成编码。
        $skillCode = $existingSkillEntity ? $existingSkillEntity->getCode() : null;

        // 保存解析结果，确认导入时通过 Token 恢复文件信息。
        $importToken = $this->createImportToken(self::IMPORT_TOKEN_KEY_PREFIX, [
            'package_name' => $packageName,
            'package_description' => $packageDescription,
            'file_key' => $fileKey,
            'skill_code' => $skillCode,
        ]);

        // 根据是否存在同名 Skill，返回对应的预填信息。
        if ($existingSkillEntity) {
            return $this->handleExistingSkillParse(
                $existingSkillEntity,
                $dataIsolation,
                $importToken,
                $packageName,
                $packageDescription
            );
        }
        return $this->handleNewSkillParse(
            $importToken,
            $packageName,
            $packageDescription
        );
    }

    /**
     * 导入第二阶段：确认信息正式落库.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param ImportSkillRequestDTO $requestDTO 请求 DTO
     * @return SkillEntity 用户技能实体
     */
    public function importSkill(RequestContext $requestContext, ImportSkillRequestDTO $requestDTO): SkillEntity
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $sourceType = $requestDTO->getSourceType();

        // 读取解析阶段生成的 Token，恢复导入文件和 Skill 信息。
        $tokenData = $this->readImportToken(self::IMPORT_TOKEN_KEY_PREFIX, $requestDTO->getImportToken());
        $packageName = (string) $tokenData['package_name'];
        $packageDescription = (string) $tokenData['package_description'];
        $fileKey = (string) $tokenData['file_key'];
        $skillCode = isset($tokenData['skill_code']) ? (string) $tokenData['skill_code'] : null;

        $lockKey = sprintf(self::LOCK_KEY_FORMAT, $userId, $organizationCode, $packageName);
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);
        $lockOwner = '';

        try {
            // 获取同名导入锁，确保同一 Skill 不被并发写入。
            $lockOwner = $this->acquireImportLock($lockKey);
            Db::beginTransaction();
            try {
                // 保存 Skill；Crew 来源在此阶段同步完成发布。
                $result = $this->saveConfirmedSkillImport(
                    $dataIsolation,
                    $skillCode,
                    $packageName,
                    $packageDescription,
                    $fileKey,
                    $sourceType,
                    $userId,
                    $organizationCode,
                    $requestDTO
                );

                Db::commit();
            } catch (Throwable $e) {
                Db::rollBack();
                throw $e;
            }
        } finally {
            $this->releaseImportLock($lockKey, $lockOwner);
        }

        // 事务提交后再删除 Token，避免失败重试时丢失导入信息。
        $this->removeImportToken(self::IMPORT_TOKEN_KEY_PREFIX, $requestDTO->getImportToken());

        try {
            AsyncEventUtil::dispatch(new SkillImportedEvent($userAuthorization, $result->getCode()));
        } catch (Throwable $eventException) {
            $this->logger->error('Dispatch SkillImportedEvent failed', [
                'skill_code' => $result->getCode(),
                'error' => $eventException->getMessage(),
            ]);
        }

        return $result;
    }

    /**
     * 从技能市场添加技能.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param AddSkillFromStoreRequestDTO $requestDTO 请求 DTO
     * @return SkillEntity 技能实体
     */
    public function addSkillFromStore(RequestContext $requestContext, AddSkillFromStoreRequestDTO $requestDTO): SkillEntity
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        Db::beginTransaction();
        try {
            $skillEntity = $this->skillDomainService->addSkillFromMarket($dataIsolation, (int) $requestDTO->getStoreSkillId());
            $this->appendSkillVisibilityUsers($dataIsolation, $skillEntity->getCode(), [$dataIsolation->getCurrentUserId()]);
            Db::commit();

            // 安装计数在事务提交后再异步刷新向量 payload，避免回滚事务产生脏事件。
            $marketId = (int) $requestDTO->getStoreSkillId();
            $market = $this->skillMarketDomainService->findByIds([$marketId])[$marketId] ?? null;
            if ($market !== null) {
                AsyncEventUtil::dispatch(new SkillMarketInstalledEvent(
                    (string) $market->getId(),
                    $market->getOrganizationCode(),
                    $dataIsolation->getCurrentUserId(),
                ));
            }

            return $skillEntity;
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    /**
     * 从 Agent 创建空技能.
     *
     * @param RequestContext $requestContext 请求上下文
     */
    public function create(RequestContext $requestContext): SkillEntity
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $skillCode = SkillEntity::generateNewCode();

        Db::beginTransaction();
        try {
            $skillEntity = $this->createSkillInternal(
                $dataIsolation,
                $userId,
                $organizationCode,
                '',
                '',
                '',
                $skillCode,
                SkillSourceType::DIALOGUE_CREATION,
                [],
                [],
                null
            );

            Db::commit();
            return $skillEntity;
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    /** Create the draft and its project in one transaction; retries use a stable skill code. */
    public function createDraft(RequestContext $context, CreateSkillDraftRequestDTO $request): array
    {
        $isolation = $this->createSkillDataIsolation($context->getUserAuthorization());
        $key = 'skill:draft:' . hash('sha256', $isolation->getCurrentOrganizationCode() . ':' . $isolation->getCurrentUserId() . ':' . $request->requestId);
        $owner = $this->acquireImportLock($key);
        try {
            $code = $this->redis->get($key);
            if (! is_string($code) || $code === '') {
                $code = $request->existingSkillCode ?? SkillEntity::generateNewCode();
                // Persist the identity before creating anything, including on an uncertain response.
                if (! $this->redis->setex($key, 86400, $code)) {
                    throw new RuntimeException('Could not persist skill creation identity');
                }
            }
            if ($request->existingSkillCode !== null && $code !== $request->existingSkillCode) {
                ExceptionBuilder::throw(SkillErrorCode::PROJECT_BINDING_CONFLICT);
            }
            if ($request->existingSkillCode !== null && $this->skillDomainService->findOptionalSkillByCode($isolation, $code) === null) {
                ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND);
            }
            $project = $this->createSkillProject($context, $request->name, $code, false, function () use ($request, $isolation, $code): void {
                $skill = $this->skillDomainService->findOptionalSkillByCode($isolation, $code);
                if ($skill === null) {
                    if ($request->existingSkillCode !== null) {
                        ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND);
                    }
                    $this->createSkillInternal(
                        $isolation,
                        $isolation->getCurrentUserId(),
                        $isolation->getCurrentOrganizationCode(),
                        '',
                        '',
                        '',
                        $code,
                        SkillSourceType::DIALOGUE_CREATION,
                        ['default' => $request->name],
                        ['default' => $request->description],
                        null
                    );
                }
            });
            $skill = $this->skillDomainService->findUserSkillByCode($isolation, $code);
            return [
                'id' => (string) $skill->getId(), 'skill_code' => $code, 'project_id' => (string) $project['project']['id'],
                'name' => $skill->getI18nName(CoContext::getLanguage()), 'description' => $skill->getI18nDescription(CoContext::getLanguage()),
            ];
        } finally {
            $this->releaseImportLock($key, $owner);
        }
    }

    /** Shared by Web creation and conversation creation. Never replace an existing binding. */
    public function createAndBindProject(RequestContext $context, string $name, string $code, bool $setDefaultTopic = true): array
    {
        return $this->createSkillProject($context, $name, $code, $setDefaultTopic);
    }

    public function getSkillByProject(RequestContext $context, int $projectId): SkillDetailResponseDTO
    {
        $isolation = $this->createSkillDataIsolation($context->getUserAuthorization());
        $isolation->disabled();
        $skill = $this->skillDomainService->findSkillByProjectId($isolation, $projectId);
        // The project lookup is for editing source, not accessing a marketplace author's draft.
        $this->assertSkillEditable($isolation, $skill->getCode());
        return $this->getSkillDetail($context, $skill->getCode());
    }

    /** Export only. No version, visibility or review state changes before confirmation. */
    public function prepareSkillPublish(RequestContext $context, string $code, PrepareSkillPublishRequestDTO $request): array
    {
        $isolation = $this->createSkillDataIsolation($context->getUserAuthorization());
        $this->assertSkillEditable($isolation, $code);
        $isolation->disabled();
        $token = hash('sha256', $isolation->getCurrentOrganizationCode() . ':' . $isolation->getCurrentUserId() . ':' . $code . ':' . $request->requestId);
        $key = 'skill:prepare:' . $token;
        $owner = $this->acquireImportLock($key);
        try {
            if ($this->redis->exists($key)) {
                return $this->readSkillPreparation($context, $code, $token);
            }
            $skill = $this->skillDomainService->findSkillByCode($isolation, $code);
            $project = $this->projectDomainService->getProjectNotUserId((int) $skill->getProjectId());
            if ($project === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
            }
            $config = $this->readSkillProjectConfig((int) $skill->getProjectId(), $project);
            $dir = $config['skill']['dir'];
            $latest = $this->skillVersionDomainService->findLatestSkillVersionByCode($isolation, $code);
            $current = $this->skillVersionDomainService->findCurrentPublishedVersionsByCodes($isolation, [$code])[$code] ?? null;
            $target = $request->publishTargetType ?? $current?->getPublishTargetType()->value ?? PublishTargetType::PRIVATE->value;
            if (! in_array($target, ['PRIVATE', 'ORGANIZATION', 'MARKET'], true)) {
                // Existing MEMBER releases require an explicit supported target, never a silent scope change.
                ExceptionBuilder::throw(SkillErrorCode::PUBLISH_TARGET_TYPE_INVALID);
            }
            if ($target === 'ORGANIZATION' && $isolation->getOrganizationInfoManager()->getOrganizationType() === OrganizationType::Personal) {
                ExceptionBuilder::throw(SkillErrorCode::PUBLISH_TARGET_TYPE_INVALID);
            }
            if ($skill->getSourceType()->isMarket()) {
                ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_CANNOT_PUBLISH);
            }
            $record = [
                'prepare_token' => $token, 'publish_task_id' => $token, 'status' => 'processing',
                'skill_code' => $code, 'project_id' => (string) $skill->getProjectId(),
                'organization_code' => $isolation->getCurrentOrganizationCode(), 'user_id' => $isolation->getCurrentUserId(),
                'name' => $request->name ?? $skill->getI18nName(CoContext::getLanguage()),
                'description' => $request->description ?? $skill->getI18nDescription(CoContext::getLanguage()),
                'name_i18n' => $request->name === null ? $skill->getNameI18n() : ['default' => $request->name],
                'description_i18n' => $request->description === null ? ($skill->getDescriptionI18n() ?? []) : ['default' => $request->description],
                'version' => $request->version ?? $this->skillVersionDomainService->getNextAvailableVersion($isolation, $code, $latest?->getVersion()),
                'publish_target_type' => $target, 'current_publish_target_type' => $current?->getPublishTargetType()->value,
                'base_version_id' => (string) ($latest?->getId() ?? ''), 'skill_dir' => $dir,
                'created_at' => time(), 'expires_at' => time() + 86400,
                'task_key' => 'prepare:skill:' . $token,
            ];
            // Store before submitting export so an HTTP retry resumes the same task.
            $this->writeSkillPreparation($token, $record);
            $sandboxId = $this->initializeSkillPublishSandbox($isolation, $code, $project);
            $record['sandbox_id'] = $sandboxId;
            $this->writeSkillPreparation($token, $record);
            $result = $this->skillDomainService->createSkillWorkspaceExportAsync(
                $isolation,
                $code,
                $sandboxId,
                SkillProjectConfigUtil::SKILLS_ROOT_PATH . '/' . $dir,
                $dir,
                $code . '_' . $token . '.zip',
                $record['task_key'],
                contactDataIsolation: $this->createContactDataIsolationByBase($isolation)
            );
            if (($result['status'] ?? '') === 'FAILED' || ! in_array($result['code'] ?? 1000, [1000, 4000], true)) {
                throw new RuntimeException('Skill export could not be started');
            }
            return $record;
        } catch (Throwable $error) {
            if (isset($record)) {
                $record['status'] = 'failed';
                $this->writeSkillPreparation($token, $record);
            }
            throw $error;
        } finally {
            $this->releaseImportLock($key, $owner);
        }
    }

    public function checkSkillPreparation(RequestContext $context, string $code, string $token): array
    {
        $key = 'skill:prepare:' . $token;
        $owner = $this->acquireImportLock($key);
        try {
            return $this->advanceSkillPreparation($context, $code, $token);
        } finally {
            $this->releaseImportLock($key, $owner);
        }
    }

    /** Publish exactly the confirmed ZIP. A response lost after commit is recovered by version + file key. */
    public function publishSkillPreparation(RequestContext $context, string $code, string $token): array
    {
        $record = $this->readSkillPreparation($context, $code, $token);
        $isolation = $this->createSkillDataIsolation($context->getUserAuthorization());
        $isolation->disabled();
        $key = 'skill:publish:' . $code;
        $owner = $this->acquireImportLock($key);
        try {
            $versions = $this->skillVersionDomainService->findAllSkillVersionsByCode($isolation, $code);
            foreach ($versions as $version) {
                if ($version->getVersion() === $record['version']) {
                    if ($version->getFileKey() === ($record['file_key'] ?? null) && $version->getPublisherUserId() === $record['user_id']) {
                        return $this->skillPublishReceipt($version);
                    }
                    ExceptionBuilder::throw(SkillErrorCode::VERSION_ALREADY_EXISTS);
                }
            }
            if ($record['status'] !== 'ready') {
                ExceptionBuilder::throw(SkillErrorCode::PUBLISH_PREPARATION_STALE);
            }
            $skill = $this->skillDomainService->findSkillByCode($isolation, $code);
            $latest = $this->skillVersionDomainService->findLatestSkillVersionByCode($isolation, $code);
            if ((string) ($latest?->getId() ?? '') !== $record['base_version_id']
                || (string) $skill->getProjectId() !== $record['project_id']
                || $record['manifest'] !== $this->skillProjectManifest((int) $record['project_id'], $record['skill_dir'])) {
                ExceptionBuilder::throw(SkillErrorCode::PUBLISH_PREPARATION_STALE);
            }
            return Db::transaction(function () use ($isolation, $skill, $record) {
                $skill->setNameI18n($record['name_i18n']);
                $skill->setDescriptionI18n($record['description_i18n']);
                $skill->setPackageName($record['package_name']);
                $skill->setPackageDescription($record['package_description']);
                $skill->setFileKey($record['file_key']);
                $version = new SkillVersionEntity();
                $version->setVersion($record['version']);
                $version->setVersionDescriptionI18n($record['description_i18n']);
                $version->setPublishTargetType($record['publish_target_type']);
                $version->setSkillFileKey($record['skill_file_key']);
                $version = $this->skillVersionDomainService->publishSkill($isolation, $skill, $version, expectedLatestVersionId: $record['base_version_id']);
                if ($version->getPublishStatus()->isPublished()) {
                    $this->syncPublishedSkillScope($isolation, $skill, $version);
                }
                return $this->skillPublishReceipt($version);
            });
        } finally {
            $this->releaseImportLock($key, $owner);
        }
    }

    public function getPreparedSkillPublishResult(RequestContext $context, string $code, string $token): array
    {
        $record = $this->readSkillPreparation($context, $code, $token);
        $isolation = $this->createSkillDataIsolation($context->getUserAuthorization());
        $isolation->disabled();
        foreach ($this->skillVersionDomainService->findAllSkillVersionsByCode($isolation, $code) as $version) {
            if ($version->getVersion() === $record['version'] && $version->getFileKey() === ($record['file_key'] ?? null)
                && $version->getPublisherUserId() === $record['user_id']) {
                return $this->skillPublishReceipt($version);
            }
        }
        return ['skill_code' => $code, 'status' => 'not_submitted', 'preparation_status' => $record['status'], 'submitted' => false];
    }

    /**
     * 查询用户技能列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param SkillQuery $query 查询对象
     * @param Page $page 分页对象
     * @return array{
     *     list: SkillEntity[],
     *     total: int,
     *     creator_user_map: array<string, mixed>,
     *     latest_version_map: array<string, mixed>
     * } 技能列表结果
     */
    public function queries(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $accessibleSkillCodes = $this->getAccessibleSkillCodes($dataIsolation);

        $dataIsolation->disabled();
        $result = $this->skillDomainService->queriesByCodes($dataIsolation, $accessibleSkillCodes, $query, $page);

        return $this->buildSkillListResult($dataIsolation, $result);
    }

    /**
     * 查询我创建的技能列表.
     *
     * @return array{
     *     list: SkillEntity[],
     *     total: int,
     *     creator_user_map: array<string, mixed>,
     *     latest_version_map: array<string, mixed>,
     *     skill_operations: array<string, Operation>
     * }
     */
    public function queriesCreated(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $result = $this->skillDomainService->queries($dataIsolation, $query, $page);
        $this->updateSkillLogoUrl($dataIsolation, $result['list']);
        $creatorUserMap = $this->buildCreatorUserMapFromSkillEntities($dataIsolation, $result['list']);

        $skillCodes = array_map(function (SkillEntity $skillEntity) {
            return $skillEntity->getCode();
        }, $result['list']);
        $publishedVersionMap = $this->skillVersionDomainService->findCurrentPublishedVersionsByCodes($dataIsolation, $skillCodes);

        return [
            'list' => $result['list'],
            'total' => $result['total'],
            'creator_user_map' => $creatorUserMap,
            'latest_version_map' => $publishedVersionMap,
            // The list is filtered by creator_id, so the current user owns every item.
            'skill_operations' => array_fill_keys($skillCodes, Operation::Owner),
        ];
    }

    /**
     * 按明确作用域查询用户技能列表。
     *
     * @return array<string, mixed>
     */
    public function queriesByScope(
        RequestContext $requestContext,
        SkillQuery $query,
        Page $page,
        SkillListScope $scope
    ): array {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());

        return match ($scope) {
            SkillListScope::ALL => $this->queries($requestContext, $query, $page),
            SkillListScope::CREATED => $this->queriesCreated($requestContext, $query, $page),
            SkillListScope::TEAM_SHARED => $this->buildSharedSkillListResult(
                $dataIsolation,
                $query,
                $page,
                $this->getTeamSharedVisibleSkillCodes($dataIsolation),
                true
            ),
            SkillListScope::COLLABORATED => $this->buildSharedSkillListResult(
                $dataIsolation,
                $query,
                $page,
                $this->getCollaboratedSkillCodes($dataIsolation),
                false
            ),
            SkillListScope::MARKET_INSTALLED => $this->queriesMarketInstalled($requestContext, $query, $page),
        };
    }

    /**
     * 查询团队共享的技能列表.
     *
     * @return array{
     *     list: SkillEntity[],
     *     total: int,
     *     creator_user_map: array<string, mixed>,
     *     latest_version_map: array<string, mixed>,
     *     skill_operations: array<string, mixed>
     * }
     */
    public function queriesTeamShared(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $dataIsolation = $this->createSkillDataIsolation($requestContext->getUserAuthorization());
        return $this->buildSharedSkillListResult(
            $dataIsolation,
            $query,
            $page,
            $this->getTeamSharedReadableSkillCodes($dataIsolation)
        );
    }

    /**
     * 查询从市场安装的技能列表.
     *
     * @return array{
     *     list: SkillVersionEntity[],
     *     total: int,
     *     creator_user_map: array<string, mixed>,
     *     latest_version_map: array<string, mixed>,
     *     market_entity_map: array<string, mixed>,
     *     publisher_user_map: array<string, mixed>
     * }
     */
    public function queriesMarketInstalled(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $marketInstalledCodes = $this->getMarketInstalledSkillCodes($dataIsolation);

        if ($marketInstalledCodes === []) {
            return [
                'list' => [],
                'total' => 0,
                'creator_user_map' => [],
                'latest_version_map' => [],
                'market_entity_map' => [],
                'publisher_user_map' => [],
            ];
        }

        $dataIsolation->disabled();
        $result = $this->skillVersionDomainService->queryCurrentPublishedVersionsByCodes(
            $dataIsolation,
            $marketInstalledCodes,
            $query->getKeyword(),
            $page
        );

        $this->updateSkillVersionAssetUrls($dataIsolation, $result['list']);
        $creatorUserMap = $this->buildCreatorUserMapFromSkillVersions($dataIsolation, $result['list']);
        $latestVersionMap = $this->buildLatestVersionEntityMapFromSkillVersions($result['list']);

        $marketCodes = [];
        foreach ($result['list'] as $skillVersionEntity) {
            if ($skillVersionEntity->getPublishTargetType()->isMarket()) {
                $marketCodes[] = $skillVersionEntity->getCode();
            }
        }

        $marketEntityMap = $publisherUserMap = [];
        if ($marketCodes) {
            $marketEntityMap = $this->skillMarketDomainService->findLatestPublishedBySkillCodes($marketCodes);
            $publisherUserMap = $this->buildPublisherUserMapFromSkillMarkets($dataIsolation, $marketEntityMap);
        }

        return [
            'list' => $result['list'],
            'total' => $result['total'],
            'creator_user_map' => $creatorUserMap,
            'latest_version_map' => $latestVersionMap,
            'market_entity_map' => $marketEntityMap,
            'publisher_user_map' => $publisherUserMap,
        ];
    }

    /**
     * 删除技能（支持所有来源类型）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     */
    public function deleteSkill(RequestContext $requestContext, string $code): void
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = SkillDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );
        $userSkillEntity = $this->skillDomainService->findUserSkillOwnershipByCode($dataIsolation, $code);

        $marketSkillId = $userSkillEntity?->getSourceId();
        $isMarketSkill = $userSkillEntity !== null && $userSkillEntity->getSourceType()->isMarket();
        Db::beginTransaction();
        try {
            if ($isMarketSkill) {
                $this->skillDomainService->deleteUserSkillOwnership($dataIsolation, $code);
                $this->removeSkillVisibilityUsers($dataIsolation, $code, [$dataIsolation->getCurrentUserId()]);
                if ($marketSkillId !== null) {
                    AsyncEventUtil::dispatch(new SkillMarketUninstalledEvent(
                        (string) $marketSkillId,
                        $authorization->getOrganizationCode(),
                        $authorization->getId(),
                    ));
                }
                Db::commit();
                return;
            }

            // 非市场安装场景走主判定模型，只有具备删除权限的协作者才能删除。
            $this->resourceAccessPolicyService->assertDeletable(
                $dataIsolation,
                OperationPermissionResourceType::Skill,
                $code
            );
            $this->clearSkillVisibility($dataIsolation, $code);
            $this->clearSkillOwnerPermission($dataIsolation, $code);
            $this->skillDomainService->deleteSkill($dataIsolation, $code);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        $market = $this->skillMarketDomainService->findStoreSkillBySkillCode($code);
        if ($market !== null && $market->getId() !== null) {
            AsyncEventUtil::dispatch(new SkillMarketOfflineEvent(
                (string) $market->getId(),
                $market->getOrganizationCode(),
                $authorization->getId(),
            ));
        }
    }

    /**
     * 更新技能基本信息（仅允许更新非商店来源的技能）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     * @param UpdateSkillInfoRequestDTO $requestDTO 请求 DTO
     */
    public function updateSkillInfo(RequestContext $requestContext, string $code, UpdateSkillInfoRequestDTO $requestDTO): void
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = SkillDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 写操作统一通过协作权限模型判定，editor / admin / owner 均可编辑
        $this->assertSkillEditable($dataIsolation, $code);

        // 权限断言通过后关闭组织过滤，支持协作者读取非本人创建的 Skill
        $dataIsolation->disabled();
        $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $code);

        // 仅允许更新非商店来源的技能
        if ($skillEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_CANNOT_UPDATE, 'skill.store_skill_cannot_update');
        }

        // 更新 magic_skills 表
        $nameI18n = $requestDTO->getNameI18n();
        $descriptionI18n = $requestDTO->getDescriptionI18n();
        $sourceI18n = $requestDTO->getSourceI18n();
        $logo = $requestDTO->getLogo();

        // Do not update logo when omitted or null; clear it on empty string; normalize URL to storage path when provided.
        $logoPath = $logo === null ? null : EasyFileTools::formatPath($logo);

        $this->skillDomainService->updateSkillInfo(
            $dataIsolation,
            $skillEntity,
            $nameI18n,
            $descriptionI18n,
            $sourceI18n,
            $logoPath
        );
    }

    /**
     * 获取技能详情.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     * @return SkillDetailResponseDTO 技能详情响应 DTO
     */
    public function getSkillDetail(RequestContext $requestContext, string $code): SkillDetailResponseDTO
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = SkillDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 详情查看统一走共享可读判定；系统内置 Skill 会在断言方法中直接放行。
        $operation = $this->assertSkillReadable($dataIsolation, $code);

        // 优先读取 magic_skills；官方内置 Skill 没有主体记录时，回退到 magic_skill_versions。
        $dataIsolation->disabled();
        $latestVersionEntity = $this->skillVersionDomainService->findLatestSkillVersionByCode($dataIsolation, $code);

        $skillEntity = $this->skillDomainService->findOptionalSkillByCode($dataIsolation, $code);
        if ($skillEntity === null && $latestVersionEntity !== null) {
            $skillEntity = $this->buildExternalVisibleSkillFromVersion($latestVersionEntity);
        }
        if ($skillEntity === null) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND, 'skill.skill_not_found');
        }

        // Use the latest published version as the source of truth for creator metadata.
        // This keeps creator_info stable for shared and market-installed skills.
        $creatorUserMap = $latestVersionEntity !== null
            ? $this->buildCreatorUserMapFromSkillVersions($dataIsolation, [$latestVersionEntity])
            : $this->buildCreatorUserMapFromSkillEntities($dataIsolation, [$skillEntity]);
        $marketEntityMap = $this->skillMarketDomainService->findLatestPublishedBySkillCodes([$code]);

        $creatorId = $latestVersionEntity?->getCreatorId() ?? $skillEntity->getCreatorId();
        $creatorCreatedAt = $latestVersionEntity?->getCreatedAt() ?? $skillEntity->getCreatedAt();
        $skillFileUrl = $this->resolveSkillDetailFileUrl($authorization, $skillEntity, $latestVersionEntity);

        // 更新 logo URL（如果存储的是路径，需要转换为完整URL）
        $this->updateSkillLogoUrl($dataIsolation, [$skillEntity]);

        $publishType = PublishType::fromPublishTargetType($latestVersionEntity?->getPublishTargetType());
        $allowedPublishTargetTypes = $this->resolveAllowedPublishTargetTypes($dataIsolation, $publishType);
        $language = CoContext::getLanguage();

        return new SkillDetailResponseDTO(
            $skillEntity->getId(),
            $skillEntity->getCode(),
            $latestVersionEntity?->getId() ?? $skillEntity->getVersionId(),
            $latestVersionEntity?->getVersion() ?? $skillEntity->getVersionCode(),
            $skillEntity->getSourceType()->value,
            $skillEntity->getIsEnabled() ? 1 : 0,
            $skillEntity->getPinnedAt(),
            $skillEntity->getI18nName($language),
            $skillEntity->getI18nDescription($language),
            $skillEntity->getI18nSource($language),
            $skillEntity->getNameI18n(),
            $skillEntity->getDescriptionI18n() ?? [],
            $skillEntity->getSourceI18n() ?? [],
            $skillEntity->getLogo() ?? '',
            $skillEntity->getPackageName(),
            $skillEntity->getPackageDescription(),
            '',
            '',
            $skillEntity->getSourceId(),
            $skillEntity->getSourceMeta(),
            $skillEntity->getProjectId(),
            $skillEntity->getLatestPublishedAt(),
            $publishType?->value,
            $allowedPublishTargetTypes,
            $skillEntity->getCreatedAt() ?? '',
            $skillEntity->getUpdatedAt() ?? '',
            OperatorAssembler::createOperatorDTOByUserEntity(
                $creatorUserMap[$creatorId] ?? null,
                $creatorCreatedAt
            ),
            isset($marketEntityMap[$code]) ? $marketEntityMap[$code]->isFeatured() : false,
            $skillFileUrl,
            $operation?->toAlias()
        );
    }

    /**
     * 绑定技能项目.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     * @param int $projectId 项目ID
     */
    public function bindProject(RequestContext $requestContext, string $code, int $projectId): void
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = SkillDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        $this->assertSkillEditable($dataIsolation, $code);

        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $code);
        $projectEntity = $this->projectAppService->getProjectNotUserId($projectId);
        if (! $projectEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        if ($skillEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_CANNOT_UPDATE, 'skill.store_skill_cannot_update');
        }

        if ($projectEntity->getUserOrganizationCode() !== $skillEntity->getOrganizationCode()
            || $projectEntity->getUserId() !== $skillEntity->getCreatorId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_ACCESS_DENIED, 'project.project_access_denied');
        }

        $skillEntity->setProjectId($projectId);
        $this->skillDomainService->saveSkill($dataIsolation, $skillEntity);
    }

    /**
     * 发布一个 Skill 版本。
     *
     * 规则说明：
     * - `PRIVATE / MEMBER / ORGANIZATION` 属于组织内发布范围，新的发布会覆盖旧的组织内范围
     * - `MARKET` 只新增市场分发能力，不主动清理现有组织内可见范围
     */
    public function publishSkill(RequestContext $requestContext, string $code, PublishSkillRequestDTO $requestDTO): PublishSkillResultDTO
    {
        $authorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($authorization);

        // 发布属于写操作，必须具备 editor 以上权限
        $this->assertSkillEditable($dataIsolation, $code);

        // 权限断言通过后关闭组织过滤，协作者可读取非本人创建的 Skill 主体
        $dataIsolation->disabled();
        $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $code);

        Db::beginTransaction();
        try {
            $publishResult = $this->executePublishSkill($dataIsolation, $skillEntity, $code, $requestDTO);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }

        return $publishResult;
    }

    /** 创建异步 Skill 发布任务。 */
    public function createAsyncPublishSkill(RequestContext $requestContext, string $code, PublishSkillRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($authorization);
        $this->assertSkillEditable($dataIsolation, $code);
        $dataIsolation->disabled();
        $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $code);
        $fileKey = $this->resolveSkillFileKeyByProjectId($skillEntity->getProjectId());

        // 同一版本已有发布中任务时复用版本和任务状态，避免重复创建版本。
        $reusedVersion = null;
        $existingVersions = $this->skillVersionDomainService->queryVersionsByCode($dataIsolation, $code, null, null, Page::createNoPage(), includePublishing: true)['list'];
        foreach ($existingVersions as $existingVersion) {
            if ($existingVersion->getVersion() === $requestDTO->getVersion()
                && $existingVersion->getPublisherUserId() === $dataIsolation->getCurrentUserId()
                && $existingVersion->getPublishStatus()->isPublishing()
                && $existingVersion->getId() !== null
            ) {
                $existingTaskId = (string) $existingVersion->getId();
                $existingStatus = $this->publishAsyncStatusManager->get($existingTaskId);
                if ($existingStatus !== null && ($existingStatus['status'] ?? '') !== 'failed') {
                    return $existingStatus;
                }
                if ($existingStatus !== null) {
                    $this->publishAsyncStatusManager->update($existingTaskId, ['status' => 'processing', 'progress' => 0, 'file_key' => null, 'error' => null]);
                }
                $reusedVersion = $existingVersion;
                break;
            }
        }

        $versionEntity = $reusedVersion ?? new SkillVersionEntity();
        if ($reusedVersion === null) {
            $versionEntity->setVersion($requestDTO->getVersion());
            $versionEntity->setVersionDescriptionI18n($requestDTO->getVersionDescriptionI18n());
            $versionEntity->setPublishTargetType($requestDTO->getPublishTargetType());
            $versionEntity->setPublishTargetValue($requestDTO->toPublishTargetValue());
            $versionEntity->setCategoryIds($requestDTO->getPublishTargetType() === PublishTargetType::MARKET->value ? $requestDTO->getCategoryIds() : []);
            $versionEntity->setSkillFileKey($fileKey?->getFileKey());

            Db::beginTransaction();
            try {
                $versionEntity = $this->skillVersionDomainService->publishSkill($dataIsolation, $skillEntity, $versionEntity, true);
                if ($versionEntity->getId() !== null && $requestDTO->getPublishTargetType() === PublishTargetType::MARKET->value) {
                    $this->skillCategoryRelationDomainService->replaceVersionCategories($dataIsolation->getCurrentOrganizationCode(), $versionEntity->getId(), $versionEntity->getCategoryIds());
                }
                Db::commit();
            } catch (Throwable $e) {
                Db::rollBack();
                throw $e;
            }
        }

        $taskId = (string) ($versionEntity->getId() ?? IdGenerator::getUniqueId32());
        $taskKey = 'publish:skill:' . $taskId;
        $this->publishAsyncStatusManager->initialize($taskId, [
            'resource_type' => 'skill', 'resource_code' => $code,
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            'publisher_user_id' => $dataIsolation->getCurrentUserId(),
            'version_id' => $versionEntity->getId(), 'task_key' => $taskKey,
        ]);

        if (! $requestDTO->getExportFileFromProject()) {
            if (trim($skillEntity->getPackageName()) === '') {
                // 不导出项目文件时没有 metadata 可回填包名，空包名版本会阻断引用它的员工发布
                $this->publishAsyncStatusManager->update($taskId, ['status' => 'failed', 'error' => '技能缺少 package_name，请完善技能信息后重试']);
            } elseif (empty($skillEntity->getFileKey())) {
                $this->publishAsyncStatusManager->update($taskId, ['status' => 'failed', 'error' => '技能文件不存在']);
            } else {
                $version = $this->skillVersionDomainService->finalizePreparedSkill($dataIsolation, (int) $versionEntity->getId(), (string) $skillEntity->getFileKey());
                if ($version->getPublishStatus()->isPublished()) {
                    $this->syncPublishedSkillScope($dataIsolation, $skillEntity, $version);
                }
                $this->publishAsyncStatusManager->update($taskId, ['status' => 'ready', 'progress' => 100, 'file_key' => $skillEntity->getFileKey()]);
            }
            return $this->publishAsyncStatusManager->get($taskId) ?? ['publish_task_id' => $taskId, 'status' => 'processing'];
        }

        try {
            $projectId = $skillEntity->getProjectId();
            if (empty($projectId)) {
                throw new RuntimeException('技能项目不存在');
            }
            $project = $this->projectDomainService->getProjectNotUserId((int) $projectId);
            if (! $project) {
                throw new RuntimeException('技能项目不存在');
            }
            $skillConfig = $this->readSkillProjectConfig((int) $projectId, $project);
            $skillDirName = (string) ($skillConfig['skill']['dir'] ?? '');
            $skillDirPath = SkillProjectConfigUtil::SKILLS_ROOT_PATH . '/' . $skillDirName;
            $skillDirEntity = $this->taskFileDomainService->findDirectoryByPath((int) $projectId, $skillDirPath);
            if ($skillDirEntity === null) {
                throw new RuntimeException('技能目录不存在');
            }
            $sandboxId = $this->initializeSkillPublishSandbox($dataIsolation, $code, $project);
            $result = $this->skillDomainService->createSkillWorkspaceExportAsync(
                $dataIsolation,
                $code,
                $sandboxId,
                $skillDirPath,
                $skillDirName,
                $code . '_' . $taskId . '.zip',
                $taskKey,
                contactDataIsolation: $this->createContactDataIsolationByBase($dataIsolation)
            );
            $this->publishAsyncStatusManager->update($taskId, ['sandbox_id' => $sandboxId]);
            if (($result['status'] ?? '') === 'FAILED' || (($result['code'] ?? 1000) !== 1000 && ($result['code'] ?? -1) !== 4000)) {
                throw new RuntimeException((string) ($result['message'] ?? 'sandbox export failed'));
            }
        } catch (Throwable $e) {
            $this->logger->error('异步 Skill 发布失败', ['task_id' => $taskId, 'error' => $e->getMessage()]);
            $this->publishAsyncStatusManager->update($taskId, ['status' => 'failed', 'error' => '发布任务执行失败，请重新发起发布']);
        }
        return $this->publishAsyncStatusManager->get($taskId) ?? ['publish_task_id' => $taskId, 'status' => 'processing'];
    }

    /** 查询并推进异步 Skill 发布任务。 */
    public function checkAsyncPublishSkill(RequestContext $requestContext, string $code, string $taskId): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($authorization);
        $this->assertSkillEditable($dataIsolation, $code);
        $dataIsolation->disabled();
        $status = $this->publishAsyncStatusManager->get($taskId);
        if ($status === null) {
            $version = $this->skillVersionDomainService->findSkillVersionById($dataIsolation, (int) $taskId);
            if ($version !== null
                && $version->getCode() === $code
                && $version->getOrganizationCode() === $dataIsolation->getCurrentOrganizationCode()
                && $version->getPublisherUserId() === $dataIsolation->getCurrentUserId()
                && $version->getPublishStatus()->isPublished()
                && $version->getFileKey() !== null
            ) {
                return ['publish_task_id' => $taskId, 'status' => 'ready', 'progress' => 100, 'file_key' => $version->getFileKey()];
            }
        }
        if ($status === null || ($status['resource_type'] ?? '') !== 'skill' || ($status['resource_code'] ?? '') !== $code
            || ($status['organization_code'] ?? '') !== $dataIsolation->getCurrentOrganizationCode()
            || ($status['publisher_user_id'] ?? '') !== $dataIsolation->getCurrentUserId()) {
            return ['publish_task_id' => $taskId, 'status' => 'failed', 'error' => '发布任务不存在或已过期'];
        }
        if (in_array($status['status'] ?? '', ['ready', 'failed'], true)) {
            return $status;
        }
        if (empty($status['sandbox_id'])) {
            return $status;
        }
        try {
            $result = $this->skillDomainService->checkSkillWorkspaceExportAsync($dataIsolation, (string) ($status['sandbox_id'] ?? ''), (string) ($status['task_key'] ?? ('publish:skill:' . $taskId)), contactDataIsolation: $this->createContactDataIsolationByBase($dataIsolation));
            $sandboxStatus = strtoupper((string) ($result['status'] ?? ''));
            if (($result['code'] ?? 1000) === 4004 || $sandboxStatus === 'FAILED') {
                $this->publishAsyncStatusManager->update($taskId, ['status' => 'failed', 'error' => (string) ($result['message'] ?? 'sandbox export failed')]);
            } elseif (in_array($sandboxStatus, ['COMPLETED', 'SUCCESS'], true) && ($result['file_key'] ?? '') !== '') {
                Db::beginTransaction();
                try {
                    $packageName = (string) ($result['metadata']['package_name'] ?? '');
                    $version = $this->skillVersionDomainService->finalizePreparedSkill($dataIsolation, (int) $status['version_id'], (string) $result['file_key'], $packageName !== '' ? $packageName : null);
                    $skill = $this->skillDomainService->findSkillByCode($dataIsolation, $code);
                    if ($packageName !== '') {
                        $skill->setPackageName($packageName);
                    }
                    $skill->setFileKey((string) $result['file_key']);
                    $this->skillDomainService->saveSkill($dataIsolation, $skill);
                    if ($version->getPublishStatus()->isPublished()) {
                        $this->syncPublishedSkillScope($dataIsolation, $skill, $version);
                    }
                    Db::commit();
                } catch (Throwable $e) {
                    Db::rollBack();
                    throw $e;
                }
                $this->publishAsyncStatusManager->update($taskId, ['status' => 'ready', 'progress' => 100, 'file_key' => $result['file_key']]);
            } else {
                $this->publishAsyncStatusManager->update($taskId, ['progress' => (int) ($result['progress'] ?? $status['progress'] ?? 0)]);
            }
        } catch (Throwable $e) {
            $this->logger->error('异步 Skill 发布检查失败', ['task_id' => $taskId, 'error' => $e->getMessage()]);
            $this->publishAsyncStatusManager->update($taskId, ['status' => 'failed', 'error' => '发布任务检查失败，请重新发起发布']);
        }
        return $this->publishAsyncStatusManager->get($taskId) ?? $status;
    }

    /**
     * Query published version records.
     *
     * @return array{
     *     list: SkillVersionEntity[],
     *     page: int,
     *     page_size: int,
     *     total: int,
     *     user_map: array<string, MagicUserEntity>,
     *     member_department_map: array<string, MagicDepartmentEntity>,
     *     category_map: array<int, SkillCategoryEntity>
     * }
     */
    public function queryVersions(RequestContext $requestContext, string $code, QuerySkillVersionsRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($authorization);
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());

        // 版本查看属于只读操作，具有 read / editor / admin / owner 权限的协作者均可访问
        $this->assertSkillReadable($dataIsolation, $code);

        $publishTargetType = $requestDTO->getPublishTargetType() ? PublishTargetType::from($requestDTO->getPublishTargetType()) : null;
        $reviewStatus = $requestDTO->getStatus() ? ReviewStatus::from($requestDTO->getStatus()) : null;

        $result = $this->skillVersionDomainService->queryVersionsByCode(
            $dataIsolation,
            $code,
            $publishTargetType,
            $reviewStatus,
            $page
        );

        /** @var SkillVersionEntity[] $versions */
        $versions = $result['list'];
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        [$userMap, $memberDepartmentMap] = $this->batchLoadSkillVersionRelatedEntities(
            $organizationCode,
            $versions
        );
        $categoryMap = $this->loadSkillCategoryMap($versions);

        return [
            'list' => $versions,
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
            'total' => $result['total'],
            'user_map' => $userMap,
            'member_department_map' => $memberDepartmentMap,
            'category_map' => $categoryMap,
        ];
    }

    /**
     * 获取发布版本接口的表单预填：版本号为当前版本记录数 + 1 的主版本，描述为当前 Skill 描述（与 POST publish 请求体字段对齐）.
     */
    public function getPublishPrefill(RequestContext $requestContext, string $code): SkillPublishPrefillResponseDTO
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($authorization);

        // 预填信息与发布接口共享权限语义，均要求 editor 以上权限
        $this->assertSkillEditable($dataIsolation, $code);

        // 权限断言通过后关闭组织过滤，协作者可读取非本人创建的 Skill 主体
        $dataIsolation->disabled();
        $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $code);

        $descriptionI18n = $skillEntity->getDescriptionI18n();
        $versionDescriptionI18n = is_array($descriptionI18n) ? $descriptionI18n : [];

        $latestVersion = $this->skillVersionDomainService->findLatestSkillVersionByCode($dataIsolation, $code);
        $version = $this->skillVersionDomainService->getNextAvailableVersion(
            $dataIsolation,
            $code,
            $latestVersion?->getVersion(),
        );
        if ($latestVersion !== null) {
            $publishTargetType = $latestVersion->getPublishTargetType()->value;
            $publishTargetValue = $latestVersion->getPublishTargetType()->requiresTargetValue()
                ? $latestVersion->getPublishTargetValue()?->toArray()
                : null;
        } else {
            $publishTargetType = null;
            $publishTargetValue = null;
        }

        $latestMarketVersion = $this->skillVersionDomainService->findLatestMarketSkillVersionByCode($dataIsolation, $code);
        $categoryIds = $latestMarketVersion?->getId() === null
            ? []
            : $this->skillCategoryRelationDomainService->getVersionCategoryIds($latestMarketVersion->getId());

        return new SkillPublishPrefillResponseDTO(
            version: $version,
            description: $skillEntity->getI18nDescription(CoContext::getLanguage()),
            versionDescriptionI18n: $versionDescriptionI18n,
            publishTargetType: $publishTargetType,
            publishTargetValue: $publishTargetValue,
            exportFileFromProject: true,
            categoryIds: $categoryIds,
        );
    }

    /**
     * 下架技能版本（下架所有已发布的版本）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $code Skill code
     */
    public function offlineSkill(RequestContext $requestContext, string $code): void
    {
        $authorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($authorization);

        // 下架属于写操作，必须具备 editor 以上权限
        $this->assertSkillEditable($dataIsolation, $code);

        // 权限断言通过后关闭组织过滤，供领域服务在协作场景下读取 Skill 主体
        $dataIsolation->disabled();

        // 调用领域服务处理业务逻辑
        $this->skillVersionDomainService->offlineSkill($dataIsolation, $code);

        $market = $this->skillMarketDomainService->findStoreSkillBySkillCode($code);
        if ($market !== null && $market->getId() !== null) {
            AsyncEventUtil::dispatch(new SkillMarketOfflineEvent(
                (string) $market->getId(),
                $market->getOrganizationCode(),
                $dataIsolation->getCurrentUserId(),
            ));
        }
    }

    /**
     * 根据 Skill ID 列表批量获取文件 key 及下载地址。
     *
     * 支持团队协作模型：返回当前用户具备读取权限的技能（自建、协作共享、市场安装均包含）。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param GetSkillFileUrlsRequestDTO $requestDTO 请求 DTO
     * @return SkillFileUrlItemDTO[] Skill 文件 URL 列表
     */
    public function getSkillFileUrlsByIds(
        RequestContext $requestContext,
        GetSkillFileUrlsRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $skillIds = $requestDTO->getSkillIdsAsInt();

        // 获取当前用户可访问的 Skill code 集合（自建 + 协作共享 + 市场安装 + 内置）
        $accessibleCodes = $this->getAccessibleSkillCodes($dataIsolation);
        $accessibleCodeIndex = array_flip($accessibleCodes);

        // 关闭组织过滤，直接按 ID 批量读取；权限过滤在应用层完成
        $dataIsolation->disabled();
        $skillEntities = $this->skillDomainService->findUserSkillsByIds($dataIsolation, $skillIds);

        // 仅保留当前用户具备访问权限的技能，避免越权获取他人文件地址
        $accessibleEntities = array_filter(
            $skillEntities,
            fn (SkillEntity $entity) => isset($accessibleCodeIndex[$entity->getCode()])
        );

        if (empty($accessibleEntities)) {
            return [];
        }

        // 将 file_key 转换为带签名的下载地址
        $this->updateSkillFileUrl($dataIsolation, $accessibleEntities);

        $dispatchedSkillCodes = [];
        foreach ($accessibleEntities as $entity) {
            $skillCode = $entity->getCode();
            if (isset($dispatchedSkillCodes[$skillCode])) {
                continue;
            }
            AsyncEventUtil::dispatch(new SkillUsedEvent(
                organizationCode: $userAuthorization->getOrganizationCode(),
                sourceId: SourceId::SUPER_MAGIC_TOOL,
                callTime: (int) round(microtime(true) * 1000),
                userId: $userAuthorization->getId(),
                userName: $userAuthorization->getRealName(),
                requestId: CoContext::getRequestId(),
                skillCode: $skillCode,
            ));
            $dispatchedSkillCodes[$skillCode] = true;
        }

        return array_values(array_map(
            fn (SkillEntity $entity) => new SkillFileUrlItemDTO(
                id: $entity->getId() ?? 0,
                fileKey: $entity->getFileKey(),
                fileUrl: $entity->getFileUrl(),
                sourceType: $entity->getSourceType()->value
            ),
            $accessibleEntities
        ));
    }

    /**
     * Query latest published current versions for accessible skills by codes.
     *
     * @return array{list: SkillVersionEntity[], total: int, page: int, page_size: int}
     */
    public function getLatestPublishedSkillVersions(
        RequestContext $requestContext,
        GetLatestPublishedSkillVersionsRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);
        $filterCodes = $requestDTO->getCodes() ?? [];

        $requestedCodes = array_values(array_unique(array_filter($filterCodes)));

        $accessibleSkillCodes = $this->getAccessibleSkillCodes($dataIsolation);
        if ($requestDTO->agentCode !== null && $requestDTO->agentCode !== '') {
            $boundCodes = $this->agentAppService->getDownloadableBoundSkillCodes(
                $userAuthorization,
                $requestDTO->agentCode,
                $requestDTO->agentDraft
            );
            $accessibleSkillCodes = array_values(array_unique(array_merge($accessibleSkillCodes, $boundCodes)));
        }

        if ($requestedCodes) {
            $accessibleSkillCodes = array_values(array_intersect($requestedCodes, $accessibleSkillCodes));
        }

        if ($accessibleSkillCodes === []) {
            return [
                'list' => [],
                'total' => 0,
                'page' => $requestDTO->getPage(),
                'page_size' => $requestDTO->getPageSize(),
            ];
        }

        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());
        $dataIsolation->disabled();
        $result = $this->skillVersionDomainService->queryCurrentPublishedVersionsByCodes(
            $dataIsolation,
            $accessibleSkillCodes,
            $requestDTO->getKeyword(),
            $page
        );

        $this->updateSkillVersionAssetUrls($dataIsolation, $result['list']);
        $dispatchedSkillCodes = [];
        foreach ($result['list'] as $version) {
            $skillCode = $version->getCode();
            if (isset($dispatchedSkillCodes[$skillCode])) {
                continue;
            }
            AsyncEventUtil::dispatch(new SkillUsedEvent(
                organizationCode: $userAuthorization->getOrganizationCode(),
                sourceId: SourceId::SUPER_MAGIC_TOOL,
                callTime: (int) round(microtime(true) * 1000),
                userId: $userAuthorization->getId(),
                userName: $userAuthorization->getRealName(),
                requestId: CoContext::getRequestId(),
                skillCode: $skillCode,
            ));
            $dispatchedSkillCodes[$skillCode] = true;
        }

        return [
            'list' => $result['list'],
            'total' => $result['total'],
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
        ];
    }

    /**
     * Agent 第三方导入技能（一步完成：上传、校验、解压、上传到私有桶、创建或更新）.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 导入结果，包含 id 和 skill_code
     */
    public function importSkillFromAgent(RequestContext $requestContext, string $tempFile, SkillSourceType $skillSource, ?array $nameI18n = null, ?array $descriptionI18n = null): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $tempFilePath = $tempFile;

        $fileKey = null;
        $lockOwner = $lockKey = '';

        try {
            // 解析压缩包并提取 Skill 元数据。
            $package = $this->skillPackageParser->parseFile($tempFilePath, $tempFilePath);
            $packageName = $package->packageName;
            $packageDescription = $package->packageDescription;

            $lockKey = sprintf(self::LOCK_KEY_FORMAT, $userId, $organizationCode, $packageName);
            // 获取同名导入锁，避免重复创建或更新。
            $lockOwner = $this->acquireImportLock($lockKey);

            $dataIsolation = $this->createSkillDataIsolation($userAuthorization);
            $existingSkillEntity = $this->skillDomainService->findSkillByPackageNameAndCreator($dataIsolation, $packageName);

            $skillCode = $existingSkillEntity ? $existingSkillEntity->getCode() : SkillEntity::generateNewCode();

            $fileKey = $this->uploadFileToPrivateStorage($organizationCode, $tempFilePath, $skillCode);

            // 保存上传文件对应的 Skill 数据。
            Db::beginTransaction();
            try {
                $result = $this->saveAgentImportedSkill(
                    $dataIsolation,
                    $existingSkillEntity,
                    $userId,
                    $organizationCode,
                    $packageName,
                    $packageDescription,
                    $fileKey,
                    $skillCode,
                    $skillSource,
                    $nameI18n,
                    $descriptionI18n
                );

                Db::commit();
            } catch (Throwable $e) {
                Db::rollBack();
                throw $e;
            }

            // 导入成功后异步通知下游刷新 Skill 数据。
            try {
                AsyncEventUtil::dispatch(new SkillImportedEvent($userAuthorization, $result->getCode()));
            } catch (Throwable $eventException) {
                $this->logger->error('Dispatch SkillImportedEvent failed', [
                    'skill_code' => $result->getCode(),
                    'error' => $eventException->getMessage(),
                ]);
            }

            return [
                'id' => (string) $result->getId(),
                'code' => $result->getCode(),
                'name' => $result->getNameI18n(),
                'description' => $result->getDescriptionI18n(),
                'is_create' => $existingSkillEntity ? false : true,
            ];
        } finally {
            $this->releaseImportLock($lockKey, $lockOwner);
            // 无论导入成功与否，都清理本地临时文件。
            if ($tempFilePath && file_exists($tempFilePath)) {
                @unlink($tempFilePath);
            }
        }
    }

    /**
     * 校验当前用户是否对 Skill 具备编辑权限。
     */
    protected function assertSkillEditable(SkillDataIsolation $dataIsolation, string $code): void
    {
        // Skill 写操作统一收口到共享策略层，避免继续固化 owner-only 语义。
        $this->resourceAccessPolicyService->assertEditable(
            $dataIsolation,
            OperationPermissionResourceType::Skill,
            $code
        );
    }

    /**
     * 获取用户可访问的技能代码。
     * @return array<string>
     */
    protected function getAccessibleSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        /** @var array<string> $skillCodes */
        $skillCodes = $this->resourceAccessPolicyService->getReadableResourceCodes(
            $dataIsolation,
            OperationPermissionResourceType::Skill,
            ResourceVisibilityResourceType::SKILL
        )['all_codes'] ?? [];

        return $this->mergeBuiltinSkillCodes($skillCodes);
    }

    /**
     * 获取市场已安装的技能代码。
     * @return array<string>
     */
    protected function getMarketInstalledSkillCodes(SkillDataIsolation $dataIsolation): array
    {
        $marketInstalledCodes = $this->skillDomainService->findCurrentUserSkillCodesBySourceType(
            $dataIsolation,
            SkillSourceType::MARKET
        );

        return $this->mergeBuiltinSkillCodes($marketInstalledCodes);
    }

    /**
     * 合并系统技能代码。
     * @param array<string> $skillCodes
     * @param null|array<string> $resourceCode
     * @return array<string>
     */
    protected function mergeBuiltinSkillCodes(array $skillCodes, ?array $resourceCode = null): array
    {
        $builtinSkillCodes = $this->skillMarketDomainService->getOfficialBuiltinSkillCodes();
        if ($resourceCode !== null) {
            $builtinSkillCodes = array_values(array_intersect($builtinSkillCodes, $resourceCode));
        }

        return array_values(array_unique(array_merge($skillCodes, $builtinSkillCodes)));
    }

    /** Keep identity preparation outside transactions and resource binding inside the project owner's transaction. */
    private function createSkillProject(RequestContext $context, string $name, string $code, bool $setDefaultTopic, ?Closure $createDraft = null): array
    {
        $isolation = $this->createSkillDataIsolation($context->getUserAuthorization());
        $key = 'skill:bind:' . $code;
        $owner = $this->acquireImportLock($key);
        try {
            $skill = $this->skillDomainService->findOptionalSkillByCode($isolation, $code);
            if ($skill !== null) {
                $this->assertSkillEditable($isolation, $code);
                $skill = $this->skillDomainService->findUserSkillByCode($isolation, $code);
                if ($skill->getProjectId()) {
                    return ['project' => ['id' => (string) $skill->getProjectId()]];
                }
            } elseif ($createDraft === null) {
                ExceptionBuilder::throw(SkillErrorCode::SKILL_NOT_FOUND);
            }
            $dto = new CreateAgentProjectRequestDTO();
            $dto->setProjectName($name);
            $dto->setInitTemplateFiles(false);
            return $this->projectAppService->createAgentProject(
                $context,
                $dto,
                ProjectMode::SKILL_CREATOR,
                $setDefaultTopic,
                function (ProjectEntity $project) use ($context, $isolation, $code, $createDraft): void {
                    $createDraft?->__invoke();
                    $this->assertSkillEditable($isolation, $code);
                    $this->skillDomainService->lockSkill($isolation, $code);
                    $skill = $this->skillDomainService->findUserSkillByCode($isolation, $code);
                    if ($skill->getProjectId()) {
                        ExceptionBuilder::throw(SkillErrorCode::PROJECT_BINDING_CONFLICT);
                    }
                    $this->bindProject($context, $code, $project->getId());
                }
            );
        } finally {
            $this->releaseImportLock($key, $owner);
        }
    }

    private function advanceSkillPreparation(RequestContext $context, string $code, string $token): array
    {
        $record = $this->readSkillPreparation($context, $code, $token);
        if ($record['status'] !== 'processing' || empty($record['sandbox_id'])) {
            return $record;
        }
        $isolation = $this->createSkillDataIsolation($context->getUserAuthorization());
        $result = $this->skillDomainService->checkSkillWorkspaceExportAsync($isolation, $record['sandbox_id'], $record['task_key'], contactDataIsolation: $this->createContactDataIsolationByBase($isolation));
        $status = strtoupper((string) ($result['status'] ?? ''));
        if ($status === 'FAILED' || ($result['code'] ?? 1000) === 4004) {
            $record['status'] = 'failed';
        } elseif (in_array($status, ['SUCCESS', 'COMPLETED'], true) && ! empty($result['file_key'])) {
            $package = $this->skillPackageParser->parseByFileKey($record['organization_code'], $result['file_key'], true);
            $record['file_key'] = $result['file_key'];
            $record['package_name'] = $package->packageName;
            $record['package_description'] = $package->packageDescription;
            $record['manifest'] = $package->manifest;
            $record['package_sha256'] = $package->sha256;
            if ($package->manifest !== $this->skillProjectManifest((int) $record['project_id'], $record['skill_dir'])) {
                ExceptionBuilder::throw(SkillErrorCode::PUBLISH_PREPARATION_STALE);
            }
            // A separate immutable object, extracted from the very same ZIP being confirmed.
            $snapshot = new SkillVersionEntity();
            $snapshot->setId((int) IdGenerator::getSnowId());
            $snapshot->setCode($code);
            $snapshot->setOrganizationCode($record['organization_code']);
            $snapshot->setFileKey($record['file_key']);
            $record['skill_file_key'] = $this->uploadSkillFileFromPackage($snapshot);
            $record['status'] = 'ready';
        }
        $this->writeSkillPreparation($token, $record);
        return $record;
    }

    private function skillPublishReceipt(SkillVersionEntity $version): array
    {
        return [
            'skill_code' => $version->getCode(), 'project_id' => (string) $version->getProjectId(),
            'version_id' => (string) $version->getId(), 'version' => $version->getVersion(),
            'publish_status' => $version->getPublishStatus()->value, 'review_status' => $version->getReviewStatus()->value,
            'publish_target_type' => $version->getPublishTargetType()->value,
            'status' => match (true) {
                $version->getPublishStatus()->isPublished() => 'published',
                $version->getPublishStatus() === PublishStatus::OFFLINE => 'offline',
                default => strtolower($version->getReviewStatus()->value),
            },
        ];
    }

    private function readSkillPreparation(RequestContext $context, string $code, string $token): array
    {
        $isolation = $this->createSkillDataIsolation($context->getUserAuthorization());
        $this->assertSkillEditable($isolation, $code);
        $raw = $this->redis->get('skill:prepare:' . $token);
        $record = is_string($raw) ? Json::decode($raw) : null;
        if (! is_array($record) || ($record['skill_code'] ?? '') !== $code
            || ($record['organization_code'] ?? '') !== $isolation->getCurrentOrganizationCode()
            || ($record['user_id'] ?? '') !== $isolation->getCurrentUserId()
            || ($record['expires_at'] ?? 0) < time()) {
            ExceptionBuilder::throw(SkillErrorCode::PUBLISH_PREPARATION_STALE);
        }
        return $record;
    }

    private function writeSkillPreparation(string $token, array $record): void
    {
        // Confirmation must fail closed when Redis is unavailable; the legacy progress cache is best effort.
        if (! $this->redis->setex('skill:prepare:' . $token, max(1, $record['expires_at'] - time()), Json::encode($record))) {
            throw new RuntimeException('Could not persist skill preparation');
        }
    }

    /** Hash actual cloud bytes, not project timestamps or mutable object keys. */
    private function skillProjectManifest(int $projectId, string $expectedDir): array
    {
        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if ($project === null || $this->readSkillProjectConfig($projectId, $project)['skill']['dir'] !== $expectedDir) {
            ExceptionBuilder::throw(SkillErrorCode::PUBLISH_PREPARATION_STALE);
        }
        $directory = $this->taskFileDomainService->findDirectoryByPath($projectId, SkillProjectConfigUtil::SKILLS_ROOT_PATH . '/' . $expectedDir);
        if ($directory === null) {
            ExceptionBuilder::throw(SkillErrorCode::PUBLISH_PREPARATION_STALE);
        }
        $files = $this->taskFileDomainService->findFilesRecursivelyByParentId($projectId, $directory->getFileId());
        $byId = [$directory->getFileId() => $directory];
        foreach ($files as $file) {
            $byId[$file->getFileId()] = $file;
        }
        $tempDir = self::TEMP_DIR_BASE . 'manifest_' . IdGenerator::getUniqueId32();
        mkdir($tempDir, 0700, true);
        $manifest = [];
        try {
            foreach ($files as $file) {
                if ($file->getIsDirectory()) {
                    continue;
                }
                $path = $this->buildRelativePathFromSkillDir($file, $directory->getFileId(), $byId);
                $local = $tempDir . '/content';
                $this->fileDomainService->downloadByChunks($project->getUserOrganizationCode(), $file->getFileKey(), $local, StorageBucketType::SandBox);
                $manifest[$path] = hash_file('sha256', $local);
                unlink($local);
            }
            ksort($manifest);
            return $manifest;
        } finally {
            $this->removeDirectory($tempDir);
        }
    }

    /**
     * 查询按权限集合筛选的共享技能。
     *
     * @param array{codes: array<string>, operations: array<string, Operation>} $skillCodeResult
     * @return array<string, mixed>
     */
    private function buildSharedSkillListResult(
        SkillDataIsolation $dataIsolation,
        SkillQuery $query,
        Page $page,
        array $skillCodeResult,
        bool $usePublishedSnapshotForOperations = false
    ): array {
        $sharedSkillCodes = $skillCodeResult['codes'];
        $skillOperations = $skillCodeResult['operations'];

        if ($sharedSkillCodes === []) {
            return [
                'list' => [],
                'total' => 0,
                'creator_user_map' => [],
                'latest_version_map' => [],
                'skill_operations' => [],
            ];
        }

        $result = $this->skillDomainService->queriesSharedByCodes($dataIsolation, $sharedSkillCodes, $query, $page);
        if ($result['list'] === []) {
            return [
                'list' => [],
                'total' => $result['total'],
                'creator_user_map' => [],
                'latest_version_map' => [],
                'skill_operations' => [],
            ];
        }

        $sharedSkillEntities = $result['list'];
        $resultCodes = array_values(array_unique(array_map(
            static fn (SkillEntity $skillEntity): string => $skillEntity->getCode(),
            $sharedSkillEntities
        )));
        $publishedVersionMap = $this->skillVersionDomainService->findCurrentPublishedVersionsByCodes($dataIsolation, $resultCodes);

        foreach ($sharedSkillEntities as $index => $sharedSkillEntity) {
            $skillCode = $sharedSkillEntity->getCode();
            if (isset($skillOperations[$skillCode]) && ! $usePublishedSnapshotForOperations) {
                unset($publishedVersionMap[$skillCode]);
                continue;
            }
            $publishedVersionEntity = $publishedVersionMap[$skillCode] ?? null;
            if ($publishedVersionEntity) {
                $sharedSkillEntities[$index] = $this->buildExternalVisibleSkillFromVersion($publishedVersionEntity);
                if (isset($skillOperations[$skillCode])) {
                    unset($publishedVersionMap[$skillCode]);
                }
            }
        }

        $this->updateSkillLogoUrl($dataIsolation, $sharedSkillEntities);

        return [
            'list' => $sharedSkillEntities,
            'total' => $result['total'],
            'creator_user_map' => $this->buildCreatorUserMapFromSkillEntities($dataIsolation, $sharedSkillEntities),
            'latest_version_map' => $publishedVersionMap,
            'skill_operations' => $skillOperations,
        ];
    }

    /**
     * 保存确认导入的 Skill，并处理 Crew 来源的自动发布.
     */
    private function saveConfirmedSkillImport(
        SkillDataIsolation $dataIsolation,
        ?string $skillCode,
        string $packageName,
        string $packageDescription,
        string $fileKey,
        SkillSourceType $sourceType,
        string $userId,
        string $organizationCode,
        ImportSkillRequestDTO $requestDTO
    ): SkillEntity {
        // Token 中有旧编码时更新原 Skill，否则创建新 Skill。
        $existingSkillEntity = empty($skillCode)
            ? null
            : $this->skillDomainService->findUserSkillByCode($dataIsolation, $skillCode);

        if ($existingSkillEntity !== null) {
            $skillEntity = $this->updateSkillInternal(
                $dataIsolation,
                $existingSkillEntity,
                $packageName,
                $packageDescription,
                $fileKey,
                $requestDTO->getNameI18n(),
                $requestDTO->getDescriptionI18n(),
                $requestDTO->getLogo()
            );
        } else {
            $skillEntity = $this->createSkillInternal(
                $dataIsolation,
                $userId,
                $organizationCode,
                $packageName,
                $packageDescription,
                $fileKey,
                SkillEntity::generateNewCode(),
                $sourceType,
                $requestDTO->getNameI18n(),
                $requestDTO->getDescriptionI18n(),
                $requestDTO->getLogo()
            );
        }

        // Crew 导入需要在保存后自动发布。
        if ($sourceType === SkillSourceType::CREW_IMPORT) {
            $this->publishImportedCrewSkill($dataIsolation, $skillEntity);
        }

        return $skillEntity;
    }

    /**
     * 保存 Agent 导入的 Skill.
     */
    private function saveAgentImportedSkill(
        SkillDataIsolation $dataIsolation,
        ?SkillEntity $existingSkillEntity,
        string $userId,
        string $organizationCode,
        string $packageName,
        string $packageDescription,
        string $fileKey,
        string $skillCode,
        SkillSourceType $skillSource,
        ?array $nameI18n,
        ?array $descriptionI18n
    ): SkillEntity {
        // Agent 导入按包名复用已有 Skill，避免重复创建。
        if ($existingSkillEntity !== null) {
            return $this->updateSkillInternal(
                $dataIsolation,
                $existingSkillEntity,
                $packageName,
                $packageDescription,
                $fileKey,
                $nameI18n,
                $descriptionI18n
            );
        }

        $skillEntity = $this->createSkillInternal(
            $dataIsolation,
            $userId,
            $organizationCode,
            $packageName,
            $packageDescription,
            $fileKey,
            $skillCode,
            $skillSource,
            $nameI18n,
            $descriptionI18n
        );

        // Crew 来源的 Agent 导入保存后自动发布。
        if ($skillSource === SkillSourceType::CREW_IMPORT) {
            $this->publishImportedCrewSkill($dataIsolation, $skillEntity);
        }

        return $skillEntity;
    }

    /**
     * @param SkillVersionEntity[] $versions
     * @return array<int, SkillCategoryEntity>
     */
    private function loadSkillCategoryMap(array $versions): array
    {
        $versionIds = array_values(array_filter(array_map(
            static fn (SkillVersionEntity $version): ?int => $version->getId(),
            $versions
        )));
        if ($versionIds === []) {
            return [];
        }

        $categoryIdsMap = $this->skillCategoryRelationDomainService->getVersionCategoryIdsMap($versionIds);
        $categoryIds = array_values(array_unique(array_merge(...array_values($categoryIdsMap) ?: [[]])));
        if ($categoryIds === []) {
            return [];
        }

        $categoryMap = [];
        foreach ($this->skillCategoryDomainService->findByIds($categoryIds) as $category) {
            if ($category->getId() !== null) {
                $categoryMap[$category->getId()] = $category;
            }
        }

        foreach ($versions as $version) {
            $version->setCategoryIds($categoryIdsMap[$version->getId() ?? 0] ?? []);
        }

        return $categoryMap;
    }

    /**
     * @param array<int, SkillMarketEntity> $skillMarketEntities
     * @return array<string, MagicUserEntity>
     */
    private function buildPublisherUserMapFromSkillMarkets(
        SkillDataIsolation $dataIsolation,
        array $skillMarketEntities
    ): array {
        $publisherIds = [];
        foreach ($skillMarketEntities as $skillMarketEntity) {
            if ($skillMarketEntity->getPublisherType() !== PublisherType::OFFICIAL) {
                $publisherIds[] = $skillMarketEntity->getPublisherId();
            }
        }

        $publisherIds = array_values(array_unique($publisherIds));
        if ($publisherIds === []) {
            return [];
        }

        $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization($publisherIds);
        $this->updateUserAvatarUrl($dataIsolation, $userEntities);

        $publisherUserMap = [];
        foreach ($userEntities as $userEntity) {
            $publisherUserMap[$userEntity->getUserId()] = $userEntity;
        }

        return $publisherUserMap;
    }

    /**
     * @return string[]
     */
    private function resolveAllowedPublishTargetTypes(
        SkillDataIsolation $dataIsolation,
        ?PublishType $publishType
    ): array {
        if ($publishType === null) {
            return [];
        }

        if ($publishType === PublishType::MARKET) {
            return [];
        }

        $organizationType = $dataIsolation->getOrganizationInfoManager()->getOrganizationType();
        if ($organizationType === OrganizationType::Personal) {
            return [PublishTargetType::PRIVATE->value];
        }

        return $publishType->getAllowedPublishTargetTypeValues();
    }

    /**
     * 处理已存在技能的场景.
     *
     * @param SkillEntity $skillEntity 已存在的技能实体
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $importToken import_token
     * @param string $packageName 包名
     * @param string $packageDescription 包描述
     */
    private function handleExistingSkillParse(
        SkillEntity $skillEntity,
        SkillDataIsolation $dataIsolation,
        string $importToken,
        string $packageName,
        string $packageDescription
    ): ParseFileImportResponseDTO {
        // 新建场景：AI 生成多语言内容
        [$nameI18n, $descriptionI18n] = $this->generateI18nContent($packageName, $packageDescription);

        // 更新 logo URL（如果存储的是路径，需要转换为完整URL）
        $this->updateSkillLogoUrl($dataIsolation, [$skillEntity]);
        $logo = $skillEntity->getLogo() ?? '';

        return new ParseFileImportResponseDTO(
            importToken: $importToken,
            packageName: $packageName,
            packageDescription: $packageDescription,
            isUpdate: true,
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            logo: $logo,
            skillCode: $skillEntity->getCode(),
            skillId: $skillEntity->getId()
        );
    }

    /**
     * 处理新建技能的场景.
     *
     * @param string $importToken import_token
     * @param string $packageName 包名
     * @param string $packageDescription 包描述
     */
    private function handleNewSkillParse(
        string $importToken,
        string $packageName,
        string $packageDescription
    ): ParseFileImportResponseDTO {
        // 新建场景：AI 生成多语言内容
        [$nameI18n, $descriptionI18n] = $this->generateI18nContent($packageName, $packageDescription);

        return new ParseFileImportResponseDTO(
            importToken: $importToken,
            packageName: $packageName,
            packageDescription: $packageDescription,
            isUpdate: false,
            nameI18n: $nameI18n,
            descriptionI18n: $descriptionI18n,
            logo: '',
            skillCode: null,
            skillId: null
        );
    }

    /**
     * 使用 ZIP 中解析出的技能名称和描述生成默认语言内容.
     *
     * @return array [nameI18n, descriptionI18n]
     */
    private function generateI18nContent(string $packageName, string $packageDescription): array
    {
        return [
            [LanguageEnum::DEFAULT->value => $packageName],
            [LanguageEnum::DEFAULT->value => $packageDescription],
        ];
    }

    /**
     * Export skill files from project by delegating packaging to the active sandbox.
     *
     * @return array{file_key: string, metadata: array, sandbox_id: string}
     */
    private function exportSkillFromProjectViaSandbox(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        string $code
    ): array {
        $projectId = $skillEntity->getProjectId();
        if (empty($projectId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        $project = $this->projectDomainService->getProjectNotUserId((int) $projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        $skillConfig = $this->readSkillProjectConfig((int) $projectId, $project);
        $skillDirName = (string) ($skillConfig['skill']['dir'] ?? '');
        $skillDirPath = SkillProjectConfigUtil::SKILLS_ROOT_PATH . '/' . $skillDirName;

        $skillDirEntity = $this->taskFileDomainService->findDirectoryByPath((int) $projectId, $skillDirPath);
        if ($skillDirEntity === null) {
            ExceptionBuilder::throw(SkillErrorCode::EXTRACTED_DIRECTORY_NOT_FOUND, 'skill.extracted_directory_not_found');
        }

        $allFiles = $this->taskFileDomainService->findFilesRecursivelyByParentId(
            (int) $projectId,
            $skillDirEntity->getFileId()
        );

        $hasSkillMd = false;
        foreach ($allFiles as $file) {
            if (! $file->getIsDirectory() && $file->getFileName() === self::SKILL_FILE_NAME) {
                $hasSkillMd = true;
                break;
            }
        }
        if (! $hasSkillMd) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_MD_NOT_FOUND, 'skill.skill_md_not_found');
        }

        $sandboxId = $this->initializeSkillPublishSandbox($dataIsolation, $code, $project);
        $contactDataIsolation = $this->createContactDataIsolationByBase($dataIsolation);
        $fileMetadata = $this->skillDomainService->exportSkillFromSandbox(
            $dataIsolation,
            $code,
            $sandboxId,
            $skillDirPath,
            $skillDirName,
            $skillDirName . '.zip',
            $contactDataIsolation
        );

        $metadata = $fileMetadata['metadata'] ?? [];
        if (! isset($metadata['package_name']) || $metadata['package_name'] === '') {
            $metadata['package_name'] = $skillDirName;
        }
        if (! isset($metadata['skill_dir']) || $metadata['skill_dir'] === '') {
            $metadata['skill_dir'] = $skillDirName;
        }
        if (! isset($metadata['files_count'])) {
            $metadata['files_count'] = count($allFiles);
        }

        return [
            'file_key' => (string) ($fileMetadata['file_key'] ?? ''),
            'metadata' => $metadata,
            'sandbox_id' => $sandboxId,
        ];
    }

    private function initializeSkillPublishSandbox(
        SkillDataIsolation $dataIsolation,
        string $skillCode,
        ProjectEntity $projectEntity
    ): string {
        $topicId = $projectEntity->getCurrentTopicId();
        if (empty($topicId)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if ($topicEntity === null || $topicEntity->getProjectId() !== $projectEntity->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        $contactDataIsolation = $this->createContactDataIsolationByBase($dataIsolation);

        $sandboxId = $topicEntity->getSandboxId();
        if ($sandboxId === (string) $topicEntity->getId()) {
            $sandboxId = '';
        }
        $topicEntity->setSandboxId($sandboxId);

        $taskEntity = $this->taskDomainService->initDefaultTask(
            $contactDataIsolation,
            $topicEntity,
            self::SKILL_PUBLISH_EXPORT_TASK_PROMPT
        );

        $agentContext = $this->agentDomainService->buildInitAgentContext(
            dataIsolation: $contactDataIsolation,
            projectEntity: $projectEntity,
            topicEntity: $topicEntity,
            taskEntity: $taskEntity,
            sandboxId: $sandboxId,
            skipInitMessage: true
        );
        $sandboxId = $this->agentDomainService->ensureSandboxInitialized(
            $contactDataIsolation,
            $agentContext,
            // Skill 工具执行场景，不挂载 .topic 话题目录，只挂 project/user 空间
            new SandboxRootFileIds(
                (string) $this->taskFileDomainService->getProjectRootFileId($projectEntity->getId()),
                (string) $this->taskFileDomainService->findOrCreateUserRootDirectory($contactDataIsolation->getCurrentUserId(), $contactDataIsolation->getCurrentOrganizationCode())
            )
        );

        $this->topicDomainService->updateTopicStatusAndSandboxId(
            $topicEntity->getId(),
            $taskEntity->getId(),
            TaskStatus::FINISHED,
            $sandboxId
        );
        $this->taskDomainService->updateTaskStatus(
            TaskStatus::FINISHED,
            $taskEntity->getId(),
            (string) $taskEntity->getId(),
            $sandboxId
        );

        $this->logger->info('Skill publish sandbox initialized through sandbox pool', [
            'skill_code' => $skillCode,
            'project_id' => $projectEntity->getId(),
            'topic_id' => $topicEntity->getId(),
            'task_id' => $taskEntity->getId(),
            'sandbox_id' => $sandboxId,
        ]);

        return $sandboxId;
    }

    /**
     * Export skill files from project by querying the file table and packaging locally.
     * Kept as a local fallback for rollback or emergency diagnostics; publish currently
     * uses exportSkillFromProjectViaSandbox().
     *
     * @deprecated use exportSkillFromProjectViaSandbox() for normal publish flow
     * @return array{file_key: string, metadata: array} Export result
     */
    // @phpstan-ignore-next-line method.unused
    private function exportSkillFromProjectLocal(MagicUserAuthorization $authorization, SkillEntity $skillEntity): array
    {
        $projectId = $skillEntity->getProjectId();

        $project = $this->projectDomainService->getProjectNotUserId($projectId);
        if (! $project) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, 'project.project_not_found');
        }

        $projectOrgCode = $project->getUserOrganizationCode();
        $organizationCode = $authorization->getOrganizationCode();
        $skillConfig = $this->readSkillProjectConfig($projectId, $project);
        $skillDirName = $skillConfig['skill']['dir'] ?? '';

        $skillDirPath = SkillProjectConfigUtil::SKILLS_ROOT_PATH . '/' . $skillDirName;
        $skillDirEntity = $this->taskFileDomainService->findDirectoryByPath($projectId, $skillDirPath);
        if ($skillDirEntity === null) {
            ExceptionBuilder::throw(SkillErrorCode::EXTRACTED_DIRECTORY_NOT_FOUND, 'skill.extracted_directory_not_found');
        }

        $allFiles = $this->taskFileDomainService->findFilesRecursivelyByParentId(
            $projectId,
            $skillDirEntity->getFileId()
        );

        $hasSkillMd = false;
        foreach ($allFiles as $file) {
            if (! $file->getIsDirectory() && $file->getFileName() === self::SKILL_FILE_NAME) {
                $hasSkillMd = true;
                break;
            }
        }
        if (! $hasSkillMd) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_MD_NOT_FOUND, 'skill.skill_md_not_found');
        }

        $tempBaseDir = self::TEMP_DIR_BASE . 'skill_export_' . IdGenerator::getUniqueId32();
        $tempContentDir = $tempBaseDir . '/' . $skillDirName;
        $zipFilePath = $tempBaseDir . '/' . $skillDirName . '.zip';

        if (! is_dir($tempContentDir)) {
            mkdir($tempContentDir, 0755, true);
        }

        try {
            $fileIdMap = [$skillDirEntity->getFileId() => $skillDirEntity];
            foreach ($allFiles as $file) {
                $fileIdMap[$file->getFileId()] = $file;
            }

            foreach ($allFiles as $file) {
                if ($file->getIsDirectory()) {
                    $relativePath = $this->buildRelativePathFromSkillDir($file, $skillDirEntity->getFileId(), $fileIdMap);
                    $localDir = $tempContentDir . '/' . $relativePath;
                    if (! is_dir($localDir)) {
                        mkdir($localDir, 0755, true);
                    }
                    continue;
                }

                $relativePath = $this->buildRelativePathFromSkillDir($file, $skillDirEntity->getFileId(), $fileIdMap);
                $localFilePath = $tempContentDir . '/' . $relativePath;

                $localFileDir = dirname($localFilePath);
                if (! is_dir($localFileDir)) {
                    mkdir($localFileDir, 0755, true);
                }

                $this->fileDomainService->downloadByChunks(
                    $projectOrgCode,
                    $file->getFileKey(),
                    $localFilePath,
                    StorageBucketType::SandBox
                );
            }

            ZipUtil::compress($tempContentDir, $zipFilePath, $skillDirName);

            $fileKey = $this->uploadFileToPrivateStorage($organizationCode, $zipFilePath, $skillEntity->getCode());

            return [
                'file_key' => $fileKey,
                'metadata' => [
                    'package_name' => $skillDirName,
                    'skill_dir' => $skillDirName,
                    'files_count' => count($allFiles),
                ],
            ];
        } finally {
            if (is_dir($tempBaseDir)) {
                $this->removeDirectory($tempBaseDir);
            }
        }
    }

    /**
     * @return array{skill: array<string, string>}
     */
    private function readSkillProjectConfig(int $projectId, ProjectEntity $project): array
    {
        $skillsDirEntity = $this->taskFileDomainService->findDirectoryByPath($projectId, SkillProjectConfigUtil::SKILLS_ROOT_PATH);
        if ($skillsDirEntity === null) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_CONFIG_NOT_FOUND, 'skill.skill_config_not_found');
        }

        // Find skill_config.yaml by parent_id + fileName to avoid dependence on file_key path semantics
        $configFileEntity = $this->findSkillConfigFileByParentId($projectId, $skillsDirEntity->getFileId());
        if ($configFileEntity === null) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_CONFIG_NOT_FOUND, 'skill.skill_config_not_found');
        }

        $tempDir = self::TEMP_DIR_BASE . 'skill_config_' . IdGenerator::getUniqueId32();
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        try {
            $localConfigPath = $tempDir . '/' . SkillProjectConfigUtil::CONFIG_FILE_NAME;
            $this->fileDomainService->downloadByChunks(
                $project->getUserOrganizationCode(),
                $configFileEntity->getFileKey(),
                $localConfigPath,
                StorageBucketType::SandBox
            );

            $configContent = file_get_contents($localConfigPath);
            if ($configContent === false) {
                ExceptionBuilder::throw(SkillErrorCode::SKILL_CONFIG_INVALID, 'skill.skill_config_invalid');
            }

            try {
                $config = SkillProjectConfigUtil::parse($configContent);
            } catch (Throwable) {
                ExceptionBuilder::throw(SkillErrorCode::SKILL_CONFIG_INVALID, 'skill.skill_config_invalid');
            }

            $skillDirName = $config['skill']['dir'] ?? '';
            if (! SkillProjectConfigUtil::isValidSkillDir($skillDirName)) {
                ExceptionBuilder::throw(SkillErrorCode::SKILL_CONFIG_INVALID, 'skill.skill_config_invalid');
            }

            return $config;
        } finally {
            if (is_dir($tempDir)) {
                $this->removeDirectory($tempDir);
            }
        }
    }

    /**
     * Build relative path from the skill directory root using parent_id chain + fileName.
     * Works correctly regardless of whether file_key is path-based or ID-based.
     *
     * @param array<int, TaskFileEntity> $fileIdMap
     */
    private function buildRelativePathFromSkillDir(TaskFileEntity $file, int $skillDirFileId, array $fileIdMap): string
    {
        $segments = [];
        $current = $file;
        $visited = [];

        while ($current !== null && $current->getFileId() !== $skillDirFileId) {
            $id = $current->getFileId();
            if (isset($visited[$id])) {
                break;
            }
            $visited[$id] = true;

            $name = $current->getFileName();
            if ($name !== '' && $name !== '/') {
                $segments[] = $name;
            }

            $parentId = $current->getParentId();
            $current = $parentId !== null ? ($fileIdMap[$parentId] ?? null) : null;
        }

        return implode('/', array_reverse($segments));
    }

    /**
     * Find skill_config.yaml by parent directory file_id + fileName.
     * Uses parent_id chain instead of file_key string to support both path-based and ID-based file_keys.
     */
    private function findSkillConfigFileByParentId(int $projectId, int $skillsDirFileId): ?TaskFileEntity
    {
        $children = $this->taskFileDomainService->findFilesRecursivelyByParentId($projectId, $skillsDirFileId, 1);
        foreach ($children as $child) {
            if (! $child->getIsDirectory() && $child->getFileName() === SkillProjectConfigUtil::CONFIG_FILE_NAME) {
                return $child;
            }
        }
        return null;
    }

    /**
     * 上传文件到私有存储桶.
     *
     * @param string $organizationCode 组织代码
     * @param string $localFilePath 本地文件路径
     * @param string $skillCode 技能代码（用于生成文件路径）
     * @return string 上传后的 file_key
     */
    private function uploadFileToPrivateStorage(string $organizationCode, string $localFilePath, string $skillCode): string
    {
        // 生成文件存储路径（包含组织代码前缀）
        $fileDir = 'skills/' . $skillCode;
        $fileName = basename($localFilePath);

        // 创建 UploadFile 对象并上传
        $uploadFile = new UploadFile($localFilePath, $fileDir, $fileName, false);
        $this->fileDomainService->uploadByCredential($organizationCode, $uploadFile, StorageBucketType::Private, false);

        return $uploadFile->getKey();
    }

    /**
     * 创建技能（通用方法，支持不同来源类型）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param string $userId 用户 ID
     * @param string $organizationCode 组织代码
     * @param string $packageName 包名
     * @param string $packageDescription 包描述
     * @param string $fileKey 文件 key（已上传到正式存储区）
     * @param string $skillCode Skill 代码
     * @param SkillSourceType $sourceType 来源类型
     * @param null|array $nameI18n 多语言名称（null 时自动生成）
     * @param null|array $descriptionI18n 多语言描述（null 时自动生成）
     * @param null|string $logo Logo 路径（null 时设置为 null）
     * @return SkillEntity 用户技能实体
     */
    private function createSkillInternal(
        SkillDataIsolation $dataIsolation,
        string $userId,
        string $organizationCode,
        string $packageName,
        string $packageDescription,
        string $fileKey,
        string $skillCode,
        SkillSourceType $sourceType,
        ?array $nameI18n = null,
        ?array $descriptionI18n = null,
        ?string $logo = null
    ): SkillEntity {
        // 创建 Skill 基础记录（LOCAL_UPLOAD 和 AGENT_THIRD_PARTY_IMPORT 类型不需要创建 version，version_id 和 version_code 为 NULL）
        $skillEntity = new SkillEntity();
        $skillEntity->setOrganizationCode($organizationCode);
        $skillEntity->setCode($skillCode);
        $skillEntity->setCreatorId($userId);
        $skillEntity->setPackageName($packageName);
        $skillEntity->setPackageDescription($packageDescription);

        // 处理多语言内容：如果未提供则自动生成
        if ($nameI18n === null || $descriptionI18n === null) {
            [$generatedNameI18n, $generatedDescriptionI18n] = $this->generateI18nContent($packageName, $packageDescription);
            $skillEntity->setNameI18n($nameI18n ?? $generatedNameI18n);
            $skillEntity->setDescriptionI18n($descriptionI18n ?? $generatedDescriptionI18n);
        } else {
            $skillEntity->setNameI18n($nameI18n);
            $skillEntity->setDescriptionI18n($descriptionI18n);
        }

        // 处理 logo：如果传入的是完整 URL，提取路径部分；如果为空字符串或 null，设置为 null
        $logoPath = $logo !== null ? EasyFileTools::formatPath($logo) : null;
        $skillEntity->setLogo($logoPath);
        $skillEntity->setFileKey($fileKey);
        $skillEntity->setSourceType($sourceType);
        $skillEntity->setIsEnabled(true);
        // version_id 和 version_code 保持为 NULL（LOCAL_UPLOAD 和 AGENT_THIRD_PARTY_IMPORT 类型不需要版本）

        $skillEntity = $this->skillDomainService->saveSkill($dataIsolation, $skillEntity);
        $this->skillDomainService->saveUserSkillOwnership($dataIsolation, new UserSkillEntity([
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'skill_code' => $skillEntity->getCode(),
            'source_type' => $sourceType->value,
        ]));
        $this->saveSkillVisibility($dataIsolation, $skillEntity->getCode(), VisibilityType::SPECIFIC, [$dataIsolation->getCurrentUserId()]);
        $this->grantSkillOwnerPermission($dataIsolation, $skillEntity->getCode(), $skillEntity->getCreatorId());

        return $skillEntity;
    }

    /**
     * 更新技能（通用方法，支持不同来源类型）.
     *
     * @param SkillDataIsolation $dataIsolation 数据隔离对象
     * @param SkillEntity $skillEntity 已存在的技能实体
     * @param string $packageName 包名
     * @param string $packageDescription 包描述
     * @param string $fileKey 文件 key（已上传到正式存储区）
     * @param null|array $nameI18n 多语言名称（null 时不更新）
     * @param null|array $descriptionI18n 多语言描述（null 时不更新）
     * @param null|string $logo Logo 路径（null 时不更新）
     * @return SkillEntity 用户技能实体
     */
    private function updateSkillInternal(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        string $packageName,
        string $packageDescription,
        string $fileKey,
        ?array $nameI18n = null,
        ?array $descriptionI18n = null,
        ?string $logo = null
    ): SkillEntity {
        // 更新 Skill 基础记录（LOCAL_UPLOAD 和 AGENT_THIRD_PARTY_IMPORT 类型不需要更新 version，version_id 和 version_code 保持为 NULL）
        $skillEntity->setPackageDescription($packageDescription);
        $skillEntity->setFileKey($fileKey);

        // 更新多语言内容（如果提供）
        if ($nameI18n !== null) {
            $skillEntity->setNameI18n($nameI18n);
        }
        if ($descriptionI18n !== null) {
            $skillEntity->setDescriptionI18n($descriptionI18n);
        }

        // 处理 logo：如果传入的是完整 URL，提取路径部分；如果为空字符串，设置为 null；如果为 null，不更新
        if ($logo !== null) {
            $logoPath = $logo !== '' ? EasyFileTools::formatPath($logo) : null;
            $skillEntity->setLogo($logoPath);
        }

        return $this->skillDomainService->saveSkill($dataIsolation, $skillEntity);
    }

    /**
     * Save the visibility configuration for a skill.
     *
     * @param array<string> $userIds
     * @param array<string> $departmentIds
     */
    private function saveSkillVisibility(
        SkillDataIsolation $dataIsolation,
        string $code,
        VisibilityType $visibilityType,
        array $userIds = [],
        array $departmentIds = []
    ): void {
        $this->resourceAccessPolicyService->saveReadableScope(
            $dataIsolation,
            ResourceVisibilityResourceType::SKILL,
            $code,
            $visibilityType,
            $userIds,
            $departmentIds
        );
    }

    private function publishImportedCrewSkill(SkillDataIsolation $dataIsolation, SkillEntity $skillEntity): void
    {
        $publishRequestDTO = new PublishSkillRequestDTO();
        $publishRequestDTO->setVersion(sprintf(
            '%d.0.0',
            $this->skillVersionDomainService->countSkillVersionsByCode($dataIsolation, $skillEntity->getCode()) + 1
        ));
        $publishRequestDTO->setVersionDescriptionI18n($skillEntity->getDescriptionI18n() ?? []);
        $publishRequestDTO->setPublishTargetType(PublishTargetType::PRIVATE->value);
        $publishRequestDTO->setPublishTargetValue(null);
        $publishRequestDTO->setExportFileFromProject(false);

        $this->executePublishSkill(
            $dataIsolation,
            $skillEntity,
            $skillEntity->getCode(),
            $publishRequestDTO
        );
    }

    private function executePublishSkill(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        string $code,
        PublishSkillRequestDTO $requestDTO
    ): PublishSkillResultDTO {
        $sandboxId = null;
        $versionEntity = new SkillVersionEntity();
        $versionEntity->setVersion($requestDTO->getVersion());
        $versionEntity->setVersionDescriptionI18n($requestDTO->getVersionDescriptionI18n());
        $versionEntity->setPublishTargetType($requestDTO->getPublishTargetType());
        $versionEntity->setPublishTargetValue($requestDTO->toPublishTargetValue());
        $versionEntity->setCategoryIds(
            $requestDTO->getPublishTargetType() === PublishTargetType::MARKET->value
                ? $requestDTO->getCategoryIds()
                : []
        );
        // Persist a snapshot of the SKILL.md file key on publish so non-creators
        // can still access the published skill document after the project changes.
        $taskFileEntity = $this->resolveSkillFileKeyByProjectId($skillEntity->getProjectId());
        $versionEntity->setSkillFileKey($taskFileEntity?->getFileKey());

        if ($requestDTO->getExportFileFromProject()) {
            $this->logger->info('publishSkill', ['id' => $skillEntity->getId(), 'code' => $code, 'project_id' => $skillEntity->getProjectId()]);
            $fileMetadata = $this->exportSkillFromProjectViaSandbox($dataIsolation, $skillEntity, $code);
            $sandboxId = $fileMetadata['sandbox_id'];
            $skillEntity->setFileKey($fileMetadata['file_key']);
            // Write back the package_name resolved from skill_config.yaml so that both
            // magic_skills and magic_skill_versions receive the correct value.
            $packageName = $fileMetadata['metadata']['package_name'] ?? '';
            if ($packageName !== '') {
                $skillEntity->setPackageName($packageName);
            }
        }

        if (trim($skillEntity->getPackageName()) === '') {
            // 空包名版本会阻断引用它的员工发布，发布前必须能从 skill_config.yaml 解析出包名
            ExceptionBuilder::throw(SkillErrorCode::PACKAGE_NAME_REQUIRED, 'skill.package_name_required');
        }

        if (empty($skillEntity->getFileKey())) {
            ExceptionBuilder::throw(SkillErrorCode::FILE_NOT_FOUND, 'skill.file_not_found');
        }

        $versionEntity = $this->skillVersionDomainService->publishSkill($dataIsolation, $skillEntity, $versionEntity);
        if ($versionEntity->getPublishStatus()->isPublished()) {
            $this->syncPublishedSkillScope($dataIsolation, $skillEntity, $versionEntity);
        }

        return new PublishSkillResultDTO($versionEntity, $sandboxId);
    }

    private function resolveSkillFileKeyByProjectId(?int $projectId): ?TaskFileEntity
    {
        if ($projectId === null) {
            return null;
        }

        // Always resolve the latest SKILL.md entry from the workspace file table.
        return $this->taskFileDomainService->getByProjectIdAndFileName($projectId, self::SKILL_FILE_NAME);
    }

    private function resolveSkillDetailFileUrl(
        MagicUserAuthorization $authorization,
        SkillEntity $skillEntity,
        ?SkillVersionEntity $latestVersionEntity
    ): string {
        $taskFileEntity = null;
        $creatorId = $latestVersionEntity?->getCreatorId() ?? $skillEntity->getCreatorId();
        if ($creatorId === $authorization->getId()) {
            // The creator should read the current SKILL.md from the bound project.
            $taskFileEntity = $this->resolveSkillFileKeyByProjectId($skillEntity->getProjectId());
        }

        if ($taskFileEntity === null) {
            // Shared and market-installed skills read from the published snapshot.
            $skillFileKey = $latestVersionEntity?->getSkillFileKey();
            if (! empty($skillFileKey)) {
                $taskFileEntity = new TaskFileEntity();
                $taskFileEntity->setFileKey($skillFileKey);
                $taskFileEntity->setFileName(basename($skillFileKey));
                $taskFileEntity->setIsDirectory(false);
            }
        }

        if ($taskFileEntity === null || empty($taskFileEntity->getFileKey())) {
            return '';
        }

        $organizationCode = $latestVersionEntity?->getOrganizationCode() ?? $skillEntity->getOrganizationCode();
        if ($latestVersionEntity !== null && $taskFileEntity->getFileKey() === $latestVersionEntity->getSkillFileKey()) {
            return $this->fileDomainService->getLink(
                $organizationCode,
                $taskFileEntity->getFileKey(),
                StorageBucketType::Private,
            )?->getUrl() ?? '';
        }

        return $this->taskFileDomainService->getFilePreSignedUrl($organizationCode, $taskFileEntity);
    }

    /**
     * Grant owner permission for a local skill.
     */
    private function grantSkillOwnerPermission(SkillDataIsolation $dataIsolation, string $code, string $userId): void
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $this->operationPermissionDomainService->accessOwner(
            $permissionDataIsolation,
            OperationPermissionResourceType::Skill,
            $code,
            $userId
        );
    }

    /**
     * Clear the visibility configuration for a skill.
     */
    private function clearSkillVisibility(SkillDataIsolation $dataIsolation, string $code): void
    {
        $this->saveSkillVisibility($dataIsolation, $code, VisibilityType::NONE);
    }

    /**
     * 根据最新发布版本，重新同步 Skill 的可见范围和安装关系。
     *
     * 这里的职责是把“发布语义”真正落成存储状态：
     * - `MARKET` 不动现有范围，只保留市场分发
     * - `PRIVATE / MEMBER / ORGANIZATION` 会回收市场安装用户，并重建组织内可见范围
     *
     * 注意：
     * - `deleteUserSkillOwnershipsExceptUser()` 只处理 `magic_user_skills`，不影响最终可见范围
     * - 真正的可见范围由 `saveSkillVisibility()` 决定，而它底层会先删掉该资源的全部旧可见记录，再写入新配置
     * - 因此这里不需要额外单独删除“非创建者可见范围”；重新保存时已经会整体覆盖
     */
    private function syncPublishedSkillScope(
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        SkillVersionEntity $versionEntity
    ): void {
        $publishTargetType = $versionEntity->getPublishTargetType();
        if ($publishTargetType === PublishTargetType::MARKET) {
            return;
        }

        // 回收市场安装关系。
        // 这里删除的是“安装所有权”，不是可见范围本身：
        // - 创建者自己的 user_skill 保留
        // - 其他用户如果之后仍应可见，会通过下面的 visibility 规则重新获得访问能力
        $this->skillDomainService->deleteUserSkillOwnershipsExceptUser(
            $dataIsolation,
            $skillEntity->getCode(),
            $skillEntity->getCreatorId()
        );
        // 组织内发布时，若历史上存在市场分发记录，则统一下线以保持范围收口。
        $this->skillMarketDomainService->updateAllPublishStatusBySkillCode(
            $skillEntity->getCode(),
            PublishStatus::OFFLINE->value
        );

        if ($publishTargetType === PublishTargetType::ORGANIZATION) {
            // 组织内全员可见，不需要单独保留创建者用户记录。
            $this->saveSkillVisibility($dataIsolation, $skillEntity->getCode(), VisibilityType::ALL);
            return;
        }

        if ($publishTargetType === PublishTargetType::MEMBER) {
            $publishTargetValue = $versionEntity->getPublishTargetValue();
            // 创建者要始终保留可见，否则“只选部门/成员但没选自己”时，发布者自己会失去访问权限。
            // 这里的 user_ids 只负责“显式成员可见”，部门范围仍然通过 department_ids 单独保存。
            $userIds = array_values(array_unique(array_merge(
                [$skillEntity->getCreatorId()],
                $publishTargetValue?->getUserIds() ?? []
            )));

            $this->saveSkillVisibility(
                $dataIsolation,
                $skillEntity->getCode(),
                VisibilityType::SPECIFIC,
                $userIds,
                $publishTargetValue?->getDepartmentIds() ?? []
            );
            return;
        }

        $this->saveSkillVisibility(
            $dataIsolation,
            $skillEntity->getCode(),
            VisibilityType::SPECIFIC,
            [$skillEntity->getCreatorId()]
        );
    }

    /**
     * 追加用户级可见范围。
     *
     * 这里是市场安装场景的“增量授权”：
     * - 只检查当前用户这条记录是否已存在
     * - 不读取整份资源可见范围
     * - 不会影响组织级、部门级或其他用户已有的可见记录
     *
     * @param array<string> $userIds
     */
    private function appendSkillVisibilityUsers(SkillDataIsolation $dataIsolation, string $code, array $userIds): void
    {
        $this->resourceAccessPolicyService->appendReadableUsers(
            $dataIsolation,
            ResourceVisibilityResourceType::SKILL,
            $code,
            $userIds
        );
    }

    /**
     * 精准删除用户级别的可见范围。
     *
     * 这里只删除命中的用户主体记录，不会读取全部可见范围，更不会做“整表重建”。
     * 因此组织级、部门级以及其他用户的可见配置都会被保留。
     *
     * @param array<string> $userIds
     */
    private function removeSkillVisibilityUsers(SkillDataIsolation $dataIsolation, string $code, array $userIds): void
    {
        $this->resourceAccessPolicyService->removeReadableUsers(
            $dataIsolation,
            ResourceVisibilityResourceType::SKILL,
            $code,
            $userIds
        );
    }

    /**
     * 校验当前用户是否对 Skill 具备读取权限。
     */
    private function assertSkillReadable(SkillDataIsolation $dataIsolation, string $skillCode): ?Operation
    {
        try {
            return $this->resourceAccessPolicyService->assertReadable(
                $dataIsolation,
                OperationPermissionResourceType::Skill,
                ResourceVisibilityResourceType::SKILL,
                $skillCode,
            );
        } catch (Throwable $throwable) {
            // 内置资源等少数场景不走 op/visibility 判定，这里允许调用方透传白名单跳过。
            if (in_array($skillCode, $this->skillMarketDomainService->getOfficialBuiltinSkillCodes(), true)) {
                return null;
            }
            throw $throwable;
        }
    }

    /**
     * @param array{list: SkillEntity[], total: int} $result
     * @return array{
     *     list: SkillEntity[],
     *     total: int,
     *     creator_user_map: array<string, mixed>,
     *     latest_version_map: array<string, mixed>
     * }
     */
    private function buildSkillListResult(SkillDataIsolation $dataIsolation, array $result): array
    {
        $skillEntities = $this->skillVersionDomainService->replaceVisibleSkillDisplayFields(
            $dataIsolation,
            $result['list']
        );

        $this->updateSkillLogoUrl($dataIsolation, $skillEntities);
        $creatorUserMap = $this->buildCreatorUserMapFromSkillEntities($dataIsolation, $skillEntities);

        $skillCodes = array_map(function (SkillEntity $skillEntity) {
            return $skillEntity->getCode();
        }, $result['list']);
        $publishedVersionMap = $this->skillVersionDomainService->findCurrentPublishedVersionsByCodes($dataIsolation, $skillCodes);

        return [
            'list' => $skillEntities,
            'total' => $result['total'],
            'creator_user_map' => $creatorUserMap,
            'latest_version_map' => $publishedVersionMap,
        ];
    }

    /**
     * @param SkillEntity[] $skillEntities
     * @return array<string, MagicUserEntity>
     */
    private function buildCreatorUserMapFromSkillEntities(SkillDataIsolation $dataIsolation, array $skillEntities): array
    {
        $creatorIds = array_values(array_unique(array_filter(array_map(
            static fn (SkillEntity $skillEntity) => $skillEntity->getCreatorId(),
            $skillEntities
        ))));

        return $this->buildCreatorUserMap($dataIsolation, $creatorIds);
    }

    /**
     * @param SkillVersionEntity[] $skillVersionEntities
     * @return array<string, MagicUserEntity>
     */
    private function buildCreatorUserMapFromSkillVersions(SkillDataIsolation $dataIsolation, array $skillVersionEntities): array
    {
        $creatorIds = array_values(array_unique(array_filter(array_map(
            static fn (SkillVersionEntity $skillVersionEntity) => $skillVersionEntity->getCreatorId(),
            $skillVersionEntities
        ))));

        return $this->buildCreatorUserMap($dataIsolation, $creatorIds);
    }

    /**
     * @param array<string> $creatorIds
     * @return array<string, MagicUserEntity>
     */
    private function buildCreatorUserMap(SkillDataIsolation $dataIsolation, array $creatorIds): array
    {
        if ($creatorIds === []) {
            return [];
        }

        $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization($creatorIds);
        $this->updateUserAvatarUrl($dataIsolation, $userEntities);

        $creatorUserMap = [];
        foreach ($userEntities as $userEntity) {
            $creatorUserMap[$userEntity->getUserId()] = $userEntity;
        }

        return $creatorUserMap;
    }

    /**
     * @param SkillVersionEntity[] $skillVersionEntities
     * @return array<string, SkillVersionEntity>
     */
    private function buildLatestVersionEntityMapFromSkillVersions(array $skillVersionEntities): array
    {
        $latestVersionMap = [];
        foreach ($skillVersionEntities as $skillVersionEntity) {
            $latestVersionMap[$skillVersionEntity->getCode()] = $skillVersionEntity;
        }

        return $latestVersionMap;
    }

    /**
     * 构建外部可见技能实体。
     */
    private function buildExternalVisibleSkillFromVersion(SkillVersionEntity $versionEntity): SkillEntity
    {
        return new SkillEntity([
            'id' => $versionEntity->getId(),
            'organization_code' => $versionEntity->getOrganizationCode(),
            'code' => $versionEntity->getCode(),
            'creator_id' => $versionEntity->getCreatorId(),
            'package_name' => $versionEntity->getPackageName(),
            'package_description' => $versionEntity->getPackageDescription(),
            'name_i18n' => $versionEntity->getNameI18n(),
            'description_i18n' => $versionEntity->getDescriptionI18n(),
            'source_i18n' => $versionEntity->getSourceI18n(),
            'search_text' => $versionEntity->getSearchText(),
            'logo' => $versionEntity->getLogo(),
            'file_key' => $versionEntity->getFileKey() ?? '',
            'source_type' => $versionEntity->getSourceType()->value,
            'source_id' => $versionEntity->getSourceId(),
            'source_meta' => $versionEntity->getSourceMeta(),
            'version_id' => $versionEntity->getId(),
            'version_code' => $versionEntity->getVersion(),
            'is_enabled' => true,
            'pinned_at' => null,
            'project_id' => $versionEntity->getProjectId(),
            'latest_published_at' => $versionEntity->getPublishedAt(),
            'created_at' => $versionEntity->getCreatedAt(),
            'updated_at' => $versionEntity->getUpdatedAt(),
        ]);
    }

    /**
     * Clear owner permissions for a skill resource.
     */
    private function clearSkillOwnerPermission(SkillDataIsolation $dataIsolation, string $code): void
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $this->operationPermissionDomainService->deleteByResource(
            $permissionDataIsolation,
            OperationPermissionResourceType::Skill,
            $code
        );
    }

    /**
     * 递归删除目录.
     */
    private function removeDirectory(string $dir): void
    {
        ZipUtil::removeDirectory($dir);
    }
}
