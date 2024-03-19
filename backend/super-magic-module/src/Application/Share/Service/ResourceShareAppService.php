<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\Share\Service;

use App\Domain\Contact\Entity\MagicDepartmentEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\DepartmentOption;
use App\Domain\Contact\Repository\Facade\MagicAccountRepositoryInterface;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Service\ModelFilter\PackageFilterInterface;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\StorageBucketType;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Application\Share\Factory\ShareableResourceFactory;
use Dtyq\SuperMagic\Application\SuperAgent\Event\Publish\ProjectForkPublisher;
use Dtyq\SuperMagic\Domain\FileCollection\Service\FileCollectionDomainService;
use Dtyq\SuperMagic\Domain\Share\Constant\ResourceType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareAccessType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareFilterType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareUserType;
use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Entity\ValueObject\Query\SimilarQueryCondition;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareAccessLogDomainService;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareCopyLogDomainService;
use Dtyq\SuperMagic\Domain\Share\Service\ResourceShareDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\StorageType;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ForkProjectStartEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\ProjectForkEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\ProjectForkRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskFileDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileMetadataUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\FileTreeUtil;
use Dtyq\SuperMagic\Infrastructure\Utils\PasswordCrypt;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkDirectoryUtil;
use Dtyq\SuperMagic\Interfaces\Share\Assembler\ShareAssembler;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\BatchCancelShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CopyResourceFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\CreateShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\FindSimilarShareRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetFilesByIdsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareCopyLogsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareDetailDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\GetShareStatisticsRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Request\ResourceListRequestDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\CopyResourceFilesResponseDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareCopyLogsResponseDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareItemDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareItemWithPasswordDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareMembersResponseDTO;
use Dtyq\SuperMagic\Interfaces\Share\DTO\Response\ShareStatisticsResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Exception;
use Hyperf\Amqp\Producer;
use Hyperf\DbConnection\Db;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;
use ValueError;

use function Hyperf\Translation\trans;

/**
 * 资源分享应用服务.
 */
