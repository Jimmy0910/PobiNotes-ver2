import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from './utils/api';
import {
  type CategoriesBundle,
  type CategoryDimension,
  type FilterState,
  type MistakeRecord,
  createEmptyFilterState
} from './types';
import AuthPage from './components/AuthPage';
import Dashboard, { type AppViewType } from './components/Dashboard';
import OverviewDashboard from './components/OverviewDashboard';
import CategoryManager from './components/CategoryManager';
import AnalyticsView from './components/AnalyticsView';
import PromptGenerator from './components/PromptGenerator';
import TemplateManager from './components/TemplateManager';
import MistakeList from './components/MistakeList';
import ExportPDF from './components/ExportPDF';
import AdminPanel from './components/AdminPanel';
import UsageGuide from './components/UsageGuide';
import {
  LogOut,
  Sun,
  Moon,
  Loader2,
  MessageSquare,
  Shield,
  Trash2,
  Star,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import logoUrl from './assets/logo.png';

interface User {
  id: string;
  username: string;
  is_admin: number;
}

const EMPTY_CATEGORIES: CategoriesBundle = {
  items: [],
  subjects: [],
  chapters: [],
  units: [],
  familiarities: [],
  errorReasons: [],
  errorReasonMode: 'multi'
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  // Navigation & Hierarchy states: default to 'dashboard' (錯題統整儀表板)
  const [activeView, setActiveView] = useState<AppViewType>('dashboard');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [triggerOpenNewMistake, setTriggerOpenNewMistake] = useState(false);

  // Global synchronized Categories & Mistakes state + persistent Analytics Filter state (Requirement 8)
  const [categories, setCategories] = useState<CategoriesBundle>(EMPTY_CATEGORIES);
  const [allMistakes, setAllMistakes] = useState<MistakeRecord[]>([]);
  const [analyticsFilter, setAnalyticsFilter] = useState<FilterState>(() => createEmptyFilterState());

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return window.innerWidth < 768;
  });

  // Account delete modal states
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteConfirmUsername, setDeleteConfirmUsername] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Feedback modal states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHoverRating, setFeedbackHoverRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const refreshAllData = useCallback(async () => {
    try {
      const [catRes, mistakesRes] = await Promise.all([
        apiRequest('/api/categories'),
        apiRequest('/api/mistakes')
      ]);
      if (catRes && catRes.subjects) {
        setCategories(catRes);
      }
      if (Array.isArray(mistakesRes)) {
        setAllMistakes(mistakesRes);
      }
    } catch (e) {
      console.error('Failed to refresh global data:', e);
    }
  }, []);

  // Check login status on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await apiRequest('/api/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Load categories and mistakes whenever user logs in
  useEffect(() => {
    if (user) {
      refreshAllData();
    } else {
      setCategories(EMPTY_CATEGORIES);
      setAllMistakes([]);
      setAnalyticsFilter(createEmptyFilterState());
    }
  }, [user, refreshAllData]);

  // Listen for window resize to auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync theme to document body attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    setActiveView('dashboard');
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('登出異常：', e);
    } finally {
      setUser(null);
      setSelectedSubjectId(null);
      setSelectedChapterId(null);
      setSelectedUnitId(null);
      setActiveView('dashboard');
    }
  };

  const handleSelectHierarchy = (subjectId: string | null, chapterId: string | null, unitId: string | null) => {
    setSelectedSubjectId(subjectId);
    setSelectedChapterId(chapterId);
    setSelectedUnitId(unitId);
    if (subjectId || chapterId || unitId) {
      setActiveView('chapter');
    } else {
      setActiveView('all');
    }
  };

  const handleDrilldownFromChart = (dimension: CategoryDimension, categoryId: string) => {
    const nextFilter = createEmptyFilterState();
    if (dimension === 'subject') nextFilter.subjectIds = [categoryId];
    else if (dimension === 'chapter') nextFilter.chapterIds = [categoryId];
    else if (dimension === 'unit') nextFilter.unitIds = [categoryId];
    else if (dimension === 'familiarity') nextFilter.familiarityIds = [categoryId];
    else if (dimension === 'error_reason') nextFilter.errorReasonIds = [categoryId];

    setAnalyticsFilter(nextFilter);
    setActiveView('analytics');
  };

  const handleNavigateToExport = (mistakeIds: string[]) => {
    setSelectedExportIds(mistakeIds);
    setActiveView('export');
  };

  const handleNavigateToPrompt = (mistakeIds: string[]) => {
    setSelectedPromptIds(mistakeIds);
    setActiveView('prompt');
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmUsername !== user.username) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await apiRequest('/api/users/delete', { method: 'DELETE' });
      setUser(null);
      setShowDeleteAccountModal(false);
      setDeleteConfirmUsername('');
      setActiveView('all');
    } catch (e: any) {
      setDeleteError(e.message || '刪除帳號失敗');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openFeedbackModal = () => {
    setFeedbackRating(0);
    setFeedbackHoverRating(0);
    setFeedbackComment('');
    setFeedbackSuccess(false);
    setFeedbackError('');
    setShowFeedbackModal(true);
  };

  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setFeedbackRating(0);
    setFeedbackHoverRating(0);
    setFeedbackComment('');
    setFeedbackSuccess(false);
    setFeedbackError('');
  };

  const handleFeedbackSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (feedbackRating === 0) {
      setFeedbackError('請選擇評分星數');
      return;
    }
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      await apiRequest('/api/feedback', {
        method: 'POST',
        body: { rating: feedbackRating, comment: feedbackComment }
      });
      setFeedbackSuccess(true);
    } catch (err: any) {
      setFeedbackError(err.message || '送出回饋失敗');
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
        <span style={{ fontSize: '0.95rem', letterSpacing: '0.05em' }}>載入錯題本中...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="bg-ambient-lights" />
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="bg-ambient-lights" />

      {/* Top Navbar */}
      <header className="glass no-print top-navbar" style={{
        minHeight: 'calc(64px + var(--top-navbar-padding-top, env(safe-area-inset-top, 0px)))',
        paddingTop: 'var(--top-navbar-padding-top, env(safe-area-inset-top, 0px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Sidebar Toggle Button in Header (also satisfies E2E first toggle button lookup) */}
          <button
            onClick={() => setSidebarCollapsed(prev => !prev)}
            className="btn btn-secondary toggle-btn"
            style={{ padding: '7px 10px', border: 'none' }}
            title={sidebarCollapsed ? '展開側邊欄' : '收折側邊欄'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          <div
            className="navbar-brand"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => setActiveView('dashboard')}
            title="點擊回儀表板首頁"
          >
            <img
              src={logoUrl}
              alt="PobiNotes Logo"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                objectFit: 'contain'
              }}
            />
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }} className="title-gradient navbar-title">
              PobiNotes-線上錯題本
            </h1>
          </div>
        </div>

        {/* Quick Top Navigation Pills */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className={`btn ${activeView === 'dashboard' ? 'btn-primary' : 'btn-text'}`}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            儀表板
          </button>
          <button
            type="button"
            onClick={() => handleSelectHierarchy(null, null, null)}
            className={`btn ${activeView === 'all' ? 'btn-primary' : 'btn-text'}`}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            所有錯題
          </button>
          <button
            type="button"
            onClick={() => setActiveView('categories')}
            className={`btn ${activeView === 'categories' ? 'btn-primary' : 'btn-text'}`}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            分類管理
          </button>
          <button
            type="button"
            onClick={() => setActiveView('analytics')}
            className={`btn ${activeView === 'analytics' ? 'btn-primary' : 'btn-text'}`}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            錯題分析
          </button>
          <button
            type="button"
            onClick={() => setActiveView('prompt')}
            className={`btn ${activeView === 'prompt' ? 'btn-primary' : 'btn-text'}`}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            提詞產生器
          </button>
          <button
            type="button"
            onClick={() => setActiveView('export')}
            className={`btn ${activeView === 'export' ? 'btn-primary' : 'btn-text'}`}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            PDF 匯出
          </button>
        </div>

        <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', border: 'none' }}
            title={theme === 'dark' ? '切換淺色模式' : '切換深色模式'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Feedback Button */}
          <button
            onClick={openFeedbackModal}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <MessageSquare size={16} /> <span className="navbar-btn-text">意見回饋</span>
          </button>

          {/* Admin Panel Button */}
          {user.is_admin === 1 && (
            <button
              onClick={() => setActiveView('admin')}
              className={`btn ${activeView === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <Shield size={16} /> <span className="navbar-btn-text">管理員控制台</span>
            </button>
          )}

          {/* User info */}
          <span className="navbar-user-info" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            哈囉, <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong>
          </span>

          {/* Delete Account */}
          <button
            onClick={() => setShowDeleteAccountModal(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.85rem', color: 'var(--danger)' }}
            title="刪除帳號"
          >
            <Trash2 size={16} /> <span className="navbar-btn-text">刪除帳號</span>
          </button>

          {/* Logout */}
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            <LogOut size={16} /> <span className="navbar-btn-text">登出</span>
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="main-layout" style={{ display: 'flex', flex: 1 }}>
        {activeView !== 'export' && activeView !== 'admin' && (
          <Dashboard
            categories={categories}
            onRefreshCategories={refreshAllData}
            onSelectHierarchy={handleSelectHierarchy}
            selectedSubjectId={selectedSubjectId}
            selectedChapterId={selectedChapterId}
            selectedUnitId={selectedUnitId}
            onNavigateView={view => setActiveView(view)}
            activeView={activeView}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          />
        )}

        {/* View Routing */}
        {activeView === 'all' && (
          <MistakeList
            categories={categories}
            subjectId={null}
            chapterId={null}
            unitId={null}
            onNavigateToExport={handleNavigateToExport}
            onNavigateToPrompt={handleNavigateToPrompt}
            onRefreshAll={refreshAllData}
            onImageClick={src => setZoomedImage(src)}
            externalOpenEditor={triggerOpenNewMistake}
            onClearExternalOpenEditor={() => setTriggerOpenNewMistake(false)}
          />
        )}

        {activeView === 'chapter' && (
          <MistakeList
            categories={categories}
            subjectId={selectedSubjectId}
            chapterId={selectedChapterId}
            unitId={selectedUnitId}
            onSelectUnit={uId => setSelectedUnitId(uId)}
            onNavigateToExport={handleNavigateToExport}
            onNavigateToPrompt={handleNavigateToPrompt}
            onRefreshAll={refreshAllData}
            onImageClick={src => setZoomedImage(src)}
          />
        )}

        {activeView === 'dashboard' && (
          <OverviewDashboard
            mistakes={allMistakes}
            categories={categories}
            onDrilldownCategory={handleDrilldownFromChart}
            onNavigateToView={view => setActiveView(view)}
            onOpenNewMistake={() => {
              setActiveView('all');
              setTriggerOpenNewMistake(true);
            }}
          />
        )}

        {activeView === 'categories' && (
          <CategoryManager
            categories={categories}
            onRefresh={refreshAllData}
            onDrilldownCategory={handleDrilldownFromChart}
          />
        )}

        {activeView === 'analytics' && (
          <AnalyticsView
            mistakes={allMistakes}
            categories={categories}
            filter={analyticsFilter}
            onChangeFilter={setAnalyticsFilter}
            onNavigateToPrompt={handleNavigateToPrompt}
            onNavigateToExport={handleNavigateToExport}
            onNavigateToMistakeListWithFilter={nextFilter => {
              setAnalyticsFilter(nextFilter);
            }}
          />
        )}

        {activeView === 'prompt' && (
          <PromptGenerator
            mistakes={allMistakes}
            categories={categories}
            filter={analyticsFilter}
            preselectedMistakeIds={selectedPromptIds}
          />
        )}

        {activeView === 'templates' && (
          <TemplateManager />
        )}

        {activeView === 'guide' && (
          <UsageGuide />
        )}

        {activeView === 'export' && (
          <ExportPDF
            mistakeIds={selectedExportIds.length > 0 ? selectedExportIds : allMistakes.map(m => m.id)}
            onBack={() => setActiveView(selectedChapterId ? 'chapter' : 'all')}
            onImageClick={src => setZoomedImage(src)}
          />
        )}

        {activeView === 'admin' && user.is_admin === 1 && (
          <AdminPanel />
        )}
      </div>

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="modal-overlay" onClick={() => { setShowDeleteAccountModal(false); setDeleteConfirmUsername(''); setDeleteError(''); }}>
          <div className="glass modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={20} /> 刪除帳號
              </h3>
              <button onClick={() => { setShowDeleteAccountModal(false); setDeleteConfirmUsername(''); setDeleteError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem', lineHeight: 1.6 }}>
              此操作將<strong style={{ color: 'var(--danger)' }}>永久刪除</strong>您的帳號及所有相關資料，且<strong>無法復原</strong>。
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
              請輸入您的使用者名稱 <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong> 以確認刪除：
            </p>
            {deleteError && (
              <div style={{ background: 'var(--danger-glow)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '0.85rem' }}>
                {deleteError}
              </div>
            )}
            <input
              type="text"
              className="input"
              placeholder="輸入使用者名稱以確認輸入"
              value={deleteConfirmUsername}
              onChange={e => setDeleteConfirmUsername(e.target.value)}
              style={{ marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setShowDeleteAccountModal(false); setDeleteConfirmUsername(''); setDeleteError(''); }}>
                取消
              </button>
              <button
                className="btn btn-danger"
                disabled={deleteConfirmUsername !== user.username || deleteLoading}
                onClick={handleDeleteAccount}
              >
                {deleteLoading ? '刪除中...' : '確認刪除帳號'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="modal-overlay" onClick={closeFeedbackModal}>
          <div className="glass modal-content animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="title-gradient">
                <MessageSquare size={20} /> 意見回饋
              </h3>
              <button onClick={closeFeedbackModal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {feedbackSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ color: 'var(--success)', fontWeight: 600, fontSize: '1.1rem', marginBottom: '8px' }}>感謝您的回饋！</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>您的意見對我們非常重要。</p>
                <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={closeFeedbackModal}>
                  關閉
                </button>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit}>
                {/* Star Rating */}
                <div style={{ marginBottom: '20px' }}>
                  <label className="form-label">評分</label>
                  <div style={{ display: 'flex', gap: '4px', cursor: 'pointer' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        onMouseEnter={() => setFeedbackHoverRating(star)}
                        onMouseLeave={() => setFeedbackHoverRating(0)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', transition: 'transform 0.15s' }}
                      >
                        <Star
                          size={32}
                          onClick={() => setFeedbackRating(star)}
                          fill={(feedbackHoverRating || feedbackRating) >= star ? 'var(--warning)' : 'none'}
                          color={(feedbackHoverRating || feedbackRating) >= star ? 'var(--warning)' : 'var(--text-muted)'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div className="form-group">
                  <label className="form-label">留言（選填）</label>
                  <textarea
                    className="input"
                    style={{ minHeight: '100px', resize: 'vertical' }}
                    placeholder="請輸入您的意見或建議..."
                    value={feedbackComment}
                    onChange={e => setFeedbackComment(e.target.value)}
                  />
                </div>

                {feedbackError && (
                  <div style={{ background: 'var(--danger-glow)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px', borderRadius: 'var(--radius-md)', marginBottom: '12px', fontSize: '0.85rem' }}>
                    {feedbackError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={closeFeedbackModal}>取消</button>
                  <button type="submit" className="btn btn-primary" disabled={feedbackRating === 0 || feedbackLoading}>
                    {feedbackLoading ? '送出中...' : '送出回饋'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Global Image Lightbox Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
            padding: '20px'
          }}
        >
          <img
            src={zoomedImage}
            alt="放大顯示"
            style={{
              maxWidth: '95%',
              maxHeight: '95%',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              border: '2px solid rgba(255,255,255,0.1)'
            }}
          />
        </div>
      )}
    </div>
  );
}
