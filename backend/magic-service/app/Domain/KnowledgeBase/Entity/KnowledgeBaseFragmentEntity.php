<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity;

use App\Domain\KnowledgeBase\Entity\ValueObject\KnowledgeSyncStatus;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Embeddings\VectorStores\PointInfo;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;
use Hyperf\Codec\Json;
use Hyperf\Snowflake\IdGeneratorInterface;
use Hyperf\Stringable\Str;
use Throwable;

use function mb_strlen;

/**
 * 向量知识库文本片段.
 */
class KnowledgeBaseFragmentEntity extends AbstractKnowledgeBaseEntity
{
    public const string PAYLOAD_PREFIX = '#';

    protected ?int $id = null;

    protected string $knowledgeCode = '';

    protected string $documentCode = '';

    /**
     * 片段内容.
     */
    protected string $content = '';

    protected array $metadata = [];

    /**
     * 业务 ID，可用于业务方记录自己的 ID 用来进行更新数据.
     */
    protected string $businessId = '';

    protected string $pointId = '';

    protected string $vector = '';

    protected KnowledgeSyncStatus $syncStatus = KnowledgeSyncStatus::NotSynced;

    protected int $syncTimes = 0;

    protected string $syncStatusMessage = '';

    protected string $creator = '';

    protected DateTime $createdAt;

    protected string $modifier = '';

    protected DateTime $updatedAt;

    protected float $score = 0;

    protected int $wordCount = 0;

    protected int $version = 1;

    public function shouldCreate(): bool
    {
        return empty($this->id);
    }

    public function prepareForCreation(): self
    {
        if (empty($this->knowledgeCode)) {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.knowledge_code.empty');
        }
        if (trim($this->documentCode) === '') {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, '文档编码不能为空');
        }
        if (! isset($this->content) || trim($this->content) === '') {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.content.empty');
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.creator.empty');
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        $this->checkMetadata();

        $this->pointId = md5($this->content);
        $this->vector = '';
        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->syncStatus = KnowledgeSyncStatus::NotSynced;
        $this->syncStatusMessage = '';
        $this->setWordCount(mb_strlen($this->content));
        return $this;
    }

    public function prepareForModification(KnowledgeBaseFragmentEntity $magicFlowKnowledgeFragmentEntity): self
    {
        if (trim($this->documentCode) === '') {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, '文档编码不能为空');
        }
        if (empty($this->content)) {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.content.empty');
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, 'flow.creator.empty');
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        $this->checkMetadata();

