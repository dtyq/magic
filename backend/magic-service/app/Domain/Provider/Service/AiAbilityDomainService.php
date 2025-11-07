<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Repository\Facade\AiAbilityRepositoryInterface;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Exception;
use Hyperf\Contract\ConfigInterface;

/**
 * AI 能力领域服务.
 */
class AiAbilityDomainService
{
    public function __construct(
        private AiAbilityRepositoryInterface $aiAbilityRepository,
        private ConfigInterface $config,
    ) {
    }

    /**
     * 根据能力代码获取AI能力实体（用于运行时，不校验组织）.
     *
     * @param AiAbilityCode $code 能力代码
     * @return AiAbilityEntity AI能力实体
     * @throws Exception 当能力不存在或未启用时抛出异常
     */
    public function getByCode(MagicUserAuthorization $authorization, AiAbilityCode $code): AiAbilityEntity
    {
        $entity = $this->aiAbilityRepository->getByCode($authorization, $code);

        if ($entity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        return $entity;
    }

    /**
     * 获取所有AI能力列表.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @return array<AiAbilityEntity> AI能力实体列表
     */
    public function getAll(MagicUserAuthorization $authorization): array
    {
        return $this->aiAbilityRepository->getAll($authorization);
    }

    /**
     * 更新AI能力.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @param AiAbilityCode $code 能力代码
     * @param array $data 更新数据
     * @return bool 是否更新成功
     * @throws Exception 当能力不存在时抛出异常
     */
    public function updateByCode(MagicUserAuthorization $authorization, AiAbilityCode $code, array $data): bool
    {
        // 检查能力是否存在
        $entity = $this->aiAbilityRepository->getByCode($authorization, $code);
        if ($entity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::AI_ABILITY_NOT_FOUND);
        }

        if (empty($data)) {
            return true;
        }

        return $this->aiAbilityRepository->updateByCode($authorization, $code, $data);
    }

    /**
     * 初始化AI能力数据.
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @return int 初始化的数量
     */
    public function initializeAbilities(MagicUserAuthorization $authorization): int
    {
        $abilities = $this->config->get('ai_abilities.abilities', []);
        $organizationCode = $authorization->getOrganizationCode();
        $count = 0;

        foreach ($abilities as $abilityConfig) {
            // 检查数据库中是否已存在
            $code = AiAbilityCode::from($abilityConfig['code']);
            $existingEntity = $this->aiAbilityRepository->getByCode($authorization, $code);

            // 构建名称和描述（确保是多语言格式）
            $name = $abilityConfig['name'];
            if (is_string($name)) {
                $name = [
                    'zh_CN' => $name,
                    'en_US' => $name,
                ];
            }

            $description = $abilityConfig['description'];
            if (is_string($description)) {
                $description = [
                    'zh_CN' => $description,
                    'en_US' => $description,
                ];
            }

            if ($existingEntity === null) {
                // 不存在则创建
                $entity = new AiAbilityEntity();
                $entity->setCode($abilityConfig['code']);
                $entity->setOrganizationCode($organizationCode);
                $entity->setName($name);
                $entity->setDescription($description);
                $entity->setIcon($abilityConfig['icon'] ?? '');
                $entity->setSortOrder($abilityConfig['sort_order'] ?? 0);
                $entity->setStatus($abilityConfig['status'] ?? true);
                $entity->setConfig($abilityConfig['config'] ?? []);

                $this->aiAbilityRepository->save($entity);
                ++$count;
            }
        }

        return $count;
    }
}
