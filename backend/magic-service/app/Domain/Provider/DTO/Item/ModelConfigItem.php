<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

use App\Domain\Provider\DTO\Item\TokenPricing\BillingTiers;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Odin\Api\Request\ReasoningEffort;
use Hyperf\Odin\Constants\ChatApi;

/** 模型运行配置统一处理历史思考参数，接口调用方无需推断默认值。 */
class ModelConfigItem extends AbstractDTO
{
    protected ?int $maxTokens = null;

    protected bool $supportFunction = true;

    protected bool $supportDeepThink = false;

    /** 未配置与显式空数组分别表示历史三档和不开放手动选择。 */
    protected ?array $reasoningEffortLevels = null;

    /** 空值跟随服务商默认，关闭能力时保留原始配置。 */
    protected ?string $reasoningEffortDefault = null;

    protected int $vectorSize = 2048;

    protected bool $supportMultiModal = true;

    protected bool $supportEmbedding = false;

    protected ?int $maxOutputTokens = null;

    /**
     * OpenAI 兼容接口类型：chat_completions 或 responses.
     */
    protected string $chatApi = ChatApi::CHAT_COMPLETIONS;

    protected ?float $creativity = null;

    protected ?float $temperature = null;

    protected ?string $billingCurrency = null;

    protected BillingType $billingType = BillingType::Tokens;

    protected ?string $inputPricing = null;

    protected ?string $outputPricing = null;

    protected ?string $cacheWritePricing = null;

    protected ?string $cacheHitPricing = null;

    protected bool $officialRecommended = false;

    protected ?string $timePricing = null;

    protected ?string $secondPricing = null;

    protected ?string $inputCost = null;

    protected ?string $outputCost = null;

    protected ?string $cacheHitCost = null;

    protected ?string $cacheWriteCost = null;

    protected ?string $timeCost = null;

    protected ?string $secondCost = null;

    protected ?BillingTiers $billingTiers = null;

    public function __construct(?array $data = null)
    {
        if (empty($data)) {
            return;
        }

        $billingTiers = $data['billing_tiers'] ?? null;
        unset($data['billing_tiers']);

        parent::__construct($data);

        $this->setBillingTiers($billingTiers);
        $this->normalizeReasoningEffortDefault();
    }

    /** 输出完整的编辑配置；关闭开关仅隐藏能力，不丢弃可恢复的档位。 */
    public function jsonSerialize(): array
    {
        $data = parent::jsonSerialize();
        $data['reasoning_effort_levels'] = $this->reasoningEffortLevels ?? ['low', 'medium', 'high'];
        $data['reasoning_effort_default'] = $this->reasoningEffortDefault;
        return $data;
    }

    /** 获取原始配置，用于版本记录，保留历史空值语义。 */
    public function getReasoningEffortLevels(): ?array
    {
        return $this->reasoningEffortLevels;
    }

