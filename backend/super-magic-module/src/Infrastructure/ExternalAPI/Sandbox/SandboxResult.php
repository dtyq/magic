<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox;

class SandboxResult
{
    public const NotFound = 4004;

    public const Normal = 1000;

    public const SandboxRunnig = 'running';

    public const SandboxExited = 'exited';

    public function __construct(
        private bool $success = false,
        private ?string $message = null,
        private ?int $code = 0,
        private ?SandboxData $data = null,
    ) {
        // 初始化空的 SandboxData 对象
        if ($this->data === null) {
            $this->data = new SandboxData();
        }
    }

    public function isSuccess(): bool
    {
        return $this->success;
    }

    public function setSuccess(bool $success): self
    {
        $this->success = $success;
        return $this;
    }

    /**
     * 获取沙箱ID.
     *
     * @return null|string 沙箱ID
     */
    public function getSandboxId(): ?string
    {
        $sandboxId = $this->data->getSandboxId();
        return empty($sandboxId) ? null : $sandboxId;
    }

    /**
     * 设置沙箱ID.
     *
     * @param null|string $sandboxId 沙箱ID
     */
    public function setSandboxId(?string $sandboxId): self
    {
        if ($sandboxId !== null) {
            $this->data->setSandboxId($sandboxId);
        }
        return $this;
    }

    public function getMessage(): ?string
    {
        return $this->message;
    }

    public function setMessage(?string $message): self
    {
        $this->message = $message;
        return $this;
    }

    public function getCode(): int
    {
        return $this->code;
    }

    public function setCode(int $code): self
    {
        $this->code = $code;
        return $this;
    }

    /**
     * 获取沙箱数据对象
     *
     * @return SandboxData 沙箱数据对象
     */
    public function getSandboxData(): SandboxData
    {
        return $this->data;
    }

    /**
     * 设置沙箱数据对象
     *
     * @param SandboxData $data 沙箱数据对象
     */
    public function setSandboxData(SandboxData $data): self
    {
        $this->data = $data;
        return $this;
    }
}
