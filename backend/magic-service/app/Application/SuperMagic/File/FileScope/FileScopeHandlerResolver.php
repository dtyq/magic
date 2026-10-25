<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\File\FileScope;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * 文件作用域处理器解析器。
 */
final class FileScopeHandlerResolver
{
    /**
     * @var array<string, FileScopeHandlerInterface>
     */
    private array $handlerMap;

    /**
     * 初始化文件作用域与处理器的映射关系。
     */
    public function __construct(
        MemoryFileScopeHandler $memoryFileScopeHandler,
        UserFileScopeHandler $userFileScopeHandler,
    ) {
        $this->handlerMap = [
            MemoryFileScopeHandler::SCOPE => $memoryFileScopeHandler,
            UserFileScopeHandler::SCOPE => $userFileScopeHandler,
        ];
    }

    /**
     * 根据作用域获取对应的文件处理器。
     */
    public function resolve(string $scope): FileScopeHandlerInterface
    {
        if (! isset($this->handlerMap[$scope])) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                'invalid_scope',
                ['scope' => $scope],
            );
        }

        return $this->handlerMap[$scope];
    }
}