class ResourceShareAppService extends AbstractShareAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly ShareableResourceFactory $resourceFactory,
        private readonly ResourceShareDomainService $shareDomainService,
        private readonly ShareAssembler $shareAssembler,
        private readonly FileCollectionDomainService $fileCollectionDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly TopicRepositoryInterface $topicRepository,
        private readonly TaskDomainService $taskDomainService,
        private readonly TaskFileDomainService $taskFileDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly ProjectDomainService $projectDomainService,
        private readonly ProjectMemberDomainService $projectMemberDomainService,
        private readonly WorkspaceDomainService $workspaceDomainService,
        public readonly LoggerFactory $loggerFactory,
        private readonly PackageFilterInterface $packageFilter,
        private readonly MagicUserDomainService $magicUserDomainService,
        private readonly MagicAccountRepositoryInterface $accountRepository,
        private readonly MagicDepartmentDomainService $magicDepartmentDomainService,
        private readonly MagicDepartmentUserDomainService $departmentUserDomainService,
        private readonly ChatAppService $chatAppService,
        private readonly Producer $producer,
        private readonly ResourceShareAccessLogDomainService $accessLogDomainService,
        private readonly ResourceShareCopyLogDomainService $copyLogDomainService,
        private readonly ProjectForkRepositoryInterface $projectForkRepository,
        private readonly TaskFileRepositoryInterface $taskFileRepository,
        private readonly RequestInterface $request
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 创建分享.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param CreateShareRequestDTO $dto 创建分享请求DTO
     * @return ShareItemDTO 分享项目DTO
     * @throws Exception 创建分享异常
     */
    public function createShare(MagicUserAuthorization $userAuthorization, CreateShareRequestDTO $dto): ShareItemDTO
    {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 验证资源类型
        $resourceType = ResourceType::from($dto->resourceType);

        // 统一查询一次已存在的分享（如果存在），避免重复查询
        // 用于区分创建场景和更新场景，以及获取数据库中的原值
        // 只用 resource_id 查询，不校验 resource_type，避免类型转换(13↔12)时查询失败
        $existingShare = $this->shareDomainService->getShareByResourceId($dto->resourceId);

        // 校验 file_ids 必填条件（问题2修复：使用 hasField() 判断，区分"不传"和"传空数组"）
        $isFileCollectionType = $resourceType === ResourceType::FileCollection;
        $isFileType = $resourceType === ResourceType::File;
        $isProjectType = $resourceType === ResourceType::Project;

        // Holds the effective file IDs to use (may be resolved from file_paths below)
        $fileIds = [];

        // 创建场景：file_ids 必填（必须传递字段）
        // 更新场景：file_ids 可选（不传则保持原文件集不变）
        if ($isFileCollectionType || $isFileType) {
            if (! $dto->hasField('file_ids')) {
                // 检查是否已存在分享（更新场景可以不传 file_ids）
                if (! $existingShare) {
                    // 创建场景：file_ids 必填
                    ExceptionBuilder::throw(ShareErrorCode::FILE_IDS_REQUIRED_FOR_FILE_COLLECTION, 'share.file_ids_required_for_file_collection', []);
                }
            // else: 更新场景，不传 file_ids，保持原文件集不变
            } else {
                // 传递了 file_ids，验证内容
                $fileIds = $dto->getFileIds();
                $hasFileIds = ! empty($fileIds);

                // If file_ids is empty but file_paths is provided, resolve file_ids from paths
                if (! $hasFileIds && ! empty($dto->getFilePaths()) && $dto->getProjectId() !== null) {
                    $fileIds = $this->resolveFileIdsFromFilePaths(
                        $organizationCode,
                        $userId,
                        (int) $dto->getProjectId(),
                        $dto->getFilePaths()
                    );
                    $hasFileIds = ! empty($fileIds);
                }

                // FileCollection 类型：file_ids 不能为空
                if ($isFileCollectionType && ! $hasFileIds) {
                    ExceptionBuilder::throw(ShareErrorCode::FILE_IDS_REQUIRED_FOR_FILE_COLLECTION, 'share.file_ids_required_for_file_collection', []);
                }

                // File 类型：file_ids 必填，且只能有一个文件ID
                if ($isFileType) {
                    if (! $hasFileIds) {
                        ExceptionBuilder::throw(ShareErrorCode::FILE_IDS_REQUIRED_FOR_FILE_COLLECTION, 'share.file_ids_required_for_file', []);
                    }
                    if (count($fileIds) !== 1) {
                        ExceptionBuilder::throw(ShareErrorCode::FILE_IDS_REQUIRED_FOR_FILE_COLLECTION, 'share.file_ids_must_be_single_for_file', []);
                    }
                }
            }
        }

        // 对于 File 和 FileCollection 类型，resource_id 是雪花ID（文件集ID）
        // 对于 Topic 类型，resource_id 就是话题ID（原始ID）
        $resourceId = $dto->resourceId;

        // 真实资源id
        $realResourceId = $dto->getRealResourceId();

        // 1. 获取对应类型的资源工厂
        try {
            $factory = $this->resourceFactory->create($resourceType);
        } catch (RuntimeException $e) {
            // 使用 ExceptionBuilder 抛出不支持的资源类型异常
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported', [$resourceType->name]);
        }

        // 2. 对于 File/FileCollection 类型，如果传递了 file_ids，先验证文件并创建/更新文件集
        // 问题修复：创建场景下，文件集还不存在，需要先验证文件，再创建文件集，然后再验证资源是否可分享
        $isCreatingFileCollection = ($isFileCollectionType || $isFileType) && $dto->hasField('file_ids');
        if ($isCreatingFileCollection) {
            // 2.1. 验证文件是否存在且属于该组织
            // $fileIds is already populated in the validation block above (from file_ids or resolved from file_paths)
            $fileIdsInt = array_map(fn ($id) => (int) $id, $fileIds);
            $fileEntities = $this->taskFileDomainService->getFilesByIds($fileIdsInt);

            if (empty($fileEntities)) {
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.files_not_found', []);
            }

            // 验证文件是否属于该组织
            foreach ($fileEntities as $fileEntity) {
                if ($fileEntity->getOrganizationCode() !== $organizationCode) {
                    ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.file_not_belong_to_organization', [$fileEntity->getFileId()]);
                }
            }

            // 2.2. 验证通过后，创建或更新文件集（createFileCollection 方法会处理已存在的情况）
            $this->fileCollectionDomainService->createFileCollection(
                $userId,
                $organizationCode,
                $fileIds,
                (int) $dto->resourceId
            );
        }

        // 3. 验证资源是否存在且可分享
        $shouldSkipResourceValidation = $isCreatingFileCollection;
        if (! $shouldSkipResourceValidation) {
            if (! $factory->isResourceShareable($realResourceId, $organizationCode)) {
                if ($existingShare) {
                    $this->logger->warning('Resource not found when updating share, allowing update for historical data', [
                        'resource_id' => $resourceId,
                        'resource_type' => $resourceType->value,
                        'share_id' => $existingShare->getId(),
                        'organization_code' => $organizationCode,
                        'note' => '分享记录存在但资源不存在，可能是历史数据，允许更新分享配置',
                    ]);
                } else {
                    // 创建场景：资源不存在则不允许创建分享
                    ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.resource_not_found_or_not_shareable', [$resourceId]);
                }
            }
        }

        // 4. 验证资源所有者权限（只允许项目创建者分享，协作者不允许）
        if ($existingShare) {
            if ($existingShare->getCreatedUid() !== $userId) {
                ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.no_permission_to_share', [$resourceId]);
            }
        } else {
            if (! $factory->hasSharePermission($realResourceId, $userId, $organizationCode)) {
                ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.no_permission_to_share', [$resourceId]);
            }
        }

        // 5. 校验 share_type=5 时密码必填
        if ($dto->shareType == ShareAccessType::PasswordProtected->value && empty($dto->password)) {
            ExceptionBuilder::throw(ShareErrorCode::PASSWORD_REQUIRED, 'share.password_required_for_password_protected', []);
        }

        // 6. 如果设置了密码，检查是否是VIP用户（话题分享除外）
        if (! empty($dto->password)) {
            // 话题分享不需要VIP检查，其他类型需要
            if ($resourceType !== ResourceType::Topic) {
                if (! $this->packageFilter->isPaidSubscription($organizationCode)) {
                    ExceptionBuilder::throw(ShareErrorCode::VIP_REQUIRED_FOR_PASSWORD, 'share.vip_required_for_password', []);
                }
            }
        }

        // 7. 验证extra配置的VIP权限
        if (! empty($dto->getExtra())) {
            $extra = $dto->getExtra();
            $isVip = $this->packageFilter->isPaidSubscription($organizationCode);

            // 检查"显示原创信息"配置：设置为false时需要VIP
            if (isset($extra[CreateShareRequestDTO::EXTRA_FIELD_SHOW_ORIGINAL_INFO]) && $extra[CreateShareRequestDTO::EXTRA_FIELD_SHOW_ORIGINAL_INFO] === false) {
                if (! $isVip) {
                    ExceptionBuilder::throw(ShareErrorCode::VIP_REQUIRED_FOR_SHOW_ORIGINAL_INFO, 'share.vip_required_for_show_original_info', []);
                }
            }

            // 检查"隐藏由超级麦吉创造字样"配置：设置为true时需要VIP
            if (isset($extra[CreateShareRequestDTO::EXTRA_FIELD_HIDE_CREATED_BY_SUPER_MAGIC]) && $extra[CreateShareRequestDTO::EXTRA_FIELD_HIDE_CREATED_BY_SUPER_MAGIC] === true) {
                if (! $isVip) {
                    ExceptionBuilder::throw(ShareErrorCode::VIP_REQUIRED_FOR_HIDE_CREATED_BY_SUPER_MAGIC, 'share.vip_required_for_hide_created_by_super_magic', []);
                }
            }
        }

        if ($dto->hasField('target_ids')
            && ! empty($dto->getTargetIds())
            && $dto->shareType == ShareAccessType::TeamShare->value
            && $dto->getShareRange() === 'designated') {
            $this->validateTargetIds($dto->getTargetIds(), $organizationCode);
        }

        // 9. 获取项目ID（根据不同资源类型）
        $projectId = $this->getProjectIdByResourceType($resourceType, $realResourceId);

        // 10. 如果是项目类型（resource_type=12），需要校验能否获取到项目ID
        if ($isProjectType) {
            if (empty($projectId)) {
                ExceptionBuilder::throw(ShareErrorCode::PROJECT_NOT_FOUND_FOR_SHARE_PROJECT, 'share.project_not_found_for_share_project', []);
            }
        }
        $resourceName = ! empty($dto->getResourceName())
            ? $dto->getResourceName()
            : $factory->getResourceName($realResourceId);

        if (empty($resourceName)) {
            // 根据资源类型设置不同的默认名称
            if ($resourceType === ResourceType::Topic) {
                $resourceName = '未命名话题';
            } elseif ($resourceType === ResourceType::FileCollection || $resourceType === ResourceType::File) {
                $resourceName = '未命名文件集';
            } else {
                $resourceName = '未命名资源';
            }
        }

        // 13. 保存分享（创建或更新）- 使用领域服务
        $attributes = [
            'resource_name' => $resourceName,
            'share_type' => $dto->shareType ?? ShareAccessType::Internet->value,
            'share_project' => $dto->isShareProject(),
        ];

        // 根据 share_type 统一处理 share_range 和 target_ids
        if ($dto->shareType == ShareAccessType::TeamShare->value) {
            $actualShareRange = $dto->hasField('share_range')
                ? $dto->getShareRange()
                : ($existingShare ? $existingShare->getShareRange() : null);

            if ($dto->hasField('share_range')) {
                $attributes['share_range'] = $dto->getShareRange();
            }

            // 根据实际的 share_range 值处理 target_ids
            if ($actualShareRange === 'designated') {
                if ($dto->hasField('target_ids')) {
                    $attributes['target_ids'] = $dto->getTargetIds() ?? [];
                } elseif (! $existingShare) {
                    $attributes['target_ids'] = [];
                }
            } else {
                $attributes['target_ids'] = [];
            }
        } else {
            // 非团队分享（公开访问=4 或 密码保护=5）：明确清空这些字段
            $attributes['share_range'] = null;
            $attributes['target_ids'] = [];
        }

        if ($dto->hasField('extra')) {
            $extra = $dto->getExtra() ?? [];
            $attributes['extra'] = $extra;
        }

        if ($dto->hasField('default_open_file_id') && ($isFileCollectionType || $isFileType || $isProjectType)) {
            $fileId = $dto->getDefaultOpenFileId();
            if ($fileId === null || $fileId === '' || $fileId === '0') {
                $attributes['default_open_file_id'] = null;
            } else {
                $fileIdInt = (int) $fileId;
                $attributes['default_open_file_id'] = $fileIdInt;
            }
        }

        $passwordToSave = null;
        if ($dto->hasField('password')) {
            $passwordToSave = $dto->password;
        }

        if ($dto->hasField('expire_days')) {
            $attributes['expire_days'] = $dto->expireDays;
        } else {
            $attributes['expire_days'] = null;
        }
        $expireDaysToSave = $attributes['expire_days'] ?? null;
        // 调用 DomainService 保存分享
        $savedEntity = $this->shareDomainService->saveShare(
            $resourceId,
            $resourceType->value,
            $userId,
            $organizationCode,
            $attributes,
            $passwordToSave,      // 只有传了才更新，否则为 null
            $expireDaysToSave,    // 只有传了才更新，否则为 null
            $projectId
        );

        $shareDto = $this->shareAssembler->toDto($savedEntity);

        if (in_array($resourceType, [ResourceType::FileCollection, ResourceType::File, ResourceType::Project], true)) {
            $shareArray = $shareDto->toArray();
            $processedArray = $this->addResourceNamesToList([$shareArray], $resourceType);
            if (! empty($processedArray)) {
                // 将处理后的数据重新设置到 DTO 中
                $shareDto = ShareItemDTO::fromArray($processedArray[0]);
            }
        }

        if ($dto->isShowShareUrl()) {
            $shareUrl = $this->buildShareUrl($resourceType, $resourceId, $savedEntity, $dto);
            if ($shareUrl !== null) {
                $shareDto->shareUrl = $shareUrl;
            }
        }

        return $shareDto;
    }

    /**
     * 取消分享.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param int $shareId 分享ID
     * @return bool 是否成功
     * @throws Exception 取消分享时发生异常
     */
    public function cancelShare(MagicUserAuthorization $userAuthorization, int $shareId): bool
    {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 调用领域服务的取消分享方法
        return $this->shareDomainService->cancelShare($shareId, $userId, $organizationCode);
    }

    /**
     * @throws Exception
     */
    public function cancelShareByResourceId(MagicUserAuthorization $userAuthorization, string $resourceId): bool
    {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        $shareEntity = $this->shareDomainService->getShareByResourceId($resourceId);
        if (is_null($shareEntity)) {
            return false;
        }

        // 验证资源类型
        $resourceType = ResourceType::from($shareEntity->getResourceType());

        // 获取对应类型的资源工厂
        try {
            $factory = $this->resourceFactory->create($resourceType);
        } catch (RuntimeException $e) {
            // 使用 ExceptionBuilder 抛出不支持的资源类型异常
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported', [$resourceType->name]);
        }

        // 验证分享管理权限
        if (! $factory->hasManageSharePermission($shareEntity->getCreatedUid(), $userId, $resourceId, $organizationCode)) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.no_permission_to_cancel_share', [$resourceId]);
        }

        $shareEntity->setDeletedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $shareEntity->setUpdatedUid($userId);

        // 调用领域服务的取消分享方法
        $this->shareDomainService->saveShareByEntity($shareEntity);
        return true;
    }

    /**
     * 批量取消分享.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param BatchCancelShareRequestDTO $dto 批量取消分享请求DTO
     * @return array 空数组
     * @throws Exception 取消分享时发生异常
     */
    public function batchCancelShareByResourceIds(MagicUserAuthorization $userAuthorization, BatchCancelShareRequestDTO $dto): array
    {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();
        $resourceIds = $dto->getResourceIds();

        // 批量获取分享实体（一次性查询，提高性能）
        $shareEntities = $this->shareDomainService->getSharesByResourceIds($resourceIds);

        // 构建资源ID到分享实体的映射
        $shareEntityMap = [];
        foreach ($shareEntities as $entity) {
            $shareEntityMap[$entity->getResourceId()] = $entity;
        }

        // 遍历每个资源ID进行取消操作
        foreach ($resourceIds as $resourceId) {
            // 检查分享是否存在
            if (! isset($shareEntityMap[$resourceId])) {
                continue;
            }

            $shareEntity = $shareEntityMap[$resourceId];

            // 验证资源类型
            $resourceType = ResourceType::from($shareEntity->getResourceType());

            // 获取对应类型的资源工厂
            $factory = $this->resourceFactory->create($resourceType);

            // 验证分享管理权限
            if (! $factory->hasManageSharePermission($shareEntity->getCreatedUid(), $userId, $resourceId, $organizationCode)) {
                continue;
            }

            // 设置删除信息
            $shareEntity->setDeletedAt(date('Y-m-d H:i:s'));
            $shareEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $shareEntity->setUpdatedUid($userId);
        }

        // 批量保存所有修改的分享实体（一次性保存，提高性能）
        $entitiesToSave = array_filter(array_map(function ($resourceId) use ($shareEntityMap) {
            $entity = $shareEntityMap[$resourceId] ?? null;
            return $entity && $entity->getDeletedAt() !== null ? $entity : null;
        }, $resourceIds));

        if (! empty($entitiesToSave)) {
            $this->shareDomainService->batchSaveShareEntities(array_values($entitiesToSave));
        }

        return [];
    }

    public function checkShare(?MagicUserAuthorization $userAuthorization, string $shareCode): array
    {
        $shareEntity = $this->shareDomainService->getValidShareByCode($shareCode);
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$shareCode]);
        }

        // 验证分享访问权限
        $this->shareDomainService->validateShareAccess(
            $shareEntity,
            $userAuthorization?->getId(),
            $userAuthorization?->getOrganizationCode(),
            $shareCode
        );

        // 记录访问日志（权限验证通过后记录，确保只统计有效访问）
        // 这是所有分享类型的统一入口，一次访问只记录一次
        $this->recordAccessLog($shareEntity, $userAuthorization);

        return [
            'has_password' => ! empty($shareEntity->getPassword()),
            'user_id' => ! is_null($userAuthorization) ? $userAuthorization->getId() : '',
        ];
    }

    public function getShareDetail(?MagicUserAuthorization $userAuthorization, string $shareCode, GetShareDetailDTO $detailDTO): array
    {
        // 先获取详情内容（只获取有效的分享，已删除的分享不能访问）
        $shareEntity = $this->shareDomainService->getValidShareByCode($shareCode);
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$shareCode]);
        }

        // 验证分享访问权限
        $this->shareDomainService->validateShareAccess(
            $shareEntity,
            $userAuthorization?->getId(),
            $userAuthorization?->getOrganizationCode(),
            $shareCode
        );

        // 判断密码是否正确（使用严格比较，避免类型转换问题）
        if (! empty($shareEntity->getPassword()) && ($detailDTO->getPassword() !== PasswordCrypt::decrypt($shareEntity->getPassword()))) {
            ExceptionBuilder::throw(ShareErrorCode::PASSWORD_ERROR, 'share.password_error', [$shareCode]);
        }

        // 访问日志已在checkShare接口中统一记录

        // 调用工厂类，获取分享内容数据
        $resourceType = ResourceType::tryFrom($shareEntity->getResourceType());
        if ($resourceType === null) {
            // 资源类型无效，直接抛出异常
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported', [(string) $shareEntity->getResourceType()]);
        }

        try {
            $factory = $this->resourceFactory->create($resourceType);
        } catch (RuntimeException $e) {
            // 使用 ExceptionBuilder 抛出不支持的资源类型异常
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported', [$resourceType->name]);
        }

        // 获取实际的资源ID（通过实体方法统一处理）
        $actualResourceId = $shareEntity->getRealResourceId();
        $extra = $shareEntity->getExtra() ?? [];

        // 构建返回数据
        $result = [
            'resource_type' => $resourceType->value, // 使用枚举的整数值，而不是枚举对象
            'resource_name' => $shareEntity->getResourceName() ?: $factory->getResourceNameForDetail($shareEntity) ?: '', // 优先使用数据库中的 resource_name，如果为空则从资源获取
            'temporary_token' => AccessTokenUtil::generate((string) $shareEntity->getId(), $shareEntity->getOrganizationCode()),
            'default_open_file_id' => $shareEntity->getDefaultOpenFileId() !== null ? (string) $shareEntity->getDefaultOpenFileId() : null,
            'extra' => $extra,
            'share_project' => $shareEntity->isShareProject(),
            'data' => $factory->getResourceContent(
                $actualResourceId,
                $shareEntity->getCreatedUid(),
                $shareEntity->getOrganizationCode(),
                $detailDTO->getPage(),
                $detailDTO->getPageSize()
            ),
        ];

        // 类型转换：将内部类型12（Project）转换为外部类型13（FileCollection）+ share_project=true
        if ($resourceType === ResourceType::Project) {
            $result['resource_type'] = ResourceType::FileCollection->value;
            $result['share_project'] = true;
        }

        // 当 show_original_info 为 true 时，添加分享者信息
        if (isset($extra[CreateShareRequestDTO::EXTRA_FIELD_SHOW_ORIGINAL_INFO])
            && $extra[CreateShareRequestDTO::EXTRA_FIELD_SHOW_ORIGINAL_INFO] === true) {
            $result['creator'] = $this->getCreatorInfo(
                $shareEntity->getCreatedUid(),
                $shareEntity->getOrganizationCode()
            );
        }

        return $result;
    }

    public function getShareList(MagicUserAuthorization $userAuthorization, ResourceListRequestDTO $dto): array
    {
        $conditions = [
            'created_uid' => $userAuthorization->getId(),
            'resource_type' => $dto->getResourceType(), // 支持单个或数组
            'filter_type' => $dto->getFilterType(), // 过滤类型：all, active, expired, cancelled
        ];
        if (! empty($dto->getKeyword())) {
            $conditions['keyword'] = $dto->getKeyword();
        }
        if ($dto->getProjectId() !== null) {
            $conditions['project_id'] = $dto->getProjectId();
        }

        $result = $this->shareDomainService->getShareList($dto->getPage(), $dto->getPageSize(), $conditions);

        // 确保 total 字段存在
        $total = $result['total'] ?? 0;
        $list = $result['list'] ?? [];

        // 如果列表为空，直接返回空列表（字段结构在 DomainService 层已保证）
        if (empty($list)) {
            return [
                'total' => $total,
                'list' => [],
            ];
        }

        // 处理扩展信息：根据资源类型分组处理，确保每个资源类型都能正确设置 extend 字段
        $resourceTypes = $dto->getResourceTypes();

        if (count($resourceTypes) === 1) {
            // 单个资源类型：正常处理扩展信息
            try {
                $resourceType = ResourceType::from($resourceTypes[0]);
                $factory = $this->resourceFactory->create($resourceType);

                // 添加扩展信息
                $list = $factory->getResourceExtendList($list);

                // 动态设置 resource_name 和 main_file_name（FileCollection 和 File 类型）
                $list = $this->addResourceNamesToList($list, $resourceType);
            } catch (RuntimeException|ValueError $e) {
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported', [(string) $resourceTypes[0]]);
            }
        } else {
            // 多个资源类型：按资源类型分组处理，确保每个资源类型都能正确设置 extend 字段
            // 先按 resource_type 分组
            $groupedList = [];
            foreach ($list as $item) {
                $resourceType = $item['resource_type'] ?? 0;
                if (! isset($groupedList[$resourceType])) {
                    $groupedList[$resourceType] = [];
                }
                $groupedList[$resourceType][] = $item;
            }

            // 对每个资源类型分别处理 extend 字段和 resource_name
            $processedGroups = [];
            foreach ($groupedList as $resourceTypeValue => $items) {
                try {
                    $resourceType = ResourceType::from($resourceTypeValue);
                    $factory = $this->resourceFactory->create($resourceType);

                    // 为每个资源类型添加扩展信息
                    $processedItems = $factory->getResourceExtendList($items);

                    // 动态设置 resource_name 和 main_file_name（FileCollection 和 File 类型）
                    $processedItems = $this->addResourceNamesToList($processedItems, $resourceType);

                    $processedGroups[$resourceTypeValue] = $processedItems;
                } catch (RuntimeException|ValueError $e) {
                    // 如果资源类型不支持，为每个项添加空的 extend 字段
                    foreach ($items as &$item) {
                        if (! isset($item['extend'])) {
                            $item['extend'] = [];
                        }
                    }
                    $processedGroups[$resourceTypeValue] = $items;
                }
            }

            // 按原有顺序合并处理后的列表（保持原有顺序）
            $processedList = [];
            $groupIndexMap = []; // 记录每个资源类型组内当前处理的索引
            foreach ($list as $item) {
                $resourceType = $item['resource_type'] ?? 0;
                if (! isset($groupIndexMap[$resourceType])) {
                    $groupIndexMap[$resourceType] = 0;
                }
                // 确保索引不越界
                if (isset($processedGroups[$resourceType]) && $groupIndexMap[$resourceType] < count($processedGroups[$resourceType])) {
                    $processedList[] = $processedGroups[$resourceType][$groupIndexMap[$resourceType]];
                    ++$groupIndexMap[$resourceType];
                } else {
                    // 如果索引越界，使用原始项（不应该发生，但作为兜底）
                    $processedList[] = $item;
                }
            }

            $list = $processedList;
        }

        // 添加项目名称（确保所有项都有 project_name 字段）
        $list = $this->addProjectNamesToList($list);

        // 添加 file_ids（仅 resource_type=13/15）
        $list = $this->addFileIdsToList($list);

        // 添加工作区信息（确保所有项都有 workspace_id 和 workspace_name 字段）
        $list = $this->addWorkspaceInfoToList($list);

        // 添加复制次数（确保所有项都有 copy_count 字段）
        $list = $this->addCopyCountsToList($list);

        // 根据资源类型添加特定字段
        $list = $this->addFieldsByResourceType($list);

        // 为有密码的分享项添加解密后的密码字段
        $list = $this->addDecryptedPasswordsToList($list);

        // 类型转换：将内部类型12（Project）转换为外部类型13（FileCollection）+ share_project=true
        $list = $this->convertProjectTypeForShareList($list);

        return [
            'total' => $total,
            'list' => $list,
        ];
    }

    /**
     * 通过分享code获取分享信息（不含密码）.
     *
     * @param null|MagicUserAuthorization $userAuthorization 当前用户（可以为null）
     * @param string $shareCode 分享code
     * @return ShareItemDTO 分享项目DTO
     * @throws Exception 获取分享信息异常
     */
    public function getShareByCode(?MagicUserAuthorization $userAuthorization, string $shareCode): ShareItemDTO
    {
        // 获取并验证实体
        $shareEntity = $this->getAndValidateShareEntity($userAuthorization, $shareCode);

        // 使用装配器创建基础DTO（不含密码）
        return $this->shareAssembler->toDto($shareEntity);
    }

    /**
     * 通过分享code获取分享信息（含明文密码）.
     * 注意：此方法仅应在特定场景下使用，需谨慎处理返回的密码信息.
     * 安全限制：只有分享的创建者才能查看明文密码.
     *
     * @param null|MagicUserAuthorization $userAuthorization 当前用户（可以为null）
     * @param string $shareCode 分享code
     * @return ShareItemWithPasswordDTO 包含密码的分享项目DTO
     * @throws Exception 获取分享信息异常
     */
    public function getShareWithPasswordByCode(?MagicUserAuthorization $userAuthorization, string $shareCode): ShareItemWithPasswordDTO
    {
        // 获取并验证实体
        try {
            // 先获取分享实体（不验证访问权限，因为创建者应该可以查看自己创建的分享）
            $shareEntity = $this->shareDomainService->getShareByCode($shareCode);

            // 验证分享是否存在
            if (empty($shareEntity)) {
                ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$shareCode]);
            }

            // Security check: only the creator can view the plain text password
            if ($userAuthorization === null || $shareEntity->getCreatedUid() !== $userAuthorization->getId()) {
                // 如果不是创建者，需要验证访问权限
                $this->shareDomainService->validateShareAccess(
                    $shareEntity,
                    $userAuthorization?->getId(),
                    $userAuthorization?->getOrganizationCode(),
                    $shareCode
                );
                // 如果不是创建者，不允许查看明文密码
                ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$shareCode]);
            }

            // 使用装配器创建包含密码的DTO
            return $this->shareAssembler->toDtoWithPassword($shareEntity);
        } catch (BusinessException $e) {
            return new ShareItemWithPasswordDTO();
        }
    }

    /**
     * 根据分享代码获取分享实体.
     *
     * @param string $shareCode 分享代码
     * @return null|ResourceShareEntity 分享实体，如果不存在则返回null
     */
    public function getShare(string $shareCode): ?ResourceShareEntity
    {
        return $this->shareDomainService->getShareByCode($shareCode);
    }

    /**
     * 获取分享资源对应的文件列表.
     *
     * @param null|MagicUserAuthorization $userAuthorization 当前用户（可以为null）
     * @param string $shareCode 分享code
     * @param GetShareFilesRequestDTO $dto 请求DTO
     * @return array 文件列表及树结构
     * @throws Exception 如果验证失败或操作失败
     */
    public function getShareFiles(?MagicUserAuthorization $userAuthorization, string $shareCode, GetShareFilesRequestDTO $dto): array
    {
        // 1. 获取分享实体（只获取有效的分享，已删除的分享不能访问）
        $shareEntity = $this->shareDomainService->getValidShareByCode($shareCode);
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$shareCode]);
        }

        // 2. 验证分享访问权限
        $this->shareDomainService->validateShareAccess(
            $shareEntity,
            $userAuthorization?->getId(),
            $userAuthorization?->getOrganizationCode(),
            $shareCode
        );

        // 3. 验证密码（使用严格比较，避免类型转换问题）
        if (! empty($shareEntity->getPassword()) && ($dto->getPassword() !== PasswordCrypt::decrypt($shareEntity->getPassword()))) {
            ExceptionBuilder::throw(ShareErrorCode::PASSWORD_ERROR, 'share.password_error', [$shareCode]);
        }

        // 访问日志已在checkShare接口中统一记录

        // 4. 判断资源类型，支持 Project、FileCollection、Topic、File 四种类型
        $resourceType = ResourceType::tryFrom($shareEntity->getResourceType());
        if (! in_array($resourceType, [ResourceType::Project, ResourceType::FileCollection, ResourceType::Topic, ResourceType::File], true)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED, 'share.resource_type_not_supported_for_files', [$resourceType->name ?? '']);
        }

        // 5. 根据资源类型获取文件列表
        $organizationCode = $shareEntity->getOrganizationCode();
        $dataIsolation = DataIsolation::create($organizationCode, '');

        if ($resourceType === ResourceType::Project) {
            // Project类型：直接获取项目的所有文件
            $projectId = (int) $shareEntity->getProjectId();
            if ($projectId === 0) {
                return [
                    'list' => [],
                    'tree' => [],
                    'total' => 0,
                ];
            }
            return $this->getFilesFromProject($projectId, $organizationCode, $dataIsolation, $dto);
        }

        if ($resourceType === ResourceType::FileCollection) {
            // FileCollection类型：从文件集获取文件列表
            return $this->getFilesFromFileCollection($shareEntity, $dto);
        }

        if ($resourceType === ResourceType::File) {
            // File类型：返回单个文件
            return $this->getFilesFromSingleFile($shareEntity, $dto);
        }

        // Topic类型：获取话题所属项目的所有文件，但使用话题的workDir计算相对路径
        $topicId = (int) $shareEntity->getResourceId();
        $topicEntity = $this->topicDomainService->getTopicById($topicId);

        if (empty($topicEntity)) {
            return [
                'list' => [],
                'tree' => [],
                'total' => 0,
            ];
        }

        $projectId = (int) $topicEntity->getProjectId();
        if ($projectId === 0) {
            return [
                'list' => [],
                'tree' => [],
                'total' => 0,
            ];
        }

        // 使用话题的 workDir 来计算相对路径，确保层级目录正确
        $workDir = $topicEntity->getWorkDir();
        return $this->getFilesFromProject($projectId, $organizationCode, $dataIsolation, $dto, $workDir);
    }

    /**
     * 复制资源文件到新项目.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param CopyResourceFilesRequestDTO $requestDTO 请求DTO
     * @return array 复制结果
     * @throws Exception
     */
    public function copyResourceFiles(
        MagicUserAuthorization $userAuthorization,
        CopyResourceFilesRequestDTO $requestDTO
    ): array {
        $this->logger->info('Starting resource files copy process');

        // 1. 验证分享并获取分享实体（只获取有效的分享，已删除或已过期的分享不能复制）
        $shareEntity = $this->shareDomainService->getValidShareByResourceId($requestDTO->getResourceId());
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, trans('share.resource_not_found'));
        }

        // 2. 验证分享访问权限
        $this->shareDomainService->validateShareAccess(
            $shareEntity,
            $userAuthorization->getId(),
            $userAuthorization->getOrganizationCode(),
            $shareEntity->getShareCode()
        );

        // 3. 验证密码（如果设置了密码，使用严格比较，避免类型转换问题）
        if (! empty($shareEntity->getPassword())) {
            if (empty($requestDTO->getPassword())
                || $requestDTO->getPassword() !== PasswordCrypt::decrypt($shareEntity->getPassword())) {
                ExceptionBuilder::throw(ShareErrorCode::PASSWORD_ERROR, trans('share.password_error'));
            }
        }

        // 记录访问日志（复制操作单独统计）
        $this->recordAccessLog($shareEntity, $userAuthorization);

        // 4. 检查是否允许复制项目文件
        $allowCopyProjectFiles = $shareEntity->getExtraAttribute(
            CreateShareRequestDTO::EXTRA_FIELD_ALLOW_COPY_PROJECT_FILES,
            true
        );

        if (! $allowCopyProjectFiles) {
            ExceptionBuilder::throw(
                ShareErrorCode::COPY_PROJECT_FILES_NOT_ALLOWED,
                trans('share.copy_project_files_not_allowed')
            );
        }

        // 5. 判断资源类型，支持 Project、FileCollection、File 三种类型
        $resourceType = ResourceType::tryFrom($shareEntity->getResourceType());
        if (! in_array($resourceType, [ResourceType::Project, ResourceType::FileCollection, ResourceType::File], true)) {
            ExceptionBuilder::throw(
                ShareErrorCode::RESOURCE_TYPE_NOT_SUPPORTED,
                trans('share.resource_type_not_supported_for_copy', [$resourceType->name ?? ''])
            );
        }

        // 6. 获取源项目ID和要复制的文件列表
        $sourceProjectId = (int) $shareEntity->getProjectId();
        if ($sourceProjectId <= 0) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, trans('share.project_not_found'));
        }

        $fileIds = $this->getFileIdsToCopy($shareEntity, $resourceType);

        // 7. 调用项目服务执行复制（复用fork逻辑）
        return $this->executeCopy(
            $userAuthorization,
            $sourceProjectId,
            $requestDTO->getTargetWorkspaceId(),
            $requestDTO->getTargetProjectName(),
            $fileIds
        );
    }

    /**
     * 根据文件ID列表查找文件集分享（返回所有匹配的分享）.
     *
     * 查找包含指定文件ID集合的文件集（FileCollection）或单文件（File）类型的分享记录。
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param FindSimilarShareRequestDTO $dto 查找请求DTO
     * @return array ShareItemDTO[] 找到的所有分享DTO数组
     * @throws Exception 查找分享异常
     */
    public function findSimilarShare(MagicUserAuthorization $userAuthorization, FindSimilarShareRequestDTO $dto): array
    {
        // 从 MagicUserAuthorization 创建 DataIsolation（使用 trait 提供的方法）
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 从 DTO 创建 SimilarQueryCondition（Domain 层对象）
        $condition = new SimilarQueryCondition();
        $condition->setProjectId($dto->getProjectId());
        $condition->setFileIds($dto->getFileIds());
        $condition->setResourceType($dto->getResourceType());

        // 1. 查询分享实体（核心逻辑）
        $shareEntities = $this->querySimilarShares($dataIsolation, $condition);

        if (empty($shareEntities)) {
            return [];
        }

        // 2. 统计项目文件数量（如果需要）
        $projectFileCountMap = $this->shareDomainService->calculateProjectFileCounts($shareEntities, $condition->getResourceType());

        // 3. 构建响应数组
        $result = $this->buildSimilarShareResponse($shareEntities, $condition, $projectFileCountMap);

        // 4. 丰富扩展字段
        return $this->enrichShareListFields($result);
    }

    /**
     * 获取分享统计信息.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param GetShareStatisticsRequestDTO $dto 统计请求DTO
     * @return ShareStatisticsResponseDTO 统计信息DTO
     * @throws Exception 如果获取统计信息失败
     */
    public function getShareStatistics(
        MagicUserAuthorization $userAuthorization,
        GetShareStatisticsRequestDTO $dto
    ): ShareStatisticsResponseDTO {
        // 1. 验证权限并获取分享实体
        $shareEntity = $this->validateSharePermission(
            $userAuthorization,
            $dto->getResourceId(),
            'share.no_permission_to_view_statistics'
        );

        // 2. 获取访问统计信息（与日志列表使用相同的过滤条件，保持一致性）
        $statistics = $this->accessLogDomainService->getAccessStatistics(
            $shareEntity->getId(),
            $dto->getStartDate(),
            $dto->getEndDate(),
            $dto->getUserType()
        );

        // 3. 获取访问日志列表
        $accessLogs = $this->accessLogDomainService->getAccessLogs(
            $shareEntity->getId(),
            $dto->getPage(),
            $dto->getPageSize(),
            $dto->getStartDate(),
            $dto->getEndDate(),
            $dto->getUserType()
        );

        // 4. 批量查询并填充用户名（如果有user_id但user_name为空）
        $this->fillUserNamesForLogs($accessLogs['list'], true, false);

        // 5. 构建响应DTO
        $responseDTO = new ShareStatisticsResponseDTO();
        $responseDTO->setTotalCount($statistics['total_count']);
        $responseDTO->setTodayCount($statistics['today_count']);
        $responseDTO->setTeamMemberCount($statistics['team_member_count']);
        $responseDTO->setAnonymousCount($statistics['anonymous_count']);
        $responseDTO->setAccessLogs($accessLogs['list']);
        $responseDTO->setAccessLogsTotal($accessLogs['total']);

        // 6. 对于文件集和单文件类型，添加复制次数和文件数量
        $resourceType = ResourceType::tryFrom($shareEntity->getResourceType());
        if ($resourceType === null) {
            // 资源类型无效，跳过复制次数和文件数量的统计
            return $responseDTO;
        }

        if ($resourceType === ResourceType::FileCollection || $resourceType === ResourceType::File || $resourceType === ResourceType::Project) {
            // 获取复制次数（使用与复制日志接口相同的逻辑，保持一致性）
            $projectId = $shareEntity->getProjectId();
            if (! empty($projectId)) {
                // 注意：复制操作需要登录，所以不会有匿名用户
                // 如果 user_type 是 anonymous，复制次数应该为 0
                $copyUserType = $dto->getUserType();
                if ($copyUserType === ShareUserType::Anonymous->value) {
                    $responseDTO->setCopyCount(0);
                } else {
                    // 根据 filter_type 决定是否包含已删除项目的复制记录
                    $includeDeletedProjects = $this->shouldIncludeDeletedProjects(
                        $dto->getFilterType(),
                        $shareEntity
                    );

                    // 使用与复制日志接口相同的统计方法，支持时间范围和用户类型过滤
                    $copyStatistics = $this->copyLogDomainService->getCopyStatistics(
                        (int) $projectId,
                        $shareEntity->getOrganizationCode(),
                        $dto->getStartDate(),
                        $dto->getEndDate(),
                        $copyUserType,  // 只支持 team_member 或 guest，null 表示所有类型
                        $includeDeletedProjects  // 传入参数：是否包含已删除项目
                    );
                    $responseDTO->setCopyCount($copyStatistics['total_count']);
                }
            } else {
                // 如果没有项目ID，记录警告日志（问题2修复：提高可观测性）
                $this->logger->warning('分享记录缺少 project_id，无法统计复制次数', [
                    'share_id' => $shareEntity->getId(),
                    'resource_id' => $shareEntity->getResourceId(),
                    'resource_type' => $resourceType->name,
                    'resource_type_value' => $resourceType->value,
                    'organization_code' => $shareEntity->getOrganizationCode(),
                    'created_uid' => $shareEntity->getCreatedUid(),
                ]);
                $responseDTO->setCopyCount(0);
            }

            // 获取文件数量
            // 根据 resource_type 决定如何计算 file_count：
            // - 如果 resource_type=12（项目类型）：file_count 等于当前项目的文件数量
            // - 其他类型：file_count 等于遍历file_ids计算的实际文件数量（考虑文件夹递归）
            if ($resourceType === ResourceType::Project) {
                // 项目分享：统计项目的所有文件数量
                $projectId = $shareEntity->getProjectId();
                if (! empty($projectId)) {
                    $projectFileCounts = $this->taskFileRepository->countFilesByProjectIds([(int) $projectId]);
                    $responseDTO->setFileCount($projectFileCounts[(int) $projectId] ?? 0);
                } else {
                    $responseDTO->setFileCount(0);
                }
            } else {
                // 文件分享：统计文件集中的实际文件数量（考虑文件夹递归）
                // 依据：没有开启项目分享时，需要遍历file_ids，检查每个ID是否为文件夹
                // 如果是文件夹，递归计算其包含的文件数量
                $collectionId = (int) $shareEntity->getResourceId();
                $actualFileCount = $this->calculateFileCountFromCollection($collectionId);
                $responseDTO->setFileCount($actualFileCount);
            }
        }

        return $responseDTO;
    }

    /**
     * 获取分享复制记录.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param GetShareCopyLogsRequestDTO $dto 复制记录请求DTO
     * @return ShareCopyLogsResponseDTO 复制记录DTO
     * @throws Exception 如果获取复制记录失败
     */
    public function getShareCopyLogs(
        MagicUserAuthorization $userAuthorization,
        GetShareCopyLogsRequestDTO $dto
    ): ShareCopyLogsResponseDTO {
        // 1. 验证权限并获取分享实体
        $shareEntity = $this->validateSharePermission(
            $userAuthorization,
            $dto->getResourceId(),
            'share.no_permission_to_view_copy_logs'
        );

        // 2. 获取项目ID（复制记录通过 source_project_id 关联）
        $projectId = $shareEntity->getProjectId();
        if (empty($projectId)) {
            // 如果没有项目ID，记录警告日志（问题2修复：提高可观测性）
            $resourceType = ResourceType::tryFrom($shareEntity->getResourceType());
            $this->logger->warning('分享记录缺少 project_id，无法查询复制日志', [
                'share_id' => $shareEntity->getId(),
                'resource_id' => $shareEntity->getResourceId(),
                'resource_type' => $resourceType !== null ? $resourceType->name : $shareEntity->getResourceType(),
                'resource_type_value' => $shareEntity->getResourceType(),
                'organization_code' => $shareEntity->getOrganizationCode(),
                'created_uid' => $shareEntity->getCreatedUid(),
            ]);

            // 如果没有项目ID，返回空结果（只有文件集和单文件类型才有复制记录）
            $responseDTO = new ShareCopyLogsResponseDTO();
            $responseDTO->setTotalCount(0);
            $responseDTO->setTodayCount(0);
            $responseDTO->setTeamMemberCount(0);
            $responseDTO->setGuestCount(0);
            $responseDTO->setCopyLogs([]);
            $responseDTO->setCopyLogsTotal(0);
            return $responseDTO;
        }

        // 3. 根据 filter_type 决定是否包含已删除项目的复制记录
        $includeDeletedProjects = $this->shouldIncludeDeletedProjects(
            $dto->getFilterType(),
            $shareEntity
        );

        // 4. 获取复制统计信息
        $statistics = $this->copyLogDomainService->getCopyStatistics(
            (int) $projectId,
            $shareEntity->getOrganizationCode(),
            $dto->getStartDate(),
            $dto->getEndDate(),
            $dto->getUserType(),
            $includeDeletedProjects  // 传入参数：是否包含已删除项目
        );

        // 5. 获取复制日志列表
        $copyLogs = $this->copyLogDomainService->getCopyLogs(
            (int) $projectId,
            $shareEntity->getOrganizationCode(),
            $dto->getPage(),
            $dto->getPageSize(),
            $dto->getStartDate(),
            $dto->getEndDate(),
            $dto->getUserType(),
            $includeDeletedProjects  // 传入参数：是否包含已删除项目
        );

        // 6. 批量查询并填充用户名（如果有user_id，需要匹配组织代码优先级）
        $this->fillUserNamesForLogs($copyLogs['list'], false, true);

        // 7. 构建响应DTO
        $responseDTO = new ShareCopyLogsResponseDTO();
        $responseDTO->setTotalCount($statistics['total_count']);
        $responseDTO->setTodayCount($statistics['today_count']);
        $responseDTO->setTeamMemberCount($statistics['team_member_count']);
        $responseDTO->setGuestCount($statistics['guest_count']);
        $responseDTO->setCopyLogs($copyLogs['list']);
        $responseDTO->setCopyLogsTotal($copyLogs['total']);

        return $responseDTO;
    }

    /**
     * 获取分享成员列表.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param string $resourceId 资源ID
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @return ShareMembersResponseDTO 成员列表响应DTO
     */
    public function getShareMembers(
        MagicUserAuthorization $userAuthorization,
        string $resourceId,
        DataIsolation $dataIsolation
    ): ShareMembersResponseDTO {
        // 1. 获取分享信息
        $shareEntity = $this->shareDomainService->getShareByResourceId($resourceId);

        if ($shareEntity === null) {
            ExceptionBuilder::throw(ShareErrorCode::NOT_FOUND, 'share.not_found', [$resourceId]);
        }

        // 2. 权限验证：只有分享创建者可以查看成员列表
        if ($shareEntity->getCreatedUid() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.permission_denied', [$resourceId]);
        }

        // 3. 获取 target_ids
        $targetIds = $shareEntity->getTargetIdsArray();

        // 如果没有 target_ids，返回空列表
        if (empty($targetIds)) {
            return ShareMembersResponseDTO::fromEmpty();
        }

        // 4. 解析 target_ids，分离用户ID和部门ID
        [$userIds, $departmentIds] = $this->shareDomainService->parseTargetIds($targetIds);

        // 5. 如果分享有关联项目，尝试从项目成员表获取 role 和 join_method
        $projectId = $shareEntity->getProjectId();
        $projectMemberMap = []; // key: target_id, value: ProjectMemberEntity
        if (! empty($projectId) && is_numeric($projectId)) {
            $projectIdInt = (int) $projectId;
            // 批量查询用户的项目成员信息
            if (! empty($userIds)) {
                $userProjectMembers = $this->projectMemberDomainService->getMembersByIds($projectIdInt, $userIds);
                foreach ($userProjectMembers as $member) {
                    $projectMemberMap[$member->getTargetId()] = $member;
                }
            }
            // 批量查询部门的项目成员信息
            if (! empty($departmentIds)) {
                $deptProjectMembers = $this->projectMemberDomainService->getMembersByProjectAndDepartmentIds($projectIdInt, $departmentIds);
                foreach ($deptProjectMembers as $member) {
                    $projectMemberMap[$member->getTargetId()] = $member;
                }
            }
        }

        // 6. 获取用户详细信息
        $users = [];
        if (! empty($userIds)) {
            $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization($userIds);
            $this->updateUserAvatarUrl($dataIsolation, $userEntities);

            // 获取用户所属部门
            $departmentUsers = $this->departmentUserDomainService->getDepartmentUsersByUserIdsInMagic($userIds);
            $userIdMapDepartmentIds = [];
            foreach ($departmentUsers as $departmentUser) {
                if (! $departmentUser->isTopLevel()) {
                    $userIdMapDepartmentIds[$departmentUser->getUserId()] = $departmentUser->getDepartmentId();
                }
            }

            // 获取部门完整路径
            $allDepartmentIds = array_values($userIdMapDepartmentIds);
            $depIdMapDepartmentsInfos = [];
            if (! empty($allDepartmentIds)) {
                $depIdMapDepartmentsInfos = $this->magicDepartmentDomainService->getDepartmentFullPathByIds(
                    $dataIsolation,
                    $allDepartmentIds
                );
            }

            // 组装用户数据
            foreach ($userEntities as $userEntity) {
                $pathNodes = [];
                if (isset($userIdMapDepartmentIds[$userEntity->getUserId()])) {
                    $deptId = $userIdMapDepartmentIds[$userEntity->getUserId()];
                    foreach ($depIdMapDepartmentsInfos[$deptId] ?? [] as $departmentInfo) {
                        $pathNodes[] = $this->assemblePathNodeByDepartmentInfo($departmentInfo);
                    }
                }

                // 如果该用户是项目成员，使用项目成员表中的 role 和 join_method
                $role = '';
                $joinMethod = '';
                if (isset($projectMemberMap[$userEntity->getUserId()])) {
                    $projectMember = $projectMemberMap[$userEntity->getUserId()];
                    $role = $projectMember->getRole()->value;
                    $joinMethod = $projectMember->getJoinMethod()->value;
                }

                $users[] = [
                    'id' => (string) $userEntity->getId(),
                    'user_id' => $userEntity->getUserId(),
                    'name' => $userEntity->getNickname(),
                    'i18n_name' => $userEntity->getI18nName() ?? '',
                    'organization_code' => $userEntity->getOrganizationCode(),
                    'avatar_url' => $userEntity->getAvatarUrl() ?? '',
                    'type' => 'User',
                    'path_nodes' => $pathNodes,
                    'role' => $role,
                    'join_method' => $joinMethod,
                ];
            }
        }

        // 7. 获取部门详细信息
        $departments = [];
        if (! empty($departmentIds)) {
            $departmentEntities = $this->magicDepartmentDomainService->getDepartmentByIds(
                $dataIsolation,
                $departmentIds
            );

            // 获取部门完整路径
            $depIdMapDepartmentsInfos = $this->magicDepartmentDomainService->getDepartmentFullPathByIds(
                $dataIsolation,
                $departmentIds
            );

            foreach ($departmentEntities as $departmentEntity) {
                $pathNodes = [];
                foreach ($depIdMapDepartmentsInfos[$departmentEntity->getDepartmentId()] ?? [] as $departmentInfo) {
                    $pathNodes[] = $this->assemblePathNodeByDepartmentInfo($departmentInfo);
                }

                // 如果该部门是项目成员，使用项目成员表中的 role 和 join_method
                $role = '';
                $joinMethod = '';
                if (isset($projectMemberMap[$departmentEntity->getDepartmentId()])) {
                    $projectMember = $projectMemberMap[$departmentEntity->getDepartmentId()];
                    $role = $projectMember->getRole()->value;
                    $joinMethod = $projectMember->getJoinMethod()->value;
                }

                $departments[] = [
                    'id' => (string) $departmentEntity->getId(),
                    'department_id' => $departmentEntity->getDepartmentId(),
                    'name' => $departmentEntity->getName(),
                    'i18n_name' => $departmentEntity->getI18nName() ?? '',
                    'organization_code' => $departmentEntity->getOrganizationCode() ?? $shareEntity->getOrganizationCode(),
                    'avatar_url' => '',
                    'type' => 'Department',
                    'path_nodes' => $pathNodes,
                    'role' => $role,
                    'join_method' => $joinMethod,
                ];
            }
        }

        // 7. 使用ResponseDTO返回结果
        return ShareMembersResponseDTO::fromMemberData($users, $departments);
    }

    /**
     * 获取分享的项目树形结构（按工作区分组）.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param array $resourceTypes 资源类型数组
     * @return array 树形结构数据
     */
    public function getSharedProjectsTree(MagicUserAuthorization $userAuthorization, array $resourceTypes): array
    {
        $userId = $userAuthorization->getId();

        // 从分享表查询去重的项目ID列表
        $projectIds = $this->shareDomainService->getSharedProjectIdsByUser($userId, $resourceTypes);

        // 如果没有分享任何项目，直接返回空数组
        if (empty($projectIds)) {
            return [];
        }

        // 根据项目ID列表，批量查询项目实体（包含 id, name, workspace_id）
        $projectEntities = $this->projectDomainService->getProjectsByIds($projectIds);

        // 如果项目不存在或已删除，返回空数组
        if (empty($projectEntities)) {
            return [];
        }

        // 从项目实体中提取所有工作区ID（只提取自己创建的项目的工作区）
        $workspaceIds = [];
        foreach ($projectEntities as $project) {
            $projectCreatorUid = $project->getCreatedUid();
            $workspaceId = $project->getWorkspaceId();

            // 只查询自己创建的项目的工作区名称
            if ($projectCreatorUid === $userId && $workspaceId !== null) {
                $workspaceIds[] = $workspaceId;
            }
        }
        $workspaceIds = array_unique($workspaceIds);

        // 批量查询工作区名称（返回 [id => name] 映射）
        $workspaceNameMap = [];
        if (! empty($workspaceIds)) {
            $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);
        }

        // 按工作区分组，构建 workspace -> projects 的树形结构
        $workspaceMap = [];

        foreach ($projectEntities as $project) {
            $projectId = (string) $project->getId();
            $projectName = $project->getProjectName();
            $workspaceId = $project->getWorkspaceId();
            $projectCreatorUid = $project->getCreatedUid();

            // 判断是否是自己创建的项目
            $isOwnProject = ($projectCreatorUid === $userId);

            if ($isOwnProject) {
                // 自己的项目 - 显示真实工作区名称
                $workspaceName = '未分类工作区';
                if ($workspaceId !== null && isset($workspaceNameMap[$workspaceId])) {
                    $workspaceName = $workspaceNameMap[$workspaceId];
                }
                // 使用字符串 'null' 作为未分类工作区的key（避免数组key冲突）
                $workspaceKey = $workspaceId ?? 'null';
            } else {
                // 他人共享的项目 - 统一显示"共享工作区"
                $workspaceName = '共享工作区';
                $workspaceKey = 'shared';  // 统一key，所有共享项目归到一起
                $workspaceId = null;  // 隐藏真实workspace_id
            }

            // 初始化工作区（如果还没有）
            if (! isset($workspaceMap[$workspaceKey])) {
                $workspaceMap[$workspaceKey] = [
                    'workspace_id' => $workspaceId !== null ? (string) $workspaceId : '',
                    'workspace_name' => $workspaceName,
                    'projects' => [],
                ];
            }

            // 添加项目到对应的工作区
            $workspaceMap[$workspaceKey]['projects'][] = [
                'project_id' => $projectId,
                'project_name' => $projectName,
            ];
        }

        // 将关联数组转为索引数组
        $tree = array_values($workspaceMap);

        // 工作区排序：按名称排序，"共享工作区"和"未分类工作区"放最后
        usort($tree, function ($a, $b) {
            // 共享工作区排在最后
            if ($a['workspace_name'] === '共享工作区') {
                return 1;
            }
            if ($b['workspace_name'] === '共享工作区') {
                return -1;
            }
            // 未分类工作区排在倒数第二
            if ($a['workspace_name'] === '未分类工作区') {
                return 1;
            }
            if ($b['workspace_name'] === '未分类工作区') {
                return -1;
            }
            // 其他工作区按名称字母顺序排序
            return strcmp($a['workspace_name'], $b['workspace_name']);
        });

        // 每个工作区内的项目按名称排序
        foreach ($tree as &$workspace) {
            usort($workspace['projects'], function ($a, $b) {
                return strcmp($a['project_name'], $b['project_name']);
            });
        }

        return $tree;
    }

    /**
     * 根据文件ID数组批量获取文件详情.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param GetFilesByIdsRequestDTO $dto 请求DTO
     * @return TaskFileEntity[] 文件实体数组
     */
    public function getFilesByIds(
        MagicUserAuthorization $userAuthorization,
        GetFilesByIdsRequestDTO $dto
    ): array {
        // 1. 从DTO获取文件ID数组
        $fileIds = $dto->getFileIds();

        // 2. 调用Domain层批量查询,直接返回Entity数组
        return $this->shareDomainService->getFilesByIds($fileIds);
    }

    /**
     * 根据查询条件查询相似分享实体.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param SimilarQueryCondition $condition 查询条件
     * @return array ResourceShareEntity[] 分享实体数组
     * @throws InvalidArgumentException 当参数无效时
     */
    private function querySimilarShares(DataIsolation $dataIsolation, SimilarQueryCondition $condition): array
    {
        // 从 DataIsolation 中提取用户ID和组织代码
        $userId = $dataIsolation->getCurrentUserId() ?? '';
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 验证必要参数
        if (empty($userId) || empty($organizationCode)) {
            throw new InvalidArgumentException('用户ID或组织代码不能为空');
        }

        // 从 SimilarQueryCondition 中提取查询条件
        $resourceType = $condition->getResourceType();
        $projectId = $condition->getProjectId();
        $fileIds = $condition->getFileIds();

        // 根据 resourceType 决定查询逻辑（编排逻辑）
        if ($resourceType === ResourceType::Project->value) {
            // 项目查找模式（resource_type = 12）
            return $this->shareDomainService->findSharesByProjectId(
                $userId,
                $organizationCode,
                $projectId
            );
        }

        // 文件查找模式（原有逻辑）
        return $this->shareDomainService->findSharesByFileIds(
            $userId,
            $organizationCode,
            $fileIds
        );
    }

    /**
     * 构建相似分享响应数组.
     *
     * @param array $shareEntities 分享实体数组
     * @param SimilarQueryCondition $condition 查询条件
     * @param array<int, int> $projectFileCountMap 项目文件数量映射
     * @return array 响应数组
     */
    private function buildSimilarShareResponse(
        array $shareEntities,
        SimilarQueryCondition $condition,
        array $projectFileCountMap
    ): array {
        $result = [];

        foreach ($shareEntities as $shareEntity) {
            // 使用 toDtoWithPassword 返回包含密码的分享信息
            $item = $this->shareAssembler->toDtoWithPassword($shareEntity)->toArray();
            $item['id'] = (string) $shareEntity->getId(); // 添加 id 字段，用于查询 view_count

            // 添加 file_ids 字段
            $item['file_ids'] = $this->shareDomainService->getFileIdsForShareItem($shareEntity, $condition);

            // 为项目分享添加 file_count（在 Assembler 转换之后，使用实体中的 resource_type 判断）
            if ($shareEntity->getResourceType() === ResourceType::Project->value) {
                if (! isset($item['extend']) || ! is_array($item['extend'])) {
                    $item['extend'] = [];
                }
                $projectId = (int) $shareEntity->getProjectId();
                $item['extend']['file_count'] = $projectFileCountMap[$projectId] ?? 0;
            }

            $result[] = $item;
        }

        return $result;
    }

    /**
     * 为分享列表添加项目名称.
     *
     * @param array $list 分享列表
     * @return array 添加了项目名称的列表
     */
    private function addProjectNamesToList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 收集所有有效的项目ID
        $projectIds = [];
        foreach ($list as $item) {
            if (! empty($item['project_id']) && is_numeric($item['project_id'])) {
                $projectIds[] = (int) $item['project_id'];
            }
        }

        if (empty($projectIds)) {
            // 如果没有项目ID，为每个项添加 null 的 project_name（确保字段存在）
            foreach ($list as &$item) {
                if (! isset($item['project_name'])) {
                    $item['project_name'] = null;
                }
            }
            return $list;
        }

        // 批量查询项目名称（返回 ['project_id' => 'project_name'] 映射）
        $projectIds = array_unique($projectIds);
        $projectNameMap = $this->projectDomainService->getProjectNamesBatch($projectIds);

        // 为每个列表项添加项目名称（确保字段存在）
        foreach ($list as &$item) {
            if (! empty($item['project_id']) && isset($projectNameMap[(int) $item['project_id']])) {
                // 关联字段语义：project_id 存在时，如果查询到但值为空字符串，返回 null（保持语义一致性）
                $projectName = $projectNameMap[(int) $item['project_id']] ?? null;
                $item['project_name'] = $projectName === '' ? null : $projectName;
            } else {
                // 确保字段存在：project_name 是关联字段，当 project_id 为 null 或查询不到时返回 null
                if (! isset($item['project_name'])) {
                    $item['project_name'] = null;
                }
            }
        }

        return $list;
    }

    /**
     * 为分享列表添加 file_ids 字段.
     *
     * @param array $list 分享列表
     * @return array 添加了 file_ids 字段的列表
     */
    private function addFileIdsToList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        $fileIdsByIndex = $this->shareDomainService->getFileIdsForShareListItems($list);

        foreach ($list as $index => &$item) {
            $item['file_ids'] = $fileIdsByIndex[$index] ?? [];
        }

        return $list;
    }

    /**
     * 为分享列表添加工作区信息.
     *
     * @param array $list 分享列表
     * @return array 添加了工作区信息的列表
     */
    private function addWorkspaceInfoToList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 收集所有有效的项目ID
        $projectIds = [];
        foreach ($list as $item) {
            if (! empty($item['project_id']) && is_numeric($item['project_id'])) {
                $projectIds[] = (int) $item['project_id'];
            }
        }

        // 初始化workspace映射
        $workspaceIdMap = [];
        $workspaceNameMap = [];

        if (! empty($projectIds)) {
            // 批量查询项目对应的workspace_id
            $projectIds = array_unique($projectIds);
            $workspaceIdMap = $this->projectDomainService->getWorkspaceIdsByProjectIds($projectIds);

            // 提取所有workspace_id
            $workspaceIds = array_unique(array_values($workspaceIdMap));

            if (! empty($workspaceIds)) {
                // 批量查询workspace名称
                $workspaceNameMap = $this->workspaceDomainService->getWorkspaceNamesBatch($workspaceIds);
            }
        }

        // 为每个列表项添加工作区信息（确保字段存在）
        foreach ($list as &$item) {
            $projectId = isset($item['project_id']) && is_numeric($item['project_id']) ? (int) $item['project_id'] : null;

            // 获取workspace信息
            $workspaceId = null;
            $workspaceName = null;

            if ($projectId !== null && isset($workspaceIdMap[$projectId])) {
                $workspaceId = $workspaceIdMap[$projectId];
                // 关联字段语义：project_id 存在时，如果查询不到 workspace，返回 null（表示关联不存在）
                // 如果查询到但值为空字符串，也返回 null（保持语义一致性）
                $workspaceName = $workspaceNameMap[$workspaceId] ?? null;
                if ($workspaceName === '') {
                    $workspaceName = null;
                }
            }

            // 确保字段存在：workspace_id 和 workspace_name 都是关联字段，当 project_id 为 null 时返回 null
            $item['workspace_id'] = $workspaceId !== null ? (string) $workspaceId : null;
            $item['workspace_name'] = $workspaceName;
        }

        return $list;
    }

    /**
     * 为分享列表动态添加 resource_name 和 main_file_name.
     *
     * @param array $list 分享列表
     * @param ResourceType $resourceType 资源类型
     * @return array 添加了 resource_name 和 main_file_name 字段的列表
     */
    private function addResourceNamesToList(array $list, ResourceType $resourceType): array
    {
        // 处理 FileCollection、File 和 Project 类型
        // 注意：入参时 resource_type=13 + share_project=true 会被转换为 resource_type=12
        if (! in_array($resourceType, [ResourceType::FileCollection, ResourceType::File, ResourceType::Project], true)) {
            return $list;
        }

        if (empty($list)) {
            return $list;
        }

        // 第一步：确定每个资源的目标文件名
        $fileNameMap = [];

        foreach ($list as $item) {
            $resourceId = $item['resource_id'];
            $defaultOpenFileId = $item['default_open_file_id'] ?? null;
            $targetFileName = null;

            // 根据资源类型选择不同的处理方式
            if ($resourceType === ResourceType::Project) {
                // 项目类型：通过项目ID获取文件
                $projectId = $item['project_id'] ?? null;

                // 项目ID无效，跳过
                if ($projectId === null || $projectId === '' || $projectId === '0') {
                    $fileNameMap[$resourceId] = null;
                    continue;
                }

                $fileEntities = $this->taskFileDomainService->findUserFilesByProjectId((string) $projectId);

                // 优先使用 default_open_file_id
                if ($defaultOpenFileId !== null && $defaultOpenFileId > 0) {
                    foreach ($fileEntities as $fileEntity) {
                        if ($fileEntity->getFileId() === (int) $defaultOpenFileId) {
                            $targetFileName = $fileEntity->getFileName();
                            break;
                        }
                    }
                }

                // 如果没有找到，获取第一个非隐藏且有文件名的文件
                if ($targetFileName === null) {
                    foreach ($fileEntities as $fileEntity) {
                        if (! $fileEntity->getIsHidden()) {
                            $fileName = $fileEntity->getFileName();
                            if (! empty($fileName)) {
                                $targetFileName = $fileName;
                                break;
                            }
                        }
                    }
                }
            } else {
                // 文件集和文件类型：原有逻辑
                $collectionId = (int) $resourceId;

                if ($defaultOpenFileId !== null && $defaultOpenFileId > 0) {
                    $fileEntities = $this->taskFileDomainService->getFilesByIds([$defaultOpenFileId], 0);
                    if (! empty($fileEntities)) {
                        $targetFileName = $fileEntities[0]->getFileName();
                    }
                }

                if ($targetFileName === null) {
                    $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
                    if (! empty($fileCollectionItems)) {
                        $fileIds = array_map(fn ($item) => $item->getFileId(), $fileCollectionItems);
                        $fileEntities = $this->taskFileDomainService->getFilesByIds($fileIds, 0);

                        foreach ($fileEntities as $fileEntity) {
                            if (! $fileEntity->getIsHidden()) {
                                $fileName = $fileEntity->getFileName();
                                if (! empty($fileName)) {
                                    $targetFileName = $fileName;
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            $fileNameMap[$resourceId] = $targetFileName;
        }

        // 第二步：为每个列表项设置 resource_name 和 main_file_name
        foreach ($list as &$item) {
            $resourceId = $item['resource_id'];
            $fileName = $fileNameMap[$resourceId] ?? null;

            // 优先使用数据库中的 resource_name
            if (empty($item['resource_name']) && $fileName) {
                $item['resource_name'] = $fileName;
            }

            $item['main_file_name'] = $fileName;
        }

        return $list;
    }

    /**
     * 从文件集获取所有相关的文件实体（包括原始文件、父级文件、子文件）.
     *
     * @param int $collectionId 文件集ID
     * @return array 返回 [allEntities, originalFileIds] - allEntities: 所有文件实体数组, originalFileIds: 原始文件ID数组
     */
    private function getAllFileEntitiesFromFileCollection(int $collectionId): array
    {
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

        if (empty($fileCollectionItems)) {
            return [[], []];
        }

        // 提取文件ID列表（转换为整数）
        $fileIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);

        // 递归获取所有父级文件，确保树结构可以正确构建（包含原始文件和所有父级文件）
        $allEntities = $this->taskFileDomainService->getFilesWithParentsByIds($fileIds);

        // 检查文件集中的目录，递归查询所有子文件
        $fileIdSet = array_flip($fileIds);
        $directoryIds = [];
        foreach ($allEntities as $entity) {
            // 检查是否是目录，且是文件集中的原始文件（不是父级文件）
            if ($entity->getIsDirectory() && isset($fileIdSet[$entity->getFileId()])) {
                $directoryIds[] = $entity->getFileId();
            }
        }

        // 递归查询所有目录的子文件
        if (! empty($directoryIds)) {
            // 获取第一个文件的 projectId
            $firstFile = $allEntities[0] ?? null;
            $projectId = $firstFile ? $firstFile->getProjectId() : 0;

            if ($projectId > 0) {
                // 使用领域服务方法递归查询所有目录的子文件ID
                $childFileIds = $this->taskFileDomainService->getAllChildrenFileIdsByDirectoryIds($directoryIds, $projectId);

                // 如果查询到子文件，需要获取子文件及其所有父级目录，确保树结构完整
                // 注意：子文件的直接父级（目录）已经在 allEntities 中了，但子文件的父级的父级可能不在
                if (! empty($childFileIds)) {
                    // 使用 getFilesWithParentsByIds 确保包含子文件的所有父级目录
                    $childEntitiesWithParents = $this->taskFileDomainService->getFilesWithParentsByIds($childFileIds, $projectId);

                    // 合并子文件实体及其父级目录，避免重复
                    $existingFileIds = array_flip(array_map(fn ($e) => $e->getFileId(), $allEntities));
                    foreach ($childEntitiesWithParents as $childEntity) {
                        if (! isset($existingFileIds[$childEntity->getFileId()])) {
                            $allEntities[] = $childEntity;
                        }
                    }
                }
            }
        }

        return [$allEntities, $fileIds];
    }

    /**
     * @param int $collectionId 文件集ID
     * @return int 实际文件数量
     */
    private function calculateFileCountFromCollection(int $collectionId): int
    {
        // 1. 获取文件集中的原始file_ids（输入，不变）
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);
        if (empty($fileCollectionItems)) {
            return 0;
        }

        // 2. 提取文件ID列表（这是用户创建分享时传入的原始ID）
        $originalIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);

        // 3. 批量获取文件实体（只获取原始file_ids对应的实体）
        $fileEntities = $this->taskFileDomainService->getFilesByIds($originalIds);
        if (empty($fileEntities)) {
            return 0;
        }

        $projectId = $fileEntities[0]->getProjectId(); // 获取项目ID用于递归查询
        if ($projectId <= 0) {
            return 0;
        }

        // 4. 【中间过程】展开所有文件ID：分离文件夹和文件
        $allFileIds = []; // 存储所有文件ID（临时中间过程）
        $directoryIds = []; // 存储文件夹ID列表（用于批量展开）

        foreach ($fileEntities as $entity) {
            if ($entity->getIsDirectory()) {
                // 是文件夹，收集起来批量展开
                $directoryIds[] = $entity->getFileId();
            } else {
                // 是文件，直接加入列表
                $allFileIds[] = $entity->getFileId();
            }
        }

        // 5. 批量展开所有文件夹的子文件（性能优化：一次查询多个文件夹）
        if (! empty($directoryIds)) {
            $childFileIds = $this->taskFileDomainService->getAllChildrenFileIdsByDirectoryIds(
                $directoryIds,
                $projectId
            );
            // 合并文件夹展开后的子文件ID
            $allFileIds = array_merge($allFileIds, $childFileIds);
        }

        // 6. 去重（关键步骤：避免重复计算）
        $uniqueFileIds = array_unique($allFileIds);

        // 7. 返回去重后的文件数量
        return count($uniqueFileIds);
    }

    /**
     * 从单文件获取文件列表.
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @param GetShareFilesRequestDTO $dto 请求DTO
     * @return array 文件列表及树结构
     */
    private function getFilesFromSingleFile(ResourceShareEntity $shareEntity, GetShareFilesRequestDTO $dto): array
    {
        // File 类型：resource_id 是文件集ID，需要通过文件集获取文件ID
        $collectionId = (int) $shareEntity->getResourceId();
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

        if (empty($fileCollectionItems)) {
            return [
                'list' => [],
                'tree' => [],
                'total' => 0,
            ];
        }

        // 单文件应该只有一个文件项
        $fileId = (int) $fileCollectionItems[0]->getFileId();

        // 获取文件实体
        $fileEntity = $this->taskFileDomainService->getById($fileId);

        if (! $fileEntity) {
            return [
                'list' => [],
                'tree' => [],
                'total' => 0,
            ];
        }

        $organizationCode = $shareEntity->getOrganizationCode();

        // 如果文件是目录（文件夹），需要递归获取目录内的所有子文件
        if ($fileEntity->getIsDirectory()) {
            $projectId = $fileEntity->getProjectId();
            if ($projectId > 0) {
                // 递归获取目录的所有子文件ID
                $childFileIds = $this->taskFileDomainService->getAllChildrenFileIdsByDirectoryIds([$fileId], $projectId);

                if (! empty($childFileIds)) {
                    // 获取所有子文件实体
                    $childEntities = $this->taskFileDomainService->getFilesByIds($childFileIds, $projectId);

                    // 合并目录本身和所有子文件（包含父级路径，确保树结构正确）
                    $allEntities = $this->taskFileDomainService->getFilesWithParentsByIds(array_merge([$fileId], $childFileIds), $projectId);

                    // 处理分页（只针对子文件，不包括目录本身）
                    $page = $dto->getPage();
                    $pageSize = $dto->getPageSize();
                    $offset = ($page - 1) * $pageSize;
                    $pagedEntities = array_slice($allEntities, $offset, $pageSize);

                    // 转换为TaskFileItemDTO格式（分页列表）
                    $list = $this->convertEntitiesToDtoList($pagedEntities, $organizationCode);

                    // 转换为TaskFileItemDTO格式（完整列表，用于构建树结构）
                    $allList = $this->convertEntitiesToDtoList($allEntities, $organizationCode);

                    // Build file tree structure
                    $tree = FileTreeUtil::assembleFilesTreeByParentId($allList, 'zh_CN');

                    return [
                        'list' => $list,
                        'tree' => $tree,
                        'total' => count($allEntities),
                    ];
                }
            }
            // 文件夹为空的情况：确保返回文件夹本身
            // 使用 getFilesWithParentsByIds 确保能正确获取文件夹实体
            $folderProjectId = $fileEntity->getProjectId();
            $folderEntities = $folderProjectId > 0
                ? $this->taskFileDomainService->getFilesWithParentsByIds([$fileId], $folderProjectId)
                : [];

            // 如果 getFilesWithParentsByIds 返回空，直接使用原始实体
            if (empty($folderEntities)) {
                $folderEntities = [$fileEntity];
            }

            // 转换为TaskFileItemDTO格式
            $list = $this->convertEntitiesToDtoList($folderEntities, $organizationCode);

            // 如果 convertEntitiesToDtoList 过滤掉了文件夹（比如是根目录），手动添加
            if (empty($list)) {
                // 手动创建文件夹的DTO，确保文件夹本身被包含
                $taskFileDto = new TaskFileItemDTO();
                $taskFileDto->fileId = (string) $fileEntity->getFileId();
                $taskFileDto->taskId = (string) $fileEntity->getTaskId();
                $taskFileDto->fileType = $fileEntity->getFileType();
                $taskFileDto->fileName = $fileEntity->getFileName();
                $taskFileDto->fileExtension = $fileEntity->getFileExtension();
                $taskFileDto->fileKey = $fileEntity->getFileKey();
                $taskFileDto->fileSize = $fileEntity->getFileSize();
                $taskFileDto->isHidden = $fileEntity->getIsHidden();
                $taskFileDto->updatedAt = $fileEntity->getUpdatedAt();
                $taskFileDto->topicId = (string) $fileEntity->getTopicId();
                $taskFileDto->relativeFilePath = $fileEntity->getFileKey();
                $taskFileDto->isDirectory = $fileEntity->getIsDirectory();
                $taskFileDto->metadata = FileMetadataUtil::getMetadataObject($fileEntity->getMetadata());
                $taskFileDto->projectId = (string) $fileEntity->getProjectId();
                $taskFileDto->sort = $fileEntity->getSort();
                $taskFileDto->fileUrl = '';
                $taskFileDto->parentId = (string) $fileEntity->getParentId();
                $taskFileDto->source = $fileEntity->getSource();

                // 获取文件URL（公开分享场景）
                $fileLinks = $this->fileDomainService->getLinks($organizationCode, [$fileEntity->getFileKey()], StorageBucketType::Public);
                $fileLink = $fileLinks[$fileEntity->getFileKey()] ?? null;
                $taskFileDto->fileUrl = $fileLink?->getUrl() ?? '';

                $list = [$taskFileDto->toArray()];
            }

            // Build file tree structure
            $tree = FileTreeUtil::assembleFilesTreeByParentId($list, 'zh_CN');

            return [
                'list' => $list,
                'tree' => $tree,
                'total' => count($list),
            ];
        }

        // 普通文件的情况：只返回文件本身
        // 转换为TaskFileItemDTO格式
        $list = $this->convertEntitiesToDtoList([$fileEntity], $organizationCode);

        // Build file tree structure
        $tree = FileTreeUtil::assembleFilesTreeByParentId($list, 'zh_CN');

        return [
            'list' => $list,
            'tree' => $tree,
            'total' => 1,
        ];
    }

    /**
     * 从文件集获取文件列表.
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @param GetShareFilesRequestDTO $dto 请求DTO
     * @return array 文件列表及树结构
     */
    private function getFilesFromFileCollection(ResourceShareEntity $shareEntity, GetShareFilesRequestDTO $dto): array
    {
        // 获取文件集ID
        $collectionId = (int) $shareEntity->getResourceId();
        $organizationCode = $shareEntity->getOrganizationCode();
        $dataIsolation = DataIsolation::create($organizationCode, '');

        // 如果是项目类型分享（resource_type=12），返回项目下的所有文件
        if ($shareEntity->getResourceType() === ResourceType::Project->value) {
            // 直接从 shareEntity 获取项目ID
            $projectIdStr = $shareEntity->getProjectId();
            if ($projectIdStr === null) {
                // 如果无法获取项目ID，返回空结果
                return [
                    'list' => [],
                    'tree' => [],
                    'total' => 0,
                ];
            }

            // 调用 getFilesFromProject 返回项目下的所有文件
            $projectId = (int) $projectIdStr;
            return $this->getFilesFromProject($projectId, $organizationCode, $dataIsolation, $dto);
        }

        // 如果未开启项目分享（share_project=false），基于文件集中的file_ids返回文件
        // 调用统一方法获取所有相关文件实体
        [$allEntities, $originalFileIds] = $this->getAllFileEntitiesFromFileCollection($collectionId);

        if (empty($allEntities)) {
            return [
                'list' => [],
                'tree' => [],
                'total' => 0,
            ];
        }

        $fileIdSet = array_flip($originalFileIds);

        // 从完整文件列表中筛选出原始文件集中的文件（用于分页）
        $taskFileEntities = array_filter($allEntities, function ($entity) use ($fileIdSet) {
            return isset($fileIdSet[$entity->getFileId()]);
        });
        $taskFileEntities = array_values($taskFileEntities);

        // 处理分页（只针对原始文件集中的文件）
        $total = count($taskFileEntities);
        $page = $dto->getPage();
        $pageSize = $dto->getPageSize();
        $offset = ($page - 1) * $pageSize;
        $pagedEntities = array_slice($taskFileEntities, $offset, $pageSize);

        // 转换为TaskFileItemDTO格式（分页列表）
        $list = $this->convertEntitiesToDtoList($pagedEntities, $organizationCode);

        // 转换为TaskFileItemDTO格式（完整列表，用于构建树结构）
        $allList = $this->convertEntitiesToDtoList($allEntities, $organizationCode);

        // Build file tree structure with VS Code-style sorting (default to zh_CN for share context)
        $tree = FileTreeUtil::assembleFilesTreeByParentId($allList, 'zh_CN');

        return [
            'list' => $list,
            'tree' => $tree,
            'total' => $total,
        ];
    }

    /**
     * 将文件实体列表转换为DTO列表.
     *
     * @param TaskFileEntity[] $entities 文件实体列表
     * @param string $organizationCode 组织编码
     * @param string $workDir 工作目录（可选，用于计算相对路径，如话题分享时需要）
     * @return array DTO数组列表
     */
    private function convertEntitiesToDtoList(array $entities, string $organizationCode, string $workDir = ''): array
    {
        $list = [];
        $fileKeys = [];

        foreach ($entities as $entity) {
            /**
             * @var TaskFileEntity $entity
             */
            $fileKey = $entity->getFileKey();
            if (in_array($fileKey, $fileKeys)) {
                continue;
            }
            // 只过滤项目根目录，不过滤其他 parent_id 为空的文件（可能是第一级文件夹）
            if ($entity->getIsDirectory() && $entity->getFileName() === '/' && empty($entity->getParentId())) {
                continue;
            }
            $fileKeys[] = $fileKey;

            $taskFileDto = new TaskFileItemDTO();
            $taskFileDto->fileId = (string) $entity->getFileId();
            $taskFileDto->taskId = (string) $entity->getTaskId();
            $taskFileDto->fileType = $entity->getFileType();
            $taskFileDto->fileName = $entity->getFileName();
            $taskFileDto->fileExtension = $entity->getFileExtension();
            $taskFileDto->fileKey = $entity->getFileKey();
            $taskFileDto->fileSize = $entity->getFileSize();
            $taskFileDto->isHidden = $entity->getIsHidden();
            $taskFileDto->updatedAt = $entity->getUpdatedAt();
            $taskFileDto->topicId = (string) $entity->getTopicId();

            // 使用 workDir 计算相对路径（如果提供了 workDir，则使用它；否则使用 fileKey）
            // 这是修复话题分享层级目录的关键
            $taskFileDto->relativeFilePath = ! empty($workDir)
                ? WorkDirectoryUtil::getRelativeFilePath($fileKey, $workDir)
                : $fileKey;

            $taskFileDto->isDirectory = $entity->getIsDirectory();
            $taskFileDto->metadata = FileMetadataUtil::getMetadataObject($entity->getMetadata());
            $taskFileDto->projectId = (string) $entity->getProjectId();
            $taskFileDto->sort = $entity->getSort();
            $taskFileDto->fileUrl = '';
            $taskFileDto->parentId = (string) $entity->getParentId();
            $taskFileDto->source = $entity->getSource();

            // 获取文件URL（公开分享场景）
            $fileLinks = $this->fileDomainService->getLinks($organizationCode, [$fileKey], StorageBucketType::Public);
            $fileLink = $fileLinks[$fileKey] ?? null;
            $taskFileDto->fileUrl = $fileLink?->getUrl() ?? '';

            $list[] = $taskFileDto->toArray();
        }

        return $list;
    }

    /**
     * 从话题获取项目ID.
     *
     * @param int $topicId 话题ID
     * @return null|string 项目ID字符串，如果话题不存在或项目ID为0则返回null
     */
    private function getProjectIdFromTopic(int $topicId): ?string
    {
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        return $topicEntity && $topicEntity->getProjectId() > 0 ? (string) $topicEntity->getProjectId() : null;
    }

    /**
     * 从项目获取项目ID（验证项目是否存在）.
     *
     * @param int $projectId 项目ID
     * @return null|string 项目ID字符串，如果项目不存在则返回null
     */
    private function getProjectIdFromProject(int $projectId): ?string
    {
        $projectEntity = $this->projectDomainService->getProjectNotUserId($projectId);
        return $projectEntity && $projectEntity->getId() > 0 ? (string) $projectEntity->getId() : null;
    }

    /**
     * 从项目获取文件列表.
     *
     * @param int $projectId 项目ID
     * @param string $organizationCode 组织编码
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param GetShareFilesRequestDTO $dto 请求DTO
     * @param string $workDir 工作目录（可选，用于计算相对路径，如话题分享时需要）
     * @return array 文件列表及树结构
     */
    private function getFilesFromProject(int $projectId, string $organizationCode, DataIsolation $dataIsolation, GetShareFilesRequestDTO $dto, string $workDir = ''): array
    {
        // 循环获取所有文件（不分页），用于构建完整的树结构和计算正确的 total
        // 使用分页循环确保获取所有文件，避免 pageSize 限制导致文件遗漏
        $allEntities = [];
        $page = 1;
        $pageSize = 1000; // 使用较小的 pageSize 进行循环获取

        while (true) {
            $result = $this->taskDomainService->getTaskAttachmentsByProjectId(
                $projectId,
                $dataIsolation,
                $page,
                $pageSize,
                [],
                StorageType::WORKSPACE->value
            );

            $entities = $result['list'] ?? [];
            if (empty($entities)) {
                break; // 没有更多文件了
            }

            $allEntities = array_merge($allEntities, $entities);

            // 如果返回的文件数少于 pageSize，说明已经是最后一页了
            if (count($entities) < $pageSize) {
                break;
            }

            ++$page;
        }

        // 提取所有文件的 file_id，然后使用 getFilesWithParentsByIds 确保包含所有父级文件夹
        // 这样可以确保层级关系正确，即使某些中间层级的文件夹在查询结果中缺失
        $fileIds = array_map(fn ($entity) => $entity->getFileId(), $allEntities);
        $allEntities = ! empty($fileIds)
            ? $this->taskFileDomainService->getFilesWithParentsByIds($fileIds, $projectId)
            : [];

        // 转换为DTO列表（会自动过滤根目录）
        $allList = $this->convertEntitiesToDtoList($allEntities, $organizationCode, $workDir);

        // 计算正确的 total（排除根目录后的数量）
        $total = count($allList);

        // 处理分页（基于完整列表）
        $page = $dto->getPage();
        $pageSize = $dto->getPageSize();
        $offset = ($page - 1) * $pageSize;
        $list = array_slice($allList, $offset, $pageSize);

        // Build file tree structure with VS Code-style sorting (always use zh_CN for pinyin sorting)
        // 使用完整列表构建树结构，确保树结构完整
        $tree = FileTreeUtil::assembleFilesTreeByParentId($allList, 'zh_CN');

        return [
            'list' => $list,
            'tree' => $tree,
            'total' => $total,
        ];
    }

    /**
     * 获取并验证分享实体.
     *
     * @param null|MagicUserAuthorization $userAuthorization 当前用户（可以为null）
     * @param string $shareCode 分享code
     * @return ResourceShareEntity 验证通过的分享实体
     * @throws Exception 如果验证失败
     */
    private function getAndValidateShareEntity(?MagicUserAuthorization $userAuthorization, string $shareCode): ResourceShareEntity
    {
        // 通过领域服务获取分享实体
        $shareEntity = $this->shareDomainService->getShareByCode($shareCode);

        // 验证分享是否存在
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$shareCode]);
        }

        // 验证分享访问权限
        $this->shareDomainService->validateShareAccess(
            $shareEntity,
            $userAuthorization?->getId(),
            $userAuthorization?->getOrganizationCode(),
            $shareCode
        );

        return $shareEntity;
    }

    /**
     * 根据资源类型获取项目ID.
     *
     * @param ResourceType $resourceType 资源类型
     * @param string $resourceId 资源ID
     * @return null|string 项目ID，如果无法获取则返回null
     */
    private function getProjectIdByResourceType(ResourceType $resourceType, string $resourceId): ?string
    {
        try {
            // 根据不同资源类型获取项目ID（Project类型已弃用）
            return match ($resourceType) {
                // Topic类型：通过话题获取项目ID
                ResourceType::Topic => $this->getProjectIdFromTopic((int) $resourceId),

                // FileCollection类型：通过文件集获取项目ID
                ResourceType::FileCollection => $this->getProjectIdFromFileCollection((int) $resourceId),

                // File类型：resource_id 是文件集ID，通过文件集获取项目ID（与 FileCollection 类型逻辑相同）
                ResourceType::File => $this->getProjectIdFromFileCollection((int) $resourceId),

                // Project类型：resource_id 就是项目ID，直接返回
                ResourceType::Project => $this->getProjectIdFromProject((int) $resourceId),

                // 其他类型暂不支持或不需要项目ID
                default => null,
            };
        } catch (Exception $e) {
            // 如果获取项目ID失败，记录日志但不影响分享创建
            $this->logger->warning('获取项目ID失败', [
                'resource_type' => $resourceType->name,
                'resource_id' => $resourceId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * 从文件集获取项目ID.
     *
     * @param int $collectionId 文件集ID
     * @return null|string 项目ID，如果无法获取则返回null
     */
    private function getProjectIdFromFileCollection(int $collectionId): ?string
    {
        // 获取文件集中的文件
        $fileCollectionItems = $this->fileCollectionDomainService->getFilesByCollectionId($collectionId);

        if (empty($fileCollectionItems)) {
            return null;
        }

        // 提取第一个文件ID
        $firstFileId = (int) $fileCollectionItems[0]->getFileId();

        // 通过文件ID获取文件实体
        $fileEntities = $this->taskFileDomainService->getFilesWithParentsByIds([$firstFileId]);

        if (empty($fileEntities)) {
            return null;
        }

        // 从第一个文件获取项目ID
        $projectId = $fileEntities[0]->getProjectId();

        return $projectId > 0 ? (string) $projectId : null;
    }

    /**
     * 为分享列表添加复制次数（仅对文件分享和项目分享）.
     *
     * @param array $list 分享列表
     * @return array 添加了复制次数的列表
     */
    private function addCopyCountsToList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // copy_count 已经在 SQL 层面通过 LEFT JOIN 查询出来了
        // 这里只需要确保所有项都有 copy_count 字段（作为兜底处理）
        foreach ($list as &$item) {
            // 如果 copy_count 不存在，设置为 0（这种情况不应该发生，但作为兜底）
            if (! isset($item['copy_count'])) {
                $item['copy_count'] = 0;
            } else {
                // 确保 copy_count 是整数类型
                $item['copy_count'] = (int) $item['copy_count'];
            }
        }

        return $list;
    }

    /**
     * 批量获取项目的复制次数统计.
     *
     * @param array<int> $projectIds 项目ID数组
     * @return array<int, int> [project_id => copy_count] 映射数组
     */
    private function getCopyCountsByProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        // 通过 Repository 接口批量获取复制次数（符合DDD原则）
        return $this->projectForkRepository->getForkCountsByProjectIds($projectIds);
    }

    /**
     * 批量获取分享的访问次数统计.
     *
     * @param array<int> $shareIds 分享ID数组
     * @return array<int, int> [share_id => view_count] 映射数组
     */
    private function getViewCountsByShareIds(array $shareIds): array
    {
        if (empty($shareIds)) {
            return [];
        }

        // 从访问日志表批量统计访问次数
        $results = Db::table('magic_resource_share_access_logs')
            ->selectRaw('share_id, COUNT(*) as view_count')
            ->whereIn('share_id', $shareIds)
            ->groupBy('share_id')
            ->get();

        $viewCountMap = [];
        foreach ($results as $result) {
            $viewCountMap[(int) $result['share_id']] = (int) $result['view_count'];
        }

        return $viewCountMap;
    }

    /**
     * 获取分享者信息.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @return array 分享者信息，包含 user_id, avatar_url, nickname
     */
    private function getCreatorInfo(string $userId, string $organizationCode): array
    {
        // 获取用户基本信息
        $userEntity = $this->magicUserDomainService->getUserById($userId);
        if (! $userEntity) {
            return [
                'user_id' => $userId,
                'avatar_url' => '',
                'nickname' => '',
            ];
        }

        // 获取昵称
        $nickname = $userEntity->getNickname() ?? '';

        // 获取头像URL
        $avatarUrl = $userEntity->getAvatarUrl() ?? '';

        return [
            'user_id' => $userId,
            'avatar_url' => $avatarUrl,
            'nickname' => $nickname,
        ];
    }

    /**
     * 获取要复制的文件ID列表.
     *
     * @return null|array null表示复制所有文件（项目类型 resource_type=12）
     */
    private function getFileIdsToCopy(ResourceShareEntity $shareEntity, ResourceType $resourceType): ?array
    {
        // 项目类型：返回 null 表示复制所有文件
        if ($resourceType === ResourceType::Project) {
            return null;
        }

        // 文件集类型: 调用统一方法获取所有相关文件实体
        $collectionId = (int) $shareEntity->getResourceId();
        [$allEntities, $originalFileIds] = $this->getAllFileEntitiesFromFileCollection($collectionId);

        if (empty($allEntities)) {
            return [];
        }

        // 提取所有文件ID并返回
        return array_map(fn ($entity) => $entity->getFileId(), $allEntities);
    }

    /**
     * 执行文件复制（复用 fork 的核心逻辑）.
     */
    private function executeCopy(
        MagicUserAuthorization $userAuthorization,
        int $sourceProjectId,
        int $targetWorkspaceId,
        ?string $targetProjectName,
        ?array $fileIds
    ): array {
        // 创建数据隔离对象
        $dataIsolation = DataIsolation::create(
            $userAuthorization->getOrganizationCode(),
            $userAuthorization->getId()
        );

        // 验证目标工作区存在性和权限
        $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail($targetWorkspaceId);
        if (empty($workspaceEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_NOT_FOUND, trans('workspace.workspace_not_found'));
        }

        if ($workspaceEntity->getUserId() !== $userAuthorization->getId()) {
            ExceptionBuilder::throw(SuperAgentErrorCode::WORKSPACE_ACCESS_DENIED, trans('workspace.workspace_access_denied'));
        }

        // 获取源项目信息
        $sourceProjectEntity = $this->projectDomainService->getProjectNotUserId($sourceProjectId);
        if (! $sourceProjectEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND, trans('project.project_not_found'));
        }

        // 确定目标项目名称
        $projectName = $targetProjectName ?? $sourceProjectEntity->getProjectName();

        Db::beginTransaction();
        try {
            // 发布 fork 开始检查事件
            AsyncEventUtil::dispatch(new ForkProjectStartEvent(
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            ));
            $this->logger->info(sprintf(
                'Dispatched fork project start event, organization: %s, user: %s',
                $dataIsolation->getCurrentOrganizationCode(),
                $dataIsolation->getCurrentUserId()
            ));

            // 创建 fork 记录和项目（复用 ProjectDomainService）
            [$forkProjectEntity, $forkProjectRecordEntity] = $this->projectDomainService->forkProject(
                $sourceProjectId,
                $targetWorkspaceId,
                $projectName,
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode()
            );

            // 初始化项目成员和设置
            $this->projectMemberDomainService->initializeProjectMemberAndSettings(
                $dataIsolation->getCurrentUserId(),
                $forkProjectEntity->getId(),
                $workspaceEntity->getId(),
                $dataIsolation->getCurrentOrganizationCode()
            );

            $this->logger->info(sprintf(
                'Created fork record, fork project ID: %d, fork record ID: %d',
                $forkProjectEntity->getId(),
                $forkProjectRecordEntity->getId()
            ));

            // 创建工作目录
            $workDir = WorkDirectoryUtil::getWorkDir($dataIsolation->getCurrentUserId(), $forkProjectEntity->getId());

            // 初始化 Magic Chat 会话
            [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);

            // 创建默认话题
            $topicEntity = $this->topicDomainService->createTopic(
                $dataIsolation,
                $workspaceEntity->getId(),
                $forkProjectEntity->getId(),
                $chatConversationId,
                $chatConversationTopicId,
                '',
                $workDir
            );
            $this->logger->info(sprintf('创建默认话题成功, topicId=%s', $topicEntity->getId()));

            // 更新工作区信息
            $workspaceEntity->setCurrentTopicId($topicEntity->getId());
            $workspaceEntity->setCurrentProjectId($forkProjectEntity->getId());
            $this->workspaceDomainService->saveWorkspaceEntity($workspaceEntity);

            // 更新项目信息
            $forkProjectEntity->setCurrentTopicId($topicEntity->getId());
            $forkProjectEntity->setWorkspaceId($workspaceEntity->getId());
            $forkProjectEntity->setWorkDir($workDir);
            $this->projectDomainService->saveProjectEntity($forkProjectEntity);

            // 发布异步文件迁移事件（新增：传递文件ID列表）
            $event = new ProjectForkEvent(
                $sourceProjectId,
                $forkProjectEntity->getId(),
                $dataIsolation->getCurrentUserId(),
                $dataIsolation->getCurrentOrganizationCode(),
                $forkProjectRecordEntity->getId(),
                $fileIds  // 新增: 传递文件ID列表
            );
            $publisher = new ProjectForkPublisher($event);
            $this->producer->produce($publisher);

            $this->logger->info(sprintf('Published fork event, event ID: %s', $event->getEventId()));

            Db::commit();

            // 返回复制结果
            return CopyResourceFilesResponseDTO::fromEntity($forkProjectRecordEntity)->toArray();
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error('Copy resource files failed, error: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * 验证分享目标ID的合法性.
     *
     * 验证规则：
     * 1. 用户必须存在且属于当前组织
     * 2. 部门必须存在且属于当前组织
     *
     * @param array $targetIds 目标ID数组，格式：[['target_type' => 'User', 'target_id' => 'xxx'], ...]
     * @param string $organizationCode 组织代码
     * @throws BusinessException 当验证失败时抛出异常
     */
    private function validateTargetIds(array $targetIds, string $organizationCode): void
    {
        if (empty($targetIds)) {
            return;
        }

        // 分组收集用户ID和部门ID
        $userIds = [];
        $departmentIds = [];

        foreach ($targetIds as $target) {
            $targetType = $target['target_type'] ?? '';
            $targetId = $target['target_id'] ?? '';

            if (empty($targetType) || empty($targetId)) {
                ExceptionBuilder::throw(
                    ShareErrorCode::PARAMETER_CHECK_FAILURE,
                    'share.invalid_target_id_format',
                    []
                );
            }

            if ($targetType === 'User') {
                $userIds[] = $targetId;
            } elseif ($targetType === 'Department') {
                // 特殊处理：-1 表示全部成员，跳过验证
                if ($targetId !== '-1') {
                    $departmentIds[] = $targetId;
                }
            } else {
                ExceptionBuilder::throw(
                    ShareErrorCode::PARAMETER_CHECK_FAILURE,
                    'share.invalid_target_type',
                    [$targetType]
                );
            }
        }

        // 创建数据隔离对象（用于组织限制）
        $dataIsolation = DataIsolation::create($organizationCode, '');

        // 批量验证用户是否存在且属于当前组织
        if (! empty($userIds)) {
            $validUsers = $this->magicUserDomainService->getUserByIds($userIds, $dataIsolation);
            $validUserIds = array_map(fn ($user) => $user->getUserId(), $validUsers);

            $invalidUserIds = array_diff($userIds, $validUserIds);
            if (! empty($invalidUserIds)) {
                ExceptionBuilder::throw(
                    ShareErrorCode::PARAMETER_CHECK_FAILURE,
                    'share.target_user_not_found_or_not_in_organization',
                    [implode(', ', $invalidUserIds)]
                );
            }
        }

        // 批量验证部门是否存在且属于当前组织
        if (! empty($departmentIds)) {
            $validDepartments = $this->magicDepartmentDomainService->getDepartmentByIds(
                $dataIsolation,
                $departmentIds,
                true
            );

            $validDepartmentIds = array_keys($validDepartments);
            $invalidDepartmentIds = array_diff($departmentIds, $validDepartmentIds);

            if (! empty($invalidDepartmentIds)) {
                ExceptionBuilder::throw(
                    ShareErrorCode::PARAMETER_CHECK_FAILURE,
                    'share.target_department_not_found_or_not_in_organization',
                    [implode(', ', $invalidDepartmentIds)]
                );
            }
        }
    }

    /**
     * 根据资源类型为分享列表添加特定字段.
     *
     * @param array $list 分享列表
     * @return array 添加了特定字段的列表
     */
    private function addFieldsByResourceType(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 按资源类型分组处理 extend 字段
        $topicItems = [];
        $fileAndProjectItems = [];

        foreach ($list as $index => $item) {
            $resourceType = $item['resource_type'] ?? 0;

            // 确保 extend 字段存在
            if (! isset($list[$index]['extend']) || ! is_array($list[$index]['extend'])) {
                $list[$index]['extend'] = [];
            }

            if ($resourceType === ResourceType::Topic->value) {
                // 话题类型：在 extend 中添加 topic_mode，并删除最外层的 copy_count（话题类型不需要）
                $topicItems[$index] = $item;
                // 删除话题类型最外层的 copy_count（因为话题类型不需要 copy_count）
                unset($list[$index]['copy_count']);
            } elseif (in_array($resourceType, [ResourceType::Project->value, ResourceType::File->value, ResourceType::FileCollection->value], true)) {
                // 项目/文件集/单文件类型：在 extend 中添加 copy_count
                $fileAndProjectItems[$index] = $item;
            }
        }

        // 处理话题分享的特殊字段（topic_mode 放入 extend）
        if (! empty($topicItems)) {
            $list = $this->addTopicModeToExtend($list, $topicItems);
        }

        // 处理文件集/单文件分享的特殊字段（copy_count 放入 extend）
        if (! empty($fileAndProjectItems)) {
            $list = $this->addCopyCountToExtend($list, $fileAndProjectItems);
        }

        return $list;
    }

    /**
     * 为分享列表添加解密后的密码字段.
     * 密码以明文形式返回，方便前端在复制分享链接时使用.
     *
     * @param array $list 分享列表
     * @return array 添加了密码字段的列表
     */
    private function addDecryptedPasswordsToList(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        foreach ($list as &$item) {
            // 获取加密的密码（可能为空字符串）
            $encryptedPassword = $item['password'] ?? '';

            // 检查是否有密码（is_password_enabled 为 true 且 password 不为空）
            $hasPassword = ! empty($item['is_password_enabled']) && ! empty($encryptedPassword);

            if ($hasPassword) {
                // 解密密码并添加到返回结果中
                try {
                    $decryptedPassword = PasswordCrypt::decrypt($encryptedPassword);
                    $item['password'] = $decryptedPassword;
                } catch (Exception $e) {
                    // 解密失败，返回空字符串
                    $this->logger->warning('Failed to decrypt password for share', [
                        'share_id' => $item['id'] ?? null,
                        'error' => $e->getMessage(),
                    ]);
                    $item['password'] = '';
                }
            } else {
                // 没有密码，设置为空字符串
                $item['password'] = '';
            }
        }

        return $list;
    }

    /**
     * 将列表中的项目类型（resource_type=12）转换为文件集类型（resource_type=13）+ share_project=true.
     * 用于外部API接口返回，内部逻辑使用类型12，外部接口使用类型13+share_project标识项目分享。
     *
     * @param array $list 分享列表
     * @return array 转换后的列表
     */
    private function convertProjectTypeForShareList(array $list): array
    {
        foreach ($list as &$item) {
            if (isset($item['resource_type']) && $item['resource_type'] === ResourceType::Project->value) {
                $item['resource_type'] = ResourceType::FileCollection->value;
                $item['share_project'] = true;
            }
        }
        return $list;
    }

    /**
     * 为话题分享在 extend 中添加 topic_mode 字段.
     *
     * @param array $list 分享列表
     * @param array $topicItems 话题分享项的索引映射
     * @return array 添加了 topic_mode 字段的列表
     */
    private function addTopicModeToExtend(array $list, array $topicItems): array
    {
        // 收集所有话题ID
        $topicIds = [];
        foreach ($topicItems as $index => $item) {
            $topicId = (int) ($item['resource_id'] ?? 0);
            if ($topicId > 0) {
                $topicIds[] = $topicId;
            }
        }

        // 批量查询话题模式
        $topicModeMap = [];
        if (! empty($topicIds)) {
            $topicIds = array_unique($topicIds);
            // 通过 Repository 批量获取话题实体
            $topicEntities = $this->topicRepository->getTopicsByIds($topicIds);
            foreach ($topicEntities as $topicEntity) {
                $topicModeMap[$topicEntity->getId()] = $topicEntity->getTopicMode() ?? '';
            }
        }

        // 为每个话题分享项在 extend 中添加 topic_mode 字段
        // 注意：extend 字段已在 addFieldsByResourceType 中确保存在，这里不需要再次检查
        foreach ($topicItems as $index => $item) {
            $topicId = (int) ($item['resource_id'] ?? 0);

            // topic_mode：从话题表查询，如果不存在或查询失败，返回空字符串
            // 确保所有话题分享项都有 topic_mode 字段
            if ($topicId > 0 && isset($topicModeMap[$topicId])) {
                $list[$index]['extend']['topic_mode'] = $topicModeMap[$topicId] ?: '';
            } else {
                // 话题不存在或查询失败，返回空字符串
                $list[$index]['extend']['topic_mode'] = '';
            }
        }

        return $list;
    }

    /**
     * 为分享列表统一添加所有扩展字段.
     *
     * @param array $list 分享列表
     * @return array 添加了所有扩展字段的列表
     */
    private function enrichShareListFields(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 1. 确保所有项都有 extend 字段
        foreach ($list as $index => $item) {
            if (! isset($list[$index]['extend']) || ! is_array($list[$index]['extend'])) {
                $list[$index]['extend'] = [];
            }
        }

        // 2. 添加 extend.file_count（FileCollection 和 File 类型）
        $list = $this->addFileCountToExtend($list);

        // 3. 添加 extend.copy_count（FileCollection 和 File 类型）
        $list = $this->addCopyCountToExtendForFileTypes($list);

        // 4. 添加 view_count（FileCollection 和 File 类型，放在外层与 list 接口保持一致）
        $list = $this->addViewCountToExtend($list);

        // 5. 添加项目名称
        $list = $this->addProjectNamesToList($list);

        // 6. 添加工作区信息
        $list = $this->addWorkspaceInfoToList($list);

        // 7. 添加 resource_name 和 main_file_name（FileCollection 和 File 类型）
        // 由于 enrichShareListFields 处理的是混合类型列表，需要分别处理不同类型
        $list = $this->addResourceNamesForMixedTypes($list);

        // 8. 类型转换：将内部类型12（Project）转换为外部类型13（FileCollection）+ share_project=true
        return $this->convertProjectTypeForShareList($list);
    }

    /**
     * 为混合类型列表添加 resource_name 和 main_file_name 字段.
     * 支持 FileCollection 和 File 类型的混合列表.
     *
     * @param array $list 混合类型的分享列表
     * @return array 添加了字段的列表
     */
    private function addResourceNamesForMixedTypes(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 按资源类型分组
        $fileCollectionItems = [];
        $fileItems = [];
        $otherItems = [];

        foreach ($list as $index => $item) {
            $resourceType = $item['resource_type'] ?? 0;
            if ($resourceType === ResourceType::FileCollection->value) {
                $fileCollectionItems[$index] = $item;
            } elseif ($resourceType === ResourceType::File->value) {
                $fileItems[$index] = $item;
            } else {
                $otherItems[$index] = $item;
            }
        }

        // 分别处理不同类型
        if (! empty($fileCollectionItems)) {
            $processedFileCollectionItems = $this->addResourceNamesToList(array_values($fileCollectionItems), ResourceType::FileCollection);
            foreach ($fileCollectionItems as $index => $item) {
                $processedIndex = array_search($index, array_keys($fileCollectionItems));
                if ($processedIndex !== false && isset($processedFileCollectionItems[$processedIndex])) {
                    $list[$index] = $processedFileCollectionItems[$processedIndex];
                }
            }
        }

        if (! empty($fileItems)) {
            $processedFileItems = $this->addResourceNamesToList(array_values($fileItems), ResourceType::File);
            foreach ($fileItems as $index => $item) {
                $processedIndex = array_search($index, array_keys($fileItems));
                if ($processedIndex !== false && isset($processedFileItems[$processedIndex])) {
                    $list[$index] = $processedFileItems[$processedIndex];
                }
            }
        }

        return $list;
    }

    /**
     * 为文件集分享在 extend 中添加 file_count 字段.
     *
     * @param array $list 分享列表
     * @return array 添加了 file_count 字段的列表
     */
    private function addFileCountToExtend(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        $fileShareItems = [];
        $singleFileItems = [];

        foreach ($list as $index => $item) {
            $resourceType = $item['resource_type'] ?? 0;

            // 确保 extend 字段存在
            if (! isset($list[$index]['extend']) || ! is_array($list[$index]['extend'])) {
                $list[$index]['extend'] = [];
            }

            // 如果已经有 file_count，跳过处理（避免覆盖 findSimilarShare 中设置的值）
            if (isset($list[$index]['extend']['file_count'])) {
                continue;
            }

            // 根据 resource_type 分组
            if ($resourceType === ResourceType::FileCollection->value) {
                // 文件集类型
                $collectionId = (int) ($item['resource_id'] ?? 0);
                if ($collectionId > 0) {
                    $fileShareItems[$index] = [
                        'item' => $item,
                        'collection_id' => $collectionId,
                    ];
                }
            } elseif ($resourceType === ResourceType::File->value) {
                // 单文件类型：file_count 固定为 1
                $singleFileItems[$index] = $item;
            }
        }

        // 批量查询文件分享的实际文件数量（resource_type=13）
        if (! empty($fileShareItems)) {
            // 为每个文件分享计算实际文件数量
            foreach ($fileShareItems as $index => $data) {
                $collectionId = $data['collection_id'];
                $actualFileCount = $this->calculateFileCountFromCollection($collectionId);
                $list[$index]['extend']['file_count'] = $actualFileCount;
            }
        }

        // 3. File 类型：单文件，file_count 固定为 1
        foreach ($singleFileItems as $index => $item) {
            $list[$index]['extend']['file_count'] = 1;
        }

        return $list;
    }

    /**
     * 为文件集/单文件分享在 extend 中添加 copy_count 字段.
     *
     * @param array $list 分享列表
     * @param array $fileAndProjectItems 文件和文件集分享项的索引映射
     * @return array 添加了 copy_count 字段的列表
     */
    private function addCopyCountToExtend(array $list, array $fileAndProjectItems): array
    {
        // 为每个文件和文件集分享项在 extend 中添加 copy_count 字段
        // 注意：extend 字段已在 addFieldsByResourceType 中确保存在，这里不需要再次检查
        foreach ($fileAndProjectItems as $index => $item) {
            // copy_count：从最外层移到 extend 中（合并到已有的 extend，不覆盖其他字段）
            $copyCount = isset($list[$index]['copy_count']) ? (int) $list[$index]['copy_count'] : 0;
            $list[$index]['extend']['copy_count'] = $copyCount;

            // 移除最外层的 copy_count，因为已经移到 extend 中了
            unset($list[$index]['copy_count']);
        }

        return $list;
    }

    /**
     * 为 FileCollection 和 File 类型在 extend 中添加 copy_count 字段.
     *
     * @param array $list 分享列表
     * @return array 添加了 copy_count 字段的列表
     */
    private function addCopyCountToExtendForFileTypes(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 收集文件集/单文件类型的项目ID
        $projectIds = [];
        $fileAndProjectItems = [];

        foreach ($list as $index => $item) {
            $resourceType = $item['resource_type'] ?? 0;

            // 收集项目/文件集/单文件类型的分享项
            if (in_array($resourceType, [ResourceType::Project->value, ResourceType::File->value, ResourceType::FileCollection->value], true)) {
                $fileAndProjectItems[$index] = $item;

                // 提取 project_id
                $projectId = $item['project_id'] ?? null;
                if (! empty($projectId)) {
                    $projectIds[] = (int) $projectId;
                }
            }
        }

        // 批量查询 copy_count
        $copyCountMap = [];
        if (! empty($projectIds)) {
            $projectIds = array_unique($projectIds);
            $copyCountMap = $this->getCopyCountsByProjectIds($projectIds);
        }

        // 为每个文件集/单文件分享添加 copy_count
        foreach ($fileAndProjectItems as $index => $item) {
            $projectId = $list[$index]['project_id'] ?? null;
            $copyCount = 0;

            if (! empty($projectId)) {
                $projectIdInt = (int) $projectId;
                if ($projectIdInt > 0) {
                    $copyCount = $copyCountMap[$projectIdInt] ?? 0;
                }
            }

            $list[$index]['extend']['copy_count'] = $copyCount;
        }

        return $list;
    }

    /**
     * 为 Project、FileCollection 和 File 类型在外层添加 view_count 字段.
     *
     * @param array $list 分享列表
     * @return array 添加了 view_count 字段的列表
     */
    private function addViewCountToExtend(array $list): array
    {
        if (empty($list)) {
            return $list;
        }

        // 收集 FileCollection 和 File 类型的分享ID
        $shareIds = [];
        $fileTypeItems = [];

        foreach ($list as $index => $item) {
            $resourceType = $item['resource_type'] ?? 0;

            // 处理 Project、FileCollection 和 File 类型
            if (in_array($resourceType, [ResourceType::Project->value, ResourceType::File->value, ResourceType::FileCollection->value], true)) {
                $fileTypeItems[$index] = $item;

                // 从 id 字段获取分享ID
                $shareId = isset($item['id']) ? (int) $item['id'] : 0;
                if ($shareId > 0) {
                    $shareIds[] = $shareId;
                }
            }
        }

        // 批量查询 view_count
        $viewCountMap = [];
        if (! empty($shareIds)) {
            $shareIds = array_unique($shareIds);
            $viewCountMap = $this->getViewCountsByShareIds($shareIds);
        }

        // 为每个 Project、FileCollection 和 File 类型分享添加 view_count（放在外层，与 list 接口保持一致）
        foreach ($fileTypeItems as $index => $item) {
            $shareId = isset($list[$index]['id']) ? (int) $list[$index]['id'] : 0;
            $viewCount = 0;

            if ($shareId > 0 && isset($viewCountMap[$shareId])) {
                $viewCount = $viewCountMap[$shareId];
            }

            $list[$index]['view_count'] = $viewCount;
        }

        return $list;
    }

    /**
     * 记录访问日志.
     *
     * @param ResourceShareEntity $shareEntity 分享实体
     * @param null|MagicUserAuthorization $userAuthorization 用户授权信息（可为null）
     */
    private function recordAccessLog(ResourceShareEntity $shareEntity, ?MagicUserAuthorization $userAuthorization): void
    {
        try {
            // 判断用户类型
            $userType = ShareUserType::Anonymous->value; // 默认匿名用户
            $userId = null;
            $userName = null;
            $organizationCode = null;

            if ($userAuthorization !== null) {
                // 有登录用户
                $userId = $userAuthorization->getId();
                $organizationCode = $userAuthorization->getOrganizationCode();

                // 判断是团队成员还是游客
                // 如果组织代码与分享的组织代码相同，则为团队成员；否则为游客
                if ($organizationCode === $shareEntity->getOrganizationCode()) {
                    $userType = ShareUserType::TeamMember->value;
                    // 获取用户名
                    $userName = $userAuthorization->getRealName() ?: $userAuthorization->getNickname();
                } else {
                    $userType = ShareUserType::Guest->value;
                    $userName = $userAuthorization->getRealName() ?: $userAuthorization->getNickname();
                }
            }

            // 获取IP地址
            $ipAddress = $this->getClientIpAddress();

            // 记录访问日志
            $this->accessLogDomainService->recordAccessLog(
                $shareEntity->getId(),
                $userType,
                $userId,
                $userName,
                $organizationCode,
                $ipAddress
            );

            // 同时更新主表的 view_count（实时统计）
            $this->shareDomainService->incrementViewCount((string) $shareEntity->getId());
        } catch (Throwable $e) {
            // 记录访问日志失败不应该影响主流程，只记录错误日志
            $this->logger->error('记录分享访问日志失败', [
                'share_id' => $shareEntity->getId(),
                'share_code' => $shareEntity->getShareCode(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * 验证分享权限（获取分享实体并验证创建者权限和组织代码）.
     *
     * @param MagicUserAuthorization $userAuthorization 当前用户
     * @param string $resourceId 资源ID
     * @param string $permissionErrorKey 权限错误消息键（用于区分不同的权限错误场景）
     * @return ResourceShareEntity 分享实体
     * @throws Exception 如果权限验证失败
     */
    private function validateSharePermission(
        MagicUserAuthorization $userAuthorization,
        string $resourceId,
        string $permissionErrorKey
    ): ResourceShareEntity {
        $userId = $userAuthorization->getId();
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 1. 获取分享实体（包括已删除的记录，使用 withTrashed 查询）

        $shareEntity = $this->shareDomainService->getShareByResourceIdWithTrashed($resourceId);
        if (empty($shareEntity)) {
            ExceptionBuilder::throw(ShareErrorCode::RESOURCE_NOT_FOUND, 'share.not_found', [$resourceId]);
        }

        // 2. 验证权限：只有分享创建者才能查看
        if ($shareEntity->getCreatedUid() !== $userId) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, $permissionErrorKey, [$resourceId]);
        }

        // 3. 验证组织代码
        if ($shareEntity->getOrganizationCode() !== $organizationCode) {
            ExceptionBuilder::throw(ShareErrorCode::PERMISSION_DENIED, 'share.organization_mismatch', [$resourceId]);
        }

        return $shareEntity;
    }

    /**
     * 批量查询并填充日志列表中的用户名.
     *
     * @param array $logs 日志列表（引用传递，会被修改）
     * @param bool $checkUserNameEmpty 是否检查 user_name 为空（true: 只填充 user_name 为空的记录；false: 填充所有有 user_id 的记录）
     * @param bool $matchOrganization 是否匹配组织代码优先级（true: 优先使用匹配 organization_code 的用户名；false: 使用第一个找到的用户名）
     */
    private function fillUserNamesForLogs(array &$logs, bool $checkUserNameEmpty = true, bool $matchOrganization = false): void
    {
        // 收集需要查询的 user_id
        $userIdsToQuery = [];
        $userOrgMap = []; // 用于组织匹配

        foreach ($logs as $log) {
            if (! empty($log['user_id'])) {
                $shouldQuery = $checkUserNameEmpty ? empty($log['user_name']) : true;
                if ($shouldQuery) {
                    $userId = $log['user_id'];
                    if (! in_array($userId, $userIdsToQuery)) {
                        $userIdsToQuery[] = $userId;
                    }

                    // 如果需要匹配组织，收集组织代码信息
                    if ($matchOrganization) {
                        $orgCode = $log['user_organization_code'] ?? '';
                        if (! isset($userOrgMap[$userId])) {
                            $userOrgMap[$userId] = [];
                        }
                        if (! empty($orgCode)) {
                            $userOrgMap[$userId][$orgCode] = true;
                        }
                    }
                }
            }
        }

        if (empty($userIdsToQuery)) {
            return;
        }

        // 批量查询用户信息
        $userIdsToQuery = array_unique($userIdsToQuery);
        $users = $this->magicUserDomainService->getUserByIdsWithoutOrganization($userIdsToQuery);

        // 收集 magic_ids，用于批量查询 real_name
        $magicIds = [];
        $userIdToMagicIdMap = [];
        foreach ($users as $user) {
            $userId = $user->getUserId();
            $magicId = $user->getMagicId();
            if (! empty($magicId) && ! isset($userIdToMagicIdMap[$userId])) {
                $magicIds[] = $magicId;
                $userIdToMagicIdMap[$userId] = $magicId;
            }
        }

        // 批量查询 account 信息获取 real_name
        $accounts = [];
        if (! empty($magicIds)) {
            $magicIds = array_unique($magicIds);
            $accounts = $this->accountRepository->getAccountInfoByMagicIds($magicIds);
        }

        // 构建 magic_id => real_name 映射
        $magicIdToRealNameMap = [];
        foreach ($accounts as $account) {
            $magicIdToRealNameMap[$account->getMagicId()] = $account->getRealName() ?? '';
        }

        // 构建用户名映射
        $userNameMap = [];

        if ($matchOrganization && ! empty($userOrgMap)) {
            // 需要匹配组织：先处理匹配组织的用户，再处理不匹配的用户
            $matchedUsers = [];
            $unmatchedUsers = [];

            foreach ($users as $user) {
                $userId = $user->getUserId();
                $orgCode = $user->getOrganizationCode();
                $magicId = $userIdToMagicIdMap[$userId] ?? '';
                $realName = $magicIdToRealNameMap[$magicId] ?? '';
                $nickname = $user->getNickname() ?? '';
                // 优先使用 real_name，如果没有则使用 nickname（与记录日志时的逻辑一致）
                $userName = ! empty($realName) ? $realName : $nickname;

                // 如果该user_id对应的组织在需要查询的组织列表中，优先使用
                if (isset($userOrgMap[$userId][$orgCode])) {
                    $matchedUsers[] = ['userId' => $userId, 'userName' => $userName];
                } else {
                    $unmatchedUsers[] = ['userId' => $userId, 'userName' => $userName];
                }
            }

            // 先处理匹配组织的用户
            foreach ($matchedUsers as $item) {
                $userNameMap[$item['userId']] = $item['userName'];
            }

            // 再处理不匹配的用户（只在不存在时设置，避免覆盖匹配的）
            foreach ($unmatchedUsers as $item) {
                if (! isset($userNameMap[$item['userId']])) {
                    $userNameMap[$item['userId']] = $item['userName'];
                }
            }
        } else {
            // 不需要匹配组织：如果同一个user_id有多个组织记录，取第一个（user_id是全局唯一标识）
            foreach ($users as $user) {
                $userId = $user->getUserId();
                // 如果已经存在，跳过（保留第一个找到的）
                if (! isset($userNameMap[$userId])) {
                    $magicId = $userIdToMagicIdMap[$userId] ?? '';
                    $realName = $magicIdToRealNameMap[$magicId] ?? '';
                    $nickname = $user->getNickname() ?? '';
                    // 优先使用 real_name，如果没有则使用 nickname（与记录日志时的逻辑一致）
                    $userNameMap[$userId] = ! empty($realName) ? $realName : $nickname;
                }
            }
        }

        // 填充用户名到日志列表
        foreach ($logs as &$log) {
            if (! empty($log['user_id'])) {
                $shouldFill = $checkUserNameEmpty ? empty($log['user_name']) : true;
                if ($shouldFill) {
                    $log['user_name'] = $userNameMap[$log['user_id']] ?? '';
                }
            }
        }
        unset($log);
    }

    /**
     * 根据 filter_type 和分享状态决定是否包含已删除项目的复制记录.
     *
     * @param null|string $filterType 筛选类型（active/expired/cancelled/all）
     * @param ResourceShareEntity $shareEntity 分享实体
     * @return bool 是否包含已删除项目的复制记录
     */
    private function shouldIncludeDeletedProjects(
        ?string $filterType,
        ResourceShareEntity $shareEntity
    ): bool {
        // 如果前端传了 filter_type，优先使用
        if ($filterType !== null) {
            // 只有"已取消"状态才统计所有历史数据（包括已删除项目）
            // "分享中"和"已失效"只统计有效项目的复制记录
            return $filterType === ShareFilterType::Cancelled->value;
        }

        // 如果前端没传 filter_type，根据分享实体的状态判断
        // 注意：这只能判断是否已取消，无法区分"分享中"和"已失效"
        // 建议：要求前端必须传 filter_type
        return ! empty($shareEntity->getDeletedAt());
    }

    /**
     * 更新用户头像URL（将相对路径转换为完整URL）.
     */
    private function updateUserAvatarUrl(DataIsolation $dataIsolation, array $userEntities): void
    {
        $urlMapRealUrl = $this->getUserAvatarUrls($dataIsolation, $userEntities);

        foreach ($userEntities as $userEntity) {
            $userEntity->setAvatarUrl($urlMapRealUrl[$userEntity->getAvatarUrl()] ?? '');
        }
    }

    /**
     * 获取用户头像URL映射.
     */
    private function getUserAvatarUrls(DataIsolation $dataIsolation, array $userEntities): array
    {
        $avatarUrlMapRealUrl = [];
        $urlPaths = [];
        foreach ($userEntities as $userEntity) {
            if (str_starts_with($userEntity->getAvatarUrl(), 'http')) {
                $avatarUrlMapRealUrl[$userEntity->getAvatarUrl()] = $userEntity->getAvatarUrl();
            } else {
                $urlPaths[] = $userEntity->getAvatarUrl();
            }
        }
        $urlPaths = $this->getIcons($dataIsolation->getCurrentOrganizationCode(), $urlPaths);
        foreach ($urlPaths as $path => $urlPath) {
            $avatarUrlMapRealUrl[$path] = $urlPath->getUrl();
        }
        return array_merge($urlPaths, $avatarUrlMapRealUrl);
    }

    /**
     * 组装部门路径节点信息.
     */
    private function assemblePathNodeByDepartmentInfo(MagicDepartmentEntity $departmentInfo): array
    {
        return [
            // 部门名称
            'department_name' => $departmentInfo->getName(),
            // 部门id
            'department_id' => $departmentInfo->getDepartmentId(),
            'parent_department_id' => $departmentInfo->getParentDepartmentId(),
            // 部门路径
            'path' => $departmentInfo->getPath(),
            // 可见性
            'visible' => ! ($departmentInfo->getOption() === DepartmentOption::Hidden),
            'option' => $departmentInfo->getOption(),
        ];
    }

    /**
     * 获取客户端IP地址.
     *
     * @return null|string 客户端IP地址
     */
    private function getClientIpAddress(): ?string
    {
        // 优先级顺序：X-Real-IP -> X-Forwarded-For -> remote_addr
        $realIp = $this->request->getHeaderLine('x-real-ip');
        if (! empty($realIp)) {
            return $realIp;
        }

        $forwardedFor = $this->request->getHeaderLine('x-forwarded-for');
        if (! empty($forwardedFor)) {
            // X-Forwarded-For 可能包含多个IP，取第一个
            $ips = explode(',', $forwardedFor);
            return trim($ips[0]);
        }

        $serverParams = $this->request->getServerParams();
        return $serverParams['remote_addr'] ?? null;
    }

    /**
     * Resolve file IDs from file paths within a project workspace.
     *
     * Builds the full storage file_key for each path by combining the organization
     * prefix, the project workspace directory, and the relative path, then queries
     * the repository to find the matching TaskFileEntity records.
     *
     * @param string $organizationCode Organization code used to build the storage prefix
     * @param string $userId User ID used to build the workspace directory path
     * @param int $projectId Project ID used to build the workspace directory path
     * @param string[] $filePaths Relative paths inside the workspace, e.g. ['a/a.txt', 'a/']
     * @return string[] List of file IDs (as strings) found for the given paths
     */
    private function resolveFileIdsFromFilePaths(
        string $organizationCode,
        string $userId,
        int $projectId,
        array $filePaths
    ): array {
        // 1. Get the storage prefix, e.g. "DT001/open/"
        $prefix = $this->taskFileDomainService->getFullPrefix($organizationCode);
        // 2. Get the workspace directory path, e.g. "/project_123/workspace"
        $workDir = WorkDirectoryUtil::getWorkDir($userId, $projectId);
        // 3. Build the full file_key for each relative path
        $fileKeys = array_map(
            fn (string $path) => WorkDirectoryUtil::getFullFileKey($prefix, $workDir, $path),
            $filePaths
        );
        // 4. Batch-query file entities by file_key
        $fileEntities = $this->taskFileDomainService->getByFileKeys($fileKeys);
        // 5. Return file IDs as strings (consistent with dto->getFileIds() return type)
        return array_map(fn ($entity) => (string) $entity->getFileId(), $fileEntities);
    }

    /**
     * Build the frontend share URL from the saved entity and request DTO.
     *
     * Password resolution priority:
     * 1. Plain-text password from the current request (dto->getPassword()) – no extra DB call needed.
     * 2. Encrypted password stored in the entity – decrypted via domain service.
     * If decryption fails a warning is logged and the URL is returned without a password parameter.
     */
    private function buildShareUrl(
        ResourceType $resourceType,
        string $resourceId,
        ResourceShareEntity $savedEntity,
        CreateShareRequestDTO $dto
    ): ?string {
        $frontendDomain = rtrim((string) env('MAGIC_FRONTEND_DOMAIN', ''), '/');
        if ($frontendDomain === '') {
            return null;
        }

        $uri = match ($resourceType) {
            ResourceType::Topic => '/share/topic/' . $resourceId,
            ResourceType::FileCollection, ResourceType::File, ResourceType::Project => '/share/files/' . $resourceId,
            default => null,
        };

        if ($uri === null) {
            return null;
        }

        $shareUrl = $frontendDomain . $uri;

        if (! empty($savedEntity->getPassword())) {
            // Prefer the plain-text password supplied in the current request to avoid an extra DB round-trip.
            $plainPassword = ($dto->hasField('password') && ! empty($dto->getPassword()))
                ? (string) $dto->getPassword()
                : '';

            if ($plainPassword === '') {
                // Fall back to decrypting the stored password from the already-loaded entity.
                try {
                    $plainPassword = $this->shareDomainService->getDecryptedPassword($savedEntity);
                } catch (Throwable $e) {
                    $this->logger->warning('Failed to decrypt share password for URL building', [
                        'share_code' => $savedEntity->getShareCode(),
                        'resource_id' => $resourceId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            if ($plainPassword !== '') {
                $shareUrl .= '?password=' . rawurlencode($plainPassword);
            }
        }

        return $shareUrl;
    }
}
