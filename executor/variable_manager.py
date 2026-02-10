"""
变量管理器 - 负责变量的存储、提取和替换
"""
import re
from typing import Any, Dict, Optional, Union
from jsonpath_ng import parse
from models import ParamValue, ValueType
from runtime_functions import resolve_value_with_functions


class VariableManager:
    """变量管理器 - 管理测试执行过程中的变量"""
    
    def __init__(self, initial_variables: Optional[Dict[str, Any]] = None):
        """
        初始化变量管理器
        
        Args:
            initial_variables: 初始全局变量
        """
        self.variables: Dict[str, Any] = initial_variables or {}
        self.step_results: Dict[str, Dict[str, Any]] = {}
        self.current_step_id: Optional[str] = None  # 当前正在执行的步骤ID
    
    def set_variable(self, name: str, value: Any) -> None:
        """设置全局变量"""
        self.variables[name] = value
    
    def get_variable(self, name: str, default: Any = None) -> Any:
        """获取全局变量"""
        return self.variables.get(name, default)
    
    def set_step_result(self, step_id: str, result: Dict[str, Any]) -> None:
        """保存步骤执行结果"""
        self.step_results[step_id] = result
    
    def get_step_result(self, step_id: str) -> Optional[Dict[str, Any]]:
        """获取步骤执行结果"""
        return self.step_results.get(step_id)
    
    def extract_from_response(self, response_data: Any, json_path: str) -> Any:
        """
        从响应数据中提取值
        
        Args:
            response_data: 响应数据
            json_path: JSONPath 表达式，如 "data.token" 或 "$.data.token"
            
        Returns:
            提取的值
        """
        try:
            # 🔧 修复：智能转换数组访问语法
            # 将 "0.field" 或 "path.0.field" 格式转换为 "path[0].field"
            import re
            # 匹配模式：数字后面跟着点（作为路径分隔符）
            # 例如: "0.userId" -> "[0].userId", "data.0.name" -> "data[0].name"
            json_path = re.sub(r'(?:^|\.)(\d+)\.', r'[\1].', json_path)
            print(f"[变量提取] 原始路径转换后: {json_path}")
            
            # 如果不是以 $ 开头，自动添加
            if not json_path.startswith('$'):
                json_path = f'$.{json_path}'
            
            jsonpath_expr = parse(json_path)
            matches = jsonpath_expr.find(response_data)
            
            if matches:
                return matches[0].value
            return None
        except Exception as e:
            print(f"提取变量失败: {json_path}, 错误: {e}")
            return None
    
    def resolve_variable_path(self, path: str) -> Any:
        """
        解析变量路径并获取值
        
        支持的路径格式：
        - "variableName" - 全局变量
        - "step_1.response.data.token" - 步骤响应数据
        - "api_1234567890.response.data.token" - API节点响应数据
        - "current.response.message" - 当前步骤的响应数据
        - "step_login.request.body.username" - 步骤请求数据
        
        Args:
            path: 变量路径
            
        Returns:
            解析后的值
        """
        # 如果是全局变量
        if '.' not in path:
            return self.get_variable(path)
        
        # 解析路径
        parts = path.split('.')
        
        # 支持 current 关键字引用当前步骤
        if parts[0] == 'current' and self.current_step_id:
            print(f"[变量解析] 检测到 'current' 关键字，替换为当前步骤ID: {self.current_step_id}")
            parts[0] = self.current_step_id
            path = '.'.join(parts)
        
        # 检查是否是步骤引用（支持 step_ 或 api_ 等任意节点类型）
        # 如果第二部分是 'response' 或 'request'，则认为第一部分是节点ID
        potential_node_id = parts[0]
        if len(parts) >= 2 and parts[1] in ['response', 'request']:
            step_id = potential_node_id
            step_result = self.get_step_result(step_id)
            
            if not step_result:
                print(f"[变量] 未找到步骤结果: {step_id}")
                return None
            
            # 获取后续路径
            if len(parts) < 2:
                return None
            
            # 特殊处理 response 路径
            if parts[1] == 'response':
                response_data = step_result.get('response', {})
                
                print(f"[变量解析] ========== 开始解析 Response ==========")
                print(f"[变量解析] 完整路径: {path}")
                print(f"[变量解析] 步骤ID: {step_id}")
                print(f"[变量解析] step_result 类型: {type(step_result)}")
                print(f"[变量解析] step_result 内容: {step_result}")
                print(f"[变量解析] response_data 类型: {type(response_data)}")
                print(f"[变量解析] response_data 内容: {response_data}")
                
                if len(parts) == 2:
                    # 只是 "step_xxx.response"，返回整个响应
                    return response_data
                
                # 获取响应字段路径，如 "message" 或 "data.token"
                field_path = '.'.join(parts[2:])
                print(f"[变量解析] 字段路径: {field_path}")
                
                # 构建断言上下文（与断言执行时的逻辑一致）
                assertion_context = {
                    'status': response_data.get('status'),
                    'headers': response_data.get('headers', {})
                }
                
                # 如果响应体是字典，将其字段直接放到根层级
                body = response_data.get('body')
                print(f"[变量解析] body 类型: {type(body)}")
                print(f"[变量解析] body 内容: {body}")
                
                if isinstance(body, dict):
                    assertion_context.update(body)
                    assertion_context['body'] = body
                    print(f"[变量解析] body 是字典，已合并到上下文")
                elif isinstance(body, list):
                    # 🔧 修复：如果 body 是数组，需要特殊处理
                    # 1. 保存完整数组到 'body' 字段
                    assertion_context['body'] = body
                    # 2. 如果字段路径是纯数字开头（如 "0.field" 或 "[0].field"），
                    #    说明用户想直接访问数组，将数组提升到根层级
                    import re
                    if re.match(r'^[\[\d]', field_path):
                        # 字段路径直接访问数组索引，将数组放到根层级
                        print(f"[变量解析] body 是数组且字段路径直接访问数组，将数组提升到根层级")
                        # 直接在数组上提取
                        result = self.extract_from_response(body, field_path)
                        print(f"[变量解析] 提取结果: {result}")
                        print(f"[变量解析] ========== 解析结束 ==========\n")
                        return result
                    else:
                        print(f"[变量解析] body 是数组，但字段路径不是直接访问数组，需要用 'body' 前缀")
                else:
                    assertion_context['body'] = body
                    print(f"[变量解析] body 不是字典或数组，直接赋值")
                
                print(f"[变量解析] 最终 assertion_context: {assertion_context}")
                
                # 从上下文中提取值
                result = self.extract_from_response(assertion_context, field_path)
                print(f"[变量解析] 提取结果: {result}")
                print(f"[变量解析] ========== 解析结束 ==========\n")
                return result
            
            # 特殊处理 request 路径
            if parts[1] == 'request':
                request_data = step_result.get('request', {})
                
                print(f"[变量解析] ========== 开始解析 Request ==========")
                print(f"[变量解析] 完整路径: {path}")
                print(f"[变量解析] 步骤ID: {step_id}")
                print(f"[变量解析] request_data 类型: {type(request_data)}")
                print(f"[变量解析] request_data 内容: {request_data}")
                
                if len(parts) == 2:
                    # 只是 "step_xxx.request"，返回整个请求
                    return request_data
                
                # 获取请求字段路径，如 "body.name" 或 "headers.Authorization"
                field_path = '.'.join(parts[2:])
                print(f"[变量解析] 字段路径: {field_path}")
                
                # 构建请求上下文（与 response 逻辑类似）
                request_context = {
                    'method': request_data.get('method'),
                    'url': request_data.get('url'),
                    'headers': request_data.get('headers', {}),
                    'params': request_data.get('params', {})
                }
                
                # 如果有请求体，将其字段直接放到根层级（与 response.body 逻辑一致）
                body = request_data.get('json')  # 请求体在 'json' 字段中
                print(f"[变量解析] request body 类型: {type(body)}")
                print(f"[变量解析] request body 内容: {body}")
                
                if isinstance(body, dict):
                    request_context['body'] = body
                    # 也将 body 的字段提升到根层级，方便访问
                    # 但要避免覆盖已有字段
                    for key, value in body.items():
                        if key not in request_context:
                            request_context[key] = value
                    print(f"[变量解析] request body 是字典，已合并到上下文")
                else:
                    request_context['body'] = body
                    print(f"[变量解析] request body 不是字典，直接赋值")
                
                print(f"[变量解析] 最终 request_context: {request_context}")
                
                # 从上下文中提取值
                result = self.extract_from_response(request_context, field_path)
                print(f"[变量解析] 提取结果: {result}")
                print(f"[变量解析] ========== 解析结束 ==========\n")
                return result
            
            # 其他路径直接提取
            remaining_path = '.'.join(parts[1:])
            return self.extract_from_response(step_result, remaining_path)
        
        # 尝试作为全局变量的嵌套路径
        return self.extract_from_response(self.variables, path)
    
    def resolve_param_value(self, param: Union[ParamValue, Dict[str, Any]]) -> Any:
        """
        解析参数值
        
        Args:
            param: ParamValue 对象或字典
            
        Returns:
            解析后的实际值
        """
        # 如果是字典，转换为 ParamValue
        if isinstance(param, dict):
            param = ParamValue(**param)
        
        # 如果是固定值
        if param.valueType == ValueType.FIXED:
            value = param.value
            
            # 🔧 修复：如果 value 是字符串且看起来是 JSON，尝试解析它
            # 这是为了支持 AI 生成的数据，AI 会将复杂类型序列化为 JSON 字符串
            if isinstance(value, str) and value.strip():
                # 检查是否是 JSON 数组或对象
                stripped = value.strip()
                if (stripped.startswith('[') and stripped.endswith(']')) or \
                   (stripped.startswith('{') and stripped.endswith('}')):
                    try:
                        import json
                        parsed = json.loads(value)
                        print(f"[参数解析] 成功将 JSON 字符串解析为对象: {type(parsed)}")
                        return parsed
                    except json.JSONDecodeError as e:
                        print(f"[参数解析] JSON 解析失败，将作为普通字符串处理: {e}")
                        return value
            
            return value
        
        # 如果是变量引用
        if param.valueType == ValueType.VARIABLE and param.variable:
            value = self.resolve_variable_path(param.variable)
            
            # 如果有模板，进行替换
            if param.template:
                return self.apply_template(param.template, value)
            
            return value
        
        return None
    
    def apply_template(self, template: str, value: Any) -> str:
        """
        应用模板替换
        
        Args:
            template: 模板字符串，如 "Bearer {value}"
            value: 要替换的值
            
        Returns:
            替换后的字符串
        """
        return template.replace('{value}', str(value))
    
    def resolve_request_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        解析请求配置，替换所有变量
        
        Args:
            config: 请求配置对象
            
        Returns:
            解析后的配置
        """
        resolved = {}
        
        # 解析路径参数
        if 'pathParams' in config and config['pathParams']:
            resolved['pathParams'] = {
                key: resolve_value_with_functions(self.resolve_param_value(val))
                for key, val in config['pathParams'].items()
            }
        
        # 解析查询参数
        if 'queryParams' in config and config['queryParams']:
            resolved['queryParams'] = {
                key: resolve_value_with_functions(self.resolve_param_value(val))
                for key, val in config['queryParams'].items()
            }
        
        # 解析请求头
        if 'headers' in config and config['headers']:
            resolved['headers'] = {
                key: resolve_value_with_functions(self.resolve_param_value(val))
                for key, val in config['headers'].items()
            }
        
        # 解析请求体
        if 'body' in config and config['body']:
            resolved['body'] = self._resolve_body(config['body'])
        
        # 保留请求体内容类型
        if 'contentType' in config:
            resolved['contentType'] = config['contentType']
        
        return resolved
    
    def _resolve_body(self, body: Any) -> Any:
        """
        递归解析请求体
        
        Args:
            body: 请求体（可能是字典、列表或 ParamValue）
            
        Returns:
            解析后的请求体
        """
        if isinstance(body, dict):
            # 检查是否是 ParamValue 格式
            if 'valueType' in body and 'value' in body:
                # 这是 ParamValue，解析它
                resolved = self.resolve_param_value(body)
                print(f"[Body解析] ParamValue -> {type(resolved)}: {resolved if not isinstance(resolved, (dict, list)) or len(str(resolved)) < 100 else str(resolved)[:100] + '...'}")
                
                # 解析运行时函数（如果值中包含 ${{函数()}}）
                resolved = resolve_value_with_functions(resolved)
                print(f"[Body解析] 运行时函数解析后 -> {type(resolved)}: {resolved if not isinstance(resolved, (dict, list)) or len(str(resolved)) < 100 else str(resolved)[:100] + '...'}")
                
                return resolved
            
            # 普通字典，递归处理每个字段
            result = {}
            for key, val in body.items():
                result[key] = self._resolve_body(val)
            return result
        
        elif isinstance(body, list):
            # 递归处理列表中的每个元素
            return [self._resolve_body(item) for item in body]
        
        else:
            # 基本类型（string/number/boolean/null）
            # 也需要检查是否包含运行时函数
            resolved = resolve_value_with_functions(body)
            return resolved
    
    def replace_url_params(self, url: str, path_params: Dict[str, Any]) -> str:
        """
        替换 URL 中的路径参数
        
        Args:
            url: URL 模板，如 "https://api.example.com/users/{userId}"
            path_params: 路径参数字典
            
        Returns:
            替换后的 URL
        """
        for key, value in path_params.items():
            url = url.replace(f'{{{key}}}', str(value))
        return url
    
    def get_all_variables(self) -> Dict[str, Any]:
        """获取所有变量（包括全局变量和步骤结果）"""
        return {
            'variables': self.variables,
            'step_results': self.step_results
        }

