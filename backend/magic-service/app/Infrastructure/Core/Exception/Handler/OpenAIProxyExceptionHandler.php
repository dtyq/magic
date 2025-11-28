<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception\Handler;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\EventException;
use App\Infrastructure\Util\Context\CoContext;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Hyperf\Odin\Exception\InvalidArgumentException;
use Hyperf\Odin\Exception\LLMException\Api\LLMInvalidRequestException;
use Hyperf\Odin\Exception\LLMException\LLMConfigurationException;
use Hyperf\Odin\Exception\LLMException\LLMModelException;
use Hyperf\Odin\Exception\LLMException\LLMNetworkException;
use Hyperf\Odin\Exception\OdinException;
use Hyperf\Odin\Exception\ToolParameterValidationException;
use Psr\Http\Message\ResponseInterface;
use Throwable;

use function Hyperf\Config\config;

class OpenAIProxyExceptionHandler extends AbstractExceptionHandler
{
    public function handle(Throwable $throwable, ResponseInterface $response): ResponseInterface
    {
        $this->stopPropagation();

        $statusCode = 500;
        $errorCode = 500;
        $errorMessage = 'Service temporarily unavailable. Please try again later or contact us';
        $appHost = config('app_host', '');
        $supportUrl = str_contains($appHost, '.cn') ? 'https://www.letsmagic.cn' : 'https://www.letsmagic.ai';

        $previous = $throwable->getPrevious();
        if ($previous instanceof OdinException) {
            if ($previous instanceof LLMNetworkException) {
                // Network errors: service busy, suggest retry
                $statusCode = 503;
                $errorCode = $previous->getErrorCode();
                $errorMessage = 'Service is busy, please try again later or contact us';
            } elseif ($previous instanceof LLMConfigurationException) {
                $errorMessage = 'Service error, please contact us';
            } elseif ($this->isAllowedOdinException($previous)) {
                // Allowed exceptions: expose original error message
                $statusCode = $previous->getStatusCode();
                $errorCode = $previous->getErrorCode();
                $errorMessage = $previous->getMessage();
            }
        // Other OdinException will use default error message (already set above)
        } elseif ($previous instanceof BusinessException || $previous instanceof EventException) {
            $statusCode = 400;
            $errorCode = $previous->getCode();
            $errorMessage = $previous->getMessage();
        } elseif ($throwable instanceof BusinessException) {
            $statusCode = 400;
            $errorCode = $throwable->getCode();
            $errorMessage = $throwable->getMessage();
        }

        $errorMessage = preg_replace('/https?:\/\/[^\s]+/', '', $errorMessage);

        $errorResponse = [
            'error' => [
                'message' => $errorMessage,
                'code' => $errorCode,
                'request_id' => CoContext::getRequestId(),
                'support_url' => $supportUrl,
            ],
        ];

        return $response->withStatus($statusCode)
            ->withHeader('Content-Type', 'application/json')
            ->withBody(new SwooleStream(json_encode($errorResponse, JSON_UNESCAPED_UNICODE)));
    }

    public function isValid(Throwable $throwable): bool
    {
        if (! $throwable instanceof BusinessException) {
            return false;
        }

        $magicApiErrorCode = MagicApiErrorCode::tryFrom($throwable->getCode());
        if (! $magicApiErrorCode) {
            return false;
        }

        return true;
    }

    private function isAllowedOdinException(OdinException $exception): bool
    {
        $allowedExceptions = [
            LLMModelException::class,
            InvalidArgumentException::class,
            ToolParameterValidationException::class,
            LLMInvalidRequestException::class,
        ];

        return array_any($allowedExceptions, fn ($allowedException) => $exception instanceof $allowedException);
    }
}
