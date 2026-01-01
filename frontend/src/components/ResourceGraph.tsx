"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as d3 from "d3";
import { resourceApi } from "../lib/api";

type Level = "group" | "major" | "course" | "type";

type GraphNode = {
  id: string;
  label: string;
  level: Level;
  parentId?: string;
  count: number;
  expanded?: boolean;
  loading?: boolean;
  resourceType?: string;
};

type GraphEdge = { from: string; to: string };

const levelOrder: Level[] = ["group", "major", "course", "type"];
const levelTitle: Record<Level, string> = { group: "专业群", major: "专业", course: "课程", type: "类型" };
const levelColor: Record<Level, string> = { group: "#0ea5e9", major: "#6366f1", course: "#22c55e", type: "#f59e0b" };
const MAX_CHILDREN = 120; // 单次展开最多加载的子节点数
const MAX_NODES_TOTAL = 800; // 软上限
const MAX_NODES_HARD = 1200; // 硬上限
const IDEAL_MAX_NODES = 120; // 理想可读范围
const INITIAL_EXPAND_CAP = 200; // 初次展开上限
const BASE_HEIGHT = 640;
const VIEWBOX_X = 0; // 从 (0,0) 开始，避免裁剪
const VIEWBOX_Y = 0;
const MARGIN_Y = 140; // 节点纵向偏移，让首行位置更居中

