<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetShareDetailDTO extends AbstractDTO
{
    /**
     * 当前页码.
     */
    public int $page = 1;

    /**
     * 每页条数.
     */
    public int $pageSize = 10;

    /**
     * 密码.
     */
    public string $password = '';

    /**
     * 设置页码.
     */
    public function setPage(int $page): self
    {
        $this->page = $page;
        return $this;
    }

    /**
     * 获取页码.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * 设置每页条数.
     */
    public function setPageSize(int $pageSize): self
    {
        $this->pageSize = $pageSize;
        return $this;
    }

    /**
     * 获取每页条数.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPassword(string $password): self
    {
        $this->password = $password;
        return $this;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->page = (int) $request->input('page', 1);
        $dto->pageSize = (int) $request->input('page_size', 10);
        $dto->password = $request->input('pwd', '');
        return $dto;
    }

    /**
     * 构建验证规则.
     */
    public function rules(): array
    {
        return [
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:500',
            'password' => 'nullable|string',
        ];
    }

    /**
     * 获取验证错误消息.
     */
    public function messages(): array
    {
        return [
            'page.integer' => '页码必须是整数',
            'page.min' => '页码最小为1',
            'page_size.integer' => '每页条数必须是整数',
            'page_size.min' => '每页条数最小为1',
            'page_size.max' => '每页条数最大为100',
            'password.max' => '关键词最大长度为255个字符',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'page' => '页码',
            'page_size' => '每页条数',
            'password' => '搜索关键词',
        ];
    }
}
