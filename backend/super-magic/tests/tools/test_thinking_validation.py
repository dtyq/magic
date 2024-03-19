#!/usr/bin/env python3
"""
Test script for thinking tool parameter validation logic
"""

import json
from typing import List, Dict
from pydantic import BaseModel, Field, field_validator

# Mock BaseToolParams for testing
class MockBaseToolParams(BaseModel):
    explanation: str = Field("", description="思考的解释")

class TestThinkingParams(MockBaseToolParams):
    """Test version of ThinkingParams to validate the validation logic"""
    problem: str = Field(..., description="需要思考的问题或挑战")
    thinking: str = Field(..., description="对问题的思考过程和分析")
    steps: str = Field(..., description="思考的步骤列表，JSON格式字符串")
    target: str = Field(..., description="思考的目标结果")

    @field_validator('steps', mode='before')
    @classmethod
    def validate_steps(cls, v):
        """验证并转换steps参数，支持JSON字符串格式"""
        if isinstance(v, str):
            try:
                # 尝试解析JSON字符串
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    # 验证每个步骤都有title和content字段
                    for i, step in enumerate(parsed):
                        if not isinstance(step, dict):
                            raise ValueError(f"步骤{i+1}必须是对象格式")
                        if 'title' not in step or 'content' not in step:
                            raise ValueError(f"步骤{i+1}必须包含title和content字段")
                    return v  # 返回原始字符串，保持简单
                else:
                    raise ValueError("steps参数解析后不是列表格式")
            except json.JSONDecodeError as e:
                raise ValueError(f"steps参数不是有效的JSON格式: {e}")
        elif isinstance(v, list):
            # 如果是Python列表，转换为JSON字符串
            try:
                # 验证列表格式
                for i, step in enumerate(v):
                    if not isinstance(step, dict):
                        raise ValueError(f"步骤{i+1}必须是对象格式")
                    if 'title' not in step or 'content' not in step:
                        raise ValueError(f"步骤{i+1}必须包含title和content字段")
                return json.dumps(v, ensure_ascii=False)
            except Exception as e:
                raise ValueError(f"steps列表格式错误: {e}")
        else:
            raise ValueError(f"steps参数必须是字符串或列表，当前类型: {type(v)}")

