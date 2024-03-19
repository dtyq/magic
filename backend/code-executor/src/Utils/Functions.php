<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */

namespace Dtyq\CodeExecutor\Utils;

use Dtyq\CodeExecutor\Enums\StatusCode;
use Dtyq\CodeExecutor\Exception\ExecuteException;
use Dtyq\CodeExecutor\Exception\ExecuteFailedException;
use Dtyq\CodeExecutor\Exception\ExecuteTimeoutException;
use Dtyq\CodeExecutor\Exception\InvalidArgumentException;
use Dtyq\CodeExecutor\ExecutionResult;
use Hyperf\Codec\Json;

/**
 * 移除PHP代码中的开头和结尾标签。
 * 仅处理字符串开头和结尾的标签，不影响代码中间的内容。
 *
 * @param string $code PHP代码
 * @return string 去除标签后的代码
 */
function stripPHPTags(string $code): string
{
    // 去除开头的PHP标签
    $code = preg_replace('/^\s*<\?(php)?/i', '', $code);

    // 去除结尾的PHP标签
    return preg_replace('/\?>\s*$/', '', $code);
}

/**
 * @throws ExecuteException
 * @throws InvalidArgumentException
 * @throws ExecuteTimeoutException
 * @throws ExecuteFailedException
 */
function parseExecutionResult(string $response): ExecutionResult
{
    if (empty($contents = Json::decode($response))) {
        throw new ExecuteFailedException('Failed to decode the result of the function call: ' . $response);
    }

    $code = StatusCode::tryFrom($contents['code'] ?? '');
    if (empty($code) || $code !== StatusCode::OK) {
        if (empty($message = $contents['message'] ?? null)) {
            // try to get aliyun error message
            $message = $contents['errorMessage'] ?? Json::encode($contents);
        }
        match ($code) {
            StatusCode::INVALID_PARAMS => throw new InvalidArgumentException($message),
            StatusCode::EXECUTE_FAILED => throw new ExecuteFailedException($message),
            StatusCode::EXECUTE_TIMEOUT => throw new ExecuteTimeoutException($message),
            default => throw new ExecuteException($message),
        };
    }

    return new ExecutionResult(
        output: strval($contents['data']['output'] ?? ''),
        duration: intval($contents['data']['duration'] ?? 0),
        result: (array) ($contents['data']['result'] ?? [])
    );
}
