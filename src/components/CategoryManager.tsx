import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import type {
  CategoriesBundle,
  CategoryDimension,
  CategoryItem
} from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  Check,
  X,
  FolderTree,
  Power,
  AlertTriangle,
  GripVertical,
  ExternalLink
} from 'lucide-react';

interface CategoryManagerProps {
  categories: CategoriesBundle;
  onRefresh: () => Promise<void>;
  onDrilldownCategory: (dimension: CategoryDimension, categoryId: string) => void;
}

const DIMENSION_META: Array<{
  key: CategoryDimension;
  label: string;
  desc: string;
}> = [
  { key: 'subject', label: '1. 科目', desc: '管理學科分類（如：生物、地球科學、數學、物理、化學）' },
  { key: 'familiarity', label: '2. 熟悉度', desc: '管理作答掌握程度（如：順、卡、不會、誤解）' },
  { key: 'error_reason', label: '3. 錯因', desc: '管理錯誤原因（支援多選或單選切換，如：觀念不清、圖表判讀錯誤）' },
  { key: 'chapter', label: '4. 章節', desc: '管理各科目底下的章節（需指定父層科目）' },
  { key: 'unit', label: '5. 單元', desc: '管理各章節底下的細部單元（需指定父層章節）' }
];

const COLOR_OPTIONS: Array<{ value: string; label: string; badgeBg: string; badgeText: string }> = [
  { value: 'default', label: '預設 (POBI藍)', badgeBg: 'rgba(0, 31, 101, 0.14)', badgeText: '#001F65' },
  { value: 'success', label: '翠綠 (POBI綠/順)', badgeBg: 'rgba(25, 122, 39, 0.15)', badgeText: '#197A27' },
  { value: 'warning', label: '琥珀橘 (卡/注意)', badgeBg: 'rgba(217, 119, 6, 0.15)', badgeText: '#D97706' },
  { value: 'danger', label: '珊瑚紅 (重災/不會)', badgeBg: 'rgba(197, 34, 31, 0.15)', badgeText: '#C5221F' }
];

