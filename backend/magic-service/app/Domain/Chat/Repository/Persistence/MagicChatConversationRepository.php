<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\DTO\ConversationListQueryDTO;
use App\Domain\Chat\DTO\PageResponseDTO\ConversationsPageResponseDTO;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Repository\Facade\MagicChatConversationRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatConversationModel;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\ConversationAssembler;
use Hyperf\Codec\Exception\InvalidArgumentException;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;
use Hyperf\Redis\Redis;
use stdClass;

class MagicChatConversationRepository implements MagicChatConversationRepositoryInterface
{
    public function __construct(
        protected MagicChatConversationModel $magicChatConversationModel,
        private readonly Redis $redis
    ) {
    }

    public function getConversationsByUserIds(MagicConversationEntity $conversation, ConversationListQueryDTO $queryDTO, array $userIds): ConversationsPageResponseDTO
    {
        $conversationIds = $queryDTO->getIds();
        $limit = $queryDTO->getLimit() ?: 100;
        $offset = (int) ($queryDTO->getPageToken() ?: 0);
        $query = $this->magicChatConversationModel::query()->whereIn('user_id', $userIds);
        $conversationIds && $query->whereIn('id', $conversationIds);
        if ($queryDTO->getStatus() !== null) {
            $query->where('status', $queryDTO->getStatus());
        }
        if ($queryDTO->getIsTop() !== null) {
            $query->where('is_top', $queryDTO->getIsTop());
        }
        if ($queryDTO->getIsMark() !== null) {
            $query->where('is_mark', $queryDTO->getIsMark());
        }
        if ($queryDTO->getIsNotDisturb() !== null) {
            $query->where('is_not_disturb', $queryDTO->getIsNotDisturb());
        }
        $query->orderBy('is_top', 'desc')
            ->orderBy('updated_at', 'desc')
            ->limit($limit)
            ->offset($offset);
        $conversations = Db::select($query->toSql(), $query->getBindings());
        $items = ConversationAssembler::getConversationEntities($conversations);

        $hasMore = count($items) === $limit;
        $pageToken = $hasMore ? (string) ($offset + $limit) : '';
        return new ConversationsPageResponseDTO([
            'page_token' => $pageToken,
            'has_more' => $hasMore,
            'items' => $items,
        ]);
    }

    /**
     * @return MagicConversationEntity[]
     */
    public function getConversationByIds(array $conversationIds): array
    {
        $query = $this->magicChatConversationModel::query()->whereIn('id', $conversationIds);
        $conversations = Db::select($query->toSql(), $query->getBindings());
        return ConversationAssembler::getConversationEntities($conversations);
    }

