<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\File\Service\FileAppService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentDomainService;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\SuperMagic\Application\Chat\Service\ChatAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceArchiveStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\WorkspaceCreationParams;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TaskDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\WorkspaceDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Volcengine\SandboxService;
use Dtyq\SuperMagic\Infrastructure\Utils\AccessTokenUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetTopicAttachmentsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetWorkspaceTopicsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveWorkspaceRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\WorkspaceListRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\MessageItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\SaveWorkspaceResultDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TaskFileItemDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\TopicListResponseDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\WorkspaceListResponseDTO;
use Exception;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class WorkspaceAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected MagicChatMessageAppService $magicChatMessageAppService,
        protected MagicDepartmentDomainService $magicDepartmentDomainService,
        protected WorkspaceDomainService $workspaceDomainService,
        protected MagicConversationDomainService $magicConversationDomainService,
        protected MagicUserDomainService $userDomainService,
        protected MagicTopicDomainService $topicDomainService,
        protected FileAppService $fileAppService,
        protected TaskDomainService $taskDomainService,
        protected AccountAppService $accountAppService,
        protected SandboxService $sandboxService,
        protected LockerInterface $locker,
        protected ChatAppService $chatAppService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * 获取工作区列表.
     */
    public function getWorkspaceList(RequestContext $requestContext, WorkspaceListRequestDTO $requestDTO): WorkspaceListResponseDTO
    {
        // 构建查询条件
        $conditions = $requestDTO->buildConditions();

        // 如果没有指定用户ID且有用户授权信息，使用当前用户ID
        if (empty($conditions['user_id'])) {
            $conditions['user_id'] = $requestContext->getUserAuthorization()->getId();
        }

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());

        // 通过领域服务获取工作区列表
        $result = $this->workspaceDomainService->getWorkspacesByConditions(
            $conditions,
            $requestDTO->page,
            $requestDTO->pageSize,
            $dataIsolation
        );

        // 设置默认值
        $result['auto_create'] = false;

        // 如果有工作区列表，获取所有工作区的话题列表
        if (! empty($result['list'])) {
            $workspaceIds = [];
            foreach ($result['list'] as $workspace) {
                $workspaceIds[] = $workspace->getId();
            }

            // 获取所有工作区的话题列表，以工作区ID为键
            $topicList = $this->workspaceDomainService->getWorkspaceTopics($workspaceIds, $dataIsolation, false);
            $topics = [];
            // 重新按工作区 ID 分组
            foreach ($topicList['list'] as $topic) {
                $workspaceId = (int) $topic->getWorkspaceId();
                if (! isset($topics[$workspaceId])) {
                    $topics[$workspaceId] = [];
                }
                $topics[$workspaceId][] = $topic;
            }
            $result['topics'] = $topics;
        } else {
            // 如果 result 为空则创建一个默认会话和话题，并新建一个工作区和目录与其绑定
            // 使用默认的工作区名称和话题名称创建工作区
            $creationResult = $this->initUserWorkspace($dataIsolation);

            // 将新创建的工作区添加到结果中
            if (! empty($creationResult['workspace'])) {
                $result['list'] = [$creationResult['workspace']];
                $result['total'] = 1;
                $result['auto_create'] = $creationResult['auto_create']; // 使用创建结果中的auto_create
                // 使用创建时返回的任务状态信息
                $workspaceId = $creationResult['workspace']->getId();
                $result['topics'][$workspaceId] = [$creationResult['topic']];
            }
        }
        // 转换为响应DTO
        return WorkspaceListResponseDTO::fromResult($result);
    }

    /**
     * Save workspace (create or update).
     * @return SaveWorkspaceResultDTO Operation result, including workspace ID
     * @throws BusinessException Throws an exception if saving fails
     * @throws Throwable
     */
    public function saveWorkspace(RequestContext $requestContext, SaveWorkspaceRequestDTO $requestDTO): SaveWorkspaceResultDTO
    {
        Db::beginTransaction();
        try {
            // Get user authorization information
            $userAuthorization = $requestContext->getUserAuthorization();

            // Create data isolation object
            $dataIsolation = $this->createDataIsolation($userAuthorization);

            // Prepare workspace entity
            if ($requestDTO->getWorkspaceId()) {
                // Update, currently only updates workspace name
                $this->workspaceDomainService->updateWorkspace($dataIsolation, (int) $requestDTO->getWorkspaceId(), $requestDTO->getWorkspaceName());
                Db::commit();
                return SaveWorkspaceResultDTO::fromId((int) $requestDTO->getWorkspaceId());
            }

            // 提交事务
            Db::commit();

            // Create, use provided workspace name if available; otherwise use default name
            $result = $this->initUserWorkspace($dataIsolation, $requestDTO->getWorkspaceName());
            return SaveWorkspaceResultDTO::fromId($result['workspace']->getId());
        } catch (EventException $e) {
            // 回滚事务
            Db::rollBack();
            $this->logger->error(sprintf("Error creating new workspace event: %s\n%s", $e->getMessage(), $e->getTraceAsString()));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_TOPIC_FAILED, $e->getMessage());
        } catch (Throwable $e) {
            Db::rollBack();
            $this->logger->error(sprintf("Error creating new workspace: %s\n%s", $e->getMessage(), $e->getTraceAsString()));
            ExceptionBuilder::throw(SuperAgentErrorCode::CREATE_TOPIC_FAILED, 'topic.create_topic_failed');
        }
    }

    /**
     * 获取工作区下的话题列表.
     */
    public function getWorkspaceTopics(RequestContext $requestContext, GetWorkspaceTopicsRequestDTO $dto): TopicListResponseDTO
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());

        // 通过领域服务获取工作区话题列表
        $result = $this->workspaceDomainService->getWorkspaceTopics(
            [$dto->getWorkspaceId()],
            $dataIsolation,
            true,
            $dto->getPageSize(),
            $dto->getPage(),
            $dto->getOrderBy(),
            $dto->getOrderDirection()
        );

        // 转换为响应 DTO
        return TopicListResponseDTO::fromResult($result);
    }

    /**
     * 获取话题的附件列表.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param GetTopicAttachmentsRequestDTO $requestDto 话题附件请求DTO
     * @return array 附件列表
     */
    public function getTopicAttachments(MagicUserAuthorization $userAuthorization, GetTopicAttachmentsRequestDTO $requestDto): array
    {
        // 获取当前话题的创建者
        $topicEntity = $this->workspaceDomainService->getTopicById((int) $requestDto->getTopicId());
        if (empty($topicEntity)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }
        if ($topicEntity->getCreatedUid() != $userAuthorization->getId()) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'topic.access_topic_attachment_denied');
        }
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->getTopicAttachmentList($dataIsolation, $requestDto);
    }

    public function getTopicAttachmentsByAccessToken(GetTopicAttachmentsRequestDTO $requestDto): array
    {
        $token = $requestDto->getToken();
        // 从缓存里获取数据
        if (! AccessTokenUtil::validate($token)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
        }
        // 从token 获取内容
        $topicId = AccessTokenUtil::getResource($token);
        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        $requestDto->setTopicId($topicId);

        // 创建DataIsolation
        $dataIsolation = DataIsolation::simpleMake($organizationCode, '');
        return $this->getTopicAttachmentList($dataIsolation, $requestDto);
    }

    /**
     * 获取任务的附件列表.
     */
    public function getTaskAttachments(MagicUserAuthorization $userAuthorization, int $taskId, int $page = 1, int $pageSize = 10): array
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取任务附件列表
        $result = $this->workspaceDomainService->getTaskAttachments($taskId, $dataIsolation, $page, $pageSize);

        // 处理文件 URL
        $list = [];
        $organizationCode = $userAuthorization->getOrganizationCode();

        // 遍历附件列表，使用TaskFileItemDTO处理
        foreach ($result['list'] as $entity) {
            // 创建DTO
            $dto = new TaskFileItemDTO();
            $dto->fileId = (string) $entity->getFileId();
            $dto->taskId = (string) $entity->getTaskId();
            $dto->fileType = $entity->getFileType();
            $dto->fileName = $entity->getFileName();
            $dto->fileExtension = $entity->getFileExtension();
            $dto->fileKey = $entity->getFileKey();
            $dto->fileSize = $entity->getFileSize();

            // 添加 file_url 字段
            $fileKey = $entity->getFileKey();
            if (! empty($fileKey)) {
                $fileLink = $this->fileAppService->getLink($organizationCode, $fileKey);
                if ($fileLink) {
                    $dto->fileUrl = $fileLink->getUrl();
                } else {
                    $dto->fileUrl = '';
                }
            } else {
                $dto->fileUrl = '';
            }

            $list[] = $dto->toArray();
        }

        return [
            'list' => $list,
            'total' => $result['total'],
        ];
    }

    /**
     * 删除工作区.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $workspaceId 工作区ID
     * @return bool 是否删除成功
     * @throws BusinessException 如果用户无权限或工作区不存在则抛出异常
     */
    public function deleteWorkspace(RequestContext $requestContext, int $workspaceId): bool
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 调用领域服务执行删除
        $this->workspaceDomainService->deleteWorkspace($dataIsolation, $workspaceId);

        return true;
    }

    /**
     * 获取任务详情.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $taskId 任务ID
     * @return array 任务详情
     * @throws BusinessException 如果用户无权限或任务不存在则抛出异常
     */
    public function getTaskDetail(RequestContext $requestContext, int $taskId): array
    {
        // 获取用户授权信息
        $userAuthorization = $requestContext->getUserAuthorization();

        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($userAuthorization);

        // 获取任务详情
        $taskEntity = $this->workspaceDomainService->getTaskById($taskId);
        if (! $taskEntity) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'task.not_found');
        }

        return $taskEntity->toArray();
    }

    /**
     * 获取话题的消息列表.
     *
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param string $sortDirection 排序方向，支持asc和desc
     * @return array 消息列表和总数
     */
    public function getMessagesByTopicId(int $topicId, int $page = 1, int $pageSize = 20, string $sortDirection = 'asc'): array
    {
        // 获取消息列表
        $result = $this->taskDomainService->getMessagesByTopicId($topicId, $page, $pageSize, true, $sortDirection);

        // 转换为响应格式
        $messages = [];
        foreach ($result['list'] as $message) {
            $messages[] = new MessageItemDTO($message->toArray());
        }

        $data = [
            'list' => $messages,
            'total' => $result['total'],
        ];

        // 获取 topic 信息
        $topicEntity = $this->workspaceDomainService->getTopicById($topicId);
        if ($topicEntity != null) {
            $data['sandbox_id'] = $topicEntity->getSandboxId();
        }
        return $data;
    }

    /**
     * 设置工作区归档状态.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param array $workspaceIds 工作区ID数组
     * @param int $isArchived 归档状态（0:未归档, 1:已归档）
     * @return bool 是否操作成功
     */
    public function setWorkspaceArchived(RequestContext $requestContext, array $workspaceIds, int $isArchived): bool
    {
        // 创建数据隔离对象
        $dataIsolation = $this->createDataIsolation($requestContext->getUserAuthorization());
        $currentUserId = $dataIsolation->getCurrentUserId();

        // 参数验证
        if (empty($workspaceIds)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'workspace.ids_required');
        }

        // 验证归档状态值是否有效
        if (! in_array($isArchived, [
            WorkspaceArchiveStatus::NotArchived->value,
            WorkspaceArchiveStatus::Archived->value,
        ])) {
            ExceptionBuilder::throw(GenericErrorCode::IllegalOperation, 'workspace.invalid_archive_status');
        }

        // 批量更新工作区归档状态
        $success = true;
        foreach ($workspaceIds as $workspaceId) {
            // 获取工作区详情，验证所有权
            $workspaceEntity = $this->workspaceDomainService->getWorkspaceDetail((int) $workspaceId);

            // 如果工作区不存在，跳过
            if (! $workspaceEntity) {
                $success = false;
                continue;
            }

            // 验证工作区是否属于当前用户
            if ($workspaceEntity->getUserId() !== $currentUserId) {
                ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'workspace.not_owner');
            }

            // 调用领域服务设置归档状态
            $result = $this->workspaceDomainService->archiveWorkspace(
                $requestContext,
                (int) $workspaceId,
                $isArchived === WorkspaceArchiveStatus::Archived->value
            );
            if (! $result) {
                $success = false;
            }
        }

        return $success;
    }

    /**
     * 获取文件URL列表.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param array $fileIds 文件ID列表
     * @param string $downloadMode 下载模式（download:下载, preview:预览）
     * @param array $options 其他选项
     * @return array 文件URL列表
     */
    public function getFileUrls(MagicUserAuthorization $userAuthorization, array $fileIds, string $downloadMode, array $options = []): array
    {
        // 创建数据隔离对象
        $organizationCode = $userAuthorization->getOrganizationCode();
        $result = [];

        foreach ($fileIds as $fileId) {
            // 获取文件实体
            $fileEntity = $this->taskDomainService->getTaskFile((int) $fileId);
            if (empty($fileEntity)) {
                // 如果文件不存在，跳过
                continue;
            }

            // 验证文件是否属于当前用户
            $topicEntity = $this->workspaceDomainService->getTopicById($fileEntity->getTopicId());
            if (empty($topicEntity) || $topicEntity->getUserId() !== $userAuthorization->getId()) {
                // 如果这个话题不是本人的，不处理
                continue;
            }

            $downloadNames = [];
            if ($downloadMode == 'download') {
                $downloadNames[$fileEntity->getFileKey()] = $fileEntity->getFileName();
            }
            $fileLink = $this->fileAppService->getLink($organizationCode, $fileEntity->getFileKey(), null, $downloadNames, $options);
            if (empty($fileLink)) {
                // 如果获取URL失败，跳过
                continue;
            }

            // 只添加成功的结果
            $result[] = [
                'file_id' => $fileId,
                'url' => $fileLink->getUrl(),
            ];
        }

        return $result;
    }

    /**
     * 通过访问令牌获取文件URL列表.
     *
     * @param array $fileIds 文件ID列表
     * @param string $token 访问令牌
     * @param string $downloadMode 下载模式 默认下载 download 预览 preview
     * @return array 文件URL列表
     */
    public function getFileUrlsByAccessToken(array $fileIds, string $token, string $downloadMode): array
    {
        // 从缓存里获取数据
        if (! AccessTokenUtil::validate($token)) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'task_file.access_denied');
        }

        // 从token获取内容
        $topicId = AccessTokenUtil::getResource($token);
        $organizationCode = AccessTokenUtil::getOrganizationCode($token);
        $result = [];

        foreach ($fileIds as $fileId) {
            $fileEntity = $this->taskDomainService->getTaskFile((int) $fileId);
            if (empty($fileEntity) || $fileEntity->getTopicId() != $topicId) {
                // 如果文件不存在或不属于该话题，跳过
                continue;
            }

            $downloadNames = [];
            if ($downloadMode == 'download') {
                $downloadNames[$fileEntity->getFileKey()] = $fileEntity->getFileName();
            }
            $fileLink = $this->fileAppService->getLink($organizationCode, $fileEntity->getFileKey(), null, $downloadNames);
            if (empty($fileLink)) {
                // 如果获取URL失败，跳过
                continue;
            }

            // 只添加成功的结果
            $result[] = [
                'file_id' => $fileId,
                'url' => $fileLink->getUrl(),
            ];
        }

        return $result;
    }

    public function getTopicDetail(int $topicId): string
    {
        $topicEntity = $this->workspaceDomainService->getTopicById($topicId);
        if (empty($topicEntity)) {
            return '';
        }
        return $topicEntity->getTopicName();
    }

    /**
     * 获取工作区信息通过话题ID集合.
     *
     * @param array $topicIds 话题ID集合（字符串数组）
     * @return array 以话题ID为键，工作区信息为值的关联数组
     */
    public function getWorkspaceInfoByTopicIds(array $topicIds): array
    {
        // 转换字符串ID为整数
        $intTopicIds = array_map('intval', $topicIds);

        // 调用领域服务获取工作区信息
        return $this->workspaceDomainService->getWorkspaceInfoByTopicIds($intTopicIds);
    }

    public function getTopicAttachmentList(DataIsolation $dataIsolation, GetTopicAttachmentsRequestDTO $requestDto): array
    {
        // 判断话题是否存在
        $topicEntity = $this->workspaceDomainService->getTopicById((int) $requestDto->getTopicId());
        if (empty($topicEntity)) {
            return [];
        }
        $sandboxId = $topicEntity->getSandboxId();
        $workDir = $topicEntity->getWorkDir();

        // 通过领域服务获取话题附件列表
        $result = $this->taskDomainService->getTaskAttachmentsByTopicId(
            (int) $requestDto->getTopicId(),
            $dataIsolation,
            $requestDto->getPage(),
            $requestDto->getPageSize(),
            $requestDto->getFileType()
        );

        $result = $this->filterResultByGitVersion($result, $topicEntity->getWorkspaceCommitHash(), $topicEntity->getId());

        // 处理文件 URL
        $list = [];
        $organizationCode = $dataIsolation->getCurrentOrganizationCode();

        // 遍历附件列表，使用TaskFileItemDTO处理
        foreach ($result['list'] as $entity) {
            // 创建DTO
            $dto = new TaskFileItemDTO();
            $dto->fileId = (string) $entity->getFileId();
            $dto->taskId = (string) $entity->getTaskId();
            $dto->fileType = $entity->getFileType();
            $dto->fileName = $entity->getFileName();
            $dto->fileExtension = $entity->getFileExtension();
            $dto->fileKey = $entity->getFileKey();
            $dto->fileSize = $entity->getFileSize();
            $dto->isHidden = $entity->getIsHidden();

            // Calculate relative file path by removing workDir from fileKey
            $fileKey = $entity->getFileKey();
            $workDirPos = strpos($fileKey, $workDir);
            if ($workDirPos !== false) {
                $dto->relativeFilePath = substr($fileKey, $workDirPos + strlen($workDir));
            } else {
                $dto->relativeFilePath = $fileKey; // If workDir not found, use original fileKey
            }

            // 添加 file_url 字段
            $fileKey = $entity->getFileKey();
            if (! empty($fileKey)) {
                $fileLink = $this->fileAppService->getLink($organizationCode, $fileKey);
                if ($fileLink) {
                    $dto->fileUrl = $fileLink->getUrl();
                } else {
                    $dto->fileUrl = '';
                }
            } else {
                $dto->fileUrl = '';
            }

            $list[] = $dto->toArray();
        }

        // 构建树状结构
        $tree = $this->assembleTaskFilesTree($sandboxId, $workDir, $list);

        return [
            'list' => $list,
            'tree' => $tree,
            'total' => $result['total'],
        ];
    }

    /**
     * 将文件列表组装成树状结构，支持无限极嵌套.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $workDir 工作目录
     * @param array $files 文件列表数据
     * @return array 组装后的树状结构数据
     */
    private function assembleTaskFilesTree(string $sandboxId, string $workDir, array $files): array
    {
        if (empty($files)) {
            return [];
        }

        // 文件树根节点
        $root = [
            'type' => 'root',
            'is_directory' => true,
            'is_hidden' => false,
            'children' => [],
        ];

        // 目录映射，用于快速查找目录节点
        $directoryMap = ['' => &$root]; // 根目录的引用

        // 去掉workDir开头可能的斜杠，确保匹配
        $workDir = ltrim($workDir, '/');

        // 遍历所有文件路径，确定根目录
        $rootDir = '';
        foreach ($files as $file) {
            if (empty($file['file_key'])) {
                continue; // 跳过没有文件路径的记录
            }

            $filePath = $file['file_key'];

            // 查找workDir在文件路径中的位置
            $workDirPos = strpos($filePath, $workDir);
            if ($workDirPos === false) {
                continue; // 找不到workDir，跳过
            }

            // 获取workDir结束的位置
            $rootDir = substr($filePath, 0, $workDirPos + strlen($workDir));
            break;
        }

        // 如果没有找到有效的根目录，创建一个扁平的目录结构
        if (empty($rootDir)) {
            // 直接将所有文件作为根节点的子节点
            foreach ($files as $file) {
                if (empty($file['file_key'])) {
                    continue; // 跳过没有文件路径的记录
                }

                // 提取文件名，通常是路径最后一部分
                $pathParts = explode('/', $file['file_key']);
                $fileName = end($pathParts);

                // 创建文件节点
                $fileNode = $file;
                $fileNode['type'] = 'file';
                $fileNode['is_directory'] = false;
                $fileNode['children'] = [];
                $fileNode['name'] = $fileName;

                // 添加到根节点
                $root['children'][] = $fileNode;
            }

            return $root['children'];
        }

        // 处理所有文件
        foreach ($files as $file) {
            if (empty($file['file_key'])) {
                continue; // 跳过没有文件路径的记录
            }

            $filePath = $file['file_key'];

            // 提取相对路径
            if (strpos($filePath, $rootDir) === 0) {
                // 移除根目录前缀，获取相对路径
                $relativePath = substr($filePath, strlen($rootDir));
                $relativePath = ltrim($relativePath, '/');

                // 创建文件节点
                $fileNode = $file;
                $fileNode['type'] = 'file';
                $fileNode['is_directory'] = false;
                $fileNode['children'] = [];

                // 如果相对路径为空，表示文件直接位于根目录
                if (empty($relativePath)) {
                    $root['children'][] = $fileNode;
                    continue;
                }

                // 分析相对路径，提取目录部分和文件名
                $pathParts = explode('/', $relativePath);
                $fileName = array_pop($pathParts); // 移除并获取最后一部分作为文件名

                if (empty($pathParts)) {
                    // 没有目录部分，文件直接位于根目录下
                    $root['children'][] = $fileNode;
                    continue;
                }

                // 逐级构建目录
                $currentPath = '';
                $parent = &$root;
                $parentIsHidden = false; // 父级是否为隐藏目录

                foreach ($pathParts as $dirName) {
                    if (empty($dirName)) {
                        continue; // 跳过空目录名
                    }

                    // 更新当前路径
                    $currentPath = empty($currentPath) ? $dirName : "{$currentPath}/{$dirName}";

                    // 如果当前路径的目录不存在，创建它
                    if (! isset($directoryMap[$currentPath])) {
                        // 判断当前目录是否为隐藏目录
                        $isHiddenDir = $this->isHiddenDirectory($dirName) || $parentIsHidden;

                        // 创建新目录节点
                        $newDir = [
                            'name' => $dirName,
                            'path' => $currentPath,
                            'type' => 'directory',
                            'is_directory' => true,
                            'is_hidden' => $isHiddenDir,
                            'children' => [],
                        ];

                        // 将新目录添加到父目录的子项中
                        $parent['children'][] = $newDir;

                        // 保存目录引用到映射中
                        $directoryMap[$currentPath] = &$parent['children'][count($parent['children']) - 1];
                    }

                    // 更新父目录引用为当前目录
                    $parent = &$directoryMap[$currentPath];
                    // 更新父级隐藏状态，如果当前目录是隐藏的，那么其子级都应该是隐藏的
                    $parentIsHidden = $parent['is_hidden'] ?? false;
                }

                // 如果父目录是隐藏的，那么文件也应该被标记为隐藏
                if ($parentIsHidden) {
                    $fileNode['is_hidden'] = true;
                }

                // 将文件添加到最终目录的子项中
                $parent['children'][] = $fileNode;
            }
        }

        // 返回根目录的子项作为结果
        return $root['children'];
    }

    /**
     * 判断目录名是否为隐藏目录
     * 隐藏目录的判断规则：目录名以 . 开头.
     *
     * @param string $dirName 目录名
     * @return bool true-隐藏目录，false-普通目录
     */
    private function isHiddenDirectory(string $dirName): bool
    {
        return str_starts_with($dirName, '.');
    }

    /**
     * 初始化用户工作区.
     *
     * @param DataIsolation $dataIsolation 数据隔离对象
     * @param string $workspaceName 工作区名称，默认为"我的工作区"
     * @return array 创建结果，包含workspace和topic实体对象，以及auto_create标志
     * @throws BusinessException 如果创建失败则抛出异常
     * @throws Throwable
     */
    private function initUserWorkspace(
        DataIsolation $dataIsolation,
        string $workspaceName = AgentConstant::DEFAULT_WORKSPACE_NAME
    ): array {
        $this->logger->info('开始初始化用户工作区');
        // 获取超级麦吉用户
        [$chatConversationId, $chatConversationTopicId] = $this->chatAppService->initMagicChatConversation($dataIsolation);
        $this->logger->info(sprintf('初始化超级麦吉, chatConversationId=%s, chatConversationTopicId=%s', $chatConversationId, $chatConversationTopicId));
        // 新建工作区，绑定会话id
        $result = $this->workspaceDomainService->createWorkspace(
            $dataIsolation,
            new WorkspaceCreationParams(
                $chatConversationId,
                $workspaceName, // 使用参数中的工作区名称
                $chatConversationTopicId,
                AgentConstant::DEFAULT_TOPIC_NAME // 使用固定的话题名称
            )
        );
        $workspaceEntity = $result['workspace'];
        $topicEntity = $result['topic'];

        if (empty($workspaceEntity)) {
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'workspace.create_workspace_failed');
        }
        // 返回创建的结果，包含实体对象和auto_create=true
        return [
            'workspace' => $workspaceEntity,  // 直接返回实体对象
            'topic' => $topicEntity,  // 直接返回实体对象
            'auto_create' => true,  // 添加auto_create字段
        ];
    }

    /**
     * 通过commit hash 和话题id 获取版本后，根据dir 文件列表，过滤result.
     */
    private function filterResultByGitVersion(array $result, string $commitHash, int $topicId): array
    {
        $dir = '.workspace';
        $workspaceVersion = $this->workspaceDomainService->getWorkspaceVersionByCommitAndTopic($commitHash, $topicId, $dir);
        if (empty($workspaceVersion)) {
            return $result;
        }

        if (empty($workspaceVersion->getDir())) {
            return $result;
        }

        # 遍历result的updatedAt ，如果updatedAt 小于workspaceVersion 的updated_at ，则保持在一个临时数组
        $tempResult1 = [];
        foreach ($result['list'] as $item) {
            if ($item['updated_at'] >= $workspaceVersion->getUpdatedAt()) {
                $tempResult1[] = $item;
            }
        }
        $dir = json_decode($workspaceVersion->getDir(), true);
        # dir 是一个二维数组，遍历$dir, 判断是否是一个文件，如果没有文件后缀说明是一个目录，过滤掉目录
        # dir =["generated_images","generated_images\/cute-cartoon-cat.jpg","generated_images\/handdrawn-cute-cat.jpg","generated_images\/abstract-modern-generic.jpg","generated_images\/minimalist-cat-icon.jpg","generated_images\/realistic-elegant-cat.jpg","generated_images\/oilpainting-elegant-cat.jpg","generated_images\/anime-cute-cat.jpg","generated_images\/cute-cartoon-dog.jpg","generated_images\/universal-minimal-logo-3.jpg","generated_images\/universal-minimal-logo.jpg","generated_images\/universal-minimal-logo-2.jpg","generated_images\/realistic-cat-photo.jpg","generated_images\/minimal-tech-logo.jpg","logs","logs\/agentlang.log"]
        $dir = array_filter($dir, function ($item) {
            if (strpos($item, '.') === false) {
                return false;
            }
            return true;
        });

        # 遍历$result ，如果$result 的file_key 在$dir 中， dir中保存的是file_key 中一部分，需要使用字符串匹配，如果存在则保持在一个临时数组
        $tempResult2 = [];
        foreach ($result['list'] as $item) {
            foreach ($dir as $dirItem) {
                if (strpos($item['file_key'], $dirItem) !== false) {
                    $tempResult2[] = $item;
                }
            }
        }
        $tempResult = array_merge($tempResult1, $tempResult2);

        # 对tempResult进行去重
        $result['list'] = array_unique($tempResult, SORT_REGULAR);
        $result['total'] = count($result['list']);
        return $result;
    }
}