export default function CategoryManager({
  categories,
  onRefresh,
  onDrilldownCategory
}: CategoryManagerProps) {
  const [activeDim, setActiveDim] = useState<CategoryDimension>('subject');
  const [searchQuery, setSearchQuery] = useState('');
  const [parentSubjectFilter, setParentSubjectFilter] = useState<string>('ALL');
  const [parentChapterFilter, setParentChapterFilter] = useState<string>('ALL');

  // Create form state
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('default');
  const [newParentSubjectId, setNewParentSubjectId] = useState('');
  const [newParentChapterId, setNewParentChapterId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('default');
  const [editParentId, setEditParentId] = useState<string>('');

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Safe Delete Modal state
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [deleteMode, setDeleteMode] = useState<'reassign' | 'unassign' | 'disable' | 'purge'>('reassign');
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  const getDimensionList = (dim: CategoryDimension): CategoryItem[] => {
    switch (dim) {
      case 'subject': return categories.subjects;
      case 'chapter': return categories.chapters;
      case 'unit': return categories.units;
      case 'familiarity': return categories.familiarities;
      case 'error_reason': return categories.errorReasons;
    }
  };

  const getParentName = (item: CategoryItem): string => {
    if (item.dimension === 'chapter') {
      const subj = categories.subjects.find(s => s.id === item.parent_id);
      return subj ? subj.name : '未指定科目';
    }
    if (item.dimension === 'unit') {
      const chap = categories.chapters.find(c => c.id === item.parent_id);
      const subj = categories.subjects.find(s => s.id === (item.subject_id || chap?.parent_id));
      if (subj && chap) return `${subj.name} / ${chap.name}`;
      if (chap) return chap.name;
      return '未指定章節';
    }
    if (item.dimension === 'error_reason') {
      if (!item.parent_id) return '全科目通用';
      const chap = categories.chapters.find(c => c.id === item.parent_id);
      if (chap) {
        const subj = categories.subjects.find(s => s.id === (item.subject_id || chap.parent_id));
        return `章節專屬：${subj ? `${subj.name} / ` : ''}${chap.name}`;
      }
      const subj = categories.subjects.find(s => s.id === item.parent_id);
      if (subj) {
        return `科目專屬：${subj.name}`;
      }
      return '全科目通用';
    }
    return '頂層維度 (無父層)';
  };

  const currentList = getDimensionList(activeDim).filter(item => {
    if (activeDim === 'chapter' && parentSubjectFilter !== 'ALL') {
      if (item.parent_id !== parentSubjectFilter) return false;
    }
    if (activeDim === 'unit') {
      if (parentSubjectFilter !== 'ALL' && item.subject_id !== parentSubjectFilter) return false;
      if (parentChapterFilter !== 'ALL' && item.parent_id !== parentChapterFilter) return false;
    }
    if (activeDim === 'error_reason') {
      if (parentSubjectFilter === 'GLOBAL') {
        if (item.parent_id) return false;
      } else if (parentSubjectFilter !== 'ALL') {
        if (item.parent_id && item.subject_id !== parentSubjectFilter && item.parent_id !== parentSubjectFilter) {
          return false;
        }
        if (parentChapterFilter !== 'ALL') {
          if (item.parent_id && item.parent_id !== parentSubjectFilter && item.parent_id !== parentChapterFilter) {
            return false;
          }
        }
      }
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.trim().toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchParent = getParentName(item).toLowerCase().includes(q);
      if (!matchName && !matchParent) return false;
    }
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('請輸入分類名稱');
      return;
    }

    let parentId: string | null = null;
    if (activeDim === 'chapter') {
      parentId = newParentSubjectId || (parentSubjectFilter !== 'ALL' ? parentSubjectFilter : (categories.subjects[0]?.id || ''));
      if (!parentId) {
        alert('請先建立並選擇所屬科目');
        return;
      }
    } else if (activeDim === 'unit') {
      parentId = newParentChapterId || (parentChapterFilter !== 'ALL' ? parentChapterFilter : '');
      if (!parentId) {
        alert('請選擇所屬章節');
        return;
      }
    } else if (activeDim === 'error_reason') {
      if (newParentChapterId) {
        parentId = newParentChapterId;
      } else if (newParentSubjectId) {
        parentId = newParentSubjectId;
      } else {
        parentId = null;
      }
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: {
          dimension: activeDim,
          name: newName.trim(),
          parentId,
          color: newColor
        }
      });
      setNewName('');
      await onRefresh();
    } catch (err: any) {
      alert(err.message || '新增分類失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditing = (item: CategoryItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setEditColor(item.color || 'default');
    setEditParentId(item.parent_id || '');
  };

  const handleSaveEdit = async (item: CategoryItem) => {
    if (!editName.trim()) {
      alert('分類名稱不可為空');
      return;
    }
    try {
      await apiRequest('/api/categories', {
        method: 'PUT',
        body: {
          id: item.id,
          dimension: item.dimension,
          name: editName.trim(),
          color: editColor,
          parent_id: item.dimension === 'error_reason' ? (editParentId || null) : (editParentId || item.parent_id)
        }
      });
      setEditingId(null);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || '儲存修改失敗');
    }
  };

  const handleToggleActive = async (item: CategoryItem) => {
    try {
      await apiRequest('/api/categories', {
        method: 'PUT',
        body: {
          id: item.id,
          dimension: item.dimension,
          is_active: item.is_active === 1 ? 0 : 1
        }
      });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || '切換啟用狀態失敗');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentList.length - 1) return;

    const nextList = [...currentList];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    const temp = nextList[index];
    nextList[index] = nextList[swapIdx];
    nextList[swapIdx] = temp;

    try {
      await apiRequest('/api/categories', {
        method: 'PUT',
        body: {
          action: 'reorder',
          dimension: activeDim,
          orderedIds: nextList.map(i => i.id)
        }
      });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || '更新排序失敗');
    }
  };

  const handleDropOnItem = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const fromIdx = currentList.findIndex(i => i.id === draggedId);
    const toIdx = currentList.findIndex(i => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...currentList];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setDraggedId(null);

    try {
      await apiRequest('/api/categories', {
        method: 'PUT',
        body: {
          action: 'reorder',
          dimension: activeDim,
          orderedIds: reordered.map(i => i.id)
        }
      });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || '拖曳排序失敗');
    }
  };

  const handleToggleErrorReasonMode = async (mode: 'multi' | 'single') => {
    try {
      await apiRequest('/api/categories', {
        method: 'PUT',
        body: {
          action: 'set_error_reason_mode',
          mode
        }
      });
      await onRefresh();
    } catch (err: any) {
      alert(err.message || '更新錯因模式失敗');
    }
  };

  const openDeleteModal = (item: CategoryItem) => {
    const candidates = getDimensionList(item.dimension).filter(c => c.id !== item.id && c.is_active === 1);
    setDeleteTarget(item);
    if (item.mistake_count > 0) {
      if (candidates.length > 0) {
        setDeleteMode('reassign');
        setReassignTargetId(candidates[0].id);
      } else {
        setDeleteMode('unassign');
        setReassignTargetId('');
      }
    } else {
      setDeleteMode('unassign');
      setReassignTargetId('');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams({
        id: deleteTarget.id,
        dimension: deleteTarget.dimension,
        mode: deleteMode
      });
      if (deleteMode === 'reassign' && reassignTargetId) {
        params.set('targetId', reassignTargetId);
      }
      await apiRequest(`/api/categories?${params.toString()}`, {
        method: 'DELETE'
      });
      setDeleteTarget(null);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || '刪除分類失敗');
    } finally {
      setDeleting(false);
    }
  };

  const getBadgeStyle = (color: string) => {
    const found = COLOR_OPTIONS.find(c => c.value === color) || COLOR_OPTIONS[0];
    return {
      background: found.badgeBg,
      color: found.badgeText,
      border: `1px solid ${found.badgeText}44`
    };
  };

  const availableChaptersForUnitCreate = categories.chapters.filter(c => {
    const subjFilter = newParentSubjectId || (parentSubjectFilter !== 'ALL' ? parentSubjectFilter : '');
    return subjFilter ? c.parent_id === subjFilter : true;
  });

  return (
    <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }} className="animate-fade-in">
      {/* Header */}
      <div className="glass" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderTree size={22} style={{ color: 'var(--accent-primary)' }} />
            <span>使用者自訂分類管理系統</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
            自由新增、重新命名、排序、停用或重新指派五大分類維度，修改後全站篩選器、目錄、錯題卡片與統計圖表即時同步。
          </p>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '250px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '36px', height: '38px', fontSize: '0.88rem' }}
            placeholder="搜尋分類名稱或父層..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 5 Dimension Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {DIMENSION_META.map(dim => {
          const count = getDimensionList(dim.key).length;
          const isActive = activeDim === dim.key;
          return (
            <button
              key={dim.key}
              onClick={() => {
                setActiveDim(dim.key);
                setEditingId(null);
              }}
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '10px 18px', fontSize: '0.9rem' }}
              data-testid={`dim-tab-${dim.key}`}
            >
              <span>{dim.label}</span>
              <span style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--glass-bg)',
                color: isActive ? '#fff' : 'var(--text-secondary)'
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Dimension Description & Controls */}
      <div className="glass" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {DIMENSION_META.find(d => d.key === activeDim)?.label}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {DIMENSION_META.find(d => d.key === activeDim)?.desc}
            </p>
          </div>

          {/* Special toggle for Error Reason single/multi mode (Requirement 7D) */}
          {activeDim === 'error_reason' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--glass-bg)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>錯因選擇模式：</span>
              <button
                type="button"
                className={`btn ${categories.errorReasonMode === 'multi' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => handleToggleErrorReasonMode('multi')}
              >
                多選模式 (預設)
              </button>
              <button
                type="button"
                className={`btn ${categories.errorReasonMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => handleToggleErrorReasonMode('single')}
              >
                單選互斥模式
              </button>
            </div>
          )}

          {/* Parent filter for Chapter, Unit, and Error Reason */}
          {(activeDim === 'chapter' || activeDim === 'unit' || activeDim === 'error_reason') && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {activeDim === 'error_reason' ? '篩選適用科目：' : '篩選父層科目：'}
              </span>
              <select
                className="input"
                style={{ width: 'auto', minWidth: '150px', padding: '6px 12px', fontSize: '0.85rem' }}
                value={parentSubjectFilter}
                onChange={e => {
                  setParentSubjectFilter(e.target.value);
                  setParentChapterFilter('ALL');
                }}
              >
                <option value="ALL">全部科目</option>
                {activeDim === 'error_reason' && (
                  <option value="GLOBAL">僅顯示全科目通用錯因</option>
                )}
                {categories.subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {(activeDim === 'unit' || (activeDim === 'error_reason' && parentSubjectFilter !== 'ALL' && parentSubjectFilter !== 'GLOBAL')) && (
                <>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {activeDim === 'error_reason' ? '篩選適用章節：' : '篩選父層章節：'}
                  </span>
                  <select
                    className="input"
                    style={{ width: 'auto', minWidth: '150px', padding: '6px 12px', fontSize: '0.85rem' }}
                    value={parentChapterFilter}
                    onChange={e => setParentChapterFilter(e.target.value)}
                  >
                    <option value="ALL">全部章節</option>
                    {categories.chapters
                      .filter(c => parentSubjectFilter === 'ALL' || c.parent_id === parentSubjectFilter)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleCreate} style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          paddingTop: '12px',
          borderTop: '1px solid var(--glass-border)'
        }}>
          {activeDim === 'chapter' && (
            <select
              className="input"
              style={{ width: 'auto', minWidth: '160px', padding: '8px 12px', fontSize: '0.9rem' }}
              value={newParentSubjectId || (parentSubjectFilter !== 'ALL' ? parentSubjectFilter : (categories.subjects[0]?.id || ''))}
              onChange={e => setNewParentSubjectId(e.target.value)}
              data-testid="new-category-parent-subject"
            >
              <option value="" disabled>選擇所屬科目</option>
              {categories.subjects.map(s => (
                <option key={s.id} value={s.id}>科目：{s.name}</option>
              ))}
            </select>
          )}

          {activeDim === 'unit' && (
            <>
              <select
                className="input"
                style={{ width: 'auto', minWidth: '150px', padding: '8px 12px', fontSize: '0.9rem' }}
                value={newParentSubjectId || (parentSubjectFilter !== 'ALL' ? parentSubjectFilter : '')}
                onChange={e => {
                  setNewParentSubjectId(e.target.value);
                  setNewParentChapterId('');
                }}
                data-testid="new-unit-parent-subject"
              >
                <option value="">全部科目</option>
                {categories.subjects.map(s => (
                  <option key={s.id} value={s.id}>科目：{s.name}</option>
                ))}
              </select>

              <select
                className="input"
                style={{ width: 'auto', minWidth: '170px', padding: '8px 12px', fontSize: '0.9rem' }}
                value={newParentChapterId || (parentChapterFilter !== 'ALL' ? parentChapterFilter : '')}
                onChange={e => setNewParentChapterId(e.target.value)}
                data-testid="new-unit-parent-chapter"
              >
                <option value="">-- 請選擇所屬章節 --</option>
                {availableChaptersForUnitCreate.map(c => {
                  const subj = categories.subjects.find(s => s.id === c.parent_id);
                  return (
                    <option key={c.id} value={c.id}>
                      {subj ? `${subj.name} / ` : ''}{c.name}
                    </option>
                  );
                })}
              </select>
            </>
          )}

          {activeDim === 'error_reason' && (
            <>
              <select
                className="input"
                style={{ width: 'auto', minWidth: '155px', padding: '8px 12px', fontSize: '0.88rem' }}
                value={newParentSubjectId}
                onChange={e => {
                  setNewParentSubjectId(e.target.value);
                  setNewParentChapterId('');
                }}
                data-testid="new-error-reason-subject"
              >
                <option value="">全科目通用錯因</option>
                {categories.subjects.map(s => (
                  <option key={s.id} value={s.id}>專屬科目：{s.name}</option>
                ))}
              </select>

              <select
                className="input"
                style={{ width: 'auto', minWidth: '170px', padding: '8px 12px', fontSize: '0.88rem' }}
                value={newParentChapterId}
                onChange={e => setNewParentChapterId(e.target.value)}
                disabled={!newParentSubjectId}
                data-testid="new-error-reason-chapter"
              >
                <option value="">{newParentSubjectId ? '-- 該科目全章節通用 --' : '-- 先選科目可指定章節 --'}</option>
                {categories.chapters
                  .filter(c => c.parent_id === newParentSubjectId)
                  .map(c => (
                    <option key={c.id} value={c.id}>專屬章節：{c.name}</option>
                  ))}
              </select>
            </>
          )}

          <input
            type="text"
            className="input"
            style={{ flex: 1, minWidth: '200px', padding: '8px 14px', fontSize: '0.9rem' }}
            placeholder={`輸入新${DIMENSION_META.find(d => d.key === activeDim)?.label.slice(3)}名稱...`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            data-testid="new-category-name-input"
          />

          <select
            className="input"
            style={{ width: 'auto', minWidth: '130px', padding: '8px 12px', fontSize: '0.88rem' }}
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
          >
            {COLOR_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '0.9rem' }}
            disabled={submitting}
            data-testid="add-category-submit-btn"
          >
            <Plus size={16} /> 新增分類
          </button>
        </form>

        {/* Category Table */}
        <div style={{ overflowX: 'auto', marginTop: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '12px 10px', width: '90px' }}>排序</th>
                <th style={{ padding: '12px 10px' }}>分類名稱</th>
                <th style={{ padding: '12px 10px' }}>所屬父層 / 維度</th>
                <th style={{ padding: '12px 10px' }}>狀態</th>
                <th style={{ padding: '12px 10px' }}>關聯錯題數</th>
                <th style={{ padding: '12px 10px' }}>建立 / 修改時間</th>
                <th style={{ padding: '12px 10px', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map((item, idx) => {
                const isEditing = editingId === item.id;
                return (
                  <tr
                    key={item.id}
                    draggable={!isEditing}
                    onDragStart={() => setDraggedId(item.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDropOnItem(item.id)}
                    style={{
                      borderBottom: '1px solid var(--glass-border)',
                      opacity: item.is_active === 1 ? 1 : 0.55,
                      background: draggedId === item.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      transition: 'background 0.15s'
                    }}
                    data-testid={`category-row-${item.name}`}
                  >
                    {/* Sort Column */}
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab' }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '22px' }}>#{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(idx, 'up')}
                          disabled={idx === 0}
                          style={{ background: 'none', border: 'none', color: idx === 0 ? 'var(--glass-border)' : 'var(--text-secondary)', cursor: idx === 0 ? 'default' : 'pointer', padding: '2px' }}
                          title="上移"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(idx, 'down')}
                          disabled={idx === currentList.length - 1}
                          style={{ background: 'none', border: 'none', color: idx === currentList.length - 1 ? 'var(--glass-border)' : 'var(--text-secondary)', cursor: idx === currentList.length - 1 ? 'default' : 'pointer', padding: '2px' }}
                          title="下移"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>

                    {/* Name Column */}
                    <td style={{ padding: '12px 10px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="input"
                            style={{ width: '160px', padding: '4px 8px', fontSize: '0.88rem' }}
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                          />
                          <select
                            className="input"
                            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem' }}
                            value={editColor}
                            onChange={e => setEditColor(e.target.value)}
                          >
                            {COLOR_OPTIONS.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          ...getBadgeStyle(item.color)
                        }}>
                          {item.name}
                        </span>
                      )}
                    </td>

                    {/* Parent Column */}
                    <td style={{ padding: '12px 10px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {isEditing && item.dimension === 'chapter' ? (
                        <select
                          className="input"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem' }}
                          value={editParentId}
                          onChange={e => setEditParentId(e.target.value)}
                        >
                          {categories.subjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : isEditing && item.dimension === 'unit' ? (
                        <select
                          className="input"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem' }}
                          value={editParentId}
                          onChange={e => setEditParentId(e.target.value)}
                        >
                          {categories.chapters.map(c => {
                            const s = categories.subjects.find(sub => sub.id === c.parent_id);
                            return (
                              <option key={c.id} value={c.id}>{s ? `${s.name} / ` : ''}{c.name}</option>
                            );
                          })}
                        </select>
                      ) : isEditing && item.dimension === 'error_reason' ? (
                        <select
                          className="input"
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem' }}
                          value={editParentId}
                          onChange={e => setEditParentId(e.target.value)}
                        >
                          <option value="">全科目通用</option>
                          <optgroup label="指定科目專屬">
                            {categories.subjects.map(s => (
                              <option key={s.id} value={s.id}>科目：{s.name}</option>
                            ))}
                          </optgroup>
                          <optgroup label="指定章節專屬">
                            {categories.chapters.map(c => {
                              const s = categories.subjects.find(sub => sub.id === c.parent_id);
                              return (
                                <option key={c.id} value={c.id}>章節：{s ? `${s.name} / ` : ''}{c.name}</option>
                              );
                            })}
                          </optgroup>
                        </select>
                      ) : (
                        getParentName(item)
                      )}
                    </td>

                    {/* Status Column */}
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        fontSize: '0.78rem',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        background: item.is_active === 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                        color: item.is_active === 1 ? '#10b981' : 'var(--text-muted)'
                      }}>
                        {item.is_active === 1 ? '啟用中' : '已停用'}
                      </span>
                    </td>

                    {/* Mistake Count Column */}
                    <td style={{ padding: '12px 10px' }}>
                      <button
                        type="button"
                        onClick={() => onDrilldownCategory(item.dimension, item.id)}
                        className="btn btn-text"
                        style={{ padding: '4px 8px', fontSize: '0.85rem', color: item.mistake_count > 0 ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                        title="點擊查看此分類的錯題"
                      >
                        <span>{item.mistake_count} 題</span>
                        {item.mistake_count > 0 && <ExternalLink size={12} />}
                      </button>
                    </td>

                    {/* Timestamps Column */}
                    <td style={{ padding: '12px 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <div>建立：{new Date(item.created_at).toLocaleDateString()}</div>
                      <div>修改：{new Date(item.updated_at || item.created_at).toLocaleDateString()}</div>
                    </td>

                    {/* Actions Column */}
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                            onClick={() => handleSaveEdit(item)}
                          >
                            <Check size={14} /> 儲存
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                            onClick={() => setEditingId(null)}
                          >
                            <X size={14} /> 取消
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '5px 9px', fontSize: '0.78rem' }}
                            onClick={() => startEditing(item)}
                            title="重新命名或編輯"
                          >
                            <Edit2 size={13} /> 編輯
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '5px 9px', fontSize: '0.78rem', color: item.is_active === 1 ? 'var(--warning)' : 'var(--success)' }}
                            onClick={() => handleToggleActive(item)}
                            title={item.is_active === 1 ? '停用分類' : '啟用分類'}
                          >
                            <Power size={13} /> {item.is_active === 1 ? '停用' : '啟用'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '5px 9px', fontSize: '0.78rem', color: 'var(--danger)' }}
                            onClick={() => openDeleteModal(item)}
                            title="刪除分類"
                          >
                            <Trash2 size={13} /> 刪除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {currentList.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    目前此維度沒有符合條件的分類項目，請由上方表單新增。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Deletion & Reassignment Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="glass modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '92%', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontSize: '1.15rem' }}>
                <AlertTriangle size={20} />
                <span>刪除分類「{deleteTarget.name}」確認</span>
              </h3>
              <button onClick={() => setDeleteTarget(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '16px' }}>
              此分類目前關聯了 <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.mistake_count} 題</strong> 錯題。
              為保護您的學習紀錄，請選擇刪除或處理方式：
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {/* Option 1: Reassign to another category */}
              {getDimensionList(deleteTarget.dimension).filter(c => c.id !== deleteTarget.id).length > 0 && (
                <label style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${deleteMode === 'reassign' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                  background: deleteMode === 'reassign' ? 'rgba(99, 102, 241, 0.12)' : 'var(--glass-bg)',
                  cursor: 'pointer'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem' }}>
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteMode === 'reassign'}
                      onChange={() => setDeleteMode('reassign')}
                    />
                    <span>搬移錯題（重新指派至其他分類）後刪除此分類</span>
                  </div>
                  {deleteMode === 'reassign' && (
                    <select
                      className="input"
                      style={{ padding: '6px 10px', fontSize: '0.85rem', marginTop: '4px' }}
                      value={reassignTargetId}
                      onChange={e => setReassignTargetId(e.target.value)}
                    >
                      {getDimensionList(deleteTarget.dimension)
                        .filter(c => c.id !== deleteTarget.id)
                        .map(c => (
                          <option key={c.id} value={c.id}>指派至：{c.name}</option>
                        ))}
                    </select>
                  )}
                </label>
              )}

              {/* Option 2: Unassign to Uncategorized */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${deleteMode === 'unassign' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                background: deleteMode === 'unassign' ? 'rgba(99, 102, 241, 0.12)' : 'var(--glass-bg)',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}>
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'unassign'}
                  onChange={() => setDeleteMode('unassign')}
                />
                <span>保留錯題並設為「未分類」，僅刪除此分類項目</span>
              </label>

              {/* Option 3: Disable instead of delete */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${deleteMode === 'disable' ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                background: deleteMode === 'disable' ? 'rgba(99, 102, 241, 0.12)' : 'var(--glass-bg)',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}>
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'disable'}
                  onChange={() => setDeleteMode('disable')}
                />
                <span>改為「停用」此分類（不刪除，保留歷史錯題關聯）</span>
              </label>

              {/* Option 4: Purge mistakes */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${deleteMode === 'purge' ? 'var(--danger)' : 'var(--glass-border)'}`,
                background: deleteMode === 'purge' ? 'rgba(239, 68, 68, 0.12)' : 'var(--glass-bg)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: 'var(--danger)'
              }}>
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'purge'}
                  onChange={() => setDeleteMode('purge')}
                />
                <span>連同關聯的 {deleteTarget.mistake_count} 題錯題資料全數清除（不可復原）</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                取消
              </button>
              <button
                type="button"
                className={`btn ${deleteMode === 'purge' ? 'btn-danger' : 'btn-primary'}`}
                onClick={confirmDelete}
                disabled={deleting}
                data-testid="confirm-category-delete-btn"
              >
                {deleting ? '執行中...' : deleteMode === 'disable' ? '確認停用' : '確認執行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
