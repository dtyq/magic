<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Permission\Aspect;

use App\Application\Permission\Service\RoleAppService;
use App\Domain\Audit\Entity\ValueObject\RequestInfo;
use App\Domain\Audit\Entity\ValueObject\UserAuthorization;
use App\Domain\Audit\Event\AdminOperationLogEvent;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Http\RequestHelper;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Hyperf\Di\Annotation\Aspect;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Di\Aop\AbstractAspect;
use Hyperf\Di\Aop\ProceedingJoinPoint;
use Hyperf\HttpServer\Contract\RequestInterface;
use Psr\EventDispatcher\EventDispatcherInterface;
use Throwable;

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

    #[Inject]
    protected EventDispatcherInterface $eventDispatcher;

    #[Inject]
    protected RequestInterface $request;

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
        $matchedPermissionKey = null;
        foreach ($permissionKeys as $permissionKey) {
            if ($this->roleAppService->hasPermission($dataIsolation, $authorization->getId(), $permissionKey)) {
                $hasPermission = true;
                $matchedPermissionKey = $permissionKey;
                break;
            }
        }

        if (! $hasPermission) {
            ExceptionBuilder::throw(PermissionErrorCode::AccessDenied, 'permission.error.access_denied');
        }

        // 权限校验通过后，触发操作日志事件
        // 注意：事件通过本地事件分发器同步调用 Listener，但 Listener 内部有完整的异常保护
        // 此 try-catch 保护事件创建和分发操作，防止日志系统故障影响业务流程
        try {
            $className = $proceedingJoinPoint->className;
            $methodName = $proceedingJoinPoint->methodName;

            // 转换为Domain层值对象
            $userAuth = new UserAuthorization(
                id: $authorization->getId(),
                organizationCode: $authorization->getOrganizationCode(),
                realName: $authorization->getRealName(),
                nickname: $authorization->getNickname()
            );

            $requestInfo = new RequestInfo(
                ip: RequestHelper::getClientIp($this->request),
                userAgent: RequestHelper::getUserAgent($this->request),
                method: RequestHelper::getMethod($this->request),
                uri: RequestHelper::getUri($this->request),
                fullUrl: RequestHelper::getFullUrl($this->request),
                requestBody: RequestHelper::getRequestBody($this->request)
            );

            $event = new AdminOperationLogEvent(
                authorization: $userAuth,
                matchedPermissionKey: $matchedPermissionKey,
                requestInfo: $requestInfo,
                className: $className,
                methodName: $methodName
            );

            $this->eventDispatcher->dispatch($event);
        } catch (Throwable $e) {
            // 静默处理：事件创建或分发失败不影响业务
            // 可能的异常：对象创建失败、事件分发器异常等
        }

        return $proceedingJoinPoint->process();
    }
}
