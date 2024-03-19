<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Facade;

use App\Application\Chat\Service\MagicEnvironmentAppService;
use App\Application\Kernel\SuperPermissionEnum;
use App\Domain\OrganizationEnvironment\Entity\MagicEnvironmentEntity;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Auth\PermissionChecker;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 处理与天书的组织架构同步.
 */
#[ApiResponse('low_code')]
class MagicEnvironmentApi extends AbstractApi
{
    public function __construct(
        private readonly MagicEnvironmentAppService $magicEnvironmentAppService,
    ) {
    }

    public function getMagicEnvironments(RequestInterface $request): array
    {
        $ids = $request->input('ids', []);
        $this->authCheck();
        return $this->magicEnvironmentAppService->getMagicEnvironments($ids);
    }

    public function createMagicEnvironment(RequestInterface $request): array
    {
        $data = $request->all();
        $this->authCheck();
        $magicEnvironmentEntity = new MagicEnvironmentEntity($data);
        $this->magicEnvironmentAppService->createMagicEnvironment($magicEnvironmentEntity);
        return $magicEnvironmentEntity->toArray();
    }

    public function updateMagicEnvironment(RequestInterface $request): array
    {
        $data = $request->all();
        $this->authCheck();
        $magicEnvironmentEntity = new MagicEnvironmentEntity($data);
        $this->magicEnvironmentAppService->updateMagicEnvironment($magicEnvironmentEntity);
        return $magicEnvironmentEntity->toArray();
    }

    private function authCheck(): void
    {
        $authorization = $this->getAuthorization();
        if (! PermissionChecker::mobileHasPermission($authorization->getMobile(), SuperPermissionEnum::MAGIC_ENV_MANAGEMENT)) {
            ExceptionBuilder::throw(ChatErrorCode::OPERATION_FAILED);
        }
    }
}
