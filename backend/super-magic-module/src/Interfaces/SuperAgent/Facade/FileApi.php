<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AgentFileAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileBatchAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileManagementAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileProcessAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileVersionAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\SandboxFileNotificationAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Dtyq\SuperMagic\Infrastructure\Utils\WorkFileUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchDeleteFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchMoveFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchSaveFileContentRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchSaveProjectFilesRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CheckBatchOperationStatusRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateBatchDownloadRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\DeleteDirectoryRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileVersionsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\MoveFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\RefreshStsTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ReplaceFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\RollbackFileToVersionRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SandboxFileNotificationRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveProjectFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TopicUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\WorkspaceAttachmentsRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\RateLimit\Annotation\RateLimit;
use Qbhy\HyperfAuth\AuthManager;

#[ApiResponse('low_code')]
class FileApi extends AbstractApi
{
    public function __construct(
        private readonly FileProcessAppService $fileProcessAppService,
        private readonly FileBatchAppService $fileBatchAppService,
        private readonly FileManagementAppService $fileManagementAppService,
        private readonly FileVersionAppService $fileVersionAppService,
        protected WorkspaceAppService $workspaceAppService,
        protected RequestInterface $request,
        protected AgentFileAppService $agentFileAppService,
        private readonly SandboxFileNotificationAppService $sandboxFileNotificationAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 批量处理附件，根据fileKey检查是否存在，存在则跳过，不存在则保存.
     * 仅需提供task_id和attachments参数,其他参数将从任务中自动获取.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 处理结果
     */
    public function processAttachments(RequestContext $requestContext): array
    {
        // 获取请求参数
        $attachments = $this->request->input('attachments', []);
        $sandboxId = (string) $this->request->input('sandbox_id', '');
        $organizationCode = $this->request->input('organization_code', '');

        // 参数验证
        if (empty($attachments)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file.attachments_required');
        }

        if (empty($sandboxId)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file.sandbox_id_required');
        }

        if (empty($organizationCode)) {
            // 如果没有提供组织编码,则使用默认值
            $organizationCode = 'default';
        }

        // 调用应用服务处理附件,传入null让服务层自动获取topic_id
        return $this->fileProcessAppService->processAttachmentsArray(
            $attachments,
            $sandboxId,
            $organizationCode,
            null // 不传入topic_id,让服务层根据taskId自动获取
        );
    }

    /**
     * 刷新 STS Token.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 刷新结果
     */
    public function refreshStsToken(RequestContext $requestContext): array
    {
        $token = $this->request->header('token', '');
        if (empty($token)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_required');
        }

        if ($token !== config('super-magic.sandbox.token', '')) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_invalid');
        }
        // 创建DTO并从请求中解析数据
        $requestData = $this->request->all();
        $refreshStsTokenDTO = RefreshStsTokenRequestDTO::fromRequest($requestData);

        return $this->fileProcessAppService->refreshStsToken($refreshStsTokenDTO);
    }

