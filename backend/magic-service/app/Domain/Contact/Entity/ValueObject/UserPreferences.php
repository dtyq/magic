<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Entity\ValueObject;

use JsonSerializable;

/**
 * 用户偏好设置值对象.
 */
class UserPreferences implements JsonSerializable
{
    /**
     * 始终显示追问建议.
     * 在 Agent 回复底部展示追问建议，便于继续提问。仅对当前设备生效。
     */
    private bool $showFollowUpSuggestions = true;

    /**
     * 保留使用过的追问建议.
     * 开启后，点击过的追问建议仍保留在列表中，方便再次点击；关闭则点击后自动隐藏。
     */
    private bool $keepUsedFollowUpSuggestions = false;

    public function __construct(array $data = [])
    {
        if (isset($data['show_follow_up_suggestions'])) {
            $this->showFollowUpSuggestions = (bool) $data['show_follow_up_suggestions'];
        }
        if (isset($data['keep_used_follow_up_suggestions'])) {
            $this->keepUsedFollowUpSuggestions = (bool) $data['keep_used_follow_up_suggestions'];
        }
    }

    public static function fromArray(array $data): self
    {
        return new self($data);
    }

    public function isShowFollowUpSuggestions(): bool
    {
        return $this->showFollowUpSuggestions;
    }

    public function setShowFollowUpSuggestions(bool $showFollowUpSuggestions): void
    {
        $this->showFollowUpSuggestions = $showFollowUpSuggestions;
    }

    public function isKeepUsedFollowUpSuggestions(): bool
    {
        return $this->keepUsedFollowUpSuggestions;
    }

    public function setKeepUsedFollowUpSuggestions(bool $keepUsedFollowUpSuggestions): void
    {
        $this->keepUsedFollowUpSuggestions = $keepUsedFollowUpSuggestions;
    }

    public function toArray(): array
    {
        return [
            'show_follow_up_suggestions' => $this->showFollowUpSuggestions,
            'keep_used_follow_up_suggestions' => $this->keepUsedFollowUpSuggestions,
        ];
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
