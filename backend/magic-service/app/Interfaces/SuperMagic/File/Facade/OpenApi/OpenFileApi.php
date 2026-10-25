<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\Facade\OpenApi;

use App\Application\SuperMagic\File\Service\FileManagementAppService;
use App\Application\SuperMagic\File\Service\OpenFileAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\File\DTO\Request\GetFileUrlsRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\OpenBatchSaveProjectFilesRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\SaveProjectFileRequestDTO;
use App\Interfaces\SuperMagic\File\DTO\Request\UploadProjectFileRequestDTO;
use App\Interfaces\SuperMagic\Project\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Swow\Psr7\Message\UploadedFile;

#[ApiResponse('low_code')]
class OpenFileApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly FileManagementAppService $fileManagementAppService,
        private readonly OpenFileAppService $openFileAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * Get project file upload STS token.
     */
    public function getProjectUploadToken(RequestContext $requestContext): array
    {
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        $requestContext->setUserAuthorization($userAuthorization);

        $requestDTO = ProjectUploadTokenRequestDTO::fromRequest($this->request->all());

        return $this->openFileAppService->getProjectUploadToken($requestContext, $requestDTO);
    }

    public function uploadProjectFile(RequestContext $requestContext): array
    {
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }
        $requestContext->setUserAuthorization($userAuthorization);
        $requestDTO = UploadProjectFileRequestDTO::fromRequest($this->request);
        $file = $this->request->file('file');
        if (! $file instanceof UploadedFile) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'file.open_api.invalid_upload');
        }
        return $this->openFileAppService->uploadProjectFile($requestContext, $requestDTO, $file);
    }

    public function batchSaveProjectFiles(RequestContext $requestContext): array
    {
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }
        $requestContext->setUserAuthorization($userAuthorization);
        $requestDTO = OpenBatchSaveProjectFilesRequestDTO::fromRequest($this->request);
        return $this->openFileAppService->batchSaveProjectFiles($requestContext, $requestDTO);
    }

    /**
     * Get multiple file URLs for the authenticated open-api caller.
     */
    public function getFileUrls(RequestContext $requestContext): array
    {
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        $requestContext->setUserAuthorization($userAuthorization);

        $requestDTO = GetFileUrlsRequestDTO::fromRequest($this->request);

        if ($requestDTO->getToken() !== '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'token is not supported in open-api');
        }

        if ($requestDTO->getIsDownload()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'is_download is not supported in open-api');
        }

        $list = $this->fileManagementAppService->getFileUrls(
            $requestContext,
            $requestDTO->getFileIds(),
            $requestDTO->getDownloadMode(),
            ['cache' => $requestDTO->getCache()],
            $requestDTO->getFileVersions()
        );

        $returnedFileIds = array_map(static fn (array $item): int => (int) ($item['file_id'] ?? 0), $list);
        $missingFileIds = array_values(array_map('intval', array_diff($requestDTO->getFileIds(), $returnedFileIds)));

        return [
            'list' => $list,
            'missing_file_ids' => $missingFileIds,
            'partial_success' => ! empty($missingFileIds),
        ];
    }

    /**
     * Save project file relation.
     */
    public function saveProjectFile(RequestContext $requestContext): array
    {
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        $requestContext->setUserAuthorization($userAuthorization);

        $requestDTO = SaveProjectFileRequestDTO::fromRequest($this->request->all());

        return $this->fileManagementAppService->saveFile($requestContext, $requestDTO);
    }
}