export function ResourceGraph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [nodeError, setNodeError] = useState<string | null>(null);
  const [erroredNodes, setErroredNodes] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<d3.ZoomTransform>(() => d3.zoomIdentity.scale(1));
  const initialTransformRef = useRef<d3.ZoomTransform | null>(null);
  const initialNodesRef = useRef<GraphNode[] | null>(null);
  const initialWarnRef = useRef<string | null>(null);

  const width = 820;
  const height = Math.min(780, Math.max(BASE_HEIGHT, 120 + nodes.length * 10));

  const safeWarn = (msg: string | null) => setWarn(msg);

  const fetchChildren = async (node: GraphNode, nextLevel: Level): Promise<GraphNode[]> => {
    const params: any = { level: nextLevel, limit: MAX_CHILDREN, include_empty: "true" };
    if (nextLevel === "major") params.group_id = Number(node.id.split("group-")[1]);
    if (nextLevel === "course") params.major_id = Number(node.id.split("major-")[1]);
    if (nextLevel === "type") {
      if (node.level === "course") params.course_id = Number(node.id.split("course-")[1]);
      if (node.level === "major") params.major_id = Number(node.id.split("major-")[1]);
      if (node.level === "group") params.group_id = Number(node.id.split("group-")[1]);
    }

    const data = await resourceApi.summary(params);
    let list = data.items || [];

    if (list.length > MAX_CHILDREN) {
      safeWarn(`超过 ${MAX_CHILDREN} 个节点，仅展示前 ${MAX_CHILDREN} 个`);
      list = list.slice(0, MAX_CHILDREN);
    } else {
      safeWarn(null);
    }

    return list.map((item: any) => {
      if (nextLevel === "major") {
        return { id: `major-${item.major_id}`, label: item.major_name, level: "major", parentId: node.id, count: item.count || 0 };
      }
      if (nextLevel === "course") {
        return { id: `course-${item.course_id}`, label: item.course_name, level: "course", parentId: node.id, count: item.count || 0 };
      }
      return {
        id: `type-${item.resource_type}-${node.id}`,
        label: item.label,
        level: "type",
        parentId: node.id,
        count: item.count || 0,
        resourceType: item.resource_type,
      };
    });
  };

  const loadRoot = async () => {
    setLoading(true);
    setError(null);
    setWarn(null);
    setNodeError(null);
    initialTransformRef.current = null;
    initialNodesRef.current = null;
    initialWarnRef.current = null;
    try {
      const data = await resourceApi.summary({ level: "group", limit: MAX_CHILDREN, include_empty: "true" });
      const groups: any[] = data.items || [];

      if (groups.length === 0) {
        setNodes([]);
        setWarn("暂无资源");
        initialWarnRef.current = "暂无资源";
        return;
      }

      let current: GraphNode[] = [];
      for (const g of groups) {
        const groupNode: GraphNode = {
          id: `group-${g.group_id}`,
          label: g.group_name,
          level: "group",
          count: g.count || 0,
          expanded: false,
        };
        const majors = await fetchChildren(groupNode, "major");
        if (current.length + 1 + majors.length > INITIAL_EXPAND_CAP) {
          current = current.concat({ ...groupNode, expanded: false });
          continue;
        }
        current = current.concat({ ...groupNode, expanded: true }, majors);
      }

      let initialWarn: string | null = null;
      if (current.length > IDEAL_MAX_NODES) {
        initialWarn = `当前已加载 ${current.length} 个节点，建议收起部分层级（理想不超过 ${IDEAL_MAX_NODES} 个）`;
        safeWarn(initialWarn);
      }
      setNodes(current);
      initialNodesRef.current = current.map((n) => ({ ...n }));
      initialWarnRef.current = initialWarn;
    } catch (e: any) {
      setError(e.message || "加载图谱失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoot();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoomed = (event: any) => setTransform(event.transform);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 2]).on("zoom", zoomed);
    zoomRef.current = zoom;
    svg.call(zoom as any);
    return () => {
      svg.on(".zoom", null);
    };
  }, []);

  const { positioned, edges } = useMemo(() => {
    const childrenMap = new Map<string, GraphNode[]>();
    nodes.forEach((n) => {
      if (n.parentId) {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
        childrenMap.get(n.parentId)!.push(n);
      }
    });
    const build = (id: string): any => {
      const kids = childrenMap.get(id) || [];
      return { id, children: kids.map((c) => build(c.id)) };
    };
    const roots = nodes.filter((n) => !n.parentId).map((n) => build(n.id));
    const treeData = { id: "root", children: roots };
    const root = d3.hierarchy(treeData);
    const treeLayout = d3.tree().size([height - 120, width - 80]);
    treeLayout(root);
    const positions: Record<string, { x: number; y: number }> = {};
    root.descendants().forEach((d) => {
      if (d.data.id !== "root") positions[d.data.id] = { x: d.y, y: d.x + MARGIN_Y };
    });
    const edges: GraphEdge[] = [];
    nodes.forEach((n) => {
      if (n.parentId) edges.push({ from: n.parentId, to: n.id });
    });
    return { positioned: positions, edges };
  }, [nodes, height, width]);

  // 自动适配缩放到合适视野（仅首次加载）
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const ids = Object.keys(positioned);
    if (ids.length === 0) return;
    if (initialTransformRef.current) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    ids.forEach((id) => {
      const { x, y } = positioned[id];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    const boxWidth = Math.max(1, maxX - minX);
    const boxHeight = Math.max(1, maxY - minY);
    const margin = 80;
    const scale = Math.min((width - margin) / boxWidth, (height - margin) / boxHeight, 1.1);
    const centerX = (minX + maxX) / 2 + VIEWBOX_X;
    const centerY = (minY + maxY) / 2 + VIEWBOX_Y;
    const tx = width / 2 - centerX * scale;
    const ty = height / 2 - centerY * scale;
    const initial = d3.zoomIdentity.translate(tx, ty).scale(scale);
    initialTransformRef.current = initial;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform as any, initial);
  }, [positioned, width, height]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const fullPath = (n: GraphNode) => {
    const parts: string[] = [n.label];
    let cur: GraphNode | undefined = n;
    while (cur?.parentId) {
      const parent = nodeMap.get(cur.parentId);
      if (!parent) break;
      parts.unshift(parent.label);
      cur = parent;
    }
    return parts.join(" / ");
  };

  const expandNode = async (node: GraphNode, toggleCollapse = true) => {
    const idx = levelOrder.indexOf(node.level);
    if (idx === -1 || idx === levelOrder.length - 1) return;
    const nextLevel = levelOrder[idx + 1];

    if (toggleCollapse && node.expanded) {
      setNodes((prev) => {
        const toRemove = new Set<string>();
        const collect = (id: string) => {
          prev.forEach((n) => {
            if (n.parentId === id) {
              toRemove.add(n.id);
              collect(n.id);
            }
          });
        };
        collect(node.id);
        const base = prev.filter((n) => !toRemove.has(n.id) && n.id !== node.id);
        return base.concat({ ...node, expanded: false });
      });
      return;
    }

    if (node.loading) return;
    setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, loading: true } : n)));
    setNodeError(null);
    try {
      const children = await fetchChildren(node, nextLevel);
      setNodes((prev) => {
        const total = prev.length + children.length;
        if (total > MAX_NODES_TOTAL) {
          safeWarn(`节点总数超过 ${MAX_NODES_TOTAL}，可能影响性能，请收起部分层级`);
        }
        if (total > MAX_NODES_HARD) {
          safeWarn(`节点总数超过 ${MAX_NODES_HARD}，已停止继续展开，请收起部分节点`);
          return prev.map((n) => (n.id === node.id ? { ...n, loading: false, expanded: false } : n));
        }
        const toRemove = new Set<string>();
        const collect = (id: string) => {
          prev.forEach((n) => {
            if (n.parentId === id) {
              toRemove.add(n.id);
              collect(n.id);
            }
          });
        };
        collect(node.id);
        const base = prev.filter((n) => n.id !== node.id && !toRemove.has(n.id));
        const merged = [...base, { ...node, expanded: true, loading: false }, ...children];
        const map = new Map<string, GraphNode>();
        merged.forEach((n) => map.set(n.id, n));
        return Array.from(map.values()).map((n) => {
          if (children.find((c) => c.id === n.id)) {
            return { ...n, parentId: node.id };
          }
          return n;
        });
      });
      setErroredNodes((prev) => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
    } catch (e: any) {
      setError(e.message || "加载失败");
      setNodeError("展开失败，点击重试");
      setErroredNodes((prev) => new Set(prev).add(node.id));
      setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, loading: false } : n)));
    }
  };

  const resetView = () => {
    if (!svgRef.current || !zoomRef.current) return;
    if (initialNodesRef.current) {
      setNodes(initialNodesRef.current.map((n) => ({ ...n })));
      setSelected(null);
      setError(null);
      setNodeError(null);
      setErroredNodes(new Set());
      setWarn(initialWarnRef.current);
    }
    const svg = d3.select(svgRef.current);
    const target = initialTransformRef.current || d3.zoomIdentity;
    svg.transition().duration(300).call(zoomRef.current.transform as any, target);
  };

  const zoomBy = (k: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const next = transform.scale(k);
    svg.transition().duration(200).call(zoomRef.current.transform as any, next);
  };

  const buildLink = (n: GraphNode) => {
    const params = new URLSearchParams();
    if (n.level === "group") params.append("group_id", n.id.split("group-")[1]);
    if (n.level === "major") {
      params.append("major_id", n.id.split("major-")[1]);
      const parent = nodes.find((x) => x.id === n.parentId);
      if (parent?.id.startsWith("group-")) params.append("group_id", parent.id.split("group-")[1]);
    }
    if (n.level === "course") {
      params.append("course_id", n.id.split("course-")[1]);
      const parent = nodes.find((x) => x.id === n.parentId);
      if (parent?.id.startsWith("major-")) params.append("major_id", parent.id.split("major-")[1]);
      const parentGroup = nodes.find((x) => x.id === parent?.parentId);
      if (parentGroup?.id.startsWith("group-")) params.append("group_id", parentGroup.id.split("group-")[1]);
    }
    if (n.level === "type") {
      if (n.resourceType) params.append("resource_type", n.resourceType);
      const parent = nodes.find((x) => x.id === n.parentId);
      if (parent?.id.startsWith("course-")) params.append("course_id", parent.id.split("course-")[1]);
      const parentMajor = nodes.find((x) => x.id === parent?.parentId);
      if (parentMajor?.id.startsWith("major-")) params.append("major_id", parentMajor.id.split("major-")[1]);
      const parentGroup = nodes.find((x) => x.id === parentMajor?.parentId);
      if (parentGroup?.id.startsWith("group-")) params.append("group_id", parentGroup.id.split("group-")[1]);
    }
    return `/resources${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const transformString = transform.toString();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">资源图谱</h2>
          <p className="text-sm text-slate-600">默认展开到“专业”层，点击节点继续展开/收起，可缩放拖拽查看。</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">缩放</span>
          <button onClick={() => zoomBy(1.1)} className="rounded border px-3 py-1 text-sm text-brand border-brand hover:bg-brand hover:text-white">
            +
          </button>
          <button onClick={() => zoomBy(1 / 1.1)} className="rounded border px-3 py-1 text-sm text-brand border-brand hover:bg-brand hover:text-white">
            -
          </button>
          <button onClick={resetView} className="rounded border px-3 py-1 text-sm text-brand border-brand hover:bg-brand hover:text-white">
            重置视图
          </button>
          <div className="flex items-center gap-2 rounded border px-2 py-1 text-[11px] text-slate-500">
            <span className="h-3 w-3 rounded-full" style={{ background: levelColor.group }} /> 专业群
            <span className="h-3 w-3 rounded-full" style={{ background: levelColor.major }} /> 专业
            <span className="h-3 w-3 rounded-full" style={{ background: levelColor.course }} /> 课程
            <span className="h-3 w-3 rounded-full" style={{ background: levelColor.type }} /> 类型
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <div className="flex gap-2">
            <button onClick={() => loadRoot()} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">
              重新加载
            </button>
            <button
              onClick={() => {
                setError(null);
                setNodes([]);
                setSelected(null);
                setWarn(null);
                setLoading(false);
                loadRoot();
              }}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
            >
              清空重试
            </button>
          </div>
        </div>
      )}
      {loading && nodes.length === 0 ? <p className="text-sm text-slate-600">加载中...</p> : null}
      {warn && <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{warn}</div>}
      {nodeError && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{nodeError}</div>}

      <div className="w-full overflow-hidden rounded-xl border bg-white shadow-sm touch-pan-y touch-pinch-zoom flex justify-center">
        <svg ref={svgRef} viewBox={`${VIEWBOX_X} ${VIEWBOX_Y} ${width} ${height}`} style={{ height: `${height}px`, width: "100%" }} className="select-none">
          <g transform={transformString}>
            {edges.map((e) => {
              const from = positioned[e.from];
              const to = positioned[e.to];
              if (!from || !to) return null;
              return <line key={`${e.from}-${e.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#cbd5e1" strokeWidth={1.5} />;
            })}
            {nodes.map((n) => {
              const pos = positioned[n.id];
              if (!pos) return null;
              const label = n.label;
              const boxWidth = Math.min(260, Math.max(120, label.length * 12));
              const boxHeight = 54;
              return (
                <g
                  key={n.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(n);
                    expandNode(n, true);
                  }}
                  onDoubleClick={() => {
                    const link = buildLink(n);
                    if (link) window.location.href = link;
                  }}
                >
                  <title>{`${fullPath(n)}（${n.count} 条）`}</title>
                  <rect
                    x={-boxWidth / 2}
                    y={-boxHeight / 2}
                    rx={10}
                    ry={10}
                    width={boxWidth}
                    height={boxHeight}
                    fill={levelColor[n.level]}
                    opacity={0.92}
                    stroke={erroredNodes.has(n.id) ? "#ef4444" : "none"}
                    strokeWidth={erroredNodes.has(n.id) ? 3 : 0}
                  />
                  <text textAnchor="middle" dy="-12" className="text-[10px] fill-white/90">
                    {levelTitle[n.level]}
                  </text>
                  <text textAnchor="middle" dy="4" className="text-xs fill-white font-semibold">
                    {label}
                  </text>
                  <text textAnchor="middle" dy="18" className="text-[10px] fill-white/90">
                    {n.count} 条
                  </text>
                  {n.loading && (
                    <text textAnchor="middle" dy="32" className="text-[10px] fill-slate-200">
                      加载中...
                    </text>
                  )}
                  {erroredNodes.has(n.id) && (
                    <text textAnchor="middle" dy="32" className="text-[10px] fill-red-100">
                      展开失败，点击重试
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-3 rounded border bg-white px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">
            {levelTitle[selected.level]}：{selected.label}（{selected.count} 条）
          </span>
          <Link href={buildLink(selected)} className="rounded border border-brand px-3 py-1 text-sm text-brand hover:bg-brand hover:text-white">
            跳转到筛选结果
          </Link>
          <button onClick={() => setSelected(null)} className="rounded border px-2 py-1 text-xs text-slate-600">
            关闭
          </button>
        </div>
      )}
    </div>
  );
}
