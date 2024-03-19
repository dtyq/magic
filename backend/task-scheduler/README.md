# dtyq/task-scheduler

## 安装
```
composer require dtyq/task-scheduler
php bin/hyperf.php vendor:publish dtyq/task-scheduler
```

## 使用方式请见
```
\Dtyq\TaskScheduler\Service\TaskSchedulerDomainService
```

## 说明
> 仅支持分钟级调用

调度方式
1. 定时调度
2. 指定调度

创建调度任务
1. 定时调度需要有个定时器去生成未来 n 小时内的需要执行的任务数据
2. 根据任务时间生成调度任务

执行任务
1. 执行已到时间的任务，改变状态，如果有误则执行报错事件
2. 调度结束后，记录到归档表

后台执行
1. 每天检测超过 n 天已完成的调度任务，删除。防止调度表过大
2. 每分钟检测未来 n 天内需要执行的任务，生成调度任务
3. 每分钟检测已到时间的任务，执行

数据库
1. 任务调度表(task_scheduler) 用于具体执行的任务记录
2. 任务归档表(task_scheduler_log) 用于保存已完成的任务记录，仅做归档，方便以后回档查看历史记录
3. 定时任务表(task_scheduler_crontab) 用于保存定时任务规则

## 记得创建表结构
```shell
php bin/hyperf.php migrate
```

```sql
-- auto-generated definition
create table task_scheduler
(
    id              bigint unsigned         not null primary key,
    external_id     varchar(64)             not null comment '业务 id',
    name            varchar(64)             not null comment '名称',
    expect_time     datetime                not null comment '预期执行时间',
    actual_time     datetime                null comment '实际执行时间',
    type            tinyint      default 2  not null comment '调度类型：1 定时调度，2 指定调度',
    cost_time       int          default 0  not null comment '耗时 毫秒',
    retry_times     int          default 0  not null comment '剩余重试次数',
    status          tinyint      default 0  not null comment '状态',
    callback_method json                    not null comment '回调方法',
    callback_params json                    not null comment '回调参数',
    remark          varchar(255) default '' not null comment '备注',
    creator         varchar(64)  default '' not null comment '创建人',
    created_at      datetime                not null comment '创建时间'
)
    collate = utf8mb4_unicode_ci;

create index task_scheduler_external_id_index
    on task_scheduler (external_id);

create index task_scheduler_status_expect_time_index
    on task_scheduler (status, expect_time);

-- auto-generated definition
create table task_scheduler_crontab
(
    id              bigint unsigned         not null primary key,
    name            varchar(64)             not null comment '名称',
    crontab         varchar(64)             not null comment 'crontab表达式',
    last_gen_time   datetime                null comment '最后生成时间',
    enabled         tinyint(1)   default 1  not null comment '是否启用',
    retry_times     int          default 0  not null comment '总重试次数',
    callback_method json                    not null comment '回调方法',
    callback_params json                    not null comment '回调参数',
    remark          varchar(255) default '' not null comment '备注',
    creator         varchar(64)  default '' not null comment '创建人',
    created_at      datetime                not null comment '创建时间'
)
    collate = utf8mb4_unicode_ci;



-- auto-generated definition
-- auto-generated definition
create table task_scheduler_log
(
    id              bigint unsigned         not null primary key,
    task_id         bigint unsigned         not null comment '任务ID',
    external_id     varchar(64)             not null comment '业务标识',
    name            varchar(64)             not null comment '名称',
    expect_time     datetime                not null comment '预期执行时间',
    actual_time     datetime                null comment '实际执行时间',
    type            tinyint      default 2  not null comment '类型',
    cost_time       int          default 0  not null comment '耗时',
    status          tinyint      default 0  not null comment '状态',
    callback_method json                    not null comment '回调方法',
    callback_params json                    not null comment '回调参数',
    remark          varchar(255) default '' not null comment '备注',
    creator         varchar(64)  default '' not null comment '创建人',
    created_at      datetime                not null comment '创建时间',
    result          json                    null comment '结果'
)
    collate = utf8mb4_unicode_ci;

create index task_scheduler_log_external_id_index
    on task_scheduler_log (external_id);

create index task_scheduler_log_status_expect_time_index
    on task_scheduler_log (status, expect_time);

create index task_scheduler_log_task_id_index
    on task_scheduler_log (task_id);
```
