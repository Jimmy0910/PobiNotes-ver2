import { useState, useMemo } from 'react';
import {
  type CategoriesBundle,
  type CategoryDimension,
  type FilterState,
  type MistakeRecord,
  UNCATEGORIZED_ID,
  createEmptyFilterState,
  filterMistakes,
  formatPct,
  getEffectiveFamiliarityId
} from '../types';
import {
  BarChart3,
  PieChart,
  Filter,
  RotateCcw,
  Search,
  Sparkles,
  FileDown,
  Grid,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

interface AnalyticsViewProps {
  mistakes: MistakeRecord[];
  categories: CategoriesBundle;
  filter: FilterState;
  onChangeFilter: (next: FilterState) => void;
  onNavigateToPrompt: (mistakeIds: string[]) => void;
  onNavigateToExport: (mistakeIds: string[]) => void;
  onNavigateToMistakeListWithFilter: (nextFilter: FilterState) => void;
}

const CHART_COLORS = [
  '#001F65',
  '#197A27',
  '#D97706',
  '#C5221F',
  '#0284c7',
  '#059669',
  '#7c3aed',
  '#db2777',
  '#0d9488',
  '#ea580c'
];

export default function AnalyticsView({
  mistakes,
  categories,
  filter,
  onChangeFilter,
  onNavigateToPrompt,
  onNavigateToExport
}: AnalyticsViewProps) {
  const [distDimension, setDistDimension] = useState<CategoryDimension>('subject');
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [errorStatMode, setErrorStatMode] = useState<'involvement' | 'tag_share'>('involvement');
  const [crossPair, setCrossPair] = useState<'subject_fam' | 'chapter_fam' | 'chapter_reason' | 'unit_reason'>('subject_fam');
  const [crossDenomMode, setCrossDenomMode] = useState<'total' | 'row'>('total');

  // Cascading filter options (Requirement 6)
  const visibleChapters = useMemo(() => {
    const realSubjectIds = filter.subjectIds.filter(id => id !== UNCATEGORIZED_ID);
    if (realSubjectIds.length === 0) return categories.chapters;
    return categories.chapters.filter(c => c.parent_id && realSubjectIds.includes(c.parent_id));
  }, [categories.chapters, filter.subjectIds]);

  const visibleUnits = useMemo(() => {
    const realChapterIds = filter.chapterIds.filter(id => id !== UNCATEGORIZED_ID);
    const realSubjectIds = filter.subjectIds.filter(id => id !== UNCATEGORIZED_ID);
    if (realChapterIds.length > 0) {
      return categories.units.filter(u => u.parent_id && realChapterIds.includes(u.parent_id));
    }
    if (realSubjectIds.length > 0) {
      return categories.units.filter(u => u.subject_id && realSubjectIds.includes(u.subject_id));
    }
    return categories.units;
  }, [categories.units, filter.chapterIds, filter.subjectIds]);

  const visibleErrorReasons = useMemo(() => {
    const realChapterIds = filter.chapterIds.filter(id => id !== UNCATEGORIZED_ID);
    const realSubjectIds = filter.subjectIds.filter(id => id !== UNCATEGORIZED_ID);
    if (realChapterIds.length === 0 && realSubjectIds.length === 0) {
      return categories.errorReasons;
    }
    return categories.errorReasons.filter(r => {
      if (!r.parent_id) return true; // Global error reasons always visible
      if (realChapterIds.length > 0) {
        if (realChapterIds.includes(r.parent_id)) return true;
        const selectedChapsSubjects = new Set(
          categories.chapters.filter(c => realChapterIds.includes(c.id) && c.parent_id).map(c => c.parent_id!)
        );
        if (selectedChapsSubjects.has(r.parent_id)) return true;
        return false;
      }
      if (realSubjectIds.includes(r.parent_id)) return true;
      if (r.subject_id && realSubjectIds.includes(r.subject_id)) return true;
      return false;
    });
  }, [categories.errorReasons, categories.chapters, filter.chapterIds, filter.subjectIds]);

  const allAvailableTags = useMemo(() => {
    const set = new Set<string>();
    mistakes.forEach(m => {
      (m.tags || []).forEach(t => {
        if (t && t.trim()) set.add(t.trim());
      });
    });
    return Array.from(set);
  }, [mistakes]);

  // Filtered mistakes
  const filteredMistakes = useMemo(
    () => filterMistakes(mistakes, filter, categories),
    [mistakes, filter, categories]
  );

  // Toggle helper for multi-select filter arrays
  const toggleFilterId = (key: keyof Pick<FilterState, 'subjectIds' | 'chapterIds' | 'unitIds' | 'familiarityIds' | 'errorReasonIds' | 'tags'>, id: string) => {
    const current = filter[key];
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    const updated: FilterState = { ...filter, [key]: next };

    // Cascade cleanup: when subjectIds changes, prune chapterIds and unitIds that no longer belong to selected subjects
    if (key === 'subjectIds') {
      const realSubjects = next.filter(x => x !== UNCATEGORIZED_ID);
      if (realSubjects.length > 0) {
        const validChapIds = new Set(
          categories.chapters.filter(c => c.parent_id && realSubjects.includes(c.parent_id)).map(c => c.id)
        );
        updated.chapterIds = updated.chapterIds.filter(cid => cid === UNCATEGORIZED_ID || validChapIds.has(cid));
        const validUnitIds = new Set(
          categories.units.filter(u => u.subject_id && realSubjects.includes(u.subject_id)).map(u => u.id)
        );
        updated.unitIds = updated.unitIds.filter(uid => uid === UNCATEGORIZED_ID || validUnitIds.has(uid));
      }
    } else if (key === 'chapterIds') {
      const realChapters = next.filter(x => x !== UNCATEGORIZED_ID);
      if (realChapters.length > 0) {
        const validUnitIds = new Set(
          categories.units.filter(u => u.parent_id && realChapters.includes(u.parent_id)).map(u => u.id)
        );
        updated.unitIds = updated.unitIds.filter(uid => uid === UNCATEGORIZED_ID || validUnitIds.has(uid));
      }
    }

    onChangeFilter(updated);
  };

  // Overview stats (7A)
  const overviewStats = useMemo(() => {
    const total = filteredMistakes.length;
    let uncategorizedCount = 0;
    let unsetFamiliarityCount = 0;

    const famCounts: Record<string, number> = {};
    categories.familiarities.forEach(f => { famCounts[f.id] = 0; });

    const subjCounts: Record<string, number> = {};
    categories.subjects.forEach(s => { subjCounts[s.id] = 0; });

    filteredMistakes.forEach(m => {
      if (!m.subject_id || !m.chapter_id) {
        uncategorizedCount++;
      }
      if (m.subject_id && subjCounts[m.subject_id] !== undefined) {
        subjCounts[m.subject_id]++;
      }
      const fId = getEffectiveFamiliarityId(m, categories.familiarities);
      if (!fId) {
        unsetFamiliarityCount++;
      } else {
        famCounts[fId] = (famCounts[fId] || 0) + 1;
      }
    });

    return {
      total,
      uncategorizedCount,
      unsetFamiliarityCount,
      famCounts,
      subjCounts
    };
  }, [filteredMistakes, categories]);

  // Distribution stats (7B & 7D & 7E)
  const distributionData = useMemo(() => {
    const totalMistakes = filteredMistakes.length;
    const rows: Array<{
      id: string;
      name: string;
      count: number;
      pct: number;
      pctText: string;
      color: string;
      isUncategorized?: boolean;
    }> = [];

    if (distDimension === 'error_reason') {
      const counts: Record<string, number> = {};
      categories.errorReasons.forEach(r => { counts[r.id] = 0; });
      let unlabelledCount = 0;
      let totalTagOccurrences = 0;

      filteredMistakes.forEach(m => {
        const rIds = Array.isArray(m.error_reason_ids) ? m.error_reason_ids : [];
        if (rIds.length === 0) {
          unlabelledCount++;
        } else {
          rIds.forEach(id => {
            if (counts[id] !== undefined) {
              counts[id]++;
              totalTagOccurrences++;
            }
          });
        }
      });

      const effectiveMode = categories.errorReasonMode === 'single' ? 'involvement' : errorStatMode;
      const denom = effectiveMode === 'tag_share' ? totalTagOccurrences : totalMistakes;

      categories.errorReasons.forEach((r, idx) => {
        const c = counts[r.id] || 0;
        const pct = denom > 0 ? (c / denom) * 100 : 0;
        rows.push({
          id: r.id,
          name: r.name,
          count: c,
          pct,
          pctText: formatPct(c, denom),
          color: CHART_COLORS[idx % CHART_COLORS.length]
        });
      });

      if (effectiveMode === 'involvement') {
        const pct = totalMistakes > 0 ? (unlabelledCount / totalMistakes) * 100 : 0;
        rows.push({
          id: UNCATEGORIZED_ID,
          name: '未標記錯因',
          count: unlabelledCount,
          pct,
          pctText: formatPct(unlabelledCount, totalMistakes),
          color: '#6b7280',
          isUncategorized: true
        });
      }

      return {
        rows,
        denominator: denom,
        denominatorLabel: effectiveMode === 'tag_share'
          ? `所有錯因標籤出現總次數 (${totalTagOccurrences} 次)`
          : `目前篩選範圍的錯題總數 (${totalMistakes} 題)`
      };
    }

    // Standard single-value dimensions: subject, chapter, unit, familiarity
    const sourceList =
      distDimension === 'subject' ? categories.subjects :
      distDimension === 'chapter' ? visibleChapters :
      distDimension === 'unit' ? visibleUnits :
      categories.familiarities;

    const counts: Record<string, number> = {};
    sourceList.forEach(item => { counts[item.id] = 0; });
    let uncategorized = 0;

    filteredMistakes.forEach(m => {
      let valId: string | null = null;
      if (distDimension === 'subject') valId = m.subject_id;
      else if (distDimension === 'chapter') valId = m.chapter_id;
      else if (distDimension === 'unit') valId = m.unit_id;
      else if (distDimension === 'familiarity') valId = getEffectiveFamiliarityId(m, categories.familiarities);

      if (!valId || counts[valId] === undefined) {
        uncategorized++;
      } else {
        counts[valId]++;
      }
    });

    sourceList.forEach((item, idx) => {
      const c = counts[item.id] || 0;
      const pct = totalMistakes > 0 ? (c / totalMistakes) * 100 : 0;
      let labelName = item.name;
      if (distDimension === 'chapter') {
        const s = categories.subjects.find(sub => sub.id === item.parent_id);
        if (s) labelName = `${s.name} / ${item.name}`;
      } else if (distDimension === 'unit') {
        const ch = categories.chapters.find(c => c.id === item.parent_id);
        if (ch) labelName = `${ch.name} / ${item.name}`;
      }
      rows.push({
        id: item.id,
        name: labelName,
        count: c,
        pct,
        pctText: formatPct(c, totalMistakes),
        color: CHART_COLORS[idx % CHART_COLORS.length]
      });
    });

    rows.push({
      id: UNCATEGORIZED_ID,
      name: distDimension === 'familiarity' ? '尚未設定熟悉度' : '未分類',
      count: uncategorized,
      pct: totalMistakes > 0 ? (uncategorized / totalMistakes) * 100 : 0,
      pctText: formatPct(uncategorized, totalMistakes),
      color: '#6b7280',
      isUncategorized: true
    });

    return {
      rows,
      denominator: totalMistakes,
      denominatorLabel: `目前篩選範圍的錯題總數 (${totalMistakes} 題)`
    };
  }, [distDimension, filteredMistakes, categories, visibleChapters, visibleUnits, errorStatMode]);

  // Cross-tabulation data (7C)
  const crossData = useMemo(() => {
    const rowDim: CategoryDimension =
      crossPair === 'subject_fam' ? 'subject' :
      crossPair === 'chapter_fam' || crossPair === 'chapter_reason' ? 'chapter' : 'unit';
    const colDim: CategoryDimension =
      crossPair === 'subject_fam' || crossPair === 'chapter_fam' ? 'familiarity' : 'error_reason';

    const rowItems = [
      ...(rowDim === 'subject' ? categories.subjects : rowDim === 'chapter' ? visibleChapters : visibleUnits).map(i => ({
        id: i.id,
        name: i.name
      })),
      { id: UNCATEGORIZED_ID, name: '未分類' }
    ];

    const colItems = [
      ...(colDim === 'familiarity' ? categories.familiarities : categories.errorReasons).map(i => ({
        id: i.id,
        name: i.name
      })),
      { id: UNCATEGORIZED_ID, name: colDim === 'familiarity' ? '未設定熟悉度' : '未標記錯因' }
    ];

    const matrix: Record<string, Record<string, number>> = {};
    const rowTotals: Record<string, number> = {};
    let maxCellCount = 0;

    rowItems.forEach(r => {
      matrix[r.id] = {};
      rowTotals[r.id] = 0;
      colItems.forEach(c => {
        matrix[r.id][c.id] = 0;
      });
    });

    filteredMistakes.forEach(m => {
      const rId =
        rowDim === 'subject' ? (m.subject_id || UNCATEGORIZED_ID) :
        rowDim === 'chapter' ? (m.chapter_id || UNCATEGORIZED_ID) :
        (m.unit_id || UNCATEGORIZED_ID);

      if (!matrix[rId]) return;
      rowTotals[rId] = (rowTotals[rId] || 0) + 1;

      if (colDim === 'familiarity') {
        const cId = getEffectiveFamiliarityId(m, categories.familiarities) || UNCATEGORIZED_ID;
        if (matrix[rId][cId] !== undefined) {
          matrix[rId][cId]++;
          if (matrix[rId][cId] > maxCellCount) maxCellCount = matrix[rId][cId];
        }
      } else {
        const rIds = Array.isArray(m.error_reason_ids) && m.error_reason_ids.length > 0
          ? m.error_reason_ids
          : [UNCATEGORIZED_ID];
        rIds.forEach(cId => {
          if (matrix[rId][cId] !== undefined) {
            matrix[rId][cId]++;
            if (matrix[rId][cId] > maxCellCount) maxCellCount = matrix[rId][cId];
          }
        });
      }
    });

    return { rowDim, colDim, rowItems, colItems, matrix, rowTotals, maxCellCount };
  }, [crossPair, filteredMistakes, categories, visibleChapters, visibleUnits]);

  const handleClickDistItem = (dim: CategoryDimension, itemId: string) => {
    const next = { ...filter };
    if (dim === 'subject') next.subjectIds = [itemId];
    else if (dim === 'chapter') next.chapterIds = [itemId];
    else if (dim === 'unit') next.unitIds = [itemId];
    else if (dim === 'familiarity') next.familiarityIds = [itemId];
    else if (dim === 'error_reason') next.errorReasonIds = [itemId];
    onChangeFilter(next);
    const el = document.getElementById('analytics-mistake-drilldown');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleClickCrossCell = (rowDim: CategoryDimension, rowId: string, colDim: CategoryDimension, colId: string) => {
    const next = { ...filter };
    if (rowDim === 'subject') next.subjectIds = [rowId];
    else if (rowDim === 'chapter') next.chapterIds = [rowId];
    else if (rowDim === 'unit') next.unitIds = [rowId];

    if (colDim === 'familiarity') next.familiarityIds = [colId];
    else if (colDim === 'error_reason') next.errorReasonIds = [colId];

    onChangeFilter(next);
    const el = document.getElementById('analytics-mistake-drilldown');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const hasAnyFilter =
    filter.subjectIds.length > 0 ||
    filter.chapterIds.length > 0 ||
    filter.unitIds.length > 0 ||
    filter.familiarityIds.length > 0 ||
    filter.errorReasonIds.length > 0 ||
    filter.tags.length > 0 ||
    filter.fromDate !== '' ||
    filter.toDate !== '' ||
    filter.keyword.trim() !== '';

  return (
    <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px', overflowY: 'auto' }} className="animate-fade-in">
      {/* 1. Dynamic Cascading Filter Panel */}
      <div className="glass" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Filter size={20} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>錯題動態篩選與百分比統計分析</h2>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {hasAnyFilter && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.85rem' }}
                onClick={() => onChangeFilter(createEmptyFilterState())}
                data-testid="reset-all-filters-btn"
              >
                <RotateCcw size={14} /> 重設全部篩選
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '7px 14px', fontSize: '0.85rem' }}
              onClick={() => onNavigateToPrompt(filteredMistakes.map(m => m.id))}
              disabled={filteredMistakes.length === 0}
              data-testid="send-filtered-to-prompt-btn"
            >
              <Sparkles size={14} /> 以篩選結果產生 AI 提詞 ({filteredMistakes.length})
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '7px 14px', fontSize: '0.85rem' }}
              onClick={() => onNavigateToExport(filteredMistakes.map(m => m.id))}
              disabled={filteredMistakes.length === 0}
            >
              <FileDown size={14} /> 匯出篩選結果 PDF
            </button>
          </div>
        </div>

        {/* Keyword + Date Range Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '36px', height: '38px', fontSize: '0.88rem' }}
              placeholder="關鍵字搜尋（標題、題目文字、解析、標籤...）"
              value={filter.keyword}
              onChange={e => onChangeFilter({ ...filter, keyword: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>日期範圍：</span>
            <input
              type="date"
              className="input"
              style={{ width: '148px', height: '38px', padding: '6px 10px', fontSize: '0.85rem' }}
              value={filter.fromDate}
              onChange={e => onChangeFilter({ ...filter, fromDate: e.target.value })}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>至</span>
            <input
              type="date"
              className="input"
              style={{ width: '148px', height: '38px', padding: '6px 10px', fontSize: '0.85rem' }}
              value={filter.toDate}
              onChange={e => onChangeFilter({ ...filter, toDate: e.target.value })}
            />
            {(filter.fromDate || filter.toDate) && (
              <button
                type="button"
                className="btn btn-text"
                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                onClick={() => onChangeFilter({ ...filter, fromDate: '', toDate: '' })}
              >
                清除日期
              </button>
            )}
          </div>
        </div>

        {/* Multi-dimension Pill Selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--glass-border)', paddingTop: '14px' }}>
          {/* Subject Filter */}
          <FilterRow
            label="科目"
            items={categories.subjects.map(s => ({ id: s.id, name: s.name, inactive: s.is_active === 0 }))}
            selectedIds={filter.subjectIds}
            uncategorizedLabel="未分類科目"
            onToggle={id => toggleFilterId('subjectIds', id)}
            onClear={() => onChangeFilter({ ...filter, subjectIds: [] })}
          />

          {/* Chapter Filter (Cascaded by Subject) */}
          <FilterRow
            label="章節"
            items={visibleChapters.map(c => {
              const subj = categories.subjects.find(s => s.id === c.parent_id);
              return {
                id: c.id,
                name: filter.subjectIds.length === 1 ? c.name : `${subj ? subj.name + ' / ' : ''}${c.name}`,
                inactive: c.is_active === 0
              };
            })}
            selectedIds={filter.chapterIds}
            uncategorizedLabel="未分類章節"
            onToggle={id => toggleFilterId('chapterIds', id)}
            onClear={() => onChangeFilter({ ...filter, chapterIds: [] })}
          />

          {/* Unit Filter (Cascaded by Chapter/Subject) */}
          <FilterRow
            label="單元"
            items={visibleUnits.map(u => {
              const chap = categories.chapters.find(c => c.id === u.parent_id);
              return {
                id: u.id,
                name: filter.chapterIds.length === 1 ? u.name : `${chap ? chap.name + ' / ' : ''}${u.name}`,
                inactive: u.is_active === 0
              };
            })}
            selectedIds={filter.unitIds}
            uncategorizedLabel="未分類單元"
            onToggle={id => toggleFilterId('unitIds', id)}
            onClear={() => onChangeFilter({ ...filter, unitIds: [] })}
          />

          {/* Familiarity Filter */}
          <FilterRow
            label="熟悉度"
            items={categories.familiarities.map(f => ({ id: f.id, name: f.name, inactive: f.is_active === 0 }))}
            selectedIds={filter.familiarityIds}
            uncategorizedLabel="尚未設定熟悉度"
            onToggle={id => toggleFilterId('familiarityIds', id)}
            onClear={() => onChangeFilter({ ...filter, familiarityIds: [] })}
          />

          {/* Error Reason Filter */}
          <FilterRow
            label="錯因"
            items={visibleErrorReasons.map(r => ({ id: r.id, name: r.name, inactive: r.is_active === 0 }))}
            selectedIds={filter.errorReasonIds}
            uncategorizedLabel="未標記錯因"
            onToggle={id => toggleFilterId('errorReasonIds', id)}
            onClear={() => onChangeFilter({ ...filter, errorReasonIds: [] })}
          />

          {/* Custom Tags Filter */}
          {allAvailableTags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', minWidth: '64px', fontWeight: 600 }}>自訂標籤：</span>
              {allAvailableTags.map(tag => {
                const active = filter.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleFilterId('tags', tag)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                      background: active ? 'rgba(99, 102, 241, 0.2)' : 'var(--glass-bg)',
                      color: active ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Scope Banner */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          fontSize: '0.86rem'
        }}>
          <div>
            <strong>目前分析範圍：</strong>
            <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>
              {hasAnyFilter ? '依自訂篩選條件過濾' : '全站所有錯題'}
            </span>
          </div>
          <div>
            符合條件共 <strong style={{ color: 'var(--accent-primary)', fontSize: '1rem' }}>{filteredMistakes.length}</strong> 題
            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>(總題庫 {mistakes.length} 題)</span>
          </div>
        </div>
      </div>

      {/* 2. Section A: Overview Cards (7A) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '16px' }}>
        <div className="glass" style={{ padding: '16px', borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>篩選後錯題總數</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>
            {overviewStats.total} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>題</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {overviewStats.total === 0 ? '尚無資料' : '統計基準 100.0%'}
          </div>
        </div>

        {categories.familiarities.filter(f => f.is_active === 1).map(f => {
          const count = overviewStats.famCounts[f.id] || 0;
          const borderColor = f.color === 'success' ? '#197A27' : f.color === 'warning' ? '#D97706' : f.color === 'danger' ? '#C5221F' : '#001F65';
          return (
            <div
              key={f.id}
              className="glass"
              onClick={() => handleClickDistItem('familiarity', f.id)}
              style={{ padding: '16px', borderLeft: `4px solid ${borderColor}`, cursor: 'pointer' }}
              title="點擊篩選此熟悉度錯題"
            >
              <div style={{ fontSize: '0.8rem', color: borderColor, fontWeight: 600 }}>熟悉度：{f.name}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
                {count} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>題</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  ({formatPct(count, overviewStats.total)})
                </span>
              </div>
            </div>
          );
        })}

        <div
          className="glass"
          onClick={() => handleClickDistItem('familiarity', UNCATEGORIZED_ID)}
          style={{ padding: '16px', borderLeft: '4px solid #6b7280', cursor: 'pointer' }}
          title="點擊查看尚未設定熟悉度的錯題"
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>尚未設定熟悉度</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px' }}>
            {overviewStats.unsetFamiliarityCount} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>題</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({formatPct(overviewStats.unsetFamiliarityCount, overviewStats.total)})
            </span>
          </div>
        </div>

        <div
          className="glass"
          onClick={() => handleClickDistItem('subject', UNCATEGORIZED_ID)}
          style={{ padding: '16px', borderLeft: '4px solid #9ca3af', cursor: 'pointer' }}
          title="點擊找出未分類錯題"
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>尚未分類題數 (缺科目/章節)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: '4px' }}>
            {overviewStats.uncategorizedCount} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>題</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({formatPct(overviewStats.uncategorizedCount, overviewStats.total)})
            </span>
          </div>
        </div>
      </div>

      {/* 3. Section B & D: Category Distribution & Multi-Select Error Reason Rules */}
      <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>分類分布與占比統計</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              分母定義：{distributionData.denominatorLabel}｜點擊任一分類項目可自動套用篩選並查看對應錯題
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {/* Dimension Selector */}
            {([
              { key: 'subject', label: '按科目統計' },
              { key: 'familiarity', label: '按熟悉度統計' },
              { key: 'error_reason', label: '按錯因統計' },
              { key: 'chapter', label: '按章節統計' },
              { key: 'unit', label: '按單元統計' }
            ] as Array<{ key: CategoryDimension; label: string }>).map(d => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDistDimension(d.key)}
                className={`btn ${distDimension === d.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                data-testid={`dist-dim-${d.key}`}
              >
                {d.label}
              </button>
            ))}

            {/* Bar vs Pie Toggle */}
            <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`btn ${chartType === 'bar' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                title="長條圖"
              >
                <BarChart3 size={15} /> 長條圖
              </button>
              <button
                type="button"
                onClick={() => setChartType('pie')}
                className={`btn ${chartType === 'pie' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                title="圓餅圖"
              >
                <PieChart size={15} /> 圓餅圖
              </button>
            </div>
          </div>
        </div>

        {/* Requirement 7D: Multi-select Error Reason Explanation & Mode Switcher */}
        {distDimension === 'error_reason' && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              <strong>錯因統計模式說明：</strong>
              {categories.errorReasonMode === 'single' ? (
                <span style={{ marginLeft: '6px', color: 'var(--text-secondary)' }}>
                  目前設定為「單選互斥分類統計」，分母為篩選後錯題總數。
                </span>
              ) : errorStatMode === 'involvement' ? (
                <span style={{ marginLeft: '6px', color: 'var(--text-secondary)' }}>
                  目前採用<strong>「涉及率 (題數占比)」</strong>＝ 具有該錯因的錯題數 ÷ 篩選後錯題總數 ({filteredMistakes.length} 題)。因單題可多選錯因，各項目涉及率總和可能超過 100%。
                </span>
              ) : (
                <span style={{ marginLeft: '6px', color: 'var(--text-secondary)' }}>
                  目前採用<strong>「標籤占比 (次數占比)」</strong>＝ 該錯因出現次數 ÷ 所有錯因標籤出現總次數 ({distributionData.denominator} 次)，各標籤占比總和為 100%。
                </span>
              )}
            </div>

            {categories.errorReasonMode === 'multi' && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setErrorStatMode('involvement')}
                  className={`btn ${errorStatMode === 'involvement' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                  data-testid="error-stat-involvement-btn"
                >
                  1. 涉及率 (除以錯題總數)
                </button>
                <button
                  type="button"
                  onClick={() => setErrorStatMode('tag_share')}
                  className={`btn ${errorStatMode === 'tag_share' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                  data-testid="error-stat-tag-share-btn"
                >
                  2. 標籤占比 (除以標籤總次數)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Distribution Visualization */}
        {filteredMistakes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
            <AlertCircle size={28} style={{ margin: '0 auto 8px auto', display: 'block' }} />
            <div>0 題 — 目前篩選範圍尚無資料</div>
          </div>
        ) : chartType === 'bar' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {distributionData.rows.map(row => (
              <div
                key={row.id}
                onClick={() => handleClickDistItem(distDimension, row.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  cursor: 'pointer'
                }}
                data-testid={`dist-row-${row.name}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: row.color, display: 'inline-block' }} />
                    <span>{row.name}</span>
                  </span>
                  <span>
                    <strong>{row.count} 題</strong>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>
                      ({row.pctText})
                    </span>
                    {row.count === 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: '6px' }}>
                        尚無資料
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, row.pct))}%`,
                      height: '100%',
                      background: row.color,
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* SVG Donut / Pie Chart View */
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
            <SvgDonutChart
              rows={distributionData.rows}
              totalLabel={`${filteredMistakes.length} 題`}
              onSelectSlice={id => handleClickDistItem(distDimension, id)}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '260px', flex: 1 }}>
              {distributionData.rows.map(row => (
                <div
                  key={row.id}
                  onClick={() => handleClickDistItem(distDimension, row.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    cursor: 'pointer',
                    fontSize: '0.86rem'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: row.color }} />
                    <span>{row.name}</span>
                  </span>
                  <span>
                    <strong>{row.count} 題</strong> ({row.pctText})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Section C: Cross-Tabulation / Heatmap Analysis (7C) */}
      <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Grid size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>雙維度交叉分析矩陣 (熱度表)</span>
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              分母定義：{crossDenomMode === 'total' ? `目前篩選範圍總題數 (${filteredMistakes.length} 題)` : '該列分類之錯題總數 (列百分比)'}｜點擊任一交叉格可立即篩選對應錯題
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            {([
              { key: 'subject_fam', label: '科目 × 熟悉度' },
              { key: 'chapter_fam', label: '章節 × 熟悉度' },
              { key: 'chapter_reason', label: '章節 × 錯因' },
              { key: 'unit_reason', label: '單元 × 錯因' }
            ] as const).map(pair => (
              <button
                key={pair.key}
                type="button"
                onClick={() => setCrossPair(pair.key)}
                className={`btn ${crossPair === pair.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                {pair.label}
              </button>
            ))}

            <select
              className="input"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
              value={crossDenomMode}
              onChange={e => setCrossDenomMode(e.target.value as 'total' | 'row')}
            >
              <option value="total">百分比分母：篩選總題數</option>
              <option value="row">百分比分母：各列小計題數</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>列 \ 欄</th>
                {crossData.colItems.map(col => (
                  <th key={col.id} style={{ padding: '10px', textAlign: 'center' }}>{col.name}</th>
                ))}
                <th style={{ padding: '10px', textAlign: 'center' }}>列小計</th>
              </tr>
            </thead>
            <tbody>
              {crossData.rowItems.map(row => {
                const rowSum = crossData.rowTotals[row.id] || 0;
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{row.name}</td>
                    {crossData.colItems.map(col => {
                      const val = crossData.matrix[row.id]?.[col.id] || 0;
                      const denom = crossDenomMode === 'total' ? filteredMistakes.length : rowSum;
                      const intensity = crossData.maxCellCount > 0 ? (val / crossData.maxCellCount) * 0.45 : 0;
                      return (
                        <td
                          key={col.id}
                          onClick={() => handleClickCrossCell(crossData.rowDim, row.id, crossData.colDim, col.id)}
                          style={{
                            padding: '10px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: val > 0 ? `rgba(99, 102, 241, ${0.08 + intensity})` : 'transparent',
                            border: '1px solid var(--glass-border)',
                            transition: 'transform 0.15s'
                          }}
                          title={`點擊查看「${row.name} × ${col.name}」的錯題`}
                        >
                          <div style={{ fontWeight: val > 0 ? 700 : 400, color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {val} 題
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {formatPct(val, denom)}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {rowSum} 題
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Drilldown Matching Mistakes List */}
      <div id="analytics-mistake-drilldown" className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
            <span>符合篩選條件的錯題清單 ({filteredMistakes.length} 題)</span>
          </h3>
        </div>

        {filteredMistakes.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            目前篩選條件下沒有符合的錯題 (0 題 / 尚無資料)。
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {filteredMistakes.map(m => (
              <div
                key={m.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 600 }}>{m.title}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {m.mistake_date || new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                    科目：{m.subject_name || '未分類'}
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                    章節：{m.chapter_name || '未分類'}
                  </span>
                  {m.unit_name && (
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf' }}>
                      單元：{m.unit_name}
                    </span>
                  )}
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    熟悉度：{m.familiarity_name || '未設定'}
                  </span>
                  {(m.error_reason_names || []).map(rName => (
                    <span key={rName} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                      錯因：{rName}
                    </span>
                  ))}
                  {(m.tags || []).map(tag => (
                    <span key={tag} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                      #{tag}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-text"
                    style={{ fontSize: '0.78rem', padding: '4px 8px', color: 'var(--accent-primary)' }}
                    onClick={() => onNavigateToPrompt([m.id])}
                  >
                    <ExternalLink size={12} /> 單題產生 AI 提詞
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  items,
  selectedIds,
  uncategorizedLabel,
  onToggle,
  onClear
}: {
  label: string;
  items: Array<{ id: string; name: string; inactive?: boolean }>;
  selectedIds: string[];
  uncategorizedLabel: string;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', minWidth: '64px', fontWeight: 600 }}>
        {label}：
      </span>
      <button
        type="button"
        onClick={onClear}
        style={{
          padding: '4px 10px',
          fontSize: '0.8rem',
          borderRadius: '14px',
          cursor: 'pointer',
          border: `1px solid ${selectedIds.length === 0 ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
          background: selectedIds.length === 0 ? 'rgba(99, 102, 241, 0.2)' : 'var(--glass-bg)',
          color: selectedIds.length === 0 ? '#fff' : 'var(--text-secondary)'
        }}
      >
        全部
      </button>
      {items.map(item => {
        const active = selectedIds.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
            style={{
              padding: '4px 10px',
              fontSize: '0.8rem',
              borderRadius: '14px',
              cursor: 'pointer',
              border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
              background: active ? 'var(--accent-gradient)' : 'var(--glass-bg)',
              color: active ? '#fff' : 'var(--text-primary)',
              opacity: item.inactive ? 0.6 : 1
            }}
            data-testid={`filter-pill-${label}-${item.name}`}
          >
            {item.name}{item.inactive ? ' (停用)' : ''}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => onToggle(UNCATEGORIZED_ID)}
        style={{
          padding: '4px 10px',
          fontSize: '0.8rem',
          borderRadius: '14px',
          cursor: 'pointer',
          border: `1px solid ${selectedIds.includes(UNCATEGORIZED_ID) ? '#f59e0b' : 'var(--glass-border)'}`,
          background: selectedIds.includes(UNCATEGORIZED_ID) ? 'rgba(245, 158, 11, 0.2)' : 'var(--glass-bg)',
          color: selectedIds.includes(UNCATEGORIZED_ID) ? '#f59e0b' : 'var(--text-muted)'
        }}
        data-testid={`filter-pill-${label}-uncategorized`}
      >
        {uncategorizedLabel}
      </button>
    </div>
  );
}

function SvgDonutChart({
  rows,
  totalLabel,
  onSelectSlice
}: {
  rows: Array<{ id: string; name: string; count: number; pct: number; color: string }>;
  totalLabel: string;
  onSelectSlice: (id: string) => void;
}) {
  const sumCounts = rows.reduce((acc, r) => acc + r.count, 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r={radius} fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="28" />
      {sumCounts > 0 && rows.map(row => {
        if (row.count <= 0) return null;
        const fraction = row.count / sumCounts;
        const dash = fraction * circumference;
        const offset = -accumulated * circumference;
        accumulated += fraction;
        return (
          <circle
            key={row.id}
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke={row.color}
            strokeWidth="28"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
            style={{ cursor: 'pointer', transition: 'stroke-dasharray 0.3s' }}
            onClick={() => onSelectSlice(row.id)}
          >
            <title>{`${row.name}: ${row.count} 題`}</title>
          </circle>
        );
      })}
      <text x="100" y="96" textAnchor="middle" fill="var(--text-secondary)" fontSize="12">
        統計總計
      </text>
      <text x="100" y="118" textAnchor="middle" fill="var(--text-primary)" fontSize="18" fontWeight="bold">
        {totalLabel}
      </text>
    </svg>
  );
}
