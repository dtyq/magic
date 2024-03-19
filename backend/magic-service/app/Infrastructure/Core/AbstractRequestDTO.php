<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core;

use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\HttpServer\Router\Dispatched;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\ValidationException;

use function di;

abstract class AbstractRequestDTO extends AbstractDTO
{
    public static function fromRequest(RequestInterface $request): static
    {
        /* @phpstan-ignore-next-line */
        $dto = new static();
        // 参数校验
        $data = $request->all();
        // 这里要加上从路由上传递的参数, key需要转换为蛇形
        $rawParams = $request->getAttribute(Dispatched::class)->params;
        $paramsForSnakeKey = [];
        foreach ($rawParams as $key => $param) {
            $keyForSnake = $dto->getUnCamelizeValueFromCache($key);
            $paramsForSnakeKey[$keyForSnake] = $param;
        }

        $data = array_merge($data, $paramsForSnakeKey);
        static::checkParams($data);
        $dto->initProperty($data);
        return $dto;
    }

    protected static function checkParams(array $params): array
    {
        $rules = static::getHyperfValidationRules();
        $messages = static::getHyperfValidationMessage();
        $validator = di(ValidatorFactoryInterface::class)->make($params, $rules, $messages);
        if ($validator->fails()) {
            throw new ValidationException($validator);
        }
        $validator->validated();
        return $params;
    }

    abstract protected static function getHyperfValidationRules(): array;

    abstract protected static function getHyperfValidationMessage(): array;
}
