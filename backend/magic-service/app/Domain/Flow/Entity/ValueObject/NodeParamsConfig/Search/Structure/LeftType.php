<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Search\Structure;

enum LeftType: string
{
    // 人员
    case Username = 'username';
    case WorkNumber = 'work_number';
    case Position = 'position';
    case Phone = 'phone';
    case DepartmentName = 'department_name';
    case GroupName = 'group_name';

    // 向量数据库
    case VectorDatabaseId = 'vector_database_id';
    case VectorDatabaseName = 'vector_database_name';
}
