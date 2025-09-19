<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

class SuperMagicAgentCategorizedListDTO
{
    /**
     * 常用智能体列表.
     * @var array<SuperMagicAgentListDTO>
     */
    public array $frequent = [];

    /**
     * 全部智能体列表（不包含常用中的）.
     * @var array<SuperMagicAgentListDTO>
     */
    public array $all = [];

    /**
     * 总数量.
     */
    public int $total = 0;

    public function __construct(array $data = [])
    {
        if (isset($data['frequent'])) {
            $this->setFrequent($data['frequent']);
        }
        if (isset($data['all'])) {
            $this->setAll($data['all']);
        }
        if (isset($data['total'])) {
            $this->setTotal($data['total']);
        }
    }

    /**
     * @param array<SuperMagicAgentListDTO> $frequent
     */
    public function setFrequent(array $frequent): self
    {
        $this->frequent = $frequent;
        return $this;
    }

    /**
     * @return array<SuperMagicAgentListDTO>
     */
    public function getFrequent(): array
    {
        return $this->frequent;
    }

    /**
     * @param array<SuperMagicAgentListDTO> $all
     */
    public function setAll(array $all): self
    {
        $this->all = $all;
        return $this;
    }

    /**
     * @return array<SuperMagicAgentListDTO>
     */
    public function getAll(): array
    {
        return $this->all;
    }

    public function setTotal(int $total): self
    {
        $this->total = $total;
        return $this;
    }

    public function getTotal(): int
    {
        return $this->total;
    }
}