    /** 校验七档并按统一顺序去重保存。 */
    public function setReasoningEffortLevels(?array $levels): void
    {
        if ($levels === null) {
            $this->reasoningEffortLevels = null;
            $this->normalizeReasoningEffortDefault();
            return;
        }
        foreach ($levels as $level) {
            if (! is_string($level) || ReasoningEffort::tryFrom($level) === null) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'Invalid reasoning_effort_levels');
            }
        }
        $this->reasoningEffortLevels = array_values(array_intersect(ReasoningEffort::values(), $levels));
        $this->normalizeReasoningEffortDefault();
    }

    /** 统一读取有效档位，关闭思考时不开放选择，历史配置默认三档。 */
    public function getEffectiveReasoningEffortLevels(): array
    {
        return $this->supportDeepThink ? ($this->reasoningEffortLevels ?? ['low', 'medium', 'high']) : [];
    }

    /** 读取原始默认档位，用于编辑和配置版本记录。 */
    public function getReasoningEffortDefault(): ?string
    {
        return $this->reasoningEffortDefault;
    }

    /** 后台默认值限定七档；请求透传不使用此校验。 */
    public function setReasoningEffortDefault(?string $level): void
    {
        if ($level !== null && ReasoningEffort::tryFrom($level) === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'Invalid reasoning_effort_default');
        }
        $this->reasoningEffortDefault = $level;
    }

    /** 关闭能力或档位已移除时不应用覆盖，历史空值保持服务商默认。 */
    public function getEffectiveReasoningEffortDefault(): ?string
    {
        return in_array($this->reasoningEffortDefault, $this->getEffectiveReasoningEffortLevels(), true)
            ? $this->reasoningEffortDefault : null;
    }

    public function getMaxTokens(): ?int
    {
        return $this->maxTokens;
    }

    public function setMaxTokens(null|int|string $maxTokens): void
    {
        if ($maxTokens === null) {
            $this->maxTokens = null;
        } else {
            $this->maxTokens = (int) $maxTokens;
        }
    }

    public function getVectorSize(): int
    {
        return $this->vectorSize;
    }

    public function setVectorSize(null|int|string $vectorSize): void
    {
        if ($vectorSize === null) {
            $this->vectorSize = 2048;
        } else {
            $this->vectorSize = (int) $vectorSize;
        }
    }

    public function isSupportMultiModal(): bool
    {
        return $this->supportMultiModal;
    }

    public function setSupportMultiModal(null|bool|int|string $supportMultiModal): void
    {
        $this->supportMultiModal = $this->parseBooleanValue($supportMultiModal);
    }

    public function isSupportEmbedding(): bool
    {
        return $this->supportEmbedding;
    }

    public function setSupportEmbedding(null|bool|int|string $supportEmbedding): void
    {
        $this->supportEmbedding = $this->parseBooleanValue($supportEmbedding);
    }

    public function isSupportFunction(): bool
    {
        return $this->supportFunction;
    }

    public function setSupportFunction(null|bool|int|string $supportFunction): void
    {
        $this->supportFunction = $this->parseBooleanValue($supportFunction);
    }

    public function isSupportDeepThink(): bool
    {
        return $this->supportDeepThink;
    }

    public function setSupportDeepThink(null|bool|int|string $supportDeepThink): void
    {
        $this->supportDeepThink = $this->parseBooleanValue($supportDeepThink);
    }

    public function isRecommended(): bool
    {
        return $this->isRecommended;
    }

    public function setIsRecommended(bool $isRecommended): void
    {
        $this->isRecommended = $isRecommended;
    }

    public function getMaxOutputTokens(): ?int
    {
        return $this->maxOutputTokens;
    }

    public function getChatApi(): string
    {
        return $this->chatApi;
    }

    public function setChatApi(?string $chatApi): void
    {
        if (is_string($chatApi) && in_array($chatApi, [ChatApi::CHAT_COMPLETIONS, ChatApi::RESPONSES], true)) {
            $this->chatApi = $chatApi;
            return;
        }

        $this->chatApi = ChatApi::CHAT_COMPLETIONS;
    }

    public function getCreativity(): ?float
    {
        return $this->creativity;
    }

    public function getTemperature(): ?float
    {
        return $this->temperature;
    }

    public function getBillingCurrency(): ?string
    {
        return $this->billingCurrency;
    }

    public function getInputPricing(): ?string
    {
        return $this->inputPricing;
    }

    public function getOutputPricing(): ?string
    {
        return $this->outputPricing;
    }

    public function getCacheWritePricing(): ?string
    {
        return $this->cacheWritePricing;
    }

    public function getCacheHitPricing(): ?string
    {
        return $this->cacheHitPricing;
    }

    public function isOfficialRecommended(): bool
    {
        return $this->officialRecommended;
    }

    public function setMaxOutputTokens(?int $maxOutputTokens): void
    {
        $this->maxOutputTokens = $maxOutputTokens;
    }

    public function setCreativity(?float $creativity): void
    {
        if ($creativity !== null && ($creativity < 0 || $creativity > 2)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.creativity_value_range_error');
        }

        $this->creativity = $creativity;
        $this->handleCreativityAndTemperatureConflict();
    }

    public function setTemperature(?float $temperature): void
    {
        if ($temperature !== null && ($temperature < 0 || $temperature > 2)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, 'service_provider.temperature_value_range_error');
        }

        $this->temperature = $temperature;
        $this->handleCreativityAndTemperatureConflict();
    }

    public function setBillingCurrency(?string $billingCurrency): void
    {
        if ($billingCurrency === null) {
            $this->billingCurrency = null;
        } else {
            $currency = strtoupper(trim((string) $billingCurrency));
            if (in_array($currency, ['CNY', 'USD'])) {
                $this->billingCurrency = $currency;
            } else {
                $this->billingCurrency = null;
            }
        }
    }

    public function setInputPricing(null|float|string $inputPricing): void
    {
        $this->inputPricing = $this->validateAndSetPricing($inputPricing);
    }

    public function setOutputPricing(null|float|string $outputPricing): void
    {
        $this->outputPricing = $this->validateAndSetPricing($outputPricing);
    }

    public function setCacheWritePricing(null|float|string $cacheWritePricing): void
    {
        $this->cacheWritePricing = $this->validateAndSetPricing($cacheWritePricing);
    }

    public function setCacheHitPricing(null|float|string $cacheHitPricing): void
    {
        $this->cacheHitPricing = $this->validateAndSetPricing($cacheHitPricing);
    }

    public function setOfficialRecommended(bool $officialRecommended): void
    {
        $this->officialRecommended = $officialRecommended;
    }

    public function getBillingType(): BillingType
    {
        return $this->billingType;
    }

    public function setBillingType(BillingType|string $billingType): void
    {
        $this->billingType = $billingType instanceof BillingType ? $billingType : BillingType::tryFrom($billingType) ?? BillingType::Tokens;
    }

    public function getTimePricing(): ?string
    {
        return $this->timePricing;
    }

    public function setTimePricing(?string $timePricing): void
    {
        $this->timePricing = $timePricing;
    }

    public function getSecondPricing(): ?string
    {
        return $this->secondPricing;
    }

    public function setSecondPricing(null|float|string $secondPricing): void
    {
        $this->secondPricing = $this->validateAndSetPricing($secondPricing);
    }

    public function getInputCost(): ?string
    {
        return $this->inputCost;
    }

    public function setInputCost(null|float|string $inputCost): void
    {
        $this->inputCost = $this->validateAndSetPricing($inputCost);
    }

    public function getOutputCost(): ?string
    {
        return $this->outputCost;
    }

    public function setOutputCost(null|float|string $outputCost): void
    {
        $this->outputCost = $this->validateAndSetPricing($outputCost);
    }

    public function getCacheHitCost(): ?string
    {
        return $this->cacheHitCost;
    }

    public function setCacheHitCost(null|float|string $cacheHitCost): void
    {
        $this->cacheHitCost = $this->validateAndSetPricing($cacheHitCost);
    }

    public function getCacheWriteCost(): ?string
    {
        return $this->cacheWriteCost;
    }

    public function setCacheWriteCost(null|float|string $cacheWriteCost): void
    {
        $this->cacheWriteCost = $this->validateAndSetPricing($cacheWriteCost);
    }

    public function getTimeCost(): ?string
    {
        return $this->timeCost;
    }

    public function setTimeCost(null|float|string $timeCost): void
    {
        $this->timeCost = $this->validateAndSetPricing($timeCost);
    }

    public function getSecondCost(): ?string
    {
        return $this->secondCost;
    }

    public function setSecondCost(null|float|string $secondCost): void
    {
        $this->secondCost = $this->validateAndSetPricing($secondCost);
    }

    public function getBillingTiers(): ?BillingTiers
    {
        return $this->billingTiers;
    }

    public function setBillingTiers(null|array|BillingTiers|string $billingTiers): void
    {
        if ($billingTiers === null || $billingTiers === '' || $billingTiers === []) {
            $this->billingTiers = null;
            return;
        }

        if ($billingTiers instanceof BillingTiers) {
            $this->billingTiers = $billingTiers;
            return;
        }

        if (is_string($billingTiers)) {
            if (! json_validate($billingTiers)) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
            }
            $decoded = json_decode($billingTiers, true);
            if (! is_array($decoded)) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
            }
            $billingTiers = $decoded;
        }

        $this->billingTiers = new BillingTiers($billingTiers);
    }

    /** 完成初始化后归一化依赖，避免 JSON 字段顺序影响最终默认值。 */
    private function normalizeReasoningEffortDefault(): void
    {
        if (! in_array($this->reasoningEffortDefault, $this->reasoningEffortLevels ?? ['low', 'medium', 'high'], true)) {
            $this->reasoningEffortDefault = null;
        }
    }

    private function handleCreativityAndTemperatureConflict(): void
    {
        if ($this->creativity !== null && $this->temperature !== null) {
            // 优先保留 temperature，将 creativity 设为 null
            $this->creativity = null;
        }
    }

    /**
     * 解析布尔值（统一处理逻辑）.
     */
    private function parseBooleanValue(null|bool|int|string $value): bool
    {
        if ($value === null) {
            return false;
        }

        if (is_string($value)) {
            return in_array(strtolower($value), ['true', '1', 'yes', 'on'], true);
        }

        return (bool) $value;
    }

    /**
     * 验证并设置价格/成本（统一处理逻辑）.
     */
    private function validateAndSetPricing(null|float|string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $numericValue = (float) $value;
        if ($numericValue < 0) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidPricing);
        }

        return (string) $value;
    }
}