def test_thinking_params():
    """Test the ThinkingParams validation"""

    print("Testing ThinkingParams validation...")

    # Test 1: JSON string format
    print("\n1. Testing JSON string format:")
    test_steps_json = '[{"title": "步骤1", "content": "测试内容"}]'
    test_params = {
        'problem': '测试问题',
        'thinking': '测试思考',
        'steps': test_steps_json,
        'target': '测试目标'
    }

    try:
        params = TestThinkingParams(**test_params)
        print('✅ 测试通过: JSON字符串被正确解析')
        print(f'steps类型: {type(params.steps)}')
        print(f'steps内容: {params.steps}')
        # 验证steps是字符串类型
        if isinstance(params.steps, str):
            parsed_steps = json.loads(params.steps)
            print(f'解析后steps类型: {type(parsed_steps)}')
            print(f'解析后steps内容: {parsed_steps}')
    except Exception as e:
        print(f'❌ 测试失败: {e}')

    # Test 2: Python list format
    print("\n2. Testing Python list format:")
    test_params_list = {
        'problem': '测试问题',
        'thinking': '测试思考',
        'steps': [{'title': '步骤1', 'content': '测试内容'}],
        'target': '测试目标'
    }

    try:
        params = TestThinkingParams(**test_params_list)
        print('✅ 测试通过: Python列表被正确处理')
        print(f'steps类型: {type(params.steps)}')
        print(f'steps内容: {params.steps}')
        # 验证steps被转换为字符串
        if isinstance(params.steps, str):
            parsed_steps = json.loads(params.steps)
            print(f'解析后steps类型: {type(parsed_steps)}')
            print(f'解析后steps内容: {parsed_steps}')
    except Exception as e:
        print(f'❌ 测试失败: {e}')

    # Test 3: Invalid JSON string
    print("\n3. Testing invalid JSON string:")
    test_params_invalid = {
        'problem': '测试问题',
        'thinking': '测试思考',
        'steps': '[{"title": "步骤1", "content": "测试内容"',  # Invalid JSON
        'target': '测试目标'
    }

    try:
        params = TestThinkingParams(**test_params_invalid)
        print('❌ 测试失败: 应该抛出异常但没有')
    except Exception as e:
        print(f'✅ 测试通过: 正确捕获了无效JSON错误: {e}')

    # Test 4: Wrong type
    print("\n4. Testing wrong type:")
    test_params_wrong_type = {
        'problem': '测试问题',
        'thinking': '测试思考',
        'steps': 123,  # Wrong type
        'target': '测试目标'
    }

    try:
        params = TestThinkingParams(**test_params_wrong_type)
        print('❌ 测试失败: 应该抛出异常但没有')
    except Exception as e:
        print(f'✅ 测试通过: 正确捕获了类型错误: {e}')

    # Test 5: Complex JSON string (like the one from the error)
    print("\n5. Testing complex JSON string:")
    complex_steps_json = '''[
  {
    "title": "识别会议参与者和角色",
    "content": "从转录内容来看，会议中有多名参与者，但他们在转录中被标记为\\"发言人-1\\"、\\"发言人-2\\"等，没有明确的姓名和角色。根据内容可以推断：\\\\n\\\\n发言人-1: 似乎是主要讲解者，详细介绍了当前系统流程和问题\\\\n发言人-3: 似乎是技术人员或开发人员，询问了很多关于系统实现的问题\\\\n发言人-4 和发言人-5: 也参与了技术讨论，可能是技术团队成员\\\\n发言人-2: 较少发言，可能是会议参与者或记录者\\\\n\\\\n会议似乎是内部的业务部门(可能是品牌部或商品管理部)与技术部门之间的讨论会议。"
  }
]'''

    test_params_complex = {
        'problem': '测试问题',
        'thinking': '测试思考',
        'steps': complex_steps_json,
        'target': '测试目标'
    }

    try:
        params = TestThinkingParams(**test_params_complex)
        print('✅ 测试通过: 复杂JSON字符串被正确解析')
        print(f'steps类型: {type(params.steps)}')
        print(f'steps长度: {len(params.steps)}')
        # 解析steps字符串来获取内容
        parsed_steps = json.loads(params.steps)
        print(f'解析后steps长度: {len(parsed_steps)}')
        print(f'第一个步骤标题: {parsed_steps[0]["title"]}')
    except Exception as e:
        print(f'❌ 测试失败: {e}')

    # Test 6: Actual steps content from the error log
    print("\n6. Testing actual steps content from error log:")
    actual_steps_json = '''[
  {
    "title": "识别会议参与者和角色",
    "content": "从转录内容来看，会议中有多名参与者，但他们在转录中被标记为\\"发言人-1\\"、\\"发言人-2\\"等，没有明确的姓名和角色。根据内容可以推断：\\\\n\\\\n发言人-1: 似乎是主要讲解者，详细介绍了当前系统流程和问题\\\\n发言人-3: 似乎是技术人员或开发人员，询问了很多关于系统实现的问题\\\\n发言人-4 和发言人-5: 也参与了技术讨论，可能是技术团队成员\\\\n发言人-2: 较少发言，可能是会议参与者或记录者\\\\n\\\\n会议似乎是内部的业务部门(可能是品牌部或商品管理部)与技术部门之间的讨论会议。"
  },
  {
    "title": "确定会议的主要议题",
    "content": "会议的主要议题是关于内部活动提报和货补管理流程的优化。具体包括：\\\\n\\\\n1. 当前活动提报流程的问题和痛点\\\\n2. 货补计算和管理的效率问题\\\\n3. 多个表格之间数据不同步、重复填写的问题\\\\n4. 提出通过系统改进来解决这些问题的方案\\\\n5. 讨论系统实现的技术可行性和优先级\\\\n\\\\n会议重点关注如何将目前分散在多个Excel表格中的信息整合到一个系统中，实现自动化计算和流程管理，特别是货补计算这部分功能。"
  }
]'''

    test_params_actual = {
        'problem': '如何从总部会议录音转录内容中提取关键信息，并形成结构化的会议纪要？',
        'thinking': '这是一段关于内部系统改进的会议录音转录内容。会议主要讨论了当前活动提报和货补管理流程中存在的问题，以及如何通过系统改进来解决这些问题。',
        'steps': actual_steps_json,
        'target': '基于对会议录音转录内容的分析，我将生成一份结构化的会议纪要'
    }

    try:
        params = TestThinkingParams(**test_params_actual)
        print('✅ 测试通过: 实际错误日志中的steps内容被正确解析')
        print(f'steps类型: {type(params.steps)}')
        print(f'steps长度: {len(params.steps)}')
        # 解析steps字符串来获取内容
        parsed_steps = json.loads(params.steps)
        print(f'解析后steps长度: {len(parsed_steps)}')
        for i, step in enumerate(parsed_steps):
            print(f'步骤{i+1}标题: {step["title"]}')
    except Exception as e:
        print(f'❌ 测试失败: {e}')

    # Test 7: Reproduce the actual error from the log
    print("\n7. Testing the exact error from the log:")
    error_log_steps_json = '''[
  {
    "title": "会议记录基本结构设计",
    "content": "一个完整的会议记录应包含以下几个主要部分：\\n1. 会议基本信息：包括会议标题、时间、地点、参会人员、主持人等\\n2. 会议议程概述：简要列出会议的主要议题和目的\\n3. 会议讨论内容：按议题或时间顺序记录主要讨论内容\\n4. 决策事项和行动计划：明确列出会议达成的决策和后续行动项\\n5. 会议总结：对会议的整体评价和关键点总结"
  },
  {
    "title": "应用四环方法论",
    "content": "根据四环方法论（先问目的、再做推演、及时复盘、亲手打样），会议记录可以按照以下结构组织：\\n1. 会议目的部分：明确说明为什么要召开这次会议，希望解决什么问题\\n2. 推演部分：记录会议中对问题的分析、对未来的预测和规划\\n3. 复盘部分：总结过往工作中的成功经验和存在问题\\n4. 具体安排部分：详细列出后续的行动计划、责任人和时间节点"
  },
  {
    "title": "信息展示方式",
    "content": "为了使会议记录更加清晰易读，可以采用以下展示方式：\\n1. 使用Markdown格式进行排版，包括标题层级、列表、表格等\\n2. 对于决策事项和行动计划，使用表格形式清晰展示责任人和截止日期\\n3. 对于复杂的讨论内容，可以使用缩进或引用格式区分不同发言人的观点\\n4. 使用加粗、斜体等格式强调重要内容和关键决策\\n5. 可以使用图标（如✅、⚠️、📌等）标注不同类型的信息"
  },
  {
    "title": "会议记录模板设计",
    "content": "基于以上考虑，设计一个会议记录模板，包含以下部分：\\n\\n# 会议标题\\n\\n## 会议基本信息\\n- **时间**：[日期和时间]\\n- **地点**：[会议地点]\\n- **主持人**：[主持人姓名]\\n- **参会人员**：[参会人员名单]\\n- **会议记录人**：[记录人姓名]\\n\\n## 会议目的\\n[简要说明会议召开的目的和预期达成的目标]\\n\\n## 议题讨论\\n### 议题一：[议题名称]\\n- **背景**：[议题背景介绍]\\n- **讨论要点**：\\n  1. [讨论要点1]\\n  2. [讨论要点2]\\n  ...\\n- **结论/决策**：[该议题的结论或决策]\\n\\n[重复上述结构，列出所有议题的讨论内容]\\n\\n## 行动计划\\n| 行动项 | 责任人 | 截止日期 | 状态 |\\n|-------|------|--------|------|\\n| [行动项1] | [责任人] | [日期] | 待执行 |\\n| [行动项2] | [责任人] | [日期] | 待执行 |\\n\\n## 会议总结\\n[对会议的整体评价和关键点总结]"
  }
]'''

    test_params_error_log = {
        'problem': '如何构建一个结构清晰、信息完整的会议记录格式，能够有效呈现会议的核心内容和决策事项？',
        'thinking': '会议记录需要清晰地呈现会议的基本信息、讨论内容和决策事项，同时要便于阅读和后续跟进。我需要考虑如何组织这些信息，使其结构合理、重点突出。',
        'steps': error_log_steps_json,
        'target': '基于对会议录音转录内容的分析，我将生成一份结构化的会议纪要'
    }

    try:
        params = TestThinkingParams(**test_params_error_log)
        print('✅ 测试通过: 错误日志中的steps内容被正确解析')
        print(f'steps类型: {type(params.steps)}')
        print(f'steps长度: {len(params.steps)}')
        # 解析steps字符串来获取内容
        parsed_steps = json.loads(params.steps)
        print(f'解析后steps长度: {len(parsed_steps)}')
        for i, step in enumerate(parsed_steps):
            print(f'步骤{i+1}标题: {step["title"]}')
    except Exception as e:
        print(f'❌ 测试失败: {e}')
        # 尝试直接解析JSON来调试
        try:
            parsed = json.loads(error_log_steps_json)
            print('直接JSON解析成功')
        except json.JSONDecodeError as je:
            print(f'直接JSON解析失败: {je}')
            print(f'错误位置: 第{je.lineno}行，第{je.colno}列，字符位置{je.pos}')
            # 显示错误位置附近的内容
            lines = error_log_steps_json.split('\n')
            if je.lineno <= len(lines):
                print(f'第{je.lineno}行内容: {repr(lines[je.lineno-1])}')
                if je.lineno > 1:
                    print(f'第{je.lineno-1}行内容: {repr(lines[je.lineno-2])}')
                if je.lineno < len(lines):
                    print(f'第{je.lineno+1}行内容: {repr(lines[je.lineno])}')

    # Test 8: Simulate the exact parameter parsing issue from error log
    print("\n8. Testing parameter parsing with explanation field:")
    # 模拟错误日志中的参数
    error_log_params = {
        'explanation': '我将思考如何构建一个高质量的会议记录格式，以便后续创建会议记录文件。',
        'problem': '如何构建一个结构清晰、信息完整的会议记录格式，能够有效呈现会议的核心内容和决策事项？',
        'thinking': '会议记录需要清晰地呈现会议的基本信息、讨论内容和决策事项，同时要便于阅读和后续跟进。我需要考虑如何组织这些信息，使其结构合理、重点突出。',
        'steps': '''[
  {
    "title": "会议记录基本结构设计",
    "content": "一个完整的会议记录应包含以下几个主要部分：\\n1. 会议基本信息：包括会议标题、时间、地点、参会人员、主持人等\\n2. 会议议程概述：简要列出会议的主要议题和目的\\n3. 会议讨论内容：按议题或时间顺序记录主要讨论内容\\n4. 决策事项和行动计划：明确列出会议达成的决策和后续行动项\\n5. 会议总结：对会议的整体评价和关键点总结"
  },
  {
    "title": "应用四环方法论",
    "content": "根据四环方法论（先问目的、再做推演、及时复盘、亲手打样），会议记录可以按照以下结构组织：\\n1. 会议目的部分：明确说明为什么要召开这次会议，希望解决什么问题\\n2. 推演部分：记录会议中对问题的分析、对未来的预测和规划\\n3. 复盘部分：总结过往工作中的成功经验和存在问题\\n4. 具体安排部分：详细列出后续的行动计划、责任人和时间节点"
  },
  {
    "title": "信息展示方式",
    "content": "为了使会议记录更加清晰易读，可以采用以下展示方式：\\n1. 使用Markdown格式进行排版，包括标题层级、列表、表格等\\n2. 对于决策事项和行动计划，使用表格形式清晰展示责任人和截止日期\\n3. 对于复杂的讨论内容，可以使用缩进或引用格式区分不同发言人的观点\\n4. 使用加粗、斜体等格式强调重要内容和关键决策\\n5. 可以使用图标（如✅、⚠️、📌等）标注不同类型的信息"
  },
  {
    "title": "会议记录模板设计",
    "content": "基于以上考虑，设计一个会议记录模板，包含以下部分：\\n\\n# 会议标题\\n\\n## 会议基本信息\\n- **时间**：[日期和时间]\\n- **地点**：[会议地点]\\n- **主持人**：[主持人姓名]\\n- **参会人员**：[参会人员名单]\\n- **会议记录人**：[记录人姓名]\\n\\n## 会议目的\\n[简要说明会议召开的目的和预期达成的目标]\\n\\n## 议题讨论\\n### 议题一：[议题名称]\\n- **背景**：[议题背景介绍]\\n- **讨论要点**：\\n  1. [讨论要点1]\\n  2. [讨论要点2]\\n  ...\\n- **结论/决策**：[该议题的结论或决策]\\n\\n[重复上述结构，列出所有议题的讨论内容]\\n\\n## 行动计划\\n| 行动项 | 责任人 | 截止日期 | 状态 |\\n|-------|------|--------|------|\\n| [行动项1] | [责任人] | [日期] | 待执行 |\\n| [行动项2] | [责任人] | [日期] | 待执行 |\\n\\n## 会议总结\\n[对会议的整体评价和关键点总结]"
  }
]''',
        'target': '创建一个结构清晰、信息完整的会议记录模板，能够有效呈现会议的核心内容和决策事项，便于后续跟进和执行。'
    }

    try:
        # 先测试JSON解析
        print("Testing JSON parsing first:")
        steps_json = error_log_params['steps']
        parsed_steps = json.loads(steps_json)
        print(f'✅ JSON解析成功，长度: {len(parsed_steps)}')

        # 测试参数模型
        print("Testing parameter model:")
        params = TestThinkingParams(**error_log_params)
        print('✅ 参数模型验证成功')
        print(f'explanation: {params.explanation}')
        print(f'problem: {params.problem}')
        print(f'thinking: {params.thinking}')
        print(f'target: {params.target}')
        print(f'steps类型: {type(params.steps)}')
        print(f'steps长度: {len(params.steps)}')

    except Exception as e:
        print(f'❌ 测试失败: {e}')
        # 详细分析错误
        if 'target' in str(e):
            print("问题可能是target参数为None")
        if 'steps' in str(e):
            print("问题可能是steps参数解析失败")
            # 尝试单独解析steps
            try:
                parsed = json.loads(error_log_params['steps'])
                print("单独解析steps成功")
            except json.JSONDecodeError as je:
                print(f"单独解析steps失败: {je}")
                print(f"错误位置: 第{je.lineno}行，第{je.colno}列，字符位置{je.pos}")
                # 显示错误位置附近的内容
                lines = error_log_params['steps'].split('\n')
                if je.lineno <= len(lines):
                    print(f"第{je.lineno}行内容: {repr(lines[je.lineno-1])}")
                    if je.lineno > 1:
                        print(f"第{je.lineno-1}行内容: {repr(lines[je.lineno-2])}")
                    if je.lineno < len(lines):
                        print(f"第{je.lineno+1}行内容: {repr(lines[je.lineno])}")

if __name__ == "__main__":
    test_thinking_params()
