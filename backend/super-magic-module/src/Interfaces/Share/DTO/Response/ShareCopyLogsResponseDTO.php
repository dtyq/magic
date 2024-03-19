<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class ShareCopyLogsResponseDTO extends AbstractDTO
{
    /**
     * 总复制次数.
     */
    public int $totalCount = 0;

    /**
     * 今日复制次数.
     */
    public int $todayCount = 0;

    /**
     * 团队成员复制人数.
     */
    public int $teamMemberCount = 0;

    /**
     * 游客复制人数.
     */
    public int $guestCount = 0;

    /**
     * 复制日志列表.
     */
    public array $copyLogs = [];

    /**
     * 复制日志总数.
     */
    public int $copyLogsTotal = 0;

    /**
     * 设置总复制次数.
     */
    public function setTotalCount(int $totalCount): self
    {
        $this->totalCount = $totalCount;
        return $this;
    }

    /**
     * 设置今日复制次数.
     */
    public function setTodayCount(int $todayCount): self
    {
        $this->todayCount = $todayCount;
        return $this;
    }

    /**
     * 设置团队成员复制人数.
     */
    public function setTeamMemberCount(int $teamMemberCount): self
    {
        $this->teamMemberCount = $teamMemberCount;
        return $this;
    }

    /**
     * 设置游客复制人数.
     */
    public function setGuestCount(int $guestCount): self
    {
        $this->guestCount = $guestCount;
        return $this;
    }

    /**
     * 设置复制日志列表.
     */
    public function setCopyLogs(array $copyLogs): self
    {
        $this->copyLogs = $copyLogs;
        return $this;
    }

    /**
     * 设置复制日志总数.
     */
    public function setCopyLogsTotal(int $copyLogsTotal): self
    {
        $this->copyLogsTotal = $copyLogsTotal;
        return $this;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'total_count' => $this->totalCount,
            'today_count' => $this->todayCount,
            'team_member_count' => $this->teamMemberCount,
            'guest_count' => $this->guestCount,
            'copy_logs' => [
                'total' => $this->copyLogsTotal,
                'list' => $this->copyLogs,
            ],
        ];
    }
}
