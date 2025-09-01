<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;

interface TopicRepositoryInterface
{
    /**
     * 通过ID获取话题.
     */
    public function getTopicById(int $id): ?TopicEntity;

    /**
     * 批量获取话题.
     * @return TopicEntity[]
     */
    public function getTopicsByIds(array $ids): array;

    public function getTopicWithDeleted(int $id): ?TopicEntity;

    public function getTopicBySandboxId(string $sandboxId): ?TopicEntity;

    /**
     * 根据条件获取话题列表.
     * 支持过滤、分页和排序.
     *
     * @param array $conditions 查询条件，如 ['workspace_id' => 1, 'user_id' => 'xxx']
     * @param bool $needPagination 是否需要分页
     * @param int $pageSize 分页大小
     * @param int $page 页码
     * @param string $orderBy 排序字段
     * @param string $orderDirection 排序方向，asc 或 desc
     * @return array{list: TopicEntity[], total: int} 话题列表和总数
     */
    public function getTopicsByConditions(
        array $conditions = [],
        bool $needPagination = true,
        int $pageSize = 10,
        int $page = 1,
        string $orderBy = 'id',
        string $orderDirection = 'desc'
    ): array;

    /**
     * 创建话题.
     */
    public function createTopic(TopicEntity $topicEntity): TopicEntity;

    /**
     * 更新话题.
     */
    public function updateTopic(TopicEntity $topicEntity): bool;

    /**
     * 使用updated_at 作为乐观锁更新话题.
     */
    public function updateTopicWithUpdatedAt(TopicEntity $topicEntity, string $updatedAt): bool;

    public function updateTopicByCondition(array $condition, array $data): bool;

    /**
     * 删除话题.
     */
    public function deleteTopic(int $id): bool;

    /**
     * 通过话题ID集合获取工作区信息.
     *
     * @param array $topicIds 话题ID集合
     * @return array 以话题ID为键，工作区信息为值的关联数组
     */
    public function getWorkspaceInfoByTopicIds(array $topicIds): array;

    /**
     * 获取话题状态统计数据.
     *
     * @param array $conditions 统计条件，如 ['user_id' => '123', 'organization_code' => 'abc']
     * @return array 包含各状态数量的数组
     */
    public function getTopicStatusMetrics(array $conditions = []): array;

    public function updateTopicStatus(int $id, $taskId, TaskStatus $status): bool;

    public function updateTopicStatusAndSandboxId(int $id, $taskId, TaskStatus $status, string $sandboxId): bool;

    /**
     * 获取最近更新时间超过指定时间的话题列表.
     *
     * @param string $timeThreshold 时间阈值，如果话题的更新时间早于此时间，则会被包含在结果中
     * @param int $limit 返回结果的最大数量
     * @return array<TopicEntity> 话题实体列表
     */
    public function getTopicsExceedingUpdateTime(string $timeThreshold, int $limit = 100): array;

    /**
     * 根据项目ID获取话题列表.
     */
    public function getTopicsByProjectId(int $projectId, string $userId): array;

    public function updateTopicStatusBySandboxIds(array $sandboxIds, string $status);

    /**
     * 统计项目下的话题数量.
     */
    public function countTopicsByProjectId(int $projectId): int;

    public function getRunningWorkspaceIds(array $workspaceIds): array;

    public function getRunningProjectIds(array $projectIds): array;

    // ======================= 消息回滚相关方法 =======================

    /**
     * 根据序列ID获取magic_message_id.
     */
    public function getMagicMessageIdBySeqId(string $seqId): ?string;

    /**
     * 根据magic_message_id获取所有相关的seq_id（所有视角）.
     */
    public function getAllSeqIdsByMagicMessageId(string $magicMessageId): array;

    /**
     * 根据基础seq_ids获取当前话题当前消息以及这条消息后面的所有消息.
     * @param array $baseSeqIds 基础seq_ids
     * @return array 所有相关的seq_ids
     */
    public function getAllSeqIdsFromCurrent(array $baseSeqIds): array;

    /**
     * 删除topic_messages数据.
     */
    public function deleteTopicMessages(array $seqIds): int;

    /**
     * 根据seq_ids删除messages和sequences数据.
     */
    public function deleteMessagesAndSequencesBySeqIds(array $seqIds): bool;

    /**
     * 根据im_seq_id删除magic_super_agent_message表中对应话题的后续消息.
     *
     * 删除逻辑：
     * 1. 根据im_seq_id查询magic_super_agent_message表，获取对应的主键id和topic_id
     * 2. 删除当前话题中id >= 查询到的主键id的所有数据
     *
     * @param int $seqId IM消息的序列ID
     * @return int 删除的记录数
     */
    public function deleteSuperAgentMessagesFromSeqId(int $seqId): int;

    /**
     * 批量更新magic_chat_sequences表的status字段.
     *
     * @param array $seqIds 需要更新的序列ID数组
     * @param MagicMessageStatus $status 目标状态
     * @return bool 更新是否成功
     */
    public function batchUpdateSeqStatus(array $seqIds, MagicMessageStatus $status): bool;

    /**
     * 根据基础seq_ids获取当前话题中小于指定seq_id的所有消息.
     *
     * @param array $baseSeqIds 基础seq_ids
     * @return array 小于指定seq_id的所有消息列表
     */
    public function getAllSeqIdsBeforeCurrent(array $baseSeqIds): array;

    /**
     * 根据话题ID获取所有撤回状态的消息seq_ids.
     *
     * @param int $topicId 话题ID
     * @param string $userId 用户ID（权限验证）
     * @return array 撤回状态的消息seq_ids
     */
    public function getRevokedSeqIdsByTopicId(int $topicId, string $userId): array;
}
