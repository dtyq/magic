<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception;

use App\Infrastructure\Core\Traits\HasLogger;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Aspect;
use Hyperf\Di\Aop\AbstractAspect;
use Hyperf\Di\Aop\ProceedingJoinPoint;
use Hyperf\Di\Exception\Exception;
use Throwable;

#[Aspect]
/**
 * 1.为了不让用户看到一些sql/代码异常,因此会在 config/api-response.php 的 error_exception 配置中,将意外的异常转换为统一的系统内部错误异常.
 * 2.log记录异常信息,便于排查问题.
 */
class ApiResponseExceptionLogAspect extends AbstractAspect
{
    use HasLogger;

    // 优先级,值越小优先级越高
    public ?int $priority = 1;

    public array $annotations = [
        ApiResponse::class,
    ];

    /**
     * @throws Exception
     * @throws Throwable
     */
    public function process(ProceedingJoinPoint $proceedingJoinPoint)
    {
        try {
            return $proceedingJoinPoint->process();
        } catch (Throwable $exception) {
            // 只对 public 方法打印异常日志。
            // 说明：ProceedingJoinPoint::getReflectMethod() 底层使用 ReflectionManager::reflectMethod()
            // 会对 ReflectionMethod 做静态缓存（按 Class::method 维度），避免频繁反射。
            try {
                $isPublicMethod = $proceedingJoinPoint->getReflectMethod()->isPublic();
            } catch (Throwable) {
                // 无法判定可见性时，保守起见不打印，避免内部方法/嵌套调用造成重复日志。
                $isPublicMethod = false;
            }

            if ($isPublicMethod) {
                $this->logger->error(
                    __CLASS__ . ' 发生异常 message:{message}, code:{code}, file:{file}, line:{line}, trace:{trace}',
                    [
                        'message' => $exception->getMessage(),
                        'code' => $exception->getCode(),
                        'file' => $exception->getFile(),
                        'line' => $exception->getLine(),
                        'trace' => $exception->getTraceAsString(),
                    ]
                );
            }
            throw $exception;
        }
    }
}
