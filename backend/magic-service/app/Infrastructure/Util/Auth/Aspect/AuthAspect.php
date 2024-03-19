<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Auth\Aspect;

use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Auth\Annotation\Auth;
use Hyperf\Di\Annotation\Aspect;
use Hyperf\Di\Annotation\Inject;
use Hyperf\Di\Aop\AbstractAspect;
use Hyperf\Di\Aop\ProceedingJoinPoint;
use Qbhy\HyperfAuth\Authenticatable;
use Qbhy\HyperfAuth\AuthManager;

#[Aspect]
class AuthAspect extends AbstractAspect
{
    public array $annotations = [
        Auth::class,
    ];

    #[Inject(AuthManager::class)]
    protected AuthManager $auth;

    public function process(ProceedingJoinPoint $proceedingJoinPoint)
    {
        $annotation = $proceedingJoinPoint->getAnnotationMetadata();

        /** @var Auth $authAnnotation */
        $authAnnotation = $annotation->class[Auth::class] ?? $annotation->method[Auth::class];

        $guard = $this->auth->guard($authAnnotation->name);

        if (! $guard->user() instanceof Authenticatable) {
            ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
        }

        return $proceedingJoinPoint->process();
    }
}
