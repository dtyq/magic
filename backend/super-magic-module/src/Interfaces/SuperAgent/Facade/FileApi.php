<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileBatchAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileProcessAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\BatchSaveFileContentRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateBatchDownloadRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\RefreshStsTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\WorkspaceAttachmentsRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\RateLimit\Annotation\RateLimit;

#[ApiResponse('low_code')]
class FileApi extends AbstractApi
{
    public function __construct(
        private readonly FileProcessAppService $fileProcessAppService,
        private readonly FileBatchAppService $fileBatchAppService,
        protected WorkspaceAppService $workspaceAppService,
        protected RequestInterface $request,
    ) {
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
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 批量保存结果
     */
    public function saveFileContent(RequestContext $requestContext): array
    {
        // 获取原始请求数据
        $requestData = $this->request->all();

        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        // 验证请求格式必须是数组
        if (! is_array($requestData) || empty($requestData)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'files_array_required');
        }

        // 创建批量保存DTO
        $batchSaveDTO = BatchSaveFileContentRequestDTO::fromRequest($requestData);
        return $this->fileProcessAppService->batchSaveFileContent($batchSaveDTO, $userAuthorization);
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
}
