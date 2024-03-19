<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Structure\Api\StandardIO;

use Dtyq\FlowExprEngine\Exception\FlowExprEngineException;
use Dtyq\FlowExprEngine\Kernel\Utils\Functions;
use Dtyq\FlowExprEngine\Structure\Api\ApiRequestBodyType;
use Throwable;

class Response
{
    private float $time;

    protected function __construct(
        private readonly int $code,
        private readonly string $body,
        private readonly array $header,
        private readonly bool $err = false,
        private readonly string $errMessage = ''
    ) {
        $this->time = microtime(true);
    }

    public static function makeFail(int $code, string $errMessage): self
    {
        return new self($code, '', [], true, $errMessage);
    }

    public static function makeSuccess(int $code, string $body, array $header): self
    {
        return new self($code, $body, $header);
    }

    public function getFormatTime(): string
    {
        return Functions::formatMicroTime($this->time);
    }

    public function getCode(): int
    {
        return $this->code;
    }

    public function getTime(): float
    {
        return $this->time;
    }

    public function getBody(): string
    {
        return $this->body;
    }

    public function getArrayBody(bool $strict = true): array
    {
        try {
            $apiRequestBodyType = ApiRequestBodyType::make($this->header['Content-Type'] ?? 'application/json', true);

            $result = [];
            match ($apiRequestBodyType) {
                ApiRequestBodyType::Json => $result = json_decode($this->body, true),
                ApiRequestBodyType::FormData, ApiRequestBodyType::XWwwFormUrlencoded => parse_str($this->body, $result),
                ApiRequestBodyType::None => $result,
            };
            return $result;
        } catch (Throwable $throwable) {
            if (! $strict) {
                return [];
            }
            throw new FlowExprEngineException('解析body失败 | ' . $this->body, $throwable->getCode(), $throwable);
        }
    }

    public function getHeader(): array
    {
        return $this->header;
    }

    public function isErr(): bool
    {
        return $this->err;
    }

    public function getErrMessage(): string
    {
        return $this->errMessage;
    }

    public function show(): array
    {
        return [
            'is_err' => $this->isErr(),
            'err_message' => $this->getErrMessage(),
            'code' => $this->getCode(),
            'body' => $this->getBody(),
            'headers' => $this->getHeader(),
            'time' => $this->getFormatTime(),
        ];
    }
}
