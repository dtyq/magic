<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

class BuiltinToolCategorizedListDTO
{
    /**
     * 按分类组织的工具列表.
     * @var array<string, array<BuiltinToolDTO>>
     */
    public array $categories = [];

    /**
     * 所有工具的平铺列表.
     * @var array<BuiltinToolDTO>
     */
    public array $tools = [];

    /**
     * 总数量.
     */
    public int $total = 0;

    public function __construct(array $data = [])
    {
        if (isset($data['categories'])) {
            $this->setCategories($data['categories']);
        }
        if (isset($data['tools'])) {
            $this->setTools($data['tools']);
        }
        if (isset($data['total'])) {
            $this->setTotal($data['total']);
        }
    }

    /**
     * @param array<string, array<BuiltinToolDTO>> $categories
     */
    public function setCategories(array $categories): self
    {
        $this->categories = $categories;
        return $this;
    }

    /**
     * @return array<string, array<BuiltinToolDTO>>
     */
    public function getCategories(): array
    {
        return $this->categories;
    }

    /**
     * @param array<BuiltinToolDTO> $tools
     */
    public function setTools(array $tools): self
    {
        $this->tools = $tools;
        return $this;
    }

    /**
     * @return array<BuiltinToolDTO>
     */
    public function getTools(): array
    {
        return $this->tools;
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
