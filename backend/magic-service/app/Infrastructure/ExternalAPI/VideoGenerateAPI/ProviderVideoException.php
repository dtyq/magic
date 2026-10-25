<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\ErrorCode\VideoGenerateErrorCode;
use GuzzleHttp\Exception\RequestException;
use RuntimeException;
use Throwable;

final class ProviderVideoException extends RuntimeException
{
    public function __construct(
        VideoGenerateErrorCode $code,
        string $message,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $code->value, $previous);
    }

    public function isRetry(): bool
    {
        $status = $this->getHttpStatus();
        return $status === null || $status < 400 || $status >= 500 || in_array($status, [408, 409, 429], true);
    }

    public function getHttpStatus(): ?int
    {
        return $this->getRequestException()?->getResponse()?->getStatusCode();
    }

    public function getRequestException(): ?RequestException
    {
        $previous = $this->getPrevious();
        return $previous instanceof RequestException ? $previous : null;
    }

    public function getResponseContent(): ?string
    {
        $response = $this->getRequestException()?->getResponse();
        if ($response === null) {
            return null;
        }

        $body = $response->getBody();
        if ($body->isSeekable()) {
            $body->rewind();
        }
        $content = (string) $body;
        if ($body->isSeekable()) {
            $body->rewind();
        }

        return $content;
    }

    public function getErrorCode(): string
    {
        return (string) $this->getCode();
    }

    public function getVideoErrorCode(): VideoGenerateErrorCode
    {
        return VideoGenerateErrorCode::from($this->getCode());
    }
}
