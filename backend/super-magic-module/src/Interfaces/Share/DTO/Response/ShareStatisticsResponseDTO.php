<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class ShareStatisticsResponseDTO extends AbstractDTO
{
    /**
     * 总访问次数.
     */
    public int $totalCount = 0;

    /**
     * 今日访问次数.
     */
    public int $todayCount = 0;

    /**
     * 团队成员访问人数.
     */
    public int $teamMemberCount = 0;

    /**
     * 匿名用户访问人数.
     */
    public int $anonymousCount = 0;

    /**
     * 复制次数（仅文件集和单文件类型）.
     */
    public ?int $copyCount = null;

    /**
     * 文件数量（仅文件集和单文件类型）.
     */
    public ?int $fileCount = null;

    /**
     * 访问日志列表.
     */
    public array $accessLogs = [];

    /**
     * 访问日志总数.
     */
    public int $accessLogsTotal = 0;

    /**
     * 设置总访问次数.
     */
    public function setTotalCount(int $totalCount): self
    {
        $this->totalCount = $totalCount;
        return $this;
    }

    /**
     * 设置今日访问次数.
     */
    public function setTodayCount(int $todayCount): self
    {
        $this->todayCount = $todayCount;
        return $this;
    }

    /**
     * 设置团队成员访问人数.
     */
    public function setTeamMemberCount(int $teamMemberCount): self
    {
        $this->teamMemberCount = $teamMemberCount;
        return $this;
    }

    /**
     * 设置匿名用户访问人数.
     */
    public function setAnonymousCount(int $anonymousCount): self
    {
        $this->anonymousCount = $anonymousCount;
        return $this;
    }

    /**
     * 设置复制次数.
     */
    public function setCopyCount(?int $copyCount): self
    {
        $this->copyCount = $copyCount;
        return $this;
    }

    /**
     * 设置文件数量.
     */
    public function setFileCount(?int $fileCount): self
    {
        $this->fileCount = $fileCount;
        return $this;
    }

    /**
     * 设置访问日志列表.
     */
    public function setAccessLogs(array $accessLogs): self
    {
        $this->accessLogs = $accessLogs;
        return $this;
    }

    /**
     * 设置访问日志总数.
     */
    public function setAccessLogsTotal(int $accessLogsTotal): self
    {
        $this->accessLogsTotal = $accessLogsTotal;
        return $this;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        $result = [
            'total_count' => $this->totalCount,
            'today_count' => $this->todayCount,
            'team_member_count' => $this->teamMemberCount,
            'anonymous_count' => $this->anonymousCount,
            'access_logs' => [
                'total' => $this->accessLogsTotal,
                'list' => $this->accessLogs,
            ],
        ];

        if ($this->copyCount !== null) {
            $result['copy_count'] = $this->copyCount;
        }

        if ($this->fileCount !== null) {
            $result['file_count'] = $this->fileCount;
        }

        return $result;
    }
}
