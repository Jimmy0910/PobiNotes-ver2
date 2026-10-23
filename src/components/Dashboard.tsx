import { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../utils/api';
import type { CategoriesBundle } from '../types';
import {
  Folder,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  Settings,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  LayoutDashboard,
  FolderTree,
  BarChart3,
  Sparkles,
  FileDown,
  Layers,
  Tag
} from 'lucide-react';

export type AppViewType =
  | 'all'
  | 'dashboard'
  | 'chapter'
  | 'categories'
  | 'analytics'
  | 'prompt'
  | 'templates'
  | 'export'
  | 'admin'
  | 'guide';

interface DashboardProps {
  categories: CategoriesBundle;
  onRefreshCategories: () => Promise<void>;
  onSelectHierarchy: (subjectId: string | null, chapterId: string | null, unitId: string | null) => void;
  selectedSubjectId: string | null;
  selectedChapterId: string | null;
  selectedUnitId: string | null;
  onNavigateView: (view: AppViewType) => void;
  activeView: AppViewType;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Dashboard({
  categories,
  onRefreshCategories,
  onSelectHierarchy,
  selectedSubjectId,
  selectedChapterId,
  selectedUnitId,
  onNavigateView,
  activeView,
  collapsed,
  onToggleCollapse
}: DashboardProps) {
  const [expandedSubjects, setExpandedSubjects] = useState<{ [subjectId: string]: boolean }>({});
  const [expandedChapters, setExpandedChapters] = useState<{ [chapterId: string]: boolean }>({});

  // Inline creation states
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);

  const [newChapterName, setNewChapterName] = useState<{ [subjectId: string]: string }>({});
  const [showAddChapter, setShowAddChapter] = useState<{ [subjectId: string]: boolean }>({});

  const [newUnitName, setNewUnitName] = useState<{ [chapterId: string]: string }>({});
  const [showAddUnit, setShowAddUnit] = useState<{ [chapterId: string]: boolean }>({});

  // Chapter delete confirmation modal state (Two explicit choices: keep mistakes vs delete mistakes)
  const [deleteChapterTarget, setDeleteChapterTarget] = useState<{
    id: string;
    name: string;
    mistakeCount: number;
  } | null>(null);
  const [deletingChapter, setDeletingChapter] = useState(false);

  // Standalone Left-Sidebar Error Reason Management Panel state
  const [errorPanelExpanded, setErrorPanelExpanded] = useState(true);
  const [errScopeType, setErrScopeType] = useState<'global' | 'subject' | 'chapter'>('global');
  const [errSubjectId, setErrSubjectId] = useState<string>('');
  const [errChapterId, setErrChapterId] = useState<string>('');
  const [newErrorReasonText, setNewErrorReasonText] = useState('');
  const [addingErrorReason, setAddingErrorReason] = useState(false);

  // Sync error reason panel subject/chapter defaults when user clicks a Subject or Chapter in the tree
  useEffect(() => {
    if (selectedChapterId) {
      const ch = categories.chapters.find(c => c.id === selectedChapterId);
      if (ch?.parent_id) setErrSubjectId(ch.parent_id);
      setErrChapterId(selectedChapterId);
      setErrScopeType('chapter');
    } else if (selectedSubjectId) {
      setErrSubjectId(selectedSubjectId);
      setErrChapterId('');
      setErrScopeType('subject');
    }
  }, [selectedSubjectId, selectedChapterId, categories.chapters]);

  const errSubjectChapters = useMemo(() => {
    if (!errSubjectId) return [];
    return categories.chapters.filter(c => c.parent_id === errSubjectId && c.is_active === 1);
  }, [categories.chapters, errSubjectId]);

  const sidebarScopedErrorReasons = useMemo(() => {
    const activeList = categories.errorReasons.filter(r => r.is_active === 1);
    if (errScopeType === 'global') {
      return activeList.filter(r => !r.parent_id);
    }
    if (errScopeType === 'subject') {
      if (!errSubjectId) return [];
      return activeList.filter(r => r.parent_id === errSubjectId);
    }
    if (errScopeType === 'chapter') {
      if (!errChapterId) return [];
      return activeList.filter(r => r.parent_id === errChapterId);
    }
    return activeList;
  }, [categories.errorReasons, errScopeType, errSubjectId, errChapterId]);

  const handleSidebarAddErrorReason = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newErrorReasonText.trim();
    if (!trimmed) return;

    let parentId: string | null = null;
    if (errScopeType === 'subject') {
      if (!errSubjectId) {
        alert('請先選擇要設定錯因的「科目」！');
        return;
      }
      parentId = errSubjectId;
    } else if (errScopeType === 'chapter') {
      if (!errChapterId) {
        alert('請先選擇要設定錯因的「科目」與「章節」！');
        return;
      }
      parentId = errChapterId;
    }

    setAddingErrorReason(true);
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: {
          dimension: 'error_reason',
          name: trimmed,
          parentId
        }
      });
      setNewErrorReasonText('');
      await onRefreshCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : '新增錯因失敗');
    } finally {
      setAddingErrorReason(false);
    }
  };

  const handleSidebarRenameErrorReason = async (reasonId: string, currentName: string) => {
    const nextName = prompt('修改錯因標籤名稱：', currentName);
    if (!nextName || nextName.trim() === currentName) return;
    try {
      await apiRequest('/api/categories', {
        method: 'PUT',
        body: {
          dimension: 'error_reason',
          id: reasonId,
          name: nextName.trim()
        }
      });
      await onRefreshCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : '修改錯因失敗');
    }
  };

  const handleSidebarDeleteErrorReason = async (reasonId: string, name: string) => {
    if (!confirm(`確定要刪除錯因標籤「${name}」嗎？（既有錯題不會被刪除，僅會移除此錯因標記）`)) return;
    try {
      await apiRequest('/api/categories', {
        method: 'DELETE',
        body: {
          id: reasonId,
          mode: 'unassign'
        }
      });
      await onRefreshCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : '刪除錯因失敗');
    }
  };

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects(prev => ({ ...prev, [subjectId]: !prev[subjectId] }));
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    try {
      await apiRequest('/api/subjects', {
        method: 'POST',
        body: { name: newSubjectName.trim() }
      });
      setNewSubjectName('');
      setShowAddSubject(false);
      await onRefreshCategories();
    } catch (e) {
      alert(e instanceof Error ? e.message : '新增科目失敗');
    }
  };

  const handleRenameSubject = async (subjectId: string, currentName: string) => {
    const name = prompt('重命名科目：', currentName);
    if (!name || name.trim() === currentName) return;
    try {
      await apiRequest('/api/subjects', {
        method: 'PUT',
        body: { id: subjectId, name: name.trim() }
      });
      await onRefreshCategories();
    } catch (e) {
      alert(e instanceof Error ? e.message : '修改失敗');
    }
  };

  const handleDeleteSubject = async (subjectId: string, name: string) => {
    if (!confirm(`確定要刪除「${name}」科目嗎？（底下錯題將保留並轉為未分類，或可至「分類管理」進階搬移）`)) return;
    try {
      await apiRequest(`/api/subjects?id=${subjectId}&mode=unassign`, {
        method: 'DELETE'
      });
      if (selectedSubjectId === subjectId) {
        onSelectHierarchy(null, null, null);
      }
      await onRefreshCategories();
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  const handleAddChapter = async (subjectId: string) => {
    const name = newChapterName[subjectId] || '';
    if (!name.trim()) return;
    try {
      await apiRequest('/api/chapters', {
        method: 'POST',
        body: { name: name.trim(), subjectId }
      });
      setNewChapterName(prev => ({ ...prev, [subjectId]: '' }));
      setShowAddChapter(prev => ({ ...prev, [subjectId]: false }));
      setExpandedSubjects(prev => ({ ...prev, [subjectId]: true }));
      await onRefreshCategories();
    } catch (e) {
      alert(e instanceof Error ? e.message : '新增章節失敗');
    }
  };

  const handleRenameChapter = async (chapterId: string, currentName: string) => {
    const name = prompt('重命名章節：', currentName);
    if (!name || name.trim() === currentName) return;
    try {
      await apiRequest('/api/chapters', {
        method: 'PUT',
        body: { id: chapterId, name: name.trim() }
      });
      await onRefreshCategories();
    } catch (e) {
      alert(e instanceof Error ? e.message : '修改失敗');
    }
  };

  const handleDeleteChapter = (chapterId: string, name: string) => {
    const chapObj = categories.chapters.find(c => c.id === chapterId);
    setDeleteChapterTarget({
      id: chapterId,
      name,
      mistakeCount: chapObj?.mistake_count || 0
    });
  };

  const executeDeleteChapter = async (mode: 'unassign' | 'purge') => {
    if (!deleteChapterTarget) return;
    setDeletingChapter(true);
    try {
      await apiRequest(`/api/chapters?id=${deleteChapterTarget.id}&mode=${mode}`, {
        method: 'DELETE'
      });
      if (selectedChapterId === deleteChapterTarget.id) {
        onSelectHierarchy(null, null, null);
      }
      setDeleteChapterTarget(null);
      await onRefreshCategories();
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    } finally {
      setDeletingChapter(false);
    }
  };

  const handleAddUnit = async (chapterId: string) => {
    const name = newUnitName[chapterId] || '';
    if (!name.trim()) return;
    try {
      await apiRequest('/api/categories', {
        method: 'POST',
        body: { dimension: 'unit', name: name.trim(), parentId: chapterId }
      });
      setNewUnitName(prev => ({ ...prev, [chapterId]: '' }));
      setShowAddUnit(prev => ({ ...prev, [chapterId]: false }));
      setExpandedChapters(prev => ({ ...prev, [chapterId]: true }));
      await onRefreshCategories();
    } catch (e) {
      alert(e instanceof Error ? e.message : '新增單元失敗');
    }
  };

  const activeSubjects = categories.subjects.filter(s => s.is_active === 1);

  return (
    <div
      className={`sidebar sidebar-container no-print ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
      style={{
        borderRight: '1px solid var(--glass-border)',
        background: 'rgba(0, 0, 0, 0.15)',
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        width: collapsed ? '48px' : '325px'
      }}
    >
      {/* Collapse Toggle Button */}
      <div style={{
        padding: '8px',
        borderBottom: collapsed ? 'none' : '1px solid var(--glass-border)',
        display: 'flex',
        justifyContent: collapsed ? 'center' : 'flex-end'
      }}>
        <button
          onClick={onToggleCollapse}
          className="btn btn-secondary toggle-sidebar-btn"
          style={{ padding: '6px 8px', border: 'none' }}
          title={collapsed ? '展開側邊欄' : '收折側邊欄'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span style={{ display: 'none' }}>{collapsed ? '展開' : '收折'}</span>
        </button>
      </div>

      {/* Sidebar Content - hidden when collapsed */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Header for 3-level hierarchy: Subject -> Chapter -> Unit (Placed with inline + button for quick access) */}
          <div style={{
            padding: '12px 16px 4px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            <span>1. 學科 / 章節 / 單元目錄</span>
            <button
              onClick={() => setShowAddSubject(!showAddSubject)}
              className="btn-sidebar-add"
              title="快速新增科目"
              data-testid="sidebar-add-subject-btn"
            >
              <Plus size={13} /> 剪貼新增科目
            </button>
          </div>
          <div style={{ padding: '0 16px 8px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            提示：點擊科目可展開章節；點擊右側「+」可剪貼新增章節或細部單元
          </div>

          {/* Inline add subject form - Memo Note Style */}
          {showAddSubject && (
            <form onSubmit={handleAddSubject} style={{ padding: '4px 14px 10px 14px' }}>
              <div className="memo-note washi-tape-strip" style={{ padding: '12px 10px 8px 10px', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-secondary)', marginBottom: '4px' }}>
                  剪貼新增科目便條
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="input"
                    style={{ padding: '6px 10px', fontSize: '0.86rem' }}
                    placeholder="科目名稱 (例如：生物)"
                    value={newSubjectName}
                    onChange={e => setNewSubjectName(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    新增
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Subjects -> Chapters -> Units Tree */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px 8px', borderBottom: '1px solid var(--glass-border)' }}>
            {activeSubjects.map(subject => {
              const isExpanded = !!expandedSubjects[subject.id];
              const chapters = categories.chapters.filter(c => c.parent_id === subject.id && c.is_active === 1);
              const isSubjectSelected = activeView === 'chapter' && selectedSubjectId === subject.id && !selectedChapterId;

              return (
                <div key={subject.id} style={{ marginBottom: '4px' }}>
                  {/* Subject Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      justifyContent: 'space-between',
                      background: isSubjectSelected ? 'rgba(99, 102, 241, 0.18)' : isExpanded ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    className="btn-secondary-hover-bg"
                    onClick={() => toggleSubject(subject.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden' }}>
                      {isExpanded ? <ChevronDown size={15} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-secondary)' }} />}
                      <Folder size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                      <span style={{
                        fontWeight: 500,
                        fontSize: '0.9rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {subject.name}
                      </span>
                    </div>

                    {/* Subject Actions */}
                    <div style={{ display: 'flex', gap: '4px', position: 'relative', zIndex: 10, flexShrink: 0 }} className="actions-wrapper">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleRenameSubject(subject.id, subject.name);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', position: 'relative', zIndex: 11 }}
                        title="重新命名科目"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteSubject(subject.id, subject.name);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', position: 'relative', zIndex: 11 }}
                        title="刪除科目"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (!isExpanded) toggleSubject(subject.id);
                          setShowAddChapter(prev => ({ ...prev, [subject.id]: !prev[subject.id] }));
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', position: 'relative', zIndex: 11 }}
                        title="在此科目下新增章節"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Chapters under Subject */}
                  {isExpanded && (
                    <div style={{ paddingLeft: '20px', marginTop: '2px' }}>
                      {showAddChapter[subject.id] && (
                        <div className="memo-note washi-tape-strip" style={{ margin: '6px 4px 8px 4px', padding: '10px 8px 6px 8px', background: 'var(--bg-secondary)' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-secondary)', marginBottom: '3px' }}>
                            剪貼新增章節便條
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="text"
                              className="input"
                              style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                              placeholder="新增章節名稱..."
                              value={newChapterName[subject.id] || ''}
                              onChange={e => setNewChapterName(prev => ({ ...prev, [subject.id]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleAddChapter(subject.id);
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleAddChapter(subject.id)}
                              className="btn btn-primary"
                              style={{ padding: '4px 8px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                            >
                              新增
                            </button>
                          </div>
                        </div>
                      )}

                      {chapters.length === 0 && !showAddChapter[subject.id] && (
                        <div style={{ padding: '6px 10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          尚無章節
                        </div>
                      )}

                      {chapters.map(chapter => {
                        const isSelected = activeView === 'chapter' && selectedChapterId === chapter.id && !selectedUnitId;
                        const units = categories.units.filter(u => u.parent_id === chapter.id && u.is_active === 1);
                        const isChapExpanded = expandedChapters[chapter.id] ?? true;

                        return (
                          <div key={chapter.id} style={{ marginBottom: '2px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 10px',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                background: isSelected ? 'var(--accent-gradient)' : 'transparent',
                                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                transition: 'background 0.2s'
                              }}
                              onClick={() => {
                                toggleChapter(chapter.id);
                                onSelectHierarchy(subject.id, chapter.id, null);
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                <FileText size={13} style={{ flexShrink: 0 }} />
                                <span style={{
                                  fontSize: '0.86rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {chapter.name}
                                </span>
                              </div>

                              {/* Chapter Actions */}
                              <div style={{ display: 'flex', gap: '4px', position: 'relative', zIndex: 10, flexShrink: 0 }}>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleRenameChapter(chapter.id, chapter.name);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                                    cursor: 'pointer'
                                  }}
                                  title="重命名章節"
                                >
                                  <Edit2 size={10} />
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    handleDeleteChapter(chapter.id, chapter.name);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                                    cursor: 'pointer'
                                  }}
                                  title="刪除章節"
                                >
                                  <Trash2 size={10} />
                                </button>
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setExpandedChapters(prev => ({ ...prev, [chapter.id]: true }));
                                    setShowAddUnit(prev => ({ ...prev, [chapter.id]: !prev[chapter.id] }));
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                                    cursor: 'pointer'
                                  }}
                                  title="在此章節下新增單元"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Units under Chapter */}
                            {isChapExpanded && (units.length > 0 || showAddUnit[chapter.id]) && (
                              <div style={{ paddingLeft: '18px', marginTop: '2px' }}>
                                {showAddUnit[chapter.id] && (
                                  <div className="memo-note washi-tape-strip" style={{ margin: '4px 2px 6px 2px', padding: '8px 6px 4px 6px', background: 'var(--bg-secondary)' }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--accent-secondary)', marginBottom: '3px' }}>
                                      剪貼新增單元便條
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <input
                                        type="text"
                                        className="input"
                                        style={{ padding: '3px 6px', fontSize: '0.78rem' }}
                                        placeholder="新增單元名稱..."
                                        value={newUnitName[chapter.id] || ''}
                                        onChange={e => setNewUnitName(prev => ({ ...prev, [chapter.id]: e.target.value }))}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleAddUnit(chapter.id);
                                        }}
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleAddUnit(chapter.id)}
                                        className="btn btn-primary"
                                        style={{ padding: '3px 6px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                      >
                                        新增
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {units.map(unit => {
                                  const isUnitSelected = activeView === 'chapter' && selectedUnitId === unit.id;
                                  return (
                                    <div
                                      key={unit.id}
                                      onClick={() => onSelectHierarchy(subject.id, chapter.id, unit.id)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        background: isUnitSelected ? 'rgba(16, 185, 129, 0.22)' : 'transparent',
                                        color: isUnitSelected ? '#10b981' : 'var(--text-muted)'
                                      }}
                                    >
                                      <Layers size={11} style={{ flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {unit.name}
                                      </span>
                                    </div>
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
              );
            })}

            {activeSubjects.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px', fontSize: '0.85rem' }}>
                尚未建立科目，請點擊上方「+ 新增科目」按鈕。
              </div>
            )}
          </div>

          {/* Standalone Error Reason Management Panel (Left Sidebar) */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--glass-border)',
              background: 'rgba(245, 158, 11, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
            data-testid="sidebar-error-reason-panel"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => setErrorPanelExpanded(prev => !prev)}
            >
              <span className="sidebar-section2-title">
                <Tag size={14} />
                <span>2. 錯因標籤設定（獨立面板）</span>
              </span>
              {errorPanelExpanded ? <ChevronDown size={15} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-secondary)' }} />}
            </div>

            {errorPanelExpanded && (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  提示：選擇「通用 / 特定科目 / 章節」，即可為該範圍新增或刪除錯因標籤：
                </div>

                {/* Scope Selector Dropdowns */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <select
                    className="input"
                    style={{ padding: '5px 8px', fontSize: '0.8rem', height: '32px' }}
                    value={errScopeType}
                    onChange={e => {
                      const next = e.target.value as 'global' | 'subject' | 'chapter';
                      setErrScopeType(next);
                      if (next !== 'global' && !errSubjectId && activeSubjects.length > 0) {
                        setErrSubjectId(activeSubjects[0].id);
                      }
                    }}
                    data-testid="sidebar-error-scope-type"
                  >
                    <option value="global">全科目通用錯因</option>
                    <option value="subject">特定科目專屬錯因</option>
                    <option value="chapter">特定章節專屬錯因</option>
                  </select>

                  {(errScopeType === 'subject' || errScopeType === 'chapter') && (
                    <select
                      className="input"
                      style={{ padding: '5px 8px', fontSize: '0.8rem', height: '32px' }}
                      value={errSubjectId}
                      onChange={e => {
                        setErrSubjectId(e.target.value);
                        setErrChapterId('');
                      }}
                      data-testid="sidebar-error-subject-select"
                    >
                      <option value="">-- 請選擇科目 --</option>
                      {activeSubjects.map(s => (
                        <option key={s.id} value={s.id}>科目：{s.name}</option>
                      ))}
                    </select>
                  )}

                  {errScopeType === 'chapter' && (
                    <select
                      className="input"
                      style={{ padding: '5px 8px', fontSize: '0.8rem', height: '32px' }}
                      value={errChapterId}
                      onChange={e => setErrChapterId(e.target.value)}
                      disabled={!errSubjectId}
                      data-testid="sidebar-error-chapter-select"
                    >
                      <option value="">{errSubjectId ? '-- 請選擇章節 --' : '-- 請先選擇上方科目 --'}</option>
                      {errSubjectChapters.map(c => (
                        <option key={c.id} value={c.id}>章節：{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Add Error Reason Form */}
                <form onSubmit={handleSidebarAddErrorReason} style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    className="input"
                    style={{ flex: 1, padding: '5px 8px', fontSize: '0.8rem', height: '32px' }}
                    placeholder={
                      errScopeType === 'global'
                        ? '輸入新通用錯因（如：審題不清）...'
                        : errScopeType === 'subject'
                        ? '輸入此科目專屬錯因...'
                        : '輸入此章節專屬錯因...'
                    }
                    value={newErrorReasonText}
                    onChange={e => setNewErrorReasonText(e.target.value)}
                    data-testid="sidebar-error-add-input"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ padding: '0 10px', fontSize: '0.78rem', height: '32px', whiteSpace: 'nowrap' }}
                    disabled={addingErrorReason || !newErrorReasonText.trim()}
                    data-testid="sidebar-error-add-btn"
                  >
                    <Plus size={13} /> 新增
                  </button>
                </form>

                {/* List of Error Reasons in Current Scope (with Edit & Delete) */}
                <div style={{
                  maxHeight: '150px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  paddingRight: '2px'
                }}>
                  {sidebarScopedErrorReasons.length === 0 ? (
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', padding: '6px 4px', textAlign: 'center' }}>
                      {errScopeType === 'subject' && !errSubjectId
                        ? '請先選擇科目以查看或新增錯因'
                        : errScopeType === 'chapter' && !errChapterId
                        ? '請先選擇章節以查看或新增錯因'
                        : '此範圍尚無錯因標籤，請於上方輸入新增'}
                    </div>
                  ) : (
                    sidebarScopedErrorReasons.map(r => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--glass-border)',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <span className={errScopeType === 'global' ? 'scope-badge-global' : errScopeType === 'subject' ? 'scope-badge-subject' : 'scope-badge-chapter'}>
                            {errScopeType === 'global' ? '通用' : errScopeType === 'subject' ? '科目' : '章節'}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                            {r.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => handleSidebarRenameErrorReason(r.id, r.name)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                            title="重新命名錯因"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSidebarDeleteErrorReason(r.id, r.name)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '2px' }}
                            title="刪除此錯因標籤"
                            data-testid={`sidebar-delete-error-reason-${r.name}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Primary Navigation Menu (Requirement 10) */}
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '2px' }}>
              3. 功能導覽選單
            </div>
            <button
              onClick={() => onNavigateView('dashboard')}
              className={`btn ${activeView === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 12px', fontSize: '0.85rem' }}
              data-testid="nav-dashboard"
              title="一覽各科題數、熟悉度分布與近期錯題"
            >
              <LayoutDashboard size={15} />
              <span>儀表板總覽（錯題統整）</span>
            </button>

            <button
              onClick={() => onSelectHierarchy(null, null, null)}
              className={`btn ${activeView === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 12px', fontSize: '0.85rem' }}
              data-testid="nav-all-mistakes"
              title="瀏覽、搜尋與新增所有錯題卡片"
            >
              <BookOpen size={15} />
              <span>所有錯題（題庫與新增）</span>
            </button>

            <button
              onClick={() => onNavigateView('categories')}
              className={`btn ${activeView === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 12px', fontSize: '0.85rem' }}
              data-testid="nav-categories"
              title="進階排序、停用或重新指派五大分類維度"
            >
              <FolderTree size={15} />
              <span>分類管理（進階設定）</span>
            </button>

            <button
              onClick={() => onNavigateView('analytics')}
              className={`btn ${activeView === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 12px', fontSize: '0.85rem' }}
              data-testid="nav-analytics"
              title="依科目、章節、錯因動態篩選並查看百分比圖表"
            >
              <BarChart3 size={15} />
              <span>錯題分析（圖表統計）</span>
            </button>

            <button
              onClick={() => onNavigateView('prompt')}
              className={`btn ${activeView === 'prompt' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 12px', fontSize: '0.85rem' }}
              data-testid="nav-prompt"
              title="將錯題自動整理成可複製給 ChatGPT / Claude / Gemini 的複習提詞"
            >
              <Sparkles size={15} />
              <span>提詞產生器（AI 複習提詞）</span>
            </button>

            <button
              onClick={() => onNavigateView('export')}
              className={`btn ${activeView === 'export' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 12px', fontSize: '0.85rem' }}
              data-testid="nav-export"
              title="將勾選的錯題排版印出成空白練習卷或詳解卷"
            >
              <FileDown size={15} />
              <span>PDF 匯出（練習卷 / 解析卷）</span>
            </button>

            <button
              onClick={() => onNavigateView('templates')}
              className={`btn ${activeView === 'templates' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 12px', fontSize: '0.85rem' }}
              data-testid="nav-templates"
              title="自訂錯題卡片的題目與解析欄位結構"
            >
              <Settings size={15} />
              <span>自訂模板管理</span>
            </button>

            <button
              onClick={() => onNavigateView('guide')}
              className={`btn ${activeView === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '7px 12px', fontSize: '0.85rem' }}
              data-testid="nav-guide"
              title="查看完整圖文功能介紹與操作說明"
            >
              <HelpCircle size={15} />
              <span>使用說明與教學</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Chapter Two-Choice Modal */}
      {deleteChapterTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '20px'
          }}
          data-testid="sidebar-delete-chapter-modal"
        >
          <div className="glass" style={{ maxWidth: '480px', width: '100%', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              刪除章節「{deleteChapterTarget.name}」
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              此章節目前關聯了 <strong style={{ color: '#fbbf24' }}>{deleteChapterTarget.mistakeCount} 道錯題</strong>。請選擇刪除章節時的錯題處理方式：
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                  textAlign: 'left',
                  width: '100%'
                }}
                disabled={deletingChapter}
                onClick={() => executeDeleteChapter('unassign')}
                data-testid="chapter-delete-keep-mistakes-btn"
              >
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>1. 保留錯題（僅刪除章節）</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 400 }}>
                  刪除章節與單元，但保留底下所有錯題紀錄（自動轉為未分類章節，資料不遺失）
                </span>
              </button>

              <button
                type="button"
                className="btn btn-danger"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                  textAlign: 'left',
                  width: '100%'
                }}
                disabled={deletingChapter}
                onClick={() => executeDeleteChapter('purge')}
                data-testid="chapter-delete-purge-mistakes-btn"
              >
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>2. 連同錯題一起刪除</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 400 }}>
                  永久刪除此章節以及底下關聯的 {deleteChapterTarget.mistakeCount} 道錯題紀錄
                </span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '7px 16px', fontSize: '0.85rem' }}
                disabled={deletingChapter}
                onClick={() => setDeleteChapterTarget(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
