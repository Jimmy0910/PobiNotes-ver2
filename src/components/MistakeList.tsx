import { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../utils/api';
import {
  type CategoriesBundle,
  type Field,
  type FieldOption,
  type MistakeRecord,
  formatPct,
  getEffectiveFamiliarityName
} from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  FileDown,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  RefreshCw,
  Sparkles,
  Layers
} from 'lucide-react';
import MistakeEditor from './MistakeEditor';

interface MistakeListProps {
  categories: CategoriesBundle;
  subjectId?: string | null;
  chapterId: string | null;
  unitId?: string | null;
  onSelectUnit?: (unitId: string | null) => void;
  onNavigateToExport: (mistakeIds: string[]) => void;
  onNavigateToPrompt?: (mistakeIds: string[]) => void;
  onRefreshAll?: () => Promise<void>;
  onImageClick?: (src: string) => void;
  externalOpenEditor?: boolean;
  onClearExternalOpenEditor?: () => void;
}

export default function MistakeList({
  categories,
  subjectId = null,
  chapterId,
  unitId = null,
  onSelectUnit,
  onNavigateToExport,
  onNavigateToPrompt,
  onRefreshAll,
  onImageClick,
  externalOpenEditor = false,
  onClearExternalOpenEditor
}: MistakeListProps) {
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Selection states for exporting / prompt generation
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Collapse/Expand answers states
  const [expandedIds, setExpandedIds] = useState<{ [mistakeId: string]: boolean }>({});

  // Editor states
  const [showEditor, setShowEditor] = useState(false);
  const [editingMistake, setEditingMistake] = useState<MistakeRecord | null>(null);

  // Filter states (Requirements: 日期/科目/單元/錯因/熟悉度，科目與單元下拉選單，錯因選全科/單科/特定章節，熟悉度僅一組)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [filterUnitId, setFilterUnitId] = useState<string>('');
  const [filterErrorScope, setFilterErrorScope] = useState<'all' | 'global' | 'subject' | 'chapter'>('all');
  const [filterErrorReasonId, setFilterErrorReasonId] = useState<string>('');
  const [excludedFamNames, setExcludedFamNames] = useState<string[]>([]);
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);

  // Beginner onboarding guide banner state
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    if (externalOpenEditor) {
      setEditingMistake(null);
      setShowEditor(true);
      onClearExternalOpenEditor?.();
    }
  }, [externalOpenEditor, onClearExternalOpenEditor]);

  const normalizeOptions = (options: any[] | undefined): FieldOption[] => {
    if (!options) return [];
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, color: 'default' };
      }
      return {
        value: opt.value || '',
        color: opt.color || 'default'
      };
    });
  };

  const normalizeField = (f: any): Field => ({
    id: f.id,
    type: f.type,
    label: f.label || '',
    options: normalizeOptions(f.options),
    styleType: f.styleType || 'bordered',
    inline: !!f.inline,
    hideLabel: !!f.hideLabel
  });

  const fetchMistakes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (unitId) params.set('unitId', unitId);
      else if (chapterId) params.set('chapterId', chapterId);
      else if (subjectId) params.set('subjectId', subjectId);

      const queryStr = params.toString();
      const endpoint = queryStr ? `/api/mistakes?${queryStr}` : '/api/mistakes';
      const res = await apiRequest(endpoint);
      const normalized = (res || []).map((m: any) => ({
        ...m,
        template_fields: {
          questionFields: (m.template_fields?.questionFields || []).map(normalizeField),
          answerFields: (m.template_fields?.answerFields || []).map(normalizeField)
        }
      }));
      setMistakes(normalized);
      setExpandedIds({});
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMistakes();
  }, [subjectId, chapterId, unitId, categories]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`確定要刪除錯題「${title}」嗎？`)) return;
    try {
      await apiRequest(`/api/mistakes?id=${id}`, {
        method: 'DELETE'
      });
      setMistakes(prev => prev.filter(m => m.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
      await onRefreshAll?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const next: { [id: string]: boolean } = {};
    filteredMistakes.forEach(m => {
      next[m.id] = true;
    });
    setExpandedIds(next);
  };

  const handleCollapseAll = () => {
    setExpandedIds({});
  };

  const handleSelectToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredMistakes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMistakes.map(m => m.id));
    }
  };

  const toggleFamiliarityNameExclusion = (name: string, checked: boolean) => {
    setExcludedFamNames(prev => {
      if (checked) {
        return prev.filter(n => n !== name);
      } else {
        return prev.includes(name) ? prev : [...prev, name];
      }
    });
  };

  // Deduplicated familiarities: guaranteed exactly ONE entry per name (順, 卡, 不會, 誤解)
  const deduplicatedFamiliarities = useMemo(() => {
    const active = categories.familiarities.filter(f => f.is_active === 1);
    const map = new Map<string, { id: string; name: string; color: string; ids: string[] }>();
    const orderMap: Record<string, number> = { '順': 1, '卡': 2, '不會': 3, '誤解': 4 };

    for (const f of active) {
      if (!map.has(f.name)) {
        map.set(f.name, {
          id: f.id,
          name: f.name,
          color: f.color,
          ids: [f.id]
        });
      } else {
        map.get(f.name)!.ids.push(f.id);
      }
    }

    // Ensure all 4 standard familiarities exist
    const standardDefaults = [
      { name: '順', color: 'success' },
      { name: '卡', color: 'warning' },
      { name: '不會', color: 'danger' },
      { name: '誤解', color: 'danger' }
    ];
    for (const def of standardDefaults) {
      if (!map.has(def.name)) {
        map.set(def.name, { id: def.name, name: def.name, color: def.color, ids: [def.name] });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ordA = orderMap[a.name] ?? 99;
      const ordB = orderMap[b.name] ?? 99;
      return ordA - ordB;
    });
  }, [categories.familiarities]);

  const activeSubjects = useMemo(
    () => categories.subjects.filter(s => s.is_active === 1),
    [categories.subjects]
  );

  // Units belonging to the currently selected chapter or for dropdown filter
  const chapterUnits = useMemo(() => {
    if (!chapterId) return [];
    return categories.units.filter(u => u.parent_id === chapterId && u.is_active === 1);
  }, [categories.units, chapterId]);

  // Available units for the search dropdown (filtered by selected subject if chosen)
  const availableFilterUnits = useMemo(() => {
    const subjectChapterIds = filterSubjectId
      ? new Set(categories.chapters.filter(c => c.parent_id === filterSubjectId).map(c => c.id))
      : null;

    const filtered = categories.units.filter(u => {
      if (u.is_active !== 1) return false;
      if (subjectChapterIds && (!u.parent_id || !subjectChapterIds.has(u.parent_id))) {
        return false;
      }
      return true;
    });

    const chapterMap = new Map(categories.chapters.map(c => [c.id, c.name]));
    return filtered.map(u => {
      const chapName = u.parent_id ? chapterMap.get(u.parent_id) : null;
      return {
        id: u.id,
        name: u.name,
        label: chapName ? `${chapName} ➔ ${u.name}` : u.name
      };
    });
  }, [categories.units, categories.chapters, filterSubjectId]);

  // Available error reasons for the search dropdown (filtered by chosen scope)
  const availableFilterErrorReasons = useMemo(() => {
    const active = categories.errorReasons.filter(r => r.is_active === 1);
    let list = active;
    if (filterErrorScope === 'global') {
      list = active.filter(r => !r.parent_id);
    } else if (filterErrorScope === 'subject') {
      const subjectIds = new Set(categories.subjects.map(s => s.id));
      list = active.filter(r => r.parent_id && subjectIds.has(r.parent_id));
      if (filterSubjectId) {
        list = list.filter(r => r.parent_id === filterSubjectId);
      }
    } else if (filterErrorScope === 'chapter') {
      const chapterIds = new Set(categories.chapters.map(c => c.id));
      list = active.filter(r => r.parent_id && chapterIds.has(r.parent_id));
    }

    // Deduplicate by name
    const seen = new Set<string>();
    return list.filter(r => {
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });
  }, [categories.errorReasons, categories.subjects, categories.chapters, filterErrorScope, filterSubjectId]);

  const hasActiveFilters = Boolean(
    fromDate || toDate || filterSubjectId || filterUnitId || filterErrorReasonId || filterErrorScope !== 'all' || excludedFamNames.length > 0 || searchQuery
  );

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setFromDate('');
    setToDate('');
    setFilterSubjectId('');
    setFilterUnitId('');
    setFilterErrorScope('all');
    setFilterErrorReasonId('');
    setExcludedFamNames([]);
    setOnlyUncategorized(false);
  };

  const filteredMistakes = useMemo(() => {
    return mistakes.filter(m => {
      if (onlyUncategorized) {
        if (m.subject_id && m.chapter_id) return false;
      }

      // 1. Search Query Filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const titleMatch = (m.title || '').toLowerCase().includes(q);
        const tagMatch = (m.tags || []).some(t => t.toLowerCase().includes(q));
        let dataMatch = false;
        if (m.data?.questionData) {
          dataMatch = Object.values(m.data.questionData).some(
            val => typeof val === 'string' && val.toLowerCase().includes(q)
          );
        }
        if (!titleMatch && !tagMatch && !dataMatch) return false;
      }

      // 2. Date Range Filter
      const mDate = m.mistake_date || new Date(m.created_at).toISOString().slice(0, 10);
      if (fromDate && mDate < fromDate) return false;
      if (toDate && mDate > toDate) return false;

      // 3. Subject Filter Dropdown
      if (filterSubjectId) {
        const mSubId = m.subject_id || (m.chapter_id ? categories.chapters.find(c => c.id === m.chapter_id)?.parent_id : null);
        if (mSubId !== filterSubjectId) return false;
      }

      // 4. Unit Filter Dropdown
      if (filterUnitId) {
        if (m.unit_id !== filterUnitId) return false;
      }

      // 5. Error Reason Filter (Scope + Specific Reason Tag)
      if (filterErrorReasonId) {
        const targetReason = categories.errorReasons.find(r => r.id === filterErrorReasonId);
        const targetName = targetReason?.name;
        const mReasons: string[] = m.error_reason_ids || [];
        const hasId = mReasons.includes(filterErrorReasonId);
        const hasName = targetName && mReasons.some(id => {
          const rObj = categories.errorReasons.find(r => r.id === id);
          return rObj?.name === targetName;
        });
        if (!hasId && !hasName) return false;
      } else if (filterErrorScope !== 'all') {
        const mReasons: string[] = m.error_reason_ids || [];
        if (mReasons.length === 0) return false;
        const matchesScope = mReasons.some(id => {
          const rObj = categories.errorReasons.find(r => r.id === id);
          if (!rObj) return false;
          if (filterErrorScope === 'global') return !rObj.parent_id;
          if (filterErrorScope === 'subject') {
            const isSub = categories.subjects.some(s => s.id === rObj.parent_id);
            return isSub && (!filterSubjectId || rObj.parent_id === filterSubjectId);
          }
          if (filterErrorScope === 'chapter') {
            return categories.chapters.some(c => c.id === rObj.parent_id);
          }
          return false;
        });
        if (!matchesScope) return false;
      }

      // 6. Familiarity Filter (Only ONE Set: 順, 卡, 不會, 誤解)
      const fName = getEffectiveFamiliarityName(m, categories.familiarities);
      if (fName && excludedFamNames.includes(fName)) {
        return false;
      }

      return true;
    });
  }, [
    mistakes,
    onlyUncategorized,
    searchQuery,
    fromDate,
    toDate,
    filterSubjectId,
    filterUnitId,
    filterErrorScope,
    filterErrorReasonId,
    excludedFamNames,
    categories.familiarities,
    categories.chapters,
    categories.subjects,
    categories.errorReasons
  ]);

  return (
    <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
      {/* Chapter Sub-Units Bar (Requirement 4: 查看該章節下所有單元與錯題) */}
      {chapterId && (
        <div className="glass no-print" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
            <span>本章節單元目錄：</span>
          </span>
          <button
            type="button"
            onClick={() => onSelectUnit?.(null)}
            className={`btn ${!unitId ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '5px 12px', fontSize: '0.82rem' }}
          >
            全部單元
          </button>
          {chapterUnits.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => onSelectUnit?.(u.id)}
              className={`btn ${unitId === u.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '5px 12px', fontSize: '0.82rem' }}
            >
              {u.name}
            </button>
          ))}
          {chapterUnits.length === 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              （此章節尚未建立細部單元，可於左側章節點選 + 或至分類管理新增）
            </span>
          )}
        </div>
      )}

      {/* Beginner 3-Step Onboarding Guide Banner */}
      {showOnboarding && (
        <div
          className="glass no-print animate-fade-in"
          style={{
            padding: '16px 22px',
            borderLeft: '4px solid var(--accent-primary)',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.06) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
          data-testid="beginner-onboarding-banner"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                歡迎使用 PobiNotes 錯題整理平台！新手 3 步驟快速上手指南：
              </h3>
            </div>
            <button
              type="button"
              className="btn btn-text"
              style={{ fontSize: '0.78rem', padding: '3px 8px', color: 'var(--text-secondary)' }}
              onClick={() => setShowOnboarding(false)}
            >
              收起引導
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
            <div className="memo-note washi-tape-strip" style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1.5px dashed var(--accent-primary)',
              fontSize: '0.82rem',
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>
                步驟 1｜建立科目與章節目錄
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                在畫面左側「<strong>1. 學科 / 章節 / 單元目錄</strong>」點選「+ 新增科目」，再展開科目點選「+」建立章節與單元。
              </div>
            </div>

            <div className="memo-note washi-tape-amber" style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1.5px dashed var(--warning)',
              fontSize: '0.82rem',
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: '4px' }}>
                步驟 2｜在左側設定錯因標籤
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                在左側獨立的「<strong>2. 錯因標籤設定</strong>」面板中，可切換「全科通用 / 特定科目 / 特定章節」自由新增或刪除錯因。
              </div>
            </div>

            <div className="memo-note washi-tape-strip" style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1.5px dashed var(--accent-secondary)',
              fontSize: '0.82rem',
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '4px' }}>
                步驟 3｜新增錯題、分析與匯出
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                點擊右方「<strong>+ 新增錯題</strong>」用選單挑選錯因並上傳題目圖；勾選錯題後可一鍵「匯出 PDF 練習卷」或「產生 AI 提詞」！
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Advanced Multi-Dimensional Filter Card */}
      <div className="glass no-print" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', borderRadius: 'var(--radius-md)' }}>
        {/* Row 1: Search Input & Global Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', width: '100%' }}>
          {/* Keyword Search */}
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '38px', height: '38px', width: '100%' }}
              placeholder="搜尋題目、敘述、來源或標籤..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!showOnboarding && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '7px 11px', fontSize: '0.82rem' }}
                onClick={() => setShowOnboarding(true)}
              >
                展開新手引導
              </button>
            )}

            <button
              type="button"
              className={`btn ${onlyUncategorized ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '7px 12px', fontSize: '0.84rem' }}
              onClick={() => setOnlyUncategorized(prev => !prev)}
              data-testid="toggle-uncategorized-mistakes-btn"
            >
              {onlyUncategorized ? '顯示全部錯題' : '找出未分類錯題'}
            </button>

            {filteredMistakes.length > 0 && (
              <>
                <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.84rem' }} onClick={handleExpandAll}>
                  <Eye size={15} /> 展開全部答案
                </button>
                <button className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '0.84rem' }} onClick={handleCollapseAll}>
                  <EyeOff size={15} /> 收折全部答案
                </button>
              </>
            )}

            <button
              className="btn btn-primary"
              style={{ padding: '7px 14px', fontSize: '0.88rem' }}
              onClick={() => {
                setEditingMistake(null);
                setShowEditor(true);
              }}
              data-testid="open-add-mistake-btn"
            >
              <Plus size={16} /> 新增錯題
            </button>
          </div>
        </div>

        {/* Row 2: Comprehensive Dropdowns (Date / Subject / Unit / Error Reason Scope & Tag) */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px 16px',
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '12px',
          fontSize: '0.84rem'
        }}>
          {/* 1. Date Range Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>日期：</span>
            <input
              type="date"
              className="input"
              style={{ width: '138px', height: '34px', padding: '4px 8px', fontSize: '0.82rem' }}
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              title="起始日期"
            />
            <span style={{ color: 'var(--text-muted)' }}>至</span>
            <input
              type="date"
              className="input"
              style={{ width: '138px', height: '34px', padding: '4px 8px', fontSize: '0.82rem' }}
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              title="結束日期"
            />
          </div>

          {/* 2. Subject Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>科目：</span>
            <select
              className="input"
              style={{ height: '34px', padding: '4px 8px', fontSize: '0.82rem', minWidth: '110px' }}
              value={filterSubjectId}
              onChange={e => {
                setFilterSubjectId(e.target.value);
                setFilterUnitId('');
              }}
              data-testid="filter-subject-select"
            >
              <option value="">全部科目</option>
              {activeSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* 3. Unit Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>單元：</span>
            <select
              className="input"
              style={{ height: '34px', padding: '4px 8px', fontSize: '0.82rem', minWidth: '120px', maxWidth: '200px' }}
              value={filterUnitId}
              onChange={e => setFilterUnitId(e.target.value)}
              data-testid="filter-unit-select"
            >
              <option value="">全部單元</option>
              {availableFilterUnits.map(u => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </div>

          {/* 4. Error Reason Filter: Scope + Specific Reason Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>錯因：</span>
            <select
              className="input"
              style={{ height: '34px', padding: '4px 8px', fontSize: '0.82rem', minWidth: '120px' }}
              value={filterErrorScope}
              onChange={e => {
                setFilterErrorScope(e.target.value as any);
                setFilterErrorReasonId('');
              }}
              data-testid="filter-error-scope-select"
            >
              <option value="all">全部錯因範圍</option>
              <option value="global">全科通用錯因</option>
              <option value="subject">特定科目專屬</option>
              <option value="chapter">特定章節專屬</option>
            </select>

            <select
              className="input"
              style={{ height: '34px', padding: '4px 8px', fontSize: '0.82rem', minWidth: '125px', maxWidth: '180px' }}
              value={filterErrorReasonId}
              onChange={e => setFilterErrorReasonId(e.target.value)}
              data-testid="filter-error-reason-select"
            >
              <option value="">全部錯因標籤</option>
              {availableFilterErrorReasons.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-text"
              style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--accent-secondary)', height: '34px' }}
              onClick={handleResetAllFilters}
              title="重設所有搜尋與篩選條件"
            >
              重設篩選
            </button>
          )}
        </div>

        {/* Row 3: Familiarity / Mastery Checkboxes (Only ONE Group: 順 / 卡 / 不會 / 誤解) */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '10px'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            熟悉度 / 掌握度：
          </span>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {deduplicatedFamiliarities.map(fam => {
              const isChecked = !excludedFamNames.includes(fam.name);
              const displayLabel = fam.name === '順' ? '順 (會)' : fam.name;
              const color = fam.color === 'success' ? '#197A27' : fam.color === 'warning' ? '#D97706' : fam.color === 'danger' ? '#C5221F' : 'var(--text-primary)';
              return (
                <label
                  key={fam.name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    color: 'var(--text-primary)'
                  }}
                >
                  <input
                    type="checkbox"
                    className="input-checkbox"
                    checked={isChecked}
                    onChange={e => toggleFamiliarityNameExclusion(fam.name, e.target.checked)}
                  />
                  <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? color : 'var(--text-muted)' }}>
                    {displayLabel}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dynamic Familiarity Stats Cards (Single Deduplicated Set) */}
      {filteredMistakes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '14px', margin: '0' }} className="no-print animate-fade-in">
          <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '15px', borderLeft: '4px solid var(--accent-primary)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>目前列表錯題總數</span>
            <span style={{ fontSize: '1.7rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {filteredMistakes.length} <span style={{ fontSize: '0.88rem', fontWeight: 'normal' }}>題</span>
            </span>
          </div>

          {deduplicatedFamiliarities.map(fam => {
            const count = filteredMistakes.filter(
              m => getEffectiveFamiliarityName(m, categories.familiarities) === fam.name
            ).length;
            const color = fam.color === 'success' ? '#197A27' : fam.color === 'warning' ? '#D97706' : fam.color === 'danger' ? '#C5221F' : '#001F65';
            return (
              <div
                key={fam.name}
                className="glass"
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '15px', borderLeft: `4px solid ${color}`, borderRadius: 'var(--radius-md)' }}
              >
                <span style={{ fontSize: '0.8rem', color, fontWeight: 600 }}>熟悉度：{fam.name}</span>
                <span style={{ fontSize: '1.7rem', fontWeight: 'bold', color }}>
                  {count} <span style={{ fontSize: '0.88rem', fontWeight: 'normal' }}>題</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    ({formatPct(count, filteredMistakes.length)})
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-select Action Bar (Export PDF or Generate AI Prompt) */}
      {selectedIds.length > 0 && (
        <div className="glass animate-fade-in no-print" style={{ padding: '14px 24px', background: 'rgba(0, 31, 101, 0.08)', border: '1px solid rgba(0, 31, 101, 0.22)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            已勾選 {selectedIds.length} 題錯題
          </span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => setSelectedIds([])}>
              取消全選
            </button>
            {onNavigateToPrompt && (
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.85rem', borderColor: 'var(--accent-primary)' }}
                onClick={() => onNavigateToPrompt(selectedIds)}
              >
                <Sparkles size={14} /> 產生外部 AI 提詞 ({selectedIds.length})
              </button>
            )}
            <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem' }} onClick={() => onNavigateToExport(selectedIds)}>
              <FileDown size={14} /> 匯出為 PDF ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Mistakes list container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredMistakes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '12px' }} className="no-print">
            <button
              onClick={handleSelectAll}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 500 }}
            >
              {selectedIds.length === filteredMistakes.length ? <CheckSquare size={18} style={{ color: 'var(--accent-primary)' }} /> : <Square size={18} />}
              <span>{selectedIds.length === filteredMistakes.length ? '取消全選' : '全選本頁'}</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-2" style={{ gap: '20px' }}>
          {filteredMistakes.map(m => {
            const isExpanded = !!expandedIds[m.id];
            const isSelected = selectedIds.includes(m.id);
            const famName = getEffectiveFamiliarityName(m, categories.familiarities);

            return (
              <div
                key={m.id}
                className="glass-card scrapbook-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderLeft: isSelected ? '4px solid var(--accent-secondary)' : '1px solid var(--glass-border)',
                  position: 'relative'
                }}
              >
                {/* Header row (selection checkbox + Title) */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <button
                    onClick={() => handleSelectToggle(m.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', paddingTop: '2px' }}
                    className="no-print"
                  >
                    {isSelected ? <CheckSquare size={18} style={{ color: 'var(--accent-primary)' }} /> : <Square size={18} />}
                  </button>

                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{m.title}</h3>

                    {/* Metadata tags (5 Dimensions + Custom Tags + Date) */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        color: m.subject_name ? 'var(--text-secondary)' : '#f59e0b',
                        background: 'var(--glass-bg)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--glass-border)'
                      }}>
                        {m.subject_name || '未分類科目'}
                      </span>

                      <span style={{
                        fontSize: '0.75rem',
                        color: m.chapter_name ? 'var(--text-secondary)' : '#f59e0b',
                        background: 'var(--glass-bg)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--glass-border)'
                      }}>
                        {m.chapter_name || '未分類章節'}
                      </span>

                      {m.unit_name && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#2dd4bf',
                          background: 'rgba(20, 184, 166, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(20, 184, 166, 0.3)'
                        }}>
                          {m.unit_name}
                        </span>
                      )}

                      {famName && (
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.12)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          熟悉度：{famName}
                        </span>
                      )}

                      {(m.error_reason_names || []).map(rn => (
                        <span
                          key={rn}
                          className="badge-warning-contrast"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        >
                          錯因：{rn}
                        </span>
                      ))}

                      {(m.tags || []).map(tag => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.73rem',
                            color: '#818cf8',
                            background: 'rgba(99, 102, 241, 0.12)',
                            padding: '2px 7px',
                            borderRadius: '4px'
                          }}
                        >
                          #{tag}
                        </span>
                      ))}

                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        {m.mistake_date || new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', position: 'relative', zIndex: 10, flexShrink: 0 }} className="no-print">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setEditingMistake(m);
                        setShowEditor(true);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', position: 'relative', zIndex: 11 }}
                      title="編輯錯題與分類"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(m.id, m.title);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px', position: 'relative', zIndex: 11 }}
                      title="刪除錯題"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 1. Render Question fields */}
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '10px', display: 'block' }}>
                  {m.template_fields.questionFields?.map(field => (
                    <DynamicValueRenderer
                      key={field.id}
                      field={field}
                      value={m.data.questionData?.[field.id]}
                      onImageClick={onImageClick}
                    />
                  ))}
                </div>

                {/* 2. Collapsible Answer & Solution block */}
                {m.template_fields.answerFields && m.template_fields.answerFields.length > 0 && (
                  <div className="collapsible-container">
                    <div
                      className="collapsible-trigger no-print"
                      onClick={() => handleToggleExpand(m.id)}
                    >
                      <span style={{ fontSize: '0.85rem', color: isExpanded ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {isExpanded ? '隱藏答案與解析' : '顯示答案與解析'}
                      </span>
                      {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                    </div>

                    {isExpanded && (
                      <div className="collapsible-content" style={{ display: 'block' }}>
                        {m.template_fields.answerFields.map(field => (
                          <DynamicValueRenderer
                            key={field.id}
                            field={field}
                            value={m.data.answerData?.[field.id]}
                            onImageClick={onImageClick}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty status */}
        {filteredMistakes.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '56px 24px', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-lg)', background: 'rgba(255, 255, 255, 0.015)' }}>
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.02rem' }}>
              在此範圍中目前還沒有錯題紀錄
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '6px', maxWidth: '500px', marginInline: 'auto', lineHeight: 1.5 }}>
              您可以先在左側邊欄建立「科目與章節」或設定「錯因標籤」，也可以直接點擊下方按鈕立即建立第一筆錯題！
            </p>
            <button
              className="btn btn-primary"
              style={{ padding: '9px 18px', fontSize: '0.88rem', marginTop: '16px' }}
              onClick={() => {
                setEditingMistake(null);
                setShowEditor(true);
              }}
            >
              <Plus size={16} /> 建立第一筆錯題
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          </div>
        )}
      </div>

      {/* Mistake creation/edit modal */}
      {showEditor && (
        <MistakeEditor
          categories={categories}
          initialSubjectId={subjectId}
          chapterId={chapterId || (editingMistake ? editingMistake.chapter_id : null)}
          initialUnitId={unitId}
          mistake={editingMistake}
          onClose={() => setShowEditor(false)}
          onSaveSuccess={async () => {
            setShowEditor(false);
            await fetchMistakes();
            await onRefreshAll?.();
          }}
          onRefreshCategories={onRefreshAll}
          onImageClick={onImageClick}
        />
      )}
    </div>
  );
}

interface DynamicValueRendererProps {
  field: Field;
  value: any;
  onImageClick?: (src: string) => void;
}

function DynamicValueRenderer({ field, value, onImageClick }: DynamicValueRendererProps) {
  const isOptions = field.type === 'options';
  const isUnderline = field.styleType === 'underline';
  const isEmptyValue = value === undefined || value === null || value === '';

  if (isEmptyValue && !isOptions && !isUnderline) {
    return null;
  }

  const containerStyle: React.CSSProperties = field.inline ? {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginRight: '20px',
    marginBottom: '8px',
    verticalAlign: 'middle'
  } : {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '8px'
  };

  const labelStyle: React.CSSProperties = field.inline ? {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    margin: 0,
    display: field.hideLabel ? 'none' : 'inline'
  } : {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    marginBottom: '2px',
    display: field.hideLabel ? 'none' : 'block'
  };

  const underlineStyle = isUnderline ? {
    borderBottom: '1px solid var(--text-primary)',
    padding: '0 6px 1px 6px',
    minWidth: field.inline ? '80px' : '200px',
    display: 'inline-block',
    color: 'var(--text-primary)'
  } : {};

  const getOptionStyles = (isChecked: boolean, color?: string) => {
    let borderColor = 'var(--glass-border)';
    let activeBg = 'rgba(99, 102, 241, 0.15)';
    let activeBorder = 'var(--accent-primary)';
    let textColor = isChecked ? 'var(--text-primary)' : 'var(--text-secondary)';

    if (color === 'danger') {
      borderColor = 'rgba(239, 68, 68, 0.4)';
      activeBg = 'rgba(239, 68, 68, 0.15)';
      activeBorder = '#ef4444';
      if (isChecked) textColor = '#ef4444';
    } else if (color === 'warning') {
      borderColor = 'rgba(245, 158, 11, 0.4)';
      activeBg = 'rgba(245, 158, 11, 0.15)';
      activeBorder = '#f59e0b';
      if (isChecked) textColor = '#f59e0b';
    } else if (color === 'success') {
      borderColor = 'rgba(16, 185, 129, 0.4)';
      activeBg = 'rgba(16, 185, 129, 0.15)';
      activeBorder = '#10b981';
      if (isChecked) textColor = '#10b981';
    }

    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '0.8rem',
      padding: '4px 10px',
      background: isChecked ? activeBg : 'var(--glass-bg)',
      border: `1px solid ${isChecked ? activeBorder : borderColor}`,
      borderRadius: 'var(--radius-md)',
      color: textColor
    };
  };

  const renderCheckbox = (isChecked: boolean, color?: string) => {
    let boxBorder = '1px solid var(--text-muted)';
    const checkColor = '#3b82f6';

    if (color === 'danger') boxBorder = '1px solid #ef4444';
    else if (color === 'warning') boxBorder = '1px solid #f59e0b';
    else if (color === 'success') boxBorder = '1px solid #10b981';

    return (
      <div style={{
        width: '14px',
        height: '14px',
        border: boxBorder,
        borderRadius: '3px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.05)',
        position: 'relative'
      }}>
        {isChecked && (
          <span style={{
            color: checkColor,
            fontWeight: 'bold',
            fontSize: '1.1rem',
            position: 'absolute',
            top: '-5px',
            left: '0px',
            fontFamily: 'cursive, sans-serif'
          }}>
            ✓
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={containerStyle} className="dynamic-value-card">
      {!field.hideLabel && (
        <span style={labelStyle}>
          {field.label}：
        </span>
      )}

      {isUnderline && (field.type === 'text' || field.type === 'textarea') && (
        <span style={underlineStyle}>
          {value || '\u00A0'}
        </span>
      )}

      {!isUnderline && field.type === 'text' && (
        <p style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{value}</p>
      )}

      {!isUnderline && field.type === 'textarea' && (
        <p style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value}</p>
      )}

      {field.type === 'image' && (
        <div style={{ width: '100%', maxWidth: '300px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--glass-border)', marginTop: '4px' }}>
          <img
            src={`/api/images/${value}`}
            alt={field.label}
            onClick={() => onImageClick?.(`/api/images/${value}`)}
            style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', display: 'block', background: 'rgba(0,0,0,0.2)', cursor: onImageClick ? 'zoom-in' : 'default' }}
          />
        </div>
      )}

      {field.type === 'options' && (
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '8px', verticalAlign: 'middle' }}>
          {field.options?.map((opt, i) => {
            const isChecked = Array.isArray(value) && value.includes(opt.value);
            return (
              <span key={i} style={getOptionStyles(isChecked, opt.color)}>
                {renderCheckbox(isChecked, opt.color)}
                <span>{opt.value}</span>
              </span>
            );
          })}
          {(!field.options || field.options.length === 0) && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>無選項</span>
          )}
        </div>
      )}
    </div>
  );
}
