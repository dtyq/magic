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
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileProcessAppService;
use Dtyq\SuperMagic\Application\SuperAgent\Service\WorkspaceAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\RefreshStsTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveFileContentRequestDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class FileApi extends AbstractApi
{
    public function __construct(
        private readonly FileProcessAppService $fileProcessAppService,
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

    /**
     * 保存文件内容.
     *
     * @param RequestContext $requestContext 请求上下文
     * @return array 保存结果
     */
    public function saveFileContent(RequestContext $requestContext): array
    {
        // 获取请求参数
        $fileId = (int) $this->request->input('file_id', 0);
        $content = $this->request->input('content', '');

        // 参数验证
        if ($fileId <= 0) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file.file_id_required');
        }

        if (empty($content)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'file.content_required');
        }

        // 创建DTO
        $saveFileContentDTO = new SaveFileContentRequestDTO($fileId, $content);
        $saveFileContentDTO->validate();

        // 设置用户授权信息
        $requestContext->setUserAuthorization($this->getAuthorization());
        $userAuthorization = $requestContext->getUserAuthorization();

        return $this->fileProcessAppService->saveFileContent($saveFileContentDTO, $userAuthorization);
    }
}
