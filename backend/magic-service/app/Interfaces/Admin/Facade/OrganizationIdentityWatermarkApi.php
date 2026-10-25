<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\Service\IdentityWatermarkAppService;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Admin\Request\IdentityWatermarkUpdateRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class OrganizationIdentityWatermarkApi extends AbstractApi
{
    public function __construct(
        RequestInterface $request,
        protected readonly IdentityWatermarkAppService $identityWatermarkAppService,
    ) {
        parent::__construct($request);
    }

    #[CheckPermission([MagicResourceEnum::ADMIN_SETTING_IDENTITY_WATERMARK], MagicOperationEnum::EDIT)]
    public function show(): array
    {
        $authorization = $this->getAuthorization();
        return $this->toResponse(
            $this->identityWatermarkAppService->getWatermark($authorization->getOrganizationCode())
        );
    }

    #[CheckPermission([MagicResourceEnum::ADMIN_SETTING_IDENTITY_WATERMARK], MagicOperationEnum::EDIT)]
    public function update(IdentityWatermarkUpdateRequest $request): array
    {
        $authorization = $this->getAuthorization();
        $organizationCode = $authorization->getOrganizationCode();
        $this->identityWatermarkAppService->saveOrganization(
            $organizationCode,
            $request->validated(),
            $authorization->getId(),
        );

        return $this->toResponse($this->identityWatermarkAppService->getWatermark($organizationCode));
    }

    /**
     * @param array{enabled: bool, fields: string[], depth: string} $watermark
     * @return array{watermark: array{enabled: bool, fields: string[], depth: string}}
     */
    private function toResponse(array $watermark): array
    {
        return [
            'watermark' => $watermark,
        ];
    }
}
