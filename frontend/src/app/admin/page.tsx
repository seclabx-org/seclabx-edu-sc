"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminApi, metaApi } from "../../lib/api";
import { useAuthGuard } from "../../lib/useAuthGuard";

const roleLabel: Record<string, string> = { admin: "管理员", teacher: "教师" };
const statusLabel: Record<string, string> = { true: "启用", false: "禁用" };

type UserRow = {
  id: number;
  username: string;
  name: string;
  role: string;
  group_id?: number | null;
  major_id?: number | null;
  is_active: boolean;
  last_login_at?: string | null;
};

type GroupOption = { label: string; value: string | number };
type MajorOption = { id: number; name: string; group_id: number | null };

export default function AdminPage() {
  const { user, loading } = useAuthGuard({ requiredRole: "admin" });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [groups, setGroups] = useState<GroupOption[]>([{ value: "", label: "全部专业群" }]);
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [majorFilter, setMajorFilter] = useState<string>("");
  const [loadingList, setLoadingList] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: string; group_id: string; major_id: string; is_active: boolean }>({
    name: "",
    role: "teacher",
    group_id: "",
    major_id: "",
    is_active: true,
  });
  const [createForm, setCreateForm] = useState<{ username: string; name: string; role: string; group_id: string; major_id: string; initial_password: string }>({
    username: "",
    name: "",
    role: "teacher",
    group_id: "",
    major_id: "",
    initial_password: "",
  });
  const [lastReset, setLastReset] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const groupNameMap = useMemo(() => {
    const map = new Map<number, string>();
    groups.forEach((g) => {
      if (g.value !== "") map.set(Number(g.value), g.label);
    });
    return map;
  }, [groups]);

  const majorNameMap = useMemo(() => {
    const map = new Map<number, { name: string; group_id: number | null }>();
    majors.forEach((m) => map.set(m.id, { name: m.name, group_id: m.group_id }));
    return map;
  }, [majors]);

  const majorOptionsFor = (gid: string) => {
    const list = gid ? majors.filter((m) => String(m.group_id ?? "") === gid) : majors;
    return [{ value: "", label: "全部专业" }, ...list.map((m) => ({ value: m.id, label: m.name }))];
  };

  const ensureMajorMatchGroup = (gid: string, mid: string) => {
    if (!gid || !mid) return mid;
    const m = majorNameMap.get(Number(mid));
    return m && String(m.group_id ?? "") === gid ? mid : "";
  };

  const fetchUsers = () => {
    setLoadingList(true);
    adminApi
      .users({
        keyword: keyword || undefined,
        role: role || undefined,
        is_active: status === "" ? undefined : status === "true",
        major_id: majorFilter ? Number(majorFilter) : undefined,
        group_id: groupFilter ? Number(groupFilter) : undefined,
        page: 1,
        page_size: 100,
      })
      .then((data) => {
        setUsers(data.items || []);
        setError(null);
        setSuccess(null);
      })
      .catch((e: any) => setError(e.message || "需要管理员权限"))
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    if (!user) return;
    metaApi.groups().then((data) => {
      setGroups([{ value: "", label: "全部专业群" }, ...data.map((g: any) => ({ value: g.id, label: g.name }))]);
    });
    metaApi.majors().then((data) => {
      setMajors(data.map((m: any) => ({ id: m.id, name: m.name, group_id: m.group_id ?? null })));
    });
    fetchUsers();
  }, [user]);

  const startEdit = (u: UserRow) => {
    setEditId(u.id);
    const gid = u.group_id ? String(u.group_id) : "";
    setEditForm({
      name: u.name,
      role: u.role,
      group_id: gid,
      major_id: ensureMajorMatchGroup(gid, u.major_id ? String(u.major_id) : ""),
      is_active: u.is_active,
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await adminApi.updateUser(editId, {
        name: editForm.name.trim(),
        role: editForm.role,
        group_id: editForm.group_id ? Number(editForm.group_id) : null,
        major_id: editForm.major_id ? Number(editForm.major_id) : null,
        is_active: editForm.is_active,
      });
      setEditId(null);
      fetchUsers();
      setSuccess("保存成功");
    } catch (e: any) {
      setError(e.message || "保存失败");
    }
  };

  const resetPwd = async (id: number) => {
    try {
      const res = await adminApi.resetPassword(id);
      setLastReset(`用户 ${res.username} 新密码：${res.new_password}`);
      setSuccess("密码已重置");
    } catch (e: any) {
      setError(e.message || "重置密码失败");
    }
  };

  const createUser = async () => {
    try {
      const payload = {
        username: createForm.username.trim(),
        name: createForm.name.trim(),
        role: createForm.role,
        group_id: createForm.group_id ? Number(createForm.group_id) : null,
        major_id: createForm.major_id ? Number(createForm.major_id) : null,
        initial_password: createForm.initial_password.trim() || undefined,
      };
      if (!payload.username || !payload.name) {
        setError("用户名和姓名必填");
        return;
      }
      await adminApi.createUser(payload);
      setCreateForm({ username: "", name: "", role: "teacher", group_id: "", major_id: "", initial_password: "" });
      fetchUsers();
      setSuccess("创建成功");
    } catch (e: any) {
      setError(e.message || "创建失败");
    }
  };

  const groupColumnLabel = (gid?: number | null) => (gid ? groupNameMap.get(gid) || gid : "—");
  const majorColumnLabel = (mid?: number | null) => (mid ? majorNameMap.get(mid)?.name || mid : "—");

  if (loading) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-slate-600">
        正在校验登录状态…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-slate-600">
        正在跳转到登录页...
      </div>
    );
  }

  const filterMajorOptions = majorOptionsFor(groupFilter);
  const createMajorOptions = majorOptionsFor(createForm.group_id);
  const editMajorOptions = majorOptionsFor(editForm.group_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">管理后台 · 用户管理</h1>
        <Link href="/dashboard" className="text-sm text-brand underline hover:text-brand">
          返回工作台
        </Link>
      </div>

      <div className="rounded border bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">筛选</h3>
        <div className="grid gap-3 md:grid-cols-5 text-xs text-slate-600">
          <label className="flex flex-col gap-1">
            关键词
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="rounded border px-2 py-1 text-sm" placeholder="用户名/姓名" />
          </label>
          <label className="flex flex-col gap-1">
            角色
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border px-2 py-1 text-sm">
              <option value="">全部</option>
              <option value="admin">管理员</option>
              <option value="teacher">教师</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            状态
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1 text-sm">
              <option value="">全部</option>
              <option value="true">启用</option>
              <option value="false">禁用</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            专业群
            <select
              value={groupFilter}
              onChange={(e) => {
                const gid = e.target.value;
                setGroupFilter(gid);
                setMajorFilter((prev) => ensureMajorMatchGroup(gid, prev));
              }}
              className="rounded border px-2 py-1 text-sm"
            >
              {groups.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            专业
            <select value={majorFilter} onChange={(e) => setMajorFilter(e.target.value)} className="rounded border px-2 py-1 text-sm">
              {filterMajorOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button onClick={fetchUsers} className="rounded bg-brand px-3 py-2 text-sm text-white hover:opacity-90">
              应用筛选
            </button>
            {loadingList && <span className="text-xs text-slate-500">加载中...</span>}
          </div>
        </div>
      </div>

      <div className="rounded border bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">新建用户</h3>
        <div className="grid gap-3 md:grid-cols-5 text-xs text-slate-600">
          <label className="flex flex-col gap-1">
            用户名
            <input value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} className="rounded border px-2 py-1 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            姓名
            <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="rounded border px-2 py-1 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            角色
            <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} className="rounded border px-2 py-1 text-sm">
              <option value="teacher">教师</option>
              <option value="admin">管理员</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            专业群
            <select
              value={createForm.group_id}
              onChange={(e) => {
                const gid = e.target.value;
                setCreateForm((prev) => ({
                  ...prev,
                  group_id: gid,
                  major_id: ensureMajorMatchGroup(gid, prev.major_id),
                }));
              }}
              className="rounded border px-2 py-1 text-sm"
            >
              {groups.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            专业
            <select value={createForm.major_id} onChange={(e) => setCreateForm({ ...createForm, major_id: e.target.value })} className="rounded border px-2 py-1 text-sm">
              {createMajorOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            初始密码（可留空自动生成）
            <input
              value={createForm.initial_password}
              onChange={(e) => setCreateForm({ ...createForm, initial_password: e.target.value })}
              className="rounded border px-2 py-1 text-sm"
              placeholder="留空自动生成"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={createUser} className="rounded bg-brand px-4 py-2 text-sm text-white hover:opacity-90">
            创建
          </button>
          {lastReset && <span className="text-xs text-slate-500">最近重置：{lastReset}</span>}
        </div>
      </div>

      {success && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">用户名</th>
              <th className="px-4 py-2">姓名</th>
              <th className="px-4 py-2">角色</th>
              <th className="px-4 py-2">专业群</th>
              <th className="px-4 py-2">专业</th>
              <th className="px-4 py-2">状态</th>
              <th className="px-4 py-2">最近登录</th>
              <th className="px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isEditing = editId === u.id;
              const isDefaultAdmin = u.username === "admin";
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2">{u.id}</td>
                  <td className="px-4 py-2">{u.username}</td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded border px-2 py-1 text-sm"
                      />
                    ) : (
                      u.name
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="rounded border px-2 py-1 text-sm"
                      >
                        <option value="admin">管理员</option>
                        <option value="teacher">教师</option>
                      </select>
                    ) : (
                      roleLabel[u.role] || u.role
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <select
                        value={editForm.group_id}
                        onChange={(e) => {
                          const gid = e.target.value;
                          setEditForm((prev) => ({
                            ...prev,
                            group_id: gid,
                            major_id: ensureMajorMatchGroup(gid, prev.major_id),
                          }));
                        }}
                        className="rounded border px-2 py-1 text-sm"
                      >
                        {groups.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      groupColumnLabel(u.group_id)
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <select
                        value={editForm.major_id}
                        onChange={(e) => setEditForm({ ...editForm, major_id: e.target.value })}
                        className="rounded border px-2 py-1 text-sm"
                      >
                        {editMajorOptions.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      majorColumnLabel(u.major_id)
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <select
                        value={String(editForm.is_active)}
                        onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === "true" })}
                        className="rounded border px-2 py-1 text-sm"
                      >
                        <option value="true">启用</option>
                        <option value="false">禁用</option>
                      </select>
                    ) : (
                      statusLabel[String(u.is_active)] || (u.is_active ? "启用" : "禁用")
                    )}
                  </td>
                  <td className="px-4 py-2">{u.last_login_at ? new Date(u.last_login_at).toLocaleString("zh-CN") : "—"}</td>
                  <td className="px-4 py-2 space-x-2">
                    {isEditing ? (
                      <>
                        <button onClick={saveEdit} className="rounded bg-brand px-2 py-1 text-xs text-white hover:opacity-90">
                          保存
                        </button>
                        <button onClick={() => setEditId(null)} className="rounded border px-2 py-1 text-xs">
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => !isDefaultAdmin && startEdit(u)}
                        disabled={isDefaultAdmin}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                        title={isDefaultAdmin ? "默认管理员不可修改" : ""}
                      >
                        编辑
                      </button>
                    )}
                    <button
                      onClick={() => !isDefaultAdmin && resetPwd(u.id)}
                      disabled={isDefaultAdmin}
                      className="rounded border px-2 py-1 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 disabled:opacity-50"
                      title={isDefaultAdmin ? "默认管理员不可重置密码" : ""}
                    >
                      重置密码
                    </button>
                    <button
                      onClick={() => {
                        if (isDefaultAdmin) return;
                        adminApi
                          .updateUser(u.id, { is_active: !u.is_active })
                          .then(fetchUsers)
                          .catch((e: any) => setError(e.message || "更新状态失败"));
                      }}
                      disabled={isDefaultAdmin}
                      className="rounded border px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                      title={isDefaultAdmin ? "默认管理员不可禁用" : ""}
                    >
                      {u.is_active ? "禁用" : "启用"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {lastReset && (
        <div className="rounded border bg-amber-50 px-3 py-2 text-sm text-amber-700 flex items-center justify-between">
          <span>{lastReset}</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(lastReset || "");
                setSuccess("已复制新密码");
              }}
              className="rounded border border-amber-300 px-2 py-1 text-xs hover:bg-amber-100"
            >
              复制
            </button>
            <button onClick={() => setLastReset(null)} className="rounded border border-amber-300 px-2 py-1 text-xs hover:bg-amber-100">
              隐藏
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