    /**
     * 刷新 STS Token.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 刷新结果
     */
    public function refreshTmpStsToken(RequestContext $requestContext): array
    {
        $token = $this->request->header('token', '');
        if (empty($token)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_required');
        }

        if ($token !== config('super-magic.sandbox.token', '')) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'token_invalid');
        }

        // 创建DTO并从请求中解析数据
        $requestData = $this->request->all();
        $refreshStsTokenDTO = RefreshStsTokenRequestDTO::fromRequest($requestData);

        return $this->fileProcessAppService->refreshStsToken($refreshStsTokenDTO);
    }

    public function workspaceAttachments(RequestContext $requestContext): array
    {
        // $topicId = $this->request->input('topic_id', '');
        // $commitHash = $this->request->input('commit_hash', '');
        // $sandboxId = $this->request->input('sandbox_id', '');
        // $folder = $this->request->input('folder', '');
        // $dir = $this->request->input('dir', '');
        $requestDTO = new WorkspaceAttachmentsRequestDTO();
        $requestDTO = $requestDTO->fromRequest($this->request);

        if (empty($requestDTO->getTopicId())) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'topic_id_required');
        }

        if (empty($requestDTO->getCommitHash())) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'commit_hash_required');
        }

        if (empty($requestDTO->getSandboxId())) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'sandbox_id_required');
        }

        if (empty($requestDTO->getDir())) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'dir_required');
        }

        if (empty($requestDTO->getFolder())) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'folder_required');
        }

        return $this->fileProcessAppService->workspaceAttachments($requestDTO);
    }

    /**
     * 批量保存文件内容.
     * 并发执行沙箱文件编辑和OSS保存.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 批量保存结果
     */
    public function saveFileContent(RequestContext $requestContext): array
    {
        $requestData = $this->request->all();
        if (empty($requestData)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'files_array_required');
        }

        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();
        $batchSaveDTO = BatchSaveFileContentRequestDTO::fromRequest($requestData);

        // 并发执行沙箱保存和OSS保存
        // $this->fileSaveContentAppService->batchSaveFileContentViaSandbox($batchSaveDTO, $userAuthorization);

        return $this->fileProcessAppService->batchSaveFileContent($batchSaveDTO, $userAuthorization);
    }

    public function deleteFile(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->fileManagementAppService->deleteFile($requestContext, (int) $id);
    }

    public function deleteDirectory(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求数据并创建DTO
        $requestDTO = DeleteDirectoryRequestDTO::fromRequest($this->request);

        // 调用应用服务
        return $this->fileManagementAppService->deleteDirectory($requestContext, $requestDTO);
    }

    public function batchDeleteFiles(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求数据并创建DTO
        $requestDTO = BatchDeleteFilesRequestDTO::fromRequest($this->request);

        // 调用应用服务
        return $this->fileManagementAppService->batchDeleteFiles($requestContext, $requestDTO);
    }

    public function renameFile(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $targetName = $this->request->input('target_name', '');

        // Validate target_name parameter using WorkFileUtil
        if (! WorkFileUtil::isValidFileName($targetName)) {
            ExceptionBuilder::throw(SuperAgentErrorCode::FILE_ILLEGAL_NAME, 'file.illegal_file_name');
        }
        return $this->fileManagementAppService->renameFile($requestContext, (int) $id, $targetName);
    }

    public function moveFile(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Get request data and create DTO
        $requestDTO = MoveFileRequestDTO::fromRequest($this->request);

        return $this->fileManagementAppService->moveFile($requestContext, (int) $id, (int) $requestDTO->getTargetParentId(), (int) $requestDTO->getPreFileId());
    }

    public function batchMoveFile(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Get request data and create DTO
        $requestDTO = BatchMoveFileRequestDTO::fromRequest($this->request);

        // Call application service
        return $this->fileManagementAppService->batchMoveFile($requestContext, $requestDTO);
    }

    /**
     * Create batch download task.
     *
     * @param RequestContext $requestContext Request context
     * @return array Create result
     */
    #[RateLimit(create: 3, capacity: 3, key: 'batch_download_create')]
    public function createBatchDownload(RequestContext $requestContext): array
    {
        // Set user authorization info
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Get request data and create DTO
        $requestData = $this->request->all();
        $requestDTO = CreateBatchDownloadRequestDTO::fromRequest($requestData);

        // Call application service
        $responseDTO = $this->fileBatchAppService->createBatchDownload($requestContext, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * Check batch download status.
     *
     * @param RequestContext $requestContext Request context
     * @return array Query result
     */
    #[RateLimit(create: 30, capacity: 30, key: 'batch_download_check')]
    public function checkBatchDownload(RequestContext $requestContext): array
    {
        // Set user authorization info
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Get batch key from request
        $batchKey = (string) $this->request->input('batch_key', '');
        if (empty($batchKey)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'batch_key_required');
        }

        // Call application service
        $responseDTO = $this->fileBatchAppService->checkBatchDownload($requestContext, $batchKey);

        return $responseDTO->toArray();
    }

    /**
     * Check batch operation status.
     *
     * @param RequestContext $requestContext Request context
     * @return array Query result
     */
    #[RateLimit(create: 30, capacity: 30, key: 'batch_operation_check')]
    public function checkBatchOperationStatus(RequestContext $requestContext): array
    {
        // Set user authorization info
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Get request data and create DTO
        $requestDTO = CheckBatchOperationStatusRequestDTO::fromRequest($this->request);

        // Call application service
        $responseDTO = $this->fileManagementAppService->checkBatchOperationStatus($requestContext, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * 获取项目文件上传STS Token.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 获取结果
     */
    public function getProjectUploadToken(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求数据并创建DTO
        $requestData = $this->request->all();
        $requestDTO = ProjectUploadTokenRequestDTO::fromRequest($requestData);

        // 调用应用服务
        return $this->fileManagementAppService->getProjectUploadToken($requestContext, $requestDTO);
    }

    /**
     * 获取话题文件上传STS Token.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 获取结果
     */
    public function getTopicUploadToken(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求数据并创建DTO
        $requestData = $this->request->all();
        $requestDTO = TopicUploadTokenRequestDTO::fromRequest($requestData);

        // 调用应用服务
        return $this->fileManagementAppService->getTopicUploadToken($requestContext, $requestDTO);
    }

    /**
     * 创建文件或文件夹.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 创建结果
     */
    public function createFile(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求数据并创建DTO
        $requestDTO = CreateFileRequestDTO::fromRequest($this->request);

        // 调用应用服务
        return $this->fileManagementAppService->createFile($requestContext, $requestDTO);
    }

    /**
     * 保存项目文件.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 保存结果
     */
    public function saveProjectFile(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求数据并创建DTO
        $requestData = $this->request->all();
        $requestDTO = SaveProjectFileRequestDTO::fromRequest($requestData);

        // 调用应用服务
        return $this->fileManagementAppService->saveFile($requestContext, $requestDTO);
    }

    /**
     * 批量保存项目文件.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 批量保存结果，返回文件ID数组
     */
    public function batchSaveProjectFiles(RequestContext $requestContext): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求数据并创建DTO
        $requestDTO = BatchSaveProjectFilesRequestDTO::fromRequest($this->request);

        // 调用应用服务
        return $this->fileManagementAppService->batchSaveFiles($requestContext, $requestDTO);
    }

    /**
     * Handle sandbox file notification.
     * This endpoint doesn't require user authentication, uses token-based auth instead.
     *
     * @param RequestContext $requestContext Request context
     * @return array Response data
     */
    public function handleSandboxNotification(RequestContext $requestContext): array
    {
        // Create DTO from request
        $requestDTO = SandboxFileNotificationRequestDTO::fromRequest($this->request);

        // Call application service without user context
        return $this->sandboxFileNotificationAppService->handleNotificationWithoutAuth($requestDTO);
    }

    /**
     * Get file name by file ID.
     *
     * @param int $id File ID
     * @return array File name response
     */
    public function getFileByName(int $id): array
    {
        // Call app service to get file name
        return $this->fileProcessAppService->getFileNameById($id);
    }

    /**
     * Get file basic information by file ID.
     *
     * @param int $id File ID
     * @return array File basic information response (file name, current version, organization code)
     */
    public function getFileInfo(int $id): array
    {
        // Call app service to get file basic information
        return $this->fileProcessAppService->getFileInfoById($id);
    }

    /**
     * 获取文件版本列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 文件ID
     * @return array 文件版本列表
     */
    public function getFileVersions(RequestContext $requestContext, string $id): array
    {
        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 获取请求数据并创建DTO
        $requestDTO = GetFileVersionsRequestDTO::fromRequest($this->request);
        $requestDTO->setFileId((int) $id); // 从路由参数设置文件ID

        // 调用应用服务
        $responseDTO = $this->fileVersionAppService->getFileVersions($requestContext, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * 文件回滚到指定版本.
     *
     * @param RequestContext $requestContext 请求上下文
     * @param string $id 文件ID
     * @return array 回滚结果
     */
    public function rollbackFileToVersion(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());

        $requestDTO = RollbackFileToVersionRequestDTO::fromRequest($this->request);
        $requestDTO->setFileId((int) $id);

        $responseDTO = $this->fileVersionAppService->rollbackFileToVersion($requestContext, $requestDTO);

        return $responseDTO->toArray();
    }

    /**
     * 获取文件URL列表.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 文件URL列表
     * @throws BusinessException 如果参数无效则抛出异常
     */
    public function getFileUrls(RequestContext $requestContext): array
    {
        // 获取请求DTO
        $dto = GetFileUrlsRequestDTO::fromRequest($this->request);

        if (! empty($dto->getToken())) {
            // 走令牌校验逻辑
            return $this->fileManagementAppService->getFileUrlsByAccessToken(
                $dto->getFileIds(),
                $dto->getToken(),
                $dto->getDownloadMode(),
                $dto->getFileVersions()
            );
        }

        // 设置用户授权信息
        $requestContext->setUserAuthorization(di(AuthManager::class)->guard(name: 'web')->user());

        // 构建options参数
        $options = [];
        $options['cache'] = false;

        // 调用应用服务
        return $this->fileManagementAppService->getFileUrls(
            $requestContext,
            $dto->getProjectId(),
            $dto->getFileIds(),
            $dto->getDownloadMode(),
            $options,
            $dto->getFileVersions()  // 新增：直接作为方法参数传递
        );
    }

    /**
     * Replace file with new file.
     *
     * @param RequestContext $requestContext Request context
     * @return array Replaced file information
     */
    public function replaceFile(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $fileId = (int) $this->request->route('id');
        $requestDTO = ReplaceFileRequestDTO::fromRequest($this->request);
        return $this->fileManagementAppService->replaceFile($requestContext, $fileId, $requestDTO);
    }
}
