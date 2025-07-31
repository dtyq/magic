<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\DTO;

use App\Infrastructure\Core\AbstractDTO;

class FileConvertProgressDTO extends AbstractDTO
{
    protected int $current = 0;

    protected int $total = 0;

    protected float $percentage = 0.0;

    protected string $message = '';

    public function __construct(mixed $data = null, ?int $total = null, ?float $percentage = null, ?string $message = null)
    {
        // 如果第一个参数是数组，则使用数组初始化
        if (is_array($data)) {
            parent::__construct($data);
            return;
        }

        // 向后兼容：如果传入的是单个参数，则按原有方式处理
        if ($data !== null) {
            $this->current = (int) $data;
        }
        if ($total !== null) {
            $this->total = $total;
        }
        if ($percentage !== null) {
            $this->percentage = $percentage;
        }
        if ($message !== null) {
            $this->message = $message;
        }
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['current'] ?? 0,
            $data['total'] ?? 0,
            $data['percentage'] ?? 0.0,
            $data['message'] ?? ''
        );
    }

    // ====== Getters ======

    public function getCurrent(): int
    {
        return $this->current;
    }

    public function getTotal(): int
    {
        return $this->total;
    }

    public function getPercentage(): float
    {
        return $this->percentage;
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    // ====== Setters ======

    public function setCurrent(int $current): self
    {
        $this->current = $current;
        return $this;
    }

    public function setTotal(int $total): self
    {
        $this->total = $total;
        return $this;
    }

    public function setPercentage(float $percentage): self
    {
        $this->percentage = $percentage;
        return $this;
    }

    public function setMessage(string $message): self
    {
        $this->message = $message;
        return $this;
    }
}
