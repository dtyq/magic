<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Application\Kernel\AbstractKernelAppService;
use App\Application\Provider\DTO\AiAbilityDetailDTO;
use App\Application\Provider\DTO\AiAbilityListDTO;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\Query\AiAbilityQuery;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\Assembler\AiAbilityAssembler;
use App\Interfaces\Provider\DTO\UpdateAiAbilityRequest;
use Hyperf\Contract\TranslatorInterface;
use Throwable;

/**
 * AI能力应用服务.
 */
class AiAbilityAppService extends AbstractKernelAppService
{
    public function __construct(
        private AiAbilityDomainService $aiAbilityDomainService,
        private TranslatorInterface $translator
    ) {
    }

    /**
     * 获取所有AI能力列表.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @return array<AiAbilityListDTO>
     */
    public function queries(MagicUserAuthorization $authorization): array
    {
        $dataIsolation = $this->createProviderDataIsolation($authorization);

        $locale = $this->translator->getLocale();
        $query = new AiAbilityQuery();
        $result = $this->aiAbilityDomainService->queries($dataIsolation, $query, Page::createNoPage());

        return AiAbilityAssembler::entitiesToListDTOs($result['list'], $locale);
    }

    /**
     * 获取AI能力详情.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @param string $code 能力代码
     */
    public function getDetail(MagicUserAuthorization $authorization, string $code): AiAbilityDetailDTO
    {
        $dataIsolation = $this->createProviderDataIsolation($authorization);

        // 验证code是否有效
        try {
            $codeEnum = AiAbilityCode::from($code);
        } catch (Throwable $e) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        // 获取能力详情
        $entity = $this->aiAbilityDomainService->getByCode($dataIsolation, $codeEnum);

        $locale = $this->translator->getLocale();
        return AiAbilityAssembler::entityToDetailDTO($entity, $locale);
    }

    /**
     * 更新AI能力.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @param UpdateAiAbilityRequest $request 更新请求
     * @return bool 是否更新成功
     */
    public function update(MagicUserAuthorization $authorization, UpdateAiAbilityRequest $request): bool
    {
        $dataIsolation = $this->createProviderDataIsolation($authorization);

        // 验证code是否有效
        try {
            $code = AiAbilityCode::from($request->getCode());
        } catch (Throwable $e) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        // 构建更新数据（支持选择性更新）
        $updateData = [];
        if ($request->hasStatus()) {
            $updateData['status'] = $request->getStatus();
        }
        if ($request->hasConfig()) {
            // 获取当前数据库中的配置
            $entity = $this->aiAbilityDomainService->getByCode($dataIsolation, $code);
            $dbConfig = $entity->getConfig();

            // 智能合并配置（保留被脱敏的api_key）
            $mergedConfig = $this->mergeConfigPreservingApiKeys($dbConfig, $request->getConfig());
            $updateData['config'] = $mergedConfig;
        }

        // 如果没有要更新的数据，直接返回成功
        if (empty($updateData)) {
            return true;
        }

        // 通过 DomainService 更新
        return $this->aiAbilityDomainService->updateByCode($dataIsolation, $code, $updateData);
    }

    /**
     * 初始化AI能力数据（从配置文件同步到数据库）.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @return int 初始化的数量
     */
    public function initializeAbilities(MagicUserAuthorization $authorization): int
    {
        $dataIsolation = $this->createProviderDataIsolation($authorization);

        return $this->aiAbilityDomainService->initializeAbilities($dataIsolation);
    }

    /**
     * 智能合并配置（保留被脱敏的api_key原始值）.
     *
     * @param array $dbConfig 数据库原始配置
     * @param array $frontendConfig 前端传来的配置（可能包含脱敏的api_key）
     * @return array 合并后的配置
     */
    private function mergeConfigPreservingApiKeys(array $dbConfig, array $frontendConfig): array
    {
        $result = [];

        // 遍历前端配置的所有字段
        foreach ($frontendConfig as $key => $value) {
            // 如果是 api_key 字段且包含脱敏标记 ***
            if ($key === 'api_key' && is_string($value) && str_contains($value, '*')) {
                // 使用数据库中的原始值
                $result[$key] = $dbConfig[$key] ?? $value;
            }
            // 如果是数组，递归处理
            elseif (is_array($value)) {
                $dbValue = $dbConfig[$key] ?? [];
                $result[$key] = is_array($dbValue)
                    ? $this->mergeConfigPreservingApiKeys($dbValue, $value)
                    : $value;
            }
            // 其他情况直接使用前端的值
            else {
                $result[$key] = $value;
            }
        }

        // 前端未传的字段, 则数据库中字段为默认值 ''
        foreach ($dbConfig as $key => $value) {
            if (! array_key_exists($key, $result)) {
                $result[$key] = '';
            }
        }

        return $result;
    }
}
