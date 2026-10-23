import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Users, MessageSquare, Trash2, Star, Loader2 } from 'lucide-react';

interface AdminUser {
  id: string;
  username: string;
  is_admin: number;
  created_at: string;
}

interface FeedbackItem {
  id: string;
  user_id: string;
  username?: string;
  rating: number;
  comment: string;
  created_at: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'feedback'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/api/admin/users');
      setUsers(Array.isArray(res) ? res : res.users || []);
    } catch (e: any) {
      setError(e.message || '無法載入用戶列表');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedback = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/api/feedback');
      setFeedbackList(Array.isArray(res) ? res : res.feedback || []);
    } catch (e: any) {
      setError(e.message || '無法載入意見回饋');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else {
      fetchFeedback();
    }
  }, [activeTab]);

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`確定要刪除用戶「${username}」嗎？此操作無法復原！`)) return;
    try {
      await apiRequest(`/api/admin/users/${userId}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e: any) {
      alert(e.message || '刪除用戶失敗');
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        fill={i < rating ? 'var(--warning)' : 'none'}
        color={i < rating ? 'var(--warning)' : 'var(--text-muted)'}
      />
    ));
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        // Try treating as unix timestamp (seconds)
        const ts = Number(dateStr);
        if (!isNaN(ts)) {
          return new Date(ts < 1e12 ? ts * 1000 : ts).toLocaleString('zh-TW');
        }
        return dateStr;
      }
      return d.toLocaleString('zh-TW');
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ flex: 1, padding: '24px', overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '24px' }} className="title-gradient">
          管理員面板
        </h2>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} /> 用戶管理
          </button>
          <button
            className={`btn ${activeTab === 'feedback' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('feedback')}
          >
            <MessageSquare size={16} /> 用戶回饋
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            background: 'var(--danger-glow)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <Loader2 size={24} className="animate-spin" style={{ marginBottom: '8px' }} />
            <div>載入中...</div>
          </div>
        )}

        {/* Users Tab */}
        {!loading && activeTab === 'users' && (
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={thStyle}>使用者名稱</th>
                  <th style={thStyle}>角色</th>
                  <th style={thStyle}>建立時間</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={tdStyle}>{u.username}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 10px',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: u.is_admin ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                        color: u.is_admin ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        border: `1px solid ${u.is_admin ? 'var(--accent-primary)' : 'var(--glass-border)'}`
                      }}>
                        {u.is_admin ? '管理員' : '一般用戶'}
                      </span>
                    </td>
                    <td style={tdStyle}>{formatDate(u.created_at)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {!u.is_admin && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleDeleteUser(u.id, u.username)}
                        >
                          <Trash2 size={14} /> 刪除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                      尚無用戶資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Feedback Tab */}
        {!loading && activeTab === 'feedback' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {feedbackList.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                尚無意見回饋
              </div>
            )}
            {feedbackList.map(fb => (
              <div key={fb.id} className="glass-card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{fb.username || '匿名'}</strong>
                    <div style={{ display: 'flex', gap: '2px' }}>{renderStars(fb.rating)}</div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatDate(fb.created_at)}
                  </span>
                </div>
                {fb.comment && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                    {fb.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Table cell styles */
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'var(--glass-highlight)',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '0.9rem',
  color: 'var(--text-primary)',
};