    public function addConversation(MagicConversationEntity $conversation): MagicConversationEntity
    {
        $time = date('Y-m-d H:i:s');
        if (empty($conversation->getUserOrganizationCode()) || empty($conversation->getReceiveOrganizationCode())) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_ORGANIZATION_CODE_EMPTY);
        }
        $conversationData = [
            'id' => (string) IdGenerator::getSnowId(),
            'user_id' => $conversation->getUserId(),
            'user_organization_code' => $conversation->getUserOrganizationCode(),
            'receive_type' => $conversation->getReceiveType()->value,
            'receive_id' => $conversation->getReceiveId(),
            'receive_organization_code' => $conversation->getReceiveOrganizationCode(),
            'is_not_disturb' => 0,
            'status' => ConversationStatus::Normal->value,
            'is_top' => 0,
            'is_mark' => 0,
            'extra' => '',
            'created_at' => $time,
            'updated_at' => $time,
            'deleted_at' => null,
            'instructs' => $conversation->getInstructs(),
            'translate_config' => $conversation->getTranslateConfig(),
        ];
        $this->magicChatConversationModel::query()->create($conversationData);
        return ConversationAssembler::getConversationEntity($conversationData);
    }

    public function getConversationByUserIdAndReceiveId(MagicConversationEntity $conversation): ?MagicConversationEntity
    {
        $conversationData = $this->getConversationArrayByUserIdAndReceiveId($conversation);
        if (empty($conversationData)) {
            return null;
        }
        return ConversationAssembler::getConversationEntity($conversationData);
    }

    public function getConversationById(string $conversationId): ?MagicConversationEntity
    {
        $conversation = $this->getConversationArrayById($conversationId);
        if (empty($conversation)) {
            return null;
        }
        return ConversationAssembler::getConversationEntity($conversation);
    }

    /**
     * (分组织)获取用户与指定用户的会话窗口信息.
     * @return array<MagicConversationEntity>
     */
    public function getConversationsByReceiveIds(string $userId, array $receiveIds, ?string $userOrganizationCode = null): array
    {
        $query = $this->magicChatConversationModel::query()
            ->where('user_id', $userId)
            ->whereIn('receive_id', $receiveIds);

        $userOrganizationCode && $query->where('organization_code', $userOrganizationCode);
        $conversations = Db::select($query->toSql(), $query->getBindings());
        return ConversationAssembler::getConversationEntities($conversations);
    }

    public function getReceiveConversationBySenderConversationId(string $senderConversationId): ?MagicConversationEntity
    {
        // 获取发件方的信息
        $senderConversationEntity = $this->getConversationById($senderConversationId);
        if ($senderConversationEntity === null) {
            return null;
        }
        // 获取收件方的会话窗口
        $receiveConversationDTO = new MagicConversationEntity();
        $receiveConversationDTO->setUserId($senderConversationEntity->getReceiveId());
        $receiveConversationDTO->setReceiveId($senderConversationEntity->getUserId());
        $receiveConversationEntity = $this->getConversationByUserIdAndReceiveId($receiveConversationDTO);
        return $receiveConversationEntity ?? null;
    }

    public function batchAddConversation(array $conversations): bool
    {
        $time = date('Y-m-d H:i:s');
        $conversationData = [];
        foreach ($conversations as $conversation) {
            if (empty($conversation['id'])) {
                $id = (string) IdGenerator::getSnowId();
            } else {
                $id = $conversation['id'];
            }
            if (empty($conversation['user_organization_code']) || empty($conversation['receive_organization_code'])) {
                ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_ORGANIZATION_CODE_EMPTY);
            }
            $conversationData[] = [
                'id' => $id,
                'user_id' => $conversation['user_id'],
                'user_organization_code' => $conversation['user_organization_code'],
                'receive_type' => $conversation['receive_type'],
                'receive_id' => $conversation['receive_id'],
                'receive_organization_code' => $conversation['receive_organization_code'],
                'is_not_disturb' => 0,
                'is_top' => 0,
                'is_mark' => 0,
                'extra' => '',
                'created_at' => $time,
                'updated_at' => $time,
                'deleted_at' => null,
                'status' => ConversationStatus::Normal->value,
            ];
        }
        return $this->magicChatConversationModel::query()->insert($conversationData);
    }

    /**
     * @return MagicConversationEntity[]
     */
    public function batchGetConversations(array $userIds, string $receiveId, ConversationType $receiveType): array
    {
        $query = $this->magicChatConversationModel::query()
            ->whereIn('user_id', $userIds)
            ->where('receive_id', $receiveId)
            ->where('receive_type', $receiveType->value);
        $conversations = Db::select($query->toSql(), $query->getBindings());
        return ConversationAssembler::getConversationEntities($conversations);
    }

    /**
     * 批量移除会话窗口.
     */
    public function batchRemoveConversations(array $userIds, string $receiveId, ConversationType $receiveType): int
    {
        if (empty($userIds)) {
            return 0;
        }
        return $this->magicChatConversationModel::query()
            ->whereIn('user_id', $userIds)
            ->where('receive_id', $receiveId)
            ->where('receive_type', $receiveType->value)
            ->update([
                'status' => ConversationStatus::Delete->value,
            ]);
    }

    // 批量更新会话窗口
    public function batchUpdateConversations(array $conversationIds, array $updateData): int
    {
        return $this->magicChatConversationModel::query()
            ->whereIn('id', $conversationIds)
            ->update($updateData);
    }

    public function getAllConversationList(): array
    {
        return $this->magicChatConversationModel::query()->get()->toArray();
    }

    public function saveInstructs(string $conversationId, array $instructs): void
    {
        $this->magicChatConversationModel->newQuery()->where('id', $conversationId)->update(['instructs' => Json::encode($instructs)]);
    }

    /**
     * @return MagicConversationEntity[]
     */
    public function getRelatedConversationsWithInstructByUserId(array $userIds): array
    {
        $query = $this->magicChatConversationModel->newQuery()
            ->whereIn('user_id', $userIds)
            ->orWhereIn('receive_id', $userIds)
            ->whereNotNull('instructs')
            ->where('instructs', '<>', '');
        $conversations = Db::select($query->toSql(), $query->getBindings());
        return ConversationAssembler::getConversationEntities($conversations);
    }

    /**
     * 批量更新会话窗口的交互指令.
     * @param array $updateData 格式为：[['conversation_id' => 'xxx', 'instructs' => [...]], ...]
     */
    public function batchUpdateInstructs(array $updateData): void
    {
        if (empty($updateData)) {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $cases = [];
        $ids = [];
        $bindings = [];

        foreach ($updateData as $data) {
            $cases[] = 'WHEN ? THEN ?';
            $ids[] = $data['conversation_id'];
            $bindings[] = $data['conversation_id'];
            $bindings[] = Json::encode($data['instructs']);
        }

        $bindings[] = $now;
        $bindings = array_merge($bindings, $ids);

        $sql = sprintf(
            'UPDATE %s SET instructs = CASE id %s END, updated_at = ? WHERE id IN (%s)',
            $this->magicChatConversationModel->getTable(),
            implode(' ', $cases),
            implode(',', array_fill(0, count($ids), '?'))
        );

        $this->magicChatConversationModel::query()
            ->getConnection()
            ->update($sql, $bindings);
    }

    public function updateConversationById(string $id, array $data): int
    {
        $time = date('Y-m-d H:i:s');
        $data['updated_at'] = $time;
        unset($data['id']);
        return $this->magicChatConversationModel::query()
            ->where('id', $id)
            ->update($data);
    }

    public function updateConversationStatusByIds(array $ids, ConversationStatus $status): int
    {
        $time = date('Y-m-d H:i:s');
        return $this->magicChatConversationModel::query()
            ->whereIn('id', $ids)
            ->update([
                'status' => $status->value,
                'updated_at' => $time,
            ]);
    }

    public function getConversationByIdentity(MagicConversationEntity $identity, bool $includeDeleted = false): ?MagicConversationEntity
    {
        if (! $identity->hasReceiveType() || $identity->getUserOrganizationCode() === '' || $identity->getReceiveOrganizationCode() === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '会话身份不完整');
        }
        $query = $this->magicChatConversationModel::query()->withTrashed()->where([
            'user_id' => $identity->getUserId(),
            'receive_id' => $identity->getReceiveId(),
            'receive_type' => $identity->getReceiveType()->value,
            'user_organization_code' => $identity->getUserOrganizationCode(),
            'receive_organization_code' => $identity->getReceiveOrganizationCode(),
        ]);
        if (! $includeDeleted) {
            $query->whereNull('deleted_at');
        }
        $row = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        return $row === null ? null : ConversationAssembler::getConversationEntity($row);
    }

    /** @return array<string, MagicConversationEntity> */
    public function getConversationsByIdsForUpdate(array $ids): array
    {
        $this->requireTransaction();
        foreach ($ids as $id) {
            if (! is_string($id) || ! preg_match('/^[1-9][0-9]*$/D', $id)) {
                ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '会话 ID 无效');
            }
        }
        $ids = array_values(array_unique($ids));
        usort($ids, static fn (string $left, string $right): int => strlen($left) <=> strlen($right) ?: strcmp($left, $right));
        $conversations = [];
        foreach ($ids as $id) {
            $query = $this->magicChatConversationModel::query()->where('id', $id)->whereNull('deleted_at')->lockForUpdate();
            $row = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
            if ($row !== null) {
                // Validate the raw object before entity conversion can discard unknown fields.
                $this->decodeExtra($row['extra'] ?? null);
                $conversations[$id] = ConversationAssembler::getConversationEntity($row);
            }
        }
        return $conversations;
    }

    public function updateDefaultTopicId(string $id, string $topicId): void
    {
        $this->requireTransaction();
        $query = $this->magicChatConversationModel::query()->where('id', $id)->whereNull('deleted_at')->lockForUpdate();
        $row = Db::select($query->toSql(), $query->getBindings())[0] ?? null;
        if ($row === null) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        $extra = $this->decodeExtra($row['extra'] ?? null);
        $extra->default_topic_id = $topicId;
        $this->updateConversationById($id, ['extra' => Json::encode($extra)]);
    }

    private function decodeExtra(?string $extra): stdClass
    {
        if ($extra === null || $extra === '') {
            return new stdClass();
        }
        try {
            $decoded = Json::decode($extra, false);
        } catch (InvalidArgumentException) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '会话 extra 不是有效的 JSON 对象');
        }
        if (! $decoded instanceof stdClass) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '会话 extra 必须是 JSON 对象');
        }
        return $decoded;
    }

    private function requireTransaction(): void
    {
        if (Db::connection()->transactionLevel() < 1) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '会话默认话题更新必须在事务内执行');
        }
    }

    private function getIdentityConditions(MagicConversationEntity $conversation): array
    {
        $conditions = [
            'user_id' => $conversation->getUserId(),
            'receive_id' => $conversation->getReceiveId(),
        ];
        if ($conversation->hasReceiveType()) {
            $conditions['receive_type'] = $conversation->getReceiveType()->value;
        }
        if ($conversation->getUserOrganizationCode()) {
            $conditions['user_organization_code'] = $conversation->getUserOrganizationCode();
        }
        if ($conversation->getReceiveOrganizationCode()) {
            $conditions['receive_organization_code'] = $conversation->getReceiveOrganizationCode();
        }
        return $conditions;
    }

    private function getConversationArrayByUserIdAndReceiveId(MagicConversationEntity $conversation): array
    {
        $conditions = $this->getIdentityConditions($conversation);
        // Missing selectors remain absent in both SQL and the versioned cache key.
        $cacheKey = 'conversation_identity_v2:' . hash('sha256', Json::encode($conditions));
        $useCache = Db::connection()->transactionLevel() === 0;
        if ($useCache) {
            $id = $this->redis->get($cacheKey);
            if (is_string($id) && $id !== '') {
                $query = $this->magicChatConversationModel::query()->where('id', $id)->where($conditions)->whereNull('deleted_at');
                $row = Db::select($query->toSql(), $query->getBindings())[0] ?? [];
                if ($row) {
                    return $row;
                }
                $this->redis->del($cacheKey);
            }
        }
        $query = $this->magicChatConversationModel::query()->where($conditions)->whereNull('deleted_at');
        $row = Db::select($query->toSql(), $query->getBindings())[0] ?? [];
        if ($row && $useCache) {
            $this->redis->setex($cacheKey, 60, (string) $row['id']);
        }
        return $row;
    }

    private function getConversationArrayById(string $conversationId): array
    {
        $query = $this->magicChatConversationModel::query()->where('id', $conversationId)->whereNull('deleted_at');
        return Db::select($query->toSql(), $query->getBindings())[0] ?? [];
    }
}
