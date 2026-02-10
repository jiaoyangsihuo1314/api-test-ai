"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  PlayCircle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Tag,
  FolderOpen,
  X,
  Copy,
  ChevronRight,
  ChevronDown,
  Layers,
  Box,
  Grid,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TestCase {
  id: string;
  name: string;
  description?: string;
  status: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  executeCount: number;
  successCount: number;
  failCount: number;
  steps: any[];
  flowConfig: any;
}

interface TestCaseListProps {
  testCases: TestCase[];
  onCreateNew: () => void;
  onEdit: (testCase: TestCase) => void;
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onCopy?: (id: string) => void;
  onExecute?: (id: string) => void;
}

export default function TestCaseList({
  testCases,
  onCreateNew,
  onEdit,
  onDelete,
  onBatchDelete,
  onCopy,
  onExecute,
}: TestCaseListProps) {
  const t = useTranslations('testCaseList');
  const tCommon = useTranslations('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  
  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  
  // API仓库分类相关状态
  const [apiCategories, setApiCategories] = useState<any[]>([]);
  const [allApis, setAllApis] = useState<any[]>([]);
  const [selectedApiCategories, setSelectedApiCategories] = useState<Set<string>>(new Set()); // 存储选中的分类路径
  const [apiCategoryPopoverOpen, setApiCategoryPopoverOpen] = useState(false);
  const [expandedApiNodes, setExpandedApiNodes] = useState<Set<string>>(new Set());
  
  // 辅助函数：解析标签（处理可能的JSON字符串）
  const parseTags = (tags: any): string[] => {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
      try {
        const parsed = JSON.parse(tags);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // 获取所有标签
  const allTags = Array.from(new Set(testCases.flatMap(tc => parseTags(tc.tags))));

  // 构建API分类树结构
  const buildApiCategoryTree = () => {
    interface TreeNode {
      type: 'platform' | 'component' | 'feature';
      name: string;
      count: number;
      children?: TreeNode[];
      fullPath: {
        platform?: string;
        component?: string;
        feature?: string;
      };
    }

    const tree: TreeNode[] = [];
    const platformMap = new Map<string, TreeNode>();
    const DEFAULT_PLATFORM = '未分类平台';
    const DEFAULT_COMPONENT = '未分类组件';
    const DEFAULT_FEATURE = '未分类功能';

    // 从分类结构创建树的骨架
    apiCategories.forEach((classification: any) => {
      const { platform, component, feature } = classification;
      if (!platform) return;

      if (!platformMap.has(platform)) {
        const platformNode: TreeNode = {
          type: 'platform',
          name: platform,
          count: 0,
          children: [],
          fullPath: { platform },
        };
        platformMap.set(platform, platformNode);
        tree.push(platformNode);
      }
      const platformNode = platformMap.get(platform)!;

      if (component) {
        let componentNode = platformNode.children?.find(
          (n) => n.name === component && n.type === 'component'
        );
        if (!componentNode) {
          componentNode = {
            type: 'component',
            name: component,
            count: 0,
            children: [],
            fullPath: { platform, component },
          };
          platformNode.children!.push(componentNode);
        }

        if (feature) {
          let featureNode = componentNode.children?.find(
            (n) => n.name === feature && n.type === 'feature'
          );
          if (!featureNode) {
            featureNode = {
              type: 'feature',
              name: feature,
              count: 0,
              fullPath: { platform, component, feature },
            };
            componentNode.children!.push(featureNode);
          }
        }
      }
    });

    // 从API统计数量并补充未预定义的分类
    allApis.forEach((api: any) => {
      const platform = api.platform || DEFAULT_PLATFORM;
      const component = api.component || DEFAULT_COMPONENT;
      const feature = api.feature || DEFAULT_FEATURE;

      if (!platformMap.has(platform)) {
        const platformNode: TreeNode = {
          type: 'platform',
          name: platform,
          count: 0,
          children: [],
          fullPath: { platform },
        };
        platformMap.set(platform, platformNode);
        tree.push(platformNode);
      }
      const platformNode = platformMap.get(platform)!;
      platformNode.count++;

      let componentNode = platformNode.children?.find(
        (n) => n.name === component && n.type === 'component'
      );
      if (!componentNode) {
        componentNode = {
          type: 'component',
          name: component,
          count: 0,
          children: [],
          fullPath: { platform, component },
        };
        platformNode.children!.push(componentNode);
      }
      componentNode.count++;

      let featureNode = componentNode.children?.find(
        (n) => n.name === feature && n.type === 'feature'
      );
      if (!featureNode) {
        featureNode = {
          type: 'feature',
          name: feature,
          count: 0,
          fullPath: { platform, component, feature },
        };
        componentNode.children!.push(featureNode);
      }
      featureNode.count++;
    });

    // 排序
    tree.sort((a, b) => a.name.localeCompare(b.name));
    tree.forEach((platform) => {
      platform.children?.sort((a, b) => a.name.localeCompare(b.name));
      platform.children?.forEach((component) => {
        component.children?.sort((a, b) => a.name.localeCompare(b.name));
      });
    });

    return tree;
  };

  const apiCategoryTree = buildApiCategoryTree();

  // 生成节点唯一键
  const getApiNodeKey = (node: any): string => {
    const { platform, component, feature } = node.fullPath;
    return [platform, component, feature].filter(Boolean).join('/');
  };

  // 切换节点展开/折叠
  const toggleApiNode = (nodeKey: string) => {
    setExpandedApiNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  };

  // 生成分类路径键
  const getCategoryKey = (node: any): string => {
    const { platform, component, feature } = node.fullPath;
    return [platform, component, feature].filter(Boolean).join(' / ');
  };

  // 获取节点的所有子节点（递归）
  const getAllDescendantKeys = (node: any): string[] => {
    const keys: string[] = [];
    const categoryKey = getCategoryKey(node);
    keys.push(categoryKey);
    
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        keys.push(...getAllDescendantKeys(child));
      }
    }
    
    return keys;
  };

  // 检查节点是否选中（包括级联逻辑：如果所有子节点都选中，父节点也显示为选中）
  const isApiNodeSelected = (node: any): boolean => {
    const categoryKey = getCategoryKey(node);
    const directSelected = selectedApiCategories.has(categoryKey);
    
    // 如果有子节点，根据子节点状态决定父节点显示
    if (node.children && node.children.length > 0) {
      const childrenState = getChildrenState(node);
      // 如果所有子节点都选中，父节点也显示为选中
      if (childrenState.all) {
        return true;
      }
      // 如果所有子节点都未选中，父节点显示为未选中（即使父节点本身被直接选中）
      if (childrenState.none) {
        return false;
      }
      // 部分子节点选中时，如果父节点本身被直接选中，显示为选中；否则显示为半选（在renderApiTreeNode中处理）
      return directSelected;
    }
    
    // 没有子节点时，直接返回是否被选中
    return directSelected;
  };

  // 检查节点的直接子节点的直接选中状态（不考虑级联）
  const isChildDirectlySelected = (child: any): boolean => {
    const categoryKey = getCategoryKey(child);
    return selectedApiCategories.has(categoryKey);
  };

  // 检查节点的子节点状态：返回 { all: boolean, some: boolean, none: boolean }
  const getChildrenState = (node: any): { all: boolean; some: boolean; none: boolean } => {
    if (!node.children || node.children.length === 0) {
      return { all: false, some: false, none: true };
    }

    let selectedCount = 0;
    for (const child of node.children) {
      // 检查子节点的直接选中状态，以及子节点的所有子节点是否都选中
      const childDirectlySelected = isChildDirectlySelected(child);
      let childFullySelected = childDirectlySelected;
      
      // 如果子节点有子节点，检查是否所有子节点的子节点都选中
      if (child.children && child.children.length > 0) {
        const grandChildrenState = getChildrenState(child);
        if (grandChildrenState.all) {
          childFullySelected = true;
        }
      }
      
      if (childFullySelected) {
        selectedCount++;
      }
    }

    const all = selectedCount === node.children.length;
    const none = selectedCount === 0;
    const some = selectedCount > 0 && selectedCount < node.children.length;

    return { all, some, none };
  };

  // 检查节点是否应该显示半选状态
  const isApiNodeIndeterminate = (node: any): boolean => {
    if (!node.children || node.children.length === 0) {
      return false;
    }
    const { some } = getChildrenState(node);
    return some;
  };

  // 选择/取消选择API分类节点（支持级联）
  const handleToggleApiCategory = (node: any) => {
    const categoryKey = getCategoryKey(node);
    const directSelected = selectedApiCategories.has(categoryKey);
    
    // 检查所有子节点是否都选中
    let allChildrenSelected = false;
    if (node.children && node.children.length > 0) {
      const childrenState = getChildrenState(node);
      allChildrenSelected = childrenState.all;
    }
    
    // 如果所有子节点都选中，或者节点本身已选中，则取消选择
    const shouldDeselect = directSelected || allChildrenSelected;
    
    setSelectedApiCategories((prev) => {
      const next = new Set(prev);
      
      if (shouldDeselect) {
        // 取消选择：移除当前节点及其所有子节点
        const allKeys = getAllDescendantKeys(node);
        allKeys.forEach(key => next.delete(key));
      } else {
        // 选择：添加当前节点及其所有子节点
        const allKeys = getAllDescendantKeys(node);
        allKeys.forEach(key => next.add(key));
      }
      
      // 如果清空后没有任何选中项，确保返回空Set
      if (next.size === 0) {
        return new Set();
      }
      
      return next;
    });
  };

  // 获取选中的API分类显示文本
  const getApiCategoryDisplayText = (): string => {
    // 确保当没有选中任何分类时，显示"全部分类"
    if (!selectedApiCategories || selectedApiCategories.size === 0) {
      return '全部分类';
    }
    
    // 过滤掉空字符串或无效的分类
    const validCategories = Array.from(selectedApiCategories).filter(cat => cat && cat.trim().length > 0);
    
    if (validCategories.length === 0) {
      return '全部分类';
    }
    
    if (validCategories.length === 1) {
      return validCategories[0];
    }
    
    return `已选择 ${validCategories.length} 个分类`;
  };

  // 检查API是否属于某个分类
  const isApiInCategory = (api: any, categoryKey: string): boolean => {
    const parts = categoryKey.split(' / ');
    const platform = parts[0] || null;
    const component = parts[1] || null;
    const feature = parts[2] || null;

    const apiPlatform = api.platform || null;
    const apiComponent = api.component || null;
    const apiFeature = api.feature || null;

    // 精确匹配
    if (platform && component && feature) {
      return apiPlatform === platform && apiComponent === component && apiFeature === feature;
    }
    // 匹配到组件层级
    if (platform && component && !feature) {
      return apiPlatform === platform && apiComponent === component;
    }
    // 匹配到平台层级
    if (platform && !component && !feature) {
      return apiPlatform === platform;
    }
    return false;
  };

  // 检查测试用例是否使用了选中的分类中的API
  const testCaseMatchesApiCategories = (testCase: TestCase): boolean => {
    if (selectedApiCategories.size === 0) return true;

    try {
      // 解析flowConfig
      let flowConfig = testCase.flowConfig;
      if (typeof flowConfig === 'string') {
        flowConfig = JSON.parse(flowConfig);
      }

      if (!flowConfig || !flowConfig.nodes) return false;

      // 提取所有API的apiId（包括普通API节点和并发节点中的API）
      const apiIds: string[] = [];
      
      for (const node of flowConfig.nodes) {
        // 普通API节点
        if (node.type === 'api' && node.data?.apiId) {
          apiIds.push(node.data.apiId);
        }
        // 并发节点中的API
        if (node.type === 'parallel' && node.data?.apis && Array.isArray(node.data.apis)) {
          for (const apiConfig of node.data.apis) {
            if (apiConfig.apiId) {
              apiIds.push(apiConfig.apiId);
            }
          }
        }
      }

      if (apiIds.length === 0) return false;

      // 检查这些API是否属于选中的分类
      for (const apiId of apiIds) {
        const api = allApis.find((a: any) => a.id === apiId);
        if (api) {
          // 检查API是否属于任何一个选中的分类
          for (const categoryKey of selectedApiCategories) {
            if (isApiInCategory(api, categoryKey)) {
              return true; // 只要有一个API匹配，就返回true
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error parsing flowConfig:', error);
      return false;
    }
  };

  // 渲染API分类树节点
  const renderApiTreeNode = (node: any, level: number = 0): React.ReactNode => {
    const nodeKey = getApiNodeKey(node);
    const isExpanded = expandedApiNodes.has(nodeKey);
    const hasChildren = node.children && node.children.length > 0;
    
    // 计算节点的选中状态
    let isSelected = false;
    let isIndeterminate = false;
    
    if (hasChildren) {
      const childrenState = getChildrenState(node);
      
      if (childrenState.all) {
        // 所有子节点都选中，父节点显示为选中
        isSelected = true;
        isIndeterminate = false;
      } else if (childrenState.some) {
        // 部分子节点选中，父节点显示半选状态（绿色实体框，不勾选）
        // 无论父节点本身是否被直接选中，都显示为半选状态
        isSelected = false;
        isIndeterminate = true;
      } else {
        // 所有子节点都未选中，父节点显示为空白（未选中）
        isSelected = false;
        isIndeterminate = false;
      }
    } else {
      // 没有子节点，直接使用选中状态
      isSelected = isApiNodeSelected(node);
      isIndeterminate = false;
    }

    const Icon =
      node.type === 'platform'
        ? Layers
        : node.type === 'component'
        ? Box
        : Grid;

    return (
      <div key={nodeKey}>
        <div
          className={cn(
            'group flex items-center gap-1 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer hover:bg-muted'
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => handleToggleApiCategory(node)}
        >
          {hasChildren ? (
            <button
              className="flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleApiNode(nodeKey);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {/* 多选复选框 */}
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isIndeterminate ? 'indeterminate' : isSelected}
              onCheckedChange={() => handleToggleApiCategory(node)}
              className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
            />
          </div>

          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate max-w-[150px]">{node.name}</span>
          <Badge
            variant="outline"
            className="text-xs ml-auto flex-shrink-0"
          >
            {node.count}
          </Badge>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child: any) => renderApiTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 筛选和搜索（前端筛选，但分页由服务端处理）
  const filteredTestCases = testCases.filter((testCase) => {
    const tags = parseTags(testCase.tags);
    const matchesSearch = testCase.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      testCase.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || testCase.status === statusFilter;
    const matchesTag = selectedTag === 'all' || tags.includes(selectedTag);
    const matchesApiCategory = testCaseMatchesApiCategories(testCase);
    return matchesSearch && matchesStatus && matchesTag && matchesApiCategory;
  });

  // 加载API仓库分类数据
  useEffect(() => {
    const loadApiCategories = async () => {
      try {
        // 加载分类结构
        const classificationsResponse = await fetch('/api/api-library/classifications');
        const classificationsResult = await classificationsResponse.json();
        if (classificationsResult.success) {
          setApiCategories(classificationsResult.data);
        }
        
        // 加载所有API（用于构建分类树）
        const apisResponse = await fetch('/api/api-library/list?page=1&pageSize=10000');
        const apisResult = await apisResponse.json();
        if (apisResult.success) {
          setAllApis(apisResult.data);
        }
      } catch (error) {
        console.error('Failed to load API categories:', error);
      }
    };
    
    loadApiCategories();
  }, []);

  // 当筛选条件改变时，重置选择
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, statusFilter, selectedTag, selectedApiCategories]);

  // 格式化时间
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} ${t('hoursAgo')}`;
    } else if (diffInHours < 24 * 7) {
      return `${Math.floor(diffInHours / 24)} ${t('daysAgo')}`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // 处理删除
  const handleDeleteClick = (testCase: TestCase) => {
    setSelectedTestCase(testCase);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedTestCase) {
      onDelete(selectedTestCase.id);
      setDeleteDialogOpen(false);
      setSelectedTestCase(null);
    }
  };

  // 计算成功率
  const getSuccessRate = (testCase: TestCase) => {
    if (testCase.executeCount === 0) return 0;
    return Math.round((testCase.successCount / testCase.executeCount) * 100);
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.size === filteredTestCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTestCases.map(tc => tc.id)));
    }
  };

  // 切换单个选择
  const handleToggleSelect = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedIds(newSelectedIds);
  };

  // 批量删除
  const handleBatchDeleteClick = () => {
    if (selectedIds.size > 0) {
      setBatchDeleteDialogOpen(true);
    }
  };

  const handleConfirmBatchDelete = () => {
    if (onBatchDelete && selectedIds.size > 0) {
      onBatchDelete(Array.from(selectedIds));
      setBatchDeleteDialogOpen(false);
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* 顶部搜索和操作栏 */}
      <div className="flex flex-col gap-3 px-6 py-4 border-b border-[#e5e7eb] dark:border-[#4b5563] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button onClick={onCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('createNew')}
            </Button>
            {selectedIds.size > 0 && onBatchDelete && (
              <Button
                onClick={handleBatchDeleteClick}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {t('batchDelete')} ({selectedIds.size})
              </Button>
            )}
          </div>
          {filteredTestCases.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedIds.size === filteredTestCases.length && filteredTestCases.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {t('selectAll')}
              </label>
            </div>
          )}
        </div>

        {/* 搜索和筛选栏 - 单行紧凑布局 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* API仓库分类筛选 */}
          <DropdownMenu open={apiCategoryPopoverOpen} onOpenChange={setApiCategoryPopoverOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-[180px] h-9 justify-start text-left font-normal"
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                <span className="truncate">{getApiCategoryDisplayText()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[300px] p-0" align="start">
              <ScrollArea className="max-h-[400px]">
                <div className="p-2">
                  {/* 全部选项 */}
                  <button
                    onClick={() => {
                      setSelectedApiCategories(new Set());
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors mb-1 hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedApiCategories.size === 0}
                        onCheckedChange={() => setSelectedApiCategories(new Set())}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <FileText className="h-4 w-4" />
                      <span>全部分类</span>
                    </div>
                    <Badge variant="outline">
                      {allApis.length}
                    </Badge>
                  </button>
                  
                  {/* 分类树 */}
                  {apiCategoryTree.length > 0 ? (
                    <div className="space-y-1">
                      {apiCategoryTree.map((node) => renderApiTreeNode(node, 0))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      暂无API分类
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 标签筛选 */}
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="w-[140px] h-9">
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder={t('tags')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTags')}</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 状态筛选 */}
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-3">{t('all')}</TabsTrigger>
              <TabsTrigger value="draft" className="text-xs px-3">{t('draft')}</TabsTrigger>
              <TabsTrigger value="active" className="text-xs px-3">{t('active')}</TabsTrigger>
              <TabsTrigger value="archived" className="text-xs px-3">{t('archived')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 清空筛选 */}
          {(searchQuery || selectedTag !== 'all' || statusFilter !== 'all' || selectedApiCategories.size > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedTag('all');
                setStatusFilter('all');
                setSelectedApiCategories(new Set());
              }}
              className="gap-1 h-9 px-3"
            >
              <X className="h-3 w-3" />
              {t('clearFilters')}
            </Button>
          )}
        </div>
      </div>

      {/* 测试用例卡片网格 */}
      <div className="flex-1 overflow-auto p-6">
        {filteredTestCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[500px] text-center">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? t('noTestCases') : t('noTestCases')}
            </h3>
            <p className="text-muted-foreground mb-8 max-w-md">
              {searchQuery ? t('noTestCases') : t('createFirstTestCase')}
            </p>
            {!searchQuery && (
              <Button onClick={onCreateNew} size="lg" className="gap-2 h-11 px-6">
                <Plus className="h-5 w-5" />
                {t('createNew')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 卡片列表 - 单列紧凑布局 */}
            <div className="space-y-3">
              {filteredTestCases.map((testCase) => {
                const tags = parseTags(testCase.tags);
                const successRate = getSuccessRate(testCase);
                
                return (
                  <Card 
                    key={testCase.id} 
                    className="group hover:shadow-md transition-all cursor-pointer"
                    onClick={() => onEdit(testCase)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        {/* 复选框 */}
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(testCase.id)}
                            onCheckedChange={() => handleToggleSelect(testCase.id)}
                          />
                        </div>
                        
                        {/* 左侧：主要信息 */}
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* 第一行：标题和状态 */}
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                testCase.status === 'active'
                                  ? 'default'
                                  : testCase.status === 'draft'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="shrink-0"
                            >
                              {testCase.status === 'draft' && t('draft')}
                              {testCase.status === 'active' && t('active')}
                              {testCase.status === 'archived' && t('archived')}
                            </Badge>
                            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                              {testCase.name}
                            </h3>
                          </div>

                          {/* 第二行：描述（如果有） */}
                          {testCase.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {testCase.description}
                            </p>
                          )}

                          {/* 第三行：分类、标签、统计信息 */}
                          <div className="flex items-center gap-4 text-sm flex-wrap">
                            {/* 分类 */}
                            {testCase.category && (
                              <Badge variant="outline" className="gap-1">
                                <FolderOpen className="h-3 w-3" />
                                {testCase.category}
                              </Badge>
                            )}

                            {/* 标签 */}
                            {tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                {tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {tags.length > 2 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* 统计信息 */}
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {testCase.steps?.length || 0} {t('executions')}
                              </span>
                              <span className="flex items-center gap-1">
                                <PlayCircle className="h-3 w-3" />
                                {testCase.executeCount} {t('executions')}
                              </span>
                              {testCase.executeCount > 0 && (
                                <>
                                  <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {testCase.successCount}
                                  </span>
                                  <span className="flex items-center gap-1 text-red-600">
                                    <XCircle className="h-3 w-3" />
                                    {testCase.failCount}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* 更新时间 */}
                            <div className="flex items-center gap-1 text-muted-foreground ml-auto">
                              <Clock className="h-3 w-3" />
                              {formatDate(testCase.updatedAt)}
                            </div>
                          </div>

                          {/* 成功率进度条 */}
                          {testCase.executeCount > 0 && (
                            <div className="flex items-center gap-3">
                              <div className="flex-1 max-w-xs">
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      successRate >= 80 ? 'bg-green-500' :
                                      successRate >= 60 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${successRate}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-xs font-medium text-muted-foreground">
                                {successRate}% {t('successRate')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* 右侧：操作按钮 */}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(testCase);
                            }}
                            variant="ghost"
                            size="sm"
                            title={t('edit')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {onCopy && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCopy(testCase.id);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title={t('copy')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          {onExecute && testCase.status === 'active' && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExecute(testCase.id);
                              }}
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              title={t('run')}
                            >
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(testCase);
                            }}
                            variant="ghost"
                            size="sm"
                            title={t('delete')}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirmDescription')} "<strong>{selectedTestCase?.name}</strong>"
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              {tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量删除确认对话框 */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('batchDeleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('batchDeleteConfirmDescription', { count: selectedIds.size })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchDeleteDialogOpen(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmBatchDelete}
            >
              {tCommon('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

