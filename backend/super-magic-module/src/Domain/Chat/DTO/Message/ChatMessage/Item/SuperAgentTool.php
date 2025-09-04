<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Chat\DTO\Message\ChatMessage\Item;

use App\Domain\Chat\Entity\AbstractEntity;

/**
 * 工具实体类.
 */
class SuperAgentTool extends AbstractEntity
{
    /**
     * 工具ID.
     */
    protected ?string $id = null;

    /**
     * 工具名称.
     */
    protected ?string $name = null;

    /**
     * 工具动作.
     */
    protected ?string $action = null;

    /**
     * 工具状态.
     */
    protected ?string $status = null;

    /**
     * 工具备注.
     */
    protected ?string $remark = null;

    /**
     * 工具详情.
     */
    protected ?array $detail = null;

    /**
     * 工具附件.
     */
    protected ?array $attachments = null;

    public function __construct(array $tool)
    {
        parent::__construct($tool);
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(?string $id): void
    {
        $this->id = $id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name;
    }

    public function getAction(): ?string
    {
        return $this->action;
    }

    public function setAction(?string $action): void
    {
        $this->action = $action;
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function setStatus(?string $status): void
    {
        $this->status = $status;
    }

    public function getRemark(): ?string
    {
        return $this->remark;
    }

    public function setRemark(?string $remark): void
    {
        $this->remark = $remark;
    }

    public function getDetail(): ?array
    {
        return $this->detail;
    }

    public function setDetail(?array $detail): void
    {
        $this->detail = $detail;
    }

    public function getAttachments(): ?array
    {
        return $this->attachments;
    }

    public function setAttachments(?array $attachments): void
    {
        $this->attachments = $attachments;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'action' => $this->action,
            'status' => $this->status,
            'remark' => $this->remark,
            'detail' => $this->detail,
            'attachments' => $this->attachments,
        ];
    }
}
