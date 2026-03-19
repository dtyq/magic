<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Skill\Service;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Permission\Entity\ValueObject\OperationPermission\ResourceType as OperationPermissionResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\ResourceType as ResourceVisibilityResourceType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityType;
use App\Domain\Permission\Service\OperationPermissionDomainService;
use App\Domain\Permission\Service\ResourceVisibilityDomainService;
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
use Dtyq\CloudFile\Kernel\Struct\UploadFile;
use Dtyq\SuperMagic\Application\SuperAgent\Service\ProjectAppService;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\SkillVersionEntity;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\PublishTargetType;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\Query\SkillQuery;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\ReviewStatus;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillSourceType;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillMarketDomainService;
use Dtyq\SuperMagic\ErrorCode\SkillErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\AddSkillFromStoreRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\GetSkillFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ImportSkillRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\ParseFileImportRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\PublishSkillRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\QuerySkillVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Request\UpdateSkillInfoRequestDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\ParseFileImportResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillDetailResponseDTO;
use Dtyq\SuperMagic\Interfaces\Skill\DTO\Response\SkillFileUrlItemDTO;
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
    /**
     * 文件大小限制：10MB（文档要求）
     * 用于校验上传的压缩包文件大小上限.
     */
    private const MAX_FILE_SIZE = 10 * 1024 * 1024;

    /**
     * 解压后文件总大小限制：10MB（文档要求）
     * 用于防 Zip Bomb 攻击，校验解压后的文件总大小上限.
     */
    private const MAX_EXTRACTED_SIZE = 10 * 1024 * 1024;

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
        protected LockerInterface $locker,
        protected Redis $redis,
        protected ProjectAppService $projectAppService,
        protected ResourceVisibilityDomainService $resourceVisibilityDomainService,
        protected OperationPermissionDomainService $operationPermissionDomainService,
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
                    $skillCode = IdGenerator::getUniqueId32();
                    $result = $this->createSkillInternal(
                        $dataIsolation,
                        $userId,
                        $organizationCode,
                        $packageName,
                        $packageDescription,
                        $fileKey,
                        $skillCode,
                        SkillSourceType::LOCAL_UPLOAD,
                        $requestDTO->getNameI18n(),
                        $requestDTO->getDescriptionI18n(),
                        $requestDTO->getLogo()
                    );
                }

                Db::commit();

                // 6. 删除 import_token 缓存（导入成功后不再需要）
                $this->deleteImportToken($requestDTO->getImportToken());

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
            $this->saveSkillVisibility($dataIsolation, $skillEntity->getCode(), VisibilityType::ALL);
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

        // 获取用户语言偏好，从 dataIsolation 中获取
        $languageCode = $query->getLanguageCode() ?: ($dataIsolation->getLanguage() ?: LanguageEnum::EN_US->value);

        // 设置语言代码到查询对象
        if (! $query->getLanguageCode()) {
            $query->setLanguageCode($languageCode);
        }

        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $accessibleSkillCodes = $this->resourceVisibilityDomainService->getUserAccessibleResourceCodes(
            $permissionDataIsolation,
            $dataIsolation->getCurrentUserId(),
            ResourceVisibilityResourceType::SKILL
        );

        $result = $this->skillDomainService->queriesByCodes($dataIsolation, $accessibleSkillCodes, $query, $page);

        $skillEntities = $this->skillDomainService->replaceVisibleSkillDisplayFields(
            $dataIsolation,
            $result['list']
        );

        // 批量更新 logo URL（如果存储的是路径，需要转换为完整URL）
        $this->updateSkillLogoUrl($dataIsolation, $skillEntities);

        return [
            'list' => $skillEntities,
            'total' => $result['total'],
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

        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $code);

        Db::beginTransaction();
        try {
            if (! $skillEntity->getSourceType()->isMarket()) {
                $this->skillDomainService->deleteSkill($dataIsolation, $code);
            }

            $this->skillDomainService->deleteUserSkillOwnership($dataIsolation, $code);
            $this->clearSkillVisibility($dataIsolation, $code);
            $this->clearSkillOwnerPermission($dataIsolation, $code);
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

        // 查询技能记录（校验权限）
        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $code);

        // 仅允许更新非商店来源的技能
        if ($skillEntity->getSourceType()->isMarket()) {
            ExceptionBuilder::throw(SkillErrorCode::STORE_SKILL_CANNOT_UPDATE, 'skill.store_skill_cannot_update');
        }

        // 更新 magic_skills 表
        $nameI18n = $requestDTO->getNameI18n();
        $descriptionI18n = $requestDTO->getDescriptionI18n();

        // 处理 logo：如果传入的是完整 URL，提取路径部分；如果为空字符串，设置为 null
        $logoPath = EasyFileTools::formatPath($requestDTO->getLogo());

        $this->skillDomainService->updateSkillInfo(
            $dataIsolation,
            $skillEntity,
            ! empty($nameI18n) ? $nameI18n : null,
            ! empty($descriptionI18n) ? $descriptionI18n : null,
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

        // 查询技能记录（校验权限）
        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $code);

        // 更新 logo URL（如果存储的是路径，需要转换为完整URL）
        $this->updateSkillLogoUrl($dataIsolation, [$skillEntity]);

        return new SkillDetailResponseDTO(
            $skillEntity->getId(),
            $skillEntity->getCode(),
            $skillEntity->getVersionId(),
            $skillEntity->getVersionCode(),
            $skillEntity->getSourceType()->value,
            $skillEntity->getIsEnabled() ? 1 : 0,
            $skillEntity->getPinnedAt(),
            $skillEntity->getNameI18n(),
            $skillEntity->getDescriptionI18n() ?? [],
            $skillEntity->getLogo() ?? '',
            $skillEntity->getPackageName(),
            $skillEntity->getPackageDescription(),
            '',
            '',
            $skillEntity->getSourceId(),
            $skillEntity->getSourceMeta(),
            $skillEntity->getProjectId(),
            $skillEntity->getLatestPublishedAt(),
            $skillEntity->getCreatedAt() ?? '',
            $skillEntity->getUpdatedAt() ?? ''
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
     * Publish a skill version.
     */
    public function publishSkill(RequestContext $requestContext, string $code, PublishSkillRequestDTO $requestDTO): SkillVersionEntity
    {
        $authorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createSkillDataIsolation($authorization);

        $skillEntity = $this->skillDomainService->findUserSkillByCode($dataIsolation, $code);

        $versionEntity = new SkillVersionEntity();
        $versionEntity->setVersion($requestDTO->getVersion());
        $versionEntity->setVersionDescriptionI18n($requestDTO->getVersionDescriptionI18n());
        $versionEntity->setPublishTargetType(PublishTargetType::from($requestDTO->getPublishTargetType()));
        $versionEntity->setPublishTargetValue($requestDTO->getPublishTargetValue());

        Db::beginTransaction();
        try {
            $versionEntity = $this->skillDomainService->publishSkill($dataIsolation, $skillEntity, $versionEntity);
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
     * @return array{list: SkillVersionEntity[], page: int, page_size: int, total: int}
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

        return [
            'list' => $result['list'],
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
            'total' => $result['total'],
        ];
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
            $skillCode = $existingSkillEntity ? $existingSkillEntity->getCode() : IdGenerator::getUniqueId32();

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

        // 检查解压后的目录，查找包含 SKILL.md 的目录（只检查一层）
        if (! is_dir($extractBaseDir)) {
            ZipUtil::removeDirectory($extractBaseDir);
            ExceptionBuilder::throw(SkillErrorCode::EXTRACTED_DIRECTORY_NOT_FOUND, 'skill.extracted_directory_not_found');
        }

        // 优先检查根目录是否包含 SKILL.md
        if (file_exists($extractBaseDir . '/SKILL.md')) {
            return $extractBaseDir;
        }

        $items = scandir($extractBaseDir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..' || $item === '__MACOSX') {
                continue;
            }
            $itemPath = $extractBaseDir . '/' . $item;
            if (is_dir($itemPath)) {
                // 检查该目录下是否包含 SKILL.md（只检查一层）
                $skillMdPath = $itemPath . '/SKILL.md';
                if (file_exists($skillMdPath)) {
                    // 找到包含 SKILL.md 的目录，返回该目录路径
                    return $itemPath;
                }
            }
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
        // 更新场景：从 magic_skills 表获取多语言内容（文档要求）
        $nameI18n = $skillEntity->getNameI18n();
        $descriptionI18n = $skillEntity->getDescriptionI18n() ?? [];

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
        $fileDir = $organizationCode . '/skills/' . $skillCode;
        $fileName = basename($localFilePath);
        $fileKey = $fileDir . '/' . $fileName;

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
        $this->saveSkillVisibility($dataIsolation, $skillEntity->getCode(), VisibilityType::ALL);
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
     */
    private function saveSkillVisibility(SkillDataIsolation $dataIsolation, string $code, VisibilityType $visibilityType): void
    {
        $permissionDataIsolation = $this->createPermissionDataIsolation($dataIsolation);
        $visibilityConfig = new VisibilityConfig([
            'visibility_type' => $visibilityType->value,
        ]);

        $this->resourceVisibilityDomainService->saveVisibilityConfig(
            $permissionDataIsolation,
            ResourceVisibilityResourceType::SKILL,
            $code,
            $visibilityConfig
        );
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