        $magicFlowKnowledgeFragmentEntity->setContent($this->content);
        $magicFlowKnowledgeFragmentEntity->setMetadata($this->metadata);
        $magicFlowKnowledgeFragmentEntity->setBusinessId($this->businessId);
        $magicFlowKnowledgeFragmentEntity->setModifier($this->creator);
        $magicFlowKnowledgeFragmentEntity->setUpdatedAt($this->createdAt);
        $magicFlowKnowledgeFragmentEntity->setDocumentCode($this->documentCode);
        $magicFlowKnowledgeFragmentEntity->setWordCount(mb_strlen($this->content));
        $magicFlowKnowledgeFragmentEntity->setVersion($this->version);
        return $this;
    }

    public function hasModify(KnowledgeBaseFragmentEntity $savingMagicFlowKnowledgeFragmentEntity): bool
    {
        // 如果 content 和 metadata 都没有变化，就不需要更新了
        if ($savingMagicFlowKnowledgeFragmentEntity->getContent() === $this->content
            && $savingMagicFlowKnowledgeFragmentEntity->getMetadata() === $this->metadata
            && $savingMagicFlowKnowledgeFragmentEntity->getBusinessId() === $this->businessId
            && $savingMagicFlowKnowledgeFragmentEntity->getDocumentCode() === $this->documentCode
        ) {
            return false;
        }
        return true;
    }

    public static function createByPointInfo(PointInfo $pointInfo, string $knowledgeCode): KnowledgeBaseFragmentEntity
    {
        $entity = new self();
        $entity->setKnowledgeCode($knowledgeCode);
        $entity->setVector(Json::encode($pointInfo->vector));
        $entity->setScore($pointInfo->score);

        $payload = $pointInfo->payload;

        $builtInfo = $payload[self::PAYLOAD_PREFIX . 'info'] ?? [];
        $content = $payload[self::PAYLOAD_PREFIX . 'content'] ?? '';
        $id = isset($builtInfo['id']) ? (int) $builtInfo['id'] : null;

        $entity->setPointId(md5($content));
        $entity->setId($id);
        $entity->setBusinessId($builtInfo['business_id'] ?? '');
        $entity->setContent($content);
        $entity->setCreator($builtInfo['creator'] ?? '');
        $entity->setCreatedAt(new DateTime($builtInfo['created_at'] ?? 'now'));
        $entity->setModifier($builtInfo['modifier'] ?? '');
        $entity->setUpdatedAt(new DateTime($builtInfo['updated_at'] ?? 'now'));
        unset($payload[self::PAYLOAD_PREFIX . 'info'], $payload[self::PAYLOAD_PREFIX . 'content']);
        $entity->setMetadata($payload);

        $entity->setSyncStatus(KnowledgeSyncStatus::Synced);

        return $entity;
    }

    public function getPayload(): array
    {
        $builtInfo = [
            'id' => (string) $this->id,
            'business_id' => $this->businessId,
            'document_code' => $this->documentCode,
            'version' => $this->version,
            'content' => $this->content,
            'creator' => $this->getCreator(),
            'created_at' => $this->getCreatedAt()->format('Y-m-d H:i:s'),
            'modifier' => $this->getModifier(),
            'updated_at' => $this->getUpdatedAt()->format('Y-m-d H:i:s'),
        ];

        return array_merge($this->getMetadata(), [
            self::PAYLOAD_PREFIX . 'content' => $this->getContent(),
            self::PAYLOAD_PREFIX . 'info' => $builtInfo,
        ]);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): self
    {
        $this->id = is_null($id) ? null : (int) $id;
        return $this;
    }

    public function getKnowledgeCode(): string
    {
        return $this->knowledgeCode;
    }

    public function setKnowledgeCode(string $knowledgeCode): self
    {
        $this->knowledgeCode = $knowledgeCode;
        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): self
    {
        $this->content = $content;
        return $this;
    }

    public function getBusinessId(): string
    {
        return $this->businessId;
    }

    public function setBusinessId(string $businessId): self
    {
        $this->businessId = $businessId;
        return $this;
    }

    public function getMetadata(): array
    {
        return $this->metadata;
    }

    public function setMetadata(array $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    public function getPointId(): string
    {
        return $this->pointId;
    }

    public function setPointId(string $pointId): self
    {
        $this->pointId = $pointId;
        return $this;
    }

    public function getVector(): string
    {
        return $this->vector;
    }

    public function setVector(string $vector): self
    {
        $this->vector = $vector;
        return $this;
    }

    public function getSyncStatus(): KnowledgeSyncStatus
    {
        return $this->syncStatus;
    }

    public function setSyncStatus(int|KnowledgeSyncStatus $syncStatus): self
    {
        is_int($syncStatus) && $syncStatus = KnowledgeSyncStatus::tryFrom($syncStatus) ?? KnowledgeSyncStatus::NotSynced;
        $this->syncStatus = $syncStatus;
        return $this;
    }

    public function getSyncTimes(): int
    {
        return $this->syncTimes;
    }

    public function setSyncTimes(int $syncTimes): self
    {
        $this->syncTimes = $syncTimes;
        return $this;
    }

    public function getSyncStatusMessage(): string
    {
        return $this->syncStatusMessage;
    }

    public function setSyncStatusMessage(string $syncStatusMessage): self
    {
        $this->syncStatusMessage = $syncStatusMessage;
        return $this;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(null|int|string $creator): self
    {
        $this->creator = (string) ($creator ?? '');
        return $this;
    }

    public function getCreatedUid(): string
    {
        return $this->creator;
    }

    /**
     * 兼容 RPC / DB 风格字段名 created_uid.
     */
    public function setCreatedUid(null|int|string $createdUid): self
    {
        return $this->setCreator($createdUid);
    }

    public function getCreatedAt(): DateTime
    {
        if (! isset($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        return $this->createdAt;
    }

    public function setCreatedAt(null|DateTime|string $createdAt): self
    {
        if ($createdAt === null || $createdAt === '') {
            $createdAt = new DateTime();
        }
        if (is_string($createdAt)) {
            try {
                $createdAt = new DateTime($createdAt);
            } catch (Throwable) {
                $createdAt = new DateTime();
            }
        }
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(null|int|string $modifier): self
    {
        $this->modifier = (string) ($modifier ?? '');
        return $this;
    }

    public function getUpdatedUid(): string
    {
        return $this->modifier;
    }

    /**
     * 兼容 RPC / DB 风格字段名 updated_uid.
     */
    public function setUpdatedUid(null|int|string $updatedUid): self
    {
        return $this->setModifier($updatedUid);
    }

    public function getUpdatedAt(): DateTime
    {
        if (! isset($this->updatedAt)) {
            $this->updatedAt = new DateTime();
        }
        return $this->updatedAt;
    }

    public function setUpdatedAt(null|DateTime|string $updatedAt): self
    {
        if ($updatedAt === null || $updatedAt === '') {
            $updatedAt = new DateTime();
        }
        if (is_string($updatedAt)) {
            try {
                $updatedAt = new DateTime($updatedAt);
            } catch (Throwable) {
                $updatedAt = new DateTime();
            }
        }
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getScore(): float
    {
        return $this->score;
    }

    public function setScore(float $score): self
    {
        $this->score = $score;
        return $this;
    }

    public function getDocumentCode(): string
    {
        return $this->documentCode;
    }

    public function setDocumentCode(string $documentCode): KnowledgeBaseFragmentEntity
    {
        $this->documentCode = $documentCode;
        return $this;
    }

    public function getWordCount(): int
    {
        return $this->wordCount;
    }

    // 这里不用设置，直接根据content计算出来就行
    public function setWordCount(int $wordCount): KnowledgeBaseFragmentEntity
    {
        $this->wordCount = $wordCount;
        return $this;
    }

    /**
     * @param array<string> $fragmentContents
     * @return array<KnowledgeBaseFragmentEntity>
     */
    public static function fromFragmentContents(array $fragmentContents): array
    {
        $entities = [];
        $now = new DateTime();

        foreach ($fragmentContents as $content) {
            $entity = new self();
            $entity->setId(di(IdGeneratorInterface::class)->generate());
            $entity->setContent($content);
            $entity->setPointId(md5($content));
            $entity->setWordCount(mb_strlen($content));
            $entity->setKnowledgeCode('');
            $entity->setDocumentCode('');
            $entity->setBusinessId('');
            $entity->setCreator('');
            $entity->setCreatedAt($now);
            $entity->setModifier('');
            $entity->setUpdatedAt($now);
            $entity->setMetadata([]);
            $entity->setSyncStatus(KnowledgeSyncStatus::NotSynced);
            $entity->setSyncTimes(0);
            $entity->setSyncStatusMessage('');

            $entities[] = $entity;
        }

        return $entities;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function setVersion(int $version): static
    {
        $this->version = $version;
        return $this;
    }

    private function checkMetadata(): self
    {
        foreach ($this->metadata as $key => $value) {
            if (Str::startsWith($key, self::PAYLOAD_PREFIX)) {
                ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, '元数据 key 不能以 ' . self::PAYLOAD_PREFIX . ' 开头');
            }
            if (! is_string($key)) {
                ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, '元数据 的 key 必须是字符串');
            }
            if (! is_string($value) && ! is_numeric($value)) {
                ExceptionBuilder::throw(FlowErrorCode::KnowledgeValidateFailed, '元数据 的 value 只能是 字符串或者数字');
            }
        }
        return $this;
    }
}
