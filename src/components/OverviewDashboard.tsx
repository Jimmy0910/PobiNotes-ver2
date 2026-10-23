import { useMemo } from 'react';
import {
  type CategoriesBundle,
  type CategoryDimension,
  type MistakeRecord,
  UNCATEGORIZED_ID,
  formatPct,
  getEffectiveFamiliarityId
} from '../types';
import {
  LayoutDashboard,
  BookOpen,
  AlertTriangle,
  Clock,
  FolderTree,
  BarChart3,
  Plus
} from 'lucide-react';

interface OverviewDashboardProps {
  mistakes: MistakeRecord[];
  categories: CategoriesBundle;
  onDrilldownCategory: (dimension: CategoryDimension, id: string) => void;
  onNavigateToView: (view: 'all' | 'categories' | 'analytics' | 'prompt' | 'export') => void;
  onOpenNewMistake: () => void;
}

export default function OverviewDashboard({
  mistakes,
  categories,
  onDrilldownCategory,
  onNavigateToView,
  onOpenNewMistake
}: OverviewDashboardProps) {
  const stats = useMemo(() => {
    const total = mistakes.length;
    let uncategorizedCount = 0;
    let unsetFamCount = 0;

    const famCounts: Record<string, number> = {};
    categories.familiarities.forEach(f => { famCounts[f.id] = 0; });

    const subjCounts: Record<string, number> = {};
    categories.subjects.forEach(s => { subjCounts[s.id] = 0; });

    const reasonCounts: Record<string, number> = {};
    categories.errorReasons.forEach(r => { reasonCounts[r.id] = 0; });

    const chapCounts: Record<string, number> = {};
    categories.chapters.forEach(c => { chapCounts[c.id] = 0; });

    const unitCounts: Record<string, number> = {};
    categories.units.forEach(u => { unitCounts[u.id] = 0; });

    mistakes.forEach(m => {
      if (!m.subject_id || !m.chapter_id) {
        uncategorizedCount++;
      }
      if (m.subject_id && subjCounts[m.subject_id] !== undefined) {
        subjCounts[m.subject_id]++;
      }
      if (m.chapter_id && chapCounts[m.chapter_id] !== undefined) {
        chapCounts[m.chapter_id]++;
      }
      if (m.unit_id && unitCounts[m.unit_id] !== undefined) {
        unitCounts[m.unit_id]++;
      }

      const fId = getEffectiveFamiliarityId(m, categories.familiarities);
      if (!fId) {
        unsetFamCount++;
      } else {
        famCounts[fId] = (famCounts[fId] || 0) + 1;
      }

      (m.error_reason_ids || []).forEach(rId => {
        if (reasonCounts[rId] !== undefined) {
          reasonCounts[rId]++;
        }
      });
    });

    const recentMistakes = [...mistakes]
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 6);

    return {
      total,
      uncategorizedCount,
      unsetFamCount,
      famCounts,
      subjCounts,
      reasonCounts,
      chapCounts,
      unitCounts,
      recentMistakes
    };
  }, [mistakes, categories]);

  return (
    <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }} className="animate-fade-in">
      {/* Header Banner - Physical Notebook Header */}
      <div className="glass notebook-page washi-tape-strip" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', borderTop: '3px solid var(--accent-secondary)' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LayoutDashboard size={22} style={{ color: 'var(--accent-primary)' }} />
            <span>PobiNotes 學習診斷儀表板（錯題統整）</span>
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            活頁錯題本數據即時統整，點擊任一卡片可深入翻閱對應錯題與交叉分析。
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button type="button" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.88rem' }} onClick={onOpenNewMistake}>
            <Plus size={16} /> 剪貼新增錯題
          </button>
          <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.88rem' }} onClick={() => onNavigateToView('analytics')}>
            <BarChart3 size={16} /> 前往進階篩選與分析
          </button>
          <button type="button" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.88rem' }} onClick={() => onNavigateToView('categories')}>
            <FolderTree size={16} /> 分類管理
          </button>
        </div>
      </div>

      {/* Top Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px' }}>
        <div
          className="glass scrapbook-card"
          style={{ padding: '18px', borderLeft: '4px solid var(--accent-primary)', cursor: 'pointer' }}
          onClick={() => onNavigateToView('all')}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>全站錯題總數</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, marginTop: '4px', color: 'var(--accent-primary)' }}>
            {stats.total} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>題</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {stats.total === 0 ? '尚無資料' : '點擊查看全部錯題'}
          </div>
        </div>

        {categories.familiarities.filter(f => f.is_active === 1).map(f => {
          const count = stats.famCounts[f.id] || 0;
          const color = f.color === 'success' ? '#197A27' : f.color === 'warning' ? '#D97706' : f.color === 'danger' ? '#C5221F' : '#001F65';
          return (
            <div
              key={f.id}
              className="glass scrapbook-card"
              style={{ padding: '18px', borderLeft: `4px solid ${color}`, cursor: 'pointer' }}
              onClick={() => onDrilldownCategory('familiarity', f.id)}
            >
              <div style={{ fontSize: '0.8rem', color, fontWeight: 600 }}>熟悉度：{f.name}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>
                {count} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>題</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  ({formatPct(count, stats.total)})
                </span>
              </div>
            </div>
          );
        })}

        <div
          className="glass scrapbook-card"
          style={{ padding: '18px', borderLeft: '4px solid #5A6D88', cursor: 'pointer' }}
          onClick={() => onDrilldownCategory('subject', UNCATEGORIZED_ID)}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>未分類題數</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '4px' }}>
            {stats.uncategorizedCount} <span style={{ fontSize: '0.85rem', fontWeight: 400 }}>題</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({formatPct(stats.uncategorizedCount, stats.total)})
            </span>
          </div>
        </div>
      </div>

      {/* Middle Charts Grid: Subject Distribution + Error Reason Distribution */}
      <div className="grid grid-cols-2" style={{ gap: '20px' }}>
        {/* Subject Distribution */}
        <div className="glass scrapbook-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={17} style={{ color: 'var(--accent-primary)' }} />
            <span>各科目錯題分布</span>
          </h3>
          {stats.total === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              0 題（尚無資料）
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.subjects.filter(s => s.is_active === 1).map(s => {
                const count = stats.subjCounts[s.id] || 0;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div
                    key={s.id}
                    onClick={() => onDrilldownCategory('subject', s.id)}
                    style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span><strong>{count} 題</strong> ({formatPct(count, stats.total)})</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(0, 31, 101, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: 'var(--accent-primary)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Error Reason Distribution */}
        <div className="glass scrapbook-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={17} style={{ color: 'var(--warning)' }} />
            <span>主要錯因涉及率分布</span>
          </h3>
          {stats.total === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              0 題（尚無資料）
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.errorReasons.filter(r => r.is_active === 1).map(r => {
                const count = stats.reasonCounts[r.id] || 0;
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div
                    key={r.id}
                    onClick={() => onDrilldownCategory('error_reason', r.id)}
                    style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                      <span><strong>{count} 題</strong> (涉及率 {formatPct(count, stats.total)})</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(0, 31, 101, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: 'var(--accent-secondary)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Chapter & Unit Distribution + Recent Mistakes */}
      <div className="grid grid-cols-2" style={{ gap: '20px' }}>
        {/* Chapter & Unit Distribution */}
        <div className="glass scrapbook-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderTree size={17} style={{ color: 'var(--accent-secondary)' }} />
            <span>章節與單元分布</span>
          </h3>
          {categories.chapters.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              尚未建立章節與單元，可由左側目錄或分類管理新增。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {categories.chapters.map(c => {
                const subj = categories.subjects.find(s => s.id === c.parent_id);
                const cCount = stats.chapCounts[c.id] || 0;
                const childUnits = categories.units.filter(u => u.parent_id === c.id);
                return (
                  <div
                    key={c.id}
                    style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                  >
                    <div
                      onClick={() => onDrilldownCategory('chapter', c.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}
                    >
                      <span>{subj ? `${subj.name} / ` : ''}{c.name}</span>
                      <span>{cCount} 題 ({formatPct(cCount, stats.total)})</span>
                    </div>
                    {childUnits.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', paddingLeft: '8px' }}>
                        {childUnits.map(u => {
                          const uCount = stats.unitCounts[u.id] || 0;
                          return (
                            <span
                              key={u.id}
                              onClick={() => onDrilldownCategory('unit', u.id)}
                              style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                cursor: 'pointer'
                              }}
                            >
                              {u.name}: {uCount} 題
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Mistakes */}
        <div className="glass scrapbook-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={17} style={{ color: 'var(--accent-primary)' }} />
            <span>最近新增錯題</span>
          </h3>
          {stats.recentMistakes.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
              尚無錯題紀錄。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.recentMistakes.map(m => (
                <div
                  key={m.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{m.title}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {m.subject_name || '未分類'} / {m.chapter_name || '未分類'}
                      {m.unit_name ? ` / ${m.unit_name}` : ''} ｜ 熟悉度：{m.familiarity_name || '未設定'}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {m.mistake_date || new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
