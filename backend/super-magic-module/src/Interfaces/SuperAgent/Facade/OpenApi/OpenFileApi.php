<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\OpenApi;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\FileManagementAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\GetFileUrlsRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ProjectUploadTokenRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\SaveProjectFileRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\Facade\AbstractApi;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class OpenFileApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly FileManagementAppService $fileManagementAppService,
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

        return $this->fileManagementAppService->getProjectUploadToken($requestContext, $requestDTO);
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
