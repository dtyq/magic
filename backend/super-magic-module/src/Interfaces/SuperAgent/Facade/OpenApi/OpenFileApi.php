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
