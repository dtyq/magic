<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Facade;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;

interface SuperMagicAgentRepositoryInterface
{
    public function getByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?SuperMagicAgentEntity;

    public function getUserAgentByVersionCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?SuperMagicAgentEntity;

    /**
     * @return array{total: int, list: array<SuperMagicAgentEntity>}
     */
    public function queries(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentQuery $query, Page $page): array;

    /**
     * 保存SuperMagic Agent.
     */
    public function save(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentEntity $entity): SuperMagicAgentEntity;

    /**
     * 删除SuperMagic Agent.
     */
    public function delete(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool;

    /**
     * 统计指定创建者的智能体数量.
     */
    public function countByCreator(SuperMagicAgentDataIsolation $dataIsolation, string $creator): int;

    /**
     * 获取指定创建者的智能体编码列表.
     * @return array<string>
     */
    public function getCodesByCreator(SuperMagicAgentDataIsolation $dataIsolation, string $creator): array;

    /**
     * 检查 code 是否已存在.
     */
    public function codeExists(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool;

    /**
     * 根据 version_code 列表查询用户已添加的 Agent（用于判断 is_added 和 need_upgrade）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $userId 用户ID
     * @param string[] $versionCodes version_code 列表
     * @return array<string, SuperMagicAgentEntity> Agent 实体数组，key 为 version_code
     */
    public function findByVersionCodes(SuperMagicAgentDataIsolation $dataIsolation, string $userId, array $versionCodes): array;

    /**
     * 根据 code 更新 Agent 的 updated_at 时间.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @param string $code Agent code
     * @param string $modifier 修改者
     * @return bool 是否更新成功
     */
    public function updateUpdatedAtByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code, string $modifier): bool;
}
