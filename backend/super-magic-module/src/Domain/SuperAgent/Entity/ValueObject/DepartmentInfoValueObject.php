<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 部门信息值对象.
 */
class DepartmentInfoValueObject
{
    /**
     * 构造函数.
     *
     * @param string $id 部门ID
     * @param string $name 部门名称
     * @param string $path 部门路径
     */
    public function __construct(
        private string $id = '',
        private string $name = '',
        private string $path = ''
    ) {
    }

    /**
     * 从数组创建部门信息对象.
     *
     * @param array $data 部门信息数组
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['id'] ?? '',
            $data['name'] ?? '',
            $data['path'] ?? ''
        );
    }

    /**
     * 转换为数组.
     *
     * @return array 部门信息数组
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'path' => $this->path,
        ];
    }

    // Getters
    public function getId(): string
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getPath(): string
    {
        return $this->path;
    }

    // Withers for immutability
    public function withId(string $id): self
    {
        $clone = clone $this;
        $clone->id = $id;
        return $clone;
    }

    public function withName(string $name): self
    {
        $clone = clone $this;
        $clone->name = $name;
        return $clone;
    }

    public function withPath(string $path): self
    {
        $clone = clone $this;
        $clone->path = $path;
        return $clone;
    }

    /**
     * 检查部门信息是否为空.
     */
    public function isEmpty(): bool
    {
        return empty($this->id) && empty($this->name) && empty($this->path);
    }

    /**
     * 检查部门信息是否有效.
     */
    public function isValid(): bool
    {
        return ! empty($this->id) && ! empty($this->name);
    }
}
