<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Application\Provider\DTO\AiAbilityDetailDTO;
use App\Application\Provider\DTO\AiAbilityListDTO;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Service\AiAbilityDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\Assembler\AiAbilityAssembler;
use App\Interfaces\Provider\DTO\UpdateAiAbilityRequest;
use Hyperf\Contract\TranslatorInterface;
use Throwable;

/**
 * AI能力应用服务.
 */
class AiAbilityAppService
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
    public function getList(MagicUserAuthorization $authorization): array
    {
        $locale = $this->translator->getLocale();
        $entities = $this->aiAbilityDomainService->getAll($authorization);

        return AiAbilityAssembler::entitiesToListDTOs($entities, $locale);
    }

    /**
     * 获取AI能力详情.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @param string $code 能力代码
     */
    public function getDetail(MagicUserAuthorization $authorization, string $code): AiAbilityDetailDTO
    {
        // 验证code是否有效
        try {
            $codeEnum = AiAbilityCode::from($code);
        } catch (Throwable $e) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        // 获取能力详情
        $entity = $this->aiAbilityDomainService->getByCode($authorization, $codeEnum);

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
            $updateData['config'] = $request->getConfig();
        }

        // 如果没有要更新的数据，直接返回成功
        if (empty($updateData)) {
            return true;
        }

        // 通过 DomainService 更新
        return $this->aiAbilityDomainService->updateByCode($authorization, $code, $updateData);
    }

    /**
     * 初始化AI能力数据（从配置文件同步到数据库）.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @return int 初始化的数量
     */
    public function initializeAbilities(MagicUserAuthorization $authorization): int
    {
        return $this->aiAbilityDomainService->initializeAbilities($authorization);
    }
}
