<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\ApiResponse\Response;

abstract class AbstractResponse implements ResponseInterface
{
    protected int $successCode = 0;

    protected string $successMessage = 'ok';

    protected int $code;

    protected string $message;

    protected mixed $data;

    public function __toString()
    {
        return json_encode($this->body(), JSON_UNESCAPED_UNICODE);
    }

    public function success(mixed $data = null): static
    {
        $this->code = $this->successCode;
        $this->message = $this->successMessage;
        $this->setData($data);

        return $this;
    }

    public function error(int $code, string $message, mixed $data = null): static
    {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;

        return $this;
    }

    public function jsonSerialize(): array
    {
        return $this->body();
    }

    abstract public function body(): array;

    private function setData($data): void
    {
        $this->data = $data;
    }
}
