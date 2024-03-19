<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

class GetTopicMetricsRequestDTO
{
    /**
     * @var string 组织机构代码，可选
     */
    protected string $organizationCode = '';

    /**
     * 从请求构造DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->setOrganizationCode($request->input('organization_code', ''));
        return $dto;
    }

    /**
     * 获取组织机构代码
     */
    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    /**
     * 设置组织机构代码
     */
    public function setOrganizationCode(string $organizationCode): self
    {
        $this->organizationCode = $organizationCode;
        return $this;
    }
}
