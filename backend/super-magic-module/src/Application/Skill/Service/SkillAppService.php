<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Service;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationPermissionResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityDepartment;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityUser;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
use App\Infrastructure\Core\DataIsolation\ValueObject\OrganizationType;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Infrastructure\ExternalAPI\Sms\Enum\LanguageEnum;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\File\EasyFileTools;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\SkillUtil;
use App\Infrastructure\Util\ZipUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillMarketEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\UserSkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\BuiltinSkill;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublisherType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Event\SkillImportedEvent;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperMagicErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\SkillProjectConfigUtil;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\AddSkillFromStoreRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\GetLatestPublishedSkillVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\GetSkillFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ImportSkillRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ParseFileImportRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\PublishSkillRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\UpdateSkillInfoRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\ParseFileImportResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillDetailResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillFileUrlItemDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillPublishPrefillResponseDTO;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
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
     * 文件大小限制：20MB
     * 用于校验上传的压缩包文件大小上限.
     */
    private const MAX_FILE_SIZE = 20 * 1024 * 1024;

    /**
     * 解压后文件总大小限制：20MB
     * 用于防 Zip Bomb 攻击，校验解压后的文件总大小上限.
     */
    private const MAX_EXTRACTED_SIZE = 20 * 1024 * 1024;

    /**
     * import_token 有效期：30分钟（1800秒，文档要求）
     * 用于控制导入第一阶段生成的 token 的有效期
     */
    private const IMPORT_TOKEN_EXPIRES = 4 * 3600;

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

    protected LoggerInterface $logger;

    public function __construct(
        FileDomainService $fileDomainService,
        protected SkillDomainService $skillDomainService,
        protected SkillMarketDomainService $skillMarketDomainService,
        protected MagicUserDomainService $magicUserDomainService,
        protected MagicDepartmentDomainService $magicDepartmentDomainService,
        protected LockerInterface $locker,
        protected Redis $redis,
        protected ProjectAppService $projectAppService,
        protected ResourceVisibilityDomainService $resourceVisibilityDomainService,
        protected OperationPermissionDomainService $operationPermissionDomainService,
        protected ProjectDomainService $projectDomainService,
        protected TaskFileDomainService $taskFileDomainService,
        LoggerFactory $loggerFactory
    ) {
        parent::__construct($fileDomainService);
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

        $tempDir = null;
        $downloadedFilePath = null;

        try {
            // 1. 根据 file_key 从文件服务下载文件到临时沙箱目录
            $downloadedFilePath = $this->downloadFileFromStorage($organizationCode, $fileKey);

            // 2. 解析文件（公共逻辑）
            $parseResult = $this->parseSkillFile($downloadedFilePath);
            $tempDir = $parseResult['tempDir'];
            $packageName = $parseResult['packageName'];
            $packageDescription = $parseResult['packageDescription'];

            // 3. 创建数据隔离对象并检查用户是否已存在同名技能（非store来源）
            $dataIsolation = $this->createSkillDataIsolation($userAuthorization);
            $existingSkillEntity = $this->skillDomainService->findSkillByPackageNameAndCreator($dataIsolation, $packageName);

            // 4. 生成 skill_code（用于确定文件存储路径，仅在新建场景需要）
            $skillCode = $existingSkillEntity ? $existingSkillEntity->getCode() : null;

            // 5. 生成 import_token（保存原始的 file_key，不需要重新上传）
            $importToken = $this->generateImportToken($packageName, $packageDescription, $fileKey, $skillCode);

            // 6. 根据是否存在同名技能，分别处理并返回结果
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
        } finally {
            // 6. 清理临时目录和下载的文件
            if ($tempDir && is_dir($tempDir)) {
                $this->removeDirectory($tempDir);
            }
            if ($downloadedFilePath && file_exists($downloadedFilePath)) {
                @unlink($downloadedFilePath);
            }
        }
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

        // 1. 校验并解析 import_token
        $tokenData = $this->validateAndParseImportToken($requestDTO->getImportToken());
        $packageName = $tokenData['package_name'];
        $packageDescription = $tokenData['package_description'];
        $fileKey = $tokenData['file_key']; // 原始的 file_key，直接使用
        $skillCode = $tokenData['skill_code'] ?? null; // 从 token 中获取 skillCode（新建时可能为 null）

        // 2. 分布式锁：防止并发重复创建/更新
        $lockKey = sprintf(self::LOCK_KEY_FORMAT, $userId, $organizationCode, $packageName);
        $lockOwner = IdGenerator::getUniqueId32();
        $lockAcquired = false;

        try {
            $lockAcquired = $this->locker->mutexLock($lockKey, $lockOwner, 60);
            if (! $lockAcquired) {
                ExceptionBuilder::throw(SkillErrorCode::IMPORT_CONCURRENT_ERROR, 'skill.import_concurrent_error');
            }

            // 3. 创建数据隔离对象
            $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

            // 4. 根据 skill_code 判断是更新还是创建
            // 如果 token 中有 skill_code，说明第一阶段已识别为更新场景，直接通过 code 查找
            // 如果 token 中没有 skill_code，说明是新建场景
            $existingSkillEntity = null;
            if (! empty($skillCode)) {
                $existingSkillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $skillCode);
            }

            // 5. 使用事务处理创建或更新逻辑
            Db::beginTransaction();
            try {
                if ($existingSkillEntity) {
                    // 更新场景：直接使用已存在的 SkillEntity
                    $result = $this->updateSkillInternal(
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
                    $skillCode = SkillEntity::generateNewCode();
                    $result = $this->createSkillInternal(
                        $dataIsolation,
                        $userId,
                        $organizationCode,
                        $packageName,
                        $packageDescription,
                        $fileKey,
                        $skillCode,
                        $sourceType,
                        $requestDTO->getNameI18n(),
                        $requestDTO->getDescriptionI18n(),
                        $requestDTO->getLogo()
                    );
                }

                if ($sourceType === SkillSourceType::CREW_IMPORT) {
                    $this->publishImportedCrewSkill($requestContext, $dataIsolation, $result);
                }

                Db::commit();

                // 6. 删除 import_token 缓存（导入成功后不再需要）
                $this->deleteImportToken($requestDTO->getImportToken());

                try {
                    AsyncEventUtil::dispatch(new SkillImportedEvent($userAuthorization, $result->getCode()));
                } catch (Throwable $eventException) {
                    $this->logger->error('Dispatch SkillImportedEvent failed', [
                        'skill_code' => $result->getCode(),
                        'error' => $eventException->getMessage(),
                    ]);
                }

                return $result;
            } catch (Throwable $e) {
                Db::rollBack();
                throw $e;
            }
        } finally {
            if ($lockAcquired) {
                $this->locker->release($lockKey, $lockOwner);
            }
        }
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

    /**
     * 查询用户技能列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param SkillQuery $query 查询对象
     * @param Page $page 分页对象
     * @return array{list: SkillEntity[], total: int} 技能列表结果
     */
    public function queries(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $this->fillLanguageCode($dataIsolation, $query);

        $accessibleSkillCodes = $this->getAccessibleSkillCodes($dataIsolation);

        $dataIsolation->disabled();
        $result = $this->skillDomainService->queriesByCodes($dataIsolation, $accessibleSkillCodes, $query, $page);

        return $this->buildSkillListResult($dataIsolation, $result);
    }

    /**
     * 查询我创建的技能列表.
     *
     * @return array{list: SkillEntity[], total: int}
     */
    public function queriesCreated(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $this->fillLanguageCode($dataIsolation, $query);

        $result = $this->skillDomainService->queries($dataIsolation, $query, $page);
        $this->updateSkillLogoUrl($dataIsolation, $result['list']);
        $creatorUserMap = $this->buildCreatorUserMapFromSkillEntities($dataIsolation, $result['list']);
        $latestVersionMap = $this->buildLatestVersionMapFromSkillEntities($dataIsolation, $result['list']);

        return [
            'list' => $result['list'],
            'total' => $result['total'],
            'creatorUserMap' => $creatorUserMap,
            'latestVersionMap' => $latestVersionMap,
        ];
    }

    /**
     * 查询团队共享的技能列表.
     *
     * @return array{list: SkillVersionEntity[], total: int}
     */
    public function queriesTeamShared(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $this->fillLanguageCode($dataIsolation, $query);

        $accessibleSkillCodes = $this->getAccessibleSkillCodes($dataIsolation);
        $currentUserSkillCodes = $this->skillDomainService->findCurrentUserSkillCodes($dataIsolation);
        $sharedSkillCodes = array_values(array_diff($accessibleSkillCodes, $currentUserSkillCodes));

        if (! $sharedSkillCodes) {
            return [
                'list' => [],
                'total' => 0,
            ];
        }

        $result = $this->skillDomainService->queryCurrentPublishedVersionsByCodes(
            $dataIsolation,
            $sharedSkillCodes,
            $query->getKeyword(),
            $query->getLanguageCode() ?: LanguageEnum::EN_US->value,
            $page
        );

        $this->updateSkillVersionAssetUrls($dataIsolation, $result['list']);
        $creatorUserMap = $this->buildCreatorUserMapFromSkillVersions($dataIsolation, $result['list']);
        $latestVersionMap = $this->buildLatestVersionMapFromSkillVersions($result['list']);

        return [
            'list' => $result['list'],
            'total' => $result['total'],
            'creatorUserMap' => $creatorUserMap,
            'latestVersionMap' => $latestVersionMap,
        ];
    }

    /**
     * 查询从市场安装的技能列表.
     *
     * @return array{list: SkillVersionEntity[], total: int}
     */
    public function queriesMarketInstalled(RequestContext $requestContext, SkillQuery $query, Page $page): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $this->fillLanguageCode($dataIsolation, $query);

        $marketInstalledCodes = $this->getMarketInstalledSkillCodes($dataIsolation);

        if ($marketInstalledCodes === []) {
            return [
                'list' => [],
                'total' => 0,
            ];
        }

        $dataIsolation->disabled();
        $result = $this->skillDomainService->queryCurrentPublishedVersionsByCodes(
            $dataIsolation,
            $marketInstalledCodes,
            $query->getKeyword(),
            $query->getLanguageCode() ?: LanguageEnum::EN_US->value,
            $page
        );

        $this->updateSkillVersionAssetUrls($dataIsolation, $result['list']);
        $creatorUserMap = $this->buildCreatorUserMapFromSkillVersions($dataIsolation, $result['list']);
        $latestVersionMap = $this->buildLatestVersionMapFromSkillVersions($result['list']);

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
            'creatorUserMap' => $creatorUserMap,
            'latestVersionMap' => $latestVersionMap,
            'marketEntityMap' => $marketEntityMap,
            'publisherUserMap' => $publisherUserMap,
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

        Db::beginTransaction();
        try {
            if ($userSkillEntity !== null && $userSkillEntity->getSourceType()->isMarket()) {
                $this->skillDomainService->deleteUserSkillOwnership($dataIsolation, $code);
                $this->removeSkillVisibilityUsers($dataIsolation, $code, [$dataIsolation->getCurrentUserId()]);
                Db::commit();
                return;
            }

            $this->clearSkillVisibility($dataIsolation, $code);
            $this->clearSkillOwnerPermission($dataIsolation, $code);
            $this->skillDomainService->deleteSkill($dataIsolation, $code);
            Db::commit();
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
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

        $this->checkPermission($dataIsolation, $code);

        // 查询技能记录（校验权限）
        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $code);

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

        if (empty($this->getAccessibleSkillCodes($dataIsolation, [$code]))) {
            ExceptionBuilder::throw(SkillErrorCode::SKILL_ACCESS_DENIED, 'skill.skill_access_denied');
        }

        // 查询技能记录（校验权限）
        $dataIsolation->disabled();
        $skillEntity = $this->skillDomainService->findSkillByCode($dataIsolation, $code);

        $latestVersionEntity = $this->skillDomainService->findLatestSkillVersionByCode($dataIsolation, $code);
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

        return new SkillDetailResponseDTO(
            $skillEntity->getId(),
            $skillEntity->getCode(),
            $latestVersionEntity?->getId() ?? $skillEntity->getVersionId(),
            $latestVersionEntity?->getVersion() ?? $skillEntity->getVersionCode(),
            $skillEntity->getSourceType()->value,
            $skillEntity->getIsEnabled() ? 1 : 0,
            $skillEntity->getPinnedAt(),
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
            $skillFileUrl
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

        $this->checkPermission($dataIsolation, $code);

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
    public function publishSkill(RequestContext $requestContext, string $code, PublishSkillRequestDTO $requestDTO): SkillVersionEntity
    {
        $authorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($authorization);

        $this->checkPermission($dataIsolation, $code);

        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $code);

        Db::beginTransaction();
        try {
            $versionEntity = $this->executePublishSkill($authorization, $dataIsolation, $skillEntity, $code, $requestDTO);
            Db::commit();
            return $versionEntity;
        } catch (Throwable $throwable) {
            Db::rollBack();
            throw $throwable;
        }
    }

    /**
     * Query published version records.
     *
     * @return array{list: SkillVersionEntity[], page: int, page_size: int, total: int, userMap: array<string, MagicUserEntity>, memberDepartmentMap: array<string, MagicDepartmentEntity>}
     */
    public function queryVersions(RequestContext $requestContext, string $code, QuerySkillVersionsRequestDTO $requestDTO): array
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($authorization);
        $page = new Page($requestDTO->getPage(), $requestDTO->getPageSize());

        $publishTargetType = $requestDTO->getPublishTargetType() ? PublishTargetType::from($requestDTO->getPublishTargetType()) : null;
        $reviewStatus = $requestDTO->getStatus() ? ReviewStatus::from($requestDTO->getStatus()) : null;

        $result = $this->skillDomainService->queryVersionsByCode(
            $dataIsolation,
            $code,
            $publishTargetType,
            $reviewStatus,
            $page
        );

        /** @var SkillVersionEntity[] $versions */
        $versions = $result['list'];
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        [$userMap, $memberDepartmentMap] = $this->batchLoadVersionRelatedEntities(
            $organizationCode,
            $versions
        );

        return [
            'list' => $versions,
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
            'total' => $result['total'],
            'userMap' => $userMap,
            'memberDepartmentMap' => $memberDepartmentMap,
        ];
    }

    /**
     * 获取发布版本接口的表单预填：版本号为当前版本记录数 + 1 的主版本，描述为当前 Skill 描述（与 POST publish 请求体字段对齐）.
     */
    public function getPublishPrefill(RequestContext $requestContext, string $code): SkillPublishPrefillResponseDTO
    {
        $authorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($authorization);

        $this->checkPermission($dataIsolation, $code);

        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $code);

        $versionRecordCount = $this->skillDomainService->countSkillVersionsByCode($dataIsolation, $code);
        $descriptionI18n = $skillEntity->getDescriptionI18n();
        $version = sprintf('%d.0.0', $versionRecordCount + 1);
        $versionDescriptionI18n = is_array($descriptionI18n) ? $descriptionI18n : [];

        $latestVersion = $this->skillDomainService->findLatestSkillVersionByCode($dataIsolation, $code);
        if ($latestVersion !== null) {
            $publishTargetType = $latestVersion->getPublishTargetType()->value;
            $publishTargetValue = $latestVersion->getPublishTargetType()->requiresTargetValue()
                ? $latestVersion->getPublishTargetValue()?->toArray()
                : null;
        } else {
            $publishTargetType = null;
            $publishTargetValue = null;
        }

        return new SkillPublishPrefillResponseDTO(
            version: $version,
            versionDescriptionI18n: $versionDescriptionI18n,
            publishTargetType: $publishTargetType,
            publishTargetValue: $publishTargetValue,
            exportFileFromProject: true,
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

        $this->checkPermission($dataIsolation, $code);

        // 调用领域服务处理业务逻辑
        $this->skillDomainService->offlineSkill($dataIsolation, $code);
    }

    /**
     * Batch get skill file keys and download URLs by skill IDs.
     * Only returns skills owned by the current user (permission enforced by repository).
     *
     * @param RequestContext $requestContext Request context
     * @param GetSkillFileUrlsRequestDTO $requestDTO Request DTO
     * @return SkillFileUrlItemDTO[] List of skill file URL items
     */
    public function getSkillFileUrlsByIds(RequestContext $requestContext, GetSkillFileUrlsRequestDTO $requestDTO): array
    {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);

        $skillIds = $requestDTO->getSkillIdsAsInt();

        // Only returns skills owned by current user (filters by organization_code + creator_id)
        $skillEntities = $this->skillDomainService->findUserSkillsByIds($dataIsolation, $skillIds);

        if (empty($skillEntities)) {
            return [];
        }

        // Convert file_keys to signed download URLs
        $this->updateSkillFileUrl($dataIsolation, $skillEntities);

        return array_values(array_map(
            fn (SkillEntity $entity) => new SkillFileUrlItemDTO(
                id: $entity->getId() ?? 0,
                fileKey: $entity->getFileKey(),
                fileUrl: $entity->getFileUrl(),
                sourceType: $entity->getSourceType()->value
            ),
            $skillEntities
        ));
    }

    /**
     * Query latest published current versions for accessible skills by codes.
     *
     * @return array{list: SkillVersionEntity[], total: int, page: int, page_size: int}
     */
    public function getLatestPublishedVersionsByCodes(
        RequestContext $requestContext,
        GetLatestPublishedSkillVersionsRequestDTO $requestDTO
    ): array {
        $userAuthorization = $requestContext->getUserAuthorization();
        $dataIsolation = $this->createSkillDataIsolation($userAuthorization);
        $filterCodes = $requestDTO->getCodes() ?? [];

        $languageCode = $dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value;
        $requestedCodes = array_values(array_unique(array_filter($filterCodes)));

        $accessibleSkillCodes = $this->getAccessibleSkillCodes($dataIsolation);

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
        $result = $this->skillDomainService->queryCurrentPublishedVersionsByCodes(
            $dataIsolation,
            $accessibleSkillCodes,
            $requestDTO->getKeyword(),
            $languageCode,
            $page
        );

        $this->updateSkillVersionAssetUrls($dataIsolation, $result['list']);

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

        $tempDir = null;
        $fileKey = null;
        $lockAcquired = false;
        $lockOwner = $lockKey = '';

        try {
            // 1. 解析文件（公共逻辑）
            $parseResult = $this->parseSkillFile($tempFilePath);
            $tempDir = $parseResult['tempDir'];
            $packageName = $parseResult['packageName'];
            $packageDescription = $parseResult['packageDescription'];

            // 2. 分布式锁：防止并发重复创建/更新
            $lockOwner = IdGenerator::getUniqueId32();
            $lockKey = sprintf(self::LOCK_KEY_FORMAT, $userId, $organizationCode, $packageName);
            $lockAcquired = $this->locker->mutexLock($lockKey, $lockOwner, 60);
            if (! $lockAcquired) {
                ExceptionBuilder::throw(SkillErrorCode::IMPORT_CONCURRENT_ERROR, 'skill.import_concurrent_error');
            }

            // 3. 创建数据隔离对象并检查用户是否已存在同名技能（非store来源）
            $dataIsolation = $this->createSkillDataIsolation($userAuthorization);
            $existingSkillEntity = $this->skillDomainService->findSkillByPackageNameAndCreator($dataIsolation, $packageName);

            // 4. 生成 skill_code（新建时生成，更新时使用已有的）
            $skillCode = $existingSkillEntity ? $existingSkillEntity->getCode() : SkillEntity::generateNewCode();

            // 5. 上传文件到私有桶
            $fileKey = $this->uploadFileToPrivateStorage($organizationCode, $tempFilePath, $skillCode);

            // 6. 使用事务处理创建或更新逻辑
            Db::beginTransaction();
            if ($existingSkillEntity) {
                // 更新场景
                $result = $this->updateSkillInternal(
                    $dataIsolation,
                    $existingSkillEntity,
                    $packageName,
                    $packageDescription,
                    $fileKey,
                    $nameI18n,
                    $descriptionI18n
                );
            } else {
                // 创建场景
                $result = $this->createSkillInternal(
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
            }

            Db::commit();

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
        } catch (Throwable $e) {
            Db::rollBack();
            throw $e;
        } finally {
            if ($lockAcquired) {
                $this->locker->release($lockKey, $lockOwner);
            }
            // 6. 清理临时文件
            if ($tempDir && is_dir($tempDir)) {
                $this->removeDirectory($tempDir);
            }
            if ($tempFilePath && file_exists($tempFilePath)) {
                @unlink($tempFilePath);
            }
        }
    }

    protected function checkPermission(SkillDataIsolation $dataIsolation, string $code): void
    {
        if (! $this->operationPermissionDomainService->isResourceOwner(
            $dataIsolation,
            OperationPermissionResourceType::Skill,
            $code,
            $dataIsolation->getCurrentUserId()
        )) {
            ExceptionBuilder::throw(SuperMagicErrorCode::NotFound, 'common.not_found', ['label' => $code]);
        }
    }

    /**
     * 批量加载版本列表关联的用户与部门信息.
     *
     * 一次遍历版本列表，收集所有需要查询的 publisherUserId、MEMBER 类型的 userIds 和 departmentIds，
     *
     * @param SkillVersionEntity[] $versions
     * @return array{0: array<string, MagicUserEntity>, 1: array<string, MagicDepartmentEntity>}
     */
    private function batchLoadVersionRelatedEntities(string $organizationCode, array $versions): array
    {
        $userIds = [];
        $memberDepartmentIds = [];

        foreach ($versions as $version) {
            if (! empty($version->getPublisherUserId())) {
                $userIds[] = $version->getPublisherUserId();
            }

            $targetValue = $version->getPublishTargetValue();
            if ($targetValue !== null && $version->getPublishTargetType()->requiresTargetValue()) {
                foreach ($targetValue->getUserIds() as $userId) {
                    $userIds[] = $userId;
                }
                foreach ($targetValue->getDepartmentIds() as $departmentId) {
                    $memberDepartmentIds[] = $departmentId;
                }
            }
        }

        $userMap = [];
        if ($userIds !== []) {
            $userMap = $this->getUsers($organizationCode, array_unique($userIds));
        }

        $memberDepartmentMap = [];
        if ($memberDepartmentIds !== []) {
            $contactDataIsolation = ContactDataIsolation::simpleMake($organizationCode);
            $memberDepartmentMap = $this->magicDepartmentDomainService->getDepartmentByIds(
                $contactDataIsolation,
                array_unique($memberDepartmentIds),
                true
            );
        }

        return [$userMap, $memberDepartmentMap];
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
     * 根据 file_key 从文件服务下载文件到临时沙箱目录.
     *
     * @param string $organizationCode 组织代码
     * @param string $fileKey 文件 key
     * @return string 下载后的本地文件路径
     */
    private function downloadFileFromStorage(string $organizationCode, string $fileKey): string
    {
        // 创建临时目录
        $tempDir = self::TEMP_DIR_BASE . 'skill_download_' . IdGenerator::getUniqueId32();
        if (! is_dir($tempDir)) {
            mkdir($tempDir, 0755, true);
        }

        // 生成临时文件路径
        $fileName = basename($fileKey);
        $localFilePath = $tempDir . '/' . $fileName;

        // 下载文件
        $this->fileDomainService->downloadByChunks(
            $organizationCode,
            $fileKey,
            $localFilePath,
            StorageBucketType::Private
        );

        if (! file_exists($localFilePath)) {
            ExceptionBuilder::throw(SkillErrorCode::FILE_DOWNLOAD_FAILED, 'skill.file_download_failed');
        }

        return $localFilePath;
    }

    /**
     * 校验文件格式和大小.
     *
     * @param string $filePath 文件路径
     */
    private function validateFile(string $filePath): void
    {
        if (! file_exists($filePath)) {
            ExceptionBuilder::throw(SkillErrorCode::FILE_NOT_FOUND, 'skill.file_not_found');
        }

        $fileName = basename($filePath);
        $fileSize = filesize($filePath);

        // 校验文件扩展名
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        if (! in_array($extension, ['skill', 'zip'], true)) {
            ExceptionBuilder::throw(SkillErrorCode::INVALID_FILE_FORMAT, 'skill.invalid_file_format');
        }

        // 校验文件大小
        if ($fileSize > self::MAX_FILE_SIZE) {
            ExceptionBuilder::throw(SkillErrorCode::FILE_TOO_LARGE, 'skill.file_too_large', [
                'max_size' => self::MAX_FILE_SIZE,
            ]);
        }
    }

    /**
     * 解压 ZIP 文件到临时目录.
     *
     * @param string $filePath 文件路径
     * @return string 解压后的实际目录路径
     */
    private function extractZipFile(string $filePath): string
    {
        $extractBaseDir = self::TEMP_DIR_BASE . 'skill_import_' . IdGenerator::getUniqueId32();

        try {
            ZipUtil::extract($filePath, $extractBaseDir, self::MAX_EXTRACTED_SIZE);
        } catch (RuntimeException $e) {
            // 如果是因为大小超限，清理临时目录并抛出业务异常
            if (str_contains($e->getMessage(), 'exceeds maximum')) {
                ZipUtil::removeDirectory($extractBaseDir);
                ExceptionBuilder::throw(SkillErrorCode::EXTRACTED_FILE_TOO_LARGE, 'skill.extracted_file_too_large');
            }
            ZipUtil::removeDirectory($extractBaseDir);
            throw $e;
        }

        // 检查解压后的目录，查找包含 SKILL.md 的目录（支持递归查找子目录）
        if (! is_dir($extractBaseDir)) {
            ZipUtil::removeDirectory($extractBaseDir);
            ExceptionBuilder::throw(SkillErrorCode::EXTRACTED_DIRECTORY_NOT_FOUND, 'skill.extracted_directory_not_found');
        }

        $skillDir = SkillUtil::findSkillMdDirectory($extractBaseDir);
        if ($skillDir !== null) {
            return $skillDir;
        }

        // 如果没有找到包含 SKILL.md 的目录，抛出异常
        ZipUtil::removeDirectory($extractBaseDir);
        ExceptionBuilder::throw(SkillErrorCode::EXTRACTED_DIRECTORY_NOT_FOUND, 'skill.extracted_directory_not_found');
    }

    /**
     * 解析技能文件（公共逻辑，仅负责文件解析）.
     *
     * @param string $filePath 文件路径（本地文件路径）
     * @return array{tempDir: string, packageName: string, packageDescription: string} 解析结果
     */
    private function parseSkillFile(string $filePath): array
    {
        // 1. 校验文件格式和大小
        $this->validateFile($filePath);

        // 2. 解压压缩包到临时目录
        $tempDir = $this->extractZipFile($filePath);

        // 3. 解析 SKILL.md 文件
        $skillMdPath = $tempDir . '/SKILL.md';
        [$packageName, $packageDescription] = SkillUtil::parseSkillMd($skillMdPath);

        return [
            'tempDir' => $tempDir,
            'packageName' => $packageName,
            'packageDescription' => $packageDescription,
        ];
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
     * AI 生成多语言内容.
     *
     * @return array [nameI18n, descriptionI18n]
     */
    private function generateI18nContent(string $packageName, string $packageDescription): array
    {
        $languageCodes = LanguageEnum::getAllLanguageCodes();
        $nameI18n = [];
        $descriptionI18n = [];

        foreach ($languageCodes as $langCode) {
            $nameI18n[$langCode] = ucfirst(str_replace(['-', '_'], ' ', $packageName));
            $descriptionI18n[$langCode] = ucfirst(str_replace(['-', '_'], ' ', $packageDescription));
        }

        return [$nameI18n, $descriptionI18n];
    }

    /**
     * Export skill files from project by querying the file table and packaging locally.
     * Replaces the sandbox-based export with a direct approach:
     * 1. Read .magic/skills/skill_config.yaml from project storage
     * 2. Find .magic/skills/{skill.dir} directory via file table
     * 2. Verify it contains SKILL.md
     * 3. Download files from cloud storage
     * 4. Create ZIP archive
     * 5. Upload to private storage.
     *
     * @return array{file_key: string, metadata: array} Export result
     */
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
            if (! $file->getIsDirectory() && $file->getFileName() === 'SKILL.md') {
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
            $skillDirKeyPrefix = rtrim($skillDirEntity->getFileKey(), '/') . '/';

            foreach ($allFiles as $file) {
                if ($file->getIsDirectory()) {
                    $relativePath = $this->computeRelativePath($file->getFileKey(), $skillDirKeyPrefix);
                    $localDir = $tempContentDir . '/' . $relativePath;
                    if (! is_dir($localDir)) {
                        mkdir($localDir, 0755, true);
                    }
                    continue;
                }

                $relativePath = $this->computeRelativePath($file->getFileKey(), $skillDirKeyPrefix);
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

        $configFileKey = rtrim($skillsDirEntity->getFileKey(), '/') . '/' . SkillProjectConfigUtil::CONFIG_FILE_NAME;
        $configFileEntity = $this->taskFileDomainService->getByProjectIdAndFileKey($projectId, $configFileKey);
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
     * Compute relative path by stripping the directory key prefix from the file key.
     */
    private function computeRelativePath(string $fileKey, string $dirKeyPrefix): string
    {
        if (str_starts_with($fileKey, $dirKeyPrefix)) {
            return rtrim(substr($fileKey, strlen($dirKeyPrefix)), '/');
        }
        return basename(rtrim($fileKey, '/'));
    }

    /**
     * 生成 import_token.
     *
     * @param string $packageName 包名
     * @param string $packageDescription 包描述
     * @param string $fileKey 文件 key（原始 file_key，不需要重新上传）
     * @param null|string $skillCode Skill 代码（新建时生成，更新时使用已有的）
     * @return string import_token
     */
    private function generateImportToken(string $packageName, string $packageDescription, string $fileKey, ?string $skillCode = null): string
    {
        $tokenData = [
            'package_name' => $packageName,
            'package_description' => $packageDescription,
            'file_key' => $fileKey, // 保存原始的 file_key，直接使用，不需要重新上传
            'skill_code' => $skillCode, // 保存 skillCode，用于第二阶段创建时使用
            'expires_at' => time() + self::IMPORT_TOKEN_EXPIRES,
        ];

        // 使用 Redis 存储 token 数据
        $token = IdGenerator::getUniqueIdSha256();
        $key = self::IMPORT_TOKEN_KEY_PREFIX . $token;
        $this->redis->setex($key, self::IMPORT_TOKEN_EXPIRES, json_encode($tokenData));

        return $token;
    }

    /**
     * 验证并解析 import_token.
     *
     * @return array token 数据
     */
    private function validateAndParseImportToken(string $token): array
    {
        $key = self::IMPORT_TOKEN_KEY_PREFIX . $token;
        $data = $this->redis->get($key);

        if (! $data) {
            ExceptionBuilder::throw(SkillErrorCode::INVALID_IMPORT_TOKEN, 'skill.invalid_import_token');
        }

        $tokenData = json_decode($data, true);
        if (! $tokenData || $tokenData['expires_at'] < time()) {
            ExceptionBuilder::throw(SkillErrorCode::IMPORT_TOKEN_EXPIRED, 'skill.import_token_expired');
        }

        return $tokenData;
    }

    /**
     * 删除 import_token 缓存.
     *
     * @param string $token import_token
     */
    private function deleteImportToken(string $token): void
    {
        $key = self::IMPORT_TOKEN_KEY_PREFIX . $token;
        $this->redis->del($key);
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
        $userIds = array_values(array_unique($userIds));
        $departmentIds = array_values(array_unique($departmentIds));
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $visibilityConfig = new VisibilityConfig();
        $visibilityConfig->setVisibilityType($visibilityType);

        if ($visibilityType === VisibilityType::SPECIFIC) {
            foreach ($userIds as $userId) {
                $visibilityUser = new VisibilityUser();
                $visibilityUser->setId($userId);
                $visibilityConfig->addUser($visibilityUser);
            }

            foreach ($departmentIds as $departmentId) {
                $visibilityDepartment = new VisibilityDepartment();
                $visibilityDepartment->setId($departmentId);
                $visibilityConfig->addDepartment($visibilityDepartment);
            }
        }

        $this->resourceVisibilityDomainService->saveVisibilityConfig(
            $permissionDataIsolation,
            ResourceVisibilityResourceType::SKILL,
            $code,
            $visibilityConfig
        );
    }

    private function publishImportedCrewSkill(
        RequestContext $requestContext,
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity
    ): void {
        $publishRequestDTO = new PublishSkillRequestDTO();
        $publishRequestDTO->setVersion(sprintf(
            '%d.0.0',
            $this->skillDomainService->countSkillVersionsByCode($dataIsolation, $skillEntity->getCode()) + 1
        ));
        $publishRequestDTO->setVersionDescriptionI18n($skillEntity->getDescriptionI18n() ?? []);
        $publishRequestDTO->setPublishTargetType(PublishTargetType::PRIVATE->value);
        $publishRequestDTO->setPublishTargetValue(null);
        $publishRequestDTO->setExportFileFromProject(false);

        $this->executePublishSkill(
            $requestContext->getUserAuthorization(),
            $dataIsolation,
            $skillEntity,
            $skillEntity->getCode(),
            $publishRequestDTO
        );
    }

    private function executePublishSkill(
        MagicUserAuthorization $authorization,
        SkillDataIsolation $dataIsolation,
        SkillEntity $skillEntity,
        string $code,
        PublishSkillRequestDTO $requestDTO
    ): SkillVersionEntity {
        $versionEntity = new SkillVersionEntity();
        $versionEntity->setVersion($requestDTO->getVersion());
        $versionEntity->setVersionDescriptionI18n($requestDTO->getVersionDescriptionI18n());
        $versionEntity->setPublishTargetType($requestDTO->getPublishTargetType());
        $versionEntity->setPublishTargetValue($requestDTO->toPublishTargetValue());
        // Persist a snapshot of the SKILL.md file key on publish so non-creators
        // can still access the published skill document after the project changes.
        $taskFileEntity = $this->resolveSkillFileKeyByProjectId($skillEntity->getProjectId());
        $versionEntity->setSkillFileKey($taskFileEntity?->getFileKey());

        if ($requestDTO->getExportFileFromProject()) {
            $this->logger->info('publishSkill', ['id' => $skillEntity->getId(), 'code' => $code, 'project_id' => $skillEntity->getProjectId()]);
            $fileMetadata = $this->exportSkillFromProjectLocal($authorization, $skillEntity);
            $skillEntity->setFileKey($fileMetadata['file_key']);
            // Write back the package_name resolved from skill_config.yaml so that both
            // magic_skills and magic_skill_versions receive the correct value.
            $packageName = $fileMetadata['metadata']['package_name'] ?? '';
            if ($packageName !== '') {
                $skillEntity->setPackageName($packageName);
            }
            $this->logger->debug('publishSkill metadata resolved', ['id' => $skillEntity->getId(), 'code' => $code, 'project_id' => $skillEntity->getProjectId()]);
        }

        if (empty($skillEntity->getFileKey())) {
            ExceptionBuilder::throw(SkillErrorCode::FILE_NOT_FOUND, 'skill.file_not_found');
        }

        $versionEntity = $this->skillDomainService->publishSkill($dataIsolation, $skillEntity, $versionEntity);
        $this->syncPublishedSkillScope($dataIsolation, $skillEntity, $versionEntity);

        return $versionEntity;
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
        $userIds = array_values(array_unique(array_filter($userIds)));
        if ($userIds === []) {
            return;
        }

        $this->resourceVisibilityDomainService->addResourceVisibilityByPrincipalsIfMissing(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SKILL,
            $code,
            PrincipalType::USER,
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
        $userIds = array_values(array_unique(array_filter($userIds)));
        if ($userIds === []) {
            return;
        }

        $this->resourceVisibilityDomainService->deleteResourceVisibilityByPrincipals(
            $this->createPermissionDataIsolation($dataIsolation),
            ResourceVisibilityResourceType::SKILL,
            $code,
            PrincipalType::USER,
            $userIds
        );
    }

    private function fillLanguageCode(SkillDataIsolation $dataIsolation, SkillQuery $query): void
    {
        if ($query->getLanguageCode()) {
            return;
        }

        $query->setLanguageCode($dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value);
    }

    /**
     * 获取用户可访问的技能代码。
     * @return array<string>
     */
    private function getAccessibleSkillCodes(SkillDataIsolation $dataIsolation, ?array $resourceCode = null): array
    {
        $accessibleSkillCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $this->createPermissionDataIsolation($dataIsolation),
            $dataIsolation->getCurrentUserId(),
            ResourceVisibilityResourceType::SKILL,
            $resourceCode
        );

        return $this->mergeBuiltinSkillCodes($accessibleSkillCodes, $resourceCode);
    }

    /**
     * 获取市场已安装的技能代码。
     * @return array<string>
     */
    private function getMarketInstalledSkillCodes(SkillDataIsolation $dataIsolation): array
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
    private function mergeBuiltinSkillCodes(array $skillCodes, ?array $resourceCode = null): array
    {
        $builtinSkillCodes = BuiltinSkill::values();
        if ($resourceCode !== null) {
            $builtinSkillCodes = array_values(array_intersect($builtinSkillCodes, $resourceCode));
        }

        return array_values(array_unique(array_merge($skillCodes, $builtinSkillCodes)));
    }

    /**
     * @param array{list: SkillEntity[], total: int} $result
     * @return array{list: SkillEntity[], total: int}
     */
    private function buildSkillListResult(SkillDataIsolation $dataIsolation, array $result): array
    {
        $skillEntities = $this->skillDomainService->replaceVisibleSkillDisplayFields(
            $dataIsolation,
            $result['list']
        );

        $this->updateSkillLogoUrl($dataIsolation, $skillEntities);
        $creatorUserMap = $this->buildCreatorUserMapFromSkillEntities($dataIsolation, $skillEntities);
        $latestVersionMap = $this->buildLatestVersionMapFromSkillEntities($dataIsolation, $skillEntities);

        return [
            'list' => $skillEntities,
            'total' => $result['total'],
            'creatorUserMap' => $creatorUserMap,
            'latestVersionMap' => $latestVersionMap,
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
     * @param SkillEntity[] $skillEntities
     * @return array<string, string>
     */
    private function buildLatestVersionMapFromSkillEntities(SkillDataIsolation $dataIsolation, array $skillEntities): array
    {
        $skillCodes = array_values(array_unique(array_filter(array_map(
            static fn (SkillEntity $skillEntity) => $skillEntity->getCode(),
            $skillEntities
        ))));

        if ($skillCodes === []) {
            return [];
        }

        $publishedVersionMap = $this->skillDomainService->findCurrentPublishedVersionsByCodes($dataIsolation, $skillCodes);
        $latestVersionMap = [];
        foreach ($skillCodes as $skillCode) {
            $latestVersionMap[$skillCode] = isset($publishedVersionMap[$skillCode]) ? $publishedVersionMap[$skillCode]->getVersion() : '';
        }

        return $latestVersionMap;
    }

    /**
     * @param SkillVersionEntity[] $skillVersionEntities
     * @return array<string, string>
     */
    private function buildLatestVersionMapFromSkillVersions(array $skillVersionEntities): array
    {
        $latestVersionMap = [];
        foreach ($skillVersionEntities as $skillVersionEntity) {
            $latestVersionMap[$skillVersionEntity->getCode()] = $skillVersionEntity->getVersion();
        }

        return $latestVersionMap;
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
