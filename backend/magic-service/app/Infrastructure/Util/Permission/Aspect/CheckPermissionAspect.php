<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Permission\Aspect;

use App\Application\Permission\Service\RoleAppService;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Hyperf\Di\Annotation\Aspect;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Di\Aop\AbstractAspect;
use Hyperf\Di\Aop\ProceedingJoinPoint;

#[Aspect]
class CheckPermissionAspect extends AbstractAspect
{
    /**
     * 需要拦截的注解列表.
     */
    public array $annotations = [
        CheckPermission::class,
    ];

    #[Inject]
    protected RoleAppService $roleAppService;

    public function process(ProceedingJoinPoint $proceedingJoinPoint)
    {
        $annotationMetadata = $proceedingJoinPoint->getAnnotationMetadata();

        /** @var null|CheckPermission $permissionAnnotation */
        $permissionAnnotation = $annotationMetadata->method[CheckPermission::class] ?? $annotationMetadata->class[CheckPermission::class] ?? null;

        // 若无注解，直接放行
        if ($permissionAnnotation === null) {
            return $proceedingJoinPoint->process();
        }

        // 获取当前登录用户授权信息
        $authorization = RequestCoContext::getUserAuthorization();
        if ($authorization === null) {
            ExceptionBuilder::throw(PermissionErrorCode::AccessDenied, 'permission.error.access_denied');
        }

        // 构建权限键（支持多个，任一满足即通过）
        $permissionKeys = method_exists($permissionAnnotation, 'getPermissionKeys')
            ? $permissionAnnotation->getPermissionKeys()
            : [$permissionAnnotation->getPermissionKey()];

        // 构建数据隔离上下文
        $dataIsolation = PermissionDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId()
        );

        // 执行权限校验：任意一个权限键通过则放行
        $hasPermission = false;
        foreach ($permissionKeys as $permissionKey) {
            if ($this->roleAppService->hasPermission($dataIsolation, $authorization->getId(), $permissionKey)) {
                $hasPermission = true;
                break;
            }
        }

        if (! $hasPermission) {
            ExceptionBuilder::throw(PermissionErrorCode::AccessDenied, 'permission.error.access_denied');
        }

        return $proceedingJoinPoint->process();
    }
}
